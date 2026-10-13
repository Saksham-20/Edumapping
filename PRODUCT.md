# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary — placement officers (TPOs) at tier-2/3 private engineering colleges in India.** Today they run each placement season on Excel sheets, WhatsApp groups and email. They work at a desk on a laptop through a long season (roughly July to April). Their job is to get every eligible student in front of recruiters, keep records clean and produce NIRF/NAAC numbers at year end.
- **Students** in those colleges, mostly on phones. Their job is to keep their profile verified, see the drives they qualify for, apply, follow their rounds and respond to offers.
- **Recruiters** from companies hiring on campus. Their job is to post drives with eligibility rules, shortlist by roll number, run rounds and raise offers.
- **Platform admins** (EduMapping staff). They approve institutions, companies and accounts, and watch the audit log.
- **School roles** (principal, teacher, school admin, career counsellor) already exist and are a secondary audience. They use career-guidance features, not placements.

## Product Purpose

EduMapping runs a college's whole placement season in one place, from verified student records to signed offer letters. Success means a placement cell can run a season without spreadsheets, and its NIRF/NAAC placement figures are defensible because every record behind them was checked.

## Positioning

**The school-to-career journey.** One platform follows a learner from school career guidance (workshops, counselling, psychometric testing, live classes) through college placement, under the line "From classroom to career." A college ERP or a placement-only portal (e.g. Superset) covers only the placement step. EduMapping's school and college sides share one identity and one record.

## Operating Context

- **Season rhythm:**
  - The cell imports the batch from a spreadsheet and verifies marksheets (CGPA, Class X/XII, backlogs). The record then locks.
  - The cell sets the season's placement policy: Regular / Dream / Super Dream tiers by CTC, offer caps and verified-only rules.
  - The cell approves each drive before students see it.
  - Drives run in rounds: online test, technical interview, HR interview.
  - Shortlists come back from companies as lists of roll numbers.
  - Offers arrive in the app, with an offer letter that the cell verifies.
- **Indian conventions:**
  - Salaries are in LPA/₹ lakh.
  - Students are identified by roll number.
  - Reports follow the NIRF/NAAC formats.
  - Calendars sync to Google/Outlook through .ics files.
- **Devices:** placement staff and recruiters work on desktops. Students use mid-range Android phones on variable networks.

## Capabilities and Constraints

- **Stack:** React 18 (CRA) + Tailwind 3 client; Express + Sequelize + Postgres API.
- **Hosting:** a shared Hostinger VPS (nginx, PM2), shared with other live sites.
- **Roles:** student, recruiter, tpo, admin, plus the school roles.
- **Live features:**
  - Approvals and announcements.
  - Placement policy engine.
  - Academic verification with locking.
  - Multi-round drives.
  - Offers with letter verification.
  - NIRF report with Excel export.
  - Drive calendar with .ics export.
  - Events and live classes (LiveKit).
  - Resume PDF builder.
  - Audit log.
  - "Ask EduMapping" assistant (Claude API; read-only tools over the student's own data).
- **Not built:**
  - SMS/WhatsApp notifications.
  - Alumni features.
  - QR attendance.
  - Native apps.

## Brand Commitments

- **Name:** EduMapping. **Tagline:** "From classroom to career." The legacy repo name campusconnect is internal only.
- **Logo:** `client/public/logo.svg` / `logo.png`. The owner's todo asks for a new logo; until one is supplied, keep the current mark.
- **Owner's notes:**
  - Use the Indian tricolour (saffron, white, green) in the brand gradient.
  - Animate the landing page on a dark background.
  - Remove the "what our partners say" section.
  - Credit "Developed by Globoniks" in the footer.
  - The "eTRAZE" branding must not appear.
- **Contact:** hello@edumapping.com, support@edumapping.com, +91 91049 91059 (WhatsApp too).

## Evidence on Hand

- **Real:** the product screens and a demo season in the dev database (Tech University, TechCorp). A 2m18s product tour video lives at `~/Desktop/REACT/edumapping-video/videos/edumapping-tour/renders/video.mp4`.
- **Unverified — do not repeat:** the landing page's figures (12,500+ students, 100+ institutions, 2,300+ placements).
- **Absent — do not invent:** named customer colleges, testimonials, logos of hiring partners, pricing.

## Product Principles

1. **The placement cell is in control.** Nothing reaches students without the cell's approval, and every rule is enforced by the system, not by hand.
2. **Show the reason.** A student blocked from a drive, a record sent back, or an offer pending always sees why, and what to do next.
3. **Records are evidence.** Verified data is locked, changes are logged, and reports trace back to checked numbers.
4. **Built for the Indian campus.** Roll numbers, LPA, NIRF/NAAC, tiers and Class X/XII come first, without translation layers.
5. **One journey, school to career.** The school side and the college side feel like one product.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast.
- Usable on low-end Android phones over 3G/4G.
- English UI; plain language suited to first-generation college students.
