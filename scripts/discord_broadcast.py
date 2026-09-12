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

def clean_discord_id(val: str) -> str:
    """Extracts a pure numeric Snowflake ID from an ID string or discord.com URL."""
    val = val.strip()
    if not val:
        return ""
    # If a full channel or thread URL was provided (e.g. https://discord.com/channels/.../...)
    match = re.search(r'/(\d+)/?$', val)
    if match:
        return match.group(1)
    # If directly numeric
    digits = re.findall(r'\d+', val)
    return digits[0] if digits else val

def main():
    raw_webhook_url = os.environ.get("DISCORD_WEBHOOK", "").strip()
    raw_thread_id = os.environ.get("DISCORD_THREAD_ID", "").strip()
    changelog_path = os.environ.get("CHANGELOG_PATH", "CHANGELOG.md")
    override_body = os.environ.get("OVERRIDE_BODY", "").strip()
    force_send = os.environ.get("FORCE_SEND", "false").lower() in ("true", "1", "yes")
    reset_file = os.environ.get("RESET_FILE", "true").lower() in ("true", "1", "yes")
    fallback_to_base = os.environ.get("DISCORD_FALLBACK_BASE_CHANNEL", "false").lower() in ("true", "1", "yes")
    
    tag = os.environ.get("RELEASE_TAG", "").strip() or get_pkg_version()
    name = os.environ.get("RELEASE_NAME", "").strip() or f"SOCDOF {tag}"
    url = os.environ.get("RELEASE_URL", "").strip() or "https://github.com/Strudelcode/SOCDOF"

    thread_id = clean_discord_id(raw_thread_id)

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

    # Safe webhook ID logging (never log token)
    webhook_id_match = re.search(r'/webhooks/(\d+)/', raw_webhook_url)
    webhook_id = webhook_id_match.group(1) if webhook_id_match else "unknown"
    print(f"[discord_broadcast] Target Webhook ID: {webhook_id}")
    if thread_id:
        print(f"[discord_broadcast] Target Thread / Post ID: {thread_id}")

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

    # Optional forum thread name if creating a new post in a forum channel
    thread_name_env = os.environ.get("DISCORD_THREAD_NAME", "").strip()
    if thread_name_env:
        payload["thread_name"] = thread_name_env

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0; +https://github.com/Strudelcode/SOCDOF)"
    }

    def build_webhook_url(base_url: str, tid: str = "") -> str:
        if not tid:
            return base_url
        delimiter = "&" if "?" in base_url else "?"
        return f"{base_url}{delimiter}thread_id={tid}"

    def execute_request(url: str, data_dict: dict) -> tuple[bool, int, str]:
        req = urllib.request.Request(
            url,
            data=json.dumps(data_dict).encode("utf-8"),
            headers=headers
        )
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"[discord_broadcast] Discord notification successfully sent! HTTP Status: {resp.status}")
                return True, resp.status, ""
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            print(f"[discord_broadcast] Discord Webhook HTTP Error: {e.code} - {err_body}")
            return False, e.code, err_body
        except Exception as e:
            print(f"[discord_broadcast] Failed to post to Discord webhook: {e}")
            return False, 0, str(e)

    success = False
    
    # 1. Attempt sending to specified thread if thread_id is set
    if thread_id:
        target_url = build_webhook_url(raw_webhook_url, thread_id)
        thread_payload = dict(payload)
        thread_payload["thread_id"] = thread_id
        success, code, err = execute_request(target_url, thread_payload)

        # If 10003 (Unknown Channel) occurred, thread_id doesn't exist under this webhook's channel
        if not success and code == 400 and ("10003" in err or "Unknown Channel" in err):
            print(f"[discord_broadcast] Error 10003: Thread ID '{thread_id}' is not an active thread in this webhook's channel.")
            print("[discord_broadcast] In Discord, a webhook can only post to threads created inside its own parent channel.")
            print("[discord_broadcast] If this is a Forum channel:")
            print("  1) Create the webhook inside the Forum Channel settings (Edit Channel -> Integrations -> Webhooks).")
            print("  2) Or to create a brand new Forum post, omit DISCORD_THREAD_ID (the script will create a new post automatically).")

            # Check if user provided an alternative ID (e.g. from discord URL)
            alt_id = "1542966848381779999" if thread_id != "1542966848381779999" else "1544004254417682442"
            print(f"[discord_broadcast] Trying alternative forum thread ID: {alt_id}...")
            alt_url = build_webhook_url(raw_webhook_url, alt_id)
            alt_payload = dict(payload)
            alt_payload["thread_id"] = alt_id
            alt_success, alt_code, _ = execute_request(alt_url, alt_payload)
            if alt_success:
                success = True
            elif fallback_to_base:
                print("[discord_broadcast] DISCORD_FALLBACK_BASE_CHANNEL=true: Retrying directly to base webhook channel...")
                success, _, _ = execute_request(raw_webhook_url, payload)
    else:
        # 2. No thread specified: Send directly to webhook
        success, code, err = execute_request(raw_webhook_url, payload)
        
        # If it's a forum channel and requires a thread_name to create a new post
        if not success and code == 400 and ("thread_name" in err or "40001" in err):
            print(f"[discord_broadcast] Forum channel requires a post title. Retrying with '🚀 SOCDOF {tag} Updates'...")
            forum_payload = dict(payload)
            forum_payload["thread_name"] = f"🚀 SOCDOF {tag} Updates"
            success, _, _ = execute_request(raw_webhook_url, forum_payload)
    if not success:
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
