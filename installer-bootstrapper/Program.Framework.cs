using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SOCDOF.Bootstrapper
{
    internal static class FrameworkProgram
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool autoStart = false;
            if (args != null)
            {
                foreach (string arg in args)
                {
                    if (string.Equals(arg, "/S", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "--silent", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "--auto", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "--update", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "-update", StringComparison.OrdinalIgnoreCase))
                    {
                        autoStart = true;
                        break;
                    }
                }
            }
            Application.Run(new DiscordStyleInstallerWindow(autoStart));
        }
    }

    /// <summary>
    /// Helper to produce anti-aliased rounded rectangle paths with precision curves.
    /// </summary>
    internal static class GraphicsExtensions
    {
        public static GraphicsPath GetRoundedPath(Rectangle r, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            if (d > r.Width) d = r.Width;
            if (d > r.Height) d = r.Height;
            if (d <= 0)
            {
                path.AddRectangle(r);
                return path;
            }
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    /// <summary>
    /// Modern squircle icon box with ambient glow, rounded 20px corners,
    /// high-resolution bicubic scaling, and a subtle glass ring border.
    /// </summary>
    internal sealed class ModernSquircleLogoBox : Control
    {
        private Image _image;

        public ModernSquircleLogoBox()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint, true);
            BackColor = Color.Transparent;
        }

        public Image Image
        {
            get { return _image; }
            set { _image = value; Invalidate(); }
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            pe.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            pe.Graphics.CompositingQuality = CompositingQuality.HighQuality;

            int pad = 8;
            Rectangle iconRect = new Rectangle(pad, pad, Width - pad * 2, Height - pad * 2);

            // 1. Ambient soft glow behind squircle
            using (GraphicsPath glowPath = GraphicsExtensions.GetRoundedPath(new Rectangle(pad - 4, pad - 2, iconRect.Width + 8, iconRect.Height + 8), 24))
            using (PathGradientBrush pgb = new PathGradientBrush(glowPath))
            {
                pgb.CenterColor = Color.FromArgb(70, 88, 101, 242);
                pgb.SurroundColors = new Color[] { Color.FromArgb(0, 88, 101, 242) };
                pe.Graphics.FillPath(pgb, glowPath);
            }

            // 2. Drop shadow
            using (GraphicsPath shadowPath = GraphicsExtensions.GetRoundedPath(new Rectangle(iconRect.X + 1, iconRect.Y + 4, iconRect.Width - 2, iconRect.Height), 20))
            using (SolidBrush shadowBrush = new SolidBrush(Color.FromArgb(80, 0, 0, 0)))
            {
                pe.Graphics.FillPath(shadowBrush, shadowPath);
            }

            // 3. Draw image clipped to rounded squircle
            using (GraphicsPath clipPath = GraphicsExtensions.GetRoundedPath(iconRect, 20))
            {
                pe.Graphics.SetClip(clipPath);
                if (_image != null)
                {
                    pe.Graphics.DrawImage(_image, iconRect);
                }
                else
                {
                    using (SolidBrush bg = new SolidBrush(Color.FromArgb(32, 34, 38)))
                    {
                        pe.Graphics.FillRectangle(bg, iconRect);
                    }
                }
                pe.Graphics.ResetClip();

                // 4. Subtle 1.5px glass ring border
                using (Pen ringPen = new Pen(Color.FromArgb(55, 255, 255, 255), 1.5f))
                {
                    pe.Graphics.DrawPath(ringPen, clipPath);
                }
            }
        }
    }

    /// <summary>
    /// Modern gradient action button with subtle highlight and hover glow.
    /// </summary>
    internal sealed class ModernActionButton : Button
    {
        private bool _isHovered;
        private bool _isPressed;

        public ModernActionButton()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.Selectable | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint, true);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            BackColor = Color.FromArgb(88, 101, 242);
            ForeColor = Color.White;
            Cursor = Cursors.Hand;
            Font = new Font("Segoe UI", 11f, FontStyle.Bold);

            MouseEnter += delegate { _isHovered = true; Invalidate(); };
            MouseLeave += delegate { _isHovered = false; _isPressed = false; Invalidate(); };
            MouseDown += delegate { _isPressed = true; Invalidate(); };
            MouseUp += delegate { _isPressed = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = GraphicsExtensions.GetRoundedPath(rect, 10))
            {
                Color topColor;
                Color bottomColor;

                if (_isPressed)
                {
                    topColor = Color.FromArgb(64, 73, 175);
                    bottomColor = Color.FromArgb(50, 58, 145);
                }
                else if (_isHovered)
                {
                    topColor = Color.FromArgb(108, 120, 250);
                    bottomColor = Color.FromArgb(80, 93, 235);
                }
                else
                {
                    topColor = Color.FromArgb(94, 107, 246);
                    bottomColor = Color.FromArgb(72, 83, 222);
                }

                using (LinearGradientBrush lgb = new LinearGradientBrush(rect, topColor, bottomColor, LinearGradientMode.Vertical))
                {
                    pe.Graphics.FillPath(lgb, path);
                }

                // Top inner 1px highlight
                using (GraphicsPath topPath = GraphicsExtensions.GetRoundedPath(new Rectangle(rect.X + 1, rect.Y + 1, rect.Width - 2, rect.Height / 2), 9))
                using (Pen topPen = new Pen(Color.FromArgb(_isHovered ? 80 : 50, 255, 255, 255), 1f))
                {
                    pe.Graphics.DrawPath(topPen, topPath);
                }

                // Subtle border
                using (Pen borderPen = new Pen(Color.FromArgb(40, 255, 255, 255), 1f))
                {
                    pe.Graphics.DrawPath(borderPen, path);
                }
            }

            TextRenderer.DrawText(
                pe.Graphics,
                Text,
                Font,
                new Rectangle(0, 0, Width, Height),
                ForeColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter
            );
        }
    }

    /// <summary>
    /// Modern circular window close button with smooth hover backdrop.
    /// </summary>
    internal sealed class CircularCloseButton : Control
    {
        private bool _isHovered;

        public CircularCloseButton()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint, true);
            BackColor = Color.Transparent;
            Cursor = Cursors.Hand;
            Size = new Size(28, 28);

            MouseEnter += delegate { _isHovered = true; Invalidate(); };
            MouseLeave += delegate { _isHovered = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

            if (_isHovered)
            {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(38, 255, 255, 255)))
                {
                    pe.Graphics.FillEllipse(b, 2, 2, Width - 5, Height - 5);
                }
            }

            Color xColor = _isHovered ? Color.FromArgb(240, 240, 245) : Color.FromArgb(130, 135, 145);
            using (Pen p = new Pen(xColor, 1.6f))
            {
                int pad = 9;
                pe.Graphics.DrawLine(p, pad, pad, Width - pad, Height - pad);
                pe.Graphics.DrawLine(p, Width - pad, pad, pad, Height - pad);
            }
        }
    }

    /// <summary>
    /// Elevated rounded progress bar with gradient fill and smooth pill caps.
    /// </summary>
    internal sealed class ModernProgressBar : Control
    {
        private int _percent;
        private double _pulseOffset;
        private bool _isIndeterminate = true;

        public ModernProgressBar()
        {
            DoubleBuffered = true;
            BackColor = Color.FromArgb(38, 41, 46);
            ForeColor = Color.FromArgb(88, 101, 242);
        }

        public void SetIndeterminate(double pulse)
        {
            _isIndeterminate = true;
            _pulseOffset = pulse;
            Invalidate();
        }

        public void SetPercent(int pct)
        {
            _isIndeterminate = false;
            _percent = Math.Max(0, Math.Min(100, pct));
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.Clear(Parent?.BackColor ?? Color.FromArgb(26, 28, 32));

            int radius = Height / 2;
            Rectangle trackRect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath trackPath = GraphicsExtensions.GetRoundedPath(trackRect, radius))
            {
                using (SolidBrush trackBrush = new SolidBrush(Color.FromArgb(43, 46, 52)))
                {
                    pe.Graphics.FillPath(trackBrush, trackPath);
                }
                using (Pen trackPen = new Pen(Color.FromArgb(25, 255, 255, 255), 1f))
                {
                    pe.Graphics.DrawPath(trackPen, trackPath);
                }
            }

            Rectangle barRect;
            if (_isIndeterminate)
            {
                int barWidth = 80;
                double wave = (Math.Sin(_pulseOffset) + 1.0) / 2.0;
                int x = (int)(wave * (Width - barWidth));
                barRect = new Rectangle(x, 0, barWidth, Height);
            }
            else
            {
                int barWidth = Math.Max(8, (int)(Width * (_percent / 100.0)));
                barRect = new Rectangle(0, 0, barWidth, Height);
            }

            if (barRect.Width > 3)
            {
                Rectangle fillRect = new Rectangle(barRect.X, 0, Math.Min(barRect.Width, Width - barRect.X), Height - 1);
                using (GraphicsPath barPath = GraphicsExtensions.GetRoundedPath(fillRect, radius))
                using (LinearGradientBrush barBrush = new LinearGradientBrush(fillRect, Color.FromArgb(88, 101, 242), Color.FromArgb(136, 149, 255), LinearGradientMode.Horizontal))
                {
                    pe.Graphics.FillPath(barBrush, barPath);
                }
            }
        }
    }

    /// <summary>
    /// Sleek dark feature/info container card to eliminate awkward empty gaps.
    /// </summary>
    internal sealed class ModernInfoCard : Control
    {
        private readonly List<string> _lines = new List<string>();

        public ModernInfoCard()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint, true);
            BackColor = Color.Transparent;
        }

        public void SetLines(params string[] lines)
        {
            _lines.Clear();
            if (lines != null) _lines.AddRange(lines);
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = GraphicsExtensions.GetRoundedPath(rect, 10))
            {
                using (SolidBrush bg = new SolidBrush(Color.FromArgb(28, 30, 35)))
                {
                    pe.Graphics.FillPath(bg, path);
                }
                using (Pen borderPen = new Pen(Color.FromArgb(32, 255, 255, 255), 1f))
                {
                    pe.Graphics.DrawPath(borderPen, path);
                }
            }

            int y = 10;
            using (Font f = new Font("Segoe UI", 8.5f, FontStyle.Regular))
            using (SolidBrush textBrush = new SolidBrush(Color.FromArgb(168, 174, 186)))
            {
                foreach (string line in _lines)
                {
                    pe.Graphics.DrawString(line, f, textBrush, new RectangleF(12, y, Width - 24, 18));
                    y += 20;
                }
            }
        }
    }

    /// <summary>
    /// Ultra-sleek, professional installer window:
    /// - 360x460 Obsidian dark canvas with smooth 20px rounded corners & subtle 1px border
    /// - Glowing squircle SOCDOF icon with high-res bicubic interpolation
    /// - Refined typography without clunky pill boxes
    /// - Modern gradient action button with hover glow
    /// - Balanced information architecture with zero dead empty zones
    /// - Accurate localized lifecycle progression
    /// </summary>
    internal sealed class DiscordStyleInstallerWindow : Form
    {
        private static readonly Color BgTop = Color.FromArgb(38, 41, 47);
        private static readonly Color BgBottom = Color.FromArgb(23, 25, 28);
        private static readonly Color TextWhite = Color.FromArgb(245, 246, 248);
        private static readonly Color TextMuted = Color.FromArgb(154, 161, 172);
        private static readonly Color TextSubtle = Color.FromArgb(112, 117, 126);

        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        private readonly System.Windows.Forms.Timer _pulseTimer = new System.Windows.Forms.Timer();
        private readonly ModernSquircleLogoBox _logoBox = new ModernSquircleLogoBox();
        private readonly Label _titleLabel = new Label();
        private readonly Label _subtitleLabel = new Label();
        private readonly Label _taglineLabel = new Label();
        private readonly ModernActionButton _installButton = new ModernActionButton();
        private readonly Label _licenseNoteLabel = new Label();
        private readonly ModernInfoCard _infoCard = new ModernInfoCard();
        private readonly CircularCloseButton _closeButton = new CircularCloseButton();

        // Installation State Controls
        private readonly Label _statusLabel = new Label();
        private readonly ModernProgressBar _progressBar = new ModernProgressBar();
        private readonly Label _subStatusLabel = new Label();
        private readonly Label _footerLabel = new Label();

        private readonly string _targetDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "SOCDOF"
        );

        private readonly bool _autoStart;
        private readonly bool _isExistingInstall;
        private readonly string _existingInstallPath;
        private string _packagePath;
        private string _langCode;
        private bool _isInstalling;
        private bool _failed;
        private double _pulseStep;
        private int _currentPercent;

        private static string DetectExistingInstallationPath()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\de.strudelcode.socdof"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null && !string.IsNullOrWhiteSpace(loc.ToString()) && Directory.Exists(loc.ToString()))
                            return loc.ToString();
                    }
                }
            }
            catch { }

            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\de.strudelcode.socdof"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null && !string.IsNullOrWhiteSpace(loc.ToString()) && Directory.Exists(loc.ToString()))
                            return loc.ToString();
                    }
                }
            }
            catch { }

            string defaultTarget = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SOCDOF");
            if (File.Exists(Path.Combine(defaultTarget, "SOCDOF.exe"))) return defaultTarget;

            string lowercaseTarget = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "socdof");
            if (File.Exists(Path.Combine(lowercaseTarget, "SOCDOF.exe")) || File.Exists(Path.Combine(lowercaseTarget, "socdof.exe")))
                return lowercaseTarget;

            string customTarget = @"C:\SOCDOF";
            if (File.Exists(Path.Combine(customTarget, "SOCDOF.exe"))) return customTarget;

            string progFiles = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "SOCDOF");
            if (File.Exists(Path.Combine(progFiles, "SOCDOF.exe"))) return progFiles;

            return null;
        }

        private static async Task TerminateRunningAppProcessesAsync()
        {
            try
            {
                int currentPid = Process.GetCurrentProcess().Id;
                string[] targetNames = new string[] { "SOCDOF", "socdof" };
                List<Process> procsToClose = new List<Process>();

                foreach (string name in targetNames)
                {
                    Process[] found = Process.GetProcessesByName(name);
                    foreach (Process p in found)
                    {
                        if (p.Id != currentPid)
                        {
                            procsToClose.Add(p);
                        }
                    }
                }

                if (procsToClose.Count == 0) return;

                foreach (Process p in procsToClose)
                {
                    try
                    {
                        if (!p.HasExited) p.CloseMainWindow();
                    }
                    catch { }
                }

                await Task.Delay(1200);

                foreach (Process p in procsToClose)
                {
                    try
                    {
                        if (!p.HasExited)
                        {
                            p.Kill();
                        }
                    }
                    catch { }
                }

                await Task.Delay(400);
            }
            catch { }
        }

        private string FindInstalledExecutable()
        {
            List<string> candidates = new List<string>();

            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\de.strudelcode.socdof"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null) candidates.Add(Path.Combine(loc.ToString(), "SOCDOF.exe"));
                        object icon = key.GetValue("DisplayIcon");
                        if (icon != null && icon.ToString().EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                            candidates.Add(icon.ToString());
                    }
                }
            }
            catch { }

            if (!string.IsNullOrEmpty(_existingInstallPath))
            {
                candidates.Add(Path.Combine(_existingInstallPath, "SOCDOF.exe"));
                candidates.Add(Path.Combine(_existingInstallPath, "socdof.exe"));
            }

            candidates.Add(Path.Combine(_targetDir, "SOCDOF.exe"));
            candidates.Add(Path.Combine(_targetDir, "socdof.exe"));

            string localPrograms = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs");
            candidates.Add(Path.Combine(localPrograms, "SOCDOF", "SOCDOF.exe"));
            candidates.Add(Path.Combine(localPrograms, "socdof", "SOCDOF.exe"));
            candidates.Add(Path.Combine(localPrograms, "socdof", "socdof.exe"));
            candidates.Add(@"C:\SOCDOF\SOCDOF.exe");
            candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "SOCDOF", "SOCDOF.exe"));

            foreach (string path in candidates)
            {
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
                {
                    return path;
                }
            }
            return null;
        }

        public DiscordStyleInstallerWindow(bool autoStart = false)
        {
            _existingInstallPath = DetectExistingInstallationPath();
            _isExistingInstall = !string.IsNullOrEmpty(_existingInstallPath);
            _autoStart = autoStart || _isExistingInstall;

            Text = _isExistingInstall ? "SOCDOF Desktop Update" : "SOCDOF Desktop Installer";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            ClientSize = new Size(360, 460);
            MinimumSize = new Size(360, 460);
            MaximumSize = new Size(360, 460);
            BackColor = BgBottom;
            ForeColor = TextWhite;
            ShowInTaskbar = true;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            UpdateRegion();

            _langCode = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant();

            BuildUI();

            _pulseTimer.Interval = 30;
            _pulseTimer.Tick += OnPulseTick;

            MouseDown += DragWindow;
            _logoBox.MouseDown += DragWindow;
            _titleLabel.MouseDown += DragWindow;
            _subtitleLabel.MouseDown += DragWindow;
            _taglineLabel.MouseDown += DragWindow;
            _statusLabel.MouseDown += DragWindow;
            _subStatusLabel.MouseDown += DragWindow;
            _infoCard.MouseDown += DragWindow;
            _footerLabel.MouseDown += DragWindow;

            Shown += async delegate
            {
                if (_autoStart)
                {
                    await Task.Delay(200);
                    await BeginInstallationAsync();
                }
            };

            FormClosed += delegate
            {
                _pulseTimer.Stop();
                _http.Dispose();
            };
        }

        private void UpdateRegion()
        {
            try
            {
                IntPtr rgn = CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 20, 20);
                Region = System.Drawing.Region.FromHrgn(rgn);
            }
            catch { }
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

            // 1. Sleek vertical dark gradient
            Rectangle fullRect = new Rectangle(0, 0, ClientSize.Width, ClientSize.Height);
            using (LinearGradientBrush lgb = new LinearGradientBrush(fullRect, BgTop, BgBottom, LinearGradientMode.Vertical))
            {
                pe.Graphics.FillRectangle(lgb, fullRect);
            }

            // 2. Subtle 1px inner border outline
            using (GraphicsPath borderPath = GraphicsExtensions.GetRoundedPath(new Rectangle(0, 0, ClientSize.Width - 1, ClientSize.Height - 1), 20))
            using (Pen borderPen = new Pen(Color.FromArgb(42, 255, 255, 255), 1f))
            {
                pe.Graphics.DrawPath(borderPen, borderPath);
            }

            // 3. Subtle footer separator line
            using (Pen sepPen = new Pen(Color.FromArgb(20, 255, 255, 255), 1f))
            {
                pe.Graphics.DrawLine(sepPen, 24, 420, ClientSize.Width - 24, 420);
            }
        }

        private Image LoadHighResLogo()
        {
            try
            {
                // 1. Try embedded resource
                Assembly asm = Assembly.GetExecutingAssembly();
                string[] names = asm.GetManifestResourceNames();
                foreach (string n in names)
                {
                    if (n.EndsWith("socdof_icon.png", StringComparison.OrdinalIgnoreCase))
                    {
                        using (Stream s = asm.GetManifestResourceStream(n))
                        {
                            if (s != null) return Image.FromStream(s);
                        }
                    }
                }

                // 2. Try adjacent public or assets folder
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] paths = new string[]
                {
                    Path.Combine(baseDir, "public", "socdof_icon.png"),
                    Path.Combine(baseDir, "socdof_icon.png"),
                    Path.Combine(baseDir, "..", "public", "socdof_icon.png")
                };
                foreach (string p in paths)
                {
                    if (File.Exists(p)) return Image.FromFile(p);
                }

                // 3. Fallback to icon
                if (Icon != null) return Icon.ToBitmap();
            }
            catch { }
            return null;
        }

        private void BuildUI()
        {
            // Close 'X' button in top-right corner
            _closeButton.Location = new Point(ClientSize.Width - 38, 12);
            _closeButton.Click += delegate { Application.Exit(); };
            Controls.Add(_closeButton);

            // Centered High-Res Squircle Logo (96x96 with padding)
            int logoBoxSize = 100;
            _logoBox.Location = new Point((ClientSize.Width - logoBoxSize) / 2, 38);
            _logoBox.Size = new Size(logoBoxSize, logoBoxSize);
            _logoBox.Image = LoadHighResLogo();
            Controls.Add(_logoBox);

            // App Brand: SOCDOF
            _titleLabel.Location = new Point(16, 146);
            _titleLabel.Size = new Size(ClientSize.Width - 32, 28);
            _titleLabel.TextAlign = ContentAlignment.MiddleCenter;
            _titleLabel.Font = new Font("Segoe UI", 16.5f, FontStyle.Bold);
            _titleLabel.ForeColor = TextWhite;
            _titleLabel.Text = "SOCDOF";
            Controls.Add(_titleLabel);

            // Refined Subtitle: OFFLINE COMMERCE & ERP SUITE or UPDATE DETECTED
            _subtitleLabel.Location = new Point(16, 175);
            _subtitleLabel.Size = new Size(ClientSize.Width - 32, 18);
            _subtitleLabel.TextAlign = ContentAlignment.MiddleCenter;
            _subtitleLabel.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            _subtitleLabel.ForeColor = Color.FromArgb(142, 154, 255);
            _subtitleLabel.Text = _isExistingInstall ? GetText("update_detected") : GetText("subtitle");
            Controls.Add(_subtitleLabel);

            // Feature Highlights Row (Clean inline typography with separators)
            _taglineLabel.Location = new Point(16, 202);
            _taglineLabel.Size = new Size(ClientSize.Width - 32, 18);
            _taglineLabel.TextAlign = ContentAlignment.MiddleCenter;
            _taglineLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            _taglineLabel.ForeColor = TextMuted;
            _taglineLabel.Text = GetText("tagline");
            Controls.Add(_taglineLabel);

            // Primary Action Button (Modern gradient button)
            int btnWidth = 270;
            _installButton.Location = new Point((ClientSize.Width - btnWidth) / 2, 232);
            _installButton.Size = new Size(btnWidth, 46);
            _installButton.Text = _isExistingInstall ? GetText("update_now") : GetText("install");
            _installButton.Click += async delegate { await BeginInstallationAsync(); };
            Controls.Add(_installButton);

            // License / Version sub-note below button
            _licenseNoteLabel.Location = new Point(16, 284);
            _licenseNoteLabel.Size = new Size(ClientSize.Width - 32, 16);
            _licenseNoteLabel.TextAlign = ContentAlignment.MiddleCenter;
            _licenseNoteLabel.Font = new Font("Segoe UI", 8f, FontStyle.Regular);
            _licenseNoteLabel.ForeColor = TextSubtle;
            _licenseNoteLabel.Text = GetText("license_note");
            Controls.Add(_licenseNoteLabel);

            // Modern Info Card (Eliminates the empty gap in both states)
            int cardWidth = 304;
            _infoCard.Location = new Point((ClientSize.Width - cardWidth) / 2, 314);
            _infoCard.Size = new Size(cardWidth, 76);
            _infoCard.SetLines(
                GetText("benefit_1"),
                GetText("benefit_2"),
                GetText("benefit_3")
            );
            Controls.Add(_infoCard);

            // -------------------------------------------------------------
            // Dynamic Installation State Controls (Initially Hidden)
            // -------------------------------------------------------------

            _statusLabel.Location = new Point(16, 226);
            _statusLabel.Size = new Size(ClientSize.Width - 32, 28);
            _statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _statusLabel.Font = new Font("Segoe UI", 12.5f, FontStyle.Bold);
            _statusLabel.ForeColor = TextWhite;
            _statusLabel.Text = GetText("installing");
            _statusLabel.Visible = false;
            Controls.Add(_statusLabel);

            _progressBar.Location = new Point((ClientSize.Width - btnWidth) / 2, 262);
            _progressBar.Size = new Size(btnWidth, 8);
            _progressBar.Visible = false;
            Controls.Add(_progressBar);

            _subStatusLabel.Location = new Point(16, 278);
            _subStatusLabel.Size = new Size(ClientSize.Width - 32, 20);
            _subStatusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _subStatusLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            _subStatusLabel.ForeColor = TextMuted;
            _subStatusLabel.Text = GetText("setting_up");
            _subStatusLabel.Visible = false;
            Controls.Add(_subStatusLabel);

            // Footer
            _footerLabel.Location = new Point(16, 428);
            _footerLabel.Size = new Size(ClientSize.Width - 32, 18);
            _footerLabel.TextAlign = ContentAlignment.MiddleCenter;
            _footerLabel.Font = new Font("Segoe UI", 8f, FontStyle.Regular);
            _footerLabel.ForeColor = TextSubtle;
            _footerLabel.Text = GetText("footer");
            Controls.Add(_footerLabel);
        }

        private string GetText(string key)
        {
            switch (key)
            {
                case "subtitle":
                    if (_langCode == "fr") return "SUITE COMMERCIALE & ERP HORS-LIGNE";
                    if (_langCode == "es") return "SUITE COMERCIAL Y ERP SIN CONEXIÓN";
                    if (_langCode == "en") return "OFFLINE COMMERCE & ERP SUITE";
                    return "OFFLINE COMMERCE & ERP SUITE";

                case "update_detected":
                    if (_langCode == "fr") return "INSTALLATION DÉTECTÉE · MISE À JOUR AUTO";
                    if (_langCode == "es") return "INSTALACIÓN DETECTADA · AUTO-ACTUALIZACIÓN";
                    if (_langCode == "en") return "EXISTING INSTALLATION DETECTED · AUTO-UPDATE";
                    return "BESTEHENDE INSTALLATION ERKANNT · AUTO-UPDATE";

                case "tagline":
                    if (_langCode == "fr") return "⚡ 100% Hors-ligne  ·  🔒 Base Locale  ·  🪟 Win 64-Bit";
                    if (_langCode == "es") return "⚡ 100% Sin conexión  ·  🔒 BD Local  ·  🪟 Win 64-Bit";
                    if (_langCode == "en") return "⚡ 100% Offline  ·  🔒 Local Database  ·  🪟 Win 64-Bit";
                    return "⚡ 100% Offline  ·  🔒 Lokale Datenbank  ·  🪟 Windows 64-Bit";

                case "install":
                    if (_langCode == "fr") return "Installer SOCDOF";
                    if (_langCode == "es") return "Instalar SOCDOF";
                    if (_langCode == "en") return "Install SOCDOF";
                    return "SOCDOF Installieren";

                case "update_now":
                    if (_langCode == "fr") return "Mettre à jour SOCDOF";
                    if (_langCode == "es") return "Actualizar SOCDOF";
                    if (_langCode == "en") return "Update SOCDOF";
                    return "SOCDOF Aktualisieren";

                case "license_note":
                    if (_langCode == "fr") return "Gratuit & Open Source · Version 24.10.3";
                    if (_langCode == "es") return "Gratis y Código Abierto · Versión 24.10.3";
                    if (_langCode == "en") return "Free & Open Source · Version 24.10.3";
                    return "Kostenlos & Open Source · Version 24.10.3";

                case "benefit_1":
                    if (_langCode == "fr") return "✓ 100% Hors-ligne – Fonctionne sans Internet ni Cloud";
                    if (_langCode == "es") return "✓ 100% Sin conexión – Funciona sin Internet ni Nube";
                    if (_langCode == "en") return "✓ 100% Offline – Works without internet or cloud";
                    return "✓ 100% Offline – Funktioniert ohne Internet oder Cloud";

                case "benefit_2":
                    if (_langCode == "fr") return "✓ Aucune permission admin requise (%LocalAppData%)";
                    if (_langCode == "es") return "✓ Sin permisos de admin (Instala en %LocalAppData%)";
                    if (_langCode == "en") return "✓ No admin rights required (Installs to %LocalAppData%)";
                    return "✓ Keine Adminrechte nötig (Installiert in %LocalAppData%)";

                case "benefit_3":
                    if (_langCode == "fr") return "✓ Base de données SQLite locale, privée et sécurisée";
                    if (_langCode == "es") return "✓ Base de datos SQLite local, privée et sécurisée";
                    if (_langCode == "en") return "✓ Local, private and secure SQLite database";
                    return "✓ Lokale, private und sichere SQLite-Datenbank";

                case "installing":
                    if (_langCode == "fr") return "Installation en cours...";
                    if (_langCode == "es") return "Instalando...";
                    if (_langCode == "en") return "Installing...";
                    return "Wird installiert...";

                case "updating":
                    if (_langCode == "fr") return "Mise à jour en cours...";
                    if (_langCode == "es") return "Actualizando...";
                    if (_langCode == "en") return "Installing update...";
                    return "Update wird installiert...";

                case "closing_instances":
                    if (_langCode == "fr") return "Fermeture des instances actives...";
                    if (_langCode == "es") return "Cerrando instancias activas...";
                    if (_langCode == "en") return "Closing running instances...";
                    return "Laufende Instanzen werden beendet...";

                case "setting_up":
                    if (_langCode == "fr") return "Préparation des fichiers...";
                    if (_langCode == "es") return "Configurando archivos...";
                    if (_langCode == "en") return "Setting up files...";
                    return "Dateien werden eingerichtet...";

                case "step_1":
                    if (_langCode == "fr") return "1. Téléchargement du package d'installation";
                    if (_langCode == "es") return "1. Descargando el paquete de instalación";
                    if (_langCode == "en") return "1. Downloading setup package";
                    return "1. Download des Installationspakets";

                case "step_2":
                    if (_langCode == "fr") return "2. Configuration locale et raccourcis bureau";
                    if (_langCode == "es") return "2. Configuración local y accesos directos";
                    if (_langCode == "en") return "2. Local setup & desktop shortcut";
                    return "2. Lokale Einrichtung & Desktop-Verknüpfung";

                case "step_3":
                    if (_langCode == "fr") return "3. Lancement instantané de SOCDOF Desktop";
                    if (_langCode == "es") return "3. Inicio instantáneo de SOCDOF Desktop";
                    if (_langCode == "en") return "3. Instant launch of SOCDOF Desktop";
                    return "3. Schneller Sofortstart von SOCDOF Desktop";

                case "completing":
                    if (_langCode == "fr") return "Finalisation de l'installation...";
                    if (_langCode == "es") return "Completando la instalación...";
                    if (_langCode == "en") return "Completing setup...";
                    return "Installation wird abgeschlossen...";

                case "starting":
                    if (_langCode == "fr") return "Démarrage...";
                    if (_langCode == "es") return "Iniciando...";
                    if (_langCode == "en") return "Starting...";
                    return "Wird gestartet...";

                case "opening":
                    if (_langCode == "fr") return "Ouverture de SOCDOF Desktop...";
                    if (_langCode == "es") return "Abriendo SOCDOF Desktop...";
                    if (_langCode == "en") return "Opening SOCDOF Desktop...";
                    return "SOCDOF Desktop öffnet sich...";

                case "failed":
                    if (_langCode == "fr") return "Échec de l'installation";
                    if (_langCode == "es") return "Error en la instalación";
                    if (_langCode == "en") return "Installation failed";
                    return "Installation fehlgeschlagen";

                case "retry":
                    if (_langCode == "fr") return "Réessayer";
                    if (_langCode == "es") return "Reintentar";
                    if (_langCode == "en") return "Retry";
                    return "Wiederholen";

                case "footer":
                    if (_langCode == "fr") return "Strudelcode  ·  Version 24.10.3  ·  Sécurisé & Privé";
                    if (_langCode == "es") return "Strudelcode  ·  Versión 24.10.3  ·  Seguro y Privado";
                    if (_langCode == "en") return "Strudelcode  ·  Version 24.10.3  ·  Secure & Private";
                    return "Strudelcode  ·  Version 24.10.3  ·  Sicher & Privat";

                default:
                    return "";
            }
        }

        private async Task BeginInstallationAsync()
        {
            if (_isInstalling) return;
            _isInstalling = true;

            // Transition UI from button to progress
            _installButton.Visible = false;
            _licenseNoteLabel.Visible = false;
            _taglineLabel.Visible = false;

            _statusLabel.Visible = true;
            _statusLabel.Text = (_isExistingInstall || _autoStart) ? GetText("updating") : GetText("installing");
            _progressBar.Visible = true;
            _progressBar.SetIndeterminate(0);
            _subStatusLabel.Visible = true;
            _subStatusLabel.Text = GetText("setting_up");

            // Update info card with installation workflow steps
            _infoCard.SetLines(
                "➔ " + GetText("step_1"),
                "  " + GetText("step_2"),
                "  " + GetText("step_3")
            );

            _pulseTimer.Start();
            await StartWorkflowAsync();
        }

        private void OnPulseTick(object sender, EventArgs e)
        {
            _pulseStep += 0.08;
            if (_pulseStep > Math.PI * 2) _pulseStep -= Math.PI * 2;

            if (_currentPercent <= 0 && !_failed && _isInstalling)
            {
                _progressBar.SetIndeterminate(_pulseStep);
            }
        }

        private void SetPercent(int pct)
        {
            _currentPercent = pct;
            if (InvokeRequired)
            {
                Invoke(new Action<int>(SetPercent), pct);
                return;
            }
            _progressBar.SetPercent(pct);
        }

        private async Task StartWorkflowAsync()
        {
            try
            {
                _infoCard.SetLines(
                    "➔ " + GetText("step_1"),
                    "  " + GetText("step_2"),
                    "  " + GetText("step_3")
                );

                // Step 1: Query latest official release from GitHub API
                string apiUrl = "https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest";
                _http.DefaultRequestHeaders.UserAgent.Clear();
                _http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("SOCDOF-Installer", "24.10.3"));
                _http.DefaultRequestHeaders.Accept.Clear();
                _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                string json = await _http.GetStringAsync(apiUrl);
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                Dictionary<string, object> release = serializer.Deserialize<Dictionary<string, object>>(json);

                string downloadUrl = null;
                string targetAssetName = null;
                long expectedSize = 0;

                if (release.ContainsKey("assets"))
                {
                    ArrayList assets = (ArrayList)release["assets"];
                    foreach (Dictionary<string, object> asset in assets)
                    {
                        string name = asset.ContainsKey("name") ? asset["name"].ToString() : "";
                        if (name.StartsWith("SOCDOF-Setup-", StringComparison.OrdinalIgnoreCase) &&
                            name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = asset["browser_download_url"].ToString();
                            targetAssetName = name;
                            if (asset.ContainsKey("size"))
                            {
                                long.TryParse(asset["size"].ToString(), out expectedSize);
                            }
                            break;
                        }
                    }
                }

                if (string.IsNullOrEmpty(downloadUrl) || string.IsNullOrEmpty(targetAssetName))
                {
                    throw new InvalidOperationException("No setup package found in latest release.");
                }

                // Check if the EXACT target version setup already exists locally in baseDir and is valid
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string localExactCandidate = Path.Combine(baseDir, targetAssetName);
                if (File.Exists(localExactCandidate) && (expectedSize <= 0 || new FileInfo(localExactCandidate).Length >= expectedSize - 1024))
                {
                    _packagePath = localExactCandidate;
                    SetPercent(50);
                    _subStatusLabel.Text = GetText("setting_up");
                }
                else
                {
                    // Download verified latest version fresh to Temp directory
                    _packagePath = Path.Combine(Path.GetTempPath(), targetAssetName);
                    _subStatusLabel.Text = _langCode == "de" ? "Herunterladen... 0%" : "Downloading... 0%";

                    using (HttpResponseMessage response = await _http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
                    {
                        response.EnsureSuccessStatusCode();
                        long totalBytes = response.Content.Headers.ContentLength ?? expectedSize;

                        using (Stream input = await response.Content.ReadAsStreamAsync())
                        using (FileStream output = new FileStream(_packagePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
                        {
                            byte[] buffer = new byte[81920];
                            long received = 0;
                            int read;

                            while ((read = await input.ReadAsync(buffer, 0, buffer.Length)) > 0)
                            {
                                await output.WriteAsync(buffer, 0, read);
                                received += read;
                                if (totalBytes > 0)
                                {
                                    int pct = (int)(received * 100L / totalBytes);
                                    SetPercent(pct);
                                    _subStatusLabel.Text = string.Format(_langCode == "de" ? "Herunterladen... {0}%" : "Downloading... {0}%", pct);
                                }
                            }
                            await output.FlushAsync();
                        }
                    }
                }

                SetPercent(100);
                _subStatusLabel.Text = GetText("completing");
                _infoCard.SetLines(
                    "✓ " + GetText("step_1"),
                    "➔ " + GetText("step_2"),
                    "  " + GetText("step_3")
                );

                // Step 2: Terminate any running SOCDOF instances so Windows file lock is released!
                _subStatusLabel.Text = GetText("closing_instances");
                await TerminateRunningAppProcessesAsync();

                // Step 3: Run silent installation
                string installTarget = !string.IsNullOrEmpty(_existingInstallPath) ? _existingInstallPath : _targetDir;
                Directory.CreateDirectory(installTarget);

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = _packagePath,
                    Arguments = "/S",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetTempPath()
                };

                using (Process proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        await Task.Run(delegate { proc.WaitForExit(); });
                    }
                }

                await Task.Delay(600);

                _infoCard.SetLines(
                    "✓ " + GetText("step_1"),
                    "✓ " + GetText("step_2"),
                    "➔ " + GetText("step_3")
                );

                // Step 4: Installation complete -> Now show "Wird gestartet..."
                _statusLabel.Text = GetText("starting");
                _subStatusLabel.Text = GetText("opening");
                await Task.Delay(400);

                string appExe = FindInstalledExecutable();
                if (!string.IsNullOrEmpty(appExe) && File.Exists(appExe))
                {
                    Process.Start(new ProcessStartInfo(appExe) { UseShellExecute = true });
                }

                await Task.Delay(300);
                Application.Exit();
            }
            catch (Exception ex)
            {
                _failed = true;
                _isInstalling = false;
                _pulseTimer.Stop();
                _statusLabel.Text = GetText("failed");
                _subStatusLabel.Text = _langCode == "de" ? "Fehler: " + ex.Message : "Error: " + ex.Message;
                _installButton.Text = GetText("retry");
                _installButton.Visible = true;
                _progressBar.Visible = false;
            }
        }

        private void DragWindow(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(Handle, 0xA1, 0x2, 0);
            }
        }

        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        [DllImport("gdi32.dll")] private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);
    }
}
