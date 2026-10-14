import tempfile
import unittest
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from bot import BACK, CANCEL, CONFIRM, Bot


class FlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.bot = Bot('test', [1], 'https://example.invalid', 'test-secret',
                       Path(self.tmp.name) / 'state.sqlite3')
        self.sent = []
        self.bot.api = self.api
        self.bot.save(2, 'approved', {})

    def api(self, method, **payload):
        self.sent.append((method, payload))
        return {}

    def tearDown(self):
        self.bot.db.close()
        self.tmp.cleanup()

    def message(self, text, uid=2):
        self.bot.handle({'message': {'chat': {'type': 'private'},
                                    'from': {'id': uid, 'first_name': 'Test'}, 'text': text}})

    def add(self, employee, text):
        self.message(employee)
        self.message(text)

    def test_collect_multiple_staff_then_submit_once(self):
        self.message('Sklad')
        first, second = self.bot.departments['Sklad'][:2]
        self.add(first, 'Birinchi ma’lumot')
        self.add(second, 'Ikkinchi ma’lumot')
        self.assertEqual(len(self.bot.user(2)[1]['entries']), 2)
        rows = self.sent[-1][1]['reply_markup']['keyboard']
        self.assertEqual(rows[-2][0]['text'], CONFIRM)
        batches = []

        def receiver(url, data):
            batches.append(data)
            return {'ok': True, 'batch_id': data['batch_id']}

        with patch('bot.post', receiver):
            self.message(CONFIRM)
            self.message(CONFIRM)
        self.assertEqual(len(batches), 1)
        self.assertIn(first, batches[0]['message'])
        self.assertIn(second, batches[0]['message'])
        self.assertEqual(self.bot.user(2)[1], {})
        self.assertTrue(any(p.get('text', '').startswith('Xabar yuborganingiz uchun rahmat!')
                            for _, p in self.sent))

    def test_failure_keeps_frozen_payload_for_retry_and_restart(self):
        self.message('OSS')
        self.add('Boshqa', 'Yangi Xodim')
        self.message('Ma’lumot')
        with patch('bot.post', side_effect=TimeoutError):
            self.message(CONFIRM)
        frozen = self.bot.user(2)[1]['payload'].copy()
        self.assertEqual(len(self.bot.user(2)[1]['entries']), 1)
        self.message('Tahrir')
        self.assertEqual(self.bot.user(2)[1]['payload'], frozen)
        reopened = Bot('test', [1], 'url', 'secret', Path(self.tmp.name) / 'state.sqlite3')
        self.assertEqual(reopened.user(2)[1]['payload'], frozen)
        reopened.db.close()
        with patch('bot.post', return_value={'ok': True, 'batch_id': frozen['batch_id']}) as post:
            self.message(CONFIRM)
        self.assertEqual(post.call_args.args[1]['message'], frozen['message'])

    def test_pending_user_cannot_access_or_self_approve(self):
        self.message('/start', 3)
        self.assertEqual(self.bot.user(3)[0], 'pending')
        self.message('Sklad', 3)
        self.assertEqual(self.bot.user(3)[1], {})
        callback = {'id': 'x', 'from': {'id': 3}, 'data': 'approve:3'}
        self.bot.handle({'callback_query': callback})
        self.assertEqual(self.bot.user(3)[0], 'pending')
        callback['from']['id'] = 1
        self.bot.handle({'callback_query': callback})
        self.assertEqual(self.bot.user(3)[0], 'approved')

    def test_empty_confirmation_and_pending_input(self):
        self.message('Oper blok')
        with patch('bot.post') as post:
            self.message(CONFIRM)
            self.message('Boshqa')
            self.message('Test Employee')
            self.message(CONFIRM)
            post.assert_not_called()
        self.assertEqual(self.bot.user(2)[1]['stage'], 'text')
        self.message(CANCEL)
        self.assertEqual(self.bot.user(2)[1]['stage'], 'staff')

    def test_back_does_not_discard_draft(self):
        self.message('Sklad')
        self.add(self.bot.departments['Sklad'][0], 'Saqlansin')
        self.message(BACK)
        self.assertEqual(self.bot.user(2)[1], {})
        self.assertEqual(self.sent[-1][1]['reply_markup']['keyboard'][0][0]['text'], 'Sklad')
        self.message('OSS')
        self.assertEqual(self.bot.user(2)[1]['entries'], [])
        self.message(BACK)
        self.message('Sklad')
        self.assertEqual(self.bot.user(2)[1]['entries'][0]['text'], 'Saqlansin')

    def test_back_preserves_failed_batch_in_its_department(self):
        self.message('Sklad')
        self.add(self.bot.departments['Sklad'][0], 'Saqlansin')
        with patch('bot.post', side_effect=TimeoutError):
            self.message(CONFIRM)
        batch = self.bot.user(2)[1]['payload']['batch_id']
        self.message(BACK)
        self.message('OSS')
        self.message(BACK)
        self.message('Sklad')
        self.assertEqual(self.bot.user(2)[1]['payload']['batch_id'], batch)

    def test_slow_sheet_does_not_block_menu_or_clear_another_department(self):
        self.bot.async_submit = True
        self.bot.delivery_pool = ThreadPoolExecutor(max_workers=1)
        started, release = threading.Event(), threading.Event()
        self.message('Sklad')
        self.add(self.bot.departments['Sklad'][0], 'Saqlansin')

        def receiver(url, data):
            started.set()
            self.assertTrue(release.wait(3))
            return {'ok': True, 'batch_id': data['batch_id']}

        with patch('bot.post', receiver), patch('bot.Bot.api', side_effect=self.api):
            try:
                self.message(CONFIRM)
                self.assertTrue(started.wait(2))
                self.message(BACK)
                self.message('OSS')
                self.assertEqual(self.bot.user(2)[1]['department'], 'OSS')
            finally:
                release.set()
                self.bot.delivery_pool.shutdown(wait=True)
        self.assertEqual(self.bot.user(2)[1]['department'], 'OSS')
        self.message(BACK)
        self.message('Sklad')
        self.assertEqual(self.bot.user(2)[1]['entries'], [])

    def test_roster(self):
        self.assertEqual(len(self.bot.departments), 15)
        self.assertEqual(sum(len(names) - 1 for names in self.bot.departments.values()), 344)
        self.assertTrue(all(names[-1] == 'Boshqa' for names in self.bot.departments.values()))


if __name__ == '__main__':
    unittest.main()
