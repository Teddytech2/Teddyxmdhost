# TEDDY TECH BOT DEPLOYER

Vercel-oriented adaptation of the supplied hosting reference, branded for Teddy Tech. The frontend is a Vite/React static build. The Express API is bundled as a Vercel Node.js serverless function at `/api/*`; this is still a backend, but it does not need a separately hosted always-on server.

## Important architecture note

This is a Vercel serverless deployment, so it **does have a backend**: files in `api/` execute server-side. API keys must never be placed in frontend code.

The added Telegram review and public bot-catalogue endpoints use **MongoDB Atlas** via `MONGODB_URI`. However, the inherited dashboard/account/wallet/deployment API still uses PostgreSQL through Drizzle and `DATABASE_URL`. This ZIP does **not** claim that all legacy routes have been migrated to MongoDB; those routes still require PostgreSQL until a full data-access-layer migration is completed. Do not remove `DATABASE_URL` if you intend to use the inherited dashboard features.

## Telegram bot submission and approval

Open **Dashboard → Suggest a Bot** to submit a request from the website. New serverless endpoints:

- `POST /api/bot-requests` — signed-in users submit a bot name, description, GitHub repository, and HTTPS pairing URL. A review message is sent to the configured Telegram admin.
- `GET /api/bot-requests` — a signed-in user sees only their own submissions and statuses.
- `POST /api/telegram-webhook` — receives Telegram inline-button actions. The configured admin ID is checked before any status change.
- `GET /api/bots` — lists only approved, active catalogue entries.

Telegram review flow: **Mark Tested → Approve & Publish**. Approval is blocked until the request has been marked tested. Approving writes an active record into MongoDB, which makes it available from `/api/bots` without redeploying the frontend. Rejection and change-request actions do not publish the bot.

Configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID` (your numeric Telegram user ID), `TELEGRAM_ADMIN_CHAT_ID` (the private chat where notifications should be sent), `TELEGRAM_WEBHOOK_SECRET`, `MONGODB_URI`, and optionally `MONGODB_DB_NAME`. Set the Telegram webhook to `https://YOUR-PROJECT.vercel.app/api/telegram-webhook` with the same secret token in Telegram's `secret_token` parameter. For example, after replacing placeholders, call Telegram's `setWebhook` method with `url` and `secret_token`. Keep the bot token private.

The approval API stores requests and approved bots in MongoDB collections named `botRequests` and `bots`. It validates HTTPS URLs and requires repository URLs on `github.com`. It does not execute submitted repository code automatically. Test the code and pairing flow yourself before approving.

## Deploy to Vercel

1. Push the contents of this folder to a GitHub repository.
2. Import the repository into Vercel. Keep the project Root Directory at the repository root.
3. Vercel should use the included `vercel.json`. The build command is `pnpm run build`; the static output is `artifacts/junex/dist/public`.
4. Configure MongoDB Atlas for the Telegram submission/catalogue endpoints using `MONGODB_URI`. For the inherited dashboard/auth/wallet/deployment API, also create a managed PostgreSQL database, apply the Drizzle schema, and configure `DATABASE_URL`.
5. Add the Environment Variables below in **Settings → Environment Variables** for Production (and Preview if required):
   - `DATABASE_URL` (legacy dashboard API)
   - `MONGODB_URI` (Telegram approvals and approved bot catalogue)
   - `MONGODB_DB_NAME` (optional; defaults to `teddytech_deployer`)
   - `SESSION_SECRET` — random, at least 32 characters
   - `HEROKU_API_KEY` — Heroku Platform API key
   - `PAYSTACK_SECRET_KEY` — Paystack secret key
   - `FRONTEND_URL` — deployed site URL
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — Telegram approval flow
6. Redeploy after setting variables. Never commit `.env` or secret keys.

## Environment variables

See `.env.example`. The server intentionally fails closed if `SESSION_SECRET` is missing or too short.

## Included platform features from the reference

- React dashboard, account registration/login, template catalogue, deployment detail pages and wallet UI.
- Express API routes for accounts, deployments, templates, wallet/payments and admin management.
- Heroku integration is called from the server only.
- Signup now grants 10 starter coins. Built-in hosting plans charge 10 coins each by default; admins can manage plan settings in the app.
- Default coin conversion is KSh 2.50 per coin, matching the previously requested 20 coins for KSh 50 ratio.
- Support link: https://support-teddytech.zone.id/

## Vercel serverless limitations

Vercel functions are request-driven and can stop between requests. In-process timers, background monitors, in-memory settings caches and long-running deployment work are not durable serverless jobs. For reliable scheduled health checks or tasks that must continue after a request returns, use a scheduler/queue or a separate worker host. The existing app was designed for a long-running Express server, so verify long deployment operations under Vercel's function duration limits before production use.

## Before going live

- Configure the database and apply schema migrations.
- Configure Heroku and Paystack credentials in Vercel, not in frontend settings.
- Create/verify bot templates with working Git repository and pairing URLs; unknown URLs should not be advertised as ready.
- Verify Paystack webhook/callback configuration and test a payment end-to-end.
- Configure the first administrator account using the project's admin flow and review all default template access.
- Test registration, login, top-up verification, deployment, log retrieval, config edits, restart, and deletion in a non-production Heroku app first.

## Local development

Use Node.js 24 and pnpm (the workspace's declared package manager). Install dependencies with `pnpm install`, then build with `pnpm run build`. Run the API separately using the API package scripts and provide the environment variables above.
