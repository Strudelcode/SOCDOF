//! Application shell lifecycle.
//!
//! The shell is the only place that decides when the core services run: it takes the
//! single-instance lock before SQLite opens the database, keeps the lock for the whole session and
//! releases it on shutdown. Window layers only call into this module; they never open the database
//! themselves.

use std::path::PathBuf;

use serde::Serialize;
use socdof_core::error::CoreResult;
use socdof_core::lock::{InstanceLock, LockInfo};
use socdof_core::now_millis;
use socdof_core::store::Store;

/// File system locations of one application instance.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Paths {
    /// SQLite database file.
    pub database: PathBuf,
    /// Lock file that guards the database.
    pub lock: PathBuf,
}

impl Paths {
    /// Derives the lock file next to the database (`socdof.db` becomes `socdof.lock`).
    pub fn new(database: impl Into<PathBuf>) -> Self {
        let database = database.into();
        let lock = database.with_extension("lock");
        Self { database, lock }
    }
}

/// Everything the first screen needs after startup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ShellStatus {
    /// Database that was opened.
    pub database: PathBuf,
    /// Schema version after migrations.
    pub schema_version: i64,
    /// Number of contacts.
    pub contacts: i64,
    /// Number of products.
    pub products: i64,
    /// Number of invoices.
    pub invoices: i64,
    /// Number of user accounts.
    pub users: i64,
    /// PID of the process holding the instance lock.
    pub lock_owner_pid: Option<u32>,
    /// Start time in milliseconds since the Unix epoch.
    pub started_at: i64,
}

/// A running SOCDOF session.
pub struct Shell {
    paths: Paths,
    // Option only so `restore` can close the connection before the file is replaced.
    store: Option<Store>,
    lock: InstanceLock,
    started_at: i64,
}

impl Shell {
    /// Takes the instance lock and opens the database.
    ///
    /// The lock comes first: a second start is rejected with `lock_busy` before it can touch the
    /// file, and a restore can never race another process. If the database cannot be opened the
    /// lock is released again by [`InstanceLock`]'s `Drop`.
    pub fn start(paths: Paths) -> CoreResult<Self> {
        let lock = InstanceLock::acquire(&paths.lock)?;
        let store = Store::open(&paths.database)?;

        Ok(Self {
            paths,
            store: Some(store),
            lock,
            started_at: now_millis(),
        })
    }

    /// Paths this session works with.
    pub fn paths(&self) -> &Paths {
        &self.paths
    }

    /// Owner of the lock file, if it is readable.
    pub fn lock_owner(&self) -> Option<LockInfo> {
        self.lock.owner()
    }

    /// Start time in milliseconds since the Unix epoch.
    pub fn started_at(&self) -> i64 {
        self.started_at
    }

    /// Refreshes the lock heartbeat; the window loop calls this periodically.
    pub fn heartbeat(&mut self) -> CoreResult<()> {
        self.lock.heartbeat(now_millis())
    }

    /// Current state for the first screen.
    pub fn status(&self) -> CoreResult<ShellStatus> {
        let store = self.store();

        Ok(ShellStatus {
            database: self.paths.database.clone(),
            schema_version: store.schema_version()?,
            contacts: store.contact_count()?,
            products: store.product_count()?,
            invoices: store.invoice_count()?,
            users: store.user_count()?,
            lock_owner_pid: self.lock.owner().map(|owner| owner.pid),
            started_at: self.started_at,
        })
    }

    /// Ends the session. The lock file is removed by [`InstanceLock`]'s `Drop`.
    pub fn shutdown(self) {}

    /// The open store. `restore` is the only place that temporarily takes it out.
    pub(crate) fn store(&self) -> &Store {
        self.store
            .as_ref()
            .expect("the store is open outside of restore")
    }

    pub(crate) fn take_store(&mut self) -> Store {
        self.store
            .take()
            .expect("the store is open outside of restore")
    }

    pub(crate) fn put_store(&mut self, store: Store) {
        self.store = Some(store);
    }
}
