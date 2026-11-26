#!/usr/bin/env python3
"""
Discord Bot Forum Broadcast & Changelog Reset Script for SOCDOF
---------------------------------------------------------------
- Exclusively uses the Discord Bot API (DISCORD_BOT_TOKEN & DISCORD_THREAD_ID).
- Posts directly into the designated Discord Forum thread/post.
- Automatically unarchives threads if they were archived due to inactivity.
- Legacy Webhooks have been completely removed and disabled.
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

def send_via_bot(token: str, channel_id: str, content: str) -> tuple[bool, int, str]:
    """Posts a message to a Discord channel or forum thread using a Discord Bot token."""
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    bot_headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
        "User-Agent": "SOCDOF-Release-Bot (https://github.com/Strudelcode/SOCDOF, 1.0)"
    }
    body_data = json.dumps({"content": content}).encode("utf-8")
    req = urllib.request.Request(url, data=body_data, headers=bot_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[discord_broadcast] Discord notification successfully sent via Discord Bot! HTTP Status: {resp.status}")
            return True, resp.status, ""
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        print(f"[discord_broadcast] Discord Bot HTTP Error: {e.code} - {err_body}")
        
        # If thread is archived (Discord Error Code 50083), unarchive it and retry
        if "50083" in err_body or "archived" in err_body.lower():
            print(f"[discord_broadcast] Forum post / thread {channel_id} is currently archived. Unarchiving via Bot API...")
            unarchive_req = urllib.request.Request(
                f"https://discord.com/api/v10/channels/{channel_id}",
                data=json.dumps({"archived": False, "locked": False}).encode("utf-8"),
                headers=bot_headers,
                method="PATCH"
            )
            try:
                with urllib.request.urlopen(unarchive_req) as unarchive_resp:
                    print(f"[discord_broadcast] Thread unarchived successfully (status {unarchive_resp.status}). Retrying message...")
                
                # Retry message send
                retry_req = urllib.request.Request(url, data=body_data, headers=bot_headers, method="POST")
                with urllib.request.urlopen(retry_req) as retry_resp:
                    print(f"[discord_broadcast] Message sent successfully after unarchiving! HTTP Status: {retry_resp.status}")
                    return True, retry_resp.status, ""
            except Exception as patch_e:
                print(f"[discord_broadcast] Failed to unarchive thread: {patch_e}")
                
        return False, e.code, err_body
    except Exception as e:
        print(f"[discord_broadcast] Failed to post via Discord Bot: {e}")
        return False, 0, str(e)

def main():
    raw_bot_token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    raw_thread_id = os.environ.get("DISCORD_THREAD_ID", "").strip()
    raw_channel_id = os.environ.get("DISCORD_CHANNEL_ID", "").strip()
    raw_webhook_url = os.environ.get("DISCORD_WEBHOOK", "").strip()
    changelog_path = os.environ.get("CHANGELOG_PATH", "CHANGELOG.md")
    override_body = os.environ.get("OVERRIDE_BODY", "").strip()
    force_send = os.environ.get("FORCE_SEND", "false").lower() in ("true", "1", "yes")
    reset_file = os.environ.get("RESET_FILE", "true").lower() in ("true", "1", "yes")
    
    tag = os.environ.get("RELEASE_TAG", "").strip() or get_pkg_version()
    name = os.environ.get("RELEASE_NAME", "").strip() or f"SOCDOF {tag}"
    url = os.environ.get("RELEASE_URL", "").strip() or "https://github.com/Strudelcode/SOCDOF"

    thread_id = clean_discord_id(raw_thread_id) or clean_discord_id(raw_channel_id)

    # Legacy Webhook Deprecation Notice
    if raw_webhook_url:
        print("[discord_broadcast] Notice: Webhook broadcasting is permanently disabled. Only Discord Bot API is supported.")

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

    # Validate Discord Bot Configuration
    if not raw_bot_token:
        print("[discord_broadcast] ❌ ERROR: DISCORD_BOT_TOKEN secret is missing or empty!")
        print("[discord_broadcast] The legacy Webhook is completely disabled. Please configure 'DISCORD_BOT_TOKEN' in GitHub Secrets.")
        set_github_output("broadcast_sent", "false")
        sys.exit(1)

    if not thread_id:
        print("[discord_broadcast] ❌ ERROR: DISCORD_THREAD_ID secret is missing or empty!")
        print("[discord_broadcast] Please configure 'DISCORD_THREAD_ID' (the ID of your Forum post) in GitHub Secrets.")
        set_github_output("broadcast_sent", "false")
        sys.exit(1)

    print(f"[discord_broadcast] Target Forum Thread/Post ID: {thread_id}")

    current_timestamp = int(time.time())

    # Build concise, attractive Discord message for the Forum Thread
    header = (
        f"# 🚀 **SOCDOF Release {tag}**\n"
        f"> 📅 **Veröffentlicht am / Date:** <t:{current_timestamp}:D> (<t:{current_timestamp}:R>)\n"
        f"> 👤 **Entwickler / Publisher:** Yuri / Strudel (`Strudelcode`)\n"
        f"---\n\n"
    )
    footer = (
        f"\n\n---\n"
        f"📦 **Releases & Windows .EXE Download:** [Hier ansehen & herunterladen]({url})\n"
        f"⭐ **GitHub Repository:** [Strudelcode/SOCDOF](https://github.com/Strudelcode/SOCDOF)"
    )

    # Discord 2000-character safety margin (max 1900 chars)
    max_body_len = 1900 - len(header) - len(footer)
    if len(body) > max_body_len:
        trimmed_body = body[:max_body_len].rsplit("\n", 1)[0] + "\n\n*(...Vollständigen Changelog auf GitHub lesen)*"
    else:
        trimmed_body = body

    content = f"{header}{trimmed_body}{footer}"

    # Dispatch directly via Discord Bot API
    print(f"[discord_broadcast] Dispatching announcement via Discord Bot to Forum Thread/Post: {thread_id}...")
    success, code, err = send_via_bot(raw_bot_token, thread_id, content)

    if not success:
        print(f"[discord_broadcast] ❌ Failed to post release update to Discord Forum via Bot (HTTP {code}). Error: {err}")
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
