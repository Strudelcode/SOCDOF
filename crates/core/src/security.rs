//! Password hashing.
//!
//! Passwords are stored as Argon2id PHC strings. The plain password never leaves this module and is
//! never written to the database, logs or disk.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

use crate::error::{CoreError, CoreResult};

/// Minimum length of a password accepted by the application.
pub const MIN_PASSWORD_LENGTH: usize = 8;

/// Hashes a plain password with a fresh random salt.
pub fn hash_password(plain: &str) -> CoreResult<String> {
    if plain.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(CoreError::Validation("password_too_short".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plain.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| CoreError::Validation(format!("password_hash_failed: {error}")))
}

/// Checks a plain password against a stored PHC string. Returns `false` for malformed hashes.
pub fn verify_password(plain: &str, stored_hash: &str) -> bool {
    match PasswordHash::new(stored_hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(plain.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies_passwords() {
        let hash = hash_password("correct horse battery").expect("hash");
        assert_ne!(hash, "correct horse battery");
        assert!(hash.starts_with("$argon2id$"));
        assert!(verify_password("correct horse battery", &hash));
        assert!(!verify_password("wrong password", &hash));
    }

    #[test]
    fn rejects_short_passwords_and_broken_hashes() {
        assert!(hash_password("short").is_err());
        assert!(!verify_password("anything", "not-a-phc-string"));
    }

    #[test]
    fn produces_a_unique_salt_per_hash() {
        let first = hash_password("same password").expect("hash");
        let second = hash_password("same password").expect("hash");
        assert_ne!(first, second);
        assert!(verify_password("same password", &first));
        assert!(verify_password("same password", &second));
    }
}
