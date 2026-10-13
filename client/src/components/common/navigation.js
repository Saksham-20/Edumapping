// client/src/components/common/navigation.js
//
// The signed-in app's navigation, derived from role. The sidebar, the mobile
// drawer and the command palette all read this one list, so a role that gains
// a surface gets its entry here and nowhere else.
import {
  HomeIcon,
  BanknotesIcon,
  BriefcaseIcon,
  CalendarIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  UsersIcon,
  VideoCameraIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ScaleIcon,
  DocumentChartBarIcon
} from '@heroicons/react/24/outline';

const SCHOOL_STAFF = ['principal', 'teacher', 'school_admin', 'career_counselor'];

/**
 * Returns [{ label, items: [{ name, href, icon, exact }] }]. Empty groups are
 * dropped, so a role never sees a heading with nothing under it.
 */
export const getNavigation = (user) => {
  const role = user?.role;
  const isSchool = user?.organization?.type === 'school';
  const isSchoolStudent = role === 'student' && isSchool;
  const isSchoolStaff = isSchool && SCHOOL_STAFF.includes(role);
  const isCollegeStudent = role === 'student' && !isSchool;

  const overview = [{ name: 'Dashboard', href: '/dashboard', icon: HomeIcon, exact: true }];

  const placements = [];
  if (!isSchoolStudent && !isSchoolStaff) {
    placements.push({ name: 'Jobs', href: '/jobs', icon: BriefcaseIcon });
  }
  if (isCollegeStudent || role === 'recruiter' || role === 'tpo') {
    placements.push(
      { name: 'Applications', href: '/applications', icon: DocumentTextIcon },
      { name: 'Offers', href: '/offers', icon: BanknotesIcon, exact: true }
    );
  }
  if (isCollegeStudent) {
    placements.push({ name: 'Resume', href: '/resume', icon: DocumentDuplicateIcon, exact: true });
  }

  const institution = [];
  if (role === 'tpo') {
    institution.push(
      { name: 'Students', href: '/tpo/students', icon: AcademicCapIcon },
      { name: 'Placement policy', href: '/tpo/policy', icon: ScaleIcon, exact: true },
      { name: 'Analytics', href: '/tpo/analytics', icon: ChartBarIcon },
      { name: 'Reports', href: '/tpo/reports', icon: DocumentChartBarIcon, exact: true },
      { name: 'Approvals', href: '/approvals', icon: CheckBadgeIcon, exact: true }
    );
  }
  if (role === 'admin') {
    institution.push(
      { name: 'Users', href: '/admin/users', icon: UsersIcon },
      { name: 'Approvals', href: '/approvals', icon: CheckBadgeIcon, exact: true },
      { name: 'Analytics', href: '/tpo/analytics', icon: ChartBarIcon },
      { name: 'Reports', href: '/tpo/reports', icon: DocumentChartBarIcon, exact: true }
    );
  }
  if (role === 'tpo' || role === 'admin') {
    institution.push({ name: 'Audit log', href: '/audit', icon: ClipboardDocumentCheckIcon, exact: true });
  }

  const campus = [
    { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon, exact: true },
    { name: 'Events', href: '/events', icon: CalendarIcon },
    { name: 'Live classes', href: '/conferences', icon: VideoCameraIcon }
  ];

  const account = [
    { name: 'Profile', href: '/profile', icon: UserCircleIcon, exact: true },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, exact: true }
  ];

  return [
    { label: null, items: overview },
    { label: role === 'recruiter' ? 'Hiring' : 'Placements', items: placements },
    { label: role === 'admin' ? 'Platform' : 'Institution', items: institution },
    { label: 'Campus', items: campus },
    { label: 'Account', items: account }
  ].filter((g) => g.items.length > 0);
};

export const isNavItemActive = (item, pathname) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** "tpo" → "TPO", "school_admin" → "School admin". */
const ROLE_LABELS = {
  tpo: 'Placement officer',
  school_admin: 'School admin',
  career_counselor: 'Career counsellor'
};

export const formatRole = (role) => {
  if (!role) return '';
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  const words = role.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
