// client/src/components/common/AppLayout.js
//
// The signed-in app's chrome: a fixed left sidebar on desktop, a slim top bar
// with search, notifications and the account menu, a slide-in drawer on
// mobile, and a ⌘K command palette.
//
// The previous top-bar layout ran out of room as soon as a role had more than
// six destinations — a TPO's entries were clipped into a horizontal scroll at
// common laptop widths. A sidebar scales to any number of grouped entries.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BellIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  ChevronUpDownIcon,
  ArrowTurnDownLeftIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';
import { Avatar, IconButton, cx } from '../ui';
import { getNavigation, isNavItemActive, formatRole } from './navigation';

const SIDEBAR_W = 'lg:pl-64';

/* ----------------------------------------------------------------- sidebar */

const Brand = () => (
  <Link
    to="/dashboard"
    className="flex items-center gap-2.5 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
  >
    <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto" />
    <span className="flex flex-col leading-none">
      <span className="font-display text-[17px] font-bold tracking-tight text-ink-950">EduMapping</span>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
        Placement cloud
      </span>
    </span>
  </Link>
);

const NavList = ({ groups, pathname, onNavigate }) => (
  <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
    {groups.map((group, gi) => (
      <div key={group.label || gi}>
        {group.label && (
          <p className="mb-1.5 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
            {group.label}
          </p>
        )}
        <ul className="space-y-0.5">
          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950',
                    active
                      ? 'bg-ink-950 text-white shadow-[0_1px_0_rgba(255,255,255,.06)_inset]'
                      : 'text-ink-700 hover:bg-ink-950/[0.05] hover:text-ink-950'
                  )}
                >
                  <item.icon
                    aria-hidden="true"
                    strokeWidth={1.8}
                    className={cx('h-[18px] w-[18px] shrink-0', active ? 'text-saffron-400' : 'text-ink-500 group-hover:text-ink-800')}
                  />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </nav>
);

const AccountCard = ({ user, onLogout }) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return (
    <div className="border-t border-ink-950/10 p-3">
      <div className="flex items-center gap-3 rounded-xl p-2">
        <Avatar src={user?.profilePicture} name={fullName} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-ink-950">{fullName}</p>
          <p className="truncate text-xs text-ink-500">
            {formatRole(user?.role)}
            {user?.organization?.name ? ` · ${user.organization.name}` : ''}
          </p>
        </div>
        <IconButton icon={ArrowRightOnRectangleIcon} label="Sign out" size="sm" onClick={onLogout} />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------- command palette */

const CommandPalette = ({ open, onClose, groups, searchTarget }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Focus after the panel mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = groups
      .flatMap((g) => g.items.map((i) => ({ ...i, group: g.label || 'Go to' })))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.group || '').toLowerCase().includes(q));
    const list = pages.map((p) => ({ kind: 'page', label: p.name, hint: p.group, icon: p.icon, href: p.href }));
    if (q && searchTarget) {
      list.push({
        kind: 'search',
        label: `Search ${searchTarget.label} for “${query.trim()}”`,
        hint: 'Search',
        icon: MagnifyingGlassIcon,
        href: `${searchTarget.href}?search=${encodeURIComponent(query.trim())}`
      });
    }
    return list;
  }, [groups, query, searchTarget]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const go = (r) => {
    if (!r) return;
    navigate(r.href);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[cursor]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-ink-950/15 bg-white shadow-lift-lg animate-slide-up">
        <div className="flex items-center gap-3 border-b border-ink-950/10 px-4">
          <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5 text-ink-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page or search…"
            aria-label="Jump to a page or search"
            className="h-14 w-full border-0 bg-transparent p-0 text-[15px] text-ink-950 placeholder:text-ink-500 focus:ring-0"
          />
          <kbd className="hidden rounded-md border border-ink-950/15 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:block">ESC</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-500">Nothing matches.</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.href}`} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                  i === cursor ? 'bg-bone-100 text-ink-950' : 'text-ink-700'
                )}
              >
                <r.icon aria-hidden="true" className="h-4 w-4 text-ink-500" strokeWidth={1.8} />
                <span className="flex-1 font-medium">{r.label}</span>
                <span className="text-xs text-ink-500">{r.hint}</span>
                {i === cursor && <ArrowTurnDownLeftIcon aria-hidden="true" className="h-3.5 w-3.5 text-ink-500" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ layout */

const AppLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const groups = useMemo(() => getNavigation(user), [user]);
  const isSchool = user?.organization?.type === 'school';
  const searchTarget = useMemo(
    () =>
      isSchool
        ? { label: 'events', href: '/events' }
        : { label: 'jobs', href: '/jobs' },
    [isSchool]
  );

  // Current page title for the top bar on mobile, where the sidebar is hidden.
  const currentItem = useMemo(
    () => groups.flatMap((g) => g.items).find((i) => isNavItemActive(i, pathname)),
    [groups, pathname]
  );

  useEffect(() => setDrawerOpen(false), [pathname]);

  // ⌘K / Ctrl+K opens the palette from anywhere in the app.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock page scroll behind the open mobile drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      // Local tokens are cleared either way; never leave the user on an
      // authenticated screen.
      navigate('/login');
    }
  }, [logout, navigate]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="min-h-screen bg-bone-50">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:border focus:border-ink-950 focus:bg-saffron-500 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-950/10 bg-white/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <NavList groups={groups} pathname={pathname} />
        <AccountCard user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-lift-lg animate-[slideInLeft_.22s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex h-16 items-center justify-between px-4">
              <Brand />
              <IconButton icon={XMarkIcon} label="Close menu" onClick={() => setDrawerOpen(false)} />
            </div>
            <NavList groups={groups} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <AccountCard user={user} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className={SIDEBAR_W}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink-950/10 bg-bone-50/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <IconButton icon={Bars3Icon} label="Open menu" onClick={() => setDrawerOpen(true)} className="lg:hidden" />
            <p className="truncate font-display text-base font-bold text-ink-950 lg:hidden">
              {currentItem?.name || 'EduMapping'}
            </p>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex h-10 items-center gap-2.5 rounded-full border border-ink-950/15 bg-white px-3.5 text-sm text-ink-500 transition-colors hover:border-ink-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 sm:w-72 lg:ml-0 lg:w-96"
              aria-label="Search or jump to a page"
            >
              <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4" />
              <span className="hidden flex-1 text-left sm:block">Search {searchTarget.label}, jump to…</span>
              <kbd className="hidden rounded-md border border-ink-950/15 bg-bone-50 px-1.5 py-0.5 font-mono text-[10px] sm:block">
                {isMac ? '⌘' : 'Ctrl'} K
              </kbd>
            </button>

            <div className="flex items-center gap-1 lg:ml-auto">
              <div className="relative">
                <IconButton
                  icon={BellIcon}
                  label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                  onClick={() => setNotifOpen(true)}
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
              <Link
                to="/profile"
                className="hidden items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-ink-950/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 sm:flex lg:hidden"
              >
                <Avatar src={user?.profilePicture} name={[user?.firstName, user?.lastName].filter(Boolean).join(' ')} size="sm" />
                <ChevronUpDownIcon aria-hidden="true" className="h-4 w-4 text-ink-500" />
              </Link>
            </div>
          </div>
        </header>

        {children}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={groups}
        searchTarget={searchTarget}
      />
      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
};

export default AppLayout;
