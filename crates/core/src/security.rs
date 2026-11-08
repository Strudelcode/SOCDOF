//! Password hashing.
//!
//! Passwords are stored as Argon2id PHC strings. The plain password never leaves this module and is
//! never written to the database, logs or disk.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use sha2::{Digest, Sha256};
use uuid::Uuid;

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

/// Hashes a short recovery answer with a fresh random salt.
///
/// Security answers are not passwords, so no minimum length applies; the caller rejects empty
/// answers.
pub fn hash_secret(plain: &str) -> CoreResult<String> {
    if plain.trim().is_empty() {
        return Err(CoreError::Validation("secret_required".to_string()));
    }
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plain.trim().as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| CoreError::Validation(format!("secret_hash_failed: {error}")))
}

/// Creates a session token and its storage hash.
///
/// The token is two random UUIDs without separators (64 hex characters). Only the SHA-256 hash is
/// written to the database, so a stolen database cannot be used to take over live sessions.
pub fn new_session_token() -> (String, String) {
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let hash = hash_token(&token);
    (token, hash)
}

/// SHA-256 of a session token, hex encoded.
pub fn hash_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        hex.push_str(&format!("{byte:02x}"));
    }
    hex
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
    fn hashes_short_security_answers() {
        let hash = hash_secret("Rex").expect("hash");
        assert_ne!(hash, "Rex");
        assert!(verify_password("Rex", &hash));
        assert!(!verify_password("rex", &hash));
        assert!(hash_secret("   ").is_err());
    }

    #[test]
    fn creates_unique_session_tokens_with_stable_hashes() {
        let (first_token, first_hash) = new_session_token();
        let (second_token, second_hash) = new_session_token();

        assert_eq!(first_token.len(), 64);
        assert_ne!(first_token, second_token);
        assert_ne!(first_hash, second_hash);
        assert_eq!(first_hash.len(), 64);
        assert_eq!(hash_token(&first_token), first_hash);
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
