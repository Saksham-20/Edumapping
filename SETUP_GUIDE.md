# College Placements - Setup Guide

This is a new instance of the CampusConnect platform configured specifically for the **College Placements** subdomain of Globoniks.

## Key Changes Made

### 1. Domain Configuration
- **Domain**: `college-placements.globoniks.com`
- **Subdomain**: College Placements (Globoniks)
- Updated all domain references from `campusconnect.com` to `college-placements.globoniks.com`

### 2. Removed Features
The following school-specific features have been removed:

#### Removed Auth Routes & Components:
- ❌ `SchoolLogin.js` - School login page
- ❌ `SchoolRegister.js` - School registration page
- ✅ Kept `CollegeLogin.js` - College login page
- ✅ Kept `CollegeRegister.js` - College registration page

#### Removed Dashboards:
- ❌ `SchoolDashboard.js` - School student dashboard
- ❌ `SchoolAdminDashboard.js` - School admin dashboard
- ❌ `PrincipalDashboard.js` - Principal dashboard
- ❌ `TeacherDashboard.js` - Teacher dashboard
- ❌ `CareerCounselorDashboard.js` - Career counselor dashboard

#### Removed User Roles:
- ❌ `principal`
- ❌ `teacher`
- ❌ `school_admin`
- ❌ `career_counselor`

✅ **Retained Roles**:
- `student` - College students
- `recruiter` - Company recruiters
- `tpo` - Training & Placement Officers
- `admin` - Platform administrators

### 3. Updated Configuration

#### Client Files:
- **`client/package.json`**: Updated proxy to `https://college-placements.globoniks.com/api`
- **`client/src/App.js`**: 
  - Removed all school login/register route imports
  - Removed all school dashboard imports
  - Simplified DashboardRouter component to only handle college roles
  - Removed school login/register routes from routing configuration
- **`client/src/utils/constants.js`**:
  - Removed school-related user roles from `USER_ROLES`
  - Updated storage keys from `campusconnect_` to `collegeplacements_`
  - Updated app name to "College Placements"
  - Updated company name to "Globoniks"
  - Updated support email to `support@college-placements.globoniks.com`

#### Server Files:
- **`server/.env`**: Updated domain references to `college-placements.globoniks.com`
- **`server/src/routes/auth.js`**: Removed school roles from registration validation

### 4. App Branding
- **App Name**: Changed from "CampusConnect" to "College Placements"
- **Company**: Changed to "Globoniks"
- **Support Email**: `support@college-placements.globoniks.com`
- **Documentation**: Points to `https://college-placements.globoniks.com/docs`

## Features Retained

✅ Job posting and management
✅ Student applications and tracking
✅ Recruiter dashboard
✅ TPO (Training & Placement Officer) portal
✅ Resume builder and upload
✅ Event management
✅ Notifications and alerts
✅ Analytics and reporting
✅ User profiles and authentication
✅ File management and storage

## Setup Steps

1. **Install Dependencies**:
   ```bash
   # Client
   cd client
   npm install
   
   # Server
   cd server
   npm install
   ```

2. **Environment Configuration**:
   - Update `.env` files with your configuration
   - Update database credentials
   - Configure email and file storage services

3. **Database Setup**:
   ```bash
   cd server
   npm run migrate
   npm run seed
   ```

4. **Run Development Servers**:
   ```bash
   # Terminal 1 - Client
   cd client
   npm start
   
   # Terminal 2 - Server
   cd server
   npm run dev
   ```

5. **Deploy to Production**:
   - Configure DNS records for `college-placements.globoniks.com`
   - Update environment variables for production
   - Set up SSL/TLS certificates
   - Configure database and storage backends
   - Deploy using your preferred hosting platform

## Project Structure

```
collegeplacements/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/      # College login/register (school removed)
│   │   │   ├── dashboard/ # College dashboards (school removed)
│   │   │   └── ...
│   │   └── utils/
│   │       └── constants.js # Updated app config
│   └── package.json        # Updated proxy
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API routes (school roles removed)
│   │   ├── models/        # Database models
│   │   └── ...
│   └── .env               # Updated domain config
└── README.md              # Project documentation
```

## Important Notes

- This instance is **college-only** and does not support school organizations
- All user registrations must select from the available college roles: student, recruiter, or tpo
- Admin account must be created separately with appropriate permissions
- Any existing database from CampusConnect will need data migration to work with this setup

## Support

For issues or questions about this College Placements setup, contact:
- Email: `support@college-placements.globoniks.com`
- Website: `https://college-placements.globoniks.com`

---
**Setup completed on**: March 15, 2026
**Version**: 1.0.0
