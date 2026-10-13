using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace SOCDOF.Bootstrapper;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new InstallerForm());
    }
}

internal sealed class InstallerForm : Form
{
    private const string Repository = "Strudelcode/SOCDOF";
    private static readonly Color Background = Color.FromArgb(30, 31, 35);
    private static readonly Color Surface = Color.FromArgb(40, 42, 47);
    private static readonly Color Muted = Color.FromArgb(165, 168, 180);
    private static readonly Color Accent = Color.FromArgb(111, 126, 255);

    private readonly HttpClient http = new() { Timeout = TimeSpan.FromMinutes(10) };
    private readonly Label statusLabel = new();
    private readonly Label detailLabel = new();
    private readonly Label versionLabel = new();
    private readonly Label pathLabel = new();
    private readonly ProgressBar progress = new();
    private readonly Button installButton = new();
    private readonly Button changePathButton = new();
    private readonly Button closeButton = new();
    private string installDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SOCDOF");
    private string? installerPath;
    private bool downloadReady;
    private bool installationRunning;
    private bool installed;

    public InstallerForm()
    {
        Text = "SOCDOF Installer";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        ClientSize = new Size(620, 430);
        MinimumSize = new Size(620, 430);
        MaximumSize = new Size(620, 430);
        BackColor = Background;
        ForeColor = Color.White;
        ShowInTaskbar = true;
        DoubleBuffered = true;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 18, 18));

        BuildInterface();
        Shown += async (_, _) => await PrepareDownloadAsync();
        FormClosed += (_, _) => http.Dispose();
    }

    private void BuildInterface()
    {
        var titleBar = new Panel { Dock = DockStyle.Top, Height = 48, BackColor = Background };
        titleBar.MouseDown += DragWindow;
        Controls.Add(titleBar);

        var titleIcon = new PictureBox
        {
            Location = new Point(22, 13),
            Size = new Size(22, 22),
            SizeMode = PictureBoxSizeMode.Zoom,
            Image = Icon?.ToBitmap(),
            BackColor = Color.Transparent
        };
        titleBar.Controls.Add(titleIcon);

        var title = new Label
        {
            Text = "SOCDOF Setup",
            Location = new Point(52, 14),
            AutoSize = true,
            ForeColor = Color.FromArgb(226, 228, 235),
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular)
        };
        title.MouseDown += DragWindow;
        titleBar.Controls.Add(title);

        closeButton.Text = "×";
        closeButton.Size = new Size(44, 36);
        closeButton.Location = new Point(ClientSize.Width - 52, 6);
        closeButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        closeButton.FlatStyle = FlatStyle.Flat;
        closeButton.FlatAppearance.BorderSize = 0;
        closeButton.FlatAppearance.MouseOverBackColor = Color.FromArgb(190, 55, 65);
        closeButton.BackColor = Background;
        closeButton.ForeColor = Color.FromArgb(205, 207, 215);
        closeButton.Font = new Font("Segoe UI", 16f);
        closeButton.Cursor = Cursors.Hand;
        closeButton.Click += (_, _) => Close();
        titleBar.Controls.Add(closeButton);

        var logo = new PictureBox
        {
            Location = new Point(42, 78),
            Size = new Size(58, 58),
            SizeMode = PictureBoxSizeMode.Zoom,
            Image = Icon?.ToBitmap(),
            BackColor = Color.Transparent
        };
        Controls.Add(logo);

        var heading = new Label
        {
            Text = "SOCDOF installieren",
            Location = new Point(118, 78),
            Size = new Size(440, 36),
            Font = new Font("Segoe UI Semibold", 20f, FontStyle.Bold),
            ForeColor = Color.White
        };
        Controls.Add(heading);

        versionLabel.Text = "Neueste Version wird gesucht …";
        versionLabel.Location = new Point(120, 117);
        versionLabel.Size = new Size(440, 22);
        versionLabel.Font = new Font("Segoe UI", 9.5f);
        versionLabel.ForeColor = Muted;
        Controls.Add(versionLabel);

        Controls.Add(new Panel { Location = new Point(36, 157), Size = new Size(548, 1), BackColor = Color.FromArgb(57, 59, 66) });

        statusLabel.Text = "Installation wird vorbereitet …";
        statusLabel.Location = new Point(40, 181);
        statusLabel.Size = new Size(530, 27);
        statusLabel.Font = new Font("Segoe UI Semibold", 11f, FontStyle.Bold);
        statusLabel.ForeColor = Color.FromArgb(240, 241, 246);
        Controls.Add(statusLabel);

        detailLabel.Text = "SOCDOF wird sicher heruntergeladen und vorbereitet.";
        detailLabel.Location = new Point(40, 211);
        detailLabel.Size = new Size(540, 36);
        detailLabel.Font = new Font("Segoe UI", 9f);
        detailLabel.ForeColor = Muted;
        Controls.Add(detailLabel);

        progress.Location = new Point(40, 257);
        progress.Size = new Size(540, 5);
        progress.Style = ProgressBarStyle.Marquee;
        progress.MarqueeAnimationSpeed = 25;
        progress.Visible = true;
        progress.BackColor = Surface;
        progress.ForeColor = Accent;
        progress.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        Controls.Add(progress);

        Controls.Add(new Label
        {
            Text = "INSTALLATIONSORDNER",
            Location = new Point(40, 286),
            AutoSize = true,
            Font = new Font("Segoe UI Semibold", 8f, FontStyle.Bold),
            ForeColor = Muted
        });

        var pathPanel = new Panel
        {
            Location = new Point(40, 307),
            Size = new Size(540, 42),
            BackColor = Surface,
            Padding = new Padding(12, 0, 0, 0)
        };
        Controls.Add(pathPanel);

        pathLabel.Text = installDirectory;
        pathLabel.Location = new Point(12, 0);
        pathLabel.Size = new Size(405, 42);
        pathLabel.TextAlign = ContentAlignment.MiddleLeft;
        pathLabel.Font = new Font("Segoe UI", 9f);
        pathLabel.ForeColor = Color.FromArgb(224, 226, 234);
        pathLabel.AutoEllipsis = true;
        pathPanel.Controls.Add(pathLabel);

        changePathButton.Text = "Ändern";
        changePathButton.Location = new Point(431, 6);
        changePathButton.Size = new Size(96, 30);
        changePathButton.FlatStyle = FlatStyle.Flat;
        changePathButton.FlatAppearance.BorderColor = Color.FromArgb(75, 78, 88);
        changePathButton.FlatAppearance.MouseOverBackColor = Color.FromArgb(57, 60, 69);
        changePathButton.BackColor = Surface;
        changePathButton.ForeColor = Color.White;
        changePathButton.Font = new Font("Segoe UI Semibold", 9f, FontStyle.Bold);
        changePathButton.Cursor = Cursors.Hand;
        changePathButton.Click += ChangeInstallDirectory;
        pathPanel.Controls.Add(changePathButton);

        installButton.Text = "Download wird vorbereitet …";
        installButton.Location = new Point(40, 366);
        installButton.Size = new Size(540, 42);
        installButton.FlatStyle = FlatStyle.Flat;
        installButton.FlatAppearance.BorderSize = 0;
        installButton.BackColor = Accent;
        installButton.ForeColor = Color.White;
        installButton.Font = new Font("Segoe UI Semibold", 10f, FontStyle.Bold);
        installButton.Cursor = Cursors.Hand;
        installButton.Enabled = false;
        installButton.Click += async (_, _) =>
        {
            if (installed) LaunchApplication();
            else await InstallAsync();
        };
        Controls.Add(installButton);

        Controls.Add(new Label
        {
            Text = "STRUDELCODE  ·  YURI",
            Location = new Point(40, 411),
            Size = new Size(540, 14),
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 7f, FontStyle.Bold),
            ForeColor = Color.FromArgb(103, 106, 117)
        });
    }

    private async Task PrepareDownloadAsync()
    {
        SetStatus("Neueste Version wird gesucht …", "Verbindung zu GitHub wird hergestellt.", 0, marquee: true);
        installButton.Text = "Download wird vorbereitet …";
        installButton.Enabled = false;

        try
        {
            http.DefaultRequestHeaders.UserAgent.Clear();
            http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("SOCDOF-Installer", "1.0"));
            http.DefaultRequestHeaders.Accept.Clear();
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));

            using var releaseResponse = await http.GetAsync($"https://api.github.com/repos/{Repository}/releases/latest");
            releaseResponse.EnsureSuccessStatusCode();
            await using var releaseStream = await releaseResponse.Content.ReadAsStreamAsync();
            using var releaseJson = await JsonDocument.ParseAsync(releaseStream);
            var root = releaseJson.RootElement;
            var tag = root.TryGetProperty("tag_name", out var tagElement) ? tagElement.GetString() ?? "latest" : "latest";
            var assets = root.GetProperty("assets");
            string? downloadUrl = null;
            long expectedBytes = 0;

            foreach (var asset in assets.EnumerateArray())
            {
                var name = asset.GetProperty("name").GetString() ?? "";
                if (name.StartsWith("SOCDOF-Setup-", StringComparison.OrdinalIgnoreCase) &&
                    name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                {
                    downloadUrl = asset.GetProperty("browser_download_url").GetString();
                    expectedBytes = asset.TryGetProperty("size", out var sizeElement) ? sizeElement.GetInt64() : 0;
                    break;
                }
            }

            if (string.IsNullOrWhiteSpace(downloadUrl))
                throw new InvalidOperationException("Die neueste GitHub-Version enthält kein passendes SOCDOF-Setup.");

            versionLabel.Text = $"Version {tag} · Windows 64-Bit";
            installerPath = Path.Combine(Path.GetTempPath(), $"SOCDOF-Setup-{Guid.NewGuid():N}.exe");
            SetStatus("SOCDOF wird heruntergeladen …", "Das Installationspaket wird im Hintergrund geladen.", 0, marquee: false);
            progress.Style = ProgressBarStyle.Continuous;
            progress.Value = 0;

            using var response = await http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            var totalBytes = response.Content.Headers.ContentLength ?? expectedBytes;
            await using var input = await response.Content.ReadAsStreamAsync();
            await using var output = new FileStream(installerPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
            var buffer = new byte[81920];
            long received = 0;
            int read;
            while ((read = await input.ReadAsync(buffer)) > 0)
            {
                await output.WriteAsync(buffer.AsMemory(0, read));
                received += read;
                if (totalBytes > 0)
                {
                    var percent = (int)Math.Clamp(received * 100L / totalBytes, 0, 100);
                    progress.Value = percent;
                    detailLabel.Text = $"Installationspaket wird heruntergeladen … {percent}%";
                }
            }
            await output.FlushAsync();

            downloadReady = true;
            SetStatus("Bereit zur Installation", "Wählen Sie bei Bedarf einen anderen Ordner und starten Sie die Installation.", 100, marquee: false);
            installButton.Text = "Installation starten";
            installButton.Enabled = true;
        }
        catch (Exception ex)
        {
            SetStatus("Download nicht möglich", "Prüfen Sie die Internetverbindung und versuchen Sie es erneut.", 0, marquee: false);
            detailLabel.Text = ex.Message.Length > 100 ? ex.Message[..100] + "…" : ex.Message;
            installButton.Text = "Erneut versuchen";
            installButton.Enabled = true;
            downloadReady = false;
        }
    }

    private void ChangeInstallDirectory(object? sender, EventArgs e)
    {
        using var picker = new FolderBrowserDialog
        {
            Description = "Wählen Sie den übergeordneten Ordner für SOCDOF.",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true,
            SelectedPath = Path.GetDirectoryName(installDirectory) ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
        };
        if (picker.ShowDialog(this) == DialogResult.OK)
        {
            installDirectory = Path.Combine(picker.SelectedPath, "SOCDOF");
            pathLabel.Text = installDirectory;
        }
    }

    private async Task InstallAsync()
    {
        if (!downloadReady)
        {
            await PrepareDownloadAsync();
            return;
        }
        if (installationRunning || string.IsNullOrWhiteSpace(installerPath) || !File.Exists(installerPath)) return;

        installationRunning = true;
        installButton.Enabled = false;
        changePathButton.Enabled = false;
        SetStatus("SOCDOF wird installiert …", "Die Anwendung wird eingerichtet. Bitte lassen Sie dieses Fenster geöffnet.", 0, marquee: true);

        try
        {
            Directory.CreateDirectory(installDirectory);
            var startInfo = new ProcessStartInfo
            {
                FileName = installerPath,
                Arguments = $"/S /D={installDirectory}",
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(installerPath) ?? Path.GetTempPath()
            };
            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Das Setup konnte nicht gestartet werden.");
            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
                throw new InvalidOperationException($"Das Setup wurde mit Fehlercode {process.ExitCode} beendet.");

            installed = true;
            SetStatus("Installation abgeschlossen", "SOCDOF wurde erfolgreich installiert.", 100, marquee: false);
            installButton.Text = "SOCDOF starten";
            installButton.Enabled = true;
            changePathButton.Enabled = true;
        }
        catch (Exception ex)
        {
            SetStatus("Installation fehlgeschlagen", "Das Setup konnte nicht abgeschlossen werden.", 0, marquee: false);
            detailLabel.Text = ex.Message.Length > 120 ? ex.Message[..120] + "…" : ex.Message;
            installButton.Text = "Erneut versuchen";
            installButton.Enabled = true;
            changePathButton.Enabled = true;
            downloadReady = File.Exists(installerPath);
        }
        finally
        {
            installationRunning = false;
        }
    }

    private void LaunchApplication()
    {
        var executable = Path.Combine(installDirectory, "SOCDOF.exe");
        if (!File.Exists(executable))
        {
            MessageBox.Show(this, $"Die Anwendung wurde nicht gefunden:\n{executable}", "SOCDOF", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        try
        {
            Process.Start(new ProcessStartInfo(executable) { UseShellExecute = true });
            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "SOCDOF konnte nicht gestartet werden", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void SetStatus(string title, string detail, int percent, bool marquee)
    {
        statusLabel.Text = title;
        detailLabel.Text = detail;
        if (marquee)
        {
            progress.Style = ProgressBarStyle.Marquee;
            progress.MarqueeAnimationSpeed = 25;
        }
        else
        {
            progress.Style = ProgressBarStyle.Continuous;
            progress.MarqueeAnimationSpeed = 0;
            progress.Value = Math.Clamp(percent, 0, 100);
        }
    }

    private static void DragWindow(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        var control = (Control?)sender;
        var form = control?.FindForm();
        if (form is null) return;
        ReleaseCapture();
        SendMessage(form.Handle, 0xA1, 0x2, 0);
    }

    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);
}
