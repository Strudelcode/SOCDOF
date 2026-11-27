//! Desktop wallpapers: the plain accent gradient and the bundled images.
//!
//! The default desktop of the legacy app carries no image at all: it is the accent color washed into
//! a blurred accent glow. [`Wallpaper::Plain`] paints exactly that, so the Rust desktop starts on the
//! same slate surface instead of a photo.
//!
//! The two photographic wallpapers stay available. They ship inside the binary through
//! `include_bytes!` and are decoded once per context into an egui texture. The texture is drawn
//! either covering the screen (center cropped) or tiled at its native size, with linear filtering and
//! without any recompression, so the pixels the asset contains are the pixels shown.
//!
//! ![Aurora](../assets/wallpaper-aurora.png)

use egui::{
    Color32, ColorImage, Context, Id, Mesh, Pos2, Rect, Shape, TextureHandle, TextureOptions, Ui,
    Vec2,
};

const AURORA_PNG: &[u8] = include_bytes!("../assets/wallpaper-aurora.png");
const DUSK_PNG: &[u8] = include_bytes!("../assets/wallpaper-dusk.png");

/// Selectable desktop wallpapers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Wallpaper {
    /// The legacy default: a slate gradient lit by two blurred accent glows, no image.
    #[default]
    Plain,
    /// Night sky with green aurora bands and stars.
    Aurora,
    /// Warm dusk gradient with a low sun and a mountain ridge.
    Dusk,
}

impl Wallpaper {
    /// Every wallpaper in switch order.
    pub const ALL: [Wallpaper; 3] = [Self::Plain, Self::Aurora, Self::Dusk];

    /// The bundled photographic wallpapers, in switch order.
    pub const IMAGES: [Wallpaper; 2] = [Self::Aurora, Self::Dusk];

    /// Stable identifier used for texture names, snapshots and settings.
    pub fn id(self) -> &'static str {
        match self {
            Wallpaper::Plain => "plain",
            Wallpaper::Aurora => "aurora",
            Wallpaper::Dusk => "dusk",
        }
    }

    /// Catalogue key of the wallpaper name.
    pub fn label_key(self) -> &'static str {
        match self {
            Wallpaper::Plain => "wallpaper_plain",
            Wallpaper::Aurora => "wallpaper_aurora",
            Wallpaper::Dusk => "wallpaper_dusk",
        }
    }

    /// The next wallpaper in [`Wallpaper::ALL`].
    pub fn next(self) -> Self {
        match self {
            Wallpaper::Plain => Wallpaper::Aurora,
            Wallpaper::Aurora => Wallpaper::Dusk,
            Wallpaper::Dusk => Wallpaper::Plain,
        }
    }

    /// Whether the wallpaper is a bundled image instead of the plain gradient.
    pub fn is_image(self) -> bool {
        !matches!(self, Wallpaper::Plain)
    }

    /// Embedded PNG bytes, or `None` for the plain gradient.
    pub fn bytes(self) -> Option<&'static [u8]> {
        match self {
            Wallpaper::Plain => None,
            Wallpaper::Aurora => Some(AURORA_PNG),
            Wallpaper::Dusk => Some(DUSK_PNG),
        }
    }
}

/// How a wallpaper fills the desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WallpaperFit {
    /// Scale until the image covers the screen and crop the overflow.
    #[default]
    Cover,
    /// Repeat the image at its native size.
    Tile,
}

/// A user image, decoded from a PNG that was dropped onto the setup wizard.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomWallpaper {
    /// Image width in pixels.
    pub width: usize,
    /// Image height in pixels.
    pub height: usize,
    /// RGBA pixels, four bytes per pixel.
    pub pixels: std::sync::Arc<Vec<u8>>,
    /// Revision used as the texture cache key; the host bumps it when the image arrives.
    pub revision: u64,
}

/// Selected wallpaper and fit.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WallpaperState {
    /// Selected image.
    pub wallpaper: Wallpaper,
    /// How the image fills the screen.
    pub fit: WallpaperFit,
    /// User image that replaces the bundled ones while it is set.
    pub custom: Option<CustomWallpaper>,
}

impl WallpaperState {
    /// Selects the next bundled wallpaper.
    pub fn next(&mut self) {
        self.wallpaper = self.wallpaper.next();
    }

    /// Switches between cover and tile.
    pub fn toggle_fit(&mut self) {
        self.fit = match self.fit {
            WallpaperFit::Cover => WallpaperFit::Tile,
            WallpaperFit::Tile => WallpaperFit::Cover,
        };
    }

    /// Serializes this wallpaper selection for persistent settings storage.
    pub fn to_preference(&self) -> socdof_core::settings_service::WallpaperPreference {
        let fit = match self.fit {
            WallpaperFit::Cover => "cover",
            WallpaperFit::Tile => "tile",
        }
        .to_string();
        if let Some(custom) = self.custom.as_ref() {
            if let Ok(data_url) = socdof_core::settings_service::encode_png_data_url(
                custom.width as u32,
                custom.height as u32,
                custom.pixels.as_slice(),
            ) {
                return socdof_core::settings_service::WallpaperPreference {
                    kind: "custom".to_string(),
                    fit,
                    custom_image: Some(data_url),
                };
            }
        }
        socdof_core::settings_service::WallpaperPreference {
            kind: self.wallpaper.id().to_string(),
            fit,
            custom_image: None,
        }
    }

    /// Restores wallpaper and custom image from a persisted preference.
    pub fn apply_preference(
        &mut self,
        preference: &socdof_core::settings_service::WallpaperPreference,
        revision: u64,
    ) {
        self.fit = if preference.fit == "tile" {
            WallpaperFit::Tile
        } else {
            WallpaperFit::Cover
        };
        self.wallpaper = match preference.kind.as_str() {
            "aurora" => Wallpaper::Aurora,
            "dusk" => Wallpaper::Dusk,
            _ => Wallpaper::Plain,
        };
        self.custom = if preference.kind == "custom" {
            preference
                .custom_image
                .as_deref()
                .and_then(socdof_core::settings_service::decode_data_url_rgba)
                .map(|(width, height, pixels)| CustomWallpaper {
                    width,
                    height,
                    pixels: std::sync::Arc::new(pixels),
                    revision: revision.max(1),
                })
        } else {
            None
        };
    }
}

/// Decoded size and RGBA pixels of a bundled wallpaper.
pub fn pixels(wallpaper: Wallpaper) -> (usize, usize, Vec<u8>) {
    let bytes = wallpaper
        .bytes()
        .expect("the plain wallpaper is painted, not decoded");
    let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    let mut reader = decoder.read_info().expect("bundled wallpaper header");
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buffer)
        .expect("bundled wallpaper pixels");
    assert_eq!(
        info.color_type,
        png::ColorType::Rgba,
        "bundled wallpapers are RGBA"
    );
    assert_eq!(
        info.bit_depth,
        png::BitDepth::Eight,
        "bundled wallpapers are 8 bit"
    );
    buffer.truncate(info.buffer_size());
    (info.width as usize, info.height as usize, buffer)
}

/// Rectangle that covers `area` with an image of `image` size, centered and cropped.
pub fn cover_rect(area: Rect, image: Vec2) -> Rect {
    let scale = (area.width() / image.x).max(area.height() / image.y);
    let size = image * scale;
    Rect::from_center_size(area.center(), size)
}

/// Rectangles that tile `area` with an image of `image` size, anchored top left.
pub fn tile_rects(area: Rect, image: Vec2) -> Vec<Rect> {
    let columns = (area.width() / image.x).ceil().max(1.0) as u32;
    let rows = (area.height() / image.y).ceil().max(1.0) as u32;
    let mut rects = Vec::with_capacity((columns * rows) as usize);
    for row in 0..rows {
        for column in 0..columns {
            rects.push(Rect::from_min_size(
                Pos2::new(
                    area.min.x + column as f32 * image.x,
                    area.min.y + row as f32 * image.y,
                ),
                image,
            ));
        }
    }
    rects
}

/// Mixes two colors, `t` being the weight of `b`.
pub fn blend(a: Color32, b: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    let channel = |x: u8, y: u8| (f32::from(x) * (1.0 - t) + f32::from(y) * t).round() as u8;
    Color32::from_rgb(
        channel(a.r(), b.r()),
        channel(a.g(), b.g()),
        channel(a.b(), b.b()),
    )
}

/// Paints the legacy plain desktop: the reference gradient with the accent as ambient light.
///
/// The reference desktop is `bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100` (dark:
/// `from-slate-950 via-slate-900 to-slate-950`) with two accent circles blurred into it
/// (`DesktopWindowWorkspace.tsx:2558–2578`): a 650 point disc anchored at a third of the width and a
/// quarter of the height at 25 % opacity, and a 550 point disc at three quarters of the width and a
/// third of the height at 20 % opacity. Both use a 64 point blur, so each disc keeps a large solid
/// core and only fades along its rim, which is what makes the reference surface read as ambient
/// light rather than as blobs.
pub fn paint_plain(ui: &Ui, rect: Rect, accent: Color32, dark: bool) {
    let ctx = ui.ctx();
    let size = [
        rect.width().round().max(1.0) as usize,
        rect.height().round().max(1.0) as usize,
    ];
    let id = Id::new(("socdof-plain-wallpaper", size, accent.to_array(), dark));
    let texture = if let Some(handle) = ctx.data(|data| data.get_temp::<TextureHandle>(id)) {
        handle
    } else {
        let handle = ctx.load_texture(
            "plain-wallpaper",
            plain_image(size[0], size[1], accent, dark),
            TextureOptions::LINEAR,
        );
        ctx.data_mut(|data| data.insert_temp(id, handle.clone()));
        handle
    };
    let target = Rect::from_min_size(rect.min, Vec2::new(size[0] as f32, size[1] as f32));
    ui.painter().with_clip_rect(rect).image(
        texture.id(),
        target,
        Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
        Color32::WHITE,
    );
}

/// Renders the plain desktop pixel by pixel.
///
/// The legacy surface is the slate diagonal gradient with two accent discs blurred into it
/// (`DesktopWindowWorkspace.tsx:2558–2578`). Compositing them into a texture keeps the rim exactly
/// as soft as the CSS blur and avoids the seams a triangle fan shows on a surface this large.
fn plain_image(width: usize, height: usize, accent: Color32, dark: bool) -> ColorImage {
    let (near, mid) = if dark {
        (Color32::from_rgb(2, 6, 23), Color32::from_rgb(15, 23, 42))
    } else {
        (
            Color32::from_rgb(241, 245, 249),
            Color32::from_rgb(248, 250, 252),
        )
    };
    let (width_f, height_f) = (
        (width.saturating_sub(1)).max(1) as f32,
        (height.saturating_sub(1)).max(1) as f32,
    );
    // `w-[650px] h-[650px] left-1/3 top-1/4`, `w-[550px] h-[550px] right-1/4 bottom-1/3`; the blur
    // leaves the middle of each disc at its full opacity.
    let discs = [
        (
            width as f32 / 3.0 + 325.0,
            height as f32 / 4.0 + 325.0,
            325.0_f32,
            0.25_f32,
            accent,
        ),
        // The reference wallpaper keeps a teal glow in the right half (the second `bg-teal-500/20`
        // disc), which is what makes the desktop read as blue-green instead of plain violet.
        (
            width as f32 * 0.75 - 275.0,
            height as f32 * 2.0 / 3.0 - 275.0,
            275.0_f32,
            0.22_f32,
            Color32::from_rgb(0x0d, 0x94, 0x88),
        ),
    ];
    let mut rgb = Vec::with_capacity(width * height * 3);
    for y in 0..height {
        for x in 0..width {
            let along = (x as f32 / width_f + y as f32 / height_f) * 0.5;
            let mut color = two_stop(near, mid, along);
            for (cx, cy, radius, opacity, tint) in discs {
                let distance = ((x as f32 - cx).powi(2) + (y as f32 - cy).powi(2)).sqrt();
                let alpha = opacity * disc_falloff(distance, radius);
                if alpha > 0.0 {
                    color = blend(color, tint, alpha);
                }
            }
            rgb.extend_from_slice(&[color.r(), color.g(), color.b()]);
        }
    }
    ColorImage::from_rgb([width, height], &rgb)
}

/// Coverage of a solid disc of `radius` blurred with the legacy `blur-3xl` radius.
///
/// A 64 point gaussian turns the hard edge into a smooth ramp across two blur radii on either side;
/// a smoothstep across that band matches the curve closely at a fraction of the cost.
fn disc_falloff(distance: f32, radius: f32) -> f32 {
    const BLUR: f32 = 64.0;
    let inner = (radius - 2.0 * BLUR).max(0.0);
    let outer = radius + 2.0 * BLUR;
    let t = ((distance - inner) / (outer - inner).max(1.0)).clamp(0.0, 1.0);
    1.0 - t * t * (3.0 - 2.0 * t)
}

/// Color at `t` along `from-… to-…` with the middle stop at the halfway point (`via-…`).
fn two_stop(start: Color32, middle: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    if t < 0.5 {
        blend(start, middle, t * 2.0)
    } else {
        blend(middle, start, (t - 0.5) * 2.0)
    }
}

/// Builds a rectangle whose four corners carry the given colors.
pub(crate) fn gradient_mesh(
    rect: Rect,
    left_top: Color32,
    right_top: Color32,
    right_bottom: Color32,
    left_bottom: Color32,
) -> Shape {
    let mut mesh = Mesh::default();
    for (pos, color) in [
        (rect.left_top(), left_top),
        (rect.right_top(), right_top),
        (rect.right_bottom(), right_bottom),
        (rect.left_bottom(), left_bottom),
    ] {
        mesh.vertices.push(egui::epaint::Vertex {
            pos,
            uv: egui::epaint::WHITE_UV,
            color,
        });
    }
    mesh.indices.extend_from_slice(&[0, 1, 2, 0, 2, 3]);
    Shape::mesh(mesh)
}

/// Paints the selected wallpaper into `rect`, clipped to the desktop area.
pub fn paint(
    ctx: &Context,
    ui: &Ui,
    rect: Rect,
    state: &WallpaperState,
    accent: Color32,
    dark: bool,
) {
    if let Some(custom) = &state.custom {
        paint_custom(ctx, ui, rect, custom);
        return;
    }
    if !state.wallpaper.is_image() {
        paint_plain(ui, rect, accent, dark);
        return;
    }
    let texture = texture(ctx, state.wallpaper);
    let image = texture.size_vec2();
    let painter = ui.painter().with_clip_rect(rect);
    let uv = Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0));
    match state.fit {
        WallpaperFit::Cover => {
            let target = cover_rect(rect, image);
            painter.image(texture.id(), target, uv, egui::Color32::WHITE);
        }
        WallpaperFit::Tile => {
            for tile in tile_rects(rect, image) {
                painter.image(texture.id(), tile, uv, egui::Color32::WHITE);
            }
        }
    }
}

/// Decodes a user supplied PNG into RGBA pixels.
///
/// Only eight bit RGB and RGBA PNGs are accepted; anything else reports an error code that the
/// wizard turns into a translated hint.
pub fn decode_png(bytes: &[u8]) -> Result<(usize, usize, Vec<u8>), &'static str> {
    let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    let mut reader = decoder.read_info().map_err(|_| "png_header")?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer).map_err(|_| "png_frame")?;
    buffer.truncate(info.buffer_size());
    let width = info.width as usize;
    let height = info.height as usize;
    let rgba = match (info.color_type, info.bit_depth) {
        (png::ColorType::Rgba, png::BitDepth::Eight) => buffer,
        (png::ColorType::Rgb, png::BitDepth::Eight) => buffer
            .chunks_exact(3)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2], 255])
            .collect(),
        _ => return Err("png_unsupported"),
    };
    Ok((width, height, rgba))
}

/// Paints a user image, scaling it to cover the desktop like the bundled wallpapers.
fn paint_custom(ctx: &Context, ui: &Ui, rect: Rect, custom: &CustomWallpaper) {
    let texture = custom_texture(ctx, custom);
    let image = texture.size_vec2();
    let target = cover_rect(rect, image);
    let uv = Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0));
    ui.painter()
        .with_clip_rect(rect)
        .image(texture.id(), target, uv, Color32::WHITE);
}

/// Uploads a user image as a texture once per revision and caches it afterwards.
fn custom_texture(ctx: &Context, custom: &CustomWallpaper) -> TextureHandle {
    let id = Id::new(("socdof-wallpaper-custom", custom.revision));
    if let Some(handle) = ctx.data(|data| data.get_temp::<TextureHandle>(id)) {
        return handle;
    }
    let image = ColorImage::from_rgba_unmultiplied([custom.width, custom.height], &custom.pixels);
    let handle = ctx.load_texture("custom-wallpaper", image, TextureOptions::LINEAR);
    ctx.data_mut(|data| data.insert_temp(id, handle.clone()));
    handle
}

/// Loads a wallpaper as a texture once per context and caches it for the following frames.
fn texture(ctx: &Context, wallpaper: Wallpaper) -> TextureHandle {
    let id = Id::new(("socdof-wallpaper", wallpaper.id()));
    if let Some(handle) = ctx.data(|data| data.get_temp::<TextureHandle>(id)) {
        return handle;
    }
    let (width, height, rgba) = pixels(wallpaper);
    let image = ColorImage::from_rgba_unmultiplied([width, height], &rgba);
    let handle = ctx.load_texture(
        format!("wallpaper-{}", wallpaper.id()),
        image,
        TextureOptions::LINEAR,
    );
    ctx.data_mut(|data| data.insert_temp(id, handle.clone()));
    handle
}

/// Draws a solid fallback when no texture can be shown (used by the unit tests).
pub fn fallback_mesh(texture_id: egui::TextureId, rect: Rect) -> Shape {
    let mut mesh = Mesh::with_texture(texture_id);
    mesh.add_rect_with_uv(
        rect,
        Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
        egui::Color32::WHITE,
    );
    Shape::mesh(mesh)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_bundled_images_decode_to_rgba_pixels() {
        for wallpaper in Wallpaper::IMAGES {
            let (width, height, rgba) = pixels(wallpaper);
            assert_eq!((width, height), (640, 400));
            assert_eq!(rgba.len(), width * height * 4);
            let distinct = rgba
                .chunks_exact(4)
                .step_by(4_097)
                .map(|pixel| [pixel[0], pixel[1], pixel[2]])
                .collect::<std::collections::BTreeSet<_>>();
            assert!(distinct.len() > 8, "{} is a flat image", wallpaper.id());
        }
    }

    #[test]
    fn user_pngs_decode_into_rgba() {
        let bytes = Wallpaper::Aurora.bytes().expect("bundled panorama");
        let (width, height, rgba) = decode_png(bytes).expect("png decodes");
        assert_eq!((width, height), (640, 400));
        assert_eq!(rgba.len(), width * height * 4);
        assert!(decode_png(b"not a png").is_err());
    }

    #[test]
    fn switching_wallpapers_cycles_through_all_three() {
        let mut state = WallpaperState::default();
        assert_eq!(state.wallpaper, Wallpaper::Plain, "legacy default");
        assert!(state.wallpaper.bytes().is_none());
        state.next();
        assert_eq!(state.wallpaper, Wallpaper::Aurora);
        state.next();
        assert_eq!(state.wallpaper, Wallpaper::Dusk);
        state.next();
        assert_eq!(state.wallpaper, Wallpaper::Plain);
        assert_eq!(Wallpaper::ALL.len(), 3);
        assert!(!Wallpaper::Plain.is_image());
        assert!(Wallpaper::Aurora.is_image());
        assert_ne!(Wallpaper::Aurora.id(), Wallpaper::Dusk.id());
    }

    #[test]
    fn plain_wallpaper_washes_the_accent_into_white() {
        let accent = Color32::from_rgb(0x4f, 0x46, 0xe5);
        let top = blend(accent, Color32::WHITE, 0.80);
        let bottom = blend(accent, Color32::WHITE, 0.96);
        assert!(bottom.r() > top.r() && bottom.g() > top.g() && bottom.b() > top.b());
        assert_eq!(blend(accent, Color32::WHITE, 0.0), accent);
        assert_eq!(blend(accent, Color32::WHITE, 1.0), Color32::WHITE);
    }

    #[test]
    fn cover_scales_until_the_image_fills_the_area() {
        let area = Rect::from_min_size(Pos2::ZERO, Vec2::new(1600.0, 900.0));
        let image = Vec2::new(640.0, 400.0);
        let covered = cover_rect(area, image);
        assert!(covered.width() >= area.width());
        assert!(covered.height() >= area.height());
        assert_eq!(covered.center(), area.center());
        assert_eq!(
            covered.aspect_ratio(),
            image.x / image.y,
            "aspect ratio must not distort"
        );
    }

    #[test]
    fn tiles_cover_the_area_at_native_size() {
        let area = Rect::from_min_size(Pos2::ZERO, Vec2::new(1600.0, 900.0));
        let image = Vec2::new(640.0, 400.0);
        let tiles = tile_rects(area, image);
        assert_eq!(tiles.len(), 9);
        assert!(tiles
            .iter()
            .all(|tile| (tile.width(), tile.height()) == (640.0, 400.0)));
        let covered_bottom_right = tiles
            .iter()
            .any(|tile| tile.max.x >= area.max.x && tile.max.y >= area.max.y);
        assert!(covered_bottom_right);
    }

    #[test]
    fn fit_toggles_between_cover_and_tile() {
        let mut state = WallpaperState::default();
        assert_eq!(state.fit, WallpaperFit::Cover);
        state.toggle_fit();
        assert_eq!(state.fit, WallpaperFit::Tile);
        state.toggle_fit();
        assert_eq!(state.fit, WallpaperFit::Cover);
    }

    #[test]
    fn preference_round_trips_presets_and_custom_images() {
        let mut state = WallpaperState {
            wallpaper: Wallpaper::Aurora,
            fit: WallpaperFit::Tile,
            custom: None,
        };
        let pref = state.to_preference();
        assert_eq!(pref.kind, "aurora");
        assert_eq!(pref.fit, "tile");
        assert!(pref.custom_image.is_none());

        let mut restored = WallpaperState::default();
        restored.apply_preference(&pref, 7);
        assert_eq!(restored.wallpaper, Wallpaper::Aurora);
        assert_eq!(restored.fit, WallpaperFit::Tile);
        assert!(restored.custom.is_none());

        let (width, height, rgba) = pixels(Wallpaper::Dusk);
        state.custom = Some(CustomWallpaper {
            width,
            height,
            pixels: std::sync::Arc::new(rgba),
            revision: 42,
        });
        let custom_pref = state.to_preference();
        assert_eq!(custom_pref.kind, "custom");
        assert!(custom_pref.custom_image.is_some());

        restored.apply_preference(&custom_pref, 99);
        let custom = restored.custom.expect("decoded custom wallpaper");
        assert_eq!((custom.width, custom.height), (width, height));
        assert_eq!(custom.revision, 99);
    }
}
