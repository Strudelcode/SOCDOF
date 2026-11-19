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
    /// Whether the operating system marks this display as primary.
    pub primary: bool,
}

/// Detects connected displays using the current operating system's read-only display API.
///
/// On Linux, `xrandr` must be installed and available on PATH. Windows uses
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
            return Err("Windows display detection returned an error.".to_string());
        }
        return parse_windows_monitors(&String::from_utf8_lossy(&output.stdout));
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("system_profiler")
            .args(["SPDisplaysDataType", "-json"])
            .output()
            .map_err(|error| format!("system_profiler could not start: {error}"))?;
        if !output.status.success() {
            return Err("macOS display detection returned an error.".to_string());
        }
        return parse_system_profiler_monitors(&String::from_utf8_lossy(&output.stdout));
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("xrandr")
            .arg("--listmonitors")
            .output()
            .map_err(|error| format!("xrandr is unavailable; install xrandr to detect displays: {error}"))?;
        if !output.status.success() {
            return Err("xrandr could not read the active display layout.".to_string());
        }
        return parse_xrandr_monitors(&String::from_utf8_lossy(&output.stdout));
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

#[cfg(target_os = "windows")]
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
                primary: entry.get("primary")?.as_bool()?,
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

#[cfg(target_os = "macos")]
fn parse_system_profiler_monitors(output: &str) -> Result<Vec<DisplayMonitor>, String> {
    fn collect(value: &serde_json::Value, monitors: &mut Vec<DisplayMonitor>) {
        match value {
            serde_json::Value::Array(items) => {
                for item in items {
                    collect(item, monitors);
                }
            }
            serde_json::Value::Object(object) => {
                if let Some(resolution) = object.get("spdisplays_resolution").and_then(serde_json::Value::as_str) {
                    if let Some((width, height)) = parse_resolution(resolution) {
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
                            primary: monitors.is_empty(),
                        });
                    }
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
            primary: flags.contains('*'),
        });
    }
    if monitors.is_empty() {
        Err("xrandr did not report any active displays.".to_string())
    } else {
        Ok(monitors)
    }
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
        assert!(monitors[0].primary);
        assert_eq!((monitors[1].x, monitors[1].y), (2560, 120));
        assert!(!monitors[1].primary);
    }

    #[test]
    fn rejects_missing_or_invalid_monitor_geometry() {
        assert!(parse_xrandr_monitors("Monitors: 1\n").is_err());
        assert_eq!(parse_xrandr_geometry("1920x1080+0+0"), Some((1920, 1080, 0, 0)));
        assert_eq!(parse_xrandr_geometry("0x1080+0+0"), None);
    }

    #[test]
    fn parses_resolution_strings_without_refresh_rates() {
        assert_eq!(parse_resolution("3024 x 1964"), Some((3024, 1964)));
        assert_eq!(parse_resolution("2560 x 1440 @ 120Hz"), Some((2560, 1440)));
        assert_eq!(parse_resolution("unknown"), None);
    }
}
