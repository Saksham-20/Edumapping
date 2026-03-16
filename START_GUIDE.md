# Campus Connect - Project Startup Guide

## Prerequisites

1. **Node.js** (version >= 18.0.0)
2. **npm** (version >= 9.0.0)
3. **PostgreSQL** database (running locally or remote)
4. **Git** (optional, for version control)

---

## Step-by-Step Setup

### Step 1: Install Dependencies

Install dependencies for both server and client:

```bash
# From project root
npm run install:all

# OR install separately:
cd server
npm install
cd ../client
npm install
```

### Step 2: Set Up Database

1. **Create PostgreSQL database:**
   ```sql
   -- Connect to PostgreSQL
   CREATE DATABASE edumapping_dev;
   ```

2. **Or use existing database** - make sure PostgreSQL is running

### Step 3: Configure Environment Variables

#### Server Environment (`server/.env`)

Create a `.env` file in the `server` directory with the following variables:

```env
# Database Configuration
DB_USERNAME=postgres
DB_PASSWORD=root
DB_NAME=edumapping_dev
DB_HOST=localhost
DB_PORT=5432

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@campusconnect.com

# File Storage (MinIO/S3 - optional for development)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=campusconnect-uploads
MINIO_USE_SSL=false

# Redis (optional for caching/rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Client Environment (`client/.env`)

Create a `.env` file in the `client` directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000
```

**Note:** If you don't create `.env` files, the app will use default values:
- Server defaults: `localhost:5000`, database `edumapping_dev`
- Client defaults: `http://localhost:5000/api`

### Step 4: Run Database Migrations

Run migrations to create database tables:

```bash
cd server
npm run db:migrate
```

This will create all necessary tables in your database.

### Step 5: (Optional) Seed Database

Populate the database with initial data:

```bash
cd server
npm run db:seed
```

### Step 6: Start the Server

Open a terminal and start the backend server:

```bash
cd server
npm start
```

Or for development with auto-reload:

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`)

**Verify server is running:**
- Health check: http://localhost:5000/api/health
- API docs: http://localhost:5000/api-docs

### Step 7: Start the Client

Open a **new terminal** and start the React frontend:

```bash
cd client
npm start
```

The client will start on `http://localhost:3000` and automatically open in your browser.

---

## Quick Start Commands

From the project root:

```bash
# Install all dependencies
npm run install:all

# Start server (in one terminal)
npm run start:server

# Start client (in another terminal)
npm run start:client
```

---

## Troubleshooting

### Database Connection Issues

1. **Check PostgreSQL is running:**
   ```bash
   # Windows
   services.msc (look for PostgreSQL service)
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. **Verify database credentials** in `server/.env`

3. **Test connection:**
   ```bash
   psql -U postgres -d edumapping_dev
   ```

### Port Already in Use

If port 5000 or 3000 is already in use:

1. **Change server port:** Update `PORT` in `server/.env`
2. **Change client port:** Update `REACT_APP_API_PORT` in `client/.env` or use:
   ```bash
   PORT=3001 npm start
   ```

### Migration Errors

If migrations fail:

```bash
# Check migration status
cd server
npx sequelize-cli db:migrate:status

# Undo last migration if needed
npm run db:migrate:undo
```

### Missing Dependencies

If you get module not found errors:

```bash
# Reinstall dependencies
cd server && npm install
cd ../client && npm install
```

---

## Development vs Production

### Development Mode
- Server: `npm start` or `npm run dev` (with nodemon)
- Client: `npm start` (React dev server with hot reload)
- Database: Uses `development` config from `database.js`

### Production Mode
- Set `NODE_ENV=production` in server `.env`
- Build client: `cd client && npm run build`
- Server serves static files from `client/build`
- Database: Uses `production` config (requires `DB_PASSWORD` and `DB_USERNAME` or `DATABASE_URL`)

---

## Project Structure

```
campusconnect/
├── server/          # Backend API (Node.js/Express)
│   ├── src/
│   │   ├── config/  # Database, Swagger configs
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   └── .env         # Server environment variables
│
└── client/          # Frontend (React)
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── App.js
    └── .env         # Client environment variables
```

---

## Next Steps

After starting the project:

1. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api
   - API Documentation: http://localhost:5000/api-docs

2. **Create an account** or use seeded data to login

3. **Explore features:**
   - Job postings
   - Applications
   - Events
   - Admin dashboard
   - User profiles

---

## Need Help?

- Check server logs in the terminal running `npm start` in server directory
- Check browser console for client-side errors
- Verify all environment variables are set correctly
- Ensure PostgreSQL is running and accessible








