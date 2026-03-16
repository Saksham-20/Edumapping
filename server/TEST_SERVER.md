# Testing Server Connection

The server is running and waiting for requests. This is **normal behavior** - the process should stay running.

## Quick Test

Open your browser and go to:
- **Health Check**: http://localhost:5000/api/health
- **API Docs**: http://localhost:5000/api-docs

Or test with PowerShell:
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health -Method GET
```

## The Server is Working If:

1. ✅ You see the log message: "Server started successfully"
2. ✅ You see: "Database synchronized"
3. ✅ The process is still running (not exited)

## Now Try Logging In

The server is ready! Go back to your frontend application and try logging in with:
- Email: `admin@edumapping.com`
- Password: `password123`

Or any other credentials from `CREDENTIALS.md`

## If You Need to Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

## If You Need to Restart

1. Stop the server (Ctrl+C)
2. Start it again:
   ```bash
   cd server
   npm start
   ```



