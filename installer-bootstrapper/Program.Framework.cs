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
    /// Frameless, sleek Discord-like installer window.
    /// Pure, minimalist design:
    /// - Centered high-resolution SOCDOF logo
    /// - Discord-dark theme (#202225) with smooth rounded corners
    /// - Clean "Installieren" / "Install" button
    /// - Seamless transition to "Wird installiert..." with animated micro-progress bar
    /// - Transition to "Wird gestartet..." on completion and instant app launch
    /// </summary>
    internal sealed class DiscordStyleInstallerWindow : Form
    {
        private static readonly Color DarkBackground = Color.FromArgb(32, 34, 37); // Discord #202225
        private static readonly Color DarkSurface = Color.FromArgb(43, 45, 49);     // Discord #2b2d31
        private static readonly Color TrackColor = Color.FromArgb(53, 55, 60);       // Discord #35373c
        private static readonly Color Blurple = Color.FromArgb(88, 101, 242);       // Discord Blurple #5865F2
        private static readonly Color BlurpleHover = Color.FromArgb(71, 82, 196);   // #4752C4
        private static readonly Color TextWhite = Color.FromArgb(242, 243, 245);
        private static readonly Color TextMuted = Color.FromArgb(148, 155, 164);
        private static readonly Color TextSubtle = Color.FromArgb(114, 118, 125);

        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        private readonly System.Windows.Forms.Timer _pulseTimer = new System.Windows.Forms.Timer();
        private readonly PictureBox _logoBox = new PictureBox();
        private readonly Label _titleLabel = new Label();
        private readonly Label _badgeLabel = new Label();
        private readonly Label _statusLabel = new Label();
        private readonly Label _subStatusLabel = new Label();
        private readonly Button _installButton = new Button();
        private readonly Label _closeButton = new Label();
        private readonly Panel _progressTrack = new Panel();
        private readonly Panel _progressBar = new Panel();

        private readonly string _targetDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "SOCDOF"
        );

        private readonly bool _autoStart;
        private string _packagePath;
        private bool _isGerman;
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

            string cultureName = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant();
            _isGerman = cultureName == "de";

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

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
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
            _closeButton.Font = new Font("Segoe UI", 10.5f, FontStyle.Regular);
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
            _logoBox.BackColor = Color.Transparent;
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

            // Badge: DESKTOP SUITE
            _badgeLabel.Location = new Point((ClientSize.Width - 130) / 2, 180);
            _badgeLabel.Size = new Size(130, 22);
            _badgeLabel.TextAlign = ContentAlignment.MiddleCenter;
            _badgeLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            _badgeLabel.ForeColor = Color.FromArgb(168, 179, 250);
            _badgeLabel.BackColor = DarkSurface;
            _badgeLabel.Text = "DESKTOP SUITE";
            Controls.Add(_badgeLabel);

            // Primary Discord-Style "Installieren" Button
            _installButton.Location = new Point(45, 235);
            _installButton.Size = new Size(ClientSize.Width - 90, 44);
            _installButton.FlatStyle = FlatStyle.Flat;
            _installButton.FlatAppearance.BorderSize = 0;
            _installButton.BackColor = Blurple;
            _installButton.ForeColor = Color.White;
            _installButton.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            _installButton.Text = _isGerman ? "Installieren" : "Install";
            _installButton.Cursor = Cursors.Hand;
            _installButton.MouseEnter += delegate { _installButton.BackColor = BlurpleHover; };
            _installButton.MouseLeave += delegate { _installButton.BackColor = Blurple; };
            _installButton.Click += async delegate { await BeginInstallationAsync(); };
            Controls.Add(_installButton);

            // Status label (shown during installation: "Wird installiert...")
            _statusLabel.Location = new Point(10, 232);
            _statusLabel.Size = new Size(ClientSize.Width - 20, 26);
            _statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _statusLabel.Font = new Font("Segoe UI", 12f, FontStyle.Regular);
            _statusLabel.ForeColor = TextWhite;
            _statusLabel.Text = _isGerman ? "Wird installiert..." : "Installing...";
            _statusLabel.Visible = false;
            Controls.Add(_statusLabel);

            // Progress track (200px x 4px)
            int trackWidth = 200;
            _progressTrack.Location = new Point((ClientSize.Width - trackWidth) / 2, 266);
            _progressTrack.Size = new Size(trackWidth, 4);
            _progressTrack.BackColor = TrackColor;
            _progressTrack.Visible = false;
            Controls.Add(_progressTrack);

            _progressBar.Location = new Point(0, 0);
            _progressBar.Size = new Size(30, 4);
            _progressBar.BackColor = Blurple;
            _progressTrack.Controls.Add(_progressBar);

            // Sub-status / detail label (e.g. "100% Offline • Windows 64-Bit")
            _subStatusLabel.Location = new Point(10, 290);
            _subStatusLabel.Size = new Size(ClientSize.Width - 20, 20);
            _subStatusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _subStatusLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            _subStatusLabel.ForeColor = TextMuted;
            _subStatusLabel.Text = _isGerman ? "100% Offline • Windows 64-Bit" : "100% Offline • Windows 64-Bit";
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

        private async Task BeginInstallationAsync()
        {
            if (_isInstalling) return;
            _isInstalling = true;

            // Transition UI from button to progress
            _installButton.Visible = false;
            _statusLabel.Visible = true;
            _statusLabel.Text = _isGerman ? "Wird installiert..." : "Installing...";
            _progressTrack.Visible = true;
            _subStatusLabel.Text = _isGerman ? "Dateien werden eingerichtet..." : "Setting up files...";

            _pulseTimer.Start();
            await StartWorkflowAsync();
        }

        private void OnPulseTick(object sender, EventArgs e)
        {
            _pulseStep += 0.08;
            if (_pulseStep > Math.PI * 2) _pulseStep -= Math.PI * 2;

            if (_currentPercent <= 0 && !_failed && _isInstalling)
            {
                int trackW = _progressTrack.Width;
                int barW = 55;
                double wave = (Math.Sin(_pulseStep) + 1.0) / 2.0;
                int newX = (int)(wave * (trackW - barW));
                _progressBar.SetBounds(newX, 0, barW, 4);
            }
        }

        private void SetPercent(int pct)
        {
            _currentPercent = Math.Max(0, Math.Min(100, pct));
            int trackW = _progressTrack.Width;
            int barW = (int)(trackW * (_currentPercent / 100.0));
            _progressBar.SetBounds(0, 0, Math.Max(4, barW), 4);
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
                    _subStatusLabel.Text = _isGerman ? "Lokales Setup gefunden..." : "Local setup found...";
                }

                // Step 2: Download if not available locally
                if (string.IsNullOrEmpty(_packagePath) || !File.Exists(_packagePath))
                {
                    _subStatusLabel.Text = _isGerman ? "Aktuellstes Release wird geladen..." : "Fetching latest release...";
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
                    _subStatusLabel.Text = _isGerman ? "Herunterladen..." : "Downloading...";

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
                                    _subStatusLabel.Text = string.Format(_isGerman ? "Herunterladen... {0}%" : "Downloading... {0}%", pct);
                                }
                            }
                            await output.FlushAsync();
                        }
                    }
                }

                SetPercent(100);
                _subStatusLabel.Text = _isGerman ? "Installation wird abgeschlossen..." : "Completing setup...";

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
                _statusLabel.Text = _isGerman ? "Wird gestartet..." : "Starting...";
                _subStatusLabel.Text = _isGerman ? "SOCDOF Desktop öffnet sich..." : "Opening SOCDOF Desktop...";
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
                _statusLabel.Text = _isGerman ? "Installation fehlgeschlagen" : "Installation failed";
                _subStatusLabel.Text = _isGerman ? "Klicken zum Wiederholen" : "Click to retry";
                _installButton.Text = _isGerman ? "Wiederholen" : "Retry";
                _installButton.Visible = true;
                _progressTrack.Visible = false;
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
