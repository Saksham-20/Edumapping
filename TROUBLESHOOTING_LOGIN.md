# Login Error Troubleshooting Guide

If you're experiencing login errors, follow these steps to diagnose and fix the issue:

## Common Issues and Solutions

### 1. **Network/Connection Errors**

**Symptoms:**
- "Network Error" or "Failed to fetch"
- Request timeout
- CORS errors in browser console

**Solutions:**
- Ensure the backend server is running:
  ```bash
  cd server
  npm start
  ```
- Check if the API URL is correct in `client/.env`:
  ```
  REACT_APP_API_URL=http://localhost:5000/api
  REACT_APP_API_PORT=5000
  ```
- Verify the backend is accessible at `http://localhost:5000`

### 2. **Invalid Credentials**

**Symptoms:**
- "Invalid credentials" error
- "Invalid email or password"

**Solutions:**
- Verify you're using the correct credentials from `server/CREDENTIALS.md`
- Default password for all seeded users: `password123`
- Check that the email is correct (case-sensitive)
- Ensure the database has been seeded:
  ```bash
  cd server
  npm run db:migrate
  npm run db:seed
  ```

### 3. **Account Approval Status**

**Symptoms:**
- "Your account is pending approval"
- "Your account has been rejected"
- "Your account has been disabled"

**Solutions:**
- For seeded accounts, they should be pre-approved
- If you see this error, check the database:
  ```sql
  SELECT id, email, approval_status, is_active FROM users WHERE email = 'your-email@example.com';
  ```
- Update the account if needed:
  ```sql
  UPDATE users SET approval_status = 'approved', is_active = true WHERE email = 'your-email@example.com';
  ```

### 4. **Database Connection Issues**

**Symptoms:**
- "Database connection error"
- "SequelizeConnectionError"

**Solutions:**
- Check database is running (PostgreSQL)
- Verify `.env` file in `server/` directory has correct database credentials:
  ```
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=your_database_name
  DB_USER=your_username
  DB_PASSWORD=your_password
  ```
- Test database connection:
  ```bash
  cd server
  npm run db:migrate
  ```

### 5. **Token/Response Format Issues**

**Symptoms:**
- "Invalid response from server"
- Login succeeds but redirect fails
- Console errors about tokens

**Solutions:**
- Clear browser localStorage:
  ```javascript
  localStorage.clear();
  ```
- Check browser console for detailed error messages
- Verify the backend is returning tokens in the correct format:
  ```json
  {
    "message": "Login successful",
    "user": {...},
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
  ```

## Debugging Steps

### Step 1: Check Browser Console
Open browser DevTools (F12) and check:
- **Console tab**: Look for JavaScript errors
- **Network tab**: Check the login request:
  - Status code (should be 200)
  - Response body
  - Request payload

### Step 2: Check Backend Logs
Look at the server terminal for:
- Database connection logs
- Authentication logs
- Error messages

### Step 3: Test API Directly
Use curl or Postman to test the login endpoint:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edumapping.com","password":"password123"}'
```

### Step 4: Verify Database
Check if users exist in the database:
```sql
SELECT id, email, role, approval_status, is_active FROM users;
```

## Quick Fixes

1. **Restart both servers:**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm start
   
   # Terminal 2 - Frontend
   cd client
   npm start
   ```

2. **Clear browser cache and localStorage:**
   - Open DevTools (F12)
   - Application tab → Clear storage → Clear site data

3. **Re-seed the database:**
   ```bash
   cd server
   npm run db:migrate:undo:all
   npm run db:migrate
   npm run db:seed
   ```

4. **Check environment variables:**
   - Ensure `server/.env` exists and has correct values
   - Ensure `client/.env` exists (if needed)

## Still Having Issues?

1. Check the exact error message in the browser console
2. Check the network request/response in DevTools
3. Check backend server logs for detailed error information
4. Verify all dependencies are installed:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

## Test Credentials

Use these credentials to test login:

**Admin:**
- Email: `admin@edumapping.com`
- Password: `password123`

**College Student:**
- Email: `john.doe@techuniversity.edu`
- Password: `password123`

**School Student:**
- Email: `rahul.sharma@dpsdelhi.edu.in`
- Password: `password123`

See `server/CREDENTIALS.md` for all available test accounts.



