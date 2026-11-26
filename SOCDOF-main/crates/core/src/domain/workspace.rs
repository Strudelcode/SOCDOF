//! Desktop workspace data: dashboard widgets and generated reports.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Built-in widget kinds available on the desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WidgetKind {
    /// Analogue or digital clock.
    Clock,
    /// Calculator.
    Calculator,
    /// Sticky notes.
    Notes,
    /// Calendar preview.
    Calendar,
    /// Task list.
    Tasks,
    /// A widget defined by a later module.
    Custom,
}

impl WidgetKind {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            WidgetKind::Clock => "clock",
            WidgetKind::Calculator => "calculator",
            WidgetKind::Notes => "notes",
            WidgetKind::Calendar => "calendar",
            WidgetKind::Tasks => "tasks",
            WidgetKind::Custom => "custom",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "clock" => Some(WidgetKind::Clock),
            "calculator" => Some(WidgetKind::Calculator),
            "notes" => Some(WidgetKind::Notes),
            "calendar" => Some(WidgetKind::Calendar),
            "tasks" => Some(WidgetKind::Tasks),
            "custom" => Some(WidgetKind::Custom),
            _ => None,
        }
    }
}

/// A widget placed on the desktop.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Widget {
    /// Stable identifier.
    pub id: Uuid,
    /// Kind of the widget.
    pub kind: WidgetKind,
    /// Title shown in the widget header.
    pub title: String,
    /// Kind specific configuration (position, size, note text, ...).
    #[serde(default)]
    pub config: Value,
    /// Sort position on the desktop, lowest first.
    pub position: i64,
    /// Whether the widget is shown.
    pub enabled: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Widget {
    /// Validates the widget before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() {
            return Err("title_required".to_string());
        }
        if self.position < 0 {
            return Err("position_invalid".to_string());
        }
        Ok(())
    }
}

/// A report that was generated for the user.
///
/// The report itself is derived data; the row keeps the parameters so the same report can be
/// regenerated deterministically.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Report {
    /// Stable identifier.
    pub id: Uuid,
    /// Report kind, for example `revenue_by_month`.
    pub kind: String,
    /// Title shown in the report list.
    pub title: String,
    /// Parameters the report was generated with.
    #[serde(default)]
    pub parameters: Value,
    /// Generation time in milliseconds since the Unix epoch.
    pub generated_at: i64,
}

impl Report {
    /// Validates the report before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.kind.trim().is_empty() {
            return Err("report_kind_required".to_string());
        }
        if self.title.trim().is_empty() {
            return Err("title_required".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_widgets() {
        let mut widget = Widget {
            id: Uuid::new_v4(),
            kind: WidgetKind::Notes,
            title: "Notizen".to_string(),
            config: serde_json::json!({ "text": "" }),
            position: 1,
            enabled: true,
            created_at: 0,
            updated_at: 0,
        };
        assert_eq!(widget.validate(), Ok(()));

        widget.title = " ".to_string();
        assert_eq!(widget.validate(), Err("title_required".to_string()));

        widget.title = "Notizen".to_string();
        widget.position = -1;
        assert_eq!(widget.validate(), Err("position_invalid".to_string()));
    }

    #[test]
    fn validates_reports() {
        let mut report = Report {
            id: Uuid::new_v4(),
            kind: "revenue_by_month".to_string(),
            title: "Umsatz".to_string(),
            parameters: serde_json::json!({ "year": 2026 }),
            generated_at: 0,
        };
        assert_eq!(report.validate(), Ok(()));

        report.kind = " ".to_string();
        assert_eq!(report.validate(), Err("report_kind_required".to_string()));

        report.kind = "revenue_by_month".to_string();
        report.title = String::new();
        assert_eq!(report.validate(), Err("title_required".to_string()));
    }

    #[test]
    fn roundtrips_widget_kinds() {
        for kind in [
            WidgetKind::Clock,
            WidgetKind::Calculator,
            WidgetKind::Notes,
            WidgetKind::Calendar,
            WidgetKind::Tasks,
            WidgetKind::Custom,
        ] {
            assert_eq!(WidgetKind::from_storage(kind.as_str()), Some(kind));
        }
        assert_eq!(WidgetKind::from_storage("stock_ticker"), None);
    }
}
