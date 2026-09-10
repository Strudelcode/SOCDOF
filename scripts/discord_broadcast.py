#!/usr/bin/env python3
"""
Discord Broadcast & Changelog Reset Script for SOCDOF
-----------------------------------------------------
- Broadcasts accumulated pending updates from CHANGELOG.md to the Discord Webhook.
- Ensures messages are concise, high-level (Neu / Geändert / Behoben), and within Discord limits.
- Automatically resets CHANGELOG.md after sending to prevent spamming on future commits/pushes.
- Skips broadcast gracefully if CHANGELOG.md is empty (no pending updates).
"""

import os
import re
import sys
import json
import time
import urllib.request
import urllib.error

RESET_TEMPLATE = """# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->
"""

def extract_meaningful_content(raw_text: str) -> str:
    # Strip HTML-style comments <!-- ... -->
    text_without_comments = re.sub(r'<!--.*?-->', '', raw_text, flags=re.DOTALL)
    
    lines = []
    for line in text_without_comments.split('\n'):
        trimmed = line.strip()
        # Skip the primary header line if it's just the default header
        if trimmed.startswith('# 📝 Pending Updates') or trimmed.startswith('# Pending Updates') or trimmed == '# Changelog':
            continue
        lines.append(line)
    
    cleaned = '\n'.join(lines).strip()
    return cleaned

def set_github_output(name: str, value: str):
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path and os.path.exists(output_path):
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"{name}={value}\n")

def get_pkg_version() -> str:
    pkg_path = os.path.join(os.getcwd(), "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                v = data.get("version", "")
                if v:
                    return f"v{v}" if not v.startswith("v") else v
        except Exception:
            pass
    return "vLatest"

def main():
    raw_webhook_url = os.environ.get("DISCORD_WEBHOOK", "").strip()
    thread_id = os.environ.get("DISCORD_THREAD_ID", "").strip()
    changelog_path = os.environ.get("CHANGELOG_PATH", "CHANGELOG.md")
    override_body = os.environ.get("OVERRIDE_BODY", "").strip()
    force_send = os.environ.get("FORCE_SEND", "false").lower() in ("true", "1", "yes")
    reset_file = os.environ.get("RESET_FILE", "true").lower() in ("true", "1", "yes")
    
    tag = os.environ.get("RELEASE_TAG", "").strip() or get_pkg_version()
    name = os.environ.get("RELEASE_NAME", "").strip() or f"SOCDOF {tag}"
    url = os.environ.get("RELEASE_URL", "").strip() or "https://github.com/Strudelcode/SOCDOF"

    # If thread_id is explicitly specified and not already present in the query parameters, append it
    target_url = raw_webhook_url
    has_thread_param = False
    if raw_webhook_url and thread_id and "thread_id=" not in raw_webhook_url:
        delimiter = "&" if "?" in raw_webhook_url else "?"
        target_url = f"{raw_webhook_url}{delimiter}thread_id={thread_id}"
        has_thread_param = True
    elif "thread_id=" in raw_webhook_url:
        has_thread_param = True

    # Read changelog file if present
    raw_changelog = ""
    if os.path.exists(changelog_path):
        try:
            with open(changelog_path, "r", encoding="utf-8") as f:
                raw_changelog = f.read()
        except Exception as e:
            print(f"[discord_broadcast] Error reading {changelog_path}: {e}")

    meaningful_changelog = extract_meaningful_content(raw_changelog)
    body = override_body if override_body else meaningful_changelog

    # Check if there is any actual content to send
    if not body and not force_send:
        print("[discord_broadcast] No pending updates in CHANGELOG.md. Skipping Discord announcement to prevent spamming.")
        set_github_output("broadcast_sent", "false")
        sys.exit(0)

    # Check webhook URL
    if not raw_webhook_url:
        print("[discord_broadcast] Notice: DISCORD_WEBHOOK secret is not set or empty. Skipping Discord broadcast.")
        set_github_output("broadcast_sent", "false")
        sys.exit(0)

    current_timestamp = int(time.time())

    # Build concise, attractive Discord message
    header = (
        f"# 🚀 **SOCDOF Update & Release {tag}**\n"
        f"### 📅 Veröffentlicht am <t:{current_timestamp}:D> (<t:{current_timestamp}:R>)\n"
        f"---\n"
    )
    footer = f"\n\n---\n🔗 **GitHub Releases & Downloads:** [Hier ansehen]({url})"

    # Discord 2000-character safety margin (max 1900 chars)
    max_body_len = 1900 - len(header) - len(footer)
    if len(body) > max_body_len:
        trimmed_body = body[:max_body_len].rsplit("\n", 1)[0] + "\n\n*(...Vollständigen Changelog auf GitHub lesen)*"
    else:
        trimmed_body = body

    content = f"{header}{trimmed_body}{footer}"

    payload = {
        "username": "SOCDOF Releases",
        "avatar_url": "https://raw.githubusercontent.com/Strudelcode/SOCDOF/main/public/socdof_icon.png",
        "content": content
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0; +https://github.com/Strudelcode/SOCDOF)"
    }

    req = urllib.request.Request(
        target_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers
    )

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[discord_broadcast] Discord notification successfully sent! HTTP Status: {resp.status}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        print(f"[discord_broadcast] Discord Webhook HTTP Error: {e.code} - {err_body}")
        # If error 10003 (Unknown Channel) occurred because of thread_id, fallback to base channel
        if e.code == 400 and ("10003" in err_body or "Unknown Channel" in err_body) and has_thread_param and raw_webhook_url != target_url:
            print(f"[discord_broadcast] Specified thread_id '{thread_id}' was not found in the webhook's channel (Error 10003).")
            print("[discord_broadcast] Retrying broadcast directly to the webhook's base channel...")
            try:
                fallback_req = urllib.request.Request(raw_webhook_url, data=json.dumps(payload).encode("utf-8"), headers=headers)
                with urllib.request.urlopen(fallback_req) as fallback_resp:
                    print(f"[discord_broadcast] Fallback broadcast delivered to base channel! HTTP Status: {fallback_resp.status}")
            except Exception as e_fallback:
                print(f"[discord_broadcast] Fallback to base channel also failed: {e_fallback}")
                set_github_output("broadcast_sent", "false")
                sys.exit(1)
        else:
            set_github_output("broadcast_sent", "false")
            sys.exit(1)
    except Exception as e:
        print(f"[discord_broadcast] Failed to post to Discord webhook: {e}")
        set_github_output("broadcast_sent", "false")
        sys.exit(1)

    # If message was sent successfully, reset CHANGELOG.md so it's clean for the next updates
    if reset_file:
        try:
            with open(changelog_path, "w", encoding="utf-8") as f:
                f.write(RESET_TEMPLATE)
            print(f"[discord_broadcast] {changelog_path} has been reset for the next release batch.")
        except Exception as e:
            print(f"[discord_broadcast] Warning: Failed to reset {changelog_path}: {e}")

    set_github_output("broadcast_sent", "true")

if __name__ == "__main__":
    main()
