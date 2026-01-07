// client/src/pages/auth/SchoolRegister.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../services/api';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SchoolRegister = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'student',
    organizationId: '',
    // Organization creation fields
    organizationName: '',
    organizationDomain: '',
    organizationContactEmail: '',
    organizationContactPhone: '',
    organizationWebsite: '',
    organizationAddress: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      // Only fetch school organizations
      const response = await api.get('/organizations?verified=true');
      const approvedOrgs = (response.organizations || []).filter(org =>
        (org.approvalStatus === 'approved' || org.approvalStatus === undefined) &&
        org.type === 'school'
      );
      setOrganizations(approvedOrgs);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.role || formData.role === '') {
      newErrors.role = 'Please select a role';
    }

    if (formData.role && formData.role !== 'admin') {
      if (formData.role === 'new_school') {
        if (!formData.organizationName.trim()) {
          newErrors.organizationName = 'School name is required';
        }
        if (!formData.organizationDomain) {
          newErrors.organizationDomain = 'School email domain is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.organizationDomain)) {
          newErrors.organizationDomain = 'Please enter a valid email domain';
        }
        if (!formData.organizationContactEmail) {
          newErrors.organizationContactEmail = 'Contact email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.organizationContactEmail)) {
          newErrors.organizationContactEmail = 'Please enter a valid contact email';
        }
      } else if (!formData.organizationId) {
        newErrors.organizationId = 'Please select your school';
      }
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
    try {
      let submitData = { ...formData };
      delete submitData.confirmPassword;

      // Convert empty organizationId to null
      if (submitData.organizationId === '' || submitData.organizationId === undefined) {
        submitData.organizationId = null;
      } else if (submitData.organizationId) {
        // Convert to number if it's a string
        submitData.organizationId = parseInt(submitData.organizationId, 10);
      }

      // Handle new organization registration
      if (formData.role === 'new_school') {
        try {
          // First, create the organization
          const orgData = {
            name: formData.organizationName,
            type: 'school',
            domain: formData.organizationDomain,
            contactEmail: formData.organizationContactEmail,
            contactPhone: formData.organizationContactPhone || null,
            website: formData.organizationWebsite || null,
            address: formData.organizationAddress || null
          };

          const orgResponse = await api.post('/organizations/register', orgData);
          const newOrg = orgResponse.organization;

          // Set the role and organizationId for user registration
          submitData.role = 'student';
          submitData.organizationId = newOrg.id;

          // Clean up organization fields
          delete submitData.organizationName;
          delete submitData.organizationDomain;
          delete submitData.organizationContactEmail;
          delete submitData.organizationContactPhone;
          delete submitData.organizationWebsite;
          delete submitData.organizationAddress;

          toast.success('School created successfully. Your account is being created...');
        } catch (orgError) {
          throw new Error(orgError.message || 'Failed to create school');
        }
      }

      const response = await register(submitData);

      if (response.user) {
        // Verify that the organization is included in the response
        if (!response.user.organization && submitData.organizationId) {
          console.warn('Organization not included in registration response, reloading user...');
          // The organization should be included, but if not, it will be loaded on next auth check
        }
        
        if (formData.role === 'new_school') {
          toast.success(
            `Registration successful! Your school and account are pending admin approval. You will be notified once approved.`,
            { duration: 6000 }
          );
        } else {
          toast.success('Registration successful!');
        }
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('=== REGISTRATION ERROR ===');
      console.error('Full error object:', error);
      console.error('Error message:', error.message);
      console.error('Error status:', error.status);
      console.error('Error data:', error.data);
      console.error('Error response:', error.response);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Response headers:', error.response.headers);
      }
      console.error('==========================');
      
      // Extract error message from various possible locations
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response?.data) {
        // Check for different error formats
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.details && Array.isArray(error.response.data.details)) {
          errorMessage = error.response.data.details.map(d => d.message || d).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({
        submit: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredOrganizations = () => {
    // Only show school organizations
    return organizations.filter(org => org.type === 'school');
  };

  const showNewOrgFields = formData.role === 'new_school';

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo */}
          <Link to="/" className="flex flex-col items-center justify-center hover:opacity-80 transition-opacity">
            <img
              src="/logo.svg"
              alt="EduMapping Logo"
              className="h-20 w-auto mb-4"
            />
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF8C42] to-[#138808] drop-shadow-sm">
              EduMapping
            </span>
            <p className="text-sm text-gray-600 mt-2">School Registration</p>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your school account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login/school"
              className="font-medium text-[#FF8C42] hover:text-[#e67a35]"
            >
              sign in to your existing account
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-gray-500">
            For colleges,{' '}
            <Link
              to="/register/college"
              className="font-medium text-[#138808] hover:text-[#0f6b0f]"
            >
              click here
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
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.firstName ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                  placeholder="First name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.lastName ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
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
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.phone ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                placeholder="Enter your phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                I am a
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${errors.role ? 'border-red-300' : 'border-gray-300'
                  } bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
              >
                <option value="">Select a role</option>
                <option value="student">Student</option>
                <option value="principal">Principal/Headmaster</option>
                <option value="teacher">Teacher</option>
                <option value="school_admin">School Admin</option>
                <option value="career_counselor">Career Counselor</option>
                <option value="new_school">Register New School</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role}</p>
              )}
            </div>

            {/* Organization Selection - Only for existing organizations */}
            {!showNewOrgFields && formData.role && formData.role !== 'admin' && (
              <div>
                <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700">
                  Select Your School
                </label>
                <select
                  id="organizationId"
                  name="organizationId"
                  value={formData.organizationId}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${errors.organizationId ? 'border-red-300' : 'border-gray-300'
                    } bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                >
                  <option value="">Select your school</option>
                  {getFilteredOrganizations().map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                {errors.organizationId && (
                  <p className="mt-1 text-sm text-red-600">{errors.organizationId}</p>
                )}
                {getFilteredOrganizations().length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">No schools available. Please register a new school.</p>
                )}
              </div>
            )}

            {/* New Organization Fields */}
            {showNewOrgFields && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">School Information</h3>
                
                <div>
                  <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
                    School Name *
                  </label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    value={formData.organizationName}
                    onChange={handleChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.organizationName ? 'border-red-300' : 'border-gray-300'
                      } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                    placeholder="Enter school name"
                  />
                  {errors.organizationName && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="organizationDomain" className="block text-sm font-medium text-gray-700">
                    School Email Domain *
                  </label>
                  <input
                    id="organizationDomain"
                    name="organizationDomain"
                    type="email"
                    value={formData.organizationDomain}
                    onChange={handleChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.organizationDomain ? 'border-red-300' : 'border-gray-300'
                      } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                    placeholder="e.g., admin@school.edu"
                  />
                  {errors.organizationDomain && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationDomain}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="organizationContactEmail" className="block text-sm font-medium text-gray-700">
                    Contact Email *
                  </label>
                  <input
                    id="organizationContactEmail"
                    name="organizationContactEmail"
                    type="email"
                    value={formData.organizationContactEmail}
                    onChange={handleChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${errors.organizationContactEmail ? 'border-red-300' : 'border-gray-300'
                      } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                    placeholder="contact@school.edu"
                  />
                  {errors.organizationContactEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationContactEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="organizationContactPhone" className="block text-sm font-medium text-gray-700">
                    Contact Phone (Optional)
                  </label>
                  <input
                    id="organizationContactPhone"
                    name="organizationContactPhone"
                    type="tel"
                    value={formData.organizationContactPhone}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm"
                    placeholder="+91 1234567890"
                  />
                </div>

                <div>
                  <label htmlFor="organizationWebsite" className="block text-sm font-medium text-gray-700">
                    Website (Optional)
                  </label>
                  <input
                    id="organizationWebsite"
                    name="organizationWebsite"
                    type="url"
                    value={formData.organizationWebsite}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm"
                    placeholder="https://www.school.edu"
                  />
                </div>

                <div>
                  <label htmlFor="organizationAddress" className="block text-sm font-medium text-gray-700">
                    Address (Optional)
                  </label>
                  <textarea
                    id="organizationAddress"
                    name="organizationAddress"
                    rows="3"
                    value={formData.organizationAddress}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm"
                    placeholder="School address"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${errors.password ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#FF8C42] focus:border-[#FF8C42] sm:text-sm`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#FF8C42] hover:bg-[#e67a35] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF8C42]"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolRegister;






