// client/src/pages/auth/PendingApproval.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Card, Divider } from '../../components/ui';
import { AuthShell } from './authKit';

const PendingApproval = () => {
  // Set by the registration screens: whether a new institution was created,
  // and the address the approval email will go to.
  const { state } = useLocation();
  const institution = Boolean(state?.institution);
  // A new school was told to "import your students and post your first
  // drive" and to get ready "roll number, branch, year": placement-cell
  // steps a school has no screen for.
  const school = Boolean(state?.school);
  // A new company was likewise told to import students: its next step is
  // getting access to colleges and posting a drive.
  const company = Boolean(state?.company);
  const email = state?.email;
  return (
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
              {institution ? 'Registration received' : 'Account pending approval'}
            </h1>
            <Badge tone="warning" dot className="mt-1.5">
              Under review
            </Badge>
          </div>
        </div>

        <Divider className="my-5" />

        <h2 className="font-display text-base font-bold text-ink-950">What happens next?</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          {institution
            ? `The EduMapping team checks every new institution before it goes live, usually within one working day. ${
                school
                  ? 'After that your staff and students can join your school on EduMapping.'
                  : company
                    ? 'After that the team gives you access to the colleges you recruit from, and you can post your first drive.'
                    : 'After that you can import your students and post your first drive.'
              }`
            : 'Your account is reviewed before you can sign in, usually within one working day.'}{' '}
          {email ? (
            <>
              Once it is approved, sign in with{' '}
              <span className="font-medium text-ink-950">{email}</span>.
            </>
          ) : (
            'Once it is approved, sign in with the email you registered with.'
          )}
        </p>

        <h2 className="mt-6 font-display text-base font-bold text-ink-950">While you wait</h2>
        {/* Things a person can actually do while signed out. The list used to
            say "ensure your profile information is accurate", which nobody
            can do before their account is approved. */}
        <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
          {(institution
            ? [
                school
                  ? 'Tell your principal, teachers and counsellors to sign up at edumapping.com under your school once it is approved.'
                  : company
                    ? 'Note the colleges you want to hire from and your first role: title, CTC, eligible branches and minimum CGPA.'
                    : 'Get your student list ready: name, roll number, branch, year and email or phone. You can import it in one go once approved.',
                'Keep the email and password you registered with to hand.',
                'If you have not heard from us in two working days, contact support below.'
              ]
            : [
                'Keep the email and password you registered with to hand.',
                'If you have not heard from us in two working days, contact support below.'
              ]
          ).map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="text-saffron-600">
                —
              </span>
              {line}
            </li>
          ))}
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
};

export default PendingApproval;
