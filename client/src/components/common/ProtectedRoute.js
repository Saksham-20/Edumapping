// client/src/components/common/ProtectedRoute.js
import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { Button } from '../ui';
import { LockClosedIcon } from '@heroicons/react/24/outline';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Checking your session" />;
  }

  if (!isAuthenticated) {
    // Remember where they were headed so the login can send them back rather
    // than dumping everyone on the dashboard.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
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
            You don’t have access to this page
          </h1>
          <p className="mt-3 text-sm text-ink-600">
            It’s limited to {requiredRoles.map((r) => r.replace(/_/g, ' ')).join(', ')} accounts.
            You’re signed in as {user.role?.replace(/_/g, ' ')}.
          </p>
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
