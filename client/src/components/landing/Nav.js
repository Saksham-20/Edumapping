// client/src/components/landing/Nav.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { ArrowGlyph, Button, Container } from './primitives';

const NAV_ITEMS = [
  { label: 'Home', page: 'home' },
  { label: 'Features', page: 'features' },
  { label: 'About', page: 'about' },
  { label: 'Connect', page: 'contact' }
];

const AUDIENCES = [
  { key: 'college', label: 'Colleges' },
  { key: 'school', label: 'Schools' }
];

/** Wordmark and logo. Shared by the nav and the footer. */
export const Brand = ({ className = '', tone = 'light' }) => (
  <span className={`flex items-center gap-2.5 ${className}`}>
    <img src="/logo.svg" alt="" aria-hidden="true" className="h-9 w-auto shrink-0 sm:h-10" />
    <span className="flex min-w-0 flex-col items-start leading-none">
      <span
        className={`font-display text-lg font-bold tracking-tight sm:text-xl ${
          tone === 'dark' ? 'text-bone-50' : 'text-ink-950'
        }`}
      >
        EduMapping
      </span>
      <span
        className={`mt-1 text-[11px] font-medium ${
          tone === 'dark' ? 'text-bone-300/75' : 'text-ink-500'
        }`}
      >
        From classroom to career
      </span>
    </span>
  </span>
);

/**
 * Nav — a floating pill that sits clear of the viewport edges.
 *
 * It starts flush with the hero and gains its border, blur and shadow once the
 * page scrolls, so the first screen stays uninterrupted while the bar still
 * reads clearly over the content that follows.
 */
const Nav = ({ currentPage, onNavigate, audience, onSelectAudience, loginPath }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet whenever the route changes.
  useEffect(() => setMenuOpen(false), [currentPage]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const raised = scrolled || menuOpen || currentPage !== 'home';
  // On the home page's navy folder the bar is part of the folder: light type
  // on navy. Once the page scrolls onto paper it becomes a paper strip.
  const dark = !raised;
  const link = (active) =>
    `cursor-pointer rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 ${
      active
        ? dark
          ? 'bg-bone-50 text-ink-950'
          : 'bg-ink-950 text-bone-50'
        : dark
          ? 'text-bone-200 hover:bg-white/[0.08] hover:text-bone-50'
          : 'text-ink-700 hover:bg-ink-950/[0.06] hover:text-ink-950'
    }`;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        raised ? 'border-b border-ink-950/10 bg-bone-50/95 shadow-lift' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <Container className="!max-w-[1320px] lg:!px-12">
        <div>
          <nav
            className="flex min-h-[64px] items-center justify-between gap-3 px-3 sm:px-4"
            aria-label="Main"
          >
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[10px] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
              aria-label="EduMapping — go to home"
            >
              <Brand tone={dark ? 'dark' : 'light'} />
            </button>

            {/* --------------------------------------------------- desktop links */}
            <div className="hidden items-center gap-0.5 lg:flex">
              {NAV_ITEMS.map(({ label, page }) => {
                const active = currentPage === page;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => onNavigate(page)}
                    aria-current={active ? 'page' : undefined}
                    className={link(active)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {/* Audience toggle — switches the content of the whole page. */}
              <div
                className={`hidden items-center rounded-[10px] border p-0.5 md:flex ${
                  dark ? 'border-white/20 bg-white/[0.04]' : 'border-ink-950/15 bg-[#FFFDF8]'
                }`}
                role="group"
                aria-label="Choose audience"
              >
                {AUDIENCES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectAudience(key)}
                    aria-pressed={audience === key}
                    className={`cursor-pointer rounded-[8px] px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 ${
                      audience === key
                        ? 'bg-saffron-500 text-ink-950'
                        : dark
                          ? 'text-bone-200 hover:text-bone-50'
                          : 'text-ink-600 hover:text-ink-950'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <Link
                to={loginPath}
                state={{ from: { pathname: '/dashboard' } }}
                className={`hidden min-h-[44px] cursor-pointer items-center rounded-[9px] px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 sm:inline-flex ${
                  dark ? 'text-bone-200 hover:text-bone-50' : 'text-ink-700 hover:text-ink-950'
                }`}
              >
                Sign in
              </Link>

              <Button
                as={Link}
                to="/register"
                variant={dark ? 'saffron' : 'primary'}
                size="sm"
                className="hidden sm:inline-flex"
              >
                Get started
                <ArrowGlyph />
              </Button>

              {/* ---------------------------------------------- mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="lp-mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 lg:hidden ${
                  dark
                    ? 'border-white/25 text-bone-50 hover:bg-white/10'
                    : 'border-ink-950/15 bg-[#FFFDF8] text-ink-950 hover:bg-ink-950 hover:text-bone-50'
                }`}
              >
                {menuOpen ? (
                  <XMarkIcon className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Bars3Icon className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </nav>

          {/* ------------------------------------------------------ mobile sheet */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                id="lp-mobile-menu"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden border-t border-ink-950/10 lg:hidden"
              >
                <div className="space-y-1 px-3 py-4 sm:px-4">
                  {NAV_ITEMS.map(({ label, page }) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => onNavigate(page)}
                      className={`block w-full cursor-pointer rounded-[10px] px-4 py-3 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 ${
                        currentPage === page
                          ? 'bg-ink-950 text-bone-50'
                          : 'text-ink-700 hover:bg-ink-950/[0.06] hover:text-ink-950'
                      }`}
                    >
                      {label}
                    </button>
                  ))}

                  <div className="flex gap-2 pt-3">
                    {AUDIENCES.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onSelectAudience(key)}
                        aria-pressed={audience === key}
                        className={`flex-1 cursor-pointer rounded-[10px] px-4 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 ${
                          audience === key
                            ? 'bg-saffron-500 text-ink-950'
                            : 'border border-ink-950/15 text-ink-700 hover:bg-ink-950/[0.04]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 pt-3">
                    <Button as={Link} to="/register" variant="primary" size="lg" className="w-full">
                      Get started
                      <ArrowGlyph />
                    </Button>
                    <Button
                      as={Link}
                      to={loginPath}
                      state={{ from: { pathname: '/dashboard' } }}
                      variant="outline"
                      size="lg"
                      className="w-full"
                    >
                      Sign in
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>
    </header>
  );
};

export default Nav;
