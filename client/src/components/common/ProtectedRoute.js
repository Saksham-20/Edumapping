// client/src/components/common/ProtectedRoute.js
import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { Button } from '../ui';
import { formatRole } from './navigation';
import { LockClosedIcon } from '@heroicons/react/24/outline';

const ProtectedRoute = ({ children, requiredRoles = [], collegeOnly = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Checking your session" />;
  }

  if (!isAuthenticated) {
    // Remember where they were headed so the login can send them back rather
    // than dumping everyone on the dashboard.
    // The query string is kept too, so "/jobs?type=internship" survives.
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  // An account still awaiting approval reached /pending-approval exactly once,
  // right after registering; on every later sign-in it landed on a dashboard
  // whose every API call the server rejects. Admins are exempt, matching the
  // bypass in the User model's hooks.
  if (
    user?.role !== 'admin' &&
    (user?.approvalStatus === 'pending' || user?.approvalStatus === 'rejected') &&
    location.pathname !== '/pending-approval'
  ) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Placement pages (applications, offers, resume) belong to colleges. A school
  // account's role names overlap ("student"), so the role check alone let a
  // school student into an empty placement page.
  const blockedForSchool = collegeOnly && user?.organization?.type === 'school';

  if (blockedForSchool || (requiredRoles.length > 0 && !requiredRoles.includes(user.role))) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bone-50 px-5 py-16">
        <div className="w-full max-w-md text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-950/15 bg-white text-ink-700"
          >
            <LockClosedIcon className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            {blockedForSchool
              ? 'This is part of college placements'
              : 'You don’t have access to this page'}
          </h1>
          {blockedForSchool ? (
            <p className="mt-3 text-sm text-ink-600">
              Applications, offers and resumes are used by colleges during placement season. Your
              school dashboard has your events, classes and career guidance.
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-600">
              It’s limited to {requiredRoles.map(formatRole).join(', ')} accounts. You’re signed in
              as {formatRole(user.role)}.
            </p>
          )}
          <Button as={Link} to="/dashboard" className="mt-6">
            Back to dashboard
          </Button>
        </div>
      </main>
    );
  }

  return children;
};

export default ProtectedRoute;
