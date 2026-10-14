using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

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
                        string.Equals(arg, "--auto", StringComparison.OrdinalIgnoreCase))
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
    /// Helper to produce anti-aliased rounded rectangle paths.
    /// </summary>
    internal static class GraphicsExtensions
    {
        public static GraphicsPath GetRoundedPath(Rectangle r, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    /// <summary>
    /// Anti-aliased PictureBox using HighQualityBicubic interpolation
    /// to render high-resolution icons crisp without pixelation.
    /// </summary>
    internal sealed class AntiAliasedPictureBox : PictureBox
    {
        public AntiAliasedPictureBox()
        {
            DoubleBuffered = true;
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            pe.Graphics.CompositingQuality = CompositingQuality.HighQuality;
            base.OnPaint(pe);
        }
    }

    /// <summary>
    /// Smooth rounded Discord-style action button (Blurple #5865F2).
    /// </summary>
    internal sealed class DiscordButton : Button
    {
        private bool _isHovered;
        private bool _isPressed;

        public DiscordButton()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.Selectable, false);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            BackColor = Color.FromArgb(88, 101, 242);
            ForeColor = Color.White;
            Cursor = Cursors.Hand;
            Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);

            MouseEnter += delegate { _isHovered = true; Invalidate(); };
            MouseLeave += delegate { _isHovered = false; _isPressed = false; Invalidate(); };
            MouseDown += delegate { _isPressed = true; Invalidate(); };
            MouseUp += delegate { _isPressed = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.Clear(Parent?.BackColor ?? Color.FromArgb(32, 34, 37));

            Color bg;
            if (_isPressed) bg = Color.FromArgb(58, 67, 160);
            else if (_isHovered) bg = Color.FromArgb(71, 82, 196);
            else bg = Color.FromArgb(88, 101, 242);

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = GraphicsExtensions.GetRoundedPath(rect, 8))
            using (SolidBrush brush = new SolidBrush(bg))
            {
                pe.Graphics.FillPath(brush, path);
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
    /// Smooth rounded pill badge for 'DESKTOP SUITE'.
    /// </summary>
    internal sealed class RoundedBadge : Label
    {
        public RoundedBadge()
        {
            DoubleBuffered = true;
            BackColor = Color.FromArgb(43, 45, 49);
            ForeColor = Color.FromArgb(168, 179, 250);
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            TextAlign = ContentAlignment.MiddleCenter;
        }

        protected override void OnPaint(PaintEventArgs pe)
        {
            pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            pe.Graphics.Clear(Parent?.BackColor ?? Color.FromArgb(32, 34, 37));
            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = GraphicsExtensions.GetRoundedPath(rect, 6))
            using (SolidBrush brush = new SolidBrush(BackColor))
            {
                pe.Graphics.FillPath(brush, path);
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
    /// Smooth rounded progress bar track and filler.
    /// </summary>
    internal sealed class RoundedProgressTrack : Control
    {
        private int _percent;
        private double _pulseOffset;
        private bool _isIndeterminate = true;

        public RoundedProgressTrack()
        {
            DoubleBuffered = true;
            BackColor = Color.FromArgb(53, 55, 60);
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
            pe.Graphics.Clear(Parent?.BackColor ?? Color.FromArgb(32, 34, 37));

            Rectangle trackRect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath trackPath = GraphicsExtensions.GetRoundedPath(trackRect, Height / 2))
            using (SolidBrush trackBrush = new SolidBrush(BackColor))
            {
                pe.Graphics.FillPath(trackBrush, trackPath);
            }

            Rectangle barRect;
            if (_isIndeterminate)
            {
                int barWidth = 60;
                double wave = (Math.Sin(_pulseOffset) + 1.0) / 2.0;
                int x = (int)(wave * (Width - barWidth));
                barRect = new Rectangle(x, 0, barWidth, Height);
            }
            else
            {
                int barWidth = Math.Max(6, (int)(Width * (_percent / 100.0)));
                barRect = new Rectangle(0, 0, barWidth, Height);
            }

            if (barRect.Width > 2)
            {
                using (GraphicsPath barPath = GraphicsExtensions.GetRoundedPath(new Rectangle(barRect.X, 0, barRect.Width - 1, Height - 1), Height / 2))
                using (SolidBrush barBrush = new SolidBrush(ForeColor))
                {
                    pe.Graphics.FillPath(barBrush, barPath);
                }
            }
        }
    }

    /// <summary>
    /// Frameless, sleek Discord-like installer window.
    /// Pure, minimalist design:
    /// - Centered high-resolution anti-aliased SOCDOF logo
    /// - Discord-dark theme (#202225) with smooth 18px rounded corners
    /// - Clean "Installieren" / "Install" Discord button
    /// - Seamless transition to "Wird installiert..." with animated micro-progress bar
    /// - Transition to "Wird gestartet..." on completion and instant app launch
    /// </summary>
    internal sealed class DiscordStyleInstallerWindow : Form
    {
        private static readonly Color DarkBackground = Color.FromArgb(32, 34, 37); // Discord #202225
        private static readonly Color TextWhite = Color.FromArgb(242, 243, 245);
        private static readonly Color TextMuted = Color.FromArgb(148, 155, 164);
        private static readonly Color TextSubtle = Color.FromArgb(114, 118, 125);

        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        private readonly System.Windows.Forms.Timer _pulseTimer = new System.Windows.Forms.Timer();
        private readonly AntiAliasedPictureBox _logoBox = new AntiAliasedPictureBox();
        private readonly Label _titleLabel = new Label();
        private readonly RoundedBadge _badgeLabel = new RoundedBadge();
        private readonly Label _statusLabel = new Label();
        private readonly Label _subStatusLabel = new Label();
        private readonly DiscordButton _installButton = new DiscordButton();
        private readonly Label _closeButton = new Label();
        private readonly RoundedProgressTrack _progressBar = new RoundedProgressTrack();

        private readonly string _targetDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "SOCDOF"
        );

        private readonly bool _autoStart;
        private string _packagePath;
        private string _langCode;
        private bool _isInstalling;
        private bool _failed;
        private double _pulseStep;
        private int _currentPercent;

        public DiscordStyleInstallerWindow(bool autoStart = false)
        {
            _autoStart = autoStart;
            Text = "SOCDOF Installer";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            ClientSize = new Size(330, 420);
            MinimumSize = new Size(330, 420);
            MaximumSize = new Size(330, 420);
            BackColor = DarkBackground;
            ForeColor = TextWhite;
            ShowInTaskbar = true;
            DoubleBuffered = true;

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            // Rounded corners (18px radius)
            UpdateRegion();

            _langCode = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant();

            BuildUI();

            _pulseTimer.Interval = 30;
            _pulseTimer.Tick += OnPulseTick;

            MouseDown += DragWindow;
            _logoBox.MouseDown += DragWindow;
            _titleLabel.MouseDown += DragWindow;
            _badgeLabel.MouseDown += DragWindow;
            _statusLabel.MouseDown += DragWindow;
            _subStatusLabel.MouseDown += DragWindow;

            Shown += async delegate
            {
                if (_autoStart)
                {
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
                IntPtr rgn = CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 18, 18);
                Region = System.Drawing.Region.FromHrgn(rgn);
            }
            catch { }
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
            _closeButton.Text = "✕";
            _closeButton.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            _closeButton.ForeColor = TextSubtle;
            _closeButton.Size = new Size(28, 28);
            _closeButton.Location = new Point(ClientSize.Width - 36, 10);
            _closeButton.TextAlign = ContentAlignment.MiddleCenter;
            _closeButton.Cursor = Cursors.Hand;
            _closeButton.MouseEnter += delegate { _closeButton.ForeColor = TextWhite; };
            _closeButton.MouseLeave += delegate { _closeButton.ForeColor = TextSubtle; };
            _closeButton.Click += delegate { Application.Exit(); };
            Controls.Add(_closeButton);

            // Centered App Logo (88x88)
            int logoSize = 88;
            _logoBox.Location = new Point((ClientSize.Width - logoSize) / 2, 48);
            _logoBox.Size = new Size(logoSize, logoSize);
            _logoBox.SizeMode = PictureBoxSizeMode.Zoom;
            Image logoImg = LoadHighResLogo();
            if (logoImg != null) _logoBox.Image = logoImg;
            Controls.Add(_logoBox);

            // Title: SOCDOF
            _titleLabel.Location = new Point(10, 146);
            _titleLabel.Size = new Size(ClientSize.Width - 20, 32);
            _titleLabel.TextAlign = ContentAlignment.MiddleCenter;
            _titleLabel.Font = new Font("Segoe UI", 16f, FontStyle.Bold);
            _titleLabel.ForeColor = TextWhite;
            _titleLabel.Text = "SOCDOF";
            Controls.Add(_titleLabel);

            // Badge: DESKTOP SUITE (rounded pill)
            _badgeLabel.Location = new Point((ClientSize.Width - 130) / 2, 180);
            _badgeLabel.Size = new Size(130, 22);
            _badgeLabel.Text = "DESKTOP SUITE";
            Controls.Add(_badgeLabel);

            // Primary Discord-Style "Installieren" Button
            _installButton.Location = new Point(45, 235);
            _installButton.Size = new Size(ClientSize.Width - 90, 44);
            _installButton.Text = GetText("install");
            _installButton.Click += async delegate { await BeginInstallationAsync(); };
            Controls.Add(_installButton);

            // Status label (shown during installation: "Wird installiert...")
            _statusLabel.Location = new Point(10, 230);
            _statusLabel.Size = new Size(ClientSize.Width - 20, 28);
            _statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _statusLabel.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
            _statusLabel.ForeColor = TextWhite;
            _statusLabel.Text = GetText("installing");
            _statusLabel.Visible = false;
            Controls.Add(_statusLabel);

            // Progress bar (200px x 4px)
            int trackWidth = 200;
            _progressBar.Location = new Point((ClientSize.Width - trackWidth) / 2, 268);
            _progressBar.Size = new Size(trackWidth, 4);
            _progressBar.Visible = false;
            Controls.Add(_progressBar);

            // Sub-status / detail label
            _subStatusLabel.Location = new Point(10, 292);
            _subStatusLabel.Size = new Size(ClientSize.Width - 20, 20);
            _subStatusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _subStatusLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            _subStatusLabel.ForeColor = TextMuted;
            _subStatusLabel.Text = "100% Offline • Windows 64-Bit";
            Controls.Add(_subStatusLabel);

            // Footer
            Label footerLabel = new Label
            {
                Location = new Point(10, 380),
                Size = new Size(ClientSize.Width - 20, 20),
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = TextSubtle,
                Text = "Strudelcode"
            };
            footerLabel.MouseDown += DragWindow;
            Controls.Add(footerLabel);
        }

        private string GetText(string key)
        {
            switch (key)
            {
                case "install":
                    if (_langCode == "fr") return "Installer";
                    if (_langCode == "es") return "Instalar";
                    if (_langCode == "en") return "Install";
                    return "Installieren";

                case "installing":
                    if (_langCode == "fr") return "Installation en cours...";
                    if (_langCode == "es") return "Instalando...";
                    if (_langCode == "en") return "Installing...";
                    return "Wird installiert...";

                case "setting_up":
                    if (_langCode == "fr") return "Configuration des fichiers...";
                    if (_langCode == "es") return "Configurando archivos...";
                    if (_langCode == "en") return "Setting up files...";
                    return "Dateien werden eingerichtet...";

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
            _statusLabel.Visible = true;
            _statusLabel.Text = GetText("installing");
            _progressBar.Visible = true;
            _progressBar.SetIndeterminate(0);
            _subStatusLabel.Text = GetText("setting_up");

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
            _currentPercent = Math.Max(0, Math.Min(100, pct));
            _progressBar.SetPercent(_currentPercent);
        }

        private async Task StartWorkflowAsync()
        {
            _failed = false;
            try
            {
                // Step 1: Check local setup file in current directory or temp
                string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidates = Directory.GetFiles(currentDir, "SOCDOF-Setup-*.exe", SearchOption.TopDirectoryOnly);
                if (candidates.Length > 0)
                {
                    _packagePath = candidates[0];
                    _subStatusLabel.Text = _langCode == "de" ? "Lokales Setup gefunden..." : "Local setup found...";
                }

                // Step 2: Download if not available locally
                if (string.IsNullOrEmpty(_packagePath) || !File.Exists(_packagePath))
                {
                    _subStatusLabel.Text = _langCode == "de" ? "Aktuellstes Release wird geladen..." : "Fetching latest release...";
                    _http.DefaultRequestHeaders.UserAgent.Clear();
                    _http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("SOCDOF-Installer", "1.0"));
                    _http.DefaultRequestHeaders.Accept.Clear();
                    _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));

                    string json = await _http.GetStringAsync("https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest");
                    var serializer = new JavaScriptSerializer();
                    var release = serializer.Deserialize<Dictionary<string, object>>(json);

                    string downloadUrl = null;
                    long expectedSize = 0;
                    var assets = release["assets"] as ArrayList;
                    if (assets != null)
                    {
                        foreach (object item in assets)
                        {
                            var asset = item as Dictionary<string, object>;
                            if (asset == null) continue;
                            string name = Convert.ToString(asset["name"]);
                            if (name.StartsWith("SOCDOF-Setup-", StringComparison.OrdinalIgnoreCase) && name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                            {
                                downloadUrl = Convert.ToString(asset["browser_download_url"]);
                                if (asset.ContainsKey("size")) long.TryParse(Convert.ToString(asset["size"]), out expectedSize);
                                break;
                            }
                        }
                    }

                    if (string.IsNullOrEmpty(downloadUrl))
                    {
                        throw new InvalidOperationException("No setup package found in latest release.");
                    }

                    _packagePath = Path.Combine(Path.GetTempPath(), "SOCDOF-Setup-" + Guid.NewGuid().ToString("N") + ".exe");
                    _subStatusLabel.Text = _langCode == "de" ? "Herunterladen..." : "Downloading...";

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

                // Step 3: Run silent installation
                Directory.CreateDirectory(_targetDir);
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = _packagePath,
                    Arguments = "/S /D=" + _targetDir,
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

                // Step 4: Installation complete -> Now show "Wird gestartet..."
                _statusLabel.Text = GetText("starting");
                _subStatusLabel.Text = GetText("opening");
                await Task.Delay(400);

                string appExe = Path.Combine(_targetDir, "SOCDOF.exe");
                if (File.Exists(appExe))
                {
                    Process.Start(new ProcessStartInfo(appExe) { UseShellExecute = true });
                }

                await Task.Delay(300);
                Application.Exit();
            }
            catch (Exception)
            {
                _failed = true;
                _isInstalling = false;
                _pulseTimer.Stop();
                _statusLabel.Text = GetText("failed");
                _subStatusLabel.Text = _langCode == "de" ? "Klicken zum Wiederholen" : "Click to retry";
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
