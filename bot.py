"""DMed bot. Python 3.9+, third-party packages are not required."""
import json
import logging
import os
import sqlite3
import time
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CONFIRM = '✅ Xabarni tasdiqlash'
BACK = '⬅️ Bo‘limlar'
CANCEL = '❌ Kiritishni bekor qilish'


def load_departments():
    departments = {}
    current = None
    for line in (ROOT / 'departments.txt').read_text().splitlines():
        line = line.strip()
        if line.startswith('[') and line.endswith(']'):
            current = line[1:-1]
            departments[current] = []
        elif line:
            departments[current].append(line)
    return departments


def load_env():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())


def post(url, payload, timeout=60):
    request = Request(url, data=json.dumps(payload).encode(),
                      headers={'Content-Type': 'application/json'})
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


class Bot:
    def __init__(self, token, admins, sheets_url, secret, db_path=None, async_submit=False):
        self.token, self.admins = token, set(admins)
        self.sheets_url, self.secret = sheets_url, secret
        self.departments = load_departments()
        self.db_path = str(db_path or ROOT / 'bot.sqlite3')
        self.async_submit = async_submit
        self.delivery_pool = ThreadPoolExecutor(max_workers=4) if async_submit else None
        self.delivering = set()
        self.delivery_lock = threading.Lock()
        self.db = sqlite3.connect(self.db_path)
        self.db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, status TEXT, state TEXT)')
        self.db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value INTEGER)')
        self.db.execute('CREATE TABLE IF NOT EXISTS drafts (uid INTEGER, department TEXT, state TEXT, PRIMARY KEY(uid, department))')
        self.db.execute('CREATE TABLE IF NOT EXISTS profiles (uid INTEGER PRIMARY KEY, name TEXT, username TEXT)')
        self.db.commit()

    def api(self, method, **payload):
        result = post(f'https://api.telegram.org/bot{self.token}/{method}', payload)
        if not result.get('ok'):
            raise RuntimeError('Telegram API request failed')
        return result['result']

    def send(self, uid, text, rows=None, markup=None):
        if rows is not None:
            markup = {'keyboard': [[{'text': x} for x in row] for row in rows],
                      'resize_keyboard': True}
        return self.api('sendMessage', chat_id=uid, text=text,
                        reply_markup=markup or {'remove_keyboard': True})

    def user(self, uid):
        row = self.db.execute('SELECT status, state FROM users WHERE id=?', (uid,)).fetchone()
        return (row[0], json.loads(row[1])) if row else (None, {})

    def save(self, uid, status, state):
        self.db.execute('INSERT OR REPLACE INTO users VALUES (?, ?, ?)',
                        (uid, status, json.dumps(state, ensure_ascii=False)))
        self.db.commit()

    def menu(self, uid):
        self.send(uid, 'Onko gematologiya\nBo‘limni tanlang:',
                  [[name] for name in self.departments])

    def staff(self, uid, state, prefix='Xodimni tanlang:'):
        rows = [[name] for name in self.departments[state['department']]]
        rows += [[CONFIRM], [BACK]]
        self.send(uid, f'{prefix}\nKiritilgan yozuvlar: {len(state.get("entries", []))}', rows)

    def approval(self, callback):
        uid = callback['from']['id']
        self.api('answerCallbackQuery', callback_query_id=callback['id'])
        if uid not in self.admins:
            return
        parts = callback.get('data', '').split(':')
        if len(parts) != 2 or parts[0] not in ('approve', 'reject') or not parts[1].isdigit():
            return
        target = int(parts[1])
        status, state = self.user(target)
        if status != 'pending':
            self.send(uid, 'Bu so‘rovga allaqachon javob berilgan.')
            return
        decision = 'approved' if parts[0] == 'approve' else 'rejected'
        self.save(target, decision, state)
        if decision == 'approved':
            self.send(target, 'Sizga botdan foydalanishga ruxsat berildi.')
            self.menu(target)
        else:
            self.send(target, 'Foydalanish so‘rovingiz rad etildi.')
        self.send(uid, 'So‘rov tasdiqlandi.' if decision == 'approved' else 'So‘rov rad etildi.')

    def submit(self, uid, state):
        if state.get('stage') in ('name', 'text'):
            self.send(uid, 'Avval boshlangan ma’lumotni kiriting yoki bekor qiling.', [[CANCEL], [BACK]])
            return
        if not state.get('entries'):
            self.staff(uid, state, 'Avval kamida bitta xodim uchun ma’lumot kiriting.')
            return
        # Freeze the payload before the first request. Retries use exactly the same ID and data.
        if 'payload' not in state:
            combined = '\n\n'.join(f'{i}. {e["employee"]}\n{e["text"]}'
                                    for i, e in enumerate(state['entries'], 1))
            state['payload'] = {
                'batch_id': str(uuid.uuid4()),
                'date': datetime.now(timezone(timedelta(hours=5))).isoformat(),
                'telegram_id': str(uid), 'sender': state['sender'],
                'department': state['department'], 'message': combined,
            }
            self.save(uid, 'approved', state)
        if self.async_submit:
            key = (uid, state['payload']['batch_id'])
            with self.delivery_lock:
                if key in self.delivering:
                    self.send(uid, 'Xabar Google Sheets’ga yuborilmoqda. Biroz kuting.', [[BACK]])
                    return
                self.delivering.add(key)
            self.send(uid, 'Xabar Google Sheets’ga yuborilmoqda…', [[BACK]])
            self.delivery_pool.submit(self.deliver_background, uid, state, key)
        else:
            self.deliver(uid, state)

    def deliver_background(self, uid, state, key):
        worker = Bot(self.token, self.admins, self.sheets_url, self.secret, self.db_path)
        try:
            worker.deliver(uid, state)
        except Exception:
            logging.warning('Delivery notification failed; saved batch can be retried.')
        finally:
            worker.db.close()
            with self.delivery_lock:
                self.delivering.discard(key)

    def deliver(self, uid, state):
        try:
            result = post(self.sheets_url, dict(state['payload'], secret=self.secret))
            if result.get('ok') is not True or result.get('batch_id') != state['payload']['batch_id']:
                raise RuntimeError('Sheets did not acknowledge this batch')
        except Exception:
            self.send(uid, 'Google Sheets’ga yuborilmadi. Yozuvlar saqlandi. '
                      'Shu bo‘limni ochib «Xabarni tasdiqlash»ni qayta bosing.')
            return
        self.db.execute('BEGIN IMMEDIATE')
        current = self.user(uid)[1]
        same = current.get('payload', {}).get('batch_id') == state['payload']['batch_id']
        if same:
            self.db.execute("UPDATE users SET state='{}' WHERE id=?", (uid,))
        self.db.execute('DELETE FROM drafts WHERE uid=? AND department=?', (uid, state['department']))
        self.db.commit()
        if same:
            self.send(uid, 'Xabar yuborganingiz uchun rahmat!\nBo‘limni tanlang:',
                      [[name] for name in self.departments])
        else:
            self.api('sendMessage', chat_id=uid,
                     text=state['department'] + ': Xabar yuborganingiz uchun rahmat!')

    def open_menu(self, uid, state):
        if state.get('department'):
            self.db.execute('INSERT OR REPLACE INTO drafts VALUES (?, ?, ?)',
                            (uid, state['department'], json.dumps(state, ensure_ascii=False)))
        self.save(uid, 'approved', {})
        self.menu(uid)

    def handle(self, update):
        if 'callback_query' in update:
            self.approval(update['callback_query'])
            return
        msg = update.get('message', {})
        if msg.get('chat', {}).get('type') != 'private' or 'from' not in msg:
            return
        uid = msg['from']['id']
        text = msg.get('text', '').strip()
        name = ' '.join(msg['from'].get(k, '') for k in ('first_name', 'last_name')).strip()
        self.db.execute('INSERT OR REPLACE INTO profiles VALUES (?, ?, ?)',
                        (uid, name, msg['from'].get('username', '')))
        self.db.commit()
        if text == '/id':
            self.send(uid, f'Sizning Telegram ID: {uid}')
            return
        status, state = self.user(uid)
        if uid in self.admins and status != 'approved':
            status = 'approved'
            self.save(uid, status, state)
        if status != 'approved':
            if status is None:
                name = ' '.join(msg['from'].get(k, '') for k in ('first_name', 'last_name')).strip()
                markup = {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'approve:{uid}'},
                    {'text': '❌ Rad etish', 'callback_data': f'reject:{uid}'}]]}
                # Save pending only after delivering all approval requests.
                for admin in ([] if os.environ.get('ADMIN_BOT_TOKEN') else self.admins):
                    self.send(admin, f'Kirish so‘rovi\n{name}\nTelegram ID: {uid}', markup=markup)
                self.save(uid, 'pending', {})
            self.send(uid, 'Botdan foydalanish ruxsatingiz bekor qilingan.' if status == 'revoked'
                      else 'Foydalanish so‘rovingiz rad etilgan.' if status == 'rejected'
                      else 'Administrator tasdiqlashini kuting.')
            return
        if text in ('/start', BACK, 'Bo‘limlar', 'Bolimlar'):
            self.open_menu(uid, state)
            return
        if state.get('payload'):
            if text == CONFIRM:
                self.submit(uid, state)
            else:
                self.send(uid, 'Yuborishni yakunlash uchun qayta tasdiqlang.', [[CONFIRM]])
            return
        if text == CONFIRM and state.get('department'):
            self.submit(uid, state)
            return
        if text == CANCEL and state.get('department'):
            state.update(stage='staff')
            state.pop('employee', None)
            self.save(uid, status, state)
            self.staff(uid, state)
            return
        if state.get('stage') == 'name':
            if not text or len(text) > 150 or text.startswith('/'):
                self.send(uid, 'Xodimning ism-familiyasini kiriting (150 belgigacha).', [[CANCEL], [BACK]])
                return
            state.update(employee=text, stage='text')
            self.save(uid, status, state)
            self.send(uid, 'Ma’lumotni kiriting:', [[CANCEL], [BACK]])
            return
        if state.get('stage') == 'text':
            if not text or text.startswith('/'):
                self.send(uid, 'Ma’lumotni matn ko‘rinishida kiriting:', [[CANCEL], [BACK]])
                return
            size = sum(len(e['employee']) + len(e['text']) + 15 for e in state['entries'])
            if size + len(text) + len(state['employee']) + 15 > 45000:
                self.send(uid, 'Umumiy xabar hajmi to‘ldi. Kiritishni bekor qilib, '
                          'tayyor yozuvlarni tasdiqlang.', [[CANCEL], [BACK]])
                return
            state['entries'].append({'employee': state.pop('employee'), 'text': text})
            state['stage'] = 'staff'
            self.save(uid, status, state)
            self.staff(uid, state, 'Ma’lumot qo‘shildi. Yana xodim tanlang yoki xabarni tasdiqlang.')
            return
        if state.get('department'):
            if text not in self.departments[state['department']]:
                self.staff(uid, state, 'Ro‘yxatdan xodim tanlang.')
                return
            if text == 'Boshqa':
                state['stage'] = 'name'
                prompt = 'Xodimning ism-familiyasini kiriting:'
            else:
                state.update(employee=text, stage='text')
                prompt = 'Ma’lumotni kiriting:'
            self.save(uid, status, state)
            self.send(uid, prompt, [[CANCEL], [BACK]])
            return
        if text in self.departments:
            name = ' '.join(msg['from'].get(k, '') for k in ('first_name', 'last_name')).strip()
            draft = self.db.execute('SELECT state FROM drafts WHERE uid=? AND department=?', (uid, text)).fetchone()
            state = json.loads(draft[0]) if draft else {'department': text, 'entries': [], 'stage': 'staff', 'sender': name}
            self.save(uid, status, state)
            if state.get('payload'):
                self.send(uid, 'Saqlangan xabarni yuborish uchun tasdiqlang.', [[CONFIRM], [BACK]])
            elif state.get('stage') in ('name', 'text'):
                self.send(uid, 'Ism-familiyani kiriting:' if state['stage'] == 'name' else 'Ma’lumotni kiriting:', [[CANCEL], [BACK]])
            else:
                self.staff(uid, state)
        else:
            self.menu(uid)

    def run(self):
        row = self.db.execute("SELECT value FROM settings WHERE key='offset'").fetchone()
        offset = row[0] if row else 0
        while True:
            try:
                updates = self.api('getUpdates', offset=offset, timeout=30,
                                   allowed_updates=['message', 'callback_query'])
                for update in updates:
                    self.handle(update)
                    offset = update['update_id'] + 1
                    self.db.execute("INSERT OR REPLACE INTO settings VALUES ('offset', ?)", (offset,))
                    self.db.commit()
            except KeyboardInterrupt:
                break
            except Exception:
                # Never log Telegram URLs: they contain the bot token.
                logging.warning('Request failed; retrying in 5 seconds.')
                time.sleep(5)


if __name__ == '__main__':
    load_env()
    if os.environ.get('HOSTED_MODE') == '1':
        raise SystemExit('Bot Google Apps Script’da ishlaydi. Mahalliy polling o‘chirilgan.')
    required = ('BOT_TOKEN', 'ADMIN_IDS', 'SHEETS_URL', 'SHEETS_SECRET')
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise SystemExit('Please configure .env: ' + ', '.join(missing))
    admins = [int(x.strip()) for x in os.environ['ADMIN_IDS'].split(',')]
    url = os.environ['SHEETS_URL']
    if not url.startswith('https://script.google.com/macros/s/') or not url.endswith('/exec'):
        raise SystemExit('SHEETS_URL must be a Google Apps Script deployment /exec URL')
    Bot(os.environ['BOT_TOKEN'], admins, url, os.environ['SHEETS_SECRET'], async_submit=True).run()
