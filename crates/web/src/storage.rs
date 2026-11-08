//! Browser persistence for the SQLite image.
//!
//! The browser has no writable file system, so the database is kept as a serialized SQLite image in
//! IndexedDB. Reading happens once at startup (before the first screen is drawn) and writing happens
//! whenever the image changed, so accounts, roles, sessions and business data survive a reload, a
//! hard reload and a new tab.
//!
//! IndexedDB is asynchronous, therefore the host starts on a loading screen and applies the image as
//! soon as the browser answered. When IndexedDB is unavailable (private modes that block storage),
//! the host falls back to an in-memory database and reports it instead of pretending to save.

use std::cell::RefCell;
use std::rc::Rc;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{IdbDatabase, IdbRequest, IdbTransactionMode};

/// Name of the IndexedDB database.
const DB_NAME: &str = "socdof";
/// Object store that holds the snapshot.
const STORE_NAME: &str = "app";
/// Key of the snapshot inside the object store.
const KEY: &str = "sqlite";

/// Shared state between the IndexedDB callbacks and the host.
#[derive(Default)]
struct Slots {
    /// Open database handle, `None` while opening or when storage is unavailable.
    database: Option<IdbDatabase>,
    /// Snapshot that was read from storage.
    snapshot: Option<Vec<u8>>,
    /// Whether the read finished (with or without data).
    finished: bool,
    /// Whether opening or reading failed.
    failed: bool,
}

/// IndexedDB handle of this browser tab.
pub struct Storage {
    slots: Rc<RefCell<Slots>>,
}

impl Storage {
    /// Opens IndexedDB and starts reading the stored snapshot.
    pub fn start() -> Self {
        let slots = Rc::new(RefCell::new(Slots::default()));
        let Some(window) = web_sys::window() else {
            slots.borrow_mut().finished = true;
            return Self { slots };
        };
        let Ok(Some(factory)) = window.indexed_db() else {
            slots.borrow_mut().finished = true;
            return Self { slots };
        };
        let Ok(request) = factory.open(DB_NAME) else {
            slots.borrow_mut().finished = true;
            return Self { slots };
        };

        // First start of this browser: create the object store that keeps the snapshot.
        let upgrade = Closure::<dyn FnMut(web_sys::Event)>::new(|event: web_sys::Event| {
            let database = event
                .target()
                .and_then(|target| target.dyn_into::<web_sys::IdbOpenDbRequest>().ok())
                .and_then(|request| request.result().ok())
                .and_then(|value| value.dyn_into::<IdbDatabase>().ok());
            if let Some(database) = database {
                let _ = database.create_object_store(STORE_NAME);
            }
        });
        request.set_onupgradeneeded(Some(upgrade.as_ref().unchecked_ref()));
        upgrade.forget();

        let opened = slots.clone();
        let success = Closure::<dyn FnMut(web_sys::Event)>::new(move |event: web_sys::Event| {
            let database = event
                .target()
                .and_then(|target| target.dyn_into::<IdbRequest>().ok())
                .and_then(|request| request.result().ok())
                .and_then(|value| value.dyn_into::<IdbDatabase>().ok());
            let Some(database) = database else {
                let mut slots = opened.borrow_mut();
                slots.failed = true;
                slots.finished = true;
                return;
            };
            opened.borrow_mut().database = Some(database.clone());
            read_snapshot(&database, opened.clone());
        });
        request.set_onsuccess(Some(success.as_ref().unchecked_ref()));
        success.forget();

        let failed = slots.clone();
        let error = Closure::<dyn FnMut(web_sys::Event)>::new(move |_event: web_sys::Event| {
            let mut slots = failed.borrow_mut();
            slots.failed = true;
            slots.finished = true;
        });
        request.set_onerror(Some(error.as_ref().unchecked_ref()));
        error.forget();

        Self { slots }
    }

    /// Returns the read result once the browser answered.
    ///
    /// `None` means the read is still running, `Ok(None)` means this browser has no snapshot yet.
    pub fn take_load(&mut self) -> Option<Result<Option<Vec<u8>>, ()>> {
        let mut slots = self.slots.borrow_mut();
        if !slots.finished {
            return None;
        }
        slots.finished = false;
        if slots.failed {
            return Some(Err(()));
        }
        Some(Ok(slots.snapshot.take()))
    }

    /// Whether the snapshot is stored in IndexedDB (storage is writable).
    pub fn is_writable(&self) -> bool {
        self.slots.borrow().database.is_some()
    }

    /// Writes the database image to IndexedDB.
    pub fn save(&self, bytes: &[u8]) {
        let slots = self.slots.borrow();
        let Some(database) = slots.database.as_ref() else {
            return;
        };
        let Ok(transaction) =
            database.transaction_with_str_and_mode(STORE_NAME, IdbTransactionMode::Readwrite)
        else {
            return;
        };
        let Ok(store) = transaction.object_store(STORE_NAME) else {
            return;
        };
        let array = js_sys::Uint8Array::from(bytes);
        let _ = store.put_with_key(array.as_ref(), &JsValue::from_str(KEY));
    }
}

/// Reads the stored snapshot and reports it through the shared slots.
fn read_snapshot(database: &IdbDatabase, slots: Rc<RefCell<Slots>>) {
    let transaction = database.transaction_with_str(STORE_NAME);
    let Ok(transaction) = transaction else {
        finish_failed(&slots);
        return;
    };
    let Ok(store) = transaction.object_store(STORE_NAME) else {
        finish_failed(&slots);
        return;
    };
    let Ok(request) = store.get(&JsValue::from_str(KEY)) else {
        finish_failed(&slots);
        return;
    };

    let loaded = slots.clone();
    let success = Closure::<dyn FnMut(web_sys::Event)>::new(move |event: web_sys::Event| {
        let value = event
            .target()
            .and_then(|target| target.dyn_into::<IdbRequest>().ok())
            .and_then(|request| request.result().ok());
        let snapshot = value
            .and_then(|value| value.dyn_into::<js_sys::Uint8Array>().ok())
            .map(|array| array.to_vec());
        let mut slots = loaded.borrow_mut();
        slots.snapshot = snapshot;
        slots.finished = true;
    });
    request.set_onsuccess(Some(success.as_ref().unchecked_ref()));
    success.forget();

    let failed = slots;
    let error = Closure::<dyn FnMut(web_sys::Event)>::new(move |_event: web_sys::Event| {
        finish_failed(&failed);
    });
    request.set_onerror(Some(error.as_ref().unchecked_ref()));
    error.forget();
}

/// Marks the read as finished and failed.
fn finish_failed(slots: &Rc<RefCell<Slots>>) {
    let mut slots = slots.borrow_mut();
    slots.failed = true;
    slots.finished = true;
}
