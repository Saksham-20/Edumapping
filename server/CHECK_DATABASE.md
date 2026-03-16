# Checking Database and Seeding

## Issue: Invalid Credentials

If you're getting "Invalid credentials", it could mean:
1. The database hasn't been seeded
2. The user doesn't exist
3. Wrong password

## Quick Check

Run these commands to verify and seed the database:

```bash
cd server

# Check if users exist
npm run db:migrate

# Seed the database (creates all test users)
npm run db:seed
```

## Verify Users Exist

After seeding, you should have these users:
- admin@edumapping.com
- tpo@techuniversity.edu
- recruiter@techcorp.com
- john.doe@techuniversity.edu
- rahul.sharma@dpsdelhi.edu.in
- etc.

## Test Credentials

All seeded users use password: **`password123`**

## If Still Getting Invalid Credentials

1. Make sure you're using the exact email from `CREDENTIALS.md`
2. Make sure password is exactly: `password123` (no spaces, case-sensitive)
3. Check server logs for detailed error messages
4. Try a different user account from `CREDENTIALS.md`



