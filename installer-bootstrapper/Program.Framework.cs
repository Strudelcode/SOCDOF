using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
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
            Application.Run(new SetupWindow());
        }
    }

    internal sealed class SetupWindow : Form
    {
        private readonly Color bg = Color.FromArgb(30, 31, 35);
        private readonly Color panel = Color.FromArgb(40, 42, 47);
        private readonly Color muted = Color.FromArgb(165, 168, 180);
        private readonly Color accent = Color.FromArgb(111, 126, 255);
        private readonly HttpClient http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        private readonly Label status = new Label();
        private readonly Label detail = new Label();
        private readonly Label version = new Label();
        private readonly Label pathText = new Label();
        private readonly ProgressBar bar = new ProgressBar();
        private readonly Button install = new Button();
        private readonly Button browse = new Button();
        private string target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SOCDOF");
        private string packagePath;
        private bool downloaded;
        private bool installing;
        private bool installed;

        public SetupWindow()
        {
            Text = "SOCDOF Installer";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            ClientSize = new Size(700, 500);
            MinimumSize = new Size(700, 500);
            MaximumSize = new Size(700, 500);
            AutoScaleMode = AutoScaleMode.Dpi;
            BackColor = bg;
            ForeColor = Color.White;
            ShowInTaskbar = true;
            DoubleBuffered = true;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 18, 18));
            Compose();
            Shown += async delegate { await DownloadLatestAsync(); };
            FormClosed += delegate { http.Dispose(); };
        }

        private void Compose()
        {
            Panel top = new Panel { Dock = DockStyle.Top, Height = 54, BackColor = Color.FromArgb(25, 26, 30) };
            top.MouseDown += Drag;
            Controls.Add(top);
            PictureBox smallLogo = new PictureBox { Location = new Point(24, 16), Size = new Size(22, 22), SizeMode = PictureBoxSizeMode.Zoom, Image = Icon == null ? null : Icon.ToBitmap(), BackColor = Color.Transparent };
            top.Controls.Add(smallLogo);
            Label title = new Label { Text = "SOCDOF", Location = new Point(56, 15), AutoSize = true, ForeColor = Color.FromArgb(226, 228, 235), Font = new Font("Segoe UI", 10f) };
            title.MouseDown += Drag;
            top.Controls.Add(title);
            Button close = new Button { Text = "×", Location = new Point(646, 7), Size = new Size(42, 38), FlatStyle = FlatStyle.Flat, BackColor = top.BackColor, ForeColor = Color.FromArgb(190, 193, 204), Font = new Font("Segoe UI Light", 19f), Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right };
            close.FlatAppearance.BorderSize = 0;
            close.FlatAppearance.MouseOverBackColor = Color.FromArgb(190, 55, 65);
            close.Click += delegate { Close(); };
            top.Controls.Add(close);

            Panel content = new Panel { Location = new Point(32, 76), Size = new Size(636, 392), BackColor = bg };
            Controls.Add(content);
            Panel brandMark = new Panel { Location = new Point(0, 4), Size = new Size(4, 56), BackColor = accent };
            content.Controls.Add(brandMark);
            content.Controls.Add(new Label { Text = "SOCDOF", Location = new Point(20, 0), Size = new Size(500, 43), Font = new Font("Segoe UI Semibold", 25f, FontStyle.Bold), ForeColor = Color.White });
            content.Controls.Add(new Label { Text = "DESKTOP · WINDOWS 64-BIT", Location = new Point(23, 43), Size = new Size(450, 20), Font = new Font("Segoe UI", 9f), ForeColor = muted });
            version.SetBounds(23, 69, 570, 22);
            version.Font = new Font("Segoe UI", 9.5f);
            version.ForeColor = Color.FromArgb(190, 193, 204);
            version.Text = "Searching for the latest version...";
            content.Controls.Add(version);

            Panel card = new Panel { Location = new Point(0, 108), Size = new Size(636, 171), BackColor = panel };
            content.Controls.Add(card);
            status.SetBounds(22, 20, 590, 30);
            status.Font = new Font("Segoe UI Semibold", 13f, FontStyle.Bold);
            status.ForeColor = Color.FromArgb(245, 246, 250);
            status.Text = "Preparing installation...";
            card.Controls.Add(status);
            detail.SetBounds(22, 55, 590, 38);
            detail.Font = new Font("Segoe UI", 9.5f);
            detail.ForeColor = muted;
            detail.Text = "SOCDOF will be downloaded and prepared securely.";
            card.Controls.Add(detail);

            Panel track = new Panel { Location = new Point(22, 109), Size = new Size(590, 5), BackColor = Color.FromArgb(57, 59, 68) };
            card.Controls.Add(track);
            bar.SetBounds(0, 0, 0, 5);
            bar.Style = ProgressBarStyle.Continuous;
            bar.MarqueeAnimationSpeed = 0;
            bar.BackColor = accent;
            bar.ForeColor = accent;
            track.Controls.Add(bar);
            bar.Tag = track;
            bar.Size = new Size(0, 5);

            Label pathHeading = new Label { Text = "INSTALLATION LOCATION", Location = new Point(0, 270), Size = new Size(300, 18), Font = new Font("Segoe UI Semibold", 8.5f, FontStyle.Bold), ForeColor = muted };
            content.Controls.Add(pathHeading);
            Panel pathPanel = new Panel { Location = new Point(0, 294), Size = new Size(636, 48), BackColor = panel };
            content.Controls.Add(pathPanel);
            pathText.SetBounds(16, 0, 475, 48);
            pathText.Text = target;
            pathText.TextAlign = ContentAlignment.MiddleLeft;
            pathText.Font = new Font("Segoe UI", 9.5f);
            pathText.ForeColor = Color.FromArgb(230, 232, 239);
            pathText.AutoEllipsis = true;
            pathPanel.Controls.Add(pathText);
            browse.Text = "Change";
            browse.SetBounds(520, 8, 104, 32);
            browse.FlatStyle = FlatStyle.Flat;
            browse.FlatAppearance.BorderSize = 0;
            browse.BackColor = Color.FromArgb(55, 58, 67);
            browse.ForeColor = Color.White;
            browse.Font = new Font("Segoe UI Semibold", 9f, FontStyle.Bold);
            browse.Cursor = Cursors.Hand;
            browse.Click += Browse;
            pathPanel.Controls.Add(browse);

            install.Text = "Preparing download...";
            install.SetBounds(32, 432, 636, 44);
            install.FlatStyle = FlatStyle.Flat;
            install.FlatAppearance.BorderSize = 0;
            install.BackColor = accent;
            install.ForeColor = Color.FromArgb(17, 20, 37);
            install.Font = new Font("Segoe UI Semibold", 11f, FontStyle.Bold);
            install.Cursor = Cursors.Hand;
            install.Enabled = false;
            install.Click += async delegate { if (installed) Launch(); else await InstallAsync(); };
            install.MouseEnter += delegate { if (install.Enabled) install.BackColor = Color.FromArgb(133, 145, 255); };
            install.MouseLeave += delegate { install.BackColor = accent; };
            Controls.Add(install);
            Controls.Add(new Label { Text = "STRUDELCODE  /  SOCDOF", Location = new Point(32, 480), Size = new Size(636, 14), TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 7.5f), ForeColor = Color.FromArgb(105, 109, 122) });
        }

        private async Task DownloadLatestAsync()
        {
            State("Searching for the latest version...", "Connecting to GitHub.", 0, true);
            install.Text = "Preparing download...";
            install.Enabled = false;
            try
            {
                http.DefaultRequestHeaders.UserAgent.Clear();
                http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("SOCDOF-Installer", "1.0"));
                http.DefaultRequestHeaders.Accept.Clear();
                http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
                string json = await http.GetStringAsync("https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest");
                Dictionary<string, object> release = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
                version.Text = "Version " + Convert.ToString(release["tag_name"]) + " · Windows 64-bit";
                string url = null;
                long size = 0;
                ArrayList assets = release["assets"] as ArrayList;
                if (assets != null)
                {
                    foreach (object item in assets)
                    {
                        Dictionary<string, object> asset = item as Dictionary<string, object>;
                        if (asset == null) continue;
                        string name = Convert.ToString(asset["name"]);
                        if (name.StartsWith("SOCDOF-Setup-", StringComparison.OrdinalIgnoreCase) && name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                        {
                            url = Convert.ToString(asset["browser_download_url"]);
                            if (asset.ContainsKey("size")) long.TryParse(Convert.ToString(asset["size"]), out size);
                            break;
                        }
                    }
                }
                if (String.IsNullOrEmpty(url)) throw new InvalidOperationException("No compatible SOCDOF setup was found in the latest release.");
                packagePath = Path.Combine(Path.GetTempPath(), "SOCDOF-Setup-" + Guid.NewGuid().ToString("N") + ".exe");
                State("Downloading SOCDOF...", "The installation package is downloading in the background.", 0, false);
                using (HttpResponseMessage response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    long total = response.Content.Headers.ContentLength.HasValue ? response.Content.Headers.ContentLength.Value : size;
                    using (Stream input = await response.Content.ReadAsStreamAsync())
                    using (FileStream output = new FileStream(packagePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
                    {
                        byte[] buffer = new byte[81920];
                        long got = 0;
                        int read;
                        while ((read = await input.ReadAsync(buffer, 0, buffer.Length)) > 0)
                        {
                            await output.WriteAsync(buffer, 0, read);
                            got += read;
                            if (total > 0)
                            {
                                int pct = (int)Math.Max(0, Math.Min(100, got * 100L / total));
                                SetProgress(pct);
                                detail.Text = "Downloading installation package... " + pct + "%";
                            }
                        }
                        await output.FlushAsync();
                    }
                }
                downloaded = true;
                State("Ready to install", "You can still change the installation location.", 100, false);
                install.Text = "Install SOCDOF";
                install.Enabled = true;
            }
            catch (Exception ex)
            {
                State("Download failed", "Check your internet connection and try again.", 0, false);
                detail.Text = ex.Message.Length > 110 ? ex.Message.Substring(0, 110) + "…" : ex.Message;
                install.Text = "Try again";
                install.Enabled = true;
            }
        }

        private void Browse(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Choose the parent folder for SOCDOF.";
                dialog.ShowNewFolderButton = true;
                dialog.SelectedPath = Path.GetDirectoryName(target);
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    target = Path.Combine(dialog.SelectedPath, "SOCDOF");
                    pathText.Text = target;
                }
            }
        }

        private async Task InstallAsync()
        {
            if (!downloaded) { await DownloadLatestAsync(); return; }
            if (installing || String.IsNullOrEmpty(packagePath) || !File.Exists(packagePath)) return;
            installing = true;
            install.Enabled = false;
            browse.Enabled = false;
            State("Installing SOCDOF...", "Setting up the application. Please keep this window open.", 0, true);
            try
            {
                Directory.CreateDirectory(target);
                ProcessStartInfo info = new ProcessStartInfo { FileName = packagePath, Arguments = "/S /D=" + target, UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
                using (Process process = Process.Start(info))
                {
                    if (process == null) throw new InvalidOperationException("The setup could not be started.");
                    await Task.Run(delegate { process.WaitForExit(); });
                    if (process.ExitCode != 0) throw new InvalidOperationException("Setup exited with error code " + process.ExitCode + ".");
                }
                installed = true;
                State("Installation complete", "SOCDOF was installed successfully.", 100, false);
                install.Text = "Launch SOCDOF";
                install.Enabled = true;
            }
            catch (Exception ex)
            {
                State("Installation failed", "Setup could not be completed.", 0, false);
                detail.Text = ex.Message.Length > 110 ? ex.Message.Substring(0, 110) + "…" : ex.Message;
                install.Text = "Erneut versuchen";
                install.Enabled = true;
            }
            finally { installing = false; browse.Enabled = true; }
        }

        private void Launch()
        {
            string exe = Path.Combine(target, "SOCDOF.exe");
            if (!File.Exists(exe))
            {
                MessageBox.Show(this, "The application could not be found:\n" + exe, "SOCDOF", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            try { Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true }); Close(); }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "Could not launch SOCDOF", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }

        private void State(string heading, string description, int percent, bool marquee)
        {
            status.Text = heading;
            detail.Text = description;
            if (marquee) { bar.Style = ProgressBarStyle.Marquee; bar.MarqueeAnimationSpeed = 25; bar.Width = ((Panel)bar.Tag).Width; }
            else { bar.Style = ProgressBarStyle.Continuous; bar.MarqueeAnimationSpeed = 0; SetProgress(percent); }
        }

        private void SetProgress(int percent)
        {
            Panel track = bar.Tag as Panel;
            if (track == null) return;
            bar.Width = (int)(track.Width * (Math.Max(0, Math.Min(100, percent)) / 100.0));
            bar.Height = track.Height;
            bar.Left = 0;
            bar.Top = 0;
            bar.BackColor = accent;
        }

        private static void Drag(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            Control c = sender as Control;
            Form f = c == null ? null : c.FindForm();
            if (f == null) return;
            ReleaseCapture();
            SendMessage(f.Handle, 0xA1, 0x2, 0);
        }

        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        [DllImport("gdi32.dll")] private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);
    }
}
