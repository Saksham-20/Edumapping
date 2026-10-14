// client/src/pages/auth/Register.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Button, Card, Input, Select, Textarea } from '../../components/ui';
import { AuthBrand, AuthShell, FormError, PasswordField } from './authKit';
import { asOrgError, isEmail, isPhone, submitErrors, trimPayload } from './registerKit';
import { isSignedInOnRegister } from '../../services/auth';
import EmailCodeField, { isValidEmailCode, useEmailVerificationRequired } from './EmailCodeField';

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
    organizationAddress: '',
    // A new campus is a college or a university; most tier-2/3 engineering
    // campuses are affiliated colleges, so that is the default.
    organizationType: 'college'
  });
  const [organizations, setOrganizations] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const emailVerificationRequired = useEmailVerificationRequired();
  // The institution created on an earlier attempt. The org is created before
  // the account, so when the account step failed (email taken, server
  // validation) a retry used to create the org again and hit 409 "already
  // registered", leaving the person stuck. A retry now reuses it.
  const [createdOrg, setCreatedOrg] = useState(null);

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
      [name]: value,
      // A college picked as a student is not a valid company for a recruiter.
      // Keeping it made the dropdown read "Select a company" while the form
      // still submitted the college, and the server refused the signup.
      ...(name === 'role' ? { organizationId: '' } : {})
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
    } else if (!isEmail(formData.email)) {
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

    if (formData.phone && !isPhone(formData.phone)) {
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
          newErrors.organizationName = `${formData.role === 'new_university' ? 'College or university' : 'Company'} name is required`;
        }
        if (!formData.organizationDomain) {
          newErrors.organizationDomain = 'Email domain is required';
        } else if (!/^(\S+@)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(formData.organizationDomain.trim())) {
          newErrors.organizationDomain = 'Enter a domain such as school.edu';
        }
        if (!formData.organizationContactEmail) {
          newErrors.organizationContactEmail = 'Contact email is required';
        } else if (!isEmail(formData.organizationContactEmail)) {
          newErrors.organizationContactEmail = 'Please enter a valid contact email';
        }
        // The server adds https:// when it is missing, so "gecajmer.ac.in" is fine.
        if (formData.organizationWebsite && !/^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(formData.organizationWebsite.trim())) {
          newErrors.organizationWebsite = 'Enter a website such as gecajmer.ac.in';
        }
      } else if (!formData.organizationId) {
        newErrors.organizationId = 'Please select an organization';
      }
    }

    if (emailVerificationRequired && !isValidEmailCode(otp)) {
      newErrors.otp = 'Enter the 6-digit code we emailed you';
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
      let submitData = trimPayload(formData);
      delete submitData.confirmPassword;

      // Handle new organization registration
      if (formData.role === 'new_university' || formData.role === 'new_company') {
        try {
          // First, create the organization
          const orgData = {
            name: formData.organizationName,
            type: formData.role === 'new_university' ? formData.organizationType : 'company',
            // Stored bare ("school.edu"); people often type an address instead.
            domain: formData.organizationDomain.trim().replace(/^.*@/, '').toLowerCase(),
            contactEmail: formData.organizationContactEmail,
            contactPhone: formData.organizationContactPhone || null,
            website: formData.organizationWebsite || null,
            address: formData.organizationAddress || null
          };

          const orgKey = `${orgData.type}:${orgData.name.trim().toLowerCase()}`;
          let newOrg = createdOrg && createdOrg.key === orgKey ? createdOrg : null;
          if (!newOrg) {
            const orgResponse = await api.post('/organizations/register', orgData);
            newOrg = { id: orgResponse.organization.id, key: orgKey };
            setCreatedOrg(newOrg);
          }

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
          delete submitData.organizationType;
        } catch (orgError) {
          throw asOrgError(orgError, `Could not register your ${newOrgNoun}. Check its details and try again.`);
        }
      } else {
        delete submitData.organizationType;
        // Don't send organizationId for admin role
        if (formData.role === 'admin') {
          delete submitData.organizationId;
        }
      }

      if (otp) submitData.otp = otp;

      const response = await register(submitData);

      // A new institution, a recruiter or a placement officer waits for
      // approval: they are not signed in yet, so show them what happens next
      // rather than a sign-in page.
      if (!isSignedInOnRegister(response.user)) {
        navigate('/pending-approval', {
          replace: true,
          state: {
            institution: String(formData.role || '').startsWith('new_'),
            company: formData.role === 'new_company',
            email: response.user?.email
          }
        });
        return;
      }

      // Only an approved account (a student) gets here: it is signed in by
      // now, so it goes straight to its dashboard. Everyone else returned to
      // /pending-approval above.
      toast.success('Account created. Welcome to EduMapping!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrors(submitErrors(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredOrganizations = () => {
    if (formData.role === 'student' || formData.role === 'tpo') {
      // Colleges and universities both. Filtering on 'university' alone hid
      // every campus registered as a college, which is most of them.
      // (School students sign up on /register/school.)
      return organizations.filter(org => org.type === 'university' || org.type === 'college');
    } else if (formData.role === 'recruiter') {
      // Companies only, minus the platform's own "EduMapping" organization
      // (migration 30): it holds platform-wide events, and a recruiter
      // signing up under it would be attaching themselves to the platform.
      return organizations.filter(org => org.type === 'company' && org.name !== 'EduMapping');
    }
    return organizations;
  };

  const isNewOrg = formData.role === 'new_university' || formData.role === 'new_company';
  const isUniversitySide = formData.role === 'student' || formData.role === 'tpo';
  const newOrgNoun = formData.role === 'new_university' ? formData.organizationType : 'company';
  const availableOrgs = getFilteredOrganizations();
  // A student who cannot find their campus must not be steered to "register
  // my college": that path makes them its placement officer. They are sent
  // to their TPO instead.
  const orgPickerHelp =
    formData.role === 'student'
      ? availableOrgs.length === 0
        ? 'No colleges are open for sign-up yet. Ask your placement officer (TPO) to register your college on EduMapping.'
        : 'Can’t find your college? It may not be on EduMapping yet. Ask your placement officer (TPO) to register it.'
      : `Can’t find yours? Choose "Register my ${isUniversitySide ? 'college or university' : 'company'}" in the list above.`;

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

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
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

          {emailVerificationRequired && (
            <EmailCodeField
              email={formData.email}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
              }}
              error={errors.otp}
            />
          )}

          <Input
            label="Phone number"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            help="Optional."
            placeholder="+919876543210"
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
              <option value="new_university">Register my college or university</option>
              <option value="new_company">Register my company</option>
            </optgroup>
          </Select>

          {formData.role && formData.role !== 'admin' && !isNewOrg && (
            <Select
              label={isUniversitySide ? 'College or university' : 'Company'}
              name="organizationId"
              value={formData.organizationId}
              onChange={handleChange}
              error={errors.organizationId}
              help={orgPickerHelp}
            >
              <option value="">
                Select {isUniversitySide ? 'your college' : 'your company'}
              </option>
              {availableOrgs.length > 0 ? (
                availableOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No {isUniversitySide ? 'colleges' : 'companies'} available
                </option>
              )}
            </Select>
          )}

          {isNewOrg && (
            <fieldset className="space-y-4 rounded-2xl border border-ink-950/15 bg-bone-100 p-4">
              <legend className="px-1 font-display text-sm font-bold text-ink-950">
                {formData.role === 'new_university' ? 'Institution' : 'Company'} details
              </legend>

              <p className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-3 py-2.5 text-sm text-saffron-900">
                The EduMapping team checks every new {newOrgNoun} before it goes live, usually
                within one working day. You can sign in once it is approved.
              </p>

              {formData.role === 'new_university' && (
                <Select
                  label="Type of institution"
                  name="organizationType"
                  value={formData.organizationType}
                  onChange={handleChange}
                  help="Affiliated and autonomous colleges are colleges."
                >
                  <option value="college">College</option>
                  <option value="university">University</option>
                </Select>
              )}

              <Input
                label={`${formData.role === 'new_university' ? (formData.organizationType === 'college' ? 'College' : 'University') : 'Company'} name`}
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={handleChange}
                error={errors.organizationName}
                placeholder={`Enter ${newOrgNoun} name`}
              />

              <Input
                label="Email domain"
                name="organizationDomain"
                type="text"
                required
                value={formData.organizationDomain}
                onChange={handleChange}
                error={errors.organizationDomain}
                help={`The part after @ in your ${newOrgNoun}'s email addresses.`}
                placeholder={formData.role === 'new_university' ? 'e.g. gecajmer.ac.in' : 'e.g. company.com'}
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
                placeholder="+919876543210"
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
