const fs = require('fs');
const path = require('path');

function main() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const version = pkg.version || '1.0.0';

  const parts = version.split('.').map(p => parseInt(p, 10) || 0);
  const major = parts[0] || 1;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  const majorTag = `v${major}`;
  const versionTag = `v${version}`;

  // Major root releases are v19.0.0, v20.0.0, v21.0.0 (minor === 0 && patch === 0, no pre-tag)
  const isMajorRelease = (minor === 0 && patch === 0) && !version.includes('-');
  // Minor changes / patches (e.g. v20.0.9, v20.1.0, v20.1.1) or tagged builds are published as Prerelease
  const isPrerelease = !isMajorRelease || version.includes('-') || Boolean(pkg.prerelease);
  const makeLatest = isMajorRelease ? 'true' : 'false';

  // Search for version notes in versions/V<major>.md
  const versionDocPath = path.join(process.cwd(), 'versions', `V${major}.md`);
  let releaseBody = '';

  if (fs.existsSync(versionDocPath)) {
    const content = fs.readFileSync(versionDocPath, 'utf-8');
    const lines = content.split('\n');

    let capturing = false;
    const capturedLines = [];

    // Match "## Version v20.0.5" or "## Version 20.0.5"
    const startRegex = new RegExp(`^##\\s+Version\\s+v?${version.replace(/\./g, '\\.')}\\b`, 'i');

    for (const line of lines) {
      if (!capturing) {
        if (startRegex.test(line)) {
          capturing = true;
          capturedLines.push(line);
        }
      } else {
        // Stop capturing if we hit the next version header or separator
        if (/^##\s+Version\s+/i.test(line)) {
          break;
        }
        capturedLines.push(line);
      }
    }

    if (capturedLines.length > 0) {
      releaseBody = capturedLines.join('\n').trim();
    }
  }

  if (!releaseBody) {
    releaseBody = `## SOCDOF ${versionTag}\n\nAutomated build for SOCDOF ${versionTag}.`;
  }

  // Write release notes to file for GitHub Actions to use
  const releaseNotesPath = path.join(process.cwd(), 'release_notes.md');
  fs.writeFileSync(releaseNotesPath, releaseBody, 'utf-8');

  console.log(`[prepare-release] Version: ${version}`);
  console.log(`[prepare-release] Major Tag: ${majorTag}`);
  console.log(`[prepare-release] Version Tag: ${versionTag}`);
  console.log(`[prepare-release] Is Major Release: ${isMajorRelease}`);
  console.log(`[prepare-release] Is Prerelease: ${isPrerelease}`);
  console.log(`[prepare-release] Make Latest: ${makeLatest}`);
  console.log(`[prepare-release] Notes extracted (${releaseBody.length} chars) to release_notes.md`);

  // Write GitHub Actions step output if running in GHA
  if (process.env.GITHUB_OUTPUT) {
    const ghaOutput = [
      `version=${version}`,
      `major=${major}`,
      `major_tag=${majorTag}`,
      `version_tag=${versionTag}`,
      `is_major_release=${isMajorRelease}`,
      `is_prerelease=${isPrerelease}`,
      `make_latest=${makeLatest}`,
      `notes_file=${releaseNotesPath}`
    ].join('\n') + '\n';

    fs.appendFileSync(process.env.GITHUB_OUTPUT, ghaOutput, 'utf-8');
  }
}

main();
