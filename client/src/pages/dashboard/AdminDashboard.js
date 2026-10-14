// client/src/pages/dashboard/AdminDashboard.js
//
// The platform administrator's console: one page, nine tabs, each backed by its
// own endpoint. Data loading and the write handlers below are unchanged from
// the original; what was rewritten is the surface — the design system's Table,
// Modal, Tabs and form controls replace the hand-rolled ones, and every
// destructive action now confirms in a real dialog instead of window.confirm.
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import statisticsService from '../../services/statistics';
import adminService from '../../services/adminService';
import api, { fieldErrorsFrom } from '../../services/api';
import approvalService from '../../services/approvals';
import AnnounceModal from '../../components/notifications/AnnounceModal';
import toast from 'react-hot-toast';
import TabNavigation from '../../components/admin/TabNavigation';
import StatCard from '../../components/admin/StatCard';
import ChartCard from '../../components/admin/ChartCard';
import AdminModal from '../../components/admin/AdminModal';
import DataTable from '../../components/admin/DataTable';
import LineChart from '../../components/admin/LineChart';
import BarChart from '../../components/admin/BarChart';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  PageLoader,
  PageShell,
  Select,
  SkeletonCard,
  StatusBadge,
  Table,
  Tbody,
  Td,
  Textarea,
  Th,
  Thead,
  Toolbar,
  Tr,
  StatStrip
} from '../../components/ui';
import { formatRole } from '../../components/common/navigation';
import {
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ArrowRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { downloadCredentialsCsv } from '../../utils/credentialsCsv';
import { prepareLineChartData } from '../../utils/chartUtils';
import { saveBlob } from '../../services/placement';

/** One row of a labelled proportion bar. The width is data, never decoration. */
const MeterRow = ({ label, value, total, tone = 'ink' }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const fills = { ink: 'bg-ink-950', saffron: 'bg-saffron-500', india: 'bg-india-600' };
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0 truncate text-sm font-medium capitalize text-ink-800">{label}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="font-display text-base font-bold tabular-nums text-ink-950">{value}</span>
        <span
          className="h-2 w-24 overflow-hidden rounded-full bg-bone-200"
          role="img"
          aria-label={`${pct}% of ${total}`}
        >
          <span className={`block h-full rounded-full ${fills[tone]}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
};

/**
 * The six fields every organization type shares.
 *
 * Universities, companies and schools were three copies of the same form; they
 * differ only in the noun in the heading and the `type` sent on save.
 */
const DOMAIN_EXAMPLES = { university: 'college.edu', company: 'company.com', school: 'school.edu.in' };

const OrganizationFormFields = ({ value = {}, onChange, noun, errors = {}, showHigherEdType }) => {
  const set = (name) => (e) => onChange({ ...value, [name]: e.target.value });
  return (
    <div className="space-y-4">
      {/* Colleges and universities share one tab, so the form says which this
          is. Everything used to be saved as "university". */}
      {showHigherEdType && (
        <Select
          label="Type"
          required
          value={value.type || 'college'}
          onChange={set('type')}
          error={errors.type}
          options={[
            { value: 'college', label: 'College' },
            { value: 'university', label: 'University' }
          ]}
        />
      )}
      <Input label="Name" required value={value.name || ''} onChange={set('name')} error={errors.name} />
      <Input
        label="Email domain"
        required
        value={value.domain || ''}
        onChange={set('domain')}
        error={errors.domain}
        placeholder={DOMAIN_EXAMPLES[noun] || 'college.edu'}
        help="The part after @ in its staff and student emails, e.g. college.edu."
        autoCapitalize="none"
        spellCheck={false}
      />
      <Input
        label="Contact email"
        type="email"
        required
        value={value.contactEmail || ''}
        onChange={set('contactEmail')}
        error={errors.contactEmail}
        autoCapitalize="none"
      />
      <Input
        label="Contact phone"
        type="tel"
        value={value.contactPhone || ''}
        onChange={set('contactPhone')}
        error={errors.contactPhone}
        placeholder="+91 98765 43210"
      />
      {/* Not type="url": the browser's URL check refused "college.edu" before
          the request was sent, and the server adds https:// itself. */}
      <Input
        label="Website"
        inputMode="url"
        value={value.website || ''}
        onChange={set('website')}
        error={errors.website}
        placeholder={`www.${DOMAIN_EXAMPLES[noun] || 'college.edu'}`}
        autoCapitalize="none"
        spellCheck={false}
      />
      <Textarea
        label="Address"
        rows={3}
        value={value.address || ''}
        onChange={set('address')}
        error={errors.address}
      />
      {/* Recruiter permissions can narrow access by region, state and city,
          but nothing ever set them, so those filters always read "None in
          the data". */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="City"
          value={value.city || ''}
          onChange={set('city')}
          error={errors.city}
          placeholder="e.g. Mohali"
        />
        <Input
          label="State"
          value={value.state || ''}
          onChange={set('state')}
          error={errors.state}
          placeholder="e.g. Punjab"
        />
        <Input
          label="Region"
          value={value.region || ''}
          onChange={set('region')}
          error={errors.region}
          placeholder="e.g. North"
        />
      </div>
    </div>
  );
};

/** Which organization types each role can belong to (mirrors the server rule). */
const ORG_TYPES_FOR_ROLE = {
  student: ['university', 'college', 'school'],
  tpo: ['university', 'college'],
  recruiter: ['company'],
  principal: ['school'],
  teacher: ['school'],
  school_admin: ['school'],
  career_counselor: ['school']
};

const USER_ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'tpo', label: 'Placement officer (TPO)' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'principal', label: 'Principal' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'school_admin', label: 'School admin' },
  { value: 'career_counselor', label: 'Career counsellor' },
  { value: 'admin', label: 'EduMapping admin' }
];

const ORG_LABELS = { university: 'University', college: 'College', company: 'Company', school: 'School' };

// The same sample sheet the TPO import offers. The admin import had only a
// paragraph listing the columns, so an admin had to build the sheet by hand.
const IMPORT_TEMPLATE = [
  ['Roll No', 'Name', 'Email', 'Mobile', 'Course', 'Branch', 'Batch', 'Year of study', 'CGPA', 'Active backlogs', '10th %', '12th %', 'Gender', 'Date of birth'],
  ['22CSE001', 'Aarav Sharma', 'aarav.sharma@college.edu.in', '98765 43210', 'B.Tech', 'Computer Science Engineering', '2026', '4', '8.4', '0', '91.2', '88.4', 'Male', '12/05/2004'],
  ['22ECE014', 'R.K. Iyer', 'rk.iyer@gmail.com', '+91 98765 43211', 'B.Tech', 'Electronics and Communication', '2026', '4', '7.65', '1', '84', '79.6', 'Female', '03/11/2003']
];

const downloadImportTemplate = () => {
  const csv = IMPORT_TEMPLATE.map((row) => row.join(',')).join('\n');
  saveBlob(new Blob([`\uFEFF${csv}\n`], { type: 'text/csv;charset=utf-8' }), 'student-import-template.csv');
};

/**
 * Error toast that never doubles up.
 *
 * The shared axios instance already toasts every failed request except 401s,
 * 403s and ones sent `silent`. Every catch on this page then toasted again, so
 * one failure showed two toasts — usually one useful message and one generic
 * "Failed to …" on top of it. This shows the fallback only when the
 * interceptor stayed quiet (a 401/403, a silent call, or a non-HTTP error).
 */
const toastError = (error, fallback) => {
  const interceptorShown =
    Boolean(error?.config) && !error.config.silent && ![401, 403].includes(error?.status);
  if (!interceptorShown) toast.error(error?.message || fallback);
};

/** Edit / delete controls for one table row. */
const RowActions = ({ children }) => (
  <div className="flex items-center justify-end gap-1.5">{children}</div>
);

/**
 * Normalises an organization form before it is sent.
 *
 * The optional inputs hold `''` when left blank, and the Organization model
 * validates `website` with `isUrl` and `contactEmail` with `isEmail`. Sequelize
 * skips a validator on `null` but runs it on `''`, so editing any organization
 * that has no website — every seeded one — failed with "Validation isUrl on
 * website failed" even when the admin only changed the name. `POST` got away
 * with it because the create handler coerces `website || null` server-side;
 * `PUT` passes the body straight to `organization.update()`.
 */
const orgPayload = (formData, type) => {
  const out = { ...formData, type };
  ['website', 'address', 'contactPhone', 'domain', 'contactEmail', 'city', 'state', 'region'].forEach((key) => {
    if (typeof out[key] === 'string' && out[key].trim() === '') out[key] = null;
  });
  ['city', 'state', 'region'].forEach((key) => {
    if (typeof out[key] === 'string') out[key] = out[key].trim();
  });
  return out;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  // ?tab= opens a tab directly, and ?recruiter= opens that recruiter's
  // permissions, so other admin screens can link straight here.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [pendingRecruiterId, setPendingRecruiterId] = useState(() => searchParams.get('recruiter'));
  const [isLoading, setIsLoading] = useState(true);
  
  // Overview tab state
  const [stats, setStats] = useState({
    users: {},
    organizations: {},
    jobs: {},
    applications: {},
    placements: {},
    recentActivity: []
  });

  // Analytics tab state
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('30');
  const [topPerformers, setTopPerformers] = useState(null);

  // Users tab state
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({});
  const [usersFilters, setUsersFilters] = useState({
    search: '',
    role: '',
    approvalStatus: '',
    organizationId: '',
    organizationType: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFormData, setUserFormData] = useState({});

  // TPOs tab state
  const [tpos, setTpos] = useState([]);
  const [tposPagination, setTposPagination] = useState({});
  const [showTPOModal, setShowTPOModal] = useState(false);
  const [selectedTPO, setSelectedTPO] = useState(null);
  const [tpoFormData, setTpoFormData] = useState({});

  // Universities tab state
  const [universities, setUniversities] = useState([]);
  const [universitiesPagination, setUniversitiesPagination] = useState({});
  const [showUniversityModal, setShowUniversityModal] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [universityFormData, setUniversityFormData] = useState({});

  // Companies tab state
  const [companies, setCompanies] = useState([]);
  const [companiesPagination, setCompaniesPagination] = useState({});
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyFormData, setCompanyFormData] = useState({});

  // Schools tab state
  const [schools, setSchools] = useState([]);
  const [schoolsPagination, setSchoolsPagination] = useState({});
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolFormData, setSchoolFormData] = useState({});

  // Destructive-action confirmation: { title, description, confirmLabel, run }
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmRunning, setConfirmRunning] = useState(false);

  // Approval info modal state
  const [showApprovalInfo, setShowApprovalInfo] = useState(false);
  const [approvalInfoType, setApprovalInfoType] = useState('');

  // Recruiter permissions tab state
  const [recruiters, setRecruiters] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  // Kept as the raw text the admin types and split only on save. Parsing on
  // every keystroke (and splitting on spaces) ate the comma the moment it was
  // typed, so a second stream could not be entered, and "Computer Science"
  // became two streams.
  const [streamsText, setStreamsText] = useState('');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Import Students tab state (Admin only)
  const [importFile, setImportFile] = useState(null);
  const [importOrganizationId, setImportOrganizationId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [announcing, setAnnouncing] = useState(false);

  // Field errors and the in-flight flag for whichever create/edit dialog is
  // open (only one can be). Errors used to arrive only as a toast, which
  // vanished before the admin found the field; and with no busy state a
  // double-click on Save sent the request twice.
  const [formErrors, setFormErrors] = useState({});
  const [formSaving, setFormSaving] = useState(false);

  /** Runs a dialog save: busy flag, field errors under inputs, toast fallback. */
  const runFormSave = async (save, fallback) => {
    if (formSaving) return;
    setFormSaving(true);
    setFormErrors({});
    try {
      await save();
    } catch (error) {
      setFormErrors(fieldErrorsFrom(error));
      toastError(error, fallback);
    } finally {
      setFormSaving(false);
    }
  };

  const pendingOrgs = Number(stats.organizations?.pendingApproval || 0);
  const pendingAccounts = Number(stats.users?.pendingApproval || 0);
  const pendingPostings = Number(stats.jobs?.pendingReview || 0);
  const pendingTotal = pendingOrgs + pendingAccounts + pendingPostings;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    { id: 'users', label: 'Users', icon: UsersIcon, badge: stats.users?.total },
    { id: 'import-students', label: 'Import Students', icon: ArrowUpTrayIcon },
    { id: 'tpos', label: 'TPOs', icon: AcademicCapIcon },
    { id: 'universities', label: 'Colleges & universities', icon: BuildingOfficeIcon },
    { id: 'companies', label: 'Companies', icon: BriefcaseIcon },
    { id: 'schools', label: 'Schools', icon: AcademicCapIcon },
    { id: 'recruiter-permissions', label: 'Recruiter permissions', icon: ShieldCheckIcon }
  ];

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchOverviewStats();
      fetchOrganizations();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'tpos') {
      fetchTPOs();
    } else if (activeTab === 'universities') {
      fetchUniversities();
    } else if (activeTab === 'companies') {
      fetchCompanies();
    } else if (activeTab === 'schools') {
      fetchSchools();
    } else if (activeTab === 'recruiter-permissions') {
      fetchRecruiters();
      fetchInstitutions();
    } else if (activeTab === 'import-students') {
      setImportResult(null);
    } else if (activeTab === 'analytics') {
      fetchAdvancedAnalytics();
      fetchTopPerformers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analyticsPeriod]);

  // Handle user filter changes with debounce
  useEffect(() => {
    if (activeTab === 'users') {
      const timeoutId = setTimeout(() => {
        fetchUsers(1);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersFilters, activeTab]);

  const fetchOverviewStats = async () => {
    try {
      setIsLoading(true);
      const response = await statisticsService.getAdminStats();
      setStats(response.stats);
    } catch (error) {
      toastError(error, 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdvancedAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getAdvancedAnalytics({ period: analyticsPeriod });
      setAnalytics(response.analytics);
    } catch (error) {
      toastError(error, 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTopPerformers = async () => {
    try {
      const response = await adminService.getTopPerformers(10);
      setTopPerformers(response.topPerformers);
    } catch (error) {
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/organizations?limit=1000');
      setOrganizations(response.organizations || []);
    } catch (error) {
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(
          Object.entries(usersFilters).filter(([_, value]) => value !== '')
        )
      });
      const response = await api.get(`/users?${params}`);
      // Note: Using existing /users endpoint which allows admin access
      setUsers(response.users || []);
      // Map pagination format
      const pagination = response.pagination || {};
      setUsersPagination({
        currentPage: pagination.currentPage || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalUsers || 0,
        hasMore: pagination.hasMore || false,
        hasPrevious: (pagination.currentPage || 1) > 1,
        hasNext: pagination.hasMore || false,
        limit: 20
      });
    } catch (error) {
      toastError(error, 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTPOs = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllTPOs({ page, limit: 20 });
      setTpos(response.tpos || []);
      const pagination = response.pagination || {};
      setTposPagination({
        currentPage: pagination.currentPage || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || 0,
        hasMore: pagination.hasMore || false,
        hasPrevious: pagination.currentPage > 1,
        hasNext: pagination.hasMore || false,
        limit: 20
      });
    } catch (error) {
      toastError(error, 'Failed to load TPOs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUniversities = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllUniversities({ page, limit: 20 });
      setUniversities(response.universities || []);
      const pagination = response.pagination || {};
      setUniversitiesPagination({
        currentPage: pagination.currentPage || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || 0,
        hasMore: pagination.hasMore || false,
        hasPrevious: pagination.currentPage > 1,
        hasNext: pagination.hasMore || false,
        limit: 20
      });
    } catch (error) {
      toastError(error, 'Failed to load universities');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllCompanies({ page, limit: 20 });
      setCompanies(response.companies || []);
      const pagination = response.pagination || {};
      setCompaniesPagination({
        currentPage: pagination.currentPage || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || 0,
        hasMore: pagination.hasMore || false,
        hasPrevious: pagination.currentPage > 1,
        hasNext: pagination.hasMore || false,
        limit: 20
      });
    } catch (error) {
      toastError(error, 'Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchools = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllSchools({ page, limit: 20 });
      setSchools(response.schools || []);
      const pagination = response.pagination || {};
      setSchoolsPagination({
        currentPage: pagination.currentPage || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || 0,
        hasMore: pagination.hasMore || false,
        hasPrevious: pagination.currentPage > 1,
        hasNext: pagination.hasMore || false,
        limit: 20
      });
    } catch (error) {
      toastError(error, 'Failed to load schools');
      // Set empty state on error
      setSchools([]);
      setSchoolsPagination({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        hasMore: false,
        hasPrevious: false,
        hasNext: false,
        limit: 20
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users?role=recruiter&limit=200');
      setRecruiters(response.users || []);
    } catch (error) {
      toastError(error, 'Failed to load recruiters');
      setRecruiters([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInstitutions = async () => {
    try {
      // The universities endpoint now returns colleges as well, each with its
      // real type, so a separate colleges call would list every college twice.
      const [uniRes, schoolRes] = await Promise.all([
        adminService.getAllUniversities({ limit: 500 }),
        adminService.getAllSchools({ limit: 500 })
      ]);
      const list = [
        ...(uniRes.universities || []).map((o) => ({ id: o.id, name: o.name, type: o.type || 'university', region: o.region, state: o.state, city: o.city })),
        ...(schoolRes.schools || []).map((o) => ({ id: o.id, name: o.name, type: 'school', region: o.region, state: o.state, city: o.city }))
      ].sort((a, b) => a.name.localeCompare(b.name));
      setInstitutions(list);
    } catch (error) {
      toastError(error, 'Failed to load institutions');
      setInstitutions([]);
    }
  };

  // User management handlers
  const handleCreateUser = () => {
    setFormErrors({});
    setSelectedUser(null);
    setUserFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      role: 'student',
      organizationId: ''
    });
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setFormErrors({});
    setSelectedUser(user);
    setUserFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      organizationId: user.organizationId || '',
      isActive: user.isActive,
      approvalStatus: user.approvalStatus
    });
    setShowUserModal(true);
  };

  const handleSaveUser = (e) => {
    e.preventDefault();
    // An admin has no organization; sending the stale id from the form would
    // fail the role check on the server.
    const payload =
      userFormData.role === 'admin' ? { ...userFormData, organizationId: null } : userFormData;
    return runFormSave(async () => {
      if (selectedUser) {
        await adminService.updateUser(selectedUser.id, payload);
        toast.success('User updated');
      } else {
        await adminService.createUser(payload);
        toast.success('User created');
      }
      setShowUserModal(false);
      fetchUsers();
      fetchOverviewStats();
    }, 'Could not save the user');
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminService.deleteUser(userId);
      toast.success('User deactivated');
      fetchUsers(usersPagination.currentPage || 1);
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Failed to delete user');
    }
  };

  // Deactivating used to be one-way on this console: the row kept saying
  // "Approved" with the same Deactivate button, so an admin could neither
  // see who was locked out nor let them back in. Goes through the admin
  // update endpoint so the change is audited.
  const handleReactivateUser = async (row, refresh) => {
    try {
      await adminService.updateUser(row.id, { isActive: true });
      toast.success(`${row.firstName} ${row.lastName} can sign in again`);
      refresh();
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Could not reactivate the account');
    }
  };

  // TPO management handlers
  const handleCreateTPO = () => {
    setFormErrors({});
    setSelectedTPO(null);
    setTpoFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      organizationId: ''
    });
    setShowTPOModal(true);
  };

  const handleEditTPO = (tpo) => {
    setFormErrors({});
    setSelectedTPO(tpo);
    setTpoFormData({
      firstName: tpo.firstName,
      lastName: tpo.lastName,
      email: tpo.email,
      phone: tpo.phone || '',
      organizationId: tpo.organizationId || ''
    });
    setShowTPOModal(true);
  };

  const handleSaveTPO = (e) => {
    e.preventDefault();
    return runFormSave(async () => {
      if (selectedTPO) {
        await adminService.updateTPO(selectedTPO.id, tpoFormData);
        toast.success('TPO updated');
      } else {
        await adminService.createTPO(tpoFormData);
        toast.success('TPO created');
      }
      setShowTPOModal(false);
      fetchTPOs();
      fetchOverviewStats();
    }, 'Could not save the TPO');
  };

  const handleDeleteTPO = async (tpoId) => {
    try {
      await adminService.deleteTPO(tpoId);
      toast.success('TPO deactivated');
      fetchTPOs(tposPagination.currentPage || 1);
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Could not deactivate the TPO');
    }
  };

  // University management handlers
  const handleCreateUniversity = () => {
    setFormErrors({});
    setSelectedUniversity(null);
    setUniversityFormData({
      type: 'college',
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: '',
      city: '',
      state: '',
      region: ''
    });
    setApprovalInfoType('university');
    setShowApprovalInfo(true);
    // Show modal after user acknowledges approval info
  };

  const handleApprovalInfoConfirm = () => {
    setShowApprovalInfo(false);
    if (approvalInfoType === 'university') {
      setShowUniversityModal(true);
    } else if (approvalInfoType === 'company') {
      setShowCompanyModal(true);
    } else if (approvalInfoType === 'school') {
      setShowSchoolModal(true);
    }
  };

  const handleEditUniversity = (university) => {
    setFormErrors({});
    setSelectedUniversity(university);
    setUniversityFormData({
      type: university.type || 'university',
      name: university.name,
      domain: university.domain,
      contactEmail: university.contactEmail,
      contactPhone: university.contactPhone || '',
      website: university.website || '',
      address: university.address || '',
      city: university.city || '',
      state: university.state || '',
      region: university.region || ''
    });
    setShowUniversityModal(true);
  };

  const handleSaveUniversity = (e) => {
    e.preventDefault();
    const type = universityFormData.type === 'university' ? 'university' : 'college';
    const label = ORG_LABELS[type];
    return runFormSave(async () => {
      if (selectedUniversity) {
        await adminService.updateOrganization(selectedUniversity.id, orgPayload(universityFormData, type));
        toast.success(`${label} updated`);
      } else {
        await adminService.createOrganization(orgPayload(universityFormData, type));
        toast.success(`${label} created`);
      }
      setShowUniversityModal(false);
      fetchUniversities();
      fetchOrganizations();
      fetchOverviewStats();
    }, `Could not save the ${label.toLowerCase()}`);
  };

  const handleDeleteUniversity = async (universityId) => {
    try {
      await adminService.deleteOrganization(universityId);
      toast.success('Deactivated');
      fetchUniversities();
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Failed to deactivate university');
    }
  };

  const handleVerifyUniversity = async (universityId, isVerified) => {
    try {
      await adminService.verifyOrganization(universityId, isVerified);
      toast.success(isVerified ? 'Verified' : 'Verified badge removed');
      fetchUniversities();
    } catch (error) {
      toastError(error, 'Failed to update verification');
    }
  };

  // Company management handlers
  const handleCreateCompany = () => {
    setFormErrors({});
    setSelectedCompany(null);
    setCompanyFormData({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: '',
      city: '',
      state: '',
      region: ''
    });
    setApprovalInfoType('company');
    setShowApprovalInfo(true);
    // Show modal after user acknowledges approval info
  };

  const handleEditCompany = (company) => {
    setFormErrors({});
    setSelectedCompany(company);
    setCompanyFormData({
      name: company.name,
      domain: company.domain,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone || '',
      website: company.website || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      region: company.region || ''
    });
    setShowCompanyModal(true);
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    return runFormSave(async () => {
      if (selectedCompany) {
        await adminService.updateOrganization(selectedCompany.id, orgPayload(companyFormData, 'company'));
        toast.success('Company updated');
      } else {
        await adminService.createOrganization(orgPayload(companyFormData, 'company'));
        toast.success('Company created');
      }
      setShowCompanyModal(false);
      fetchCompanies();
      fetchOrganizations();
      fetchOverviewStats();
    }, 'Could not save the company');
  };

  const handleDeleteCompany = async (companyId) => {
    try {
      await adminService.deleteOrganization(companyId);
      toast.success('Company deactivated');
      fetchCompanies();
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Failed to deactivate company');
    }
  };

  const handleVerifyCompany = async (companyId, isVerified) => {
    try {
      await adminService.verifyOrganization(companyId, isVerified);
      toast.success(isVerified ? 'Verified' : 'Verified badge removed');
      fetchCompanies();
    } catch (error) {
      toastError(error, 'Failed to update verification');
    }
  };

  // School management handlers
  const handleCreateSchool = () => {
    setFormErrors({});
    setSelectedSchool(null);
    setSchoolFormData({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: '',
      city: '',
      state: '',
      region: ''
    });
    setApprovalInfoType('school');
    setShowApprovalInfo(true);
  };

  const handleEditSchool = (school) => {
    setFormErrors({});
    setSelectedSchool(school);
    setSchoolFormData({
      name: school.name,
      domain: school.domain,
      contactEmail: school.contactEmail,
      contactPhone: school.contactPhone || '',
      website: school.website || '',
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      region: school.region || ''
    });
    setShowSchoolModal(true);
  };

  const handleSaveSchool = (e) => {
    e.preventDefault();
    return runFormSave(async () => {
      if (selectedSchool) {
        await adminService.updateOrganization(selectedSchool.id, orgPayload(schoolFormData, 'school'));
        toast.success('School updated');
      } else {
        await adminService.createOrganization(orgPayload(schoolFormData, 'school'));
        toast.success('School created');
      }
      setShowSchoolModal(false);
      fetchSchools();
      fetchOrganizations();
      fetchOverviewStats();
    }, 'Could not save the school');
  };

  const handleDeleteSchool = async (schoolId) => {
    try {
      await adminService.deleteOrganization(schoolId);
      toast.success('School deactivated');
      fetchSchools();
      fetchOverviewStats();
    } catch (error) {
      toastError(error, 'Failed to deactivate school');
    }
  };

  const handleVerifySchool = async (schoolId, isVerified) => {
    try {
      await adminService.verifyOrganization(schoolId, isVerified);
      toast.success(isVerified ? 'Verified' : 'Verified badge removed');
      fetchSchools();
    } catch (error) {
      toastError(error, 'Failed to update verification');
    }
  };

  // Approve / reject go through the approval endpoints rather than the generic
  // organization update: those also decide the staff who registered with the
  // organization (its TPO, school staff or recruiters) and write the audit
  // trail. Rejecting via `PUT /admin/organizations/:id` used to flip only the
  // organization and leave its staff pending indefinitely.
  const handleApproveOrganization = async (organizationId, type) => {
    try {
      const body = await approvalService.approveOrganization(organizationId, 'approve', '', { silent: true });
      const typeLabel = ORG_LABELS[type] || 'Organization';
      const staff = body?.usersUpdated || 0;
      toast.success(
        `${typeLabel} approved${staff ? ` with ${staff} staff account${staff === 1 ? '' : 's'}` : ''}`
      );
      if (type === 'university' || type === 'college') {
        fetchUniversities();
      } else if (type === 'company') {
        fetchCompanies();
      } else if (type === 'school') {
        fetchSchools();
      }
      fetchOverviewStats();
    } catch (error) {
      toast.error(error?.message || 'Failed to approve organization');
    }
  };

  const handleRejectOrganization = async (organizationId, type) => {
    try {
      await approvalService.approveOrganization(organizationId, 'reject', '', { silent: true });
      const typeLabel = ORG_LABELS[type] || 'Organization';
      toast.success(`${typeLabel} rejected`);
      if (type === 'university' || type === 'college') {
        fetchUniversities();
      } else if (type === 'company') {
        fetchCompanies();
      } else if (type === 'school') {
        fetchSchools();
      }
      fetchOverviewStats();
    } catch (error) {
      toast.error(error?.message || 'Failed to reject organization');
    }
  };

  // Recruiter permissions handlers
  const handleOpenPermissions = async (recruiter) => {
    setSelectedRecruiter(recruiter);
    setSelectedOrgIds([]);
    setSelectedYears([]);
    setStreamsText('');
    setSelectedRegions([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setShowPermissionsModal(true);
    setPermissionsLoading(true);
    try {
      const data = await adminService.getRecruiterPermissions(recruiter.id);
      setSelectedOrgIds(data.allowedOrganizationIds || []);
      setSelectedYears(Array.isArray(data.allowedYears) ? data.allowedYears.map((y) => Number(y)) : []);
      setStreamsText(Array.isArray(data.allowedStreams) ? data.allowedStreams.join(', ') : '');
      setSelectedRegions(Array.isArray(data.allowedRegions) ? [...data.allowedRegions] : []);
      setSelectedStates(Array.isArray(data.allowedStates) ? [...data.allowedStates] : []);
      setSelectedCities(Array.isArray(data.allowedCities) ? [...data.allowedCities] : []);
    } catch (err) {
      toastError(err, 'Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Linked from Users → user details with ?recruiter=<id>: open that
  // recruiter's permissions once the list has loaded.
  useEffect(() => {
    if (!pendingRecruiterId || activeTab !== 'recruiter-permissions' || recruiters.length === 0) return;
    const target = recruiters.find((r) => String(r.id) === String(pendingRecruiterId));
    setPendingRecruiterId(null);
    if (target) handleOpenPermissions(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecruiterId, activeTab, recruiters]);

  const handlePermissionsToggle = (orgId) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  const toggleYear = (year) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort((a, b) => a - b)
    );
  };

  const toggleRegion = (v) => {
    setSelectedRegions((prev) => (prev.includes(v) ? prev.filter((r) => r !== v) : [...prev, v].sort()));
  };
  const toggleState = (v) => {
    setSelectedStates((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v].sort()));
  };
  const toggleCity = (v) => {
    setSelectedCities((prev) => (prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v].sort()));
  };

  const parseStreams = (text) =>
    [...new Set(String(text || '').split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean))];

  const handleSaveRecruiterPermissions = async (e) => {
    e.preventDefault();
    if (!selectedRecruiter) return;
    try {
      setPermissionsSaving(true);
      await adminService.setRecruiterAllowedOrganizations(selectedRecruiter.id, {
        organizationIds: selectedOrgIds,
        allowedYears: selectedYears,
        allowedStreams: parseStreams(streamsText),
        allowedRegions: selectedRegions,
        allowedStates: selectedStates,
        allowedCities: selectedCities
      });
      toast.success('Recruiter permissions updated');
      setShowPermissionsModal(false);
      setSelectedRecruiter(null);
      setSelectedOrgIds([]);
      setSelectedYears([]);
      setStreamsText('');
      setSelectedRegions([]);
      setSelectedStates([]);
      setSelectedCities([]);
    } catch (error) {
      toastError(error, 'Failed to update permissions');
    } finally {
      setPermissionsSaving(false);
    }
  };


  // Import Students tab (admin only) — upload an Excel roster for one org.
  const studentOrgs = organizations.filter(
    (o) => o.type === 'university' || o.type === 'college' || o.type === 'school'
  );

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile || !importOrganizationId) {
      toast.error('Choose the institution and a spreadsheet first.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      // Posted here rather than through adminService so it can wait longer
      // than the shared 10-second timeout: a few hundred students, each with
      // a hashed password, takes longer than that, and the browser then
      // reported a failure for an import that had actually gone through.
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('organizationId', String(parseInt(importOrganizationId, 10)));
      const res = await api.post('/admin/students/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });
      setImportResult(res);
      toast.success(
        `Import finished: ${res.summary?.created ?? 0} added, ${res.summary?.skipped ?? 0} already had accounts, ${res.summary?.errors ?? 0} not added.`
      );
      setImportFile(null);
      const input = document.getElementById('import-file-input');
      if (input) input.value = '';
    } catch (err) {
      toastError(err, 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  /** Opens the shared confirmation dialog for a destructive action. */
  const askToConfirm = (config) => setConfirmAction(config);

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmRunning(true);
    try {
      await confirmAction.run();
      setConfirmAction(null);
    } finally {
      setConfirmRunning(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <PageShell>
        <EmptyState
          icon={LockClosedIcon}
          title="Admins only"
          description="This console manages every organization and account on the platform."
        />
      </PageShell>
    );
  }

  if (isLoading && activeTab === 'overview') {
    return (
      <PageShell>
        <PageLoader label="Loading platform statistics" />
      </PageShell>
    );
  }

  /* ------------------------------------------------------------------ tabs */

  const renderOverviewTab = () => (
    <>
      {pendingTotal > 0 && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-saffron-500/40 bg-saffron-50 py-4">
          <p className="text-sm text-saffron-900">
            Waiting on review:{' '}
            {[
              pendingOrgs ? `${pendingOrgs} organization${pendingOrgs === 1 ? '' : 's'}` : null,
              pendingAccounts ? `${pendingAccounts} account${pendingAccounts === 1 ? '' : 's'}` : null,
              pendingPostings ? `${pendingPostings} job posting${pendingPostings === 1 ? '' : 's'}` : null
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </p>
          <Button as={Link} to="/approvals" size="sm" variant="secondary" iconRight={ArrowRightIcon}>
            Open approval queue
          </Button>
        </Card>
      )}

      <StatStrip>
        <StatCard
          title="Total users"
          value={stats.users?.total ?? 0}
          subtitle={`+${stats.users?.recentRegistrations ?? 0} this month`}
          icon={UsersIcon}
          color="purple"
        />
        <StatCard
          title="Organizations"
          value={stats.organizations?.total ?? 0}
          subtitle={
            (stats.organizations?.byType || [])
              .filter((row) => Number(row.count) > 0)
              .map((row) => `${row.count} ${row.type}`)
              .join(' · ') || 'Universities, colleges, schools and companies'
          }
          icon={BuildingOfficeIcon}
          color="green"
        />
        <StatCard
          title="Jobs"
          value={stats.jobs?.total ?? 0}
          subtitle={`+${stats.jobs?.recentPostings ?? 0} this week`}
          icon={BriefcaseIcon}
          color="blue"
        />
        <StatCard
          title="Applications"
          value={stats.applications?.total ?? 0}
          subtitle="Total submissions"
          icon={DocumentTextIcon}
          color="orange"
        />
      </StatStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Users by role">
          {stats.users?.byRole?.length ? (
            <div className="divide-y divide-ink-950/10">
              {stats.users.byRole.map((row) => (
                <MeterRow
                  key={row.role}
                  label={formatRole(row.role)}
                  value={Number(row.count)}
                  total={Number(stats.users.total) || 0}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">No user breakdown available.</p>
          )}
        </ChartCard>

        <ChartCard title="Jobs by status">
          {stats.jobs?.byStatus?.length ? (
            <div className="divide-y divide-ink-950/10">
              {stats.jobs.byStatus.map((row) => (
                <MeterRow
                  key={row.status}
                  label={String(row.status).replace(/_/g, ' ')}
                  value={Number(row.count)}
                  total={Number(stats.jobs.total) || 0}
                  tone="saffron"
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">No job breakdown available.</p>
          )}
        </ChartCard>

        <ChartCard title="Applications by status">
          {stats.applications?.byStatus?.length ? (
            <div className="divide-y divide-ink-950/10">
              {stats.applications.byStatus.map((row) => (
                <MeterRow
                  key={row.status}
                  label={String(row.status).replace(/_/g, ' ')}
                  value={Number(row.count)}
                  total={Number(stats.applications.total) || 0}
                  tone="india"
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">No applications yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Students by placement status">
          {stats.placements?.byStatus?.length ? (
            <div className="divide-y divide-ink-950/10">
              {stats.placements.byStatus.map((row) => (
                <MeterRow
                  key={row.placementStatus}
                  label={String(row.placementStatus).replace(/_/g, ' ')}
                  value={Number(row.count)}
                  total={Number(stats.placements.total) || 0}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">No student profiles yet.</p>
          )}
        </ChartCard>
      </div>

      <ChartCard className="mt-6" title="Recent activity" description="Applications from the last 7 days.">
        {stats.recentActivity?.length ? (
          <ul className="divide-y divide-ink-950/10">
            {stats.recentActivity.map((activity, index) => (
              <li
                key={activity.id ?? index}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-950">
                    {activity.student?.firstName} {activity.student?.lastName}
                  </p>
                  <p className="truncate text-sm text-ink-600">
                    Applied to {activity.job?.title} at {activity.job?.organization?.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-500">
                    {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''}
                  </span>
                  <StatusBadge status={activity.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-ink-500">
            Applications will appear here as students apply.
          </p>
        )}
      </ChartCard>
    </>
  );

  const renderAnalyticsTab = () => {
    if (isLoading || !analytics) {
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      );
    }

    return (
      <>
        <Toolbar>
          <div className="w-full sm:w-56">
            <Select
              label="Period"
              value={analyticsPeriod}
              onChange={(e) => setAnalyticsPeriod(e.target.value)}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
                { value: '365', label: 'Last year' }
              ]}
            />
          </div>
        </Toolbar>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="User growth">
            {analytics.userGrowth?.length ? (
              <LineChart
                data={prepareLineChartData(analytics.userGrowth, 'date', ['total'])}
                xKey="date"
                yKeys={[{ key: 'total', name: 'New users' }]}
                caption="New user registrations over the selected period"
              />
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">No data for this period.</p>
            )}
          </ChartCard>

          <ChartCard title="Job postings">
            {analytics.jobTrends?.daily?.length ? (
              <LineChart
                data={prepareLineChartData(analytics.jobTrends.daily, 'date', ['total'])}
                xKey="date"
                yKeys={[{ key: 'total', name: 'Jobs posted', color: '#FF9933' }]}
                caption="Jobs posted over the selected period"
              />
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">No data for this period.</p>
            )}
          </ChartCard>

          <ChartCard title="Application funnel">
            {analytics.applicationTrends?.funnel ? (
              <BarChart
                data={Object.entries(analytics.applicationTrends.funnel).map(([name, value]) => ({
                  name,
                  value
                }))}
                xKey="name"
                yKeys={[{ key: 'value', name: 'Applications', color: '#138808' }]}
                caption="Applications at each stage of the funnel"
              />
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">No data for this period.</p>
            )}
          </ChartCard>

          <ChartCard title="Placements">
            {analytics.placementTrends?.daily?.length ? (
              <LineChart
                data={prepareLineChartData(analytics.placementTrends.daily, 'date', ['placed'])}
                xKey="date"
                yKeys={[{ key: 'placed', name: 'Students placed', color: '#138808' }]}
                caption="Students placed over the selected period"
              />
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">No data for this period.</p>
            )}
          </ChartCard>
        </div>

        {topPerformers && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <ChartCard title="Top universities">
              {topPerformers.universities?.length ? (
                <ol className="divide-y divide-ink-950/10">
                  {topPerformers.universities.slice(0, 5).map((uni, i) => (
                    <li key={uni.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                        <span className="mr-2 font-mono text-xs text-ink-500">{i + 1}</span>
                        {uni.name}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-600">
                        {uni.placements} placements
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-ink-500">No data yet.</p>
              )}
            </ChartCard>

            <ChartCard title="Top companies">
              {topPerformers.companies?.length ? (
                <ol className="divide-y divide-ink-950/10">
                  {topPerformers.companies.slice(0, 5).map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                        <span className="mr-2 font-mono text-xs text-ink-500">{i + 1}</span>
                        {c.name}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-600">{c.jobs} jobs</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-ink-500">No data yet.</p>
              )}
            </ChartCard>

            <ChartCard title="Top students">
              {topPerformers.students?.length ? (
                <ol className="divide-y divide-ink-950/10">
                  {topPerformers.students.slice(0, 5).map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                        <span className="mr-2 font-mono text-xs text-ink-500">{i + 1}</span>
                        {s.name}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-600">
                        CGPA {s.cgpa}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-ink-500">No data yet.</p>
              )}
            </ChartCard>
          </div>
        )}
      </>
    );
  };

  const ROLE_TONES = { admin: 'danger', tpo: 'info', recruiter: 'purple', student: 'success' };

  const renderUsersTab = () => {
    const userColumns = [
      {
        key: 'firstName',
        label: 'Name',
        sortable: true,
        render: (_, row) => `${row.firstName} ${row.lastName}`
      },
      { key: 'email', label: 'Email', sortable: true },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        render: (value) => <Badge tone={ROLE_TONES[value] || 'neutral'}>{value.replace(/_/g, ' ')}</Badge>
      },
      {
        key: 'organization',
        label: 'Organization',
        render: (_, row) =>
          row.organization ? (
            <span>
              {row.organization.name}
              <span className="block text-xs capitalize text-ink-500">{row.organization.type}</span>
            </span>
          ) : (
            '—'
          )
      },
      {
        key: 'approvalStatus',
        label: 'Status',
        render: (value, row) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={value} />
            {row.isActive === false && <StatusBadge status="inactive" />}
          </span>
        )
      }
    ];

    const hasFilters = Boolean(
      usersFilters.role ||
        usersFilters.organizationType ||
        usersFilters.search ||
        usersFilters.approvalStatus
    );

    return (
      <>
        <Toolbar className="flex-wrap">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Search"
              icon={MagnifyingGlassIcon}
              placeholder="Name or email"
              value={usersFilters.search}
              onChange={(e) => setUsersFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Role"
              value={usersFilters.role}
              onChange={(e) => setUsersFilters((prev) => ({ ...prev, role: e.target.value }))}
              options={[
                { value: '', label: 'All roles' },
                { value: 'student', label: 'Students' },
                { value: 'tpo', label: 'TPOs' },
                { value: 'recruiter', label: 'Recruiters' },
                { value: 'admin', label: 'Admins' },
                { value: 'principal', label: 'Principals' },
                { value: 'teacher', label: 'Teachers' },
                { value: 'school_admin', label: 'School admins' },
                { value: 'career_counselor', label: 'Career counsellors' }
              ]}
            />
          </div>
          <div className="w-full sm:w-44">
            {/* Was state with no control: `approvalStatus` sat in the filter
                object and was sent with every request, but nothing on screen
                could ever set it. */}
            <Select
              label="Approval"
              value={usersFilters.approvalStatus}
              onChange={(e) =>
                setUsersFilters((prev) => ({ ...prev, approvalStatus: e.target.value }))
              }
              options={[
                { value: '', label: 'Any status' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' }
              ]}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Organization type"
              value={usersFilters.organizationType}
              onChange={(e) =>
                setUsersFilters((prev) => ({ ...prev, organizationType: e.target.value }))
              }
              options={[
                { value: '', label: 'All types' },
                { value: 'university', label: 'Universities' },
                { value: 'college', label: 'Colleges' },
                { value: 'company', label: 'Companies' },
                { value: 'school', label: 'Schools' }
              ]}
            />
          </div>
          <div className="flex gap-2 sm:self-end sm:pb-0.5">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setUsersFilters({
                    search: '',
                    role: '',
                    approvalStatus: '',
                    organizationId: '',
                    organizationType: ''
                  })
                }
              >
                Clear
              </Button>
            )}
            <Button size="sm" icon={PlusIcon} onClick={handleCreateUser}>
              New user
            </Button>
          </div>
        </Toolbar>

        <DataTable
          columns={userColumns}
          data={users}
          emptyTitle="No users match"
          emptyDescription="Widen the filters to see more accounts."
          actions={(row) => (
            <RowActions>
              <IconButton
                size="sm"
                icon={PencilSquareIcon}
                label={`Edit ${row.firstName} ${row.lastName}`}
                onClick={() => handleEditUser(row)}
              />
              {row.isActive === false ? (
                <IconButton
                  size="sm"
                  icon={ArrowPathIcon}
                  label={`Reactivate ${row.firstName} ${row.lastName}`}
                  onClick={() => handleReactivateUser(row, () => fetchUsers(usersPagination.currentPage || 1))}
                />
              ) : (
              <IconButton
                size="sm"
                variant="danger"
                icon={TrashIcon}
                label={`Deactivate ${row.firstName} ${row.lastName}`}
                onClick={() =>
                  askToConfirm({
                    title: 'Deactivate this user?',
                    description: `${row.firstName} ${row.lastName} (${row.email}) will not be able to sign in until reactivated.`,
                    confirmLabel: 'Deactivate',
                    run: () => handleDeleteUser(row.id)
                  })
                }
              />
              )}
            </RowActions>
          )}
          pagination={usersPagination}
          onPageChange={fetchUsers}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title={selectedUser ? 'Edit user' : 'New user'}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button type="submit" form="admin-user-form" loading={formSaving}>
                {selectedUser ? 'Save changes' : 'Create user'}
              </Button>
            </>
          }
        >
          <form id="admin-user-form" onSubmit={handleSaveUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                required
                value={userFormData.firstName || ''}
                error={formErrors.firstName}
                onChange={(e) =>
                  setUserFormData((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
              <Input
                label="Last name"
                required
                value={userFormData.lastName || ''}
                error={formErrors.lastName}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              autoCapitalize="none"
              value={userFormData.email || ''}
              error={formErrors.email}
              onChange={(e) => setUserFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
            {!selectedUser && (
              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={userFormData.password || ''}
                error={formErrors.password}
                help="At least 8 characters. Share it privately; they can change it in Settings."
                onChange={(e) => setUserFormData((prev) => ({ ...prev, password: e.target.value }))}
              />
            )}
            {/* Every role is listed. With only four, editing a teacher or
                principal showed "Student" (the first option) and saving
                quietly changed their role. */}
            <Select
              label="Role"
              required
              value={userFormData.role || 'student'}
              error={formErrors.role}
              disabled={Boolean(selectedUser && selectedUser.id === user?.id)}
              help={
                selectedUser && selectedUser.id === user?.id
                  ? 'You cannot change your own role.'
                  : undefined
              }
              onChange={(e) => setUserFormData((prev) => ({ ...prev, role: e.target.value }))}
              options={USER_ROLE_OPTIONS}
            />
            {userFormData.role !== 'admin' && (
              <Select
                label="Organization"
                required
                value={String(userFormData.organizationId || '')}
                error={formErrors.organizationId}
                onChange={(e) =>
                  setUserFormData((prev) => ({ ...prev, organizationId: e.target.value }))
                }
                options={[
                  { value: '', label: 'Select organization' },
                  ...organizations
                    .filter((org) =>
                      (ORG_TYPES_FOR_ROLE[userFormData.role || 'student'] || []).includes(org.type)
                    )
                    .map((org) => ({ value: String(org.id), label: org.name }))
                ]}
              />
            )}
          </form>
        </AdminModal>
      </>
    );
  };

  const renderTPOsTab = () => {
    const tpoColumns = [
      {
        key: 'firstName',
        label: 'Name',
        sortable: true,
        render: (_, row) => `${row.firstName} ${row.lastName}`
      },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'organization', label: 'College', render: (_, row) => row.organization?.name || '—' },
      {
        key: 'isActive',
        label: 'Status',
        render: (value) => <StatusBadge status={value ? 'active' : 'inactive'} />
      }
    ];

    return (
      <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-950">
            Training &amp; placement officers
          </h2>
          <Button size="sm" icon={PlusIcon} onClick={handleCreateTPO}>
            New TPO
          </Button>
        </div>

        <DataTable
          columns={tpoColumns}
          data={tpos}
          emptyTitle="No TPOs yet"
          emptyDescription="Create one to give a college a placement officer."
          actions={(row) => (
            <RowActions>
              <IconButton
                size="sm"
                icon={PencilSquareIcon}
                label={`Edit ${row.firstName} ${row.lastName}`}
                onClick={() => handleEditTPO(row)}
              />
              {row.isActive === false ? (
                <IconButton
                  size="sm"
                  icon={ArrowPathIcon}
                  label={`Reactivate ${row.firstName} ${row.lastName}`}
                  onClick={() => handleReactivateUser(row, () => fetchTPOs(tposPagination.currentPage || 1))}
                />
              ) : (
              <IconButton
                size="sm"
                variant="danger"
                icon={TrashIcon}
                label={`Deactivate ${row.firstName} ${row.lastName}`}
                onClick={() =>
                  askToConfirm({
                    title: 'Deactivate this TPO?',
                    description: `${row.firstName} ${row.lastName} (${row.email}) will not be able to sign in. Their college and its students are not affected. You can reactivate them here.`,
                    confirmLabel: 'Deactivate',
                    run: () => handleDeleteTPO(row.id)
                  })
                }
              />
              )}
            </RowActions>
          )}
          pagination={tposPagination}
          onPageChange={fetchTPOs}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showTPOModal}
          onClose={() => setShowTPOModal(false)}
          title={selectedTPO ? 'Edit TPO' : 'New TPO'}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowTPOModal(false)}>
                Cancel
              </Button>
              <Button type="submit" form="admin-tpo-form" loading={formSaving}>
                {selectedTPO ? 'Save changes' : 'Create TPO'}
              </Button>
            </>
          }
        >
          <form id="admin-tpo-form" onSubmit={handleSaveTPO} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                required
                value={tpoFormData.firstName || ''}
                error={formErrors.firstName}
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, firstName: e.target.value }))}
              />
              <Input
                label="Last name"
                required
                value={tpoFormData.lastName || ''}
                error={formErrors.lastName}
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              autoCapitalize="none"
              value={tpoFormData.email || ''}
              error={formErrors.email}
              onChange={(e) => setTpoFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
            {!selectedTPO && (
              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={tpoFormData.password || ''}
                error={formErrors.password}
                help="At least 8 characters."
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, password: e.target.value }))}
              />
            )}
            {/* Colleges were filtered out, so a new college could never be
                given a placement officer from here. */}
            <Select
              label="College or university"
              required
              value={String(tpoFormData.organizationId || '')}
              error={formErrors.organizationId}
              onChange={(e) =>
                setTpoFormData((prev) => ({ ...prev, organizationId: e.target.value }))
              }
              options={[
                { value: '', label: 'Select college or university' },
                ...organizations
                  .filter((org) => org.type === 'university' || org.type === 'college')
                  .map((org) => ({ value: String(org.id), label: org.name }))
              ]}
            />
          </form>
        </AdminModal>
      </>
    );
  };

  /**
   * Universities, companies and schools are the same table with a different
   * noun, so one renderer serves all three.
   */
  const renderOrganizationTab = ({
    type,
    heading,
    rows,
    pagination,
    onPageChange,
    onCreate,
    onEdit,
    onDelete,
    onVerify,
    extraColumns,
    modalOpen,
    onModalClose,
    selected,
    formData,
    setFormData,
    onSubmit
  }) => {
    const higherEd = type === 'university';
    const noun = higherEd ? 'college or university' : type;
    const columns = [
      { key: 'name', label: 'Name', sortable: true },
      ...(higherEd
        ? [{ key: 'type', label: 'Type', render: (value) => ORG_LABELS[value] || value }]
        : []),
      { key: 'domain', label: 'Domain', sortable: true },
      ...extraColumns,
      {
        key: 'approvalStatus',
        label: 'Approval',
        render: (value) => <StatusBadge status={value || 'pending'} />
      },
      {
        key: 'isVerified',
        label: 'Verified',
        render: (value) => (
          <Badge tone={value ? 'success' : 'warning'}>{value ? 'Verified' : 'Unverified'}</Badge>
        )
      }
    ];

    return (
      <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-950">{heading}</h2>
          <Button size="sm" icon={PlusIcon} onClick={onCreate}>
            {higherEd ? 'New college' : `New ${type}`}
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          emptyTitle={`No ${heading.toLowerCase()} yet`}
          emptyDescription={`Create the first ${noun} to get started.`}
          actions={(row) => (
            <RowActions>
              {row.approvalStatus === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleApproveOrganization(row.id, row.type || type)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      askToConfirm({
                        title: `Reject ${row.name}?`,
                        description: `This ${noun} will be marked rejected and its users will not be able to sign in.`,
                        confirmLabel: 'Reject',
                        run: () => handleRejectOrganization(row.id, row.type || type)
                      })
                    }
                  >
                    Reject
                  </Button>
                </>
              )}
              <IconButton
                size="sm"
                icon={CheckBadgeIcon}
                label={`${row.isVerified ? 'Remove verified badge from' : 'Verify'} ${row.name}`}
                onClick={() =>
                  row.isVerified
                    ? askToConfirm({
                        title: `Remove the verified badge from ${row.name}?`,
                        description:
                          'It will no longer appear in the sign-up lists, so new students and staff cannot pick it until it is verified again.',
                        confirmLabel: 'Remove badge',
                        run: () => onVerify(row.id, false)
                      })
                    : onVerify(row.id, true)
                }
              />
              <IconButton
                size="sm"
                icon={PencilSquareIcon}
                label={`Edit ${row.name}`}
                onClick={() => onEdit(row)}
              />
              <IconButton
                size="sm"
                variant="danger"
                icon={TrashIcon}
                label={`Deactivate ${row.name}`}
                onClick={() =>
                  askToConfirm({
                    title: `Deactivate ${row.name}?`,
                    // `DELETE /admin/organizations/:id` only hard-deletes with
                    // `?hardDelete=true`, which this screen never sends. Without
                    // it the server sets `approvalStatus: 'rejected'` and
                    // `isVerified: false` and answers "deactivated" — the row
                    // stays in this table. The copy used to promise the record
                    // was removed from the platform and could not be undone,
                    // which is the opposite of what the button does.
                    description: `This marks the ${noun} rejected and unverified, and nobody attached to it can sign in. It is only allowed once no accounts or jobs are attached. Verify it again to reverse this.`,
                    confirmLabel: 'Deactivate',
                    run: () => onDelete(row.id)
                  })
                }
              />
            </RowActions>
          )}
          pagination={pagination}
          onPageChange={onPageChange}
          loading={isLoading}
        />

        <AdminModal
          isOpen={modalOpen}
          onClose={onModalClose}
          title={`${selected ? 'Edit' : 'New'} ${
            higherEd ? (ORG_LABELS[formData.type] || 'College').toLowerCase() : type
          }`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={onModalClose}>
                Cancel
              </Button>
              <Button type="submit" form={`admin-${type}-form`} loading={formSaving}>
                {selected ? 'Save changes' : 'Create'}
              </Button>
            </>
          }
        >
          <form id={`admin-${type}-form`} onSubmit={onSubmit}>
            <OrganizationFormFields
              value={formData}
              onChange={setFormData}
              noun={type}
              errors={formErrors}
              showHigherEdType={higherEd}
            />
          </form>
        </AdminModal>
      </>
    );
  };

  const countColumn = (key, label) => ({
    key,
    label,
    render: (_, row) => row.stats?.[key] ?? 0
  });

  const renderImportStudentsTab = () => (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-950">Import students from a spreadsheet</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file
          with a header row. Each student needs an <strong>Email</strong> and a{' '}
          <strong>Name</strong> (or first and last name). Roll No., Mobile No., Course, Branch,
          Year, Batch, Gender, CGPA, Class X / XII %, Backlogs and Date of Birth (DD/MM/YYYY) are
          optional; common spellings such as &ldquo;Email ID&rdquo; and &ldquo;Mobile No&rdquo;
          are recognised. Up to 500 students at a time.
        </p>
        <Button
          size="sm"
          variant="ghost"
          icon={ArrowDownTrayIcon}
          className="mt-2 -ml-2"
          onClick={downloadImportTemplate}
        >
          Download template (CSV)
        </Button>
      </div>

      <Card as="form" onSubmit={handleImportSubmit} className="space-y-4">
        <Select
          id="import-org"
          label="Organization"
          required
          value={importOrganizationId}
          onChange={(e) => setImportOrganizationId(e.target.value)}
          options={[
            { value: '', label: 'Select organization' },
            ...studentOrgs.map((org) => ({ value: String(org.id), label: `${org.name} (${org.type})` }))
          ]}
          help="Every imported student joins this university, college or school."
        />
        <div>
          <label
            htmlFor="import-file-input"
            className="mb-1.5 block text-sm font-medium text-ink-800"
          >
            Spreadsheet
          </label>
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-ink-950/20 bg-white text-sm text-ink-700 file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-ink-950/15 file:bg-bone-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-ink-950 hover:file:bg-bone-200"
          />
        </div>
        <Button
          type="submit"
          icon={ArrowUpTrayIcon}
          loading={importing}
          disabled={!importFile || !importOrganizationId}
        >
          {importing ? 'Importing' : 'Import students'}
        </Button>
      </Card>

      {importResult && (
        <Card className="space-y-4">
          <h3 className="font-display text-base font-bold text-ink-950">Import result</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-india-600/30 bg-india-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.07em] text-india-800">Added</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.created) || 0}
              </p>
            </div>
            <div className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.07em] text-saffron-800">Already on EduMapping</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.skipped) || 0}
              </p>
            </div>
            <div className="rounded-xl border border-red-600/25 bg-red-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.07em] text-red-800">Not added</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.errors) || 0}
              </p>
            </div>
          </div>

          {importResult.created?.some((c) => c.temporaryPassword) && (
            <div className="rounded-xl border border-ink-950/15 bg-bone-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Temporary passwords</p>
              <p className="mt-1 text-sm text-ink-700">
                Each new student has their own random temporary password. They are shown only
                now and are not stored anywhere you can retrieve them later, so download the
                file and share each password privately. Students should change it after their
                first sign-in (Settings, Change password).
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                icon={ArrowDownTrayIcon}
                onClick={() => downloadCredentialsCsv(importResult.created)}
              >
                Download credentials (CSV)
              </Button>
            </div>
          )}

          {Number(importResult.summary?.skipped) > 0 && (
            <div className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-4 py-3">
              <p className="text-sm font-semibold text-saffron-800">Rows left unchanged</p>
              <p className="mt-1 text-sm text-ink-700">
                These students already have an account (or appear twice in the file), so nothing
                was changed for them.
              </p>
              {importResult.skipped?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-ink-600">
                  {importResult.skipped.slice(0, 5).map((row) => (
                    <li key={`${row.row}-${row.email}`}>
                      Row {row.row}: {row.email}
                      {row.reason ? ` (${row.reason})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {importResult.errors?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-800">
                Not added: fix these rows and upload them again
                {importResult.errors.length > 10 ? ' (first 10 shown)' : ''}
              </p>
              <ul className="mt-1.5 list-inside list-disc text-sm text-vermilion-700">
                {importResult.errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}
                    {err.email ? ` (${err.email})` : ''}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The shared importer adds the student but drops a value it could
              not read (CGPA 85, DOB 31/02/2004). Those used to vanish without
              a word. */}
          {importResult.warnings?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-800">
                Added, but check these details
                {importResult.warnings.length > 10 ? ' (first 10 shown)' : ''}
              </p>
              <ul className="mt-1.5 list-inside list-disc text-sm text-saffron-800">
                {importResult.warnings.slice(0, 10).map((w, idx) => (
                  <li key={idx}>
                    Row {w.row}
                    {w.email ? ` (${w.email})` : ''}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importResult.ignoredColumns?.length > 0 && (
            <p className="text-xs text-ink-500">
              Columns not used: {importResult.ignoredColumns.join(', ')}
            </p>
          )}
        </Card>
      )}
    </div>
  );

  const renderRecruiterPermissionsTab = () => {
    if (isLoading && recruiters.length === 0) {
      return <SkeletonCard lines={6} />;
    }

    const uniqueValues = (key) => [...new Set(institutions.map((i) => i[key]).filter(Boolean))].sort();
    const regions = uniqueValues('region');
    const states = uniqueValues('state');
    const cities = uniqueValues('city');

    const closePermissions = () => {
      setShowPermissionsModal(false);
      setSelectedRecruiter(null);
      setSelectedOrgIds([]);
      setSelectedYears([]);
      setStreamsText('');
      setSelectedRegions([]);
      setSelectedStates([]);
      setSelectedCities([]);
    };

    return (
      <>
        <div className="mb-5">
          <h2 className="font-display text-lg font-bold text-ink-950">Recruiter access</h2>
          <p className="mt-1.5 max-w-prose text-sm text-ink-600">
            Recruiters can only see students from institutions you allow here. An empty list means
            they see nobody.
          </p>
        </div>

        {recruiters.length === 0 ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="No recruiters yet"
            description="Recruiter accounts appear here once companies have registered."
          />
        ) : (
          <Table className="relative">
            <Thead>
              <Tr className="hover:bg-transparent">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Company</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {recruiters.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-ink-950">
                    {r.firstName} {r.lastName}
                  </Td>
                  <Td>{r.email}</Td>
                  <Td>{r.organization?.name || '—'}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={ShieldCheckIcon}
                      onClick={() => handleOpenPermissions(r)}
                    >
                      Set permissions
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <AdminModal
          isOpen={showPermissionsModal}
          onClose={closePermissions}
          title={
            selectedRecruiter
              ? `Permissions — ${selectedRecruiter.firstName} ${selectedRecruiter.lastName}`
              : 'Recruiter permissions'
          }
          description="Institutions first, then optional narrowing by location, year and stream."
          footer={
            <>
              <Button variant="secondary" onClick={closePermissions}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="recruiter-permissions-form"
                loading={permissionsSaving}
                disabled={permissionsLoading}
              >
                Save permissions
              </Button>
            </>
          }
        >
          <form
            id="recruiter-permissions-form"
            onSubmit={handleSaveRecruiterPermissions}
            className="space-y-5"
          >
            {permissionsLoading ? (
              <SkeletonCard lines={5} />
            ) : (
              <>
                <fieldset>
                  <legend className="text-sm font-semibold text-ink-900">Allowed institutions</legend>
                  {institutions.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-500">
                      No schools, colleges or universities exist yet.
                    </p>
                  ) : (
                    <div className="mt-3 max-h-56 space-y-4 overflow-y-auto rounded-xl border border-ink-950/15 p-3">
                      {['school', 'college', 'university'].map((type) => {
                        const list = institutions.filter((i) => i.type === type);
                        if (list.length === 0) return null;
                        return (
                          <div key={type}>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                              {{ school: 'Schools', college: 'Colleges', university: 'Universities' }[type]}
                            </h4>
                            <div className="space-y-1.5">
                              {list.map((org) => (
                                <Checkbox
                                  key={org.id}
                                  id={`org-${org.id}`}
                                  label={org.name}
                                  checked={selectedOrgIds.includes(org.id)}
                                  onChange={() => handlePermissionsToggle(org.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </fieldset>

                <fieldset className="border-t border-ink-950/10 pt-4">
                  <legend className="text-sm font-semibold text-ink-900">Location (optional)</legend>
                  <p className="mt-1 text-xs text-ink-500">
                    If set, only students from institutions in these places are visible.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    {[
                      { label: 'Regions', values: regions, selected: selectedRegions, toggle: toggleRegion },
                      { label: 'States', values: states, selected: selectedStates, toggle: toggleState },
                      { label: 'Cities', values: cities, selected: selectedCities, toggle: toggleCity }
                    ].map((group) => (
                      <div key={group.label}>
                        <p className="mb-1.5 text-xs font-medium text-ink-600">{group.label}</p>
                        <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-xl border border-ink-950/15 p-2.5">
                          {group.values.length === 0 ? (
                            <p className="text-xs text-ink-500">None in the data</p>
                          ) : (
                            group.values.map((v) => (
                              <Checkbox
                                key={v}
                                label={v}
                                checked={group.selected.includes(v)}
                                onChange={() => group.toggle(v)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="border-t border-ink-950/10 pt-4">
                  <legend className="text-sm font-semibold text-ink-900">
                    Year and stream (optional)
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <Checkbox
                        key={y}
                        label={`Year ${y}`}
                        checked={selectedYears.includes(y)}
                        onChange={() => toggleYear(y)}
                      />
                    ))}
                  </div>
                  <Input
                    className="mt-3"
                    label="Streams"
                    value={streamsText}
                    onChange={(e) => setStreamsText(e.target.value)}
                    placeholder="e.g. CSE, ECE, Mechanical Engineering"
                    help="Separate streams with commas. Leave empty for all streams."
                  />
                </fieldset>
              </>
            )}
          </form>
        </AdminModal>
      </>
    );
  };

  /* ---------------------------------------------------------------- render */

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Administration"
        title="Admin console"
        lead="Platform-wide statistics, accounts, institutions and recruiter access."
        actions={
          <>
            <Button variant="secondary" icon={MegaphoneIcon} onClick={() => setAnnouncing(true)}>
              Send announcement
            </Button>
            <Button as={Link} to="/audit" variant="secondary" icon={ClipboardDocumentListIcon}>
              Audit log
            </Button>
            <Button as={Link} to="/approvals" icon={ClipboardDocumentCheckIcon}>
              Approvals
              {pendingTotal > 0 && (
                <span className="rounded-full bg-saffron-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-950">
                  {pendingTotal}
                </span>
              )}
            </Button>
          </>
        }
      />

      <AnnounceModal open={announcing} onClose={() => setAnnouncing(false)} role="admin" />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'import-students' && renderImportStudentsTab()}
      {activeTab === 'tpos' && renderTPOsTab()}
      {activeTab === 'universities' &&
        renderOrganizationTab({
          type: 'university',
          heading: 'Colleges & universities',
          rows: universities,
          pagination: universitiesPagination,
          onPageChange: fetchUniversities,
          onCreate: handleCreateUniversity,
          onEdit: handleEditUniversity,
          onDelete: handleDeleteUniversity,
          onVerify: handleVerifyUniversity,
          extraColumns: [countColumn('students', 'Students'), countColumn('tpos', 'TPOs')],
          modalOpen: showUniversityModal,
          onModalClose: () => setShowUniversityModal(false),
          selected: selectedUniversity,
          formData: universityFormData,
          setFormData: setUniversityFormData,
          onSubmit: handleSaveUniversity
        })}
      {activeTab === 'companies' &&
        renderOrganizationTab({
          type: 'company',
          heading: 'Companies',
          rows: companies,
          pagination: companiesPagination,
          onPageChange: fetchCompanies,
          onCreate: handleCreateCompany,
          onEdit: handleEditCompany,
          onDelete: handleDeleteCompany,
          onVerify: handleVerifyCompany,
          extraColumns: [countColumn('recruiters', 'Recruiters'), countColumn('jobs', 'Jobs')],
          modalOpen: showCompanyModal,
          onModalClose: () => setShowCompanyModal(false),
          selected: selectedCompany,
          formData: companyFormData,
          setFormData: setCompanyFormData,
          onSubmit: handleSaveCompany
        })}
      {activeTab === 'schools' &&
        renderOrganizationTab({
          type: 'school',
          heading: 'Schools',
          rows: schools,
          pagination: schoolsPagination,
          onPageChange: fetchSchools,
          onCreate: handleCreateSchool,
          onEdit: handleEditSchool,
          onDelete: handleDeleteSchool,
          onVerify: handleVerifySchool,
          extraColumns: [countColumn('students', 'Students')],
          modalOpen: showSchoolModal,
          onModalClose: () => setShowSchoolModal(false),
          selected: selectedSchool,
          formData: schoolFormData,
          setFormData: setSchoolFormData,
          onSubmit: handleSaveSchool
        })}
      {activeTab === 'recruiter-permissions' && renderRecruiterPermissionsTab()}

      {/* `POST /admin/organizations` stamps isVerified and approvalStatus
          'approved' on anything an admin creates, so this panel says the
          account goes live immediately. It used to promise the opposite —
          that the record lands in `pending` and needs approving from this tab
          — which sent admins hunting for an Approve button that is never
          rendered for a row that is already approved. */}
      <AdminModal
        isOpen={showApprovalInfo}
        onClose={() => setShowApprovalInfo(false)}
        title={`New ${approvalInfoType === 'university' ? 'college' : approvalInfoType} goes live immediately`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowApprovalInfo(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprovalInfoConfirm}>Continue</Button>
          </>
        }
      >
        <div className="flex gap-3">
          <InformationCircleIcon aria-hidden="true" className="h-6 w-6 shrink-0 text-saffron-600" />
          <ul className="list-inside list-disc space-y-1.5 text-sm text-ink-700">
            <li>
              Because you are an admin, the{' '}
              {approvalInfoType === 'university' ? 'college' : approvalInfoType} is created{' '}
              <strong>approved and verified</strong> — it does not enter the approval queue.
            </li>
            <li>People can register against its domain as soon as you save.</li>
            <li>Deactivate it from this tab if you created it by mistake.</li>
          </ul>
        </div>
      </AdminModal>

      <AdminModal
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        size="sm"
        title={confirmAction?.title || ''}
        description={confirmAction?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={confirmRunning} onClick={runConfirmAction}>
              {confirmAction?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        {/* The fixed line "This cannot be undone from here." contradicted
            every dialog that uses it: each action here can be reversed. */}
        {confirmAction?.note && <p className="text-sm text-ink-700">{confirmAction.note}</p>}
      </AdminModal>
    </PageShell>
  );
};

export default AdminDashboard;
