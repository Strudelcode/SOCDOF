//! Native monitor discovery shared by the desktop settings screen.
//!
//! Detection is read-only: SOCDOF reports the displays exposed by the operating system and never
//! changes hardware topology, resolution, orientation, or OS scaling from this screen.

/// A physical display currently reported by the operating system.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisplayMonitor {
    /// Stable identifier supplied by the operating system.
    pub id: String,
    /// Human-readable display name.
    pub label: String,
    /// Horizontal desktop coordinate in physical pixels.
    pub x: i32,
    /// Vertical desktop coordinate in physical pixels.
    pub y: i32,
    /// Current width in physical pixels.
    pub width: u32,
    /// Current height in physical pixels.
    pub height: u32,
    /// Primary-display marker reported by the operating system; `None` means unknown.
    pub primary: Option<bool>,
}

/// Detects connected displays using the current operating system's read-only display API.
///
/// On Linux, `xrandr` (X11) or `wlr-randr` (Wayland) must be installed and available on PATH. Windows uses
/// `System.Windows.Forms.Screen`; macOS uses `system_profiler`. Unsupported or unavailable
/// detection tools return an error instead of fabricating a 1920×1080 display.
pub fn detect_connected_monitors() -> Result<Vec<DisplayMonitor>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{ id=$_.DeviceName; label=$_.DeviceName; x=$_.Bounds.X; y=$_.Bounds.Y; width=$_.Bounds.Width; height=$_.Bounds.Height; primary=$_.Primary } } | ConvertTo-Json -Compress"#;
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|error| format!("PowerShell display detection could not start: {error}"))?;
        if !output.status.success() {
            Err("Windows display detection returned an error.".to_string())
        } else {
            parse_windows_monitors(&String::from_utf8_lossy(&output.stdout))
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("system_profiler")
            .args(["SPDisplaysDataType", "-json"])
            .output()
            .map_err(|error| format!("system_profiler could not start: {error}"))?;
        if !output.status.success() {
            Err("macOS display detection returned an error.".to_string())
        } else {
            parse_system_profiler_monitors(&String::from_utf8_lossy(&output.stdout))
        }
    }

    #[cfg(target_os = "linux")]
    {
        let wayland_session = std::env::var_os("WAYLAND_DISPLAY").is_some();
        if !wayland_session
            && let Ok(output) = std::process::Command::new("xrandr")
                .arg("--listmonitors")
                .output()
            && output.status.success()
            && let Ok(monitors) = parse_xrandr_monitors(&String::from_utf8_lossy(&output.stdout))
        {
            return Ok(monitors);
        }
        if let Ok(output) = std::process::Command::new("wlr-randr").output()
            && output.status.success()
            && let Ok(monitors) = parse_wlr_randr_monitors(&String::from_utf8_lossy(&output.stdout))
        {
            return Ok(monitors);
        }
        if wayland_session
            && let Ok(output) = std::process::Command::new("xrandr")
                .arg("--listmonitors")
                .output()
            && output.status.success()
            && let Ok(monitors) = parse_xrandr_monitors(&String::from_utf8_lossy(&output.stdout))
        {
            return Ok(monitors);
        }
        Err("No supported Linux display utility found a readable active monitor layout. Install xrandr (X11) or wlr-randr (Wayland).".to_string())
    }

    #[cfg(target_arch = "wasm32")]
    {
        Err("Physical display discovery is available in the native desktop app only.".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux", target_arch = "wasm32")))]
    {
        Err("Display discovery is not supported on this operating system.".to_string())
    }
}

#[cfg(any(target_os = "windows", test))]
fn parse_windows_monitors(output: &str) -> Result<Vec<DisplayMonitor>, String> {
    let value: serde_json::Value = serde_json::from_str(output.trim())
        .map_err(|error| format!("Windows display response was invalid: {error}"))?;
    let entries = value.as_array().cloned().unwrap_or_else(|| vec![value]);
    let monitors = entries
        .iter()
        .filter_map(|entry| {
            Some(DisplayMonitor {
                id: entry.get("id")?.as_str()?.to_string(),
                label: entry.get("label")?.as_str()?.to_string(),
                x: entry.get("x")?.as_i64()? as i32,
                y: entry.get("y")?.as_i64()? as i32,
                width: entry.get("width")?.as_u64()? as u32,
                height: entry.get("height")?.as_u64()? as u32,
                primary: Some(entry.get("primary")?.as_bool()?),
            })
        })
        .filter(|monitor| monitor.width > 0 && monitor.height > 0)
        .collect::<Vec<_>>();
    if monitors.is_empty() {
        Err("Windows did not report any active displays.".to_string())
    } else {
        Ok(monitors)
    }
}

#[cfg(any(target_os = "macos", test))]
fn parse_system_profiler_monitors(output: &str) -> Result<Vec<DisplayMonitor>, String> {
    fn collect(value: &serde_json::Value, monitors: &mut Vec<DisplayMonitor>) {
        match value {
            serde_json::Value::Array(items) => {
                for item in items {
                    collect(item, monitors);
                }
            }
            serde_json::Value::Object(object) => {
                if let Some(resolution) = object.get("spdisplays_resolution").and_then(serde_json::Value::as_str)
                    && let Some((width, height)) = parse_resolution(resolution)
                {
                    let label = ["sppci_model", "spdisplays_display", "spdisplays_name"]
                        .iter()
                        .find_map(|key| object.get(*key).and_then(serde_json::Value::as_str))
                        .unwrap_or("Display")
                        .to_string();
                    monitors.push(DisplayMonitor {
                        id: label.clone(),
                        label,
                        x: 0,
                        y: 0,
                        width,
                        height,
                        primary: None,
                    });
                }
                for child in object.values() {
                    collect(child, monitors);
                }
            }
            _ => {}
        }
    }

    let value: serde_json::Value = serde_json::from_str(output)
        .map_err(|error| format!("system_profiler response was invalid: {error}"))?;
    let mut monitors = Vec::new();
    collect(&value, &mut monitors);
    monitors.dedup_by(|left, right| left.id == right.id && left.width == right.width && left.height == right.height);
    if monitors.is_empty() {
        Err("macOS did not report any active display resolutions.".to_string())
    } else {
        Ok(monitors)
    }
}

#[cfg(any(target_os = "macos", test))]
fn parse_resolution(value: &str) -> Option<(u32, u32)> {
    let value = value.split('@').next().unwrap_or(value);
    let (width, height) = value.split_once('x')?;
    let width = width.split_whitespace().last()?.parse().ok()?;
    let height = height.split_whitespace().next()?.parse().ok()?;
    (width > 0 && height > 0).then_some((width, height))
}

#[cfg(any(target_os = "linux", test))]
fn parse_xrandr_monitors(output: &str) -> Result<Vec<DisplayMonitor>, String> {
    let mut monitors = Vec::new();
    for line in output.lines().skip(1) {
        let Some((index, details)) = line.trim().split_once(':') else {
            continue;
        };
        let fields = details.split_whitespace().collect::<Vec<_>>();
        let Some(flags) = fields.first() else {
            continue;
        };
        let Some(geometry) = fields.get(1) else {
            continue;
        };
        let Some((width, height, x, y)) = parse_xrandr_geometry(geometry) else {
            continue;
        };
        let label = flags.trim_start_matches(|character| character == '+' || character == '*').to_string();
        if label.is_empty() {
            continue;
        }
        monitors.push(DisplayMonitor {
            id: format!("{}:{label}", index.trim()),
            label,
            x,
            y,
            width,
            height,
            primary: Some(flags.contains('*')),
        });
    }
    if monitors.is_empty() {
        Err("xrandr did not report any active displays.".to_string())
    } else {
        Ok(monitors)
    }
}

#[cfg(any(target_os = "linux", test))]
fn parse_wlr_randr_monitors(output: &str) -> Result<Vec<DisplayMonitor>, String> {
    let mut monitors = Vec::new();
    let mut current: Option<DisplayMonitor> = None;
    let mut enabled = true;

    let finish = |monitor: Option<DisplayMonitor>, enabled: bool, monitors: &mut Vec<DisplayMonitor>| {
        if enabled && let Some(monitor) = monitor.filter(|item| item.width > 0 && item.height > 0) {
            monitors.push(monitor);
        }
    };

    for line in output.lines() {
        if line.chars().next().is_some_and(|character| !character.is_whitespace()) {
            finish(current.take(), enabled, &mut monitors);
            let id = line.split_whitespace().next().unwrap_or("Display").to_string();
            let label = line
                .split('"')
                .nth(1)
                .filter(|value| !value.is_empty())
                .unwrap_or(&id)
                .to_string();
            current = Some(DisplayMonitor {
                id,
                label,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                primary: None,
            });
            enabled = true;
            continue;
        }

        let Some(monitor) = current.as_mut() else {
            continue;
        };
        let detail = line.trim();
        if let Some(value) = detail.strip_prefix("Enabled:") {
            enabled = value.trim().eq_ignore_ascii_case("yes");
        } else if let Some(value) = detail.strip_prefix("Position:") {
            let mut coordinates = value.trim().split(',');
            if let (Some(x), Some(y)) = (coordinates.next(), coordinates.next())
                && let (Ok(x), Ok(y)) = (x.trim().parse(), y.trim().parse())
            {
                monitor.x = x;
                monitor.y = y;
            }
        } else if (detail.contains("current)") || (monitor.width == 0 && detail.contains(" px,")))
            && let Some(dimensions) = detail.split_whitespace().next()
            && let Some((width, height)) = parse_mode_dimensions(dimensions)
        {
            monitor.width = width;
            monitor.height = height;
        }
    }
    finish(current, enabled, &mut monitors);
    if monitors.is_empty() {
        Err("wlr-randr did not report any enabled displays with an active mode.".to_string())
    } else {
        Ok(monitors)
    }
}

#[cfg(any(target_os = "linux", test))]
fn parse_mode_dimensions(value: &str) -> Option<(u32, u32)> {
    let (width, height) = value.split_once('x')?;
    let width = width.parse().ok()?;
    let height = height.parse().ok()?;
    (width > 0 && height > 0).then_some((width, height))
}

#[cfg(any(target_os = "linux", test))]
fn parse_xrandr_geometry(value: &str) -> Option<(u32, u32, i32, i32)> {
    let (dimensions, position) = value.split_once('+')?;
    let (width, height) = dimensions.split_once('x')?;
    let width = width.split('/').next()?.parse().ok()?;
    let height = height.split('/').next()?.parse().ok()?;
    let mut coordinates = position.split('+');
    let x = coordinates.next()?.parse().ok()?;
    let y = coordinates.next()?.parse().ok()?;
    (width > 0 && height > 0).then_some((width, height, x, y))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_xrandr_monitor_geometry_and_primary_marker() {
        let output = "Monitors: 2\n 0: +*DP-1 2560/597x1440/336+0+0 DP-1\n 1: +HDMI-1 1920/509x1080/286+2560+120 HDMI-1\n";
        let monitors = parse_xrandr_monitors(output).expect("monitors");
        assert_eq!(monitors.len(), 2);
        assert_eq!(monitors[0].label, "DP-1");
        assert_eq!((monitors[0].width, monitors[0].height), (2560, 1440));
        assert_eq!(monitors[0].primary, Some(true));
        assert_eq!((monitors[1].x, monitors[1].y), (2560, 120));
        assert_eq!(monitors[1].primary, Some(false));
    }

    #[test]
    fn parses_wayland_wlr_randr_enabled_display_blocks() {
        let output = "eDP-1 \"Built-in Display\"\n  Enabled: yes\n  Modes:\n    1920x1080 px, 60.000000 Hz (preferred, current)\n  Position: 0,0\n  Scale: 1.000000\nHDMI-A-1 \"External Monitor\"\n  Enabled: no\n  Modes:\n    2560x1440 px, 60.000000 Hz (current)\n  Position: 1920,0\n";
        let monitors = parse_wlr_randr_monitors(output).expect("Wayland monitors");
        assert_eq!(monitors.len(), 1);
        assert_eq!(monitors[0].id, "eDP-1");
        assert_eq!(monitors[0].label, "Built-in Display");
        assert_eq!((monitors[0].width, monitors[0].height), (1920, 1080));
        assert_eq!(monitors[0].primary, None);
    }

    #[test]
    fn rejects_missing_or_invalid_monitor_geometry() {
        assert!(parse_xrandr_monitors("Monitors: 1\n").is_err());
        assert_eq!(parse_xrandr_geometry("1920x1080+0+0"), Some((1920, 1080, 0, 0)));
        assert_eq!(parse_xrandr_geometry("0x1080+0+0"), None);
    }

    #[test]
    fn parses_windows_screen_json_for_single_and_multiple_displays() {
        let single = r#"{"id":"\\\\.\\DISPLAY1","label":"\\\\.\\DISPLAY1","x":0,"y":0,"width":1920,"height":1080,"primary":true}"#;
        let monitor = parse_windows_monitors(single).expect("single monitor");
        assert_eq!(monitor.len(), 1);
        assert_eq!(monitor[0].primary, Some(true));
        assert_eq!((monitor[0].width, monitor[0].height), (1920, 1080));

        let multiple = r#"[{"id":"DISPLAY1","label":"DISPLAY1","x":0,"y":0,"width":1920,"height":1080,"primary":true},{"id":"DISPLAY2","label":"DISPLAY2","x":1920,"y":0,"width":2560,"height":1440,"primary":false}]"#;
        let monitors = parse_windows_monitors(multiple).expect("multiple monitors");
        assert_eq!(monitors.len(), 2);
        assert_eq!(monitors[1].x, 1920);
    }

    #[test]
    fn parses_macos_system_profiler_display_records() {
        let json = r#"{"SPDisplaysDataType":[{"spdisplays_ndrvs":[{"_name":"Built-in Display","spdisplays_resolution":"3024 x 1964","spdisplays_display":"Built-in Retina Display"}]}]}"#;
        let monitors = parse_system_profiler_monitors(json).expect("macOS monitor");
        assert_eq!(monitors.len(), 1);
        assert_eq!(monitors[0].label, "Built-in Retina Display");
        assert_eq!((monitors[0].width, monitors[0].height), (3024, 1964));
        assert_eq!(monitors[0].primary, None);
    }

    #[test]
    fn parses_resolution_strings_without_refresh_rates() {
        assert_eq!(parse_resolution("3024 x 1964"), Some((3024, 1964)));
        assert_eq!(parse_resolution("2560 x 1440 @ 120Hz"), Some((2560, 1440)));
        assert_eq!(parse_resolution("unknown"), None);
    }
}
