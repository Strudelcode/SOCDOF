//! Window host for the component gallery.
//!
//! This is the first real window of the Rust UI: it opens an eframe window and renders the gallery
//! of `socdof_ui` every frame. Build it with
//!
//! ```text
//! cargo run -p socdof-ui --features window --bin socdof-ui-gallery
//! ```
//!
//! The default build stays window free, so `cargo test` and clippy need no desktop libraries.

use eframe::egui;
use socdof_core::domain::settings::Language;
use socdof_ui::gallery::{gallery, GalleryState};
use socdof_ui::shell::Onboarding;
use socdof_ui::theme::Appearance;

struct GalleryApp {
    state: GalleryState,
}

impl GalleryApp {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let appearance = if cc.egui_ctx.style().visuals.dark_mode {
            Appearance::Dark
        } else {
            Appearance::Light
        };
        let mut state = GalleryState::new(Language::De, appearance, "indigo")
            .expect("embedded UI catalogue is valid");
        state
            .invoices
            .templates
            .set_asset_picker(socdof_ui::invoice_templates::native_asset_picker());
        if let Some(storage) = cc.storage {
            let seen = storage.get_string("onboarding_seen").as_deref() == Some("true");
            state.shell.onboarding = Onboarding::restore(seen);
        }
        Self { state }
    }
}

impl eframe::App for GalleryApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        gallery(ctx, &mut self.state);
    }

    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        storage.set_string(
            "onboarding_seen",
            self.state.shell.onboarding.seen().to_string(),
        );
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1080.0, 860.0])
            .with_min_inner_size([720.0, 480.0]),
        ..Default::default()
    };
    eframe::run_native(
        "SOCDOF",
        options,
        Box::new(|cc| Box::new(GalleryApp::new(cc))),
    )
}
