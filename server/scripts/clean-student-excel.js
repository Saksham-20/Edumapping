#!/usr/bin/env node
/**
 * Clean a student Excel sheet to the format required by Admin "Import Students".
 *
 * Usage:
 *   node scripts/clean-student-excel.js "<input.xlsx>" [output.xlsx]
 *
 * Examples:
 *   node scripts/clean-student-excel.js "C:\Users\panjl\Downloads\b.a  3rd yr.xlsx"
 *   node scripts/clean-student-excel.js "students.xlsx" "students_cleaned.xlsx"
 *
 * Optional env: IMPORT_PLACEHOLDER_EMAIL_DOMAIN (default: import.placeholder)
 *   Used when a row has no email; placeholder will be RollNo@import.placeholder.
 *
 * Output columns: Email, First Name, Last Name, Phone, Student ID, Course, Branch,
 * Year of Study, Graduation Year, Gender, CGPA, Percentage, Date of Birth
 *
 * The script auto-detects the header row (first row with 2+ non-empty cells).
 * Then upload the cleaned file in Admin Dashboard → Import Students.
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const STANDARD_HEADERS = [
  'Email',
  'First Name',
  'Last Name',
  'Phone',
  'Student ID',
  'Course',
  'Branch',
  'Year of Study',
  'Graduation Year',
  'Gender',
  'CGPA',
  'Percentage',
  'Date of Birth'
];

// Map raw header (normalized: lowercase, spaces -> underscore) to our standard key
function normalizeHeader(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[.\-]/g, '');
}

const HEADER_ALIASES = {
  email: ['email', 'email_id', 'e_mail', 'emailid', 'mail', 'email_address'],
  firstName: ['first_name', 'firstname', 'first_name', 'given_name', 'fname'],
  lastName: ['last_name', 'lastname', 'surname', 'lname', 'family_name'],
  name: ['name', 'student_name', 'full_name', 'candidate_name', 'studentname', 'fullname', 'student name'],
  phone: ['phone', 'mobile', 'contact', 'phone_no', 'phoneno', 'mobile_no', 'mobileno', 'contact_no', 'whatsapp'],
  studentId: [
    'student_id', 'studentid', 'roll_no', 'roll no', 'rollno', 'roll_number', 'enrollment_no', 'enrollmentno',
    'scholar_no', 'scholarno', 'reg_no', 'regno', 'registration_no', 'university_roll_no', 'urn'
  ],
  course: ['course', 'programme', 'program', 'degree', 'qualification', 'course_name'],
  branch: ['branch', 'stream', 'department', 'dept', 'specialization', 'discipline', 'subject'],
  yearOfStudy: ['year_of_study', 'yearofstudy', 'year', 'current_year', 'class', 'semester', 'sem', 'semester_year'],
  graduationYear: ['graduation_year', 'graduationyear', 'passing_year', 'passingyear', 'passout_year', 'passout year', 'batch', 'yop'],
  gender: ['gender', 'sex'],
  cgpa: ['cgpa', 'cgpa_grade', 'grade', 'gpa'],
  percentage: ['percentage', 'percent', 'pct', 'marks_percent', 'total_marks'],
  dateOfBirth: ['date_of_birth', 'dateofbirth', 'dob', 'birth_date', 'birthdate', 'date of birth']
};

// Prefer these exact header names when multiple map to same field (order = priority)
const PREFERRED_HEADERS = {
  name: ['Student Name', 'student name', 'Name', 'name', 'Student Name'],
  studentId: ['Roll No.', 'Roll No', 'Registration No', 'Student ID', 'studentId'],
  email: ['Student Email Id', 'Email', 'email', 'Email Id']
};

function buildHeaderMap(rawHeaders) {
  const normalizedToStandard = {};
  Object.entries(HEADER_ALIASES).forEach(([standardKey, aliases]) => {
    aliases.forEach(a => { normalizedToStandard[a] = standardKey; });
  });

  const rawToStandard = {};
  for (const raw of rawHeaders) {
    const n = normalizeHeader(raw);
    if (!n) continue;
    for (const [alias, standardKey] of Object.entries(normalizedToStandard)) {
      if (standardKey === 'name' && (n.includes('father') || n.includes('mother'))) continue;
      if (standardKey === 'yearOfStudy' && (n.includes('passout') || n.includes('graduation') || n.includes('passing') || n.includes('batch'))) continue;
      if (n === alias || n.includes(alias) || alias.includes(n)) {
        rawToStandard[raw] = standardKey;
        break;
      }
    }
    if (!rawToStandard[raw] && (n.includes('email') || n === 'e_mail')) rawToStandard[raw] = 'email';
    if (!rawToStandard[raw] && (n.includes('name') && !n.includes('first') && !n.includes('last') && !n.includes('father') && !n.includes('mother'))) rawToStandard[raw] = 'name';
    if (!rawToStandard[raw] && (n.includes('roll') || n.includes('enroll') || n.includes('scholar') || n.includes('reg_no'))) rawToStandard[raw] = 'studentId';
    if (!rawToStandard[raw] && (n.includes('phone') || n.includes('mobile') || n.includes('contact'))) rawToStandard[raw] = 'phone';
    if (!rawToStandard[raw] && (n.includes('branch') || n.includes('stream') || n.includes('dept'))) rawToStandard[raw] = 'branch';
    if (!rawToStandard[raw] && (n.includes('course') || n.includes('programme') || n.includes('program'))) rawToStandard[raw] = 'course';
    if (!rawToStandard[raw] && (n.includes('year') || n.includes('sem')) && !n.includes('passout') && !n.includes('graduation') && !n.includes('passing')) rawToStandard[raw] = 'yearOfStudy';
    if (!rawToStandard[raw] && (n.includes('cgpa') || n.includes('gpa'))) rawToStandard[raw] = 'cgpa';
    if (!rawToStandard[raw] && (n.includes('percent'))) rawToStandard[raw] = 'percentage';
    if (!rawToStandard[raw] && (n.includes('gender') || n === 'sex')) rawToStandard[raw] = 'gender';
    if (!rawToStandard[raw] && (n.includes('dob') || n.includes('birth'))) rawToStandard[raw] = 'dateOfBirth';
  }
  return rawToStandard;
}

function getCell(rawRow, standardKey, headerMap) {
  const preferred = PREFERRED_HEADERS[standardKey];
  let rawKey = null;
  if (preferred) {
    for (const p of preferred) {
      if (headerMap[p] === standardKey && (rawRow[p] != null && String(rawRow[p]).trim() !== '')) {
        rawKey = p;
        break;
      }
    }
  }
  if (!rawKey) rawKey = Object.keys(headerMap).find(k => headerMap[k] === standardKey);
  if (!rawKey) return '';
  const v = rawRow[rawKey];
  if (v == null) return '';
  return String(v).trim();
}

function parseYearOrSemester(val) {
  if (val === '') return null;
  const n = parseInt(String(val).replace(/\D/g, ''), 10);
  if (!Number.isNaN(n)) {
    if (n <= 6 && n >= 1) return n <= 2 ? n : 3; // Sem 1-2 -> 1-2, Sem 3-6 -> 3
    if (n >= 1 && n <= 5) return n;
  }
  return null;
}

function normalizeGender(val) {
  const v = String(val).trim().toLowerCase();
  if (['m', 'male', 'boy'].includes(v)) return 'male';
  if (['f', 'female', 'girl'].includes(v)) return 'female';
  if (['other', 'o'].includes(v)) return 'other';
  return val || '';
}

function splitName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return { firstName: 'Student', lastName: '' };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Student', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/clean-student-excel.js "<input.xlsx>" [output.xlsx]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error('File not found:', resolvedInput);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), path.basename(resolvedInput, path.extname(resolvedInput)) + '_cleaned.xlsx');

  const defaultYearOfStudy = (() => {
    const base = path.basename(resolvedInput, path.extname(resolvedInput));
    const m = base.match(/(\d)(?:st|nd|rd|th)\s*yr/i) || base.match(/(\d)\s*yr/i);
    return m ? parseInt(m[1], 10) : null;
  })();
  if (defaultYearOfStudy) console.log('Default Year of Study from filename:', defaultYearOfStudy);

  console.log('Reading:', resolvedInput);
  const workbook = XLSX.readFile(resolvedInput);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }); // array of arrays
  if (rawData.length < 2) {
    console.error('Sheet needs at least a header row and one data row.');
    process.exit(1);
  }
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(15, rawData.length); r++) {
    const row = rawData[r];
    const nonEmpty = (row || []).filter(c => c != null && String(c).trim() !== '').length;
    if (nonEmpty >= 2) {
      headerRowIndex = r;
      break;
    }
  }
  if (headerRowIndex < 0) {
    console.error('Could not find a row with at least 2 non-empty cells to use as header.');
    process.exit(1);
  }
  const rawHeaders = (rawData[headerRowIndex] || []).map((c, i) => (c != null && String(c).trim() !== '') ? String(c).trim() : `Column_${i + 1}`);
  const rawRows = [];
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    const obj = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const key = rawHeaders[c] || `Column_${c + 1}`;
      obj[key] = row && row[c] != null ? row[c] : '';
    }
    rawRows.push(obj);
  }
  if (rawRows.length === 0) {
    console.error('No data rows below the header.');
    process.exit(1);
  }
  console.log('Header row (1-based):', headerRowIndex + 1, '| Columns:', rawHeaders.join(' | '));
  const headerMap = buildHeaderMap(rawHeaders);
  console.log('Mapped to standard fields:', JSON.stringify(headerMap, null, 2));

  const placeholderDomain = process.env.IMPORT_PLACEHOLDER_EMAIL_DOMAIN || 'import.placeholder';
  const cleanedRows = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const get = (key) => getCell(raw, key, headerMap);

    let email = get('email').toLowerCase();
    const nameStr = get('name');
    const studentId = get('studentId') || '';
    const { firstName, lastName } = nameStr ? splitName(nameStr) : { firstName: get('firstName') || 'Student', lastName: get('lastName') || '' };

    if (!email && studentId) {
      email = `${studentId}@${placeholderDomain}`;
      console.log(`Row ${i + 2}: No email, using placeholder ${email}`);
    }
    if (!email) {
      skipped++;
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.includes('@')) {
      // already looks like email
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      email = `${email.replace(/\s/g, '')}@${placeholderDomain}`;
    }

    const phone = get('phone') || '';
    const course = get('course') || '';
    const branch = get('branch') || '';
    const yearVal = get('yearOfStudy');
    const gradYear = get('graduationYear');
    const yearNum = yearVal ? parseInt(yearVal, 10) : NaN;
    const gradNum = gradYear ? parseInt(gradYear, 10) : NaN;
    // Year of Study must be 1-6; 4-digit values (e.g. 2022) are graduation/passout year
    const yearOfStudy = (yearVal && yearNum >= 1 && yearNum <= 6)
      ? yearNum
      : parseYearOrSemester(yearVal) || (yearVal && !Number.isNaN(yearNum) && yearNum <= 6 ? yearNum : null) || defaultYearOfStudy;
    const graduationYear = (!Number.isNaN(gradNum) && gradNum >= 1900 && gradNum <= 2100) ? gradNum : (!Number.isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100 ? yearNum : null);
    const cgpaVal = get('cgpa');
    const cgpa = cgpaVal !== '' && !Number.isNaN(Number(cgpaVal)) ? parseFloat(cgpaVal) : '';
    const pctVal = get('percentage');
    const percentage = pctVal !== '' && !Number.isNaN(Number(pctVal)) ? parseFloat(pctVal) : '';
    const dateOfBirth = get('dateOfBirth') || '';

    cleanedRows.push({
      'Email': email,
      'First Name': firstName || 'Student',
      'Last Name': lastName || '',
      'Phone': phone,
      'Student ID': studentId,
      'Course': course,
      'Branch': branch,
      'Year of Study': yearOfStudy != null ? yearOfStudy : '',
      'Graduation Year': graduationYear != null ? graduationYear : '',
      'Gender': normalizeGender(get('gender')),
      'CGPA': cgpa,
      'Percentage': percentage,
      'Date of Birth': dateOfBirth
    });
  }

  const outWorkbook = XLSX.utils.book_new();
  const outSheet = XLSX.utils.json_to_sheet(cleanedRows);
  XLSX.utils.book_append_sheet(outWorkbook, outSheet, 'Students');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(outWorkbook, outputPath, { bookType: 'xlsx' });

  console.log('Cleaned rows:', cleanedRows.length, '| Skipped (no email/roll):', skipped);
  console.log('Written:', outputPath);
  console.log('You can now upload this file in Admin Dashboard → Import Students.');
}

main();
