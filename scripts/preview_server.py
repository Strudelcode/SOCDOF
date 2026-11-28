#!/usr/bin/env python3
"""Static server for the combined preview tree (`scripts/preview-both-editions.sh`).

Plain `http.server` without cache headers makes a rebuilt bundle look unchanged in the browser,
so every response is marked `no-store`.
"""

import functools
import http.server
import os
import socketserver
import sys


def main() -> None:
    directory = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "target/preview-tree")
    port = int(sys.argv[2] if len(sys.argv) > 2 else os.environ.get("PORT", 3001))

    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            pass

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(
        ("0.0.0.0", port), functools.partial(Handler, directory=directory)
    ) as httpd:
        print(f"serving {directory} on 0.0.0.0:{port}", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
