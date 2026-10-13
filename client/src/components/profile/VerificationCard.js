// client/src/components/profile/VerificationCard.js
//
// The student's side of academic verification: upload marksheets, submit the
// record to the placement cell, and see whether it was verified (and is now
// locked) or sent back with a reason.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Badge, Button, Card, cx } from '../ui';
import { Stamp } from '../brand';
import placementService from '../../services/placement';
import openProtectedFile from '../../utils/openProtectedFile';

const STATES = {
  verified: {
    icon: ShieldCheckIcon,
    tone: 'attest',
    label: 'Verified',
    frame: 'border-stamp-600/30 bg-stamp-50/40',
    text: 'Your placement cell checked your academic details against your marksheets. They are locked; ask the cell if anything needs to change.'
  },
  pending: {
    icon: ClockIcon,
    tone: 'warning',
    label: 'Awaiting review',
    frame: 'border-saffron-500/40 bg-saffron-50/50',
    text: 'Submitted. Your placement cell will check your details against your marksheets.'
  },
  rejected: {
    icon: ExclamationTriangleIcon,
    tone: 'danger',
    label: 'Sent back',
    frame: 'border-vermilion-600/30 bg-vermilion-50/50',
    text: 'Your placement cell asked for corrections. Fix the details below and submit again.'
  },
  unverified: {
    icon: ShieldCheckIcon,
    tone: 'neutral',
    label: 'Not verified',
    frame: '',
    text: 'Many companies only consider verified students. Upload your marksheets and submit your academic details to your placement cell.'
  }
};

const VerificationCard = ({ profile, onChange }) => {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const status = profile?.verificationStatus || 'unverified';
  const s = STATES[status] || STATES.unverified;

  const upload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Upload your marksheets as a single PDF. Scan them into one file first.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('That PDF is over 10 MB. Scan at a lower resolution and try again.');
      return;
    }
    setBusy(true);
    try {
      await placementService.uploadMarksheet(file);
      toast.success('Marksheets uploaded');
      onChange?.();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await placementService.requestVerification();
      toast.success('Submitted to your placement cell');
      onChange?.();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cx('mb-6', s.frame)}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-950/10 bg-white">
          <s.icon className="h-5 w-5 text-ink-800" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink-950">
            Academic verification
            {status !== 'verified' && <Badge tone={s.tone}>{s.label}</Badge>}
          </p>
          <p className="mt-1 text-sm text-ink-700">{s.text}</p>
          {status === 'verified' && (
            <Stamp className="mt-3" size="md" rotate={-4} sub="Placement cell">
              Verified · Locked
            </Stamp>
          )}
          {status === 'rejected' && profile?.verificationNotes && (
            <p className="mt-2 rounded-xl border border-vermilion-600/20 bg-white p-3 text-sm text-vermilion-800">“{profile.verificationNotes}”</p>
          )}
          {status !== 'verified' && status !== 'pending' && !profile?.marksheetUrl && (
            <p className="mt-2 text-sm text-ink-600">
              Start by uploading your semester marksheets and Class X and XII mark sheets as one PDF.
              The cell checks your CGPA and percentages against them.
            </p>
          )}
          {status === 'pending' && (
            <p className="mt-2 text-sm text-ink-600">
              You can still correct your details while you wait. Once verified, they are locked.
            </p>
          )}
          {profile?.marksheetUrl && (
            <button
              type="button"
              onClick={() => openProtectedFile(profile.marksheetUrl)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-azure-700 hover:underline"
            >
              <DocumentTextIcon className="h-4 w-4" aria-hidden="true" /> View uploaded marksheets
            </button>
          )}
        </div>
        {status !== 'verified' && (
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" id="marksheet-upload" onChange={(e) => upload(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" icon={DocumentArrowUpIcon} loading={busy} onClick={() => fileRef.current?.click()}>
              {profile?.marksheetUrl ? 'Replace marksheets' : 'Upload marksheets (PDF)'}
            </Button>
            {status !== 'pending' && (
              <Button size="sm" icon={ShieldCheckIcon} loading={busy} onClick={submit}>
                Submit for verification
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default VerificationCard;
