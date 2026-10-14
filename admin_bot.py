"""Private administrator bot; shares access decisions with the reporting bot."""
import logging
import os
import time
from bot import Bot, load_env, post

USERS = '👥 Foydalanuvchilar'
REQUESTS = '📨 Kirish so‘rovlari'
BLOCKED = '🚫 Rad etilganlar va chiqarilganlar'
LABELS = {'approved': 'Tasdiqlangan', 'pending': 'Kutilmoqda',
          'rejected': 'Rad etilgan', 'revoked': 'Ruxsat bekor qilingan'}


class AdminBot:
    def __init__(self, token, main):
        self.token, self.main = token, main
        self.db = main.db
        self.db.execute('CREATE TABLE IF NOT EXISTS admin_notices '
                        '(uid INTEGER, admin INTEGER, PRIMARY KEY(uid, admin))')
        self.db.commit()

    def api(self, method, **payload):
        r = post(f'https://api.telegram.org/bot{self.token}/{method}', payload)
        if not r.get('ok'):
            raise RuntimeError('Admin Telegram API failed')
        return r['result']

    def send(self, uid, text, buttons=None):
        markup = {'inline_keyboard': buttons} if buttons is not None else {
            'keyboard': [[{'text': USERS}], [{'text': REQUESTS}], [{'text': BLOCKED}]],
            'resize_keyboard': True}
        return self.api('sendMessage', chat_id=uid, text=text, reply_markup=markup)

    def profile(self, target):
        row = self.db.execute('SELECT name, username FROM profiles WHERE uid=?', (target,)).fetchone()
        if row:
            return row
        try:
            chat = self.main.api('getChat', chat_id=target)
            name = ' '.join(chat.get(k, '') for k in ('first_name', 'last_name')).strip()
            username = chat.get('username', '')
            self.db.execute('INSERT OR REPLACE INTO profiles VALUES (?, ?, ?)',
                            (target, name, username))
            self.db.commit()
            return name, username
        except Exception:
            return str(target), ''

    def card(self, uid, target):
        status, _ = self.main.user(target)
        if status is None:
            self.send(uid, 'Foydalanuvchi topilmadi.')
            return
        name, username = self.profile(target)
        text = f'{name}\n' + (f'@{username}\n' if username else '')
        text += f'Telegram ID: {target}\nHolat: {LABELS.get(status, status)}'
        buttons = []
        if target in self.main.admins:
            text += '\nAdministrator'
        elif status == 'approved':
            buttons = [[{'text': '🚫 Ruxsatni bekor qilish', 'callback_data': f'revokeask:{target}'}]]
        else:
            buttons = [[{'text': '✅ Tasdiqlash', 'callback_data': f'approve:{target}'}]]
            if status == 'pending':
                buttons[0].append({'text': '❌ Rad etish', 'callback_data': f'reject:{target}'})
        self.send(uid, text, buttons)

    def listing(self, uid, category, page=0):
        filters = {'users': ('approved',), 'pending': ('pending',),
                   'blocked': ('rejected', 'revoked')}
        if category not in filters or page < 0:
            return
        statuses = filters[category]
        where = ','.join('?' for _ in statuses)
        rows = self.db.execute(f'SELECT id, status FROM users WHERE status IN ({where}) '
                               'ORDER BY id LIMIT 11 OFFSET ?', (*statuses, page * 10)).fetchall()
        buttons = []
        for target, status in rows[:10]:
            name, _ = self.profile(target)
            buttons.append([{'text': f'{name[:45]} · {target}', 'callback_data': f'user:{target}'}])
        nav = []
        if page:
            nav.append({'text': '⬅️ Oldingi', 'callback_data': f'list:{category}:{page-1}'})
        if len(rows) > 10:
            nav.append({'text': 'Keyingi ➡️', 'callback_data': f'list:{category}:{page+1}'})
        if nav:
            buttons.append(nav)
        title = {'users': 'Tasdiqlangan foydalanuvchilar', 'pending': 'Kirish so‘rovlari',
                 'blocked': 'Rad etilganlar va ruxsati bekor qilinganlar'}[category]
        self.send(uid, title + (f' · {page+1}-sahifa' if rows else '\nRo‘yxat bo‘sh.'), buttons)

    def decide(self, uid, target, action):
        if target in self.main.admins:
            self.send(uid, 'Administrator ruxsatini bekor qilib bo‘lmaydi.')
            return
        choices = {'approve': ('pending', 'rejected', 'revoked'),
                   'reject': ('pending',), 'revoke': ('approved',)}
        if action not in choices:
            return
        decision = {'approve': 'approved', 'reject': 'rejected', 'revoke': 'revoked'}[action]
        placeholders = ','.join('?' for _ in choices[action])
        changed = self.db.execute(f'UPDATE users SET status=? WHERE id=? '
                                  f'AND status IN ({placeholders})',
                                  (decision, target, *choices[action])).rowcount
        self.db.commit()
        if not changed:
            self.send(uid, 'Holat allaqachon o‘zgargan. Ro‘yxatni qayta oching.')
            return
        # The database is authoritative even if the user has blocked Telegram messages.
        try:
            if decision == 'approved':
                self.main.send(target, 'Sizga botdan foydalanishga ruxsat berildi.')
                self.main.menu(target)
            else:
                self.main.send(target, 'Foydalanish so‘rovingiz rad etildi.' if decision == 'rejected'
                               else 'Botdan foydalanish ruxsatingiz bekor qilindi.')
        except Exception:
            pass
        self.send(uid, 'Tasdiqlandi.' if decision == 'approved' else
                  'Rad etildi.' if decision == 'rejected' else 'Foydalanuvchi ruxsati bekor qilindi.')

    def handle(self, update):
        callback = update.get('callback_query')
        message = update.get('message', {})
        actor = (callback or message).get('from', {}).get('id')
        if actor not in self.main.admins:
            if callback:
                self.api('answerCallbackQuery', callback_query_id=callback['id'],
                         text='Faqat administrator uchun.')
            elif message.get('chat', {}).get('type') == 'private':
                self.api('sendMessage', chat_id=actor, text='Bu bot faqat administrator uchun.')
            return
        if callback:
            if callback.get('message', {}).get('chat', {}).get('type') != 'private':
                return
            self.api('answerCallbackQuery', callback_query_id=callback['id'])
            parts = callback.get('data', '').split(':')
            if len(parts) == 3 and parts[0] == 'list' and parts[2].isdigit():
                self.listing(actor, parts[1], int(parts[2]))
            elif len(parts) == 2 and parts[1].isdigit():
                target = int(parts[1])
                if parts[0] == 'user':
                    self.card(actor, target)
                elif parts[0] == 'revokeask':
                    self.send(actor, f'{target} foydalanuvchining ruxsatini bekor qilasizmi?', [[
                        {'text': '🚫 Ha, bekor qilish', 'callback_data': f'revoke:{target}'},
                        {'text': 'Orqaga', 'callback_data': f'user:{target}'}]])
                else:
                    self.decide(actor, target, parts[0])
        elif message.get('chat', {}).get('type') == 'private':
            text = message.get('text', '')
            if text in (USERS, '/users'):
                self.listing(actor, 'users')
            elif text in (REQUESTS, '/requests'):
                self.listing(actor, 'pending')
            elif text == BLOCKED:
                self.listing(actor, 'blocked')
            else:
                self.send(actor, 'Onko administrator\nKirish so‘rovlari va foydalanuvchilarni boshqaring.')

    def notify_pending(self):
        pending = self.db.execute("SELECT id FROM users WHERE status='pending' ORDER BY id").fetchall()
        for (target,) in pending:
            for admin in self.main.admins:
                if self.db.execute('SELECT 1 FROM admin_notices WHERE uid=? AND admin=?',
                                   (target, admin)).fetchone():
                    continue
                try:
                    self.card(admin, target)
                    self.db.execute('INSERT OR IGNORE INTO admin_notices VALUES (?, ?)', (target, admin))
                    self.db.commit()
                except Exception:
                    logging.warning('Administrator must start the admin bot to receive requests.')

    def run(self):
        row = self.db.execute("SELECT value FROM settings WHERE key='admin_offset'").fetchone()
        offset = row[0] if row else 0
        while True:
            try:
                updates = self.api('getUpdates', offset=offset, timeout=2,
                                   allowed_updates=['message', 'callback_query'])
                for update in updates:
                    self.handle(update)
                    offset = update['update_id'] + 1
                    self.db.execute("INSERT OR REPLACE INTO settings VALUES ('admin_offset', ?)", (offset,))
                    self.db.commit()
                self.notify_pending()
            except KeyboardInterrupt:
                break
            except Exception:
                logging.warning('Admin request failed; retrying.')
                time.sleep(3)


if __name__ == '__main__':
    load_env()
    if os.environ.get('HOSTED_MODE') == '1':
        raise SystemExit('Bot Google Apps Script’da ishlaydi. Mahalliy polling o‘chirilgan.')
    main = Bot(os.environ['BOT_TOKEN'], [int(x) for x in os.environ['ADMIN_IDS'].split(',')],
               os.environ['SHEETS_URL'], os.environ['SHEETS_SECRET'])
    AdminBot(os.environ['ADMIN_BOT_TOKEN'], main).run()
