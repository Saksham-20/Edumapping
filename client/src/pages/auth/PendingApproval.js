// client/src/pages/auth/PendingApproval.js
import React from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const PendingApproval = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-yellow-100">
            <ClockIcon className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Account Pending Approval
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account is currently under review
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <div className="space-y-6">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mt-0.5 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  What happens next?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Our team will review your account and approve it within 24-48 hours. 
                  You'll receive an email notification once your account is approved.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                While you wait:
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Ensure all your profile information is accurate</li>
                <li>• Prepare your resume and documents</li>
                <li>• Check your email for approval notification</li>
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Have questions about your account?
                </p>
                {/* Was a Link to /contact, which is not a route — the landing
                    page's Connect section is local state, not a URL — so the
                    button silently bounced to the landing page. A mailto is a
                    destination that actually exists. */}
                <a
                  href="mailto:support@edumapping.com?subject=Question%20about%20my%20pending%20account"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Contact Support
                </a>
              </div>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                ← Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;



