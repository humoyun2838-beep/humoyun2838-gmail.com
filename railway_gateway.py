"""Durable Telegram ingress. Apps Script retains bot logic and Sheets access."""
from contextlib import contextmanager
import hmac
import json
import os
import re
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class Queue:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS updates (route TEXT, uid INTEGER, body TEXT, attempts INTEGER DEFAULT 0, due REAL DEFAULT 0, done INTEGER DEFAULT 0, PRIMARY KEY(route,uid))')
            db.execute('CREATE INDEX IF NOT EXISTS pending_updates ON updates(done,due,uid)')

    def pending_count(self):
        with self.connect() as db:
            return db.execute('SELECT COUNT(*) FROM updates WHERE done=0').fetchone()[0]

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        try:
            with db:
                yield db
        finally:
            db.close()

    def put(self, route, update):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO updates(route,uid,body) VALUES(?,?,?)',
                       (route, update['update_id'], json.dumps(update)))

    def next(self):
        with self.connect() as db:
            return db.execute('SELECT route,uid,body,attempts FROM updates WHERE done=0 AND due<=? ORDER BY uid LIMIT 1', (time.time(),)).fetchone()

    def finish(self, route, uid):
        with self.connect() as db:
            db.execute('UPDATE updates SET done=1,body=? WHERE route=? AND uid=?', ('{}', route, uid))
            # Keep recent IDs for duplicate delivery protection without retaining texts.
            db.execute('DELETE FROM updates WHERE done=1 AND route=? AND uid<?', (route, uid - 100000))

    def retry(self, route, uid, attempts):
        with self.connect() as db:
            db.execute('UPDATE updates SET attempts=?,due=? WHERE route=? AND uid=?',
                       (attempts+1, time.time()+min(60, 2**min(attempts, 6)), route, uid))


def acknowledged(result, depth=0):
    """Accept the exact application ack, including HtmlService's JSON envelope."""
    if result.strip() == 'OK':
        return True
    try:
        value = json.loads(result)
        if isinstance(value, dict) and value.get('ok') is True:
            return True
    except ValueError:
        pass
    # HtmlService wraps user HTML in its sandbox bootstrap rather than returning
    # it directly. An error page with an unrelated OK must not complete a job.
    for match in re.finditer(r'"userHtml"\s*:\s*("(?:\\.|[^"\\])*")', result):
        try:
            if json.loads(match.group(1)).strip() == 'OK':
                return True
        except ValueError:
            pass
    # Google's bootstrap may embed the complete envelope as a JSON-encoded
    # JavaScript string argument. Decode data only, never execute the script.
    if depth < 2 and 'userHtml' in result:
        for match in re.finditer(r'"(?:\\.|[^"\\])*"', result):
            try:
                decoded = json.loads(match.group(0))
            except ValueError:
                continue
            if 'userHtml' in decoded and decoded != result and acknowledged(decoded, depth+1):
                return True
    return bool(re.search(r'<body\b[^>]*>\s*OK\s*</body>', result, re.I))


def forward(base, key, route, body):
    url = base + '?' + urlencode({'key': key, 'route': route})
    req = Request(url, data=body.encode(), headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=180) as response:
        result = response.read(1024*1024).decode('utf-8', errors='replace')
    # HTTP 200 can also contain Google's error/login page: never acknowledge that.
    if not acknowledged(result):
        flags = ','.join(label for label, marker in [
            ('sandbox', 'userHtml'), ('login', 'accounts.google.com'),
            ('quota', 'too many times'), ('script_error', 'ScriptError'),
            ('unavailable', 'unable to open'), ('access', 'permission')]
            if marker in result) or 'other'
        raise RuntimeError('ack_missing shape=%s bytes=%d' % (flags, len(result)))


def worker(queue, base, key, stop):
    while not stop.is_set():
        job = queue.next()
        if not job:
            stop.wait(.3)
            continue
        route, uid, body, attempts = job
        started = time.monotonic()
        try:
            forward(base, key, route, body)
            queue.finish(route, uid)
            print('Delivery completed route=%s upstream_ms=%d pending=%d' %
                  (route, (time.monotonic()-started)*1000, queue.pending_count()), flush=True)
        except Exception as error:
            # Payloads, keys and upstream URLs must never be written to logs.
            reason = ('http_%d' % error.code if isinstance(error, HTTPError)
                      else 'network' if isinstance(error, (URLError, TimeoutError))
                      else str(error) if isinstance(error, RuntimeError)
                      else 'internal')
            print('Delivery retry route=%s reason=%s upstream_ms=%d pending=%d' %
                  (route, reason, (time.monotonic()-started)*1000, queue.pending_count()), flush=True)
            queue.retry(route, uid, attempts)


def handler(queue, secret, alive):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, status, value):
            body = json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != '/health':
                self.reply(404, {'ok': False})
                return
            self.reply(200 if alive() else 503, {'ok': alive()})

        def do_POST(self):
            route = {'/telegram/main': 'main', '/telegram/admin': 'admin'}.get(self.path)
            supplied = self.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
            if not route or not hmac.compare_digest(supplied, secret):
                self.reply(403, {'ok': False})
                return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 1024*1024:
                    raise ValueError()
                update = json.loads(self.rfile.read(size))
                if not isinstance(update, dict) or type(update.get('update_id')) is not int or update['update_id'] < 0:
                    raise ValueError()
            except (ValueError, UnicodeError):
                self.reply(400, {'ok': False})
                return
            try:
                queue.put(route, update)
            except sqlite3.Error:
                self.reply(503, {'ok': False})
                return
            self.reply(200, {'ok': True})
    return Handler


def main():
    base = os.environ['APPS_SCRIPT_URL'].rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'https' or parsed.netloc != 'script.google.com' or not parsed.path.endswith('/exec') or parsed.query:
        raise ValueError('APPS_SCRIPT_URL must be an Apps Script /exec URL')
    secret, key = os.environ['TELEGRAM_WEBHOOK_SECRET'], os.environ['APPS_SCRIPT_WEBHOOK_KEY']
    if len(secret) < 32 or not key:
        raise ValueError('Webhook secrets are required')
    queue = Queue(os.environ.get('QUEUE_PATH', '/data/telegram.sqlite3'))
    print('Worker started pending=%d' % queue.pending_count(), flush=True)
    stop = threading.Event()
    thread = threading.Thread(target=worker, args=(queue, base, key, stop), daemon=True)
    thread.start()
    server = ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), handler(queue, secret, thread.is_alive))
    try:
        server.serve_forever()
    finally:
        stop.set()
        server.server_close()


if __name__ == '__main__':
    main()
