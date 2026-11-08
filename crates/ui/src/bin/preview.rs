//! Renders the current egui screens to PNG files and writes a static gallery.
//!
//! This is the browser preview path: it runs the real screen functions from this crate, tessellates
//! the resulting egui frame and rasterises the meshes and font atlas into RGBA images. Run it from
//! the repository root:
//!
//! ```text
//! cargo run -p socdof-ui --bin socdof-ui-preview
//! ```
//!
//! The generated directory (`target/ui-preview`) is served by the local preview host. No screen is
//! redrawn by a separate mock renderer: the images come from the same functions the desktop window
//! calls.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use egui::epaint::Primitive;
use egui::{Context, ImageData, Pos2, RawInput, Rect, TextureId, Vec2};
use socdof_core::domain::settings::Language;
use socdof_ui::gallery::{gallery, GalleryState};
use socdof_ui::settings::SettingsTab;
use socdof_ui::shell::Onboarding;
use socdof_ui::theme::Appearance;
use socdof_ui::wallpaper::{Wallpaper, WallpaperFit};

const LANGUAGES: [Language; 4] = [Language::De, Language::En, Language::Fr, Language::Es];
const APPEARANCES: [Appearance; 2] = [Appearance::Light, Appearance::Dark];

#[derive(Clone, Copy)]
enum Scene {
    Gallery,
    Desktop,
    StartMenu,
    Palette,
    Tray,
    Onboarding,
    Wallpaper,
    Studio,
    StudioData,
    StudioLayout,
    Focused,
    Drawer,
    Dashboard,
    Contacts,
    Products,
    Invoices,
    Accounting,
    Purchases,
    Pos,
    Calendar,
    Users,
    UserDetail,
    Editor,
    EditorPreview,
    EditorSpell,
    AppStore,
    Support,
    Reports,
    Therapie,
    AuthLogin,
    AuthLocked,
    AuthSetup,
    AuthUnlocked,
    Settings(SettingsTab),
}

impl Scene {
    fn id(self) -> String {
        match self {
            Scene::Gallery => "gallery".to_string(),
            Scene::Desktop => "desktop".to_string(),
            Scene::StartMenu => "start-menu".to_string(),
            Scene::Palette => "palette".to_string(),
            Scene::Tray => "tray".to_string(),
            Scene::Onboarding => "onboarding".to_string(),
            Scene::Wallpaper => "wallpaper".to_string(),
            Scene::Studio => "studio".to_string(),
            Scene::StudioData => "studio-data".to_string(),
            Scene::StudioLayout => "studio-layout".to_string(),
            Scene::Focused => "focused".to_string(),
            Scene::Drawer => "drawer".to_string(),
            Scene::Dashboard => "dashboard".to_string(),
            Scene::Contacts => "contacts".to_string(),
            Scene::Products => "products".to_string(),
            Scene::Invoices => "invoices".to_string(),
            Scene::Accounting => "accounting".to_string(),
            Scene::Purchases => "purchases".to_string(),
            Scene::Pos => "pos".to_string(),
            Scene::Calendar => "calendar".to_string(),
            Scene::Users => "users".to_string(),
            Scene::UserDetail => "users-detail".to_string(),
            Scene::Editor => "editor".to_string(),
            Scene::EditorPreview => "editor-preview".to_string(),
            Scene::EditorSpell => "editor-spell".to_string(),
            Scene::AppStore => "app-store".to_string(),
            Scene::Support => "support".to_string(),
            Scene::Reports => "reports".to_string(),
            Scene::Therapie => "therapy".to_string(),
            Scene::AuthLogin => "auth-login".to_string(),
            Scene::AuthLocked => "auth-locked".to_string(),
            Scene::AuthSetup => "auth-setup".to_string(),
            Scene::AuthUnlocked => "auth-unlocked".to_string(),
            Scene::Settings(tab) => format!("settings-{}", settings_id(tab)),
        }
    }

    fn title(self) -> String {
        match self {
            Scene::Gallery => "Component gallery".to_string(),
            Scene::Desktop => "Desktop shell".to_string(),
            Scene::StartMenu => "Start menu".to_string(),
            Scene::Palette => "Command palette".to_string(),
            Scene::Tray => "Tray flyout".to_string(),
            Scene::Onboarding => "Onboarding".to_string(),
            Scene::Wallpaper => "Wallpaper".to_string(),
            Scene::Studio => "Studio · Letterhead".to_string(),
            Scene::StudioData => "Studio · Business data".to_string(),
            Scene::StudioLayout => "Studio · Document layout".to_string(),
            Scene::Focused => "Keyboard focus".to_string(),
            Scene::Drawer => "Details drawer".to_string(),
            Scene::Dashboard => "Dashboard".to_string(),
            Scene::Contacts => "Contacts".to_string(),
            Scene::Products => "Products & stock".to_string(),
            Scene::Invoices => "Invoices".to_string(),
            Scene::Accounting => "Accounting".to_string(),
            Scene::Purchases => "Purchases".to_string(),
            Scene::Pos => "POS / cash register".to_string(),
            Scene::Calendar => "Calendar".to_string(),
            Scene::Users => "User management".to_string(),
            Scene::UserDetail => "User management · Account".to_string(),
            Scene::Editor => "Text editor · Documents".to_string(),
            Scene::EditorPreview => "Text editor · Preview".to_string(),
            Scene::EditorSpell => "Text editor · Spell check".to_string(),
            Scene::AppStore => "App Store · Modules".to_string(),
            Scene::Support => "Support · Tickets".to_string(),
            Scene::Reports => "Reports · Period totals".to_string(),
            Scene::Therapie => "Therapy · Client detail".to_string(),
            Scene::AuthLogin => "Login".to_string(),
            Scene::AuthLocked => "Lock screen".to_string(),
            Scene::AuthSetup => "First-run setup".to_string(),
            Scene::AuthUnlocked => "Signed in".to_string(),
            Scene::Settings(tab) => format!("Settings · {}", settings_title(tab)),
        }
    }

    fn size(self) -> (f32, f32) {
        match self {
            Scene::Desktop
            | Scene::StartMenu
            | Scene::Palette
            | Scene::Tray
            | Scene::Onboarding
            | Scene::Wallpaper
            | Scene::Studio
            | Scene::StudioData => (1280.0, 820.0),
            Scene::StudioLayout => (1280.0, 1620.0),
            Scene::Gallery => (1180.0, 2320.0),
            Scene::Editor | Scene::EditorPreview | Scene::EditorSpell => (1180.0, 1620.0),
            Scene::AppStore => (1180.0, 2800.0),
            Scene::Settings(_) => (1180.0, 2050.0),
            Scene::Users => (1180.0, 1500.0),
            Scene::UserDetail => (1180.0, 1900.0),
            Scene::AuthLogin | Scene::AuthLocked | Scene::AuthSetup | Scene::AuthUnlocked => {
                (900.0, 820.0)
            }
            _ => (1180.0, 1500.0),
        }
    }

    fn prepare(self, state: &mut GalleryState) {
        state.desktop_open = false;
        state.dashboard_open = false;
        state.contacts_open = false;
        state.products_open = false;
        state.invoices_open = false;
        state.accounting_open = false;
        state.purchases_open = false;
        state.pos_open = false;
        state.appointments_open = false;
        state.settings_open = false;
        state.users_open = false;
        state.users.view = socdof_ui::users::UsersView::List;
        state.users.error = None;
        state.users.status = None;
        state.editor_open = false;
        state.editor.back = false;
        state.editor.error = None;
        state.editor.status = None;
        state.app_store_open = false;
        state.app_store.back = false;
        state.app_store.error = None;
        state.app_store.status = None;
        state.app_store.changed = false;
        state.support_open = false;
        state.support.back = false;
        state.support.error = None;
        state.support.status = None;
        state.support.view = socdof_ui::support::SupportView::List;
        state.reports_open = false;
        state.reports.back = false;
        state.reports.error = None;
        state.therapie_open = false;
        state.therapie.back = false;
        state.therapie.error = None;
        state.therapie.status = None;
        state.therapie.view = socdof_ui::therapie::TherapieView::List;
        state.auth_open = false;
        state.auth.back = false;
        state.auth.allow_exit = false;
        state.drawer_open = false;
        state.modal_open = false;
        state.shell.close_overlays();
        state.shell.onboarding = Onboarding::restore(true);
        state.shell.wallpaper.wallpaper = Wallpaper::Plain;
        state.shell.wallpaper.fit = WallpaperFit::Cover;

        match self {
            Scene::Gallery => {}
            Scene::Desktop => state.desktop_open = true,
            Scene::StartMenu => {
                state.desktop_open = true;
                state.shell.open_start();
            }
            Scene::Palette => {
                state.desktop_open = true;
                state.shell.open_palette();
            }
            Scene::Tray => {
                state.desktop_open = true;
                state.shell.toggle_tray();
            }
            Scene::Onboarding => {
                state.desktop_open = true;
                state.shell.onboarding.restart();
            }
            Scene::Wallpaper => {
                state.desktop_open = true;
                state.shell.wallpaper.wallpaper = Wallpaper::Dusk;
                state.shell.wallpaper.fit = WallpaperFit::Tile;
            }
            Scene::Studio => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
            }
            Scene::StudioData => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
                state
                    .shell
                    .studio
                    .set_tab(socdof_ui::studio::StudioTab::Data);
            }
            Scene::StudioLayout => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
                state
                    .shell
                    .studio
                    .set_tab(socdof_ui::studio::StudioTab::Layout);
                *state.shell.studio.layout_mut() = socdof_ui::studio::gallery_layout();
            }
            Scene::Focused => {}
            Scene::Drawer => state.drawer_open = true,
            Scene::Dashboard => state.dashboard_open = true,
            Scene::Contacts => state.contacts_open = true,
            Scene::Products => state.products_open = true,
            Scene::Invoices => state.invoices_open = true,
            Scene::Accounting => state.accounting_open = true,
            Scene::Purchases => state.purchases_open = true,
            Scene::Pos => state.pos_open = true,
            Scene::Calendar => {
                state.appointments_open = true;
                state.appointments.screen = socdof_ui::appointments::AppointmentsDetail::Calendar;
                state.appointments.view = socdof_ui::appointments::AppointmentsView::Month;
            }
            Scene::Users => state.users_open = true,
            Scene::Editor | Scene::EditorPreview | Scene::EditorSpell => {
                let _ = state.editor.reset_for_open(&state.store);
                state.editor.spell_ignored =
                    vec!["Landingpage".to_string(), "Feedback".to_string()];
                state.editor.preview = matches!(self, Scene::EditorPreview);
                state.editor_open = true;
            }
            Scene::AppStore => {
                let _ = socdof_core::app_store::set_active(&state.store, "contacts", false);
                let _ = state.app_store.reset_for_open(&state.store);
                state.app_store_open = true;
            }
            Scene::Support => {
                let _ = state.support.reset_for_open(&state.store);
                if let Some(id) = state.support.tickets.first().map(|ticket| ticket.id) {
                    state.support.select(id);
                    let _ = state.support.refresh(&state.store);
                }
                state.support_open = true;
            }
            Scene::Reports => {
                let _ = state
                    .reports
                    .reset_for_open(&state.store, socdof_core::now_millis());
                state.reports_open = true;
            }
            Scene::Therapie => {
                let _ = state.therapie.reset_for_open(&state.store);
                if let Some(id) = state.therapie.clients.first().map(|client| client.id) {
                    let _ = state.therapie.select(&state.store, id);
                }
                state.therapie_open = true;
            }
            Scene::AuthLogin => {
                state.auth.show_login();
                state.auth_open = true;
            }
            Scene::AuthLocked => {
                state.auth.lock(socdof_core::now_millis());
                state.auth_open = true;
            }
            Scene::AuthSetup => {
                state.auth.show_setup();
                state.auth_open = true;
            }
            Scene::AuthUnlocked => {
                state.auth.show_unlocked();
                state.auth_open = true;
            }
            Scene::UserDetail => {
                state.users_open = true;
                if let Some(id) = state
                    .users
                    .users
                    .iter()
                    .find(|user| !user.is_admin() && user.active)
                    .map(|user| user.id)
                {
                    state.users.select(id);
                }
            }
            Scene::Settings(tab) => {
                state.settings_open = true;
                state.settings.set_tab(tab);
            }
        }
    }
}

fn settings_id(tab: SettingsTab) -> &'static str {
    match tab {
        SettingsTab::General => "general",
        SettingsTab::Appearance => "appearance",
        SettingsTab::Security => "security",
        SettingsTab::Backup => "backup",
        SettingsTab::Users => "users",
        SettingsTab::Roles => "roles",
        SettingsTab::Updates => "updates",
        SettingsTab::Portable => "portable",
    }
}

fn settings_title(tab: SettingsTab) -> &'static str {
    match tab {
        SettingsTab::General => "General",
        SettingsTab::Appearance => "Appearance",
        SettingsTab::Security => "Security",
        SettingsTab::Backup => "Backup",
        SettingsTab::Users => "Users",
        SettingsTab::Roles => "Roles",
        SettingsTab::Updates => "Updates",
        SettingsTab::Portable => "Portable",
    }
}

fn scenes() -> Vec<Scene> {
    let mut scenes = vec![
        Scene::Gallery,
        Scene::Desktop,
        Scene::StartMenu,
        Scene::Palette,
        Scene::Tray,
        Scene::Onboarding,
        Scene::Wallpaper,
        Scene::Studio,
        Scene::StudioData,
        Scene::StudioLayout,
        Scene::Focused,
        Scene::Drawer,
        Scene::Dashboard,
        Scene::Contacts,
        Scene::Products,
        Scene::Invoices,
        Scene::Accounting,
        Scene::Purchases,
        Scene::Pos,
        Scene::Calendar,
        Scene::Users,
        Scene::UserDetail,
        Scene::Editor,
        Scene::EditorPreview,
        Scene::EditorSpell,
        Scene::AppStore,
        Scene::Support,
        Scene::Reports,
        Scene::Therapie,
        Scene::AuthLogin,
        Scene::AuthLocked,
        Scene::AuthSetup,
        Scene::AuthUnlocked,
    ];
    scenes.extend(SettingsTab::ALL.into_iter().map(Scene::Settings));
    scenes
}

#[derive(Clone)]
struct Texture {
    size: [usize; 2],
    pixels: Vec<[u8; 4]>,
}

impl Texture {
    fn from_image(image: &ImageData) -> Self {
        match image {
            ImageData::Color(image) => Self {
                size: image.size,
                pixels: image.pixels.iter().map(|pixel| pixel.to_array()).collect(),
            },
            ImageData::Font(image) => Self {
                size: image.size,
                pixels: image
                    .srgba_pixels(None)
                    .map(|pixel| pixel.to_array())
                    .collect(),
            },
        }
    }

    fn patch(&mut self, pos: [usize; 2], image: &ImageData) {
        let patch = Self::from_image(image);
        for y in 0..patch.size[1] {
            for x in 0..patch.size[0] {
                let target_x = pos[0] + x;
                let target_y = pos[1] + y;
                if target_x < self.size[0] && target_y < self.size[1] {
                    self.pixels[target_y * self.size[0] + target_x] =
                        patch.pixels[y * patch.size[0] + x];
                }
            }
        }
    }

    fn sample(&self, u: f32, v: f32) -> [u8; 4] {
        if self.size[0] == 0 || self.size[1] == 0 {
            return [255, 255, 255, 255];
        }
        let x = (u * self.size[0] as f32 - 0.5).clamp(0.0, self.size[0] as f32 - 1.0);
        let y = (v * self.size[1] as f32 - 0.5).clamp(0.0, self.size[1] as f32 - 1.0);
        let x0 = x.floor() as usize;
        let y0 = y.floor() as usize;
        let x1 = (x0 + 1).min(self.size[0] - 1);
        let y1 = (y0 + 1).min(self.size[1] - 1);
        let fx = x - x0 as f32;
        let fy = y - y0 as f32;
        let p00 = self.pixels[y0 * self.size[0] + x0];
        let p10 = self.pixels[y0 * self.size[0] + x1];
        let p01 = self.pixels[y1 * self.size[0] + x0];
        let p11 = self.pixels[y1 * self.size[0] + x1];
        let mut out = [0u8; 4];
        for channel in 0..4 {
            let top = p00[channel] as f32 * (1.0 - fx) + p10[channel] as f32 * fx;
            let bottom = p01[channel] as f32 * (1.0 - fx) + p11[channel] as f32 * fx;
            out[channel] = (top * (1.0 - fy) + bottom * fy).round().clamp(0.0, 255.0) as u8;
        }
        out
    }
}

fn apply_textures(textures: &mut HashMap<TextureId, Texture>, delta: &egui::TexturesDelta) {
    for (id, image) in &delta.set {
        if let Some(pos) = image.pos {
            if let Some(texture) = textures.get_mut(id) {
                texture.patch(pos, &image.image);
            }
        } else {
            textures.insert(*id, Texture::from_image(&image.image));
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out = PathBuf::from("target/ui-preview");
    let images = out.join("images");
    fs::create_dir_all(&images)?;

    // Optional scene filter, for example `socdof-ui-preview settings-general`, so a single screen
    // can be rendered and inspected without rasterising the whole catalogue.
    let filter = std::env::args().nth(1);
    let binary_time = std::env::current_exe()?.metadata()?.modified()?;
    let mut manifest = Vec::new();
    let all_scenes = scenes();
    for language in LANGUAGES {
        for appearance in APPEARANCES {
            let mut state = GalleryState::new(language, appearance, "indigo")?;
            for scene in &all_scenes {
                if let Some(filter) = &filter {
                    if !scene.id().contains(filter.as_str()) {
                        continue;
                    }
                }
                let file = format!(
                    "{}-{}-{}.png",
                    appearance_name(appearance),
                    language.as_str(),
                    scene.id()
                );
                let path = images.join(&file);
                let fresh = path
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .map(|modified| modified >= binary_time)
                    .unwrap_or(false);
                if !fresh {
                    let pixels = render_scene(&mut state, *scene, language, appearance);
                    write_png(&path, pixels.0, pixels.1, &pixels.2)?;
                    println!(
                        "rendered {} {} {}",
                        language.as_str(),
                        appearance_name(appearance),
                        scene.id()
                    );
                }
                manifest.push((*scene, language, appearance, file));
            }
        }
    }

    write_index(&out, &manifest)?;
    println!("preview written to {}", out.display());
    Ok(())
}

fn appearance_name(appearance: Appearance) -> &'static str {
    match appearance {
        Appearance::Light => "light",
        Appearance::Dark => "dark",
    }
}

fn render_scene(
    state: &mut GalleryState,
    scene: Scene,
    language: Language,
    appearance: Appearance,
) -> (usize, usize, Vec<u8>) {
    scene.prepare(state);
    state.appearance = appearance;
    state.accent_id = "indigo".to_string();
    state.language = language;
    let ctx = Context::default();
    // `SOCDOF_PREVIEW_SIZE=432x771` renders a scene in the window size of a reference screenshot,
    // so the GUI parity artefacts in `docs/artifacts/gui-parity/` are directly comparable.
    let override_size = std::env::var("SOCDOF_PREVIEW_SIZE").ok().and_then(|raw| {
        let (width, height) = raw.split_once('x')?;
        Some((
            width.trim().parse::<f32>().ok()?,
            height.trim().parse::<f32>().ok()?,
        ))
    });
    let (width, height) = override_size.unwrap_or_else(|| scene.size());
    let width = width as usize;
    let height = height as usize;
    let mut textures = HashMap::new();
    let mut last = None;

    for frame_index in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(width as f32, height as f32),
            )),
            time: Some(1.0),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, state));
        apply_textures(&mut textures, &output.textures_delta);
        if scene_is_focused(scene) && frame_index == 0 {
            state.focus.focus_first();
        }
        last = Some(output);
    }

    let output = last.expect("two frames were rendered");
    let pixels_per_point = output.pixels_per_point;
    let primitives = ctx.tessellate(output.shapes, pixels_per_point);
    let mut pixels = vec![0u8; width * height * 4];
    let background = state.theme().palette.background;
    for pixel in pixels.chunks_exact_mut(4) {
        pixel.copy_from_slice(&[background.r(), background.g(), background.b(), 255]);
    }

    for primitive in primitives {
        let clip = primitive.clip_rect;
        let clip_min_x = (clip.min.x * pixels_per_point).floor().max(0.0) as i32;
        let clip_min_y = (clip.min.y * pixels_per_point).floor().max(0.0) as i32;
        let clip_max_x = (clip.max.x * pixels_per_point).ceil().min(width as f32) as i32;
        let clip_max_y = (clip.max.y * pixels_per_point).ceil().min(height as f32) as i32;
        if clip_max_x <= clip_min_x || clip_max_y <= clip_min_y {
            continue;
        }
        let Primitive::Mesh(mesh) = primitive.primitive else {
            continue;
        };
        let texture = textures.get(&mesh.texture_id);
        for triangle in mesh.indices.chunks_exact(3) {
            let a = mesh.vertices[triangle[0] as usize];
            let b = mesh.vertices[triangle[1] as usize];
            let c = mesh.vertices[triangle[2] as usize];
            raster_triangle(
                &mut pixels,
                width,
                height,
                (clip_min_x, clip_min_y, clip_max_x, clip_max_y),
                [a, b, c],
                texture,
                pixels_per_point,
            );
        }
    }

    (width, height, pixels)
}

fn scene_is_focused(scene: Scene) -> bool {
    matches!(scene, Scene::Focused)
}

#[allow(clippy::too_many_arguments)]
fn raster_triangle(
    pixels: &mut [u8],
    width: usize,
    height: usize,
    clip: (i32, i32, i32, i32),
    vertices: [egui::epaint::Vertex; 3],
    texture: Option<&Texture>,
    pixels_per_point: f32,
) {
    let points = vertices.map(|vertex| {
        (
            vertex.pos.x * pixels_per_point,
            vertex.pos.y * pixels_per_point,
            vertex.uv,
            vertex.color.to_array(),
        )
    });
    let (ax, ay, _, _) = points[0];
    let (bx, by, _, _) = points[1];
    let (cx, cy, _, _) = points[2];
    let area = edge(ax, ay, bx, by, cx, cy);
    if area.abs() < 0.0001 {
        return;
    }
    let min_x = ax.min(bx).min(cx).floor().max(clip.0 as f32) as i32;
    let max_x = ax.max(bx).max(cx).ceil().min(clip.2 as f32) as i32;
    let min_y = ay.min(by).min(cy).floor().max(clip.1 as f32) as i32;
    let max_y = ay.max(by).max(cy).ceil().min(clip.3 as f32) as i32;
    if max_x <= min_x || max_y <= min_y {
        return;
    }

    for y in min_y..max_y {
        for x in min_x..max_x {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let w0 = edge(bx, by, cx, cy, px, py) / area;
            let w1 = edge(cx, cy, ax, ay, px, py) / area;
            let w2 = edge(ax, ay, bx, by, px, py) / area;
            if w0 < -0.0001 || w1 < -0.0001 || w2 < -0.0001 {
                continue;
            }
            let u = points[0].2.x * w0 + points[1].2.x * w1 + points[2].2.x * w2;
            let v = points[0].2.y * w0 + points[1].2.y * w1 + points[2].2.y * w2;
            let mut color = [0u8; 4];
            for (channel, value) in color.iter_mut().enumerate() {
                *value = (points[0].3[channel] as f32 * w0
                    + points[1].3[channel] as f32 * w1
                    + points[2].3[channel] as f32 * w2)
                    .round()
                    .clamp(0.0, 255.0) as u8;
            }
            let sample = texture
                .map(|texture| texture.sample(u, v))
                .unwrap_or([255; 4]);
            let src = [
                ((color[0] as u16 * sample[0] as u16) / 255) as u8,
                ((color[1] as u16 * sample[1] as u16) / 255) as u8,
                ((color[2] as u16 * sample[2] as u16) / 255) as u8,
                ((color[3] as u16 * sample[3] as u16) / 255) as u8,
            ];
            if src[3] == 0 {
                continue;
            }
            let index = (y as usize * width + x as usize) * 4;
            let inverse = 255 - src[3] as u16;
            pixels[index] = (src[0] as u16 + pixels[index] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 1] =
                (src[1] as u16 + pixels[index + 1] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 2] =
                (src[2] as u16 + pixels[index + 2] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 3] = 255;
        }
    }
    let _ = height;
}

fn edge(ax: f32, ay: f32, bx: f32, by: f32, px: f32, py: f32) -> f32 {
    (px - ax) * (by - ay) - (py - ay) * (bx - ax)
}

fn write_png(
    path: &Path,
    width: usize,
    height: usize,
    pixels: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let file = fs::File::create(path)?;
    let mut encoder = png::Encoder::new(file, width as u32, height as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header()?;
    writer.write_image_data(pixels)?;
    Ok(())
}

fn write_index(
    out: &Path,
    manifest: &[(Scene, Language, Appearance, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut scene_list = String::new();
    let mut seen = Vec::new();
    for (scene, _, _, _) in manifest {
        let id = scene.id();
        if !seen.contains(&id) {
            seen.push(id.clone());
            let _ = write!(
                scene_list,
                "<button class=\"scene\" data-scene=\"{}\">{}</button>",
                id,
                html_escape(&scene.title())
            );
        }
    }

    let mut shots = Vec::new();
    for (scene, language, appearance, file) in manifest {
        shots.push(format!(
            "{{scene:\"{}\",lang:\"{}\",theme:\"{}\",file:\"{}\"}}",
            scene.id(),
            language.as_str(),
            appearance_name(*appearance),
            file
        ));
    }

    let html = format!(
        r##"<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%237c9cff%22/><text x=%2216%22 y=%2222%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216%22 font-weight=%22bold%22 fill=%22%230b1020%22>S</text></svg>">
<title>SOCDOF Rust UI preview</title>
<style>
:root {{ color-scheme: dark; --bg:#0e1116; --panel:#171c24; --line:#2a3340; --text:#e8edf4; --muted:#93a0b3; --accent:#7c9cff; --accent-2:#b18cff; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:radial-gradient(1200px 700px at 80% -10%, #1d2b4d 0%, transparent 60%), var(--bg); color:var(--text); font:14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; }}
header {{ position:sticky; top:0; z-index:5; display:flex; gap:18px; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid var(--line); background:rgba(14,17,22,.88); backdrop-filter:blur(16px); }}
.brand {{ display:flex; flex-direction:column; gap:2px; }}
.brand strong {{ letter-spacing:.08em; font-size:15px; }}
.brand span {{ color:var(--muted); font-size:12px; }}
.controls {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
select, button {{ border:1px solid var(--line); border-radius:9px; background:var(--panel); color:var(--text); padding:8px 10px; font:inherit; }}
button {{ cursor:pointer; }}
button:hover, select:hover {{ border-color:var(--accent); }}
button.primary {{ background:linear-gradient(135deg,var(--accent),var(--accent-2)); color:#0b1020; border:0; font-weight:700; }}
main {{ display:grid; grid-template-columns:250px minmax(0,1fr); min-height:calc(100vh - 74px); }}
aside {{ border-right:1px solid var(--line); padding:16px; overflow:auto; max-height:calc(100vh - 74px); position:sticky; top:74px; }}
aside h2 {{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--muted); margin:0 0 10px; }}
.scene {{ display:block; width:100%; text-align:left; margin:2px 0; border-color:transparent; background:transparent; color:var(--muted); }}
.scene:hover {{ color:var(--text); background:var(--panel); }}
.scene.active {{ color:var(--text); border-color:var(--line); background:linear-gradient(90deg, rgba(124,156,255,.18), transparent); }}
.stage {{ padding:20px; }}
.meta {{ display:flex; gap:10px; align-items:center; justify-content:space-between; margin:0 0 12px; color:var(--muted); }}
.pill {{ border:1px solid var(--line); border-radius:999px; padding:4px 9px; font-size:12px; }}
.frame {{ border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#000; box-shadow:0 22px 70px rgba(0,0,0,.45); }}
img {{ display:block; width:100%; height:auto; }}
.nav {{ display:flex; gap:8px; }}
@media (max-width:800px) {{ main {{ grid-template-columns:1fr; }} aside {{ position:static; max-height:none; border-right:0; border-bottom:1px solid var(--line); display:flex; gap:6px; overflow-x:auto; }} aside h2 {{ display:none; }} .scene {{ width:auto; white-space:nowrap; }} }}
</style>
</head>
<body>
<header>
  <div class="brand"><strong>SOCDOF · Rust UI</strong><span>generated from the current egui build · v{version} · {count} images</span></div>
  <div class="controls">
    <select id="lang" aria-label="Language"><option value="de">Deutsch</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select>
    <select id="theme" aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option></select>
    <div class="nav"><button id="prev" title="Previous scene">←</button><button id="next" title="Next scene">→</button></div>
  </div>
</header>
<main>
  <aside><h2>Screens</h2>{scene_list}</aside>
  <section class="stage">
    <div class="meta"><div id="title"></div><div class="pill" id="filename"></div></div>
    <div class="frame"><img id="shot" alt="SOCDOF screen"></div>
  </section>
</main>
<script>
const shots = [{shots}];
const scenes = [...new Set(shots.map(s => s.scene))];
let state = {{ lang: "de", theme: "light", scene: "settings-general" }};
const saved = location.hash.slice(1).split("-");
if (saved.length >= 3) {{ state.lang = saved[0]; state.theme = saved[1]; state.scene = saved.slice(2).join("-"); }}
if (!scenes.includes(state.scene)) state.scene = scenes[0];
if (!["de","en","fr","es"].includes(state.lang)) state.lang = "de";
if (!["light","dark"].includes(state.theme)) state.theme = "light";
function current() {{ return shots.find(s => s.scene === state.scene && s.lang === state.lang && s.theme === state.theme); }}
function render() {{
  const shot = current();
  if (!shot) return;
  document.getElementById("shot").src = "images/" + shot.file;
  document.getElementById("shot").alt = shot.scene + " in " + shot.lang + " " + shot.theme;
  document.getElementById("filename").textContent = shot.file;
  document.getElementById("title").textContent = state.scene.replaceAll("-", " ") + " · " + state.lang.toUpperCase() + " · " + state.theme;
  document.querySelectorAll(".scene").forEach(button => button.classList.toggle("active", button.dataset.scene === state.scene));
  document.getElementById("lang").value = state.lang;
  document.getElementById("theme").value = state.theme;
  history.replaceState(null, "", "#" + state.lang + "-" + state.theme + "-" + state.scene);
}}
document.querySelectorAll(".scene").forEach(button => button.addEventListener("click", () => {{ state.scene = button.dataset.scene; render(); }}));
document.getElementById("lang").addEventListener("change", event => {{ state.lang = event.target.value; render(); }});
document.getElementById("theme").addEventListener("change", event => {{ state.theme = event.target.value; render(); }});
document.getElementById("prev").addEventListener("click", () => {{ const i = scenes.indexOf(state.scene); state.scene = scenes[(i - 1 + scenes.length) % scenes.length]; render(); }});
document.getElementById("next").addEventListener("click", () => {{ const i = scenes.indexOf(state.scene); state.scene = scenes[(i + 1) % scenes.length]; render(); }});
render();
</script>
</body>
</html>
"##,
        version = env!("CARGO_PKG_VERSION"),
        count = manifest.len(),
        scene_list = scene_list,
        shots = shots.join(","),
    );
    fs::write(out.join("index.html"), html)?;
    Ok(())
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
