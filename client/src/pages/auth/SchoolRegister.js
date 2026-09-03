// client/src/pages/auth/SchoolRegister.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Button, Card, Input, PageLoader, Select, Textarea } from '../../components/ui';
import { AuthBrand, AuthShell, FormError, PasswordField } from './authKit';

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
      // A failed lookup leaves the dropdown empty; validation still blocks submit.
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

    if (formData.phone && !/^[+]?[1-9][\d]{0,15}$/.test(formData.phone)) {
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
        if (formData.role === 'new_school') {
          toast.success(
            'Registration successful! Your school and account are pending admin approval. You will be notified once approved.',
            { duration: 6000 }
          );
        } else {
          toast.success('Registration successful!');
        }
        navigate('/dashboard');
      }
    } catch (error) {
      // The API is inconsistent about where the reason lands, so every known
      // shape is unwrapped before falling back to a generic message.
      let errorMessage = 'Registration failed. Please try again.';

      if (error.response?.data) {
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
  const availableOrgs = getFilteredOrganizations();

  if (isLoading) {
    return (
      <AuthShell>
        <PageLoader label="Creating your account" />
      </AuthShell>
    );
  }

  return (
    <AuthShell width="max-w-lg">
      <AuthBrand tagline="School registration" />

      <Card>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
          Create your school account
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Already registered?{' '}
          <Link
            to="/login/school"
            className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-700"
          >
            Sign in instead
          </Link>
        </p>
        <p className="mt-1 text-sm text-ink-500">
          For colleges,{' '}
          <Link
            to="/register/college"
            className="font-medium text-ink-700 underline underline-offset-2 hover:text-ink-950"
          >
            click here
          </Link>
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormError>{errors.submit}</FormError>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleChange}
              error={errors.firstName}
              placeholder="First name"
            />
            <Input
              label="Last name"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleChange}
              error={errors.lastName}
              placeholder="Last name"
            />
          </div>

          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="you@school.edu"
          />

          <Input
            label="Phone number"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            help="Optional."
            placeholder="+91 1234567890"
          />

          <Select
            label="I am a"
            name="role"
            value={formData.role}
            onChange={handleChange}
            error={errors.role}
          >
            <option value="">Select a role</option>
            <option value="student">Student</option>
            <option value="principal">Principal/Headmaster</option>
            <option value="teacher">Teacher</option>
            <option value="school_admin">School Admin</option>
            <option value="career_counselor">Career Counselor</option>
            <option value="new_school">Register New School</option>
          </Select>

          {!showNewOrgFields && formData.role && formData.role !== 'admin' && (
            <Select
              label="Select your school"
              name="organizationId"
              value={formData.organizationId}
              onChange={handleChange}
              error={errors.organizationId}
              help={
                availableOrgs.length === 0
                  ? 'No schools available. Please register a new school.'
                  : undefined
              }
            >
              <option value="">Select your school</option>
              {availableOrgs.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          )}

          {showNewOrgFields && (
            <fieldset className="space-y-4 rounded-2xl border border-ink-950/15 bg-bone-100 p-4">
              <legend className="px-1 font-display text-sm font-bold text-ink-950">
                School information
              </legend>

              <Input
                label="School name"
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={handleChange}
                error={errors.organizationName}
                placeholder="Enter school name"
              />

              <Input
                label="School email domain"
                name="organizationDomain"
                type="email"
                required
                value={formData.organizationDomain}
                onChange={handleChange}
                error={errors.organizationDomain}
                placeholder="e.g., admin@school.edu"
              />

              <Input
                label="Contact email"
                name="organizationContactEmail"
                type="email"
                required
                value={formData.organizationContactEmail}
                onChange={handleChange}
                error={errors.organizationContactEmail}
                placeholder="contact@school.edu"
              />

              <Input
                label="Contact phone"
                name="organizationContactPhone"
                type="tel"
                value={formData.organizationContactPhone}
                onChange={handleChange}
                help="Optional."
                placeholder="+91 1234567890"
              />

              <Input
                label="Website"
                name="organizationWebsite"
                type="url"
                value={formData.organizationWebsite}
                onChange={handleChange}
                help="Optional."
                placeholder="https://www.school.edu"
              />

              <Textarea
                label="Address"
                name="organizationAddress"
                rows={3}
                value={formData.organizationAddress}
                onChange={handleChange}
                help="Optional."
                placeholder="School address"
              />
            </fieldset>
          )}

          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            help="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
            placeholder="Enter your password"
          />

          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            placeholder="Confirm your password"
          />

          <Button type="submit" fullWidth size="lg">
            Create account
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
};

export default SchoolRegister;
