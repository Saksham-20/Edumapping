// client/src/utils/credentialsCsv.js

/**
 * Turn a bulk-import result into a CSV of the temporary passwords it issued.
 *
 * Every imported student used to get the same password ('Student@123'),
 * published in the code, so anyone who knew a student's email could sign in as
 * them. The server now gives each account its own random temporary password
 * and returns it once, in the import response. This is the only moment the
 * importer can hand them out, so the file is built client-side from that
 * response and never stored anywhere.
 */
const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote everything, and defuse values a spreadsheet would run as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const buildCredentialsCsv = (created = []) => {
  const rows = [['email', 'name', 'temporaryPassword']];
  for (const entry of created) {
    if (!entry?.temporaryPassword) continue;
    rows.push([entry.email, entry.name, entry.temporaryPassword]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
};

/** Download the credentials CSV; returns false when there was nothing to save. */
export const downloadCredentialsCsv = (created = [], filename = 'imported-student-credentials.csv') => {
  const withPasswords = created.filter((entry) => entry?.temporaryPassword);
  if (withPasswords.length === 0) return false;
  const blob = new Blob([buildCredentialsCsv(withPasswords)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};
