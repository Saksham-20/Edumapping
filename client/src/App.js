// client/src/App.js
import React from 'react';
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
import Register from './pages/auth/Register';
import PendingApproval from './pages/auth/PendingApproval';
import PrivacyPolicy from './pages/PrivacyPolicy';
import StudentDashboard from './pages/dashboard/StudentDashboard';
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

import './styles/index.css';
import './styles/carousel.css';

// Dashboard router component to redirect based on user role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
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
              <Route path="/register" element={<Register />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
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
              
              <Route path="/events/new" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo']}>
                  <Header />
                  <EventForm />
                </ProtectedRoute>
              } />
              
              <Route path="/events/:id/edit" element={
                <ProtectedRoute requiredRoles={['recruiter', 'tpo']}>
                  <Header />
                  <EventForm />
                </ProtectedRoute>
              } />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
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