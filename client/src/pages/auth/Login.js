// client/src/pages/auth/Login.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Divider, Input, PageLoader } from '../../components/ui';
import { AuthBrand, AuthShell, FormError, PasswordField } from './authKit';

/**
 * Enquiry capture for visitors who have no account yet.
 *
 * It hands off to the user's mail client rather than an API: there is no
 * enquiry endpoint on the server, and a mailto is a destination that exists.
 */
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
      const subject = `New Enquiry from ${enquiryData.name}`;
      const body = `Name: ${enquiryData.name}\nPhone: ${enquiryData.phone}\nEmail: ${enquiryData.email}\nCity: ${enquiryData.city}`;

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
      <Button variant="secondary" fullWidth onClick={() => setShowForm(true)}>
        Fill enquiry form
      </Button>
    );
  }

  return (
    <form onSubmit={handleEnquirySubmit} className="space-y-4">
      <Input
        label="Name"
        name="name"
        type="text"
        required
        value={enquiryData.name}
        onChange={handleEnquiryChange}
        placeholder="Your full name"
      />
      <Input
        label="Phone"
        name="phone"
        type="tel"
        required
        value={enquiryData.phone}
        onChange={handleEnquiryChange}
        placeholder="+91 1234567890"
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        value={enquiryData.email}
        onChange={handleEnquiryChange}
        placeholder="your.email@example.com"
      />
      <Input
        label="City"
        name="city"
        type="text"
        required
        value={enquiryData.city}
        onChange={handleEnquiryChange}
        placeholder="Your city"
      />
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">
          Submit enquiry
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setShowForm(false);
            setEnquiryData({ name: '', phone: '', email: '', city: '' });
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

/**
 * `altLink` is the cross-link between the college and school entrances. It is
 * rendered inside the card rather than by the wrapper pages, which would strand
 * it below a full-viewport screen.
 */
// The API's login identifier is an email *or* a phone number: the route builds
// `_loginId` from `identifier || email`, and authService._findUserByIdentifier
// treats anything without an `@` as a phone and matches `phone` exactly. This
// screen used to declare the field `type="email"` and gate it behind an
// email-only regex, so the phone half of that contract was unreachable from the
// UI — a seeded account like +91-9876543210 could sign in through curl but not
// through the app.
//
// Phones are matched verbatim server-side, so nothing is normalised here; the
// check only has to be loose enough to let a plausible phone number through and
// tight enough to still catch a typo'd email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d][\d\s().-]{5,19}$/;

const Login = ({ isSchoolMode = false, altLink }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  if (isAuthenticated) {
    return (
      <AuthShell>
        <PageLoader label="Taking you to your dashboard" />
      </AuthShell>
    );
  }

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

    const identifier = formData.email.trim();
    if (!identifier) {
      newErrors.email = 'Email or phone number is required';
    } else if (!EMAIL_RE.test(identifier) && !PHONE_RE.test(identifier)) {
      newErrors.email = 'Enter a valid email address or phone number';
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
    setErrors({});

    try {
      await login(formData.email.trim(), formData.password);
      navigate(from, { replace: true });
    } catch (error) {
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

      // The API returns one prose string for every rejection, so the reason has
      // to be recovered from its wording before it can be rephrased.
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
          submit: 'Those sign-in details were not recognised. Check your email or phone number and password, then try again.'
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
    <AuthShell>
      <AuthBrand tagline="Nurturing young minds" />

      <Card>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          New here?{' '}
          <Link
            to={isSchoolMode ? '/register/school' : '/register/college'}
            className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-700"
          >
            Create an account
          </Link>
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <FormError>{errors.submit}</FormError>

          <Input
            label="Email or phone number"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            icon={UserIcon}
            placeholder="you@example.com or +91 9876543210"
          />

          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="Enter your password"
          />

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-ink-600 underline-offset-2 hover:text-ink-950 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <Button type="submit" fullWidth size="lg" loading={isLoading}>
            Sign in
          </Button>
        </form>

        {altLink && (
          <p className="mt-5 text-center text-sm text-ink-600">
            {altLink.prefix}{' '}
            <Link
              to={altLink.to}
              className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-700"
            >
              {altLink.label}
            </Link>
          </p>
        )}

        {/* Outside the sign-in <form>: nesting one form inside another is
            invalid HTML, and the browser drops the inner one. */}
        <Divider className="my-6" />
        <p className="mb-4 text-center text-sm text-ink-600">
          Interested in learning more? Fill out our enquiry form
        </p>
        <EnquiryForm />
      </Card>
    </AuthShell>
  );
};

export default Login;
