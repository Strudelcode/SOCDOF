//! End-to-end tests of the mobile companion sync.
//!
//! The gateway is started on an ephemeral port and spoken to with a raw TCP client, so the tests
//! exercise the real HTTP path (request line, headers, body) instead of calling the router.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use serde_json::{json, Value};

use socdof_core::mobile_sync::{self, client, http, Options, PROTOCOL};
use socdof_core::store::Store;

const FIXTURE: &str = include_str!("fixtures/mobile/sync_payload.json");

struct Reply {
    status: u16,
    headers: String,
    body: String,
}

impl Reply {
    fn json(&self) -> Value {
        serde_json::from_str(&self.body).expect("json body")
    }
}

fn request(
    address: SocketAddr,
    method: &str,
    target: &str,
    headers: &[(&str, &str)],
    body: Option<&str>,
) -> Reply {
    let mut stream = TcpStream::connect(address).expect("connect");
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .expect("timeout");

    let mut head =
        format!("{method} {target} HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n");
    for (name, value) in headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    match body {
        Some(body) => head.push_str(&format!(
            "Content-Length: {}\r\nContent-Type: application/json\r\n\r\n{body}",
            body.len()
        )),
        None => head.push_str("\r\n"),
    }

    stream.write_all(head.as_bytes()).expect("write");
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).expect("read");

    let split = raw
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .expect("response head");
    let head = String::from_utf8_lossy(&raw[..split]).to_string();
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|status| status.parse().ok())
        .expect("status");

    Reply {
        status,
        headers: head,
        body: String::from_utf8_lossy(&raw[split + 4..]).to_string(),
    }
}

fn test_options() -> Options {
    Options {
        host: "127.0.0.1".to_string(),
        port: 0,
    }
}

fn start() -> http::Running {
    http::start(test_options()).expect("gateway")
}

#[test]
fn discovery_and_diagnostics_match_the_typescript_gateway() {
    let server = start();
    let address = server.address();

    let info = request(address, "GET", "/api/mobile-sync/info", &[], None);
    assert_eq!(info.status, 200);
    assert!(info.headers.contains("Access-Control-Allow-Origin: *"));
    let info = info.json();
    assert_eq!(info["status"], "ok");
    assert_eq!(info["port"], address.port());
    assert!(info["primaryIp"].is_string(), "discovery needs an address");
    assert!(info["ips"].is_array());
    assert!(info["serverTime"].is_string());

    for target in ["/api/mobile-sync/ping", "/api/mobile-sync/test"] {
        let ping = request(address, "GET", target, &[], None);
        assert_eq!(ping.status, 200);
        let ping = ping.json();
        assert_eq!(ping["status"], "online");
        assert_eq!(ping["service"], "SOCDOF Mobile Companion Sync Gateway");
        assert_eq!(ping["activeSessionsCount"], 0);
        assert_eq!(ping["recentQueueCount"], 0);
    }

    let preflight = request(address, "OPTIONS", "/api/mobile-sync", &[], None);
    assert_eq!(preflight.status, 204);
    assert!(preflight
        .headers
        .contains("Access-Control-Allow-Headers: *"));

    let unknown = request(address, "GET", "/api/unknown", &[], None);
    assert_eq!(unknown.status, 404);
    assert_eq!(unknown.body, "Not found");
}

#[test]
fn uploads_a_fixture_payload_and_polls_it_back() {
    let database = std::env::temp_dir().join(format!("socdof-mobile-{}.db", std::process::id()));
    let _ = std::fs::remove_file(&database);
    let importing = database.clone();

    let mut server = http::start_with(test_options(), move |payload| {
        match Store::open(&importing).and_then(|store| mobile_sync::import_value(&store, payload)) {
            Ok(_) => {}
            Err(error) => eprintln!("import failed: {error}"),
        }
    })
    .expect("gateway");
    let address = server.address();

    // A phone uploads with its pairing token in the query string, exactly like the app does.
    let upload = request(
        address,
        "POST",
        "/api/mobile-sync?token=SOCDOF-4F2A-9111",
        &[],
        Some(FIXTURE),
    );
    assert_eq!(upload.status, 200);
    let upload = upload.json();
    assert_eq!(upload["success"], true);
    assert_eq!(upload["receivedSessions"], 1);
    assert_eq!(upload["receivedTrips"], 1);
    assert_eq!(upload["pairedToken"], "SOCDOF-4F2A-9111");
    assert!(upload["message"]
        .as_str()
        .expect("message")
        .contains("1 Einsätze"));

    // The desktop polls the same token and receives the document unchanged.
    let poll = request(
        address,
        "GET",
        "/api/mobile-sync?token=SOCDOF-4F2A-9111",
        &[],
        None,
    );
    assert_eq!(poll.status, 200);
    let poll = poll.json();
    assert_eq!(poll["ready"], true);
    assert_eq!(poll["token"], "SOCDOF-4F2A-9111");
    assert_eq!(poll["payload"]["protocol"], PROTOCOL);
    assert_eq!(poll["payload"]["exportVersion"], "1.0");
    assert_eq!(poll["payload"]["deviceId"], "sunrise-fields-01");
    assert_eq!(poll["payload"]["tickets"][0]["ticket_number"], "MOB-101");
    assert_eq!(
        poll["payload"]["sessions"][0]["notes"]["task"],
        "Filterpatrone tauschen"
    );
    assert_eq!(poll["payload"]["summary"]["currency"], "EUR");

    // Consuming clears the slot for the token and for `latest`.
    let consumed = request(
        address,
        "GET",
        "/api/mobile-sync?token=SOCDOF-4F2A-9111&consume=true",
        &[],
        None,
    );
    assert_eq!(consumed.json()["ready"], true);
    let empty = request(
        address,
        "GET",
        "/api/mobile-sync?token=SOCDOF-4F2A-9111",
        &[],
        None,
    );
    let empty = empty.json();
    assert_eq!(empty["ready"], false);
    assert_eq!(empty["status"], "listening");
    assert!(empty["serverTime"].is_string());

    // The database now holds the planned tickets and their booked time.
    let store = Store::open(&database).expect("database");
    let tickets = store.list_support_tickets().expect("tickets");
    assert_eq!(tickets.len(), 3);
    let minutes: i64 = tickets
        .iter()
        .flat_map(|ticket| {
            store
                .time_entries_for_ticket(ticket.id)
                .expect("timesheets")
        })
        .map(|entry| entry.minutes)
        .sum();
    assert_eq!(minutes, 405);

    // The query token wins over the Bearer header, and a Bearer-only upload is accepted too.
    let uploaded = request(
        address,
        "POST",
        "/api/mobile-sync?token=device_alias",
        &[("Authorization", "Bearer SOCDOF-BEARER-0001")],
        Some(FIXTURE),
    );
    assert_eq!(uploaded.json()["pairedToken"], "device_alias");
    let bearer = request(
        address,
        "POST",
        "/api/mobile-sync",
        &[("Authorization", "Bearer SOCDOF-BEARER-0002")],
        Some(FIXTURE),
    );
    assert_eq!(bearer.json()["pairedToken"], "SOCDOF-BEARER-0002");
    let latest = request(address, "GET", "/api/mobile-sync?token=latest", &[], None);
    assert_eq!(latest.json()["ready"], true);

    server.stop();
    let _ = std::fs::remove_file(&database);
}

#[test]
fn imports_the_fixture_into_a_real_database() {
    let store = Store::open_in_memory().expect("database");
    let report = mobile_sync::import_bytes(&store, FIXTURE.as_bytes()).expect("import");

    assert_eq!(
        report.tickets_created, 3,
        "ticket, session and standalone booking"
    );
    assert_eq!(report.duplicates, 0);
    assert_eq!(report.timesheets, 3);
    assert_eq!(report.minutes, 135 + 150 + 120);
    assert_eq!(report.expenses, 4);
    assert_eq!(report.expense_cents, 2_520 + 3_830 + 2_520 + 450);
    assert_eq!(report.kilometers, 42.0 + 42.0);

    let tickets = store.list_support_tickets().expect("tickets");
    assert_eq!(tickets.len(), 3);

    let explicit = tickets
        .iter()
        .find(|ticket| ticket.description.contains("Ticket-Nr.: MOB-101"))
        .expect("explicit ticket");
    assert!(explicit.description.contains("Ticket-Nr.: MOB-101"));
    assert!(explicit
        .description
        .contains("Sprachnotiz: Filterpatrone getauscht"));

    // A second import of the same document does not duplicate the tickets.
    let again = mobile_sync::import_bytes(&store, FIXTURE.as_bytes()).expect("import");
    assert_eq!(again.tickets_created, 0);
    assert_eq!(again.duplicates, 3);
}

#[test]
fn rejects_broken_requests_with_typed_errors() {
    let server = start();
    let address = server.address();

    let broken = request(address, "POST", "/api/mobile-sync", &[], Some("{oops"));
    assert_eq!(broken.status, 400);
    let broken = broken.json();
    assert_eq!(broken["success"], false);
    assert_eq!(broken["error"], "mobile_invalid_json");

    let array = request(address, "POST", "/api/mobile-sync", &[], Some("[1,2,3]"));
    assert_eq!(array.status, 400);
    assert_eq!(array.json()["error"], "mobile_invalid_payload");

    let foreign = request(
        address,
        "POST",
        "/api/mobile-sync",
        &[],
        Some(&json!({ "protocol": "SOMETHING_ELSE_V9", "tickets": [] }).to_string()),
    );
    assert_eq!(foreign.status, 400);
    assert_eq!(foreign.json()["error"], "mobile_unsupported_protocol");

    let empty = request(
        address,
        "POST",
        "/api/mobile-sync",
        &[],
        Some(&json!({ "protocol": PROTOCOL, "tickets": [] }).to_string()),
    );
    assert_eq!(
        empty.status, 200,
        "the gateway stores and the import judges"
    );

    let missing = request(address, "POST", "/api/mobile-sync/missing", &[], None);
    assert_eq!(missing.status, 404);

    // The gateway is still alive after all of that.
    let ping = request(address, "GET", "/api/mobile-sync/ping", &[], None);
    assert_eq!(ping.status, 200);
}

#[test]
fn accepts_form_encoded_and_base64_documents() {
    let server = start();
    let address = server.address();

    let form = "payload=%7B%22tickets%22%3A%5B%7B%22title%22%3A%22Form%22%7D%5D%7D";
    let reply = request(
        address,
        "POST",
        "/api/mobile-sync",
        &[("Content-Type", "application/x-www-form-urlencoded")],
        Some(form),
    );
    assert_eq!(reply.status, 200);
    assert_eq!(reply.json()["receivedSessions"], 1);

    let base64 = "eyJ0aWNrZXRzIjpbeyJ0aXRsZSI6IkJhc2U2NCJ9XX0=";
    let reply = request(address, "POST", "/api/mobile-sync", &[], Some(base64));
    assert_eq!(reply.status, 200);
}

#[test]
fn client_roundtrip_sends_and_polls_the_same_values() {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("fixture");
    let mut server = start();
    let origin = format!("http://{}", server.address());

    let sent = client::send(&server.url(), "SOCDOF-1234-5678", &fixture).expect("send");
    assert_eq!(sent["success"], true);
    assert_eq!(sent["pairedToken"], "SOCDOF-1234-5678");

    // Polling the origin without a path resolves to the sync endpoint, like the app does.
    let polled = client::poll(&origin, "SOCDOF-1234-5678", true).expect("poll");
    assert_eq!(polled["ready"], true);
    assert_eq!(polled["payload"], fixture);

    let empty = client::poll(&origin, "SOCDOF-1234-5678", true).expect("poll");
    assert_eq!(empty["ready"], false);

    let error = client::poll("ftp://example.invalid", "token", false);
    assert!(error.is_err(), "invalid schemes are typed errors");

    server.stop();
}
