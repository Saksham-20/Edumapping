// client/src/pages/PrivacyPolicy.js
//
// A public page: it renders outside the app chrome (no <Header />), so it does
// not use PageShell. Plain centred prose on the brand canvas instead.
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

/** One policy section. Keeps the heading rhythm identical throughout. */
const Section = ({ id, number, title, children }) => (
  <section id={id} className="mt-10">
    <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">
      <span className="mr-2 font-mono text-sm text-ink-500">{number}</span>
      {title}
    </h2>
    <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink-800">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="list-disc space-y-2 pl-5 marker:text-saffron-500">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

const BackLink = ({ className = '' }) => (
  <Link
    to="/"
    className={`inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-ink-700 underline-offset-4 hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 ${className}`}
  >
    <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
    Back to home
  </Link>
);

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-bone-50 px-4 py-12 sm:px-6 lg:px-8">
    <main className="mx-auto w-full max-w-prose">
      <BackLink />

      <header className="mt-6 border-b border-ink-950/15 pb-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
          EduMapping
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-950">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-ink-600">Last updated: {new Date().getFullYear()}</p>
      </header>

      <Section id="introduction" number="1" title="Introduction">
        <p>
          Welcome to EduMapping (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are
          committed to protecting your privacy and ensuring the security of your personal
          information. This Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our platform.
        </p>
      </Section>

      <Section id="information-we-collect" number="2" title="Information we collect">
        <h3 className="font-display text-base font-bold text-ink-950">2.1 Personal information</h3>
        <p>We may collect personal information that you provide directly to us, including:</p>
        <List
          items={[
            'Name, email address, phone number, and contact information',
            'Academic information (course, year of study, graduation year)',
            'Resume, skills, achievements, and professional profile',
            'Job application history and preferences',
            'Organization details (for TPOs and recruiters)'
          ]}
        />
        <h3 className="pt-2 font-display text-base font-bold text-ink-950">
          2.2 Automatically collected information
        </h3>
        <p>
          We may automatically collect certain information about your device and usage patterns,
          including:
        </p>
        <List
          items={[
            'IP address and browser type',
            'Device information and operating system',
            'Usage data and interaction patterns',
            'Cookies and similar tracking technologies'
          ]}
        />
      </Section>

      <Section id="how-we-use" number="3" title="How we use your information">
        <p>We use the collected information for various purposes, including:</p>
        <List
          items={[
            'Providing and maintaining our services',
            'Matching students with job opportunities',
            'Facilitating communication between students, TPOs, and recruiters',
            'Sending notifications and updates about job opportunities',
            'Improving our platform and user experience',
            'Complying with legal obligations',
            'Preventing fraud and ensuring platform security'
          ]}
        />
      </Section>

      <Section id="sharing" number="4" title="Information sharing and disclosure">
        <p>We may share your information in the following circumstances:</p>
        <List
          items={[
            <>
              <strong className="font-semibold text-ink-950">With recruiters:</strong> your profile
              and application information may be shared with recruiters when you apply for jobs
            </>,
            <>
              <strong className="font-semibold text-ink-950">With TPOs:</strong> your academic and
              placement information may be accessible to your institution&rsquo;s TPO
            </>,
            <>
              <strong className="font-semibold text-ink-950">Service providers:</strong> we may
              share information with third-party service providers who assist us in operating our
              platform
            </>,
            <>
              <strong className="font-semibold text-ink-950">Legal requirements:</strong> we may
              disclose information if required by law or to protect our rights and safety
            </>,
            <>
              <strong className="font-semibold text-ink-950">Business transfers:</strong>{' '}
              information may be transferred in connection with a merger, acquisition, or sale of
              assets
            </>
          ]}
        />
      </Section>

      <Section id="security" number="5" title="Data security">
        <p>
          We implement appropriate technical and organizational measures to protect your personal
          information against unauthorized access, alteration, disclosure, or destruction. However,
          no method of transmission over the internet or electronic storage is 100% secure.
        </p>
      </Section>

      <Section id="your-rights" number="6" title="Your rights">
        <p>You have the right to:</p>
        <List
          items={[
            'Access and review your personal information',
            'Update or correct inaccurate information',
            'Request deletion of your account and data',
            'Opt out of certain communications',
            'Export your data in a portable format'
          ]}
        />
      </Section>

      <Section id="cookies" number="7" title="Cookies and tracking technologies">
        <p>
          We use cookies and similar tracking technologies to track activity on our platform and
          store certain information. You can instruct your browser to refuse all cookies or to
          indicate when a cookie is being sent.
        </p>
      </Section>

      <Section id="childrens-privacy" number="8" title={'Children’s privacy'}>
        <p>
          Our platform is not intended for individuals under the age of 18. We do not knowingly
          collect personal information from children.
        </p>
      </Section>

      <Section id="changes" number="9" title="Changes to this Privacy Policy">
        <p>
          We may update our Privacy Policy from time to time. We will notify you of any changes by
          posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo;
          date.
        </p>
      </Section>

      <Section id="contact" number="10" title="Contact us">
        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
        <dl className="rounded-2xl border border-ink-950/15 bg-white p-5 text-sm">
          <div className="flex gap-3 py-1">
            <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
              Email
            </dt>
            <dd>
              <a className="underline hover:text-ink-950" href="mailto:hello@edumapping.com">
                hello@edumapping.com
              </a>
            </dd>
          </div>
          <div className="flex gap-3 py-1">
            <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
              Phone
            </dt>
            <dd>
              <a className="underline hover:text-ink-950" href="tel:+919104991059">
                +91 91049 91059
              </a>
            </dd>
          </div>
          <div className="flex gap-3 py-1">
            <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
              Website
            </dt>
            <dd>www.edumapping.com</dd>
          </div>
        </dl>
      </Section>

      <div className="mt-12 border-t border-ink-950/15 pt-6">
        <BackLink />
      </div>
    </main>
  </div>
);

export default PrivacyPolicy;
