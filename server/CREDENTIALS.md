# Seeded Database Credentials

This document contains all login credentials for users seeded in the EduMapping database.

## Default Password
**All seeded users have the password: `password123`**

---

## Admin Account

### System Administrator
- **Email**: admin@edumapping.com
- **Password**: password123
- **Role**: admin
- **Name**: System Administrator
- **Phone**: +1-555-0001
- **Organization**: None (System Admin)
- **Login URL**: `/login`

**Notes:**
- Admin account has full system access
- Admin can approve users and organizations
- Admin account is pre-approved and active
- This account is verified by default

---

## TPO (Training & Placement Officer) Account

### Jane Smith
- **Email**: tpo@techuniversity.edu
- **Password**: password123
- **Role**: tpo
- **Name**: Jane Smith
- **Phone**: +1-555-0002
- **Organization**: Tech University (ID: 1)
- **Organization Type**: university
- **Login URL**: `/login/college`

**Notes:**
- TPO account has access to manage placements and students for their organization
- TPO account is pre-approved and active
- This account is verified by default

---

## Recruiter Accounts

### 1. Michael Johnson
- **Email**: recruiter@techcorp.com
- **Password**: password123
- **Role**: recruiter
- **Name**: Michael Johnson
- **Phone**: +1-555-0003
- **Organization**: TechCorp Industries (ID: 2)
- **Organization Type**: company
- **Login URL**: `/login`

### 2. Sarah Williams
- **Email**: hr@startupxyz.io
- **Password**: password123
- **Role**: recruiter
- **Name**: Sarah Williams
- **Phone**: +1-555-0004
- **Organization**: StartupXYZ (ID: 3)
- **Organization Type**: company
- **Login URL**: `/login`

**Notes:**
- Recruiter accounts can post jobs and manage applications
- All recruiter accounts are pre-approved and active
- All accounts are verified by default

---

## College Student Accounts

### College Organizations

#### Tech University (ID: 1)
- **Domain**: techuniversity.edu
- **Contact**: admin@techuniversity.edu
- **Address**: 123 University Ave, Tech City, TC 12345

#### Global Engineering College (ID: 4)
- **Domain**: gec.edu
- **Contact**: placement@gec.edu
- **Address**: 321 College Road, Engineering City, EC 24680

### Tech University Students

#### 1. John Doe
- **Email**: john.doe@techuniversity.edu
- **Password**: password123
- **Student ID**: TU2021001
- **Course**: Bachelor of Technology
- **Branch**: Computer Science Engineering
- **Year**: 4
- **Phone**: +1-555-0005
- **Login URL**: `/login/college`

#### 2. Alice Wilson
- **Email**: alice.wilson@techuniversity.edu
- **Password**: password123
- **Student ID**: TU2021002
- **Course**: Bachelor of Technology
- **Branch**: Computer Science Engineering
- **Year**: 3
- **Phone**: +1-555-0006
- **Login URL**: `/login/college`

#### 3. Emma Davis
- **Email**: emma.davis@techuniversity.edu
- **Password**: password123
- **Student ID**: TU2021003
- **Course**: Bachelor of Technology
- **Branch**: Computer Science Engineering
- **Year**: 4
- **Phone**: +1-555-0008
- **Login URL**: `/login/college`

### Global Engineering College Students

#### 4. Bob Martinez
- **Email**: bob.martinez@gec.edu
- **Password**: password123
- **Student ID**: GEC2020001
- **Course**: Bachelor of Technology
- **Branch**: Electrical Engineering
- **Year**: 4
- **Phone**: +1-555-0007
- **Login URL**: `/login/college`

**Notes:**
- All college students are pre-approved and active
- All accounts are verified
- Students belong to university organizations (type: 'university')
- After login, college students will be automatically routed to the College Dashboard

---

## School Student Accounts

### School Organizations

#### Delhi Public School (ID: 5)
- **Domain**: dpsdelhi.edu.in
- **Contact**: admin@dpsdelhi.edu.in
- **Address**: Mathura Road, New Delhi, Delhi 110076

#### Kendriya Vidyalaya No. 1 (ID: 6)
- **Domain**: kv1mumbai.edu.in
- **Contact**: principal@kv1mumbai.edu.in
- **Address**: Andheri West, Mumbai, Maharashtra 400053

### Delhi Public School Students

#### 1. Rahul Sharma
- **Email**: rahul.sharma@dpsdelhi.edu.in
- **Password**: password123
- **Student ID**: DPS2023001
- **Class**: 12 (Science Stream)
- **Phone**: +91-9876543210
- **Login URL**: `/login/school`

#### 2. Priya Patel
- **Email**: priya.patel@dpsdelhi.edu.in
- **Password**: password123
- **Student ID**: DPS2023002
- **Class**: 12 (Commerce Stream)
- **Phone**: +91-9876543211
- **Login URL**: `/login/school`

### Kendriya Vidyalaya No. 1 Students

#### 3. Arjun Kumar
- **Email**: arjun.kumar@kv1mumbai.edu.in
- **Password**: password123
- **Student ID**: KV2023001
- **Class**: 11 (Science Stream)
- **Phone**: +91-9876543212
- **Login URL**: `/login/school`

#### 4. Ananya Singh
- **Email**: ananya.singh@kv1mumbai.edu.in
- **Password**: password123
- **Student ID**: KV2023002
- **Class**: 11 (Science Stream)
- **Phone**: +91-9876543213
- **Login URL**: `/login/school`

**Notes:**
- All school students are pre-approved and active
- All accounts are verified
- Students belong to school organizations (type: 'school')
- After login, school students will be automatically routed to the SchoolDashboard with tabs for:
  - Workshops
  - Events
  - Co-Curricular
  - Assessments

---

## Setup Instructions

1. Run database migrations:
   ```bash
   cd server
   npm run db:migrate
   ```

2. Run seeders:
   ```bash
   npm run db:seed
   ```

3. Use the credentials above to log in to the application.

---

## Quick Reference

| Role | Email Example | Login URL |
|------|---------------|-----------|
| Admin | admin@edumapping.com | `/login` |
| TPO | tpo@techuniversity.edu | `/login/college` |
| Recruiter | recruiter@techcorp.com | `/login` |
| College Student | john.doe@techuniversity.edu | `/login/college` |
| School Student | rahul.sharma@dpsdelhi.edu.in | `/login/school` |

---

## Important Notes

- **All accounts use the password: `password123`**
- All accounts are pre-approved and active
- All accounts are verified by default
- These credentials are for **development/testing purposes only**
- **Change passwords in production environments**

