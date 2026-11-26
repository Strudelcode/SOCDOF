//! Frame budget for the dataset the migration plan names: 50k contacts and 100k invoices.
//!
//! The real screens run without a display, so the measured value is the CPU cost of one frame of
//! the actual egui layout code. Budget: 16.6 ms per frame (60 fps) for the median and the 95th
//! percentile. `SOCDOF_FRAME_BUDGET_MS` overrides the limit, which is how a run proves that the
//! check fails when the threshold is lowered.

use std::time::Instant;

use egui::{Context, Pos2, RawInput, Rect, Vec2};
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::Language;
use socdof_core::money::Money;
use socdof_core::store::Store;
use socdof_ui::contacts::{contacts, ContactsState};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::invoices::{invoices, InvoicesState};
use socdof_ui::theme::{Appearance, Theme};

const CONTACTS: usize = 50_000;
const INVOICES: usize = 100_000;
const NOW: i64 = 1_760_000_000_000;
const WARMUP_FRAMES: usize = 3;
const MEASURED_FRAMES: usize = 20;
const DEFAULT_BUDGET_MS: f64 = 16.6;

fn budget_ms() -> f64 {
    std::env::var("SOCDOF_FRAME_BUDGET_MS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_BUDGET_MS)
}

fn seed(store: &Store) -> uuid::Uuid {
    let started = Instant::now();
    let mut contacts = Vec::with_capacity(CONTACTS);
    for index in 0..CONTACTS {
        let mut contact = Contact::new(ContactKind::Company, NOW);
        contact.name = Some(format!("Kontakt {index:05}"));
        contact.company_name = contact.name.clone();
        contact.email = Some(format!("kontakt{index:05}@example.invalid"));
        contact.city = Some(format!("Stadt {}", index % 500));
        contacts.push(contact);
    }
    let customer = contacts.first().expect("at least one contact").id;
    store.insert_contacts(&contacts).expect("contacts");

    let invoices: Vec<Invoice> = (0..INVOICES)
        .map(|index| Invoice {
            id: uuid::Uuid::new_v4(),
            number: format!("2026-{index:06}"),
            contact_id: customer,
            status: InvoiceStatus::Sent,
            issued_at: NOW - index as i64 * 60_000,
            due_at: NOW + 14 * 86_400_000,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![InvoiceLine {
                description: "Leistung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(12_000),
                tax_rate_bp: 1_900,
            }],
        })
        .collect();
    store.insert_invoices(&invoices).expect("invoices");
    eprintln!(
        "seeded {CONTACTS} contacts and {INVOICES} invoices in {:.1} s",
        started.elapsed().as_secs_f64()
    );
    customer
}

fn frame_times(ctx: &Context, mut draw: impl FnMut(&Context)) -> Vec<f64> {
    let mut times = Vec::new();
    for frame in 0..(WARMUP_FRAMES + MEASURED_FRAMES) {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 900.0))),
            time: Some(frame as f64 * 0.016),
            ..Default::default()
        };
        let started = Instant::now();
        let output = ctx.run(input, |ctx| draw(ctx));
        std::hint::black_box(&output);
        if frame >= WARMUP_FRAMES {
            times.push(started.elapsed().as_secs_f64() * 1_000.0);
        }
    }
    times
}

/// Peak resident memory of this test process after both screens rendered at least once, so the
/// memory report in `docs/performance.md` has a measured number for the large dataset path.
fn report_memory() {
    let Ok(status) = std::fs::read_to_string("/proc/self/status") else {
        return;
    };
    let field = |name: &str| {
        status
            .lines()
            .find(|line| line.starts_with(name))
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|value| value.parse::<f64>().ok())
            .map(|kib| kib / 1024.0)
    };
    if let (Some(rss), Some(peak)) = (field("VmRSS:"), field("VmHWM:")) {
        eprintln!("ui dataset memory: rss {rss:.1} MiB, peak {peak:.1} MiB");
    }
}

fn percentile(sorted: &[f64], fraction: f64) -> f64 {
    let index = ((sorted.len() - 1) as f64 * fraction).round() as usize;
    sorted[index]
}

fn assert_budget(name: &str, times: Vec<f64>, budget: f64) {
    let mut sorted = times;
    sorted.sort_by(f64::total_cmp);
    let median = percentile(&sorted, 0.5);
    let p95 = percentile(&sorted, 0.95);
    eprintln!(
        "{name}: median {median:.2} ms, p95 {p95:.2} ms, budget {budget:.2} ms, frames {}",
        sorted.len()
    );
    assert!(
        median <= budget,
        "{name} median {median:.2} ms exceeds {budget:.2} ms"
    );
    assert!(
        p95 <= budget,
        "{name} p95 {p95:.2} ms exceeds {budget:.2} ms"
    );
}

/// Opt-in benchmark: a debug build lays out text and SQLite rows an order of magnitude slower, so
/// the 60 fps budget is only meaningful in a release build. Run it with
/// `cargo test --release -p socdof-ui --test performance -- --ignored --nocapture`;
/// `.github/workflows/rust.yml` does that in the `desktop` job.
#[test]
#[ignore = "release-mode frame benchmark, see the doc comment"]
fn contacts_and_invoices_stay_within_the_frame_budget() {
    let store = Store::open_in_memory().expect("in-memory store");
    let customer = seed(&store);
    assert!(customer != uuid::Uuid::nil());

    let theme = Theme::new(Appearance::Light, "indigo");
    let texts = UiTexts::embedded(Language::En).expect("embedded catalogue");
    let budget = budget_ms();

    let contacts_context = Context::default();
    theme.apply(&contacts_context);
    let mut contacts_focus = FocusState::default();
    let mut contacts_state = ContactsState::new();
    let load = Instant::now();
    contacts_state.refresh(&store).expect("load contacts");
    eprintln!("loaded contacts in {:.1} s", load.elapsed().as_secs_f64());
    assert_eq!(contacts_state.contacts.len(), CONTACTS);
    let contact_frames = frame_times(&contacts_context, |ctx| {
        contacts(
            ctx,
            &theme,
            &texts,
            &mut contacts_focus,
            &mut contacts_state,
            &store,
            NOW,
        );
    });
    assert_budget("contacts 50k", contact_frames, budget);

    let invoices_context = Context::default();
    theme.apply(&invoices_context);
    let mut invoices_focus = FocusState::default();
    let mut invoices_state = InvoicesState::new();
    let load = Instant::now();
    invoices_state.refresh(&store).expect("load invoices");
    eprintln!("loaded invoices in {:.1} s", load.elapsed().as_secs_f64());
    assert_eq!(invoices_state.invoices.len(), INVOICES);
    let invoice_frames = frame_times(&invoices_context, |ctx| {
        invoices(
            ctx,
            &theme,
            &texts,
            &mut invoices_focus,
            &mut invoices_state,
            &store,
            NOW,
        );
    });
    assert_budget("invoices 100k", invoice_frames, budget);
    report_memory();
}
