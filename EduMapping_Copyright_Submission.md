# COPYRIGHT SUBMISSION FORM
## EduMapping — Campus Recruitment & Career Development Platform

---

## 1. TITLE OF THE WORK

**EduMapping — A Comprehensive Campus Recruitment and Career Development Platform**

---

## 2. NATURE OF WORK / CATEGORY

**Software Application / Web Platform**

**Type:** Literary and Artistic Work (Computer Software)

**Format:** Web-based Application (Client-Server Architecture)

---

## 3. DESCRIPTION OF THE WORK

### 3.1 Overview

EduMapping is a comprehensive digital platform designed to revolutionize campus recruitment, career development, and institutional placement management for educational institutions, students, and recruiters in India. The platform serves as a bridge connecting colleges, schools, students, and employers through an integrated ecosystem of career services.

### 3.2 Purpose and Functionality

The software provides end-to-end solutions for:

**For Educational Institutions (Colleges, Universities, Schools):**
- Complete placement management system with TPO (Training and Placement Officer) dashboards
- Student profile and academic record management
- Event and workshop organization (industrial visits, career fairs, training programs)
- Psychometric assessment and career counseling tools
- Progress tracking and analytics for placement activities
- Multi-location and multi-institution support with hierarchical management (Region → State → City → Zone)

**For Students:**
- Job and internship discovery and application system
- Resume building and management tools
- Skill assessment and psychometric testing
- Career guidance and personalized counseling
- Workshop and training program enrollment
- Achievement tracking and portfolio building
- Event registration and participation management
- Real-time notifications for opportunities

**For Recruiters and Companies:**
- Candidate search and filtering with advanced criteria (institution type, year, stream, location)
- Permission-based access control to specific institutions
- Multi-location hiring management
- Work mode specification (Remote / Hybrid / On-site)
- Application tracking and management
- Job posting and requirement specification

### 3.3 Key Features and Modules

1. **Authentication & Security System**
   - Email/Phone-based login with identifier support
   - OTP-based email verification for registration and password recovery
   - Role-based access control (Student, Recruiter, Admin, TPO, Faculty)
   - Rate limiting and security measures
   - JWT token-based authentication
   - Audit logging for sensitive operations

2. **User Management**
   - Comprehensive user profiles for students, recruiters, faculty, and administrators
   - Multi-role support with granular permissions
   - Organization-based user grouping
   - Profile verification and approval workflows

3. **Organization Management**
   - Support for Universities, Colleges, Schools, and Companies
   - Location hierarchy (Region, State, City, Zone)
   - Multi-campus and branch management

4. **Placement & Job Management**
   - Job posting creation and management
   - Application submission and tracking
   - Candidate filtering by academic criteria, location, and skills
   - Recruiter permission system for institution-specific access
   - Placement statistics and reporting

5. **Event & Workshop System**
   - Event creation and management (workshops, seminars, career fairs)
   - Registration and attendance tracking
   - Multi-audience support
   - Event analytics and feedback collection

6. **Assessment & Career Guidance**
   - Psychometric testing platform
   - Career counseling tools
   - Skill assessment modules
   - Personalized career recommendations

7. **Notification System**
   - Real-time notifications for users
   - Email notifications via Nodemailer
   - Event-based notification triggers

8. **Analytics & Reporting**
   - Placement statistics dashboards
   - Student progress tracking
   - Recruiter activity analytics
   - Organization-wide performance metrics

9. **File Management**
   - Resume upload and storage via MinIO (S3-compatible)
   - Document management (certificates, transcripts)
   - Secure file access via pre-signed URLs

10. **Contact & Support**
    - Contact form system
    - WhatsApp integration for quick communication

### 3.4 Technical Architecture

**Frontend (Client):**
- Framework: React 18.2.0
- UI Libraries: Tailwind CSS, Framer Motion, Headless UI, Heroicons, React Slick
- State Management: Zustand
- Form Handling: React Hook Form
- API Communication: Axios with React Query
- Routing: React Router DOM v6
- Data Visualization: Recharts

**Backend (Server):**
- Runtime: Node.js (v18+)
- Framework: Express.js 4.19.2
- Database: PostgreSQL with Sequelize ORM
- Authentication: JWT (jsonwebtoken 9.0.2) + bcryptjs
- Validation: express-validator 7.2.0, Joi 17.13.3
- Security: Helmet.js, express-rate-limit, CORS
- File Storage: MinIO 7.1.3 (S3-compatible object storage)
- Email Service: Nodemailer 6.9.14
- Caching: Redis / IORedis
- PDF Generation: PDFKit 0.15.0
- Excel Support: XLSX 0.18.5
- API Documentation: Swagger (swagger-jsdoc + swagger-ui-express)
- Testing: Jest + Supertest

**Database Schema:**

The application uses a comprehensive relational database with the following core entities:
- Users, StudentProfile, RecruiterProfile
- Organizations
- Jobs, Applications
- Events, EventRegistrations
- Assessments, AssessmentResults
- Achievements, Files
- Notifications, AuditLogs
- OtpVerifications
- RecruiterAllowedOrganizations (junction table for access control)
- Contacts

### 3.5 API Structure

The backend exposes RESTful APIs organized by domain:
- `/api/auth` — Authentication and authorization
- `/api/users` — User management
- `/api/admin` — Administrative functions
- `/api/organizations` — Organization management
- `/api/jobs` — Job postings and applications
- `/api/events` — Event management
- `/api/assessments` — Assessment and testing
- `/api/achievements` — Student achievements
- `/api/files` — File upload and management
- `/api/notifications` — Notification system
- `/api/statistics` — Analytics and reporting
- `/api/analytics` — Advanced analytics
- `/api/contact` — Contact form handling
- `/api/resume` — Resume generation and management
- `/api/approvals` — Approval workflows

All APIs include Swagger documentation at `/api-docs`, a health check at `/api/health`, consistent error handling, request validation, authentication middleware, and role-based authorization.

---

## 4. LANGUAGE OF THE WORK

- **Primary Language:** JavaScript (ES6+)
- **Markup Languages:** HTML5, CSS3, JSX
- **Query Language:** SQL (PostgreSQL dialect)
- **Configuration:** JSON, YAML
- **Documentation:** Markdown, JSDoc comments

---

## 5. AUTHOR(S) / CREATOR(S) DETAILS

**Name:** Saksham Panjla

**University Roll Number:** 2210990766

**Role:** Developer, System Architect

**Contribution:** Complete system design, development, implementation, and testing of the EduMapping platform including full-stack application architecture, frontend React application development, backend API design and implementation, database schema design and optimization, security implementation, and UI/UX design and implementation.

**Institution:** Chitkara University Institute of Engineering and Technology, Punjab, India

**Department:** Computer Science and Engineering

**Academic Programme:** Bachelor of Engineering (Computer Science and Engineering)

**Supervised By:** Dr. Gurpreet Singh, Associate Professor & Placement Incharge, CSE Department, Chitkara University

**Project Repository:** https://github.com/Saksham-20/Edumapping

---

## 6. NATIONALITY / DOMICILE OF AUTHOR(S)

**Country:** India

---

## 7. DATE OF CREATION / FIRST PUBLICATION

**Year of Creation:** 2024 – 2025

**Version:** 1.0.0

**Current Status:** Completed (IOHE Project Submission)

---

## 8. WHETHER THE WORK HAS BEEN PUBLISHED

**Publication Status:** Unpublished (Academic Project)

**Nature:** The software was developed as part of the Industry Oriented Hands-On Experience (IOHE) academic programme (22CS422) at Chitkara University, Punjab. It has not been publicly released as open-source or commercial software.

---

## 9. CLASS OF WORK

**Literary Work — Computer Software**

**Sub-category:**
- Application Software
- Web Application
- Database-driven Software
- Client-Server Software

---

## 10. DETAILS OF ORIGINALITY

### 10.1 Original Components

This work is an **original creation** consisting of:

1. **Original Source Code**
   - All JavaScript / JSX code for frontend components
   - All Node.js backend code for API endpoints and services
   - Database models and migration scripts
   - Custom middleware and utility functions

2. **Original Database Design**
   - Comprehensive relational database schema with 17 core entities
   - Custom permission and access control system (RecruiterAllowedOrganizations)
   - Optimized indexes and query structures

3. **Original Algorithms and Business Logic**
   - Recruiter permission and access control algorithm
   - OTP generation and verification system
   - Advanced filtering engine with multi-criteria support
   - Location hierarchy implementation (Region → State → City → Zone)
   - Event registration and capacity management system
   - Assessment scoring and career recommendation engine

4. **Original UI/UX Design**
   - Custom React components
   - Responsive layouts and page designs
   - Animation and interaction patterns using Framer Motion
   - Indian tricolor-inspired color scheme (Orange #FF9933, Green #138808, Blue #156395)

5. **Original System Architecture**
   - API design and endpoint structure (50+ endpoints across 16 route groups)
   - Authentication and authorization flow (JWT + OTP dual-flow)
   - File storage integration architecture (MinIO/S3)
   - Notification system design
   - Caching strategy (Redis)

### 10.2 Third-Party Components and Acknowledgements

The following open-source libraries are used under their respective licenses:

**Frontend:** React (MIT), React Router (MIT), Tailwind CSS (MIT), Framer Motion (MIT), Axios (MIT), React Hook Form (MIT), Recharts (MIT), Zustand (MIT)

**Backend:** Express.js (MIT), Sequelize (MIT), PostgreSQL driver (PostgreSQL License), Nodemailer (MIT), JWT libraries (MIT), bcryptjs (MIT), MinIO SDK (Apache 2.0), Helmet (MIT), CORS (MIT)

All application-specific code, business logic, database design, system architecture, and original implementations are the intellectual property of the author and constitute the copyrightable work.

---

## 11. DISTINCTIVE FEATURES OF THE WORK

1. **Multi-Audience Platform Design** — Single platform serving schools, colleges, universities, students, and recruiters with audience-specific content and features.

2. **Granular Recruiter Permission System** — Institution-level access control enforced at the API layer (not just frontend), with full audit logging for compliance.

3. **Integrated Career Development Ecosystem** — Combines placements, training, workshops, and psychometric counseling in one platform with end-to-end student journey tracking.

4. **Geographic Hierarchy Implementation** — Four-tier location system (Region → State → City → Zone) optimized for the Indian institutional landscape.

5. **Dual OTP-Based Security** — Email OTP for registration and password recovery, with bcrypt hashing, 10-minute TTL, and rate limiting.

6. **Educational Institution Focus** — Specifically designed for Indian education and recruitment workflows including TPO dashboards and academic year/stream-based filtering.

---

## 12. SCOPE OF COPYRIGHT CLAIM

The author claims copyright protection for:

1. All original source code for both frontend (client) and backend (server) components
2. Database schema design and all migration scripts
3. API design and implementation including endpoint structure and data formats
4. User interface design including layouts, components, and visual design elements
5. Business logic and algorithms specific to the application
6. System architecture and integration patterns
7. Documentation including code comments, API documentation, and user guides

**Exclusions:** Third-party open-source libraries (covered by their own licenses), general programming concepts, and abstract ideas.

---

## 13. RIGHTS HOLDER / CLAIMANT DETAILS

**Name of Copyright Owner:** Saksham Panjla

**University Roll Number:** 2210990766

**Institution:** Chitkara University Institute of Engineering and Technology, Punjab, India

**Department:** Computer Science and Engineering

---

## 14. DECLARATION

I hereby declare that:

1. The particulars given above are true to the best of my knowledge and belief.
2. I am the author of the work mentioned above and the work is original.
3. The work has not been published earlier or submitted to any other institution for any award.
4. I have not assigned or licensed the work to any other person or entity.
5. The work does not infringe upon any existing copyright or intellectual property rights.
6. All third-party components used are properly licensed and acknowledged.

---

**Place:** Rajpura, Punjab

**Date:** May 2025

**Name:** Saksham Panjla

**University Roll Number:** 2210990766

**Supervised By:** Dr. Gurpreet Singh
Associate Professor & Placement Incharge
CSE Department, Chitkara University

---

## 15. TECHNICAL SPECIFICATIONS SUMMARY

| Specification | Details |
|---|---|
| Lines of Code | ~50,000+ (Frontend + Backend) |
| Number of Source Files | 100+ |
| Database Tables | 17 core entities |
| API Endpoints | 50+ RESTful endpoints |
| User Roles | 5 (Student, Recruiter, Admin, TPO, Faculty) |
| Organization Types | 4 (University, College, School, Company) |
| Geographic Levels | 4 (Region, State, City, Zone) |
| Frontend Framework | React 18.2.0 |
| Backend Framework | Express.js 4.19.2 |
| Database | PostgreSQL 14+ |
| Node Version | v18.0.0+ |
| Browser Support | Chrome, Firefox, Safari, Edge |

---

## 16. ATTACHMENTS / SUPPORTING DOCUMENTS

1. ✅ Complete source code repository — https://github.com/Saksham-20/Edumapping
2. ✅ Project Report — `EduMapping_Project_Report.docx`
3. ✅ Project Presentation — `EduMapping_PPT.pptx`
4. ✅ API documentation (Swagger/OpenAPI) — available at `/api-docs` when server is running
5. ✅ Proof of authorship — Git commit history at https://github.com/Saksham-20/Edumapping/commits/main

---

*This document is submitted as part of the IOHE (22CS422) programme, Chitkara University, Punjab, India.*
*Academic Year: 2024 – 2025*
