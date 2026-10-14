# Railway migration

## Architecture
Railway receives the two Telegram webhooks, saves updates to a persistent SQLite queue, then delivers them to the existing authenticated Apps Script endpoint. Apps Script continues to execute the current bot, manage approvals, write Google Sheets, and update Dashboard. This is a staged migration, not a replacement of the Apps Script runtime. Legacy bot.py and admin_bot.py lack current production features and must not be started for production.

## Deploy
- Create a private GitHub repository for this directory; never upload .env, SQLite files, credentials or logs.
- Connect that repository to a new Railway service, using the included Dockerfile and railway.json.
- Mount a persistent Railway Volume at /data. Keep a single replica. Do not use an ephemeral filesystem for the queue.
- Set APPS_SCRIPT_URL to the existing /exec deployment, APPS_SCRIPT_WEBHOOK_KEY to its existing WEBHOOK_KEY, and TELEGRAM_WEBHOOK_SECRET to a newly generated random secret of at least 32 characters.
- Generate an HTTPS domain and verify /health returns {"ok":true}.
- Only after that, register main and admin Telegram webhooks to /telegram/main and /telegram/admin with secret_token equal to TELEGRAM_WEBHOOK_SECRET. Do not drop pending updates.
- Test /start, approvals, doctor/nurse reports, confirmation, daily sheet, and Dashboard. Restart Railway and verify queued updates survive.

## Rollback
Register both bots back to the existing Apps Script webhooks without dropping pending updates. Leave the Railway queue intact until processed updates are reconciled. Apps Script deduplicates route/update IDs.

## Checks
python3 -m unittest tests.test_gateway -v
node tests/test_hosted.cjs

No Telegram token is required in Railway for forwarding; registration uses the existing tokens separately. Secret values must never appear in Git, logs or URL screenshots. The HTTP health endpoint checks the delivery worker; downstream outages are retried without discarding reports. Completed queue records retain only update IDs, not message text.
