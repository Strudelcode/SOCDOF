//! Document CRUD, validation and on-disk persistence for the text editor.

use socdof_core::domain::document::Document;
use socdof_core::error::CoreError;
use socdof_core::store::{Store, SCHEMA_VERSION};
use uuid::Uuid;

fn store() -> Store {
    Store::open_in_memory().expect("store")
}

fn document(name: &str, body: &str, now: i64) -> Document {
    Document::new(name, body, now)
}

#[test]
fn schema_includes_documents() {
    let store = store();
    assert_eq!(store.schema_version().expect("version"), SCHEMA_VERSION);
    assert_eq!(store.document_count().expect("count"), 0);
}

#[test]
fn roundtrips_updates_searches_and_deletes_documents() {
    let store = store();
    let mut first = document("  Notizen  ", "Erste Zeile\nZweite Zeile", 100);
    store.insert_document(&first).expect("insert");
    store
        .insert_document(&document("Protokoll", "Besprechung mit dem Team", 200))
        .expect("insert");
    assert_eq!(store.document_count().expect("count"), 2);

    let listed = store.list_documents().expect("list");
    assert_eq!(listed.len(), 2);
    assert_eq!(listed[0].name, "Protokoll");
    assert_eq!(listed[0].word_count(), 4);
    assert_eq!(listed[1].name, "Notizen", "name is trimmed on write");

    let found = store.get_document(first.id).expect("document");
    assert_eq!(found.body, "Erste Zeile\nZweite Zeile");

    first.name = "Notizen aktualisiert".to_string();
    first.body = "Geänderter Inhalt".to_string();
    first.updated_at = 300;
    store.update_document(&first).expect("update");
    let updated = store.get_document(first.id).expect("document");
    assert_eq!(updated.name, "Notizen aktualisiert");
    assert_eq!(updated.body, "Geänderter Inhalt");
    assert_eq!(store.list_documents().expect("list")[0].id, first.id);

    let hits = store.search_documents("geänderter").expect("search");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].id, first.id);
    assert!(store
        .search_documents("nicht vorhanden")
        .expect("search")
        .is_empty());

    store.delete_document(first.id).expect("delete");
    assert!(store.find_document(first.id).expect("find").is_none());
    assert_eq!(store.document_count().expect("count"), 1);
}

#[test]
fn rejects_invalid_documents_and_missing_rows() {
    let store = store();
    let empty_name = document(" ", "Inhalt", 1);
    assert!(matches!(
        store.insert_document(&empty_name),
        Err(CoreError::Validation(code)) if code == "document_name_required"
    ));
    let empty_body = document("Name", " \n ", 1);
    assert!(matches!(
        store.insert_document(&empty_body),
        Err(CoreError::Validation(code)) if code == "document_body_required"
    ));
    assert_eq!(store.document_count().expect("count"), 0);

    let missing = document("Name", "Inhalt", 1);
    assert!(matches!(
        store.update_document(&missing),
        Err(CoreError::NotFound(_))
    ));
    assert!(matches!(
        store.delete_document(Uuid::new_v4()),
        Err(CoreError::NotFound(_))
    ));
    assert!(matches!(
        store.get_document(Uuid::new_v4()),
        Err(CoreError::NotFound(_))
    ));
}

#[test]
fn documents_survive_reopening_the_database() {
    let directory = std::env::temp_dir().join(format!("socdof-documents-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).expect("directory");
    let path = directory.join("socdof.db");
    let document = document("Persistenz", "Bleibt nach dem Neustart erhalten", 10);
    {
        let store = Store::open(&path).expect("open");
        store.insert_document(&document).expect("insert");
    }
    {
        let store = Store::open(&path).expect("reopen");
        let loaded = store.get_document(document.id).expect("document");
        assert_eq!(loaded.name, "Persistenz");
        assert_eq!(loaded.body, "Bleibt nach dem Neustart erhalten");
    }
    let _ = std::fs::remove_dir_all(directory);
}
