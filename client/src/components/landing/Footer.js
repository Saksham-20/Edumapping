// client/src/components/landing/Footer.js
import React from 'react';
import { Link } from 'react-router-dom';
import { EnvelopeIcon, GlobeAltIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { Brand } from './Nav';
import { Container, GridTexture } from './primitives';

const NAV_ITEMS = [
  { label: 'Home', page: 'home' },
  { label: 'Features', page: 'features' },
  { label: 'About', page: 'about' },
  { label: 'Connect with us', page: 'contact' }
];

const SOCIALS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/1Gm6idAExE/',
    hover: 'hover:border-[#1877F2] hover:bg-[#1877F2]',
    path:
      'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/edumapping?igsh=MTBoYnFzZGVqZGEyZA==',
    hover: 'hover:border-[#dc2743] hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#dc2743]',
    path:
      'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.218 4.771 1.091 6.352 2.966a11.942 11.942 0 0 1 2.668 6.479c0 3.204-.012 3.584-.07 4.85-.059 3.28-1.082 4.771-2.966 6.352-1.195 1.188-2.586 2.124-4.193 2.614-1.61.494-3.31.54-4.885.54-3.204 0-3.584-.012-4.85-.07-3.26-.219-4.771-1.091-6.352-2.966a11.942 11.942 0 0 1-2.668-6.479c0-3.204.012-3.584.07-4.85.059-3.28 1.082-4.771 2.966-6.352 1.188-1.195 2.586-2.124 4.193-2.614 1.61-.494 3.31-.54 4.885-.54zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.88.2 4.358 2.618 6.78 6.98 6.98C8.333 23.914 8.741 24 12 24c3.259 0 3.668-.014 4.88-.072 4.358-.2 6.78-2.618 6.98-6.98.059-1.212.072-1.621.072-4.88 0-3.259-.014-3.667-.072-4.88-.2-4.358-2.618-6.78-6.98-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z'
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/edumapping/',
    hover: 'hover:border-[#0A66C2] hover:bg-[#0A66C2]',
    path:
      'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.453C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
  }
];

const CONTACT = [
  { icon: EnvelopeIcon, label: 'hello@edumapping.com', href: 'mailto:hello@edumapping.com' },
  {
    icon: GlobeAltIcon,
    label: 'www.edumapping.com',
    href: 'https://www.edumapping.com',
    external: true
  },
  { icon: PhoneIcon, label: '+91 91049 91059', href: 'tel:+919104991059' }
];

const Footer = ({ onNavigate }) => (
  <footer className="relative overflow-hidden bg-ink-950 text-white/60">
    <GridTexture tone="dark" fade={false} />
    {/* Saffron hairline — the last brand beat on the page. */}
    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-tricolor-warm" />

    <Container className="relative py-16">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="sm:col-span-2">
          <Brand tone="dark" />
          <p className="mt-6 max-w-sm text-sm leading-relaxed">
            Making youth job-ready with essential employability skills — connecting education with
            employment across schools, colleges and industry.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
              Follow us
            </span>
            {SOCIALS.map(({ label, href, hover, path }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 ${hover}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ width: 18, height: 18 }}
                >
                  <path d={path} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <nav className="lp-footer-links" aria-label="Footer">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white">
            Quick links
          </h3>
          {/* min-h-[44px] on every row: these are the smallest tap targets on
              the page and sit at the very bottom, where thumbs are least
              accurate. */}
          <ul className="mt-4">
            {NAV_ITEMS.map(({ label, page }) => (
              <li key={page}>
                <button
                  type="button"
                  onClick={() => onNavigate(page)}
                  className="lp-link flex min-h-[44px] w-full cursor-pointer items-center rounded text-left text-sm transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
                >
                  {label}
                </button>
              </li>
            ))}
            <li>
              <Link
                to="/login"
                className="lp-link inline-flex min-h-[44px] cursor-pointer items-center rounded text-sm transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white">
            Contact
          </h3>
          <ul className="mt-4">
            {CONTACT.map(({ icon: Icon, label, href, external }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 break-words rounded text-sm transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
                >
                  <Icon className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
        <p className="text-center text-sm sm:text-left">
          © {new Date().getFullYear()} EduMapping. All rights reserved. ·{' '}
          <Link
            to="/privacy"
            className="lp-link inline-flex min-h-[44px] cursor-pointer items-center transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
          >
            Privacy Policy
          </Link>
        </p>
        <p className="text-sm">
          Developed by <span className="font-semibold text-white">Globoniks</span>
        </p>
      </div>
    </Container>
  </footer>
);

export default Footer;
