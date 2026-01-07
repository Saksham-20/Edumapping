// client/src/components/common/Header.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';
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
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

const Header = () => {
  const { user, logout, isAuthenticated, tokens } = useAuth();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const isSchoolStudent = user?.role === 'student' && user?.organization?.type === 'school';
      if (isSchoolStudent) {
        // For school students, search events instead of jobs
        navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        navigate(`/jobs?search=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchQuery('');
    }
  };

  const getNavigationItems = () => {
    const isSchoolStudent = user?.role === 'student' && user?.organization?.type === 'school';
    
    const baseItems = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        current: location.pathname === '/dashboard',
        icon: HomeIcon
      }
    ];

    // Only show Jobs for non-school students
    if (!isSchoolStudent) {
      baseItems.push({
        name: 'Jobs',
        href: '/jobs',
        current: location.pathname.startsWith('/jobs'),
        icon: BriefcaseIcon
      });
    }

    baseItems.push({
      name: 'Events',
      href: '/events',
      current: location.pathname.startsWith('/events'),
      icon: CalendarIcon
    });

    // Only show Applications and Resume for college students, not school students
    if (user?.role === 'student' && !isSchoolStudent) {
      baseItems.push(
        {
          name: 'Applications',
          href: '/applications',
          current: location.pathname === '/applications',
          icon: DocumentTextIcon
        },
        {
          name: 'Resume',
          href: '/resume',
          current: location.pathname === '/resume',
          icon: DocumentTextIcon
        }
      );
    }

    if (user?.role === 'recruiter' || user?.role === 'tpo') {
      baseItems.push(
        {
          name: 'Post Job',
          href: '/jobs/new',
          current: location.pathname === '/jobs/new',
          icon: BriefcaseIcon
        },
        {
          name: 'Applications',
          href: '/applications',
          current: location.pathname === '/applications',
          icon: DocumentTextIcon
        }
      );
    }

    return baseItems;
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      tpo: 'bg-primary-100 text-primary-800',
      recruiter: 'bg-purple-100 text-purple-800',
      student: 'bg-secondary-100 text-secondary-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200'
        : 'bg-white shadow-sm border-b border-gray-200'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo and Brand */}
            <div className="flex items-center pl-6 sm:pl-10 mr-6 sm:mr-6">
              <Link to="/" className="flex items-center gap-2 group">
                <img
                  src="/logo.svg"
                  alt="EduMapping"
                  className="h-10 sm:h-12 w-auto transition-transform duration-200 group-hover:scale-105"
                  style={{ filter: 'none' }}
                />
                <div className="flex flex-col items-center">
                  <span className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-sm">
                    EduMapping
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-600 font-medium leading-tight text-center">
                    Nurturing Young Minds
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {getNavigationItems().map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${item.current
                      ? 'text-primary-600 bg-primary-50 border border-primary-200 shadow-sm'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-primary-50 hover:border hover:border-primary-200'
                      }`}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Search Bar */}
            <div className="hidden lg:flex flex-1 max-w-md mx-8">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={user?.role === 'student' && user?.organization?.type === 'school' ? "Search events..." : "Search jobs, companies..."}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all duration-200 hover:border-gray-400"
                  />
                </div>
              </form>
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <button
                onClick={() => setIsNotificationPanelOpen(true)}
                className="relative p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 group"
              >
                <BellIcon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-medium animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 hover:bg-gray-50 p-1"
                >
                  <div className="relative">
                    <img
                      className="h-9 w-9 rounded-xl object-cover border-2 border-gray-200 hover:border-primary-300 transition-colors duration-200"
                      src={user?.profilePicture || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=156395&color=fff&size=128`}
                      alt={`${user?.firstName} ${user?.lastName}`}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getRoleColor(user?.role).split(' ')[0]}`}></div>
                  </div>
                  <div className="ml-3 hidden xl:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
                  </div>
                  <ChevronDownIcon className={`ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown */}
                {isProfileMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-3 w-64 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="py-2">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center">
                          <img
                            className="h-12 w-12 rounded-xl object-cover border-2 border-gray-200"
                            src={user?.profilePicture || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=156395&color=fff&size=128`}
                            alt={`${user?.firstName} ${user?.lastName}`}
                          />
                          <div className="ml-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {user?.firstName} {user?.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user?.email}</div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user?.role)}`}>
                              {user?.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors duration-200"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <UserCircleIcon className="h-4 w-4 mr-3" />
                          Your Profile
                        </Link>
                        <Link
                          to="/settings"
                          className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors duration-200"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <Cog6ToothIcon className="h-4 w-4 mr-3" />
                          Settings
                        </Link>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                        >
                          <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                className="md:hidden p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {/* Mobile Search */}
                <form onSubmit={handleSearch} className="mb-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={user?.role === 'student' && user?.organization?.type === 'school' ? "Search events..." : "Search jobs, companies..."}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                </form>

                {/* Mobile Navigation Links */}
                {getNavigationItems().map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${item.current
                        ? 'text-primary-600 bg-primary-50 border border-primary-200'
                        : 'text-gray-700 hover:text-primary-600 hover:bg-primary-50'
                        }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <IconComponent className="h-5 w-5 mr-3" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Click outside to close profile menu */}
        {isProfileMenuOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsProfileMenuOpen(false)}
          />
        )}
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16"></div>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
      />
    </>
  );
};

export default Header;