//! Development probe for the instance lock.
//!
//! Holds the lock for a number of seconds so contention can be tested with real processes:
//!
//! ```text
//! cargo run -p socdof-core --example lock_hold -- /tmp/socdof.lock 30
//! ```
//!
//! Exits with status 2 when the lock is held by another instance.

use std::time::Duration;

use socdof_core::lock::InstanceLock;
use socdof_core::now_millis;

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("usage: lock_hold <lock-file> <seconds>");
    let seconds: u64 = args
        .next()
        .expect("usage: lock_hold <lock-file> <seconds>")
        .parse()
        .expect("seconds must be a number");

    let mut lock = match InstanceLock::acquire(&path) {
        Ok(lock) => lock,
        Err(error) => {
            eprintln!("lock rejected: {error}");
            std::process::exit(2);
        }
    };

    println!(
        "locked {} (pid {})",
        lock.path().display(),
        std::process::id()
    );

    for _ in 0..seconds {
        std::thread::sleep(Duration::from_secs(1));
        lock.heartbeat(now_millis()).expect("heartbeat");
    }
}
