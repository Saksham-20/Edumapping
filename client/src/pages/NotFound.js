// client/src/pages/NotFound.js
//
// The catch-all route used to be `<Navigate to="/" replace />`, which turned
// every typo and every dead internal link into a silent bounce to the landing
// page — indistinguishable from a working navigation, and impossible to report
// as a bug. This says what happened instead.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-50 px-5 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">
          Error 404
        </p>
        <h1 className="mt-4 font-display text-display-sm font-bold tracking-tight text-ink-950">
          This page doesn’t exist
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-ink-600">
          Nothing lives at{' '}
          <code className="rounded-md border border-ink-950/15 bg-white px-1.5 py-0.5 font-mono text-sm text-ink-800">
            {location.pathname}
          </code>
          . It may have moved, or the link that brought you here may be out of date.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button as={Link} to={isAuthenticated ? '/dashboard' : '/'} size="lg">
            {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
