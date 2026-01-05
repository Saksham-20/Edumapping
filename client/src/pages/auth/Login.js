// client/src/pages/auth/Login.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Enquiry Form Component
const EnquiryForm = () => {
  const [enquiryData, setEnquiryData] = useState({
    name: '',
    phone: '',
    email: '',
    city: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleEnquiryChange = (e) => {
    const { name, value } = e.target;
    setEnquiryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send enquiry data to backend or email service
      const subject = `New Enquiry from ${enquiryData.name}`;
      const body = `Name: ${enquiryData.name}\nPhone: ${enquiryData.phone}\nEmail: ${enquiryData.email}\nCity: ${enquiryData.city}`;
      
      // You can either use an API endpoint or mailto link
      window.location.href = `mailto:hello@edumapping.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      toast.success('Thank you for your enquiry! We will get back to you soon.');
      setEnquiryData({ name: '', phone: '', email: '', city: '' });
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to submit enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full py-2 px-4 border-2 border-primary-500 text-primary-600 rounded-md font-medium hover:bg-primary-50 transition-colors"
      >
        Fill Enquiry Form
      </button>
    );
  }

  return (
    <form onSubmit={handleEnquirySubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="enquiry-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            id="enquiry-name"
            name="name"
            type="text"
            required
            value={enquiryData.name}
            onChange={handleEnquiryChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label htmlFor="enquiry-phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone *
          </label>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            required
            value={enquiryData.phone}
            onChange={handleEnquiryChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="+91 1234567890"
          />
        </div>
        <div>
          <label htmlFor="enquiry-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            id="enquiry-email"
            name="email"
            type="email"
            required
            value={enquiryData.email}
            onChange={handleEnquiryChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="your.email@example.com"
          />
        </div>
        <div>
          <label htmlFor="enquiry-city" className="block text-sm font-medium text-gray-700 mb-1">
            City *
          </label>
          <input
            id="enquiry-city"
            name="city"
            type="text"
            required
            value={enquiryData.city}
            onChange={handleEnquiryChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Your city"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-md font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Enquiry'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setEnquiryData({ name: '', phone: '', email: '', city: '' });
          }}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

const Login = ({ isSchoolMode = false }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Show loading if already authenticated and redirecting
  if (isAuthenticated) {
    return <LoadingSpinner />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous errors
    
    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      
      // Extract error message from various possible error formats
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check if it's an approval status error
      if (errorMessage.toLowerCase().includes('pending approval') || errorMessage.toLowerCase().includes('pending')) {
        setErrors({
          submit: 'Your account is pending approval. Please wait for TPO/Admin approval before logging in.'
        });
      } else if (errorMessage.toLowerCase().includes('rejected')) {
        setErrors({
          submit: 'Your account has been rejected. Please contact support for more information.'
        });
      } else if (errorMessage.toLowerCase().includes('invalid credentials') || errorMessage.toLowerCase().includes('invalid')) {
        setErrors({
          submit: 'Invalid email or password. Please check your credentials and try again.'
        });
      } else if (errorMessage.toLowerCase().includes('disabled')) {
        setErrors({
          submit: 'Your account has been disabled. Please contact support for more information.'
        });
      } else {
        setErrors({
          submit: errorMessage
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo */}
          <Link to="/" className="flex flex-col items-center justify-center hover:opacity-80 transition-opacity">
            <img
              src="/logo.svg"
              alt="EduMapping Logo"
              className="h-20 w-auto mb-2"
            />
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-sm">
              EduMapping
            </span>
            <span className="text-xs text-gray-500 font-medium mt-1 text-center">Nurturing Young Minds</span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to={isSchoolMode ? "/register/school" : "/register/college"}
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.submit && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{errors.submit}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.email ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${errors.password ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          {/* Enquiry Form Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-4">
              Interested in learning more? Fill out our enquiry form
            </p>
            <EnquiryForm />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <LoadingSpinner size="small" className="text-white" />
              ) : (
                'Sign in'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Login;