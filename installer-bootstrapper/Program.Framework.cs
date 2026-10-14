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
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SOCDOF.Bootstrapper
{
    internal static class FrameworkProgram
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new DiscordStyleInstallerWindow());
        }
    }

    /// <summary>
    /// Frameless, sleek Discord-like installer window.
    /// Pure, minimalist design: Centered SOCDOF icon, clean status text ("Installing..."),
    /// smooth micro progress bar, and instant launch upon completion.
    /// </summary>
    internal sealed class DiscordStyleInstallerWindow : Form
    {
        private static readonly Color DarkBackground = Color.FromArgb(32, 34, 37); // Discord #202225 / #232428
        private static readonly Color TrackColor = Color.FromArgb(50, 53, 59);
        private static readonly Color AccentColor = Color.FromArgb(88, 101, 242); // Discord blurple / Indigo
        private static readonly Color TextColor = Color.FromArgb(242, 243, 245);

        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        private readonly System.Windows.Forms.Timer _pulseTimer = new System.Windows.Forms.Timer();
        private readonly Label _statusLabel = new Label();
        private readonly Panel _progressTrack = new Panel();
        private readonly Panel _progressBar = new Panel();
        private readonly PictureBox _logoBox = new PictureBox();

        private readonly string _targetDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "SOCDOF"
        );

        private string _packagePath;
        private bool _isGerman;
        private bool _failed;
        private double _pulseStep;
        private int _currentPercent;

        public DiscordStyleInstallerWindow()
        {
            Text = "SOCDOF Installer";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            ClientSize = new Size(310, 380);
            MinimumSize = new Size(310, 380);
            MaximumSize = new Size(310, 380);
            BackColor = DarkBackground;
            ForeColor = TextColor;
            ShowInTaskbar = true;
            DoubleBuffered = true;

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            // Rounded corners (18px radius)
            Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 18, 18));

            string cultureName = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant();
            _isGerman = cultureName == "de";

            BuildUI();

            _pulseTimer.Interval = 35;
            _pulseTimer.Tick += OnPulseTick;
            _pulseTimer.Start();

            MouseDown += DragWindow;
            _logoBox.MouseDown += DragWindow;
            _statusLabel.MouseDown += DragWindow;

            Shown += async delegate { await StartWorkflowAsync(); };
            FormClosed += delegate
            {
                _pulseTimer.Stop();
                _http.Dispose();
            };
        }

        private void BuildUI()
        {
            // 1. Centered App Logo
            _logoBox.Location = new Point((ClientSize.Width - 80) / 2, 100);
            _logoBox.Size = new Size(80, 80);
            _logoBox.SizeMode = PictureBoxSizeMode.Zoom;
            _logoBox.BackColor = Color.Transparent;
            if (Icon != null)
            {
                _logoBox.Image = Icon.ToBitmap();
            }
            Controls.Add(_logoBox);

            // 2. Centered Status Label (e.g. "Installing..." / "Wird installiert...")
            _statusLabel.Location = new Point(15, 215);
            _statusLabel.Size = new Size(ClientSize.Width - 30, 28);
            _statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _statusLabel.Font = new Font("Segoe UI", 12.5f, FontStyle.Regular);
            _statusLabel.ForeColor = TextColor;
            _statusLabel.Text = _isGerman ? "Wird installiert..." : "Installing...";
            Controls.Add(_statusLabel);

            // 3. Sleek minimal progress track (140px wide, 3px high)
            int trackWidth = 140;
            _progressTrack.Location = new Point((ClientSize.Width - trackWidth) / 2, 256);
            _progressTrack.Size = new Size(trackWidth, 3);
            _progressTrack.BackColor = TrackColor;
            Controls.Add(_progressTrack);

            _progressBar.Location = new Point(0, 0);
            _progressBar.Size = new Size(20, 3);
            _progressBar.BackColor = AccentColor;
            _progressTrack.Controls.Add(_progressBar);
        }

        private void OnPulseTick(object sender, EventArgs e)
        {
            _pulseStep += 0.08;
            if (_pulseStep > Math.PI * 2) _pulseStep -= Math.PI * 2;

            // Indeterminate wave when percentage is 0 or preparing
            if (_currentPercent <= 0 && !_failed)
            {
                int trackW = _progressTrack.Width;
                int barW = 45;
                double wave = (Math.Sin(_pulseStep) + 1.0) / 2.0; // 0.0 to 1.0
                int newX = (int)(wave * (trackW - barW));
                _progressBar.SetBounds(newX, 0, barW, 3);
            }
        }

        private void SetPercent(int pct)
        {
            _currentPercent = Math.Max(0, Math.Min(100, pct));
            int trackW = _progressTrack.Width;
            int barW = (int)(trackW * (_currentPercent / 100.0));
            _progressBar.SetBounds(0, 0, Math.Max(4, barW), 3);
        }

        private async Task StartWorkflowAsync()
        {
            _failed = false;
            _statusLabel.Text = _isGerman ? "Wird installiert..." : "Installing...";

            try
            {
                // Step 1: Look for local bundled setup in same directory or temp
                string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidates = Directory.GetFiles(currentDir, "SOCDOF-Setup-*.exe", SearchOption.TopDirectoryOnly);
                if (candidates.Length > 0)
                {
                    _packagePath = candidates[0];
                }

                // Step 2: If not found locally, fetch latest GitHub release
                if (string.IsNullOrEmpty(_packagePath) || !File.Exists(_packagePath))
                {
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
                                }
                            }
                            await output.FlushAsync();
                        }
                    }
                }

                SetPercent(100);

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

                // Step 4: Show "Starting..." and launch SOCDOF.exe
                _statusLabel.Text = _isGerman ? "Wird gestartet..." : "Starting...";
                await Task.Delay(400);

                string appExe = Path.Combine(_targetDir, "SOCDOF.exe");
                if (File.Exists(appExe))
                {
                    Process.Start(new ProcessStartInfo(appExe) { UseShellExecute = true });
                }

                await Task.Delay(300);
                Application.Exit();
            }
            catch (Exception ex)
            {
                _failed = true;
                _statusLabel.Text = _isGerman ? "Klicken zum Wiederholen" : "Click to retry";
                _statusLabel.Cursor = Cursors.Hand;
                _statusLabel.Click += async delegate { await StartWorkflowAsync(); };
                Click += async delegate { await StartWorkflowAsync(); };
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
