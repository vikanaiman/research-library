#!/usr/bin/env python3
"""
Simple HTTP server to serve static files.
Run on lerning server: python serve.py
Access at: http://lerning:8888
"""

import http.server
import socketserver
import os

PORT = 8888
DIRECTORY = os.path.dirname(os.path.abspath(__file__)) or '.'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Enable CORS for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"🚀 Serving at http://0.0.0.0:{PORT}")
        print(f"📁 Directory: {DIRECTORY}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
