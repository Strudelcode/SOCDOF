//! Security questions for local account recovery.
//!
//! Answers are stored as Argon2id hashes in the settings table, keyed per user. The questions
//! themselves are fixed UI prompts, so only hashes of the answers ever reach the database.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::security::{hash_secret, verify_password};
use crate::store::Store;

/// Prefix of the per-user security-answer keys.
pub const SECURITY_QUESTIONS_PREFIX: &str = "user_security_questions:";

/// Persisted hashed answers, in the order of the questions shown by the UI.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct SecurityAnswers {
    /// Argon2id hashes, one per question.
    pub answer_hashes: Vec<String>,
}

impl SecurityAnswers {
    /// Whether at least one answer has been configured.
    pub fn is_configured(&self) -> bool {
        self.answer_hashes.iter().any(|hash| !hash.is_empty())
    }
}

fn key(user_id: Uuid) -> String {
    format!("{SECURITY_QUESTIONS_PREFIX}{user_id}")
}

/// Loads the configured hashes. A user without answers gets an empty set.
pub fn security_answers(store: &Store, user_id: Uuid) -> CoreResult<SecurityAnswers> {
    match store.get_setting(&key(user_id))? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(SecurityAnswers::default()),
    }
}

/// Validates, hashes and stores the answers.
pub fn save_security_answers(store: &Store, user_id: Uuid, answers: &[String]) -> CoreResult<()> {
    if answers.len() != 2 {
        return Err(CoreError::Validation("security_two_answers".to_string()));
    }
    let mut hashes = Vec::with_capacity(answers.len());
    for answer in answers {
        let answer = answer.trim();
        if answer.len() < 2 {
            return Err(CoreError::Validation(
                "security_answer_required".to_string(),
            ));
        }
        hashes.push(hash_secret(answer)?);
    }
    store.put_setting(
        &key(user_id),
        &serde_json::to_value(SecurityAnswers {
            answer_hashes: hashes,
        })?,
    )
}

/// Verifies one answer by its question index.
pub fn verify_security_answer(
    store: &Store,
    user_id: Uuid,
    index: usize,
    answer: &str,
) -> CoreResult<bool> {
    let stored = security_answers(store, user_id)?;
    let Some(hash) = stored.answer_hashes.get(index) else {
        return Ok(false);
    };
    Ok(verify_password(answer.trim(), hash))
}

/// Removes the answers of a user.
pub fn delete_security_answers(store: &Store, user_id: Uuid) -> CoreResult<()> {
    store.remove_setting(&key(user_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_only_hashes_and_verifies_answers() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        assert!(!security_answers(&store, user)
            .expect("empty")
            .is_configured());

        save_security_answers(
            &store,
            user,
            &["first pet".to_string(), "birth city".to_string()],
        )
        .expect("saved");
        let stored = security_answers(&store, user).expect("stored");
        assert!(stored.is_configured());
        assert_ne!(stored.answer_hashes[0], "first pet");
        assert!(stored.answer_hashes[0].starts_with("$argon2id$"));

        assert!(verify_security_answer(&store, user, 0, "first pet").expect("verify"));
        assert!(!verify_security_answer(&store, user, 0, "wrong").expect("verify"));
        assert!(!verify_security_answer(&store, user, 2, "first pet").expect("verify"));

        delete_security_answers(&store, user).expect("delete");
        assert!(!security_answers(&store, user)
            .expect("empty")
            .is_configured());
    }

    #[test]
    fn rejects_missing_or_too_short_answers() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        assert!(save_security_answers(&store, user, &["only one".to_string()]).is_err());
        assert!(
            save_security_answers(&store, user, &["ok answer".to_string(), " ".to_string()])
                .is_err()
        );
    }
}
