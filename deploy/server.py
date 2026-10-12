#!/usr/bin/env python3
"""Dependency-free static hosting with precompressed release assets."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

class StaticHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        super().end_headers()
    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / 'index.html'
        accepted = {}
        for part in self.headers.get('Accept-Encoding', '').split(','):
            pieces = part.strip().split(';')
            quality = 1.0
            for option in pieces[1:]:
                if option.strip().startswith('q='):
                    try: quality = float(option.strip()[2:])
                    except ValueError: quality = 0
            accepted[pieces[0]] = quality
        if path.is_file():
            for encoding, suffix in [('br','.br'),('gzip','.gz')]:
                compressed = Path(str(path) + suffix)
                if accepted.get(encoding, 0) > 0 and compressed.is_file():
                    data = compressed.open('rb')
                    self.send_response(200)
                    self.send_header('Content-Type', self.guess_type(str(path)))
                    self.send_header('Content-Encoding', encoding)
                    self.send_header('Vary', 'Accept-Encoding')
                    self.send_header('Content-Length', str(compressed.stat().st_size))
                    self.end_headers()
                    return data
        return super().send_head()
    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == '__main__':
    os.chdir(os.environ.get('DEADFALL_ROOT','/workspace/deadfall'))
    ThreadingHTTPServer(('127.0.0.1',8080),StaticHandler).serve_forever()
