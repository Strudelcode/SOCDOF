//! Desktop-state proof for calendar ranges, conflicts and CRUD.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{AppointmentInput, DesktopState};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir() -> PathBuf {
    let unique = format!(
        "socdof-calendar-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn input(title: &str, starts_at: i64) -> AppointmentInput {
    AppointmentInput {
        id: None,
        contact_id: None,
        title: title.to_string(),
        location: "Raum 1".to_string(),
        notes: "Vorbereitung".to_string(),
        status: "scheduled".to_string(),
        starts_at,
        ends_at: starts_at + 60 * 60 * 1000,
    }
}

#[test]
fn appointments_roundtrip_in_range_and_reject_overlaps() {
    let dir = temp_dir();
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let start = 1_700_000_000_000;

    let created = state
        .save_appointment(&input("Kickoff", start))
        .expect("appointment is created");
    assert_eq!(created.title, "Kickoff");
    assert_eq!(
        state
            .appointments_between(start - 1, start + 1)
            .expect("range")
            .len(),
        1
    );
    assert!(state
        .appointments_between(start + 3_600_000, start + 7_200_000)
        .expect("range")
        .is_empty());

    let mut overlap = input("Overlap", start + 30 * 60 * 1000);
    overlap.contact_id = Some(created.id);
    assert!(state.save_appointment(&overlap).is_err());

    let mut update = input("Kickoff neu", start);
    update.id = Some(created.id);
    let updated = state
        .save_appointment(&update)
        .expect("appointment is updated");
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.title, "Kickoff neu");

    state
        .delete_appointment(created.id)
        .expect("appointment is deleted");
    assert!(state
        .appointments_between(start - 1, start + 1)
        .expect("range")
        .is_empty());
}
