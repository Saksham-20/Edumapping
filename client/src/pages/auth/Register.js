// client/src/pages/auth/Register.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Button, Card, Input, Select, Textarea } from '../../components/ui';
import { AuthBrand, AuthShell, FormError, PasswordField } from './authKit';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '',
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
      // Only fetch approved organizations for registration
      const response = await api.get('/organizations?verified=true');
      // Filter to only show approved organizations
      const approvedOrgs = (response.organizations || []).filter(org =>
        org.approvalStatus === 'approved' || org.approvalStatus === undefined
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

    // Validate organization selection or creation
    if (formData.role && formData.role !== 'admin') {
      if (formData.role === 'new_university' || formData.role === 'new_company') {
        // Validate organization creation fields
        if (!formData.organizationName?.trim()) {
          newErrors.organizationName = `${formData.role === 'new_university' ? 'University' : 'Company'} name is required`;
        }
        if (!formData.organizationDomain) {
          newErrors.organizationDomain = 'Domain email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.organizationDomain)) {
          newErrors.organizationDomain = 'Please enter a valid domain email';
        }
        if (!formData.organizationContactEmail) {
          newErrors.organizationContactEmail = 'Contact email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.organizationContactEmail)) {
          newErrors.organizationContactEmail = 'Please enter a valid contact email';
        }
        if (formData.organizationWebsite && !/^https?:\/\/.+/.test(formData.organizationWebsite)) {
          newErrors.organizationWebsite = 'Please enter a valid website URL (starting with http:// or https://)';
        }
      } else if (!formData.organizationId) {
        newErrors.organizationId = 'Please select an organization';
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

      // Handle new organization registration
      if (formData.role === 'new_university' || formData.role === 'new_company') {
        try {
          // First, create the organization
          const orgData = {
            name: formData.organizationName,
            type: formData.role === 'new_university' ? 'university' : 'company',
            domain: formData.organizationDomain,
            contactEmail: formData.organizationContactEmail,
            contactPhone: formData.organizationContactPhone || null,
            website: formData.organizationWebsite || null,
            address: formData.organizationAddress || null
          };

          const orgResponse = await api.post('/organizations/register', orgData);
          const newOrg = orgResponse.organization;

          // Set the role and organizationId for user registration
          submitData.role = formData.role === 'new_university' ? 'tpo' : 'recruiter';
          submitData.organizationId = newOrg.id;

          // Clean up organization fields
          delete submitData.organizationName;
          delete submitData.organizationDomain;
          delete submitData.organizationContactEmail;
          delete submitData.organizationContactPhone;
          delete submitData.organizationWebsite;
          delete submitData.organizationAddress;

          toast.success(`${formData.role === 'new_university' ? 'University' : 'Company'} created successfully. Your account is being created...`);
        } catch (orgError) {
          throw new Error(orgError.message || `Failed to create ${formData.role === 'new_university' ? 'university' : 'company'}`);
        }
      } else {
        // Don't send organizationId for admin role
        if (formData.role === 'admin') {
          delete submitData.organizationId;
        }
      }

      const response = await register(submitData);

      // Where to land afterwards. Registration signs the user straight in — the
      // service stores the returned tokens — so sending them to '/' dropped a
      // freshly authenticated user back onto the marketing landing page, which
      // is what both branches below used to do. The college and school
      // registration screens already go to /dashboard; this now matches them,
      // and ProtectedRoute redirects to /pending-approval on its own if the
      // account is not approved.
      const land = () => navigate('/dashboard', { replace: true });

      // Check if user needs approval
      if (response.user.approvalStatus === 'pending') {
        // Show appropriate message based on registration type
        if (formData.role === 'new_university' || formData.role === 'new_company') {
          toast.success(
            `Registration successful! Your ${formData.role === 'new_university' ? 'university' : 'company'} and account are pending admin approval. You will be notified once approved.`,
            { duration: 6000 }
          );
        } else if (response.user.role === 'recruiter') {
          navigate('/pending-approval', { replace: true });
          return;
        } else {
          toast.success('Registration successful! Your account is pending approval. Redirecting...');
        }
        land();
      } else {
        // User is auto-approved, redirect to dashboard
        if (formData.role === 'new_university' || formData.role === 'new_company') {
          toast.success(
            `Registration successful! Your ${formData.role === 'new_university' ? 'university' : 'company'} has been created.`,
            { duration: 5000 }
          );
        }
        land();
      }
    } catch (error) {
      setErrors({
        submit: error.message || 'Registration failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredOrganizations = () => {
    if (formData.role === 'student' || formData.role === 'tpo') {
      // Students and TPOs can only belong to university organizations
      return organizations.filter(org => org.type === 'university');
    } else if (formData.role === 'recruiter') {
      // Recruiters can only belong to company organizations
      return organizations.filter(org => org.type === 'company');
    }
    return organizations;
  };

  const isNewOrg = formData.role === 'new_university' || formData.role === 'new_company';
  const isUniversitySide = formData.role === 'student' || formData.role === 'tpo';
  const newOrgNoun = formData.role === 'new_university' ? 'university' : 'company';
  const availableOrgs = getFilteredOrganizations();

  return (
    <AuthShell width="max-w-lg">
      <AuthBrand />

      <Card>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-700"
          >
            Sign in instead
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
            placeholder="you@example.com"
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
            label="Role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            error={errors.role}
          >
            <option value="">Select a role</option>
            <option value="student">Student</option>
            <option value="tpo">Training &amp; Placement Officer (TPO)</option>
            <option value="recruiter">Recruiter</option>
            <optgroup label="Register New Organization">
              <option value="new_university">Register as New University</option>
              <option value="new_company">Register as New Company</option>
            </optgroup>
          </Select>

          {formData.role && formData.role !== 'admin' && !isNewOrg && (
            <Select
              label={isUniversitySide ? 'University' : 'Company'}
              name="organizationId"
              value={formData.organizationId}
              onChange={handleChange}
              error={errors.organizationId}
              help={
                availableOrgs.length === 0
                  ? `No approved ${isUniversitySide ? 'universities' : 'companies'} are available. Please contact an administrator.`
                  : undefined
              }
            >
              <option value="">
                Select {isUniversitySide ? 'a university' : 'a company'}
              </option>
              {availableOrgs.length > 0 ? (
                availableOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No {isUniversitySide ? 'universities' : 'companies'} available
                </option>
              )}
            </Select>
          )}

          {isNewOrg && (
            <fieldset className="space-y-4 rounded-2xl border border-ink-950/15 bg-bone-100 p-4">
              <legend className="px-1 font-display text-sm font-bold text-ink-950">
                {formData.role === 'new_university' ? 'University' : 'Company'} details
              </legend>

              <p className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-3 py-2.5 text-sm text-saffron-900">
                Your {newOrgNoun} will be created with <strong>pending</strong> approval status. An
                admin will review and approve it before it becomes active.
              </p>

              <Input
                label={`${formData.role === 'new_university' ? 'University' : 'Company'} name`}
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={handleChange}
                error={errors.organizationName}
                placeholder={`Enter ${newOrgNoun} name`}
              />

              <Input
                label="Domain email"
                name="organizationDomain"
                type="email"
                required
                value={formData.organizationDomain}
                onChange={handleChange}
                error={errors.organizationDomain}
                help={`This will be used to verify your ${newOrgNoun} domain.`}
                placeholder={`example@${formData.role === 'new_university' ? 'university.edu' : 'company.com'}`}
              />

              <Input
                label="Contact email"
                name="organizationContactEmail"
                type="email"
                required
                value={formData.organizationContactEmail}
                onChange={handleChange}
                error={errors.organizationContactEmail}
                placeholder="contact@example.com"
              />

              <Input
                label="Contact phone"
                name="organizationContactPhone"
                type="tel"
                value={formData.organizationContactPhone}
                onChange={handleChange}
                error={errors.organizationContactPhone}
                placeholder="+1-555-0100"
              />

              <Input
                label="Website"
                name="organizationWebsite"
                type="url"
                value={formData.organizationWebsite}
                onChange={handleChange}
                error={errors.organizationWebsite}
                placeholder="https://example.com"
              />

              <Textarea
                label="Address"
                name="organizationAddress"
                rows={3}
                value={formData.organizationAddress}
                onChange={handleChange}
                error={errors.organizationAddress}
                placeholder="Enter full address"
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
            placeholder="Create a password"
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

          <Button type="submit" fullWidth size="lg" loading={isLoading}>
            Create account
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
};

export default Register;
