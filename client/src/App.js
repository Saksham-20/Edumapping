// client/src/App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast as toastLib } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Add useAuth import here
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Header from './components/common/Header';
import WhatsAppChat from './components/common/WhatsAppChat';
import ErrorBoundary from './components/common/ErrorBoundary';

// Import pages
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import CollegeLogin from './pages/auth/CollegeLogin';
import SchoolLogin from './pages/auth/SchoolLogin';
import Register from './pages/auth/Register';
import CollegeRegister from './pages/auth/CollegeRegister';
import SchoolRegister from './pages/auth/SchoolRegister';
import PendingApproval from './pages/auth/PendingApproval';
import PrivacyPolicy from './pages/PrivacyPolicy';
import StudentDashboard from './pages/dashboard/StudentDashboard';
import SchoolDashboard from './pages/dashboard/SchoolDashboard';
import PrincipalDashboard from './pages/dashboard/PrincipalDashboard';
import TeacherDashboard from './pages/dashboard/TeacherDashboard';
import SchoolAdminDashboard from './pages/dashboard/SchoolAdminDashboard';
import CareerCounselorDashboard from './pages/dashboard/CareerCounselorDashboard';
import RecruiterDashboard from './pages/dashboard/RecruiterDashboard';
import TPODashboard from './pages/dashboard/TPODashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import JobsList from './pages/jobs/JobsList';
import JobDetail from './pages/jobs/JobDetail';
import JobPost from './pages/jobs/JobPost';
import JobEdit from './pages/jobs/JobEdit';
import Profile from './pages/profile/Profile';
import ResumePage from './pages/resume/ResumePage';
import Applications from './pages/applications/Applications';
import ApplicationDetail from './pages/applications/ApplicationDetail';
import Events from './pages/events/Events';
import EventForm from './pages/events/EventForm';
import EventDetails from './pages/events/EventDetails';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/auth/ForgotPassword';
// These three pages were fully written but never imported and never routed —
// the TPO's analytics and approvals surfaces, and the admin's user manager.
import UserManagement from './pages/admin/UserManagement';
import TPOAnalytics from './pages/tpo/TPOAnalytics';
import ApprovalManagement from './pages/approvals/ApprovalManagement';
import ConferencesList from './pages/conference/ConferencesList';

import './styles/index.css';
import './styles/carousel.css';

// Code-split: the conference room drags in livekit-client and the LiveKit
// React components (~hundreds of kB). Loading it eagerly would put that in
// the main bundle and make every landing-page visitor pay for a route only
// signed-in users in a live class ever reach.
const ConferenceRoom = lazy(() => import('./pages/conference/ConferenceRoom'));

// Dashboard router component to redirect based on user role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  // Check if student belongs to a school organization
  if (user.role === 'student' && user.organization?.type === 'school') {
    return <SchoolDashboard />;
  }
  
  // Route school staff roles to their respective dashboards
  if (user.organization?.type === 'school') {
    switch (user.role) {
      case 'principal':
        return <PrincipalDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'school_admin':
        return <SchoolAdminDashboard />;
      case 'career_counselor':
        return <CareerCounselorDashboard />;
    }
  }
  
  switch (user.role) {
    case 'student':
      return <StudentDashboard />;
    case 'recruiter':
      return <RecruiterDashboard />;
    case 'tpo':
      return <TPODashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                className: 'group',
              }}
            >
              {(t) => (
                <div
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 relative group`}
                >
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {t.type === 'success' && (
                          <div className="h-6 w-6 text-green-400">✓</div>
                        )}
                        {t.type === 'error' && (
                          <div className="h-6 w-6 text-red-400">✕</div>
                        )}
                        {(!t.type || t.type === 'blank') && (
                          <div className="h-6 w-6 text-gray-400">ℹ</div>
                        )}
                      </div>
                      <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-gray-900">
                          {typeof t.message === 'string' ? t.message : t.message?.toString() || ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-200">
                    <button
                      onClick={() => toastLib.dismiss(t.id)}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity opacity-0 group-hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </Toaster>
            
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/login/college" element={<CollegeLogin />} />
              <Route path="/login/school" element={<SchoolLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register/college" element={<CollegeRegister />} />
              <Route path="/register/school" element={<SchoolRegister />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Header />
                  <DashboardRouter />
                </ProtectedRoute>
              } />
              
              <Route path="/jobs" element={
                <ProtectedRoute>
                  <Header />
                  <JobsList />
                </ProtectedRoute>
              } />
              
              <Route path="/jobs/:id" element={
                <ProtectedRoute>
                  <Header />
                  <JobDetail />
                </ProtectedRoute>
              } />
              
              <Route path="/jobs/new" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo']}>
                  <Header />
                  <JobPost />
                </ProtectedRoute>
              } />
              
              <Route path="/jobs/:id/edit" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo']}>
                  <Header />
                  <JobEdit />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Header />
                  <Profile />
                </ProtectedRoute>
              } />
              
              <Route path="/users/:id" element={
                <ProtectedRoute>
                  <Header />
                  <Profile />
                </ProtectedRoute>
              } />
              
              <Route path="/resume" element={
                <ProtectedRoute requiredRoles={['student']}>
                  <Header />
                  <ResumePage />
                </ProtectedRoute>
              } />
              
              <Route path="/applications" element={
                <ProtectedRoute>
                  <Header />
                  <Applications />
                </ProtectedRoute>
              } />
              
              <Route path="/applications/:id" element={
                <ProtectedRoute>
                  <Header />
                  <ApplicationDetail />
                </ProtectedRoute>
              } />
              
              <Route path="/events" element={
                <ProtectedRoute>
                  <Header />
                  <Events />
                </ProtectedRoute>
              } />
              
              {/* Creating an event is server-side restricted to non-students with
                  an organization (routes/events.js). Without the same guard here
                  a student could open and fill the whole form, only to be told
                  403 on submit. */}
              <Route path="/events/new" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo', 'admin', 'principal', 'teacher', 'school_admin', 'career_counselor']}>
                  <Header />
                  <EventForm />
                </ProtectedRoute>
              } />

              <Route path="/events/:id" element={
                <ProtectedRoute>
                  <Header />
                  <EventDetails />
                </ProtectedRoute>
              } />
              
              <Route path="/events/:id/edit" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo', 'admin', 'principal', 'teacher', 'school_admin', 'career_counselor']}>
                  <Header />
                  <EventForm />
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Header />
                  <Settings />
                </ProtectedRoute>
              } />

              <Route path="/conferences" element={
                <ProtectedRoute>
                  <Header />
                  <ConferencesList />
                </ProtectedRoute>
              } />

              <Route path="/approvals" element={
                <ProtectedRoute requiredRoles={['tpo', 'admin']}>
                  <Header />
                  <ApprovalManagement />
                </ProtectedRoute>
              } />

              <Route path="/tpo/analytics" element={
                <ProtectedRoute requiredRoles={['tpo', 'admin']}>
                  <Header />
                  <TPOAnalytics />
                </ProtectedRoute>
              } />

              <Route path="/admin/users" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Header />
                  <UserManagement />
                </ProtectedRoute>
              } />

              {/* Live class / conference room.
                  Deliberately rendered WITHOUT <Header /> — the room is a
                  full-viewport surface and the app chrome would steal height
                  from the video stage. */}
              <Route path="/conference/:id" element={
                <ProtectedRoute>
                  <Suspense
                    fallback={
                      <div className="flex min-h-screen items-center justify-center bg-ink-950">
                        <div
                          role="status"
                          aria-label="Loading the live class"
                          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-saffron-500"
                        />
                      </div>
                    }
                  >
                    <ConferenceRoom />
                  </Suspense>
                </ProtectedRoute>
              } />

              {/* Catch-all. This used to redirect silently to the landing page,
                  which made every typo and every dead internal link look like a
                  successful navigation. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            
            {/* WhatsApp Chat Button - appears on all pages */}
            <WhatsAppChat />
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;