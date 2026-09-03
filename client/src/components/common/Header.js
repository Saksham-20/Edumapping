// client/src/components/common/Header.js
//
// The signed-in app's top bar. Shares the landing page's visual language —
// bone ground, ink type, saffron accent, hard 1px borders — via
// `components/ui`, so crossing from the marketing site into the product does
// not look like crossing into a different product.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';
import { Avatar, Badge, IconButton, cx } from '../ui';
import {
  BellIcon,
  UserCircleIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BriefcaseIcon,
  CalendarIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  UsersIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

/** Tone for each role's badge. Keyed by the role strings in utils/constants. */
const ROLE_TONES = {
  admin: 'danger',
  tpo: 'info',
  recruiter: 'purple',
  student: 'success',
  principal: 'info',
  teacher: 'info',
  school_admin: 'info',
  career_counselor: 'info'
};

/** The bar's own height, in px. The spacer below it must match exactly. */
const BAR_HEIGHT = 72;

const Header = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileMenuRef = useRef(null);

  const isSchoolStudent = user?.role === 'student' && user?.organization?.type === 'school';
  const isSchoolStaff =
    user?.organization?.type === 'school' &&
    ['principal', 'teacher', 'school_admin', 'career_counselor'].includes(user?.role);

  // Close the menus on navigation. Without this the profile dropdown stays
  // open over the page you just moved to.
  useEffect(() => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Escape closes the dropdown, and focus returns to the trigger — a menu you
  // can open with the keyboard has to be closable with it too.
  useEffect(() => {
    if (!isProfileMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
        profileMenuRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isProfileMenuOpen]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      // Navigate even if the server-side logout call failed: the local tokens
      // are cleared either way, so leaving the user on an authenticated screen
      // would be a lie.
      navigate('/login');
    }
  }, [logout, navigate]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // School students have no jobs surface, so their search goes to events.
    navigate(`${isSchoolStudent ? '/events' : '/jobs'}?search=${encodeURIComponent(q)}`);
    setSearchQuery('');
    setIsMobileMenuOpen(false);
  };

  // The nav is derived from role rather than hardcoded, so a role that gains a
  // surface gets its link here and nowhere else.
  const navigation = useMemo(() => {
    const isActive = (href, exact = false) =>
      exact ? location.pathname === href : location.pathname.startsWith(href);

    const items = [{ name: 'Dashboard', href: '/dashboard', icon: HomeIcon, exact: true }];

    if (!isSchoolStudent && !isSchoolStaff) {
      items.push({ name: 'Jobs', href: '/jobs', icon: BriefcaseIcon });
    }
    items.push({ name: 'Events', href: '/events', icon: CalendarIcon });
    items.push({ name: 'Live classes', href: '/conferences', icon: VideoCameraIcon });

    if (user?.role === 'student' && !isSchoolStudent) {
      items.push(
        { name: 'Applications', href: '/applications', icon: DocumentTextIcon, exact: true },
        { name: 'Resume', href: '/resume', icon: DocumentTextIcon, exact: true }
      );
    }

    if (user?.role === 'recruiter') {
      items.push({ name: 'Applications', href: '/applications', icon: DocumentTextIcon, exact: true });
    }

    // The TPO's two flagship surfaces used to have no link anywhere in the app.
    if (user?.role === 'tpo') {
      items.push(
        { name: 'Applications', href: '/applications', icon: DocumentTextIcon, exact: true },
        { name: 'Analytics', href: '/tpo/analytics', icon: ChartBarIcon },
        { name: 'Approvals', href: '/approvals', icon: CheckBadgeIcon }
      );
    }

    if (user?.role === 'admin') {
      items.push(
        { name: 'Users', href: '/admin/users', icon: UsersIcon },
        { name: 'Approvals', href: '/approvals', icon: CheckBadgeIcon }
      );
    }

    return items.map((item) => ({ ...item, current: isActive(item.href, item.exact) }));
  }, [user?.role, isSchoolStudent, isSchoolStaff, location.pathname]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const searchPlaceholder = isSchoolStudent ? 'Search events…' : 'Search jobs, companies…';

  const searchField = (idSuffix, className = '') => (
    <form onSubmit={handleSearch} className={className} role="search">
      <label htmlFor={`header-search-${idSuffix}`} className="sr-only">
        {searchPlaceholder}
      </label>
      <div className="relative">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
        />
        <input
          id={`header-search-${idSuffix}`}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-full border border-ink-950/15 bg-bone-50 py-2 pl-10 pr-4 text-sm text-ink-950 placeholder:text-ink-500 transition-colors hover:border-ink-950/30 focus:border-ink-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink-950/15"
        />
      </div>
    </form>
  );

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-ink-950/10 bg-bone-50/95 backdrop-blur-md"
        style={{ height: BAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            to="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-50"
          >
            <img src="/logo.svg" alt="" aria-hidden="true" className="h-9 w-auto" />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-lg font-bold tracking-tight text-ink-950">
                EduMapping
              </span>
              <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                Nurturing young minds
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          {/*
            The inline nav starts at xl, not lg. A TPO carries seven entries and
            an admin eight; below 1280px they do not fit, and the alternative is
            silently clipping primary navigation into a horizontal scroll nobody
            would find. Narrower viewports get the drawer, which lists them all.

            `min-w-0` here plus `overflow-x-auto` on the list is the backstop:
            if a role ever gains another entry, it scrolls rather than rendering
            underneath the search field.
          */}
          <nav aria-label="Main" className="hidden min-w-0 flex-1 xl:block">
            <ul className="lp-scroll-x flex items-center gap-0.5 overflow-x-auto">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950',
                      item.current
                        ? 'bg-ink-950 text-white'
                        : 'text-ink-700 hover:bg-ink-950/[0.06] hover:text-ink-950'
                    )}
                  >
                    <item.icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/*
            The search only appears at 2xl. Below that a TPO's or admin's seven
            to eight nav entries and a 320px field cannot both fit, and the nav
            is the more important of the two — it was clipping entries into a
            horizontal scroll nobody would discover. Every narrower viewport
            still gets the search in the mobile drawer.
          */}
          {searchField('desktop', 'hidden w-full max-w-xs shrink-0 2xl:block')}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="relative">
              <IconButton
                icon={BellIcon}
                label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
                onClick={() => setIsNotificationPanelOpen(true)}
              />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-bone-50 bg-saffron-500 px-1 text-[10px] font-bold tabular-nums text-ink-950"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            {/* Profile menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((v) => !v)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-ink-950/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-50"
              >
                <Avatar src={user?.profilePicture} name={fullName} size="sm" />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-sm font-semibold text-ink-950">{fullName}</span>
                  <span className="block text-xs capitalize text-ink-500">
                    {user?.role?.replace(/_/g, ' ')}
                  </span>
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cx(
                    'h-4 w-4 text-ink-500 transition-transform duration-200',
                    isProfileMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {isProfileMenuOpen && (
                <>
                  {/* Click-away catcher, behind the panel. */}
                  <div
                    aria-hidden="true"
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-ink-950/15 bg-white shadow-lift-lg">
                    <div className="flex items-start gap-3 border-b border-ink-950/10 bg-bone-50 p-4">
                      <Avatar src={user?.profilePicture} name={fullName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-950">{fullName}</p>
                        <p className="truncate text-xs text-ink-600">{user?.email}</p>
                        <Badge tone={ROLE_TONES[user?.role] || 'neutral'} className="mt-1.5">
                          {user?.role?.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-1.5">
                      {[
                        { to: '/profile', icon: UserCircleIcon, label: 'Your profile' },
                        { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' }
                      ].map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-800 transition-colors hover:bg-bone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                        >
                          <item.icon aria-hidden="true" className="h-4 w-4 text-ink-600" />
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1.5 h-px bg-ink-950/10" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                      >
                        <ArrowRightOnRectangleIcon aria-hidden="true" className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <IconButton
              icon={isMobileMenuOpen ? XMarkIcon : Bars3Icon}
              label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="xl:hidden"
            />
          </div>
        </div>
      </header>

      {/* Mobile drawer, positioned below the bar. */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-x-0 z-40 border-b border-ink-950/10 bg-white xl:hidden"
          style={{ top: BAR_HEIGHT }}
        >
          <div className="max-h-[calc(100vh-72px)] space-y-1 overflow-y-auto px-4 py-4">
            {searchField('mobile', 'mb-3')}
            <nav aria-label="Mobile">
              <ul className="space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      aria-current={item.current ? 'page' : undefined}
                      className={cx(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                        item.current
                          ? 'bg-ink-950 text-white'
                          : 'text-ink-800 hover:bg-bone-100'
                      )}
                    >
                      <item.icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/*
        Spacer for the fixed bar. Height is driven by the same constant the bar
        uses — these were previously hardcoded independently (`h-16` against an
        `h-16 sm:h-20` bar), so on every screen above `sm` the top 16px of each
        page sat underneath the header.
      */}
      <div aria-hidden="true" style={{ height: BAR_HEIGHT }} />

      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
      />
    </>
  );
};

export default Header;
