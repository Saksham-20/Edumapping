// client/src/pages/auth/PendingApproval.js
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Card, Divider } from '../../components/ui';
import { AuthShell } from './authKit';

const PendingApproval = () => (
  <AuthShell>
    <Card>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-saffron-500/40 bg-saffron-50 text-saffron-800"
        >
          <ClockIcon className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink-950">
            Account pending approval
          </h1>
          <Badge tone="warning" dot className="mt-1.5">
            Under review
          </Badge>
        </div>
      </div>

      <Divider className="my-5" />

      <h2 className="font-display text-base font-bold text-ink-950">What happens next?</h2>
      <p className="mt-1.5 text-sm text-ink-600">
        Our team will review your account and approve it within 24–48 hours. You’ll receive an email
        notification once your account is approved.
      </p>

      <h2 className="mt-6 font-display text-base font-bold text-ink-950">While you wait</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-saffron-600">
            —
          </span>
          Ensure all your profile information is accurate
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-saffron-600">
            —
          </span>
          Prepare your resume and documents
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-saffron-600">
            —
          </span>
          Check your email for the approval notification
        </li>
      </ul>

      <Divider className="my-5" />

      <p className="text-sm text-ink-600">Have questions about your account?</p>
      {/* Was a Link to /contact, which is not a route — the landing page's
          Connect section is local state, not a URL — so the button silently
          bounced to the landing page. A mailto is a destination that exists. */}
      <Button
        as="a"
        variant="secondary"
        fullWidth
        className="mt-3"
        href="mailto:support@edumapping.com?subject=Question%20about%20my%20pending%20account"
      >
        Contact support
      </Button>

      <Link
        to="/login"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-950"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        Back to sign in
      </Link>
    </Card>
  </AuthShell>
);

export default PendingApproval;
