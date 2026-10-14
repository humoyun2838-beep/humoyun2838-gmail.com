import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from railway_gateway import Queue, handler, acknowledged


class GatewayTests(unittest.TestCase):
    def test_google_acknowledgement(self):
        self.assertTrue(acknowledged('OK'))
        self.assertTrue(acknowledged('{"ok":true}'))
        self.assertTrue(acknowledged('<html><body>OK</body></html>'))
        self.assertTrue(acknowledged('<script>_initialize({"userHtml":"OK","sandboxMode":"IFRAME"})</script>'))
        self.assertTrue(acknowledged('<script>_initialize('+json.dumps(json.dumps({'userHtml':'OK'}))+')</script>'))
        for bad in ['{"ok":false}', '<html>Login</html>',
                    '<html>Error: OK to retry</html>',
                    '<script>_initialize({"userHtml":"Error"})</script>']:
            self.assertFalse(acknowledged(bad))

    def test_durable_duplicate_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            q = Queue(directory+'/queue.db')
            q.put('main', {'update_id': 1, 'message': {'text': 'test'}})
            q.put('main', {'update_id': 1, 'message': {'text': 'duplicate'}})
            self.assertIn('test', q.next()[2])
            self.assertEqual(Queue(q.path).next()[1], 1)
            q.retry('main', 1, 0)
            self.assertIsNone(q.next())
            q.finish('main', 1)
            q.put('main', {'update_id': 1})
            self.assertIsNone(q.next())

    def test_auth_and_ack_after_persistence(self):
        with tempfile.TemporaryDirectory() as directory:
            q = Queue(directory+'/queue.db')
            import io
            import email.message
            cls = handler(q, 'x'*32, lambda: True)
            h = cls.__new__(cls)
            h.path = '/telegram/main'
            h.headers = email.message.Message()
            h.headers['Content-Length'] = '15'
            h.rfile = io.BytesIO(b'{"update_id":2}')
            h.wfile = io.BytesIO()
            result = []
            h.reply = lambda code, value: result.append((code, value))
            h.do_POST()
            self.assertEqual(result[-1][0], 403)
            self.assertIsNone(q.next())
            h.headers['X-Telegram-Bot-Api-Secret-Token'] = 'x'*32
            h.do_POST()
            self.assertEqual(result[-1], (200, {'ok': True}))
            self.assertEqual(q.next()[1], 2)
            h.path = '/health'
            h.do_GET()
            self.assertEqual(result[-1][0], 200)



if __name__ == '__main__':
    unittest.main()
