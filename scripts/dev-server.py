#!/usr/bin/env python3
"""dev server:静态目录 + Cache-Control: no-store(改代码刷新即生效,防模块缓存)"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8460
os.chdir(os.path.join(os.path.dirname(__file__), '..'))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
