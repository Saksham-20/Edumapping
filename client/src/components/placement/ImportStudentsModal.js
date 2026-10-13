// client/src/components/placement/ImportStudentsModal.js
//
// Onboard a batch from the spreadsheet the college already has. The server
// forces the import into the caller's own institution, so this needs no
// organisation picker for a TPO.
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Modal } from '../ui';
import api from '../../services/api';
import { saveBlob } from '../../services/placement';
import { downloadCredentialsCsv } from '../../utils/credentialsCsv';

const TEMPLATE_HEADERS = ['email', 'first_name', 'last_name', 'phone', 'student_id', 'course', 'branch', 'year_of_study', 'graduation_year', 'cgpa', 'gender', 'date_of_birth'];
const TEMPLATE_ROW = ['aarav.sharma@college.edu.in', 'Aarav', 'Sharma', '9876543210', '22CSE001', 'B.Tech', 'Computer Science Engineering', '4', '2026', '8.4', 'male', '2004-05-12'];

const downloadTemplate = () => {
  const csv = `${TEMPLATE_HEADERS.join(',')}\n${TEMPLATE_ROW.join(',')}\n`;
  saveBlob(new Blob([csv], { type: 'text/csv' }), 'student-import-template.csv');
};

const downloadCredentials = (created) => downloadCredentialsCsv(created, 'student-login-details.csv');

const ImportStudentsModal = ({ open, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/users/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res);
      toast.success(`${res.summary?.created ?? 0} student(s) added`);
      onImported?.();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const created = result?.created || result?.details?.created || [];
  const skipped = result?.skipped || result?.details?.skipped || [];
  const errors = result?.errors || result?.details?.errors || [];

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import students"
      description="Upload an Excel or CSV sheet with one row per student. Existing emails are skipped, never overwritten."
      footer={
        result ? (
          <>
            {created.some((c) => c.temporaryPassword) && (
              <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => downloadCredentials(created)}>
                Download login details
              </Button>
            )}
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button icon={DocumentArrowUpIcon} loading={busy} disabled={!file} onClick={submit}>
              Import
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
            <span className="text-sm font-semibold text-ink-950">{file ? file.name : 'Choose a .xlsx, .xls or .csv file'}</span>
            <span className="text-xs text-ink-500">Up to 10 MB</span>
            <input
              id="import-students-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <div className="rounded-xl border border-ink-950/10 p-4 text-sm text-ink-700">
            <p className="font-semibold text-ink-950">Columns</p>
            <p className="mt-1">
              <code className="font-mono text-xs">email</code> is required. Also read: first/last name, phone, student_id (roll number), course, branch,
              year_of_study, graduation_year, cgpa, gender, date_of_birth.
            </p>
            <Button size="sm" variant="ghost" icon={ArrowDownTrayIcon} className="mt-2 -ml-2" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{result.summary?.created ?? created.length} created</Badge>
            <Badge tone="neutral">{result.summary?.skipped ?? skipped.length} skipped</Badge>
            <Badge tone={errors.length ? 'danger' : 'neutral'}>{result.summary?.errors ?? errors.length} errors</Badge>
          </div>
          {created.some((c) => c.temporaryPassword) && (
            <p className="rounded-xl border border-saffron-500/40 bg-saffron-50 p-3 text-saffron-900">
              Each new student has a one-time password. Download the login details now — they are not shown again.
            </p>
          )}
          {[...errors, ...skipped].length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-ink-950/10 p-3 font-mono text-xs">
              {[...errors, ...skipped].map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.email ? `${e.email} — ` : ''}
                  {e.message || e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ImportStudentsModal;
