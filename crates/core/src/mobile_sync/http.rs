//! HTTP gateway and client of the mobile companion sync.
//!
//! The wire format follows the TypeScript application:
//!
//! ```text
//! GET  /api/mobile-sync/info            discovery: { status, ips, port, primaryIp, serverTime }
//! GET  /api/mobile-sync/ping|test       diagnostics: { status, service, version, ... }
//! POST /api/mobile-sync[/upload|/submit] upload one payload, token from query, Bearer header or body
//! PUT  /api/mobile-sync[/upload|/submit] same as POST
//! GET  /api/mobile-sync?token=..&consume=true   poll: { ready, timestamp, payload, token }
//! OPTIONS *                             preflight with 204 and the CORS headers
//! ```
//!
//! Response bodies use the field names of the gateway (`pairedToken`, `receivedSessions`,
//! `receivedTrips`, `ready`, `payload`), so the pairing QR code and the mobile app work unchanged.
//! The differences to the TypeScript gateway are deliberate and documented:
//!
//! - A body that is neither JSON, form data nor base64 JSON is rejected with `400` and a typed
//!   error instead of being stored as raw text, because this gateway validates before it stores.
//! - A payload that names a different `protocol` is rejected with `400`
//!   (`mobile_unsupported_protocol`). The TypeScript gateway stored anything and let the import
//!   screen complain later.
//! - `ips` carries the primary LAN address, because Rust has no interface enumeration without a
//!   platform dependency; clients use `primaryIp`, which the gateway reports as well.

use std::collections::{BTreeSet, HashMap, VecDeque};
use std::io::{Read, Write};
use std::net::{IpAddr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde_json::{json, Value};

use crate::date::format_iso8601;
use crate::error::{CoreError, CoreResult};
use crate::mobile_sync::payload::PROTOCOL;
use crate::now_millis;

/// Port the TypeScript gateway binds first.
pub const DEFAULT_PORT: u16 = 3000;
/// Port it falls back to when the first one is taken.
pub const FALLBACK_PORT: u16 = 3001;
/// How long a received payload stays readable (twenty minutes in the gateway).
pub const MAX_AGE_MS: i64 = 20 * 60 * 1000;
/// Largest accepted request body.
pub const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;
/// Service name reported by `/api/mobile-sync/ping`.
pub const SERVICE_NAME: &str = "SOCDOF Mobile Companion Sync Gateway";

/// Where the gateway listens.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Options {
    /// Bind address, `0.0.0.0` by default so phones in the LAN reach it.
    pub host: String,
    /// Port; `0` binds an ephemeral port, which the tests use.
    pub port: u16,
}

impl Options {
    /// Options for `port` on every interface.
    pub fn new(port: u16) -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port,
        }
    }
}

impl Default for Options {
    fn default() -> Self {
        Self::new(DEFAULT_PORT)
    }
}

type Handler = Arc<dyn Fn(&Value) + Send + Sync>;

/// A running gateway.
pub struct Running {
    address: SocketAddr,
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl Running {
    /// Address the gateway is bound to.
    pub fn address(&self) -> SocketAddr {
        self.address
    }

    /// Upload endpoint the pairing code should carry.
    pub fn url(&self) -> String {
        format!("http://{}/api/mobile-sync", self.address)
    }

    /// Discovery endpoint of this gateway.
    pub fn info_url(&self) -> String {
        format!("http://{}/api/mobile-sync/info", self.address)
    }

    /// Stops the accept loop and waits for it.
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Starts the gateway on the configured port.
///
/// Port `3000` falls back to `3001` when it is taken, like the packaged TypeScript application.
pub fn start(options: Options) -> CoreResult<Running> {
    start_with(options, |_| {})
}

/// Starts the gateway and calls `on_payload` for every accepted upload.
pub fn start_with<F>(options: Options, on_payload: F) -> CoreResult<Running>
where
    F: Fn(&Value) + Send + Sync + 'static,
{
    let listener = match TcpListener::bind((options.host.as_str(), options.port)) {
        Ok(listener) => listener,
        Err(error)
            if options.port == DEFAULT_PORT && error.kind() == std::io::ErrorKind::AddrInUse =>
        {
            TcpListener::bind((options.host.as_str(), FALLBACK_PORT))?
        }
        Err(error) => return Err(CoreError::Io(error)),
    };
    listener.set_nonblocking(true)?;
    let address = listener.local_addr()?;
    let stop = Arc::new(AtomicBool::new(false));
    let sessions = Arc::new(Mutex::new(Sessions::default()));
    let handler: Handler = Arc::new(on_payload);

    let thread_stop = stop.clone();
    let thread_sessions = sessions.clone();
    let thread_handler = handler.clone();
    let handle = thread::spawn(move || {
        while !thread_stop.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let sessions = thread_sessions.clone();
                    let handler = thread_handler.clone();
                    let port = address.port();
                    thread::spawn(move || serve(stream, sessions, handler, port));
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(20));
                }
                Err(_) => break,
            }
        }
    });

    Ok(Running {
        address,
        stop,
        handle: Some(handle),
    })
}

#[derive(Debug, Clone)]
struct StoredSession {
    payload: Value,
    timestamp: i64,
}

#[derive(Debug, Default)]
struct Sessions {
    items: HashMap<String, StoredSession>,
    queue: VecDeque<(String, StoredSession)>,
}

impl Sessions {
    fn insert(&mut self, token: &str, device: Option<&str>, payload: Value, now: i64) {
        let session = StoredSession {
            payload,
            timestamp: now,
        };
        for key in [
            token.to_string(),
            token.to_uppercase(),
            token.to_lowercase(),
            "latest".to_string(),
        ] {
            self.items.insert(key, session.clone());
        }
        if let Some(device) = device.filter(|device| !device.trim().is_empty()) {
            self.items
                .insert(format!("device_{}", device.trim()), session.clone());
        }
        self.queue.push_front((token.to_string(), session));
        while self.queue.len() > 20 {
            self.queue.pop_back();
        }
    }

    fn find(&self, token: &str) -> Option<StoredSession> {
        self.items
            .get(token)
            .cloned()
            .or_else(|| self.items.get(&token.to_uppercase()).cloned())
            .or_else(|| self.items.get(&token.to_lowercase()).cloned())
            .or_else(|| {
                if token == "latest" {
                    None
                } else {
                    self.items.get("latest").cloned()
                }
            })
            .or_else(|| self.queue.front().map(|(_, session)| session.clone()))
    }

    fn remove(&mut self, token: &str) {
        for key in [
            token.to_string(),
            token.to_uppercase(),
            token.to_lowercase(),
            "latest".to_string(),
        ] {
            self.items.remove(&key);
        }
        self.queue.retain(|(queued, _)| queued != token);
    }

    fn active(&self) -> usize {
        self.queue
            .iter()
            .map(|(token, _)| token.as_str())
            .collect::<BTreeSet<_>>()
            .len()
    }
}

struct Request {
    method: String,
    path: String,
    query: Vec<(String, String)>,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

impl Request {
    fn query_param(&self, name: &str) -> Option<String> {
        self.query
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.clone())
            .filter(|value| !value.trim().is_empty())
    }

    fn bearer_token(&self) -> Option<String> {
        self.headers
            .get("authorization")
            .and_then(|value| {
                value
                    .strip_prefix("Bearer ")
                    .or_else(|| value.strip_prefix("bearer "))
            })
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    }
}

#[derive(Debug)]
struct Response {
    status: u16,
    content_type: &'static str,
    body: Vec<u8>,
}

impl Response {
    fn json(status: u16, value: Value) -> Self {
        Self {
            status,
            content_type: "application/json",
            body: value.to_string().into_bytes(),
        }
    }

    fn text(status: u16, text: &str) -> Self {
        Self {
            status,
            content_type: "text/plain; charset=utf-8",
            body: text.as_bytes().to_vec(),
        }
    }

    fn empty(status: u16) -> Self {
        Self {
            status,
            content_type: "text/plain",
            body: Vec::new(),
        }
    }

    fn error(status: u16, code: &str, message: &str) -> Self {
        Self::json(
            status,
            json!({ "success": false, "error": code, "message": message }),
        )
    }

    fn to_bytes(&self) -> Vec<u8> {
        let reason = match self.status {
            200 => "OK",
            204 => "No Content",
            400 => "Bad Request",
            404 => "Not Found",
            405 => "Method Not Allowed",
            413 => "Payload Too Large",
            500 => "Internal Server Error",
            _ => "OK",
        };
        let mut bytes = format!("HTTP/1.1 {} {}\r\n", self.status, reason).into_bytes();
        bytes.extend_from_slice(
            b"Access-Control-Allow-Origin: *\r\n\
              Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS, HEAD, DELETE\r\n\
              Access-Control-Allow-Headers: *\r\n\
              Access-Control-Allow-Private-Network: true\r\n\
              Connection: close\r\n",
        );
        bytes.extend_from_slice(
            format!(
                "Content-Type: {}\r\nContent-Length: {}\r\n\r\n",
                self.content_type,
                self.body.len()
            )
            .as_bytes(),
        );
        bytes.extend_from_slice(&self.body);
        bytes
    }
}

fn serve(mut stream: TcpStream, sessions: Arc<Mutex<Sessions>>, handler: Handler, port: u16) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let response = match read_request(&mut stream) {
        Ok(request) => route(request, &sessions, &handler, port),
        Err(message) => Response::error(400, "mobile_invalid_request", &message),
    };

    let _ = stream.write_all(&response.to_bytes());
    let _ = stream.flush();
}

fn route(
    request: Request,
    sessions: &Arc<Mutex<Sessions>>,
    handler: &Handler,
    port: u16,
) -> Response {
    let path = {
        let trimmed = request.path.trim_end_matches('/');
        if trimmed.is_empty() {
            "/".to_string()
        } else {
            trimmed.to_string()
        }
    };
    let method = request.method.as_str();

    if method == "OPTIONS" && path.starts_with("/api/mobile-sync") {
        return Response::empty(204);
    }

    match (method, path.as_str()) {
        ("GET", "/api/mobile-sync/info") => Response::json(200, info(port)),
        ("GET", "/api/mobile-sync/ping")
        | ("POST", "/api/mobile-sync/ping")
        | ("GET", "/api/mobile-sync/test")
        | ("POST", "/api/mobile-sync/test") => Response::json(200, ping(sessions)),
        ("POST", "/api/mobile-sync")
        | ("PUT", "/api/mobile-sync")
        | ("POST", "/api/mobile-sync/upload")
        | ("PUT", "/api/mobile-sync/upload")
        | ("POST", "/api/mobile-sync/submit")
        | ("PUT", "/api/mobile-sync/submit") => upload(&request, sessions, handler),
        ("GET", "/api/mobile-sync") => poll(&request, sessions),
        _ => Response::text(404, "Not found"),
    }
}

fn info(port: u16) -> Value {
    let ips = local_ipv4_addresses();
    json!({
        "status": "ok",
        "ips": ips,
        "port": port,
        "primaryIp": ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string()),
        "serverTime": format_iso8601(now_millis()),
    })
}

fn ping(sessions: &Arc<Mutex<Sessions>>) -> Value {
    let (active, recent) = match sessions.lock() {
        Ok(sessions) => (sessions.active(), sessions.queue.len()),
        Err(_) => (0, 0),
    };

    json!({
        "status": "online",
        "service": SERVICE_NAME,
        "version": env!("CARGO_PKG_VERSION"),
        "activeSessionsCount": active,
        "recentQueueCount": recent,
        "serverTimestamp": format_iso8601(now_millis()),
        "message": "SOCDOF Sync Gateway is active, ready and reachable!",
    })
}

fn upload(request: &Request, sessions: &Arc<Mutex<Sessions>>, handler: &Handler) -> Response {
    let payload = match decode_body(&request.body) {
        Ok(payload) => payload,
        Err(response) => return response,
    };
    let object = match payload.as_object() {
        Some(object) => object,
        None => {
            return Response::error(
                400,
                "mobile_invalid_payload",
                "Payload must be a JSON object",
            )
        }
    };
    if let Some(protocol) = object.get("protocol").and_then(Value::as_str) {
        if protocol != PROTOCOL {
            return Response::error(
                400,
                "mobile_unsupported_protocol",
                &format!("Unknown protocol {protocol}, expected {PROTOCOL}"),
            );
        }
    }

    let token = request
        .query_param("token")
        .or_else(|| request.bearer_token())
        .or_else(|| {
            ["token", "session_id", "sessionId"]
                .iter()
                .find_map(|key| object.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| "default".to_string());
    let device = object
        .get("deviceId")
        .or_else(|| object.get("device_name"))
        .and_then(Value::as_str);

    match sessions.lock() {
        Ok(mut sessions) => sessions.insert(&token, device, payload.clone(), now_millis()),
        Err(_) => {
            return Response::error(500, "mobile_server_state", "Session store is unavailable")
        }
    }

    handler(&payload);

    let received_sessions = array_len(&payload, &["sessions", "tickets", "records"]);
    let received_trips = array_len(&payload, &["trips", "fahrten"]);
    Response::json(
        200,
        json!({
            "success": true,
            "message": format!(
                "Synchronisation erfolgreich! {received_sessions} Einsätze und {received_trips} Fahrten an SOCDOF übertragen."
            ),
            "receivedSessions": received_sessions,
            "receivedTrips": received_trips,
            "pairedToken": token,
            "timestamp": format_iso8601(now_millis()),
        }),
    )
}

fn poll(request: &Request, sessions: &Arc<Mutex<Sessions>>) -> Response {
    let token = request
        .query_param("token")
        .unwrap_or_else(|| "latest".to_string());
    let consume = request.query_param("consume").as_deref() == Some("true");

    let mut sessions = match sessions.lock() {
        Ok(sessions) => sessions,
        Err(_) => {
            return Response::error(500, "mobile_server_state", "Session store is unavailable")
        }
    };

    let found = sessions.find(&token);
    let fresh = found
        .as_ref()
        .is_some_and(|session| now_millis() - session.timestamp < MAX_AGE_MS);

    match found.filter(|_| fresh) {
        Some(session) => {
            if consume {
                sessions.remove(&token);
            }
            Response::json(
                200,
                json!({
                    "ready": true,
                    "timestamp": session.timestamp,
                    "payload": session.payload,
                    "token": token,
                }),
            )
        }
        None => Response::json(
            200,
            json!({
                "ready": false,
                "status": "listening",
                "message": "Waiting for mobile companion transmission...",
                "serverTime": format_iso8601(now_millis()),
            }),
        ),
    }
}

fn array_len(payload: &Value, keys: &[&str]) -> usize {
    keys.iter()
        .find_map(|key| payload.get(*key).and_then(Value::as_array))
        .map_or(0, Vec::len)
}

fn decode_body(bytes: &[u8]) -> Result<Value, Response> {
    if bytes.is_empty() {
        return Ok(json!({}));
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|_| Response::error(400, "mobile_invalid_json", "Body is not UTF-8"))?;

    if let Ok(value) = serde_json::from_str::<Value>(text) {
        return Ok(value);
    }

    // Form encoded payloads carry the document in `payload`, `data` or `json`.
    for pair in text.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        if matches!(key, "payload" | "data" | "json") {
            if let Ok(value) = serde_json::from_str::<Value>(&percent_decode(value)) {
                return Ok(value);
            }
        }
    }

    if let Some(decoded) = base64_decode(text.trim()) {
        if let Ok(value) = serde_json::from_slice::<Value>(&decoded) {
            return Ok(value);
        }
    }

    Err(Response::error(
        400,
        "mobile_invalid_json",
        "Body is not a JSON payload",
    ))
}

fn read_request(stream: &mut TcpStream) -> Result<Request, String> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];

    loop {
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if buffer.len() > 64 * 1024 {
            return Err("request head too large".to_string());
        }
    }

    let head_end = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4)
        .ok_or_else(|| "malformed request".to_string())?;
    let head = String::from_utf8_lossy(&buffer[..head_end]).to_string();

    let mut lines = head.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| "malformed request".to_string())?;
    let mut parts = request_line.split_whitespace();
    let method = parts
        .next()
        .ok_or_else(|| "malformed request".to_string())?
        .to_string();
    let target = parts
        .next()
        .ok_or_else(|| "malformed request".to_string())?
        .to_string();

    let mut headers = HashMap::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }

    let length: usize = headers
        .get("content-length")
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    if length > MAX_BODY_BYTES {
        return Err("body too large".to_string());
    }

    let mut body = buffer[head_end..].to_vec();
    while body.len() < length {
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }
    body.truncate(length);

    let (path, query) = split_target(&target);
    Ok(Request {
        method,
        path,
        query,
        headers,
        body,
    })
}

fn split_target(target: &str) -> (String, Vec<(String, String)>) {
    let target = if let Some(rest) = target
        .strip_prefix("http://")
        .or_else(|| target.strip_prefix("https://"))
    {
        match rest.find('/') {
            Some(index) => &rest[index..],
            None => "/",
        }
    } else {
        target
    };
    let (path, query) = match target.split_once('?') {
        Some((path, query)) => (path, query),
        None => (target, ""),
    };
    let query = query
        .split('&')
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            (percent_decode(key), percent_decode(value))
        })
        .collect();
    (path.to_string(), query)
}

fn percent_decode(value: &str) -> String {
    let mut bytes = Vec::with_capacity(value.len());
    let mut characters = value.bytes();
    while let Some(byte) = characters.next() {
        match byte {
            b'%' => {
                let high = characters.next().and_then(hex);
                let low = characters.next().and_then(hex);
                match (high, low) {
                    (Some(high), Some(low)) => bytes.push(high * 16 + low),
                    _ => bytes.push(b'%'),
                }
            }
            b'+' => bytes.push(b' '),
            other => bytes.push(other),
        }
    }
    String::from_utf8_lossy(&bytes).to_string()
}

fn hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            other => encoded.push_str(&format!("%{other:02X}")),
        }
    }
    encoded
}

fn base64_decode(value: &str) -> Option<Vec<u8>> {
    let mut bytes = Vec::with_capacity(value.len() * 3 / 4);
    let mut accumulator = 0u32;
    let mut bits = 0u32;

    for byte in value.bytes() {
        if byte == b'=' || byte.is_ascii_whitespace() {
            continue;
        }
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32;
        accumulator = (accumulator << 6) | digit;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push((accumulator >> bits) as u8);
        }
    }

    if bytes.is_empty() {
        None
    } else {
        Some(bytes)
    }
}

fn local_ipv4_addresses() -> Vec<String> {
    let mut addresses = Vec::new();
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        // No packet is sent: connecting only picks the interface with the default route.
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(address) = socket.local_addr() {
                if let IpAddr::V4(ip) = address.ip() {
                    if !ip.is_loopback() {
                        addresses.push(ip.to_string());
                    }
                }
            }
        }
    }
    if addresses.is_empty() {
        addresses.push("127.0.0.1".to_string());
    }
    addresses
}

/// Client for the gateway, used by the desktop side and by tests.
pub mod client {
    use super::*;

    /// Polls the gateway until a payload is ready.
    ///
    /// `url` may be the upload endpoint (`http://host:3000/api/mobile-sync`) or the origin
    /// (`http://host:3000`).
    pub fn poll(url: &str, token: &str, consume: bool) -> CoreResult<Value> {
        let (host, port, path) = split_url(url)?;
        let separator = if path.contains('?') { '&' } else { '?' };
        let target = format!(
            "{path}{separator}token={}&consume={}",
            percent_encode(token),
            consume
        );
        request(&host, port, "GET", &target, None)
    }

    /// Sends one payload to the gateway.
    pub fn send(url: &str, token: &str, payload: &Value) -> CoreResult<Value> {
        let (host, port, path) = split_url(url)?;
        let separator = if path.contains('?') { '&' } else { '?' };
        let target = format!("{path}{separator}token={}", percent_encode(token));
        request(&host, port, "POST", &target, Some(&payload.to_string()))
    }

    fn split_url(url: &str) -> CoreResult<(String, u16, String)> {
        let url = url.trim();
        let rest = url
            .strip_prefix("http://")
            .ok_or_else(|| CoreError::Validation("mobile_invalid_url".to_string()))?;
        let (authority, path) = match rest.find('/') {
            Some(index) => (&rest[..index], &rest[index..]),
            None => (rest, ""),
        };
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => (
                host.to_string(),
                port.parse::<u16>()
                    .map_err(|_| CoreError::Validation("mobile_invalid_url".to_string()))?,
            ),
            None => (authority.to_string(), 80),
        };
        if host.is_empty() {
            return Err(CoreError::Validation("mobile_invalid_url".to_string()));
        }
        let path = if path.is_empty() {
            "/api/mobile-sync".to_string()
        } else {
            path.to_string()
        };
        Ok((host, port, path))
    }

    fn request(
        host: &str,
        port: u16,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> CoreResult<Value> {
        let mut stream = TcpStream::connect((host, port))?;
        stream.set_read_timeout(Some(Duration::from_secs(10)))?;

        let mut head = format!(
            "{method} {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\
             Content-Type: application/json\r\n"
        );
        match body {
            Some(body) => head.push_str(&format!("Content-Length: {}\r\n\r\n{body}", body.len())),
            None => head.push_str("\r\n"),
        }
        stream.write_all(head.as_bytes())?;

        let mut response = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            let read = stream.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            response.extend_from_slice(&buffer[..read]);
        }

        let split = response
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .ok_or_else(|| CoreError::Validation("mobile_invalid_response".to_string()))?;
        let head = String::from_utf8_lossy(&response[..split]).to_string();
        let status = head
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|status| status.parse::<u16>().ok())
            .ok_or_else(|| CoreError::Validation("mobile_invalid_response".to_string()))?;
        if !(200..300).contains(&status) {
            return Err(CoreError::Validation(format!("mobile_http_{status}")));
        }

        serde_json::from_slice(&response[split + 4..])
            .map_err(|_| CoreError::Validation("mobile_invalid_response".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_the_body_formats_the_gateway_accepts() {
        assert_eq!(decode_body(b"").expect("empty"), json!({}));
        assert_eq!(
            decode_body(br#"{"tickets":[]}"#).expect("json"),
            json!({ "tickets": [] })
        );

        let form = "payload=%7B%22tickets%22%3A%5B%5D%7D";
        assert_eq!(
            decode_body(form.as_bytes()).expect("form"),
            json!({ "tickets": [] })
        );

        let base64 = "eyJ0aWNrZXRzIjpbXX0=";
        assert_eq!(
            decode_body(base64.as_bytes()).expect("base64"),
            json!({ "tickets": [] })
        );

        // Broken input is a typed error, not a stored raw body.
        assert!(decode_body(b"{oops").is_err());
        assert!(decode_body(b"just text").is_err());
    }

    #[test]
    fn encodes_and_decodes_query_values() {
        assert_eq!(percent_decode("SOCDOF-4F2A%209111"), "SOCDOF-4F2A 9111");
        assert_eq!(percent_decode("a+b"), "a b");
        assert_eq!(percent_encode("SOCDOF 4F2A"), "SOCDOF%204F2A");

        let (path, query) = split_target("/api/mobile-sync?token=SOCDOF-1&consume=true");
        assert_eq!(path, "/api/mobile-sync");
        assert_eq!(
            query,
            vec![
                ("token".to_string(), "SOCDOF-1".to_string()),
                ("consume".to_string(), "true".to_string())
            ]
        );
    }

    #[test]
    fn starts_on_an_ephemeral_port_and_stops() {
        let mut running = start(Options::new(0)).expect("gateway");
        assert!(running.address().port() > 0);
        assert!(running.url().ends_with("/api/mobile-sync"));
        running.stop();
    }
}
