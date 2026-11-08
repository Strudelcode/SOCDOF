//! Bundled wallpaper images and their lossless rendering.
//!
//! The desktop does not fake a wallpaper with a color tint: two real PNG images ship inside the
//! binary through `include_bytes!` and are decoded once per context into an egui texture. The
//! texture is drawn either covering the screen (center cropped) or tiled at its native size, with
//! linear filtering and without any recompression, so the pixels the asset contains are the pixels
//! shown.
//!
//! ![Aurora](../assets/wallpaper-aurora.png)

use egui::{
    ColorImage, Context, Id, Mesh, Pos2, Rect, Shape, TextureHandle, TextureOptions, Ui, Vec2,
};

const AURORA_PNG: &[u8] = include_bytes!("../assets/wallpaper-aurora.png");
const DUSK_PNG: &[u8] = include_bytes!("../assets/wallpaper-dusk.png");

/// Bundled desktop wallpapers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Wallpaper {
    /// Night sky with green aurora bands and stars.
    #[default]
    Aurora,
    /// Warm dusk gradient with a low sun and a mountain ridge.
    Dusk,
}

impl Wallpaper {
    /// Every bundled wallpaper in switch order.
    pub const ALL: [Wallpaper; 2] = [Self::Aurora, Self::Dusk];

    /// Stable identifier used for texture names, snapshots and settings.
    pub fn id(self) -> &'static str {
        match self {
            Wallpaper::Aurora => "aurora",
            Wallpaper::Dusk => "dusk",
        }
    }

    /// Catalogue key of the wallpaper name.
    pub fn label_key(self) -> &'static str {
        match self {
            Wallpaper::Aurora => "wallpaper_aurora",
            Wallpaper::Dusk => "wallpaper_dusk",
        }
    }

    /// The next wallpaper in [`Wallpaper::ALL`].
    pub fn next(self) -> Self {
        match self {
            Wallpaper::Aurora => Wallpaper::Dusk,
            Wallpaper::Dusk => Wallpaper::Aurora,
        }
    }

    /// Embedded PNG bytes.
    pub fn bytes(self) -> &'static [u8] {
        match self {
            Wallpaper::Aurora => AURORA_PNG,
            Wallpaper::Dusk => DUSK_PNG,
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

/// Selected wallpaper and fit.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WallpaperState {
    /// Selected image.
    pub wallpaper: Wallpaper,
    /// How the image fills the screen.
    pub fit: WallpaperFit,
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
}

/// Decoded size and RGBA pixels of a bundled wallpaper.
pub fn pixels(wallpaper: Wallpaper) -> (usize, usize, Vec<u8>) {
    let decoder = png::Decoder::new(std::io::Cursor::new(wallpaper.bytes()));
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

/// Paints the selected wallpaper into `rect`, clipped to the desktop area.
pub fn paint(ctx: &Context, ui: &Ui, rect: Rect, state: &WallpaperState) {
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
        for wallpaper in Wallpaper::ALL {
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
    fn switching_wallpapers_alternates_between_the_assets() {
        let mut state = WallpaperState::default();
        assert_eq!(state.wallpaper, Wallpaper::Aurora);
        state.next();
        assert_eq!(state.wallpaper, Wallpaper::Dusk);
        state.next();
        assert_eq!(state.wallpaper, Wallpaper::Aurora);
        assert_eq!(Wallpaper::ALL.len(), 2);
        assert_ne!(Wallpaper::Aurora.id(), Wallpaper::Dusk.id());
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
}
