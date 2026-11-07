#!/usr/bin/env python3
"""Announce a SOCDOF GitHub release in the configured Discord forum thread.

Secrets are read from the environment and never printed. The release notes are
the same Markdown that GitHub shows, so the changelog stays the single source
of truth.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

API = "https://discord.com/api/v10"
EMBED_COLOR = 0x0F766E
MAX_DESCRIPTION = 3900


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"[discord-release] missing required environment variable {name}", file=sys.stderr)
        sys.exit(1)
    return value


def clean_thread_id(value: str) -> str:
    match = re.search(r"/(\d+)/?$", value.strip())
    if match:
        return match.group(1)
    digits = re.findall(r"\d+", value)
    return digits[0] if digits else value.strip()


def fetch_release(tag: str) -> dict:
    repository = os.environ.get("GITHUB_REPOSITORY", "Strudelcode/SOCDOF")
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/releases/tags/{tag}",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "SOCDOF-Release-Bot",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def discord_request(path: str, token: str, payload: dict | None, method: str) -> tuple[int, str]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{API}{path}",
        data=body,
        headers={
            "Authorization": f"Bot {token}",
            "Content-Type": "application/json",
            "User-Agent": "SOCDOF-Release-Bot (https://github.com/Strudelcode/SOCDOF, 2.0)",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", errors="replace")


def main() -> None:
    token = require_env("DISCORD_BOT_TOKEN")
    thread_id = clean_thread_id(require_env("DISCORD_THREAD_ID"))
    tag = os.environ.get("RELEASE_TAG", "").strip()
    if not tag:
        print("[discord-release] RELEASE_TAG is empty", file=sys.stderr)
        sys.exit(1)

    body_file = os.environ.get("RELEASE_BODY_FILE", "").strip()
    if body_file:
        try:
            with open(body_file, encoding="utf-8") as handle:
                body = handle.read().strip()
        except OSError as error:
            print(f"[discord-release] cannot read {body_file}: {error}", file=sys.stderr)
            sys.exit(1)
    else:
        body = os.environ.get("RELEASE_BODY", "").strip()

    if not body:
        try:
            release = fetch_release(tag)
            body = str(release.get("body") or "").strip()
            if not body:
                body = str(release.get("name") or tag)
        except Exception as error:  # noqa: BLE001 - this is a CLI boundary
            print(f"[discord-release] cannot fetch release {tag}: {error}", file=sys.stderr)
            sys.exit(1)

    description = body
    if len(description) > MAX_DESCRIPTION:
        description = description[: MAX_DESCRIPTION - 1].rstrip() + "…"

    repository = os.environ.get("GITHUB_REPOSITORY", "Strudelcode/SOCDOF")
    release_url = os.environ.get("RELEASE_URL", "").strip()
    if not release_url:
        release_url = f"https://github.com/{repository}/releases/tag/{tag}"

    title = os.environ.get("RELEASE_NAME", "").strip() or f"SOCDOF {tag}"
    payload = {
        "embeds": [
            {
                "title": title[:256],
                "url": release_url,
                "description": description,
                "color": EMBED_COLOR,
                "footer": {"text": "SOCDOF release"},
            }
        ]
    }

    status, response = discord_request(f"/channels/{thread_id}/messages", token, payload, "POST")
    if status in (200, 201):
        print(f"[discord-release] announcement sent for {tag} (HTTP {status})")
        output = os.environ.get("GITHUB_OUTPUT")
        if output:
            with open(output, "a", encoding="utf-8") as handle:
                handle.write("sent=true\n")
        return

    if "50083" in response or "archived" in response.lower():
        print("[discord-release] thread is archived; unarchiving and retrying", file=sys.stderr)
        unarchive_status, unarchive_body = discord_request(
            f"/channels/{thread_id}", token, {"archived": False, "locked": False}, "PATCH"
        )
        if unarchive_status not in (200, 204):
            print(
                f"[discord-release] cannot unarchive thread (HTTP {unarchive_status}): {unarchive_body}",
                file=sys.stderr,
            )
            sys.exit(1)
        status, response = discord_request(f"/channels/{thread_id}/messages", token, payload, "POST")
        if status in (200, 201):
            print(f"[discord-release] announcement sent for {tag} after unarchive (HTTP {status})")
            return

    print(f"[discord-release] Discord rejected the announcement (HTTP {status}): {response}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
