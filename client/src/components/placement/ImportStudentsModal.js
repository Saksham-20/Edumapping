// client/src/components/placement/ImportStudentsModal.js
//
// Onboard a batch from the spreadsheet the college already has. The server
// forces the import into the caller's own institution, so this needs no
// organisation picker for a TPO.
//
// The server reads the usual Indian header spellings ("Roll No.", "Email ID",
// "Mobile No", "Batch", "10th %"), so the cell does not have to retype its
// sheet into our template. The result screen separates what stopped a row
// (errors), what was left out of a created row (warnings), and what was
// already there (skipped), each with the sheet's own row number.
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, DocumentArrowUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Modal } from '../ui';
import api, { describeApiError } from '../../services/api';
import { saveBlob } from '../../services/placement';
import { downloadCredentialsCsv } from '../../utils/credentialsCsv';

const TEMPLATE_HEADERS = ['Roll No', 'Name', 'Email', 'Mobile', 'Course', 'Branch', 'Batch', 'Year of study', 'CGPA', 'Active backlogs', '10th %', '12th %', 'Gender', 'Date of birth'];
const TEMPLATE_ROWS = [
  ['22CSE001', 'Aarav Sharma', 'aarav.sharma@college.edu.in', '98765 43210', 'B.Tech', 'Computer Science Engineering', '2026', '4', '8.4', '0', '91.2', '88.4', 'Male', '12/05/2004'],
  ['22ECE014', 'R.K. Iyer', 'rk.iyer@gmail.com', '+91 98765 43211', 'B.Tech', 'Electronics and Communication', '2026', '4', '7.65', '1', '84', '79.6', 'Female', '03/11/2003']
];
const MAX_MB = 5;

const downloadTemplate = () => {
  const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map((r) => r.join(',')).join('\n');
  saveBlob(new Blob([`﻿${csv}\n`], { type: 'text/csv;charset=utf-8' }), 'student-import-template.csv');
};

/** Every problem row as a CSV the cell can fix in Excel and re-upload. */
const downloadReport = (rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Row', 'Email', 'Result', 'What to do'], ...rows.map((r) => [r.row, r.email || '', r.kind, r.message])];
  saveBlob(new Blob([`﻿${lines.map((l) => l.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), 'student-import-problems.csv');
};

const KIND_TONE = { Error: 'danger', Warning: 'warning', Skipped: 'neutral' };

const ImportStudentsModal = ({ open, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const created = result?.created || [];
  const hasPasswords = created.some((c) => c.temporaryPassword);

  const close = () => {
    // The one-time passwords exist only in this response. Closing without
    // saving them leaves the cell with accounts nobody can sign in to.
    if (hasPasswords && !downloaded && !window.confirm('You have not downloaded the login details. They cannot be shown again. Close anyway?')) {
      return;
    }
    setFile(null);
    setResult(null);
    setError('');
    setDownloaded(false);
    onClose();
  };

  const pickFile = (f) => {
    setError('');
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      setError(`${f.name} is over ${MAX_MB} MB. Split the batch into smaller sheets.`);
      return;
    }
    setFile(f || null);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/placement/students/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        silent: true,
        // A few hundred rows takes a while; do not let a proxy default cut it.
        timeout: 120000
      });
      setResult(res);
      const n = res.summary?.created ?? 0;
      if (n > 0) toast.success(`${n} student${n === 1 ? '' : 's'} added`);
      onImported?.();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveLogins = () => {
    downloadCredentialsCsv(created, 'student-login-details.csv');
    setDownloaded(true);
  };

  const problems = result
    ? [
        ...(result.errors || []).map((e) => ({ ...e, kind: 'Error' })),
        ...(result.warnings || []).map((e) => ({ ...e, kind: 'Warning' })),
        ...(result.skipped || []).map((e) => ({ ...e, message: e.reason, kind: 'Skipped' }))
      ].sort((a, b) => a.row - b.row)
    : [];

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import students"
      description="Upload the Excel or CSV sheet you already keep, one row per student. Students whose email already has an account are skipped, never overwritten."
      footer={
        result ? (
          <>
            {problems.length > 0 && (
              <Button variant="ghost" icon={ArrowDownTrayIcon} onClick={() => downloadReport(problems)}>
                Problem rows (CSV)
              </Button>
            )}
            {hasPasswords && (
              <Button variant={downloaded ? 'secondary' : 'primary'} icon={ArrowDownTrayIcon} onClick={saveLogins}>
                Download login details
              </Button>
            )}
            <Button variant={hasPasswords && !downloaded ? 'secondary' : 'primary'} onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button icon={DocumentArrowUpIcon} loading={busy} disabled={!file} onClick={submit}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <label
            htmlFor="import-students-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-950/20 bg-bone-50 px-6 py-10 text-center transition-colors hover:border-ink-950/50"
          >
            <DocumentArrowUpIcon aria-hidden="true" className="h-8 w-8 text-ink-500" />
            <span className="break-all text-sm font-semibold text-ink-950">{file ? file.name : 'Choose a .xlsx, .xls or .csv file'}</span>
            <span className="text-xs text-ink-500">Up to {MAX_MB} MB and 500 students per file</span>
            <input
              id="import-students-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-vermilion-500/40 bg-vermilion-50 p-3 text-sm text-vermilion-800">
              <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="rounded-xl border border-ink-950/10 p-4 text-sm text-ink-700">
            <p className="font-semibold text-ink-950">What the sheet needs</p>
            <p className="mt-1">
              An <strong>Email</strong> column and the student&apos;s <strong>Name</strong> (or first and last name). Also read if present: roll
              number, mobile, course, branch, batch, year of study, CGPA, active backlogs, 10th %, 12th %, gender, date of birth (DD/MM/YYYY).
              Usual headings like &ldquo;Roll No.&rdquo;, &ldquo;Email ID&rdquo; or &ldquo;Mobile No&rdquo; work as they are, and a title row above the
              headings is fine.
            </p>
            <Button size="sm" variant="ghost" icon={ArrowDownTrayIcon} className="mt-2 -ml-2" onClick={downloadTemplate}>
              Download a sample sheet
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{result.summary?.created ?? 0} added</Badge>
            <Badge tone={result.summary?.errors ? 'danger' : 'neutral'}>{result.summary?.errors ?? 0} not added</Badge>
            {result.summary?.warnings > 0 && <Badge tone="warning">{result.summary.warnings} warnings</Badge>}
            <Badge tone="neutral">{result.summary?.skipped ?? 0} already on EduMapping</Badge>
          </div>
          {hasPasswords && (
            <p className="rounded-xl border border-saffron-500/40 bg-saffron-50 p-3 text-saffron-900">
              Each new student has a one-time password. <strong>Download the login details now</strong> — they are not shown again. Share each
              student&apos;s password with them privately and ask them to change it after signing in.
            </p>
          )}
          {result.summary?.created === 0 && !problems.length && <p className="text-ink-600">No students were added.</p>}
          {problems.length > 0 && (
            <>
              <p className="text-ink-600">
                Fix the rows marked <em>not added</em> in your sheet and import the same file again — students already added are skipped.
              </p>
              <ul className="max-h-60 divide-y divide-ink-950/10 overflow-y-auto rounded-xl border border-ink-950/10">
                {problems.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
                    <span className="w-14 shrink-0 font-mono text-xs text-ink-500">Row {p.row}</span>
                    <Badge tone={KIND_TONE[p.kind]}>{p.kind === 'Error' ? 'Not added' : p.kind}</Badge>
                    <span className="min-w-0 flex-1 basis-48 text-ink-800">
                      {p.email && <span className="break-all font-mono text-xs text-ink-500">{p.email} · </span>}
                      {p.message}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.ignoredColumns?.length > 0 && (
            <p className="text-xs text-ink-500">Columns not used: {result.ignoredColumns.join(', ')}</p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ImportStudentsModal;
