# EDUMAPPING — Backend Implementation Summary

Incremental backend changes only. No full rewrites; existing endpoints preserved with backward compatibility.

---

## PHASE 1 — AUTHENTICATION

### Current behavior (before)
- Login: `POST /api/auth/login` with `email` + `password` only.
- Registration: `POST /api/auth/register` with email, password, role, etc.; no OTP.
- Forgot password: JWT reset link (email send commented out); no OTP.
- No rate limiting on login/register; no OTP storage.

### Missing features
- Single login with **identifier** (email OR phone).
- **Email OTP** for registration (send → verify before activation).
- **Email OTP** for forgot password.
- Rate limiting, OTP expiry (5–10 min), hashed OTP storage, no account enumeration, legacy user support.

### Safe change plan
1. Add `otp_verifications` table (hashed OTP, purpose, expiry).
2. Keep existing login/register; extend login to accept `identifier` (email or phone); add optional OTP flow for registration and forgot password.
3. Apply auth rate limiter and OTP send limiter; same generic response for “not found” to prevent enumeration.

### Migrations
- **31-create-otp-verifications.js**: Table `otp_verifications` (identifier, otp_hash, purpose: registration | forgot_password, expires_at, used_at). Indexes on (identifier, purpose), expires_at.

### Backend patches
- **models/OtpVerification.js**: New model.
- **models/index.js**: Register OtpVerification.
- **services/authService.js**:
  - OTP: generate 6-digit, bcrypt hash, store in OtpVerification; expiry via `OTP_EXPIRY_MINUTES` (default 10).
  - `sendRegistrationOtp(email)`, `verifyRegistrationOtp(email, otp)`, `sendForgotPasswordOtp(email)`, `resetPasswordWithOtp(email, otp, newPassword)`.
  - `_findUserByIdentifier(identifier)` for email or phone lookup; `login(identifier, password)` supports both (legacy `email` still accepted).
  - Registration accepts optional `otp`; if present, verifies OTP then creates user.
- **services/emailService.js**: `sendOtpEmail(to, otp, purpose)`.
- **routes/auth.js**:
  - Login: body `identifier` or `email` + `password`; `authLimiter` applied.
  - `POST /auth/register/send-otp` (otpSendLimiter), `POST /auth/forgot-password/send-otp`, `POST /auth/forgot-password/reset-with-otp`.
  - Registration validation allows optional `otp`.
- **middleware/rateLimiter.js**: `otpSendLimiter` (15 min window, configurable max via `OTP_RATE_LIMIT_MAX`).

---

## PHASE 2 — INSTITUTION MODEL

### Current behavior
- Organizations: type `university | company | school`. Students linked via `users.organization_id`. StudentProfile has year, course, branch (no explicit “stream” alias). No region/state/city/zone on organizations.

### Missing features
- Institution types: **School, College, University** (college added).
- Location hierarchy: **region, state, city, zone** on organizations.
- Students linked to institution (already via organizationId); year/stream (branch) already on StudentProfile.

### Safe change plan
- Add `college` to organization type enum. Add region, state, city, zone to organizations. Update role–organization rules to allow college for students and TPOs.

### Migrations
- **32-add-college-organization-type.js**: Add `college` to organizations type enum (PostgreSQL `ALTER TYPE ... ADD VALUE`).
- **33-add-organization-location-hierarchy.js**: Add columns region, state, city, zone to organizations; indexes on these columns.

### Backend patches
- **models/Organization.js**: type includes `college`; new fields region, state, city, zone.
- **services/authService.js**, **controllers/adminController.js**: Students allowed for university, college, school; TPOs for university, college.

---

## PHASE 3 — FILTER ENGINE

### Current behavior
- `GET /api/users`: filters role, organizationId, organizationType, isActive, search; pagination.
- `GET /api/users/role/:role`: role, organizationId; no pagination; no institution/geo filters.

### Missing features
- Academic: **institution type** (school/college/university), **year**, **stream** (branch).
- Geographic: **region, state, city, zone** (from organization).
- **Pagination** on getUsersByRole and optimized queries.

### Safe change plan
- Extend existing APIs with new query params; add pagination to getUsersByRole; single findAndCountAll with includes and optional org/studentProfile where clauses to avoid N+1.

### Migrations
- None.

### Backend patches
- **controllers/userController.js**:
  - **getAllUsers**: New query params institutionType (alias organizationType), year, stream, region, state, city, zone. Build orgWhere and studentProfileWhere; include Organization (with attributes) and StudentProfile with optional required/where. Pagination limit capped (e.g. 100).
  - **getUsersByRole**: Same filters; add page, limit; findAndCountAll with pagination and same include/where logic; response includes pagination object.

---

## PHASE 4 — RECRUITER PERMISSIONS

### Current behavior
- Recruiters can call GET /users and GET /users/role/student and see all students (or filtered by query). No backend restriction by allowed institutions.

### Missing features
- Admin assigns recruiter access to specific **schools, colleges, universities**.
- **Hard backend restriction**: recruiter can ONLY access students from allowed institutions (DB query + enforcement). Tampering must fail.
- Optional limits: year, stream, region, state, city, max institution count.
- **Audit logs** for recruiter access.

### Safe change plan
1. New table recruiter_allowed_organizations (recruiter_profile_id, organization_id). New columns on recruiter_profiles: max_institutions, allowed_years, allowed_streams, allowed_regions, allowed_states, allowed_cities (JSON).
2. Service to resolve allowed organization IDs for a recruiter; apply scope in userController for getAllUsers and getUsersByRole (and getTopCandidates). If allowed list empty → no rows (or 403 where appropriate).
3. Admin endpoint to set allowed organizations; audit log on update and on recruiter student-list access.

### Migrations
- **34-create-recruiter-allowed-organizations.js**: Table recruiter_allowed_organizations (recruiter_profile_id, organization_id, unique constraint). Columns on recruiter_profiles: max_institutions, allowed_years, allowed_streams, allowed_regions, allowed_states, allowed_cities (JSON).

### Backend patches
- **models/RecruiterAllowedOrganization.js**: New model; associations to RecruiterProfile and Organization.
- **models/RecruiterProfile.js**: New fields; hasMany RecruiterAllowedOrganization.
- **models/index.js**: Register RecruiterAllowedOrganization.
- **services/recruiterAccessService.js**: getAllowedOrganizationIds(recruiterUserId), applyRecruiterOrgScope(whereClause, allowedOrgIds), getRecruiterFilterLimits(recruiterUserId).
- **controllers/userController.js**: For req.user.role === 'recruiter', get allowed org IDs, apply scope to whereClause, create AuditLog (recruiter_student_list_access) for getAllUsers and getUsersByRole. getTopCandidates: restrict to allowed orgs and reject if target org not in list.
- **controllers/adminController.js**: setRecruiterAllowedOrganizations(recruiterUserId, organizationIds): validate orgs are school/college/university, replace junction rows, audit log.
- **routes/admin.js**: PUT /admin/recruiters/:id/allowed-organizations → setRecruiterAllowedOrganizations.

---

## PHASE 5 — COMPANY DATA STRUCTURE

### Current behavior
- RecruiterProfile: department, position, bio, experience, linkedinUrl. Organization (company): name, type, address, contactEmail, etc. No multiple locations, work mode, or hiring-region/stream/year on profile.

### Missing features
- **Multiple locations**, **work mode** (remote/hybrid/on-site), **hiring regions**, **eligible streams**, **eligible years**, **allowed institutions** (allowed institutions in Phase 4). Do not remove old fields.

### Safe change plan
- Add work_mode (STRING), locations (JSON), hiring_regions (JSON) to recruiter_profiles. Add work_mode, locations (JSON) to organizations. Eligible streams/years already added in Phase 4 (allowed_streams, allowed_years); allowed institutions in junction table.

### Migrations
- **35-add-recruiter-company-extended-fields.js**: recruiter_profiles: work_mode (VARCHAR 20), locations (JSON), hiring_regions (JSON). organizations: work_mode (VARCHAR 20), locations (JSON).

### Backend patches
- **models/RecruiterProfile.js**: workMode, locations, hiringRegions.
- **models/Organization.js**: workMode, locations.

---

## PHASE 6 — DATA SAFETY & PERFORMANCE

### Current behavior
- Central error handler (errorHandler.js), logger, validation (express-validator + handleValidationErrors). Some indexes on users, organizations, etc. N+1 possible in some stats endpoints.

### Missing features
- Indexing for login-by-phone and filter use; ensure validation and error handling are used consistently; logging; reduce N+1 where practical.

### Safe change plan
- Add index on users(phone). Keep existing central error handler and validation; list endpoints use findAndCountAll with includes to avoid N+1 for list queries.

### Migrations
- **36-add-users-phone-index.js**: Index on users(phone).

### Backend patches
- No additional code changes beyond existing error handler and validation. List/user endpoints already use single query with includes.

---

## API CONTRACT NOTES (BACKWARD COMPATIBILITY)

- **Login**: Request body may send `email` (legacy) or `identifier` (email or phone). Response shape unchanged.
- **Register**: Optional `otp` in body; if omitted, legacy direct registration still works.
- **GET /api/users**, **GET /api/users/role/:role**: New query params are optional; response adds `pagination` for getUsersByRole; shape of `users` unchanged.
- **New endpoints**: POST /auth/register/send-otp, POST /auth/forgot-password/send-otp, POST /auth/forgot-password/reset-with-otp, PUT /admin/recruiters/:id/allowed-organizations. No existing contracts changed.

---

## ENVIRONMENT / CONFIG

- **OTP_EXPIRY_MINUTES**: OTP validity in minutes (default 10).
- **OTP_RATE_LIMIT_MAX**: Max OTP send requests per 15 min window per IP (default 5); used by otpSendLimiter.

---

## FILES TOUCHED (SUMMARY)

- **New**: migrations 31–37, models OtpVerification, RecruiterAllowedOrganization, services recruiterAccessService, emailService.sendOtpEmail.
- **Modified**: auth (routes, authService), Organization, RecruiterProfile, User (none; login uses identifier in service), userController (getAllUsers, getUsersByRole, getTopCandidates), adminController (college/TPO rules, setRecruiterAllowedOrganizations), admin routes, rateLimiter, models/index.

All changes are backward compatible and patch-only; no full module rewrites.
