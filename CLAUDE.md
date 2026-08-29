# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

EduMapping (repo dir still named `campusconnect`, old branding) — campus recruitment / placement platform. Two independent npm packages, no monorepo tooling:

- `server/` — Express 4 + Sequelize 6 + PostgreSQL API (port 5000)
- `client/` — Create React App (react-scripts 5), React 18, Tailwind 3 (port 3000, proxies `/api` to 5000 via `package.json` `proxy`)

Root `package.json` only has convenience scripts (`npm run install:all`, `build:client`, `start:server`, …); its dependency list is stale, install deps inside each package.

## Commands

### Server (`cd server`)

```bash
npm install
cp .env.example .env          # then fill DB_*, JWT_SECRET, JWT_REFRESH_SECRET
npm run db:create             # creates DB named by DB_NAME (default edumapping_dev)
npm run db:migrate
npm run db:seed               # seeded users all use password `password123` — see server/CREDENTIALS.md
npm run dev                   # nodemon src/server.js
npm start                     # production: node src/server.js
npm run db:migrate:undo       # roll back last migration
npm run db:reset              # drop + create + migrate + seed
npm run db:migrate:prod       # NODE_ENV=production migrate (used by `npm run build`)
```

- `npm test` runs jest but **there are no test files** in the repo. `npm run lint` runs eslint but **there is no eslint config** in `server/`, so it fails — don't rely on either.
- Sequelize CLI paths are pinned by `server/.sequelizerc` (`src/config`, `src/models`, `src/migrations`, `src/seeders`).
- Swagger UI: `http://localhost:5000/api-docs` (generated from JSDoc in `src/routes/*.js` and `src/models/*.js`). Health: `GET /api/health` (503 until DB connects).
- Dev-only debug endpoints exist under `/api/debug/*` (only mounted when `NODE_ENV=development`).
- Loose scripts in `server/` root (`fix-*-sequence.js`, `run-seeders.js`, `seed-schools-*.js`, `verify-login.js`, `test-auth.js`) are one-off maintenance/repair scripts, run with `node <file>`.

### Client (`cd client`)

```bash
npm install
npm start                     # CRA dev server, port 3000
npm run build                 # → client/build (note: build output is committed to git)
npm run lint / lint:fix       # eslint via react-app config in package.json
npm run format                # prettier
```

`REACT_APP_API_URL` overrides the API base; unset it in dev so the CRA proxy handles `/api`. Note `src/utils/constants.js` and a few pages (`ResumePage`, `Profile`) build absolute URLs from `REACT_APP_API_URL` separately from `services/api.js` — keep them consistent when changing it.

## Server architecture

**Request path:** `src/server.js` (loads `server/.env`, listens immediately, then `connectDB()` with retries) → `src/app.js` (helmet, CORS allowlist, rate limiters, request logging, 25s API timeout, swagger, DB-ready gate returning 503, route mounting, static client serving in prod, `errorHandler`).

**Layers per resource:** `routes/<x>.js` (express-validator chains + auth/rbac middleware) → `controllers/<x>Controller.js` (class instances; check `validationResult`, call models directly or a service, respond with `{ message, <resource>, pagination? }`) → `services/` (auth/OTP, email, files, notifications, resume PDF, recruiter access scoping) → `models/` (Sequelize, `underscored: true` so DB columns are snake_case while JS attributes are camelCase; associations wired in `models/index.js` via each model's `associate()`).

**Errors:** controllers `next(err)`; `middleware/errorHandler.js` maps Sequelize validation/DB/FK/unique errors to JSON. Log via `utils/logger` (has `sanitize.email()` etc.), not `console.log`.

**Auth:** `middleware/auth.js` `authenticateToken` verifies JWT (`JWT_SECRET`, payload `{ userId }`), loads the `User` with its `organization`, rejects inactive/pending/rejected users. `optionalAuth` variant for public listing endpoints. Access token 1h, refresh token 7d (`JWT_REFRESH_SECRET`), refreshed via `POST /api/auth/refresh`. Login accepts `identifier` (email or phone) or legacy `email`; registration and forgot-password use email OTPs stored bcrypt-hashed in `otp_verifications` (`OTP_EXPIRY_MINUTES`).

**RBAC:** `middleware/rbac.js` — `requireRole(...roles)`, `requireNotRole`, `requireOrganization`, `requireSameOrganization`, `requireOwnership`. Roles (`utils/constants.js` `USER_ROLES`, mirrored in `client/src/utils/constants.js`): `student`, `recruiter`, `tpo`, `admin`, plus school roles `principal`, `teacher`, `school_admin`, `career_counselor`. Organization types: `university`, `college`, `school`, `company`. Both are Postgres ENUMs — adding a value needs a migration with `ALTER TYPE … ADD VALUE` (see migrations 27, 28, 32).

**Approval workflow:** `User.approvalStatus` / `Organization.approvalStatus` (`pending|approved|rejected`) with `isActive` derived in `User` model hooks (admins bypass). New TPO/recruiter/org signups land in pending; `/api/approvals` and `/api/admin` flip them.

**Recruiter data scoping:** `services/recruiterAccessService.js` — recruiters only see students from orgs in `recruiter_allowed_organizations` (junction to `RecruiterProfile`), further narrowed by `allowedYears/Streams/Regions/States/Cities` on the profile. Empty allow-list ⇒ query must return nothing (`applyRecruiterOrgScope` forces `id = -1`). Any new student-listing endpoint for recruiters must go through this.

**Special org:** migration 30 guarantees an organization named `EduMapping`; events under it are "global" and visible to everyone.

**Files:** `services/fileService.js` writes to local `server/uploads/` (served at `/uploads`) unless `STORAGE_TYPE=minio`. Redis packages are installed but not used anywhere in `src/`.

**Live classes (LiveKit):** `services/livekitService.js` + `controllers/conferenceController.js` + `routes/conferences.js` (`/api/conferences`). Tables `conferences` / `conference_participants` (migrations 38, 39).

The classroom rule — teacher publishes video and screen share, students may only speak — is enforced by the SFU via the token claim `canPublishSources: [TrackSource.MICROPHONE]`, not by the UI. Things to know before touching this code:

- The Node SDK needs the **`TrackSource` enum**, not the lowercase wire strings; passing `'microphone'` throws.
- An **empty `canPublishSources` array means "all sources allowed"**. To deny publishing, set `canPublish: false` — never an empty array.
- `updateParticipant` replaces permissions **atomically**, so restate every field you want to keep.
- Kicking calls `removeParticipant({ revokeTokenTs })`, which only invalidates the token the user currently holds. The ban must also be persisted to `conference_participants.is_banned`, because the token endpoint would otherwise happily mint a fresh one. Same for hard mute.
- The webhook at `POST /api/conferences/webhook` is mounted in `app.js` **before `express.json()`** because the signature is computed over the raw body, and is exempt from the global rate limiter (a 100-student class would otherwise exhaust the window).
- Everything degrades to a 503 when `LIVEKIT_*` env vars are unset; the rest of the API is unaffected.

Deployment lives in [deploy/livekit/](deploy/livekit/) — config, systemd unit, nginx location block, an idempotent installer, and a runbook with the real capacity numbers for this VPS (~25–30 concurrent participants).

**DB config:** `src/config/database.js` searches several paths for `.env`, exports `development`/`test`/`production`. Production prefers `DB_*` vars, falls back to parsing `DATABASE_URL`; SSL forced on in production when using `DATABASE_URL`. In development `connectDB()` also runs `sequelize.sync({ alter: true })` — so dev schema can drift from migrations; migrations are still the source of truth for prod. Migrations 21–29 and the `fix-*-sequence.js` scripts exist because seeders insert explicit IDs and leave Postgres sequences behind.

**Rate limiting:** global limiter in `app.js` keyed by JWT `userId` (decoded, not verified) else IP; skipped for localhost in dev. Per-route limiters in `middleware/rateLimiter.js` (`authLimiter` 5/15min on login, `otpSendLimiter`, `uploadLimiter`, `applicationLimiter` 10/day, …). `app.set('trust proxy', 1)` because prod sits behind nginx.

## Client architecture

- `src/App.js` — all routes. Public: `/`, `/login`, `/login/college`, `/login/school`, `/register*`, `/pending-approval`, `/privacy`. Everything else wrapped in `ProtectedRoute` (optional `requiredRoles`) with `<Header />`. `/dashboard` renders `DashboardRouter`, which picks the dashboard component by `user.role` **and** `user.organization.type` (school orgs get `SchoolDashboard`/`PrincipalDashboard`/… instead of the college/university ones). `/conference/:id` is intentionally rendered **without** `<Header />` — the room is a full-viewport surface.
- **Landing page** — `src/pages/LandingPage.js` is only the shell (nav, in-page routing between Home/Features/About/Connect, footer); every section lives in [src/components/landing/](client/src/components/landing/), with shared atoms in `primitives.js`. Brand tokens (`ink`, `saffron`, `india`, `azure`), fluid `display*` type sizes and the animation keyframes are defined in `tailwind.config.js`; decorative motion is frozen under `prefers-reduced-motion` by a block at the end of `LandingPage.css`. Icons are Heroicons — no emoji.
- **Conference UI** — `src/pages/conference/ConferenceRoom.js` plus [src/components/conference/](client/src/components/conference/). `ControlBar` derives which buttons to show from `useLocalParticipantPermissions()` (the numeric protocol enum: CAMERA 1, MICROPHONE 2, SCREEN_SHARE 3), not from the role string, so it stays correct when a host changes room policy mid-session.
- State is React Context, not Zustand (README is wrong): `contexts/AuthContext.js` (reducer; `useAuth()` gives `user`, `isAuthenticated`, `login`, `register`, `logout`, `updateUser`) and `contexts/NotificationContext.js`. No react-query usage despite the dependency.
- `services/api.js` — single axios instance. Request interceptor adds `Bearer` token from `services/auth.js` (tokens in `localStorage`). Response interceptor **unwraps to `response.data`**, retries once after refreshing on 401, redirects to `/login` if refresh fails, and auto-toasts every non-401/403 error — so callers get the JSON body directly and usually shouldn't toast errors again. Other `services/*.js` are thin wrappers over it.
- Forms use react-hook-form (`components/forms/`); charts are Recharts wrappers in `components/admin/`; toasts via `react-hot-toast` with a custom renderer in `App.js`.
- Styling: Tailwind (`tailwind.config.js`, `@tailwindcss/forms`), plus `styles/index.css`, `styles/carousel.css` (react-slick), and `pages/LandingPage.css`.

## Deployment

Hostinger VPS: code at `/var/www/campusconnect`, API under PM2 as `edumapping-api`, nginx serves `client/build` and proxies `/api`. Server can also serve the client itself in production (`SERVE_CLIENT` != `false`). Details in `DEPLOYMENT_HOSTINGER.md`, `QUICK_DEPLOY.md`, `DEPLOYMENT_GUIDE.txt`. Each package has a `dockerfile` (node:18-alpine).

### Production VPS access

Hostinger KVM1 (1 vCPU / 4 GB / ~4 TB transfer), Ubuntu 24, root, key-only SSH. The key is already on the dev machine:

```bash
ssh tricityshadi-vps                                 # alias in ~/.ssh/config
ssh -i ~/.ssh/tricityshadi_vps root@178.16.138.82    # explicit
```

`edumapping.com` and `tricityshadi.com` both resolve to `178.16.138.82` — it is one shared box.

### Live production topology (verified 2026-08-29)

nginx site file: `/etc/nginx/sites-enabled/edumapping.com`. It serves
`client/build` statically at `/` and proxies `/api/` to the Node app.

**The API listens on `5001`, NOT 5000.** Port 5000 is taken by the unrelated
`ecom` app (pm2 id 4). PM2 process name for this project is `edumapping`
(id 0) — note `pm2 restart edumapping-api` from the older docs is wrong.

pm2 processes on the box: `edumapping` (5001), `ecom` (5000),
`edschool-backend` (3001), `college-placements-api` (5003),
`tricitylifeinsurance`, `cityfreshkart` (stopped).

⚠️ **nginx `proxy_pass` trailing-slash trap.** This caused a live outage:

```nginx
location /api/ { proxy_pass http://127.0.0.1:5001/; }   # BROKEN
location /api/ { proxy_pass http://127.0.0.1:5001;  }   # CORRECT
```

With a URI part (the trailing `/`), nginx **strips** the `/api/` prefix, so
`/api/health` reaches Express as `/health`. No such route exists, so the
catch-all serves `index.html` — every API call returns `200 text/html` instead
of JSON and the whole site silently stops working while still rendering. Without
the trailing slash the original URI is forwarded intact.

To diagnose this class of failure quickly: `curl -s localhost:5001/api/health`
should return `{"status":"OK","message":"EduMapping API is running",...}`. If
that JSON is fine but the same path through nginx returns HTML, the proxy
rewrite is the culprit, not the app. `deploy/triage-api-down.sh` automates this.

### ⚠️ Shared VPS — co-tenant safety rules

This host runs **multiple unrelated production sites**: tricitymatch, cityfreshkart, college-placements, ecom, edumapping.com, school.globoniks.com, tricitylifeinsurance. A careless command takes all of them down.

- **Never** `docker stop/rm/prune` globally, **never** `docker compose down` from a shared directory, **never** blanket `systemctl restart docker`.
- **nginx**: edit only this project's site file. Always `nginx -t` before any reload — a bad global config breaks *every* site on the box.
- **Ports already in use**: `80`, `443`, `3000`, `3001`, `3002`, `5000`, `5001`, `5002`, `5003`, `5006`, `9000`, `9001`. Pick a free port for anything new or it will collide with a live site.
- Prefer targeted restarts (`pm2 restart edumapping-api`) over service-wide ones.

## Other repo notes

- `EDUMAPPING_BACKEND_CHANGES.md` documents the phased backend changes (OTP auth, institution model, recruiter access) and is the best explanation of *why* migrations 31–37 exist.
- `todo` (root) is the owner's informal task list (rebranding, contact info, recruiter access levels).
- `docs/`, `EduMapping_Copyright_Submission.md` are academic submission artifacts, not code docs.
- Contact/branding strings (`info@edumapping.com`, WhatsApp number in `components/common/WhatsAppChat.js`, landing copy) are hardcoded in the client.
