# EduMapping
### A Comprehensive Campus Recruitment & Career Development Platform

> **IOHE Project (22CS422) | Chitkara University, Punjab**
> **Student:** Saksham Panjla (2210990766)
> **Supervised By:** Dr. Gurpreet Singh, Associate Professor & Placement Incharge, CSE Department

---

## About the Project

EduMapping is a full-stack web platform that digitizes campus recruitment, placement management, and career development for the Indian education ecosystem. It connects **educational institutions** (universities, colleges, schools), **students**, and **corporate recruiters** through a single, role-aware, scalable application.

The platform eliminates fragmented manual processes by providing a unified system where Training and Placement Officers (TPOs) can manage placement activities, students can discover and apply for jobs, and recruiters can access verified candidate profiles — all with enterprise-grade security and compliance.

---

## Repository Structure

```
Edumapping/
├── client/                          # React 18 Frontend (SPA)
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Page-level components
│   │   ├── store/                   # Zustand state management
│   │   └── utils/                   # Utility functions
│   └── package.json
│
├── server/                          # Node.js / Express.js Backend
│   ├── src/
│   │   ├── routes/                  # API route handlers
│   │   ├── models/                  # Sequelize database models
│   │   ├── middleware/              # Auth, validation, rate limiting
│   │   ├── services/                # Business logic services
│   │   └── utils/                   # Helper utilities
│   └── package.json
│
├── docs/                            # IOHE Submission Documents
│   ├── EduMapping_Project_Report.docx
│   ├── EduMapping_PPT.pptx
│   └── Copyright_Submission.md
│
├── DEPLOYMENT_GUIDE.txt             # Step-by-step deployment guide
├── DEPLOYMENT_HOSTINGER.md          # Hostinger-specific deployment
├── QUICK_DEPLOY.md                  # Quick deployment reference
├── Copyright_Submission_CampusConnect.md   # Copyright filing document
└── README.md
```

---

## Features

### For Students
- Job and internship discovery with multi-criteria filtering
- One-click application submission and status tracking
- Resume upload and management
- Psychometric assessments and personalized career recommendations
- Event and workshop registration
- Real-time notifications for new opportunities

### For Recruiters
- Post job and internship openings with detailed specifications
- Access verified student profiles from permitted institutions
- Filter candidates by academic year, stream, location, and skills
- Track applications and manage hiring pipelines
- Multi-location hiring management

### For Institutions (TPO / Admin / Faculty)
- Complete placement management dashboard
- Student profile and academic record management
- Event and workshop creation with attendance tracking
- Recruiter access control — grant or revoke institution-level permissions
- Placement analytics and reporting
- Psychometric assessment administration

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI Component Framework |
| Tailwind CSS | 3.x | Responsive Styling |
| Framer Motion | Latest | Animations |
| Zustand | Latest | State Management |
| React Hook Form | Latest | Form Handling |
| Axios + React Query | Latest | API Communication |
| React Router DOM | v6 | Client-side Routing |
| Recharts | Latest | Data Visualization |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | v18+ | Runtime Environment |
| Express.js | 4.19.2 | Web Framework |
| PostgreSQL | 14+ | Relational Database |
| Sequelize ORM | 6.x | Database Abstraction |
| JWT (jsonwebtoken) | 9.0.2 | Authentication |
| bcryptjs | Latest | Password Hashing |
| MinIO SDK | 7.1.3 | File Storage (S3-compatible) |
| Nodemailer | 6.9.14 | Email / OTP Delivery |
| Redis / IORedis | Latest | Caching |
| Helmet.js | Latest | Security Headers |
| express-rate-limit | Latest | Rate Limiting |
| PDFKit | 0.15.0 | Resume PDF Generation |
| Swagger | Latest | API Documentation |

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- PostgreSQL 14+
- Redis
- MinIO (or any S3-compatible storage)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/Saksham-20/Edumapping.git
cd Edumapping
```

**2. Install server dependencies**
```bash
cd server
npm install
```

**3. Install client dependencies**
```bash
cd ../client
npm install
```

**4. Configure environment variables**

Create a `.env` file in the `server/` directory:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=edumapping
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=edumapping

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**5. Run database migrations**
```bash
cd server
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

**6. Start the development servers**
```bash
# Start backend (from server/)
npm run dev

# Start frontend (from client/)
npm start
```

The API server runs on `http://localhost:5000` and the React app on `http://localhost:3000`.

---

## API Documentation

Full interactive API documentation is available via Swagger UI at:
```
http://localhost:5000/api-docs
```

### API Route Groups

| Route | Description |
|---|---|
| `/api/auth` | Authentication, OTP verification, password recovery |
| `/api/users` | User profile management |
| `/api/admin` | Administrative functions |
| `/api/organizations` | Organization management |
| `/api/jobs` | Job postings and applications |
| `/api/events` | Event creation and management |
| `/api/assessments` | Psychometric testing |
| `/api/achievements` | Student achievement tracking |
| `/api/files` | File upload and secure retrieval |
| `/api/notifications` | Notification delivery |
| `/api/statistics` | Placement analytics |
| `/api/analytics` | Advanced analytics |
| `/api/resume` | Resume generation |
| `/api/approvals` | Approval workflows |

---

## Security

- **Passwords** — hashed with bcryptjs (cost factor 10), never stored in plaintext
- **Authentication** — stateless JWT tokens with role and userId payload
- **OTP** — bcrypt-hashed, 10-minute TTL, rate-limited delivery via Nodemailer
- **Rate Limiting** — express-rate-limit on all auth and sensitive endpoints
- **HTTP Headers** — Helmet.js enforces HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Input Validation** — express-validator + Joi on all request bodies
- **SQL Injection** — eliminated via Sequelize ORM parameterized queries
- **Access Control** — recruiter permissions validated at API layer, all access logged in AuditLogs

---

## Database Schema

The application uses 17 core entities:

`Users` · `StudentProfile` · `RecruiterProfile` · `Organizations` · `Jobs` · `Applications` · `Events` · `EventRegistrations` · `Assessments` · `AssessmentResults` · `Achievements` · `Files` · `Notifications` · `AuditLogs` · `OtpVerifications` · `RecruiterAllowedOrganizations` · `Contacts`

Key design decisions:
- Polymorphic user model with role-based profile extensions
- `RecruiterAllowedOrganizations` junction table for granular permission management
- 4-tier geographic hierarchy: **Region → State → City → Zone**
- `AuditLogs` for compliance-grade access tracking

---

## Deployment

Refer to the deployment guides included in this repository:
- [`DEPLOYMENT_GUIDE.txt`](./DEPLOYMENT_GUIDE.txt) — General step-by-step guide
- [`DEPLOYMENT_HOSTINGER.md`](./DEPLOYMENT_HOSTINGER.md) — Hostinger VPS deployment
- [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) — Quick reference

The application supports deployment on **Hostinger**, **AWS**, or any Linux VPS with PM2 for process management.

---

## IOHE Submission Documents

The following documents are submitted as part of the Industry Oriented Hands-On Experience (IOHE) programme (22CS422), Chitkara University:

| Document | Description |
|---|---|
| `docs/EduMapping_Project_Report.docx` | Full project report in university format |
| `docs/EduMapping_PPT.pptx` | Project presentation with Chitkara letterhead |
| `Copyright_Submission_CampusConnect.md` | Copyright filing document for EduMapping |

---

## Project Details

| Field | Details |
|---|---|
| **Programme** | IOHE (22CS422) |
| **University** | Chitkara University, Punjab |
| **Department** | Computer Science and Engineering |
| **Student** | Saksham Panjla |
| **Roll Number** | 2210990766 |
| **Supervisor** | Dr. Gurpreet Singh |
| **Designation** | Associate Professor & Placement Incharge, CSE Department |
| **Academic Year** | 2024 – 2025 |

---

## License

This software is an original work developed as part of the IOHE academic programme at Chitkara University. All original source code, database design, API design, UI/UX, business logic, and system architecture are the intellectual property of the author.

Third-party libraries and frameworks used in this project are governed by their respective open-source licenses (MIT, Apache 2.0, etc.) as listed in `package.json`.

See [`Copyright_Submission_CampusConnect.md`](./Copyright_Submission_CampusConnect.md) for full copyright details.
