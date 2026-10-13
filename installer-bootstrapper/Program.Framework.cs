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
            ClientSize = new Size(620, 430);
            MinimumSize = new Size(620, 430);
            MaximumSize = new Size(620, 430);
            BackColor = bg;
            ForeColor = Color.White;
            ShowInTaskbar = true;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, Width + 1, Height + 1));
            Compose();
            Shown += async delegate { await DownloadLatestAsync(); };
            FormClosed += delegate { http.Dispose(); };
        }

        private void Compose()
        {
            Panel top = new Panel { Dock = DockStyle.Top, Height = 48, BackColor = bg };
            top.MouseDown += Drag;
            Controls.Add(top);
            PictureBox smallLogo = new PictureBox { Location = new Point(22, 13), Size = new Size(22, 22), SizeMode = PictureBoxSizeMode.Zoom, Image = Icon == null ? null : Icon.ToBitmap(), BackColor = Color.Transparent };
            top.Controls.Add(smallLogo);
            Label title = new Label { Text = "SOCDOF Setup", Location = new Point(52, 14), AutoSize = true, ForeColor = Color.FromArgb(226, 228, 235), Font = new Font("Segoe UI", 9.5f) };
            title.MouseDown += Drag;
            top.Controls.Add(title);
            Button close = new Button { Text = "×", Location = new Point(568, 6), Size = new Size(44, 36), FlatStyle = FlatStyle.Flat, BackColor = bg, ForeColor = Color.FromArgb(205, 207, 215), Font = new Font("Segoe UI", 16f), Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right };
            close.FlatAppearance.BorderSize = 0;
            close.FlatAppearance.MouseOverBackColor = Color.FromArgb(190, 55, 65);
            close.Click += delegate { Close(); };
            top.Controls.Add(close);

            Controls.Add(new PictureBox { Location = new Point(42, 78), Size = new Size(58, 58), SizeMode = PictureBoxSizeMode.Zoom, Image = Icon == null ? null : Icon.ToBitmap(), BackColor = Color.Transparent });
            Controls.Add(new Label { Text = "SOCDOF installieren", Location = new Point(118, 78), Size = new Size(440, 36), Font = new Font("Segoe UI Semibold", 20f, FontStyle.Bold), ForeColor = Color.White });
            version.SetBounds(120, 117, 440, 22);
            version.Font = new Font("Segoe UI", 9.5f);
            version.ForeColor = muted;
            version.Text = "Neueste Version wird gesucht …";
            Controls.Add(version);
            Controls.Add(new Panel { Location = new Point(36, 157), Size = new Size(548, 1), BackColor = Color.FromArgb(57, 59, 66) });

            status.SetBounds(40, 181, 530, 27);
            status.Font = new Font("Segoe UI Semibold", 11f, FontStyle.Bold);
            status.ForeColor = Color.FromArgb(240, 241, 246);
            status.Text = "Installation wird vorbereitet …";
            Controls.Add(status);
            detail.SetBounds(40, 211, 540, 36);
            detail.Font = new Font("Segoe UI", 9f);
            detail.ForeColor = muted;
            detail.Text = "SOCDOF wird sicher heruntergeladen und vorbereitet.";
            Controls.Add(detail);
            bar.SetBounds(40, 257, 540, 5);
            bar.Style = ProgressBarStyle.Marquee;
            bar.MarqueeAnimationSpeed = 25;
            bar.BackColor = panel;
            bar.ForeColor = accent;
            Controls.Add(bar);

            Controls.Add(new Label { Text = "INSTALLATIONSORDNER", Location = new Point(40, 286), AutoSize = true, Font = new Font("Segoe UI Semibold", 8f, FontStyle.Bold), ForeColor = muted });
            Panel pathPanel = new Panel { Location = new Point(40, 307), Size = new Size(540, 42), BackColor = panel, Padding = new Padding(12, 0, 0, 0) };
            Controls.Add(pathPanel);
            pathText.SetBounds(12, 0, 405, 42);
            pathText.Text = target;
            pathText.TextAlign = ContentAlignment.MiddleLeft;
            pathText.Font = new Font("Segoe UI", 9f);
            pathText.ForeColor = Color.FromArgb(224, 226, 234);
            pathText.AutoEllipsis = true;
            pathPanel.Controls.Add(pathText);
            browse.Text = "Ändern";
            browse.SetBounds(431, 6, 96, 30);
            browse.FlatStyle = FlatStyle.Flat;
            browse.FlatAppearance.BorderColor = Color.FromArgb(75, 78, 88);
            browse.BackColor = panel;
            browse.ForeColor = Color.White;
            browse.Font = new Font("Segoe UI Semibold", 9f, FontStyle.Bold);
            browse.Cursor = Cursors.Hand;
            browse.Click += Browse;
            pathPanel.Controls.Add(browse);

            install.Text = "Download wird vorbereitet …";
            install.SetBounds(40, 366, 540, 42);
            install.FlatStyle = FlatStyle.Flat;
            install.FlatAppearance.BorderSize = 0;
            install.BackColor = accent;
            install.ForeColor = Color.White;
            install.Font = new Font("Segoe UI Semibold", 10f, FontStyle.Bold);
            install.Cursor = Cursors.Hand;
            install.Enabled = false;
            install.Click += async delegate { if (installed) Launch(); else await InstallAsync(); };
            Controls.Add(install);
            Controls.Add(new Label { Text = "STRUDELCODE  ·  YURI", Location = new Point(40, 411), Size = new Size(540, 14), TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 7f, FontStyle.Bold), ForeColor = Color.FromArgb(103, 106, 117) });
        }

        private async Task DownloadLatestAsync()
        {
            State("Neueste Version wird gesucht …", "Verbindung zu GitHub wird hergestellt.", 0, true);
            install.Text = "Download wird vorbereitet …";
            install.Enabled = false;
            try
            {
                http.DefaultRequestHeaders.UserAgent.Clear();
                http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("SOCDOF-Installer", "1.0"));
                http.DefaultRequestHeaders.Accept.Clear();
                http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
                string json = await http.GetStringAsync("https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest");
                Dictionary<string, object> release = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
                version.Text = "Version " + Convert.ToString(release["tag_name"]) + " · Windows 64-Bit";
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
                if (String.IsNullOrEmpty(url)) throw new InvalidOperationException("Kein passendes SOCDOF-Setup im neuesten Release gefunden.");
                packagePath = Path.Combine(Path.GetTempPath(), "SOCDOF-Setup-" + Guid.NewGuid().ToString("N") + ".exe");
                State("SOCDOF wird heruntergeladen …", "Das Installationspaket wird im Hintergrund geladen.", 0, false);
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
                                bar.Value = pct;
                                detail.Text = "Installationspaket wird heruntergeladen … " + pct + "%";
                            }
                        }
                        await output.FlushAsync();
                    }
                }
                downloaded = true;
                State("Bereit zur Installation", "Sie können den Installationsordner noch ändern.", 100, false);
                install.Text = "Installation starten";
                install.Enabled = true;
            }
            catch (Exception ex)
            {
                State("Download nicht möglich", "Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.", 0, false);
                detail.Text = ex.Message.Length > 110 ? ex.Message.Substring(0, 110) + "…" : ex.Message;
                install.Text = "Erneut versuchen";
                install.Enabled = true;
            }
        }

        private void Browse(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Wählen Sie den übergeordneten Ordner für SOCDOF.";
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
            State("SOCDOF wird installiert …", "Die Anwendung wird eingerichtet. Bitte lassen Sie dieses Fenster geöffnet.", 0, true);
            try
            {
                Directory.CreateDirectory(target);
                ProcessStartInfo info = new ProcessStartInfo { FileName = packagePath, Arguments = "/S /D=" + target, UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
                using (Process process = Process.Start(info))
                {
                    if (process == null) throw new InvalidOperationException("Das Setup konnte nicht gestartet werden.");
                    await Task.Run(delegate { process.WaitForExit(); });
                    if (process.ExitCode != 0) throw new InvalidOperationException("Das Setup wurde mit Fehlercode " + process.ExitCode + " beendet.");
                }
                installed = true;
                State("Installation abgeschlossen", "SOCDOF wurde erfolgreich installiert.", 100, false);
                install.Text = "SOCDOF starten";
                install.Enabled = true;
            }
            catch (Exception ex)
            {
                State("Installation fehlgeschlagen", "Das Setup konnte nicht abgeschlossen werden.", 0, false);
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
                MessageBox.Show(this, "Die Anwendung wurde nicht gefunden:\n" + exe, "SOCDOF", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            try { Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true }); Close(); }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "SOCDOF konnte nicht gestartet werden", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }

        private void State(string heading, string description, int percent, bool marquee)
        {
            status.Text = heading;
            detail.Text = description;
            if (marquee) { bar.Style = ProgressBarStyle.Marquee; bar.MarqueeAnimationSpeed = 25; }
            else { bar.Style = ProgressBarStyle.Continuous; bar.MarqueeAnimationSpeed = 0; bar.Value = Math.Max(0, Math.Min(100, percent)); }
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
