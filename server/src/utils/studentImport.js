// server/src/utils/studentImport.js
//
// Load a batch of students from the spreadsheet a college already keeps.
//
// The first importer read only the exact template headers, so the sheets
// colleges actually have ("Roll No.", "Email ID", "Mobile No", "Name",
// "Batch") failed every row with "Missing email". SheetJS also turned CSV dates
// into serial numbers, so even the template's own "2004-05-12" failed — and
// because the user row was written before the profile, each failure left an
// account with no profile behind, which the next attempt then skipped as
// "already exists". This version:
//
//   * accepts the common Indian header spellings and finds the header row even
//     under a title line ("Tech University — 2026 batch");
//   * reads CSV cells as text and Excel dates as dates;
//   * writes each student (account + profile) in one transaction;
//   * treats a bad optional value (CGPA 85, phone "12345", DOB "31/02/2004")
//     as a warning and imports the student without it, and a bad identity
//     (email, name, duplicate roll number) as a row error, with a message that
//     says what to change.
const crypto = require('crypto');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// ~20 ms a row here; 500 rows stays well inside the 25-second API timeout.
const MAX_ROWS = 500;

// A temporary password is 12 random characters (~70 bits). bcrypt's work
// factor protects guessable human passwords; for a random one, cost 8 is still
// far beyond brute force, and at cost 12 a 300-student sheet took longer than
// the API's 25-second timeout — the importer then never saw the passwords.
const TEMP_PASSWORD_ROUNDS = 8;

const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/** Header text → field. Keys are lower-case with everything but a–z/0–9 removed. */
const HEADER_ALIASES = {
  email: ['email', 'emailid', 'emailaddress', 'mail', 'mailid', 'studentemail', 'studentemailid', 'personalemail', 'collegeemail', 'officialemail'],
  fullName: ['name', 'fullname', 'studentname', 'nameofstudent', 'nameofthestudent', 'candidatename'],
  firstName: ['firstname', 'fname', 'givenname'],
  lastName: ['lastname', 'lname', 'surname', 'familyname'],
  phone: ['phone', 'phoneno', 'phonenumber', 'mobile', 'mobileno', 'mobilenumber', 'contact', 'contactno', 'contactnumber', 'whatsapp', 'whatsappno', 'studentmobile', 'studentmobileno'],
  studentId: ['studentid', 'rollno', 'rollnumber', 'roll', 'universityrollno', 'universityrollnumber', 'enrollmentno', 'enrollmentnumber', 'enrolmentno', 'enrolmentnumber', 'registrationno', 'registrationnumber', 'regno', 'admissionno', 'admissionnumber', 'prn', 'prnno', 'usn', 'htno', 'hallticketno'],
  course: ['course', 'programme', 'program', 'degree', 'programname'],
  branch: ['branch', 'department', 'dept', 'stream', 'specialisation', 'specialization', 'discipline'],
  yearOfStudy: ['yearofstudy', 'year', 'currentyear', 'studyyear'],
  graduationYear: ['graduationyear', 'batch', 'passingyear', 'yearofpassing', 'passoutyear', 'passout', 'passoutbatch', 'graduatingyear'],
  cgpa: ['cgpa', 'cpi', 'gpa', 'aggregatecgpa', 'currentcgpa', 'ogpa'],
  percentage: ['percentage', 'aggregate', 'aggregatepercentage', 'percent'],
  class10Percentage: ['class10percentage', 'class10', '10th', '10thpercentage', '10th', 'x', 'xpercentage', 'tenth', 'tenthpercentage', 'ssc', 'sscpercentage', 'class10marks'],
  class12Percentage: ['class12percentage', 'class12', '12th', '12thpercentage', 'xii', 'xiipercentage', 'twelfth', 'twelfthpercentage', 'hsc', 'hscpercentage', 'class12marks'],
  diplomaPercentage: ['diploma', 'diplomapercentage'],
  activeBacklogs: ['activebacklogs', 'backlogs', 'currentbacklogs', 'arrears', 'activearrears', 'noofbacklogs'],
  gender: ['gender', 'sex'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate']
};

const normaliseHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const FIELD_FOR = Object.entries(HEADER_ALIASES).reduce((acc, [field, keys]) => {
  keys.forEach((k) => {
    acc[k] = field;
  });
  return acc;
}, {});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v : String(v).replace(/ /g, ' ').trim());

/** Indian mobile → 10 digits; other international numbers kept with their +. */
const parsePhone = (raw) => {
  const s = text(raw);
  if (!s) return { value: null };
  let digits = s.replace(/[\s\-().]/g, '');
  if (/^\+91\d{10}$/.test(digits)) digits = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) digits = digits.slice(2);
  else if (/^0\d{10}$/.test(digits)) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) return { value: digits };
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return { value: digits };
  return { value: null, warning: `Phone "${s}" is not a 10-digit mobile number, so it was left blank` };
};

const pad = (n) => String(n).padStart(2, '0');
const validYmd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1950 && y <= 2030;
};

/** Excel serial, Date, YYYY-MM-DD or Indian DD/MM/YYYY (also - and .) → YYYY-MM-DD. */
const parseDate = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return { value: null };
  if (typeof raw === 'number' && raw > 3000 && raw < 80000) {
    const p = XLSX.SSF.parse_date_code(raw);
    if (p && validYmd(p.y, p.m, p.d)) return { value: `${p.y}-${pad(p.m)}-${pad(p.d)}` };
  }
  const s = text(raw);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m && validYmd(+m[1], +m[2], +m[3])) return { value: `${m[1]}-${pad(m[2])}-${pad(m[3])}` };
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m && validYmd(+m[3], +m[2], +m[1])) return { value: `${m[3]}-${pad(m[2])}-${pad(m[1])}` };
  return { value: null, warning: `Date of birth "${s}" was not understood (use DD/MM/YYYY), so it was left blank` };
};

const parseNumber = (raw, { label, min, max, integer = false, percent = false }) => {
  const s = text(raw).replace(/%$/, '').trim();
  if (!s) return { value: null };
  let n = Number(s);
  // A cell formatted as a percentage in Excel shows "91%" but holds 0.91,
  // which would import every student at under 1% and fail every Class X/XII
  // bar. No real mark is between 0 and 1 per cent, so read such a value as a
  // fraction.
  if (percent && Number.isFinite(n) && n > 0 && n <= 1) n = Math.round(n * 10000) / 100;
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    return { value: null, warning: `${label} "${text(raw)}" must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}, so it was left blank` };
  }
  return { value: n };
};

/** "2026", "2022-26", "2022-2026" → 2026. */
const parseBatch = (raw) => {
  const s = text(raw);
  if (!s) return { value: null };
  const m = s.match(/^(\d{4})(?:\s*[-–/]\s*(\d{2}|\d{4}))?$/);
  if (m) {
    const y = m[2] ? (m[2].length === 2 ? Number(m[1].slice(0, 2) + m[2]) : Number(m[2])) : Number(m[1]);
    if (y >= 2000 && y <= 2100) return { value: y };
  }
  return { value: null, warning: `Graduation year "${s}" was not understood (use e.g. 2026), so it was left blank` };
};

const parseGender = (raw) => {
  const s = text(raw).toLowerCase();
  if (!s) return { value: null };
  if (['m', 'male', 'boy'].includes(s)) return { value: 'male' };
  if (['f', 'female', 'girl'].includes(s)) return { value: 'female' };
  if (['o', 'other', 'others', 'transgender'].includes(s)) return { value: 'other' };
  return { value: null };
};

/** "R.K. Verma" → R.K. / Verma; "Priya" → Priya / "" */
const splitName = (full) => {
  const parts = text(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['', ''];
  if (parts.length === 1) return [parts[0], ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
};

/**
 * Read the sheet into { columns, rows } where each row is { rowNum, values }.
 * The header row is the first of the top ten that has an email column.
 */
const readSheet = (buffer, originalname = '') => {
  const isCsv = /\.csv$/i.test(originalname);
  // CSV: keep every cell as typed text (no date / number guessing). Excel:
  // keep raw values so dates arrive as serial numbers we can decode exactly.
  const workbook = XLSX.read(buffer, isCsv ? { type: 'buffer', raw: true } : { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { headerIndex: -1, grid: [] };
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  const headerIndex = grid.slice(0, 10).findIndex((r) => r.some((c) => FIELD_FOR[normaliseHeader(c)] === 'email'));
  return { headerIndex, grid };
};

/**
 * Import students into one institution.
 *
 * @returns {{ status, body }} — status 200 with the summary, or 400 when the
 *   sheet itself is unusable (no email column, too many rows, empty).
 */
const importStudents = async (models, { buffer, originalname, organizationId, actorId }) => {
  const { sequelize, User, StudentProfile } = models;

  let parsed;
  try {
    parsed = readSheet(buffer, originalname);
  } catch (err) {
    return {
      status: 400,
      body: { error: 'Validation Error', message: 'This file could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.' }
    };
  }
  const { headerIndex, grid } = parsed;
  if (headerIndex < 0) {
    const seen = (grid[0] || []).map((c) => text(c)).filter(Boolean).slice(0, 12);
    return {
      status: 400,
      body: {
        error: 'Validation Error',
        message: `No email column found. Add a column headed "Email" (or "Email ID").${seen.length ? ` The first row has: ${seen.join(', ')}.` : ''}`
      }
    };
  }

  const header = grid[headerIndex].map((h) => FIELD_FOR[normaliseHeader(h)] || null);
  const ignoredColumns = grid[headerIndex]
    .map((h, i) => (header[i] ? null : text(h)))
    .filter(Boolean);
  const dataRows = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells.some((c) => text(c) !== '')) continue; // blank line
    const values = {};
    header.forEach((field, c) => {
      if (field && (values[field] === undefined || values[field] === '')) values[field] = cells[c];
    });
    dataRows.push({ rowNum: i + 1, values });
  }
  if (dataRows.length === 0) {
    return { status: 400, body: { error: 'Validation Error', message: 'The sheet has a header row but no students under it.' } };
  }
  if (dataRows.length > MAX_ROWS) {
    return {
      status: 400,
      body: { error: 'Validation Error', message: `This sheet has ${dataRows.length} students. Import at most ${MAX_ROWS} at a time — split it by branch or batch.` }
    };
  }

  // Everything already on the platform that could collide, in two queries.
  const emails = [...new Set(dataRows.map((r) => text(r.values.email).toLowerCase()).filter(Boolean))];
  const rolls = [...new Set(dataRows.map((r) => text(r.values.studentId).toUpperCase()).filter(Boolean))];
  const [existingUsers, existingRolls] = await Promise.all([
    // Compared lower-cased on both sides: older accounts were saved with the
    // capitals they were typed with, and a case-sensitive match would create a
    // second account for the same person.
    emails.length
      ? User.findAll({
          where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), { [Op.in]: emails }),
          attributes: ['email']
        })
      : [],
    rolls.length
      ? StudentProfile.findAll({
          where: sequelize.where(sequelize.fn('upper', sequelize.col('student_id')), { [Op.in]: rolls }),
          attributes: ['studentId'],
          include: [{ model: User, as: 'user', attributes: [], where: { organizationId }, required: true }]
        })
      : []
  ]);
  const takenEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  const takenRolls = new Set(existingRolls.map((p) => String(p.studentId).toUpperCase()));

  const created = [];
  const skipped = [];
  const errors = [];
  const warnings = [];
  const seenEmails = new Map();
  const seenRolls = new Map();

  for (const { rowNum, values } of dataRows) {
    const email = text(values.email).toLowerCase();
    if (!email) {
      errors.push({ row: rowNum, message: 'No email address. Add one — it is how the student signs in.' });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, email, message: `"${email}" is not a valid email address.` });
      continue;
    }
    if (seenEmails.has(email)) {
      skipped.push({ row: rowNum, email, reason: `Same email as row ${seenEmails.get(email)} in this file.` });
      continue;
    }
    seenEmails.set(email, rowNum);
    if (takenEmails.has(email)) {
      skipped.push({ row: rowNum, email, reason: 'Already has an EduMapping account. Left unchanged.' });
      continue;
    }

    let firstName = text(values.firstName);
    let lastName = text(values.lastName);
    if (!firstName && !lastName && values.fullName) [firstName, lastName] = splitName(values.fullName);
    if (!firstName && lastName) [firstName, lastName] = [lastName, ''];
    if (!firstName) {
      errors.push({ row: rowNum, email, message: 'No name. Add a "Name" column (or first and last name).' });
      continue;
    }
    // users.last_name must not be empty, but single-name students ("Priya")
    // are common in India. The old importer repeated the first name ("Priya
    // Priya"); a "-" placeholder is easier to spot and correct.
    const singleName = !lastName;
    if (singleName) lastName = '-';

    const roll = text(values.studentId);
    const rollKey = roll.toUpperCase();
    if (roll && seenRolls.has(rollKey)) {
      errors.push({ row: rowNum, email, message: `Roll number ${roll} is also on row ${seenRolls.get(rollKey)}. Each student needs their own.` });
      continue;
    }
    if (roll && takenRolls.has(rollKey)) {
      errors.push({ row: rowNum, email, message: `Roll number ${roll} already belongs to another student at your institution.` });
      continue;
    }
    if (roll) seenRolls.set(rollKey, rowNum);

    const rowWarnings = singleName ? ['Only one name given; the surname was saved as "-"'] : [];
    const take = (result) => {
      if (result.warning) rowWarnings.push(result.warning);
      return result.value;
    };
    const phone = take(parsePhone(values.phone));
    const cgpa = take(parseNumber(values.cgpa, { label: 'CGPA', min: 0, max: 10 }));
    const percentage = take(parseNumber(values.percentage, { label: 'Percentage', min: 0, max: 100, percent: true }));
    const class10Percentage = take(parseNumber(values.class10Percentage, { label: 'Class X %', min: 0, max: 100, percent: true }));
    const class12Percentage = take(parseNumber(values.class12Percentage, { label: 'Class XII %', min: 0, max: 100, percent: true }));
    const diplomaPercentage = take(parseNumber(values.diplomaPercentage, { label: 'Diploma %', min: 0, max: 100, percent: true }));
    const activeBacklogs = take(parseNumber(values.activeBacklogs, { label: 'Active backlogs', min: 0, max: 100, integer: true }));
    let graduationYear = take(parseBatch(values.graduationYear));
    let yearOfStudy = null;
    const yos = text(values.yearOfStudy);
    if (yos) {
      const n = parseInt(yos, 10);
      // 1–6 for a college year, up to 12 for a school class.
      if (n >= 1 && n <= 12) yearOfStudy = n;
      else if (n >= 2000 && n <= 2100 && !graduationYear) graduationYear = n;
      else rowWarnings.push(`Year or class "${yos}" should be 1 to 12, so it was left blank`);
    }
    const dateOfBirth = take(parseDate(values.dateOfBirth));
    const gender = take(parseGender(values.gender));

    try {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, TEMP_PASSWORD_ROUNDS);
      await sequelize.transaction(async (transaction) => {
        const user = await User.create(
          {
            email,
            passwordHash,
            role: 'student',
            organizationId,
            firstName,
            lastName,
            phone,
            approvalStatus: 'approved',
            isActive: true,
            isVerified: true,
            approvedBy: actorId,
            approvedAt: new Date()
          },
          { transaction }
        );
        await StudentProfile.create(
          {
            userId: user.id,
            studentId: roll || null,
            course: text(values.course) || null,
            branch: text(values.branch) || null,
            yearOfStudy,
            graduationYear,
            gender,
            cgpa,
            percentage,
            class10Percentage,
            class12Percentage,
            diplomaPercentage,
            activeBacklogs,
            dateOfBirth
          },
          { transaction }
        );
      });
      takenEmails.add(email);
      created.push({ row: rowNum, email, name: singleName ? firstName : `${firstName} ${lastName}`, rollNumber: roll || null, temporaryPassword });
      rowWarnings.forEach((message) => warnings.push({ row: rowNum, email, message }));
    } catch (err) {
      const detail = err?.errors?.[0]?.message || err?.message || 'unknown error';
      errors.push({ row: rowNum, email, message: `Could not be saved (${detail}). Nothing was created for this row.` });
    }
  }

  return {
    status: 200,
    body: {
      message: 'Import completed',
      summary: {
        total: dataRows.length,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        warnings: warnings.length
      },
      ignoredColumns,
      created,
      skipped,
      errors,
      warnings
    }
  };
};

module.exports = { importStudents, HEADER_ALIASES, MAX_ROWS };
