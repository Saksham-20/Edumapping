// client/src/pages/dashboard/AdminDashboard.js
//
// The platform administrator's console: one page, nine tabs, each backed by its
// own endpoint. Data loading and the write handlers below are unchanged from
// the original; what was rewritten is the surface — the design system's Table,
// Modal, Tabs and form controls replace the hand-rolled ones, and every
// destructive action now confirms in a real dialog instead of window.confirm.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import statisticsService from '../../services/statistics';
import adminService from '../../services/adminService';
import api from '../../services/api';
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
  Modal,
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
  Tr
} from '../../components/ui';
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
  ArrowUpTrayIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { prepareLineChartData } from '../../utils/chartUtils';

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
const OrganizationFormFields = ({ value = {}, onChange, noun }) => {
  const set = (name) => (e) => onChange({ ...value, [name]: e.target.value });
  return (
    <div className="space-y-4">
      <Input label="Name" required value={value.name || ''} onChange={set('name')} />
      <Input
        label="Domain"
        required
        value={value.domain || ''}
        onChange={set('domain')}
        placeholder={`admin@${noun}.edu`}
        help="The email domain accounts must register from."
      />
      <Input
        label="Contact email"
        type="email"
        required
        value={value.contactEmail || ''}
        onChange={set('contactEmail')}
      />
      <Input label="Contact phone" value={value.contactPhone || ''} onChange={set('contactPhone')} />
      <Input label="Website" type="url" value={value.website || ''} onChange={set('website')} />
      <Textarea label="Address" rows={3} value={value.address || ''} onChange={set('address')} />
    </div>
  );
};

/** Edit / delete controls for one table row. */
const RowActions = ({ children }) => (
  <div className="flex items-center justify-end gap-1.5">{children}</div>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
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
  const [selectedStreams, setSelectedStreams] = useState([]);
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    { id: 'users', label: 'Users', icon: UsersIcon, badge: stats.users?.total },
    { id: 'import-students', label: 'Import Students', icon: ArrowUpTrayIcon },
    { id: 'tpos', label: 'TPOs', icon: AcademicCapIcon },
    { id: 'universities', label: 'Universities', icon: BuildingOfficeIcon },
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
      toast.error('Failed to load statistics');
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
      toast.error('Failed to load analytics');
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
      toast.error('Failed to load users');
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
      toast.error('Failed to load TPOs');
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
      toast.error('Failed to load universities');
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
      toast.error('Failed to load companies');
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
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load schools';
      toast.error(errorMessage);
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
      toast.error('Failed to load recruiters');
      setRecruiters([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInstitutions = async () => {
    try {
      const [uniRes, schoolRes, collegeRes] = await Promise.all([
        adminService.getAllUniversities({ limit: 500 }),
        adminService.getAllSchools({ limit: 500 }),
        adminService.getAllColleges({ limit: 500 })
      ]);
      const list = [
        ...(uniRes.universities || []).map((o) => ({ id: o.id, name: o.name, type: 'university', region: o.region, state: o.state, city: o.city })),
        ...(schoolRes.schools || []).map((o) => ({ id: o.id, name: o.name, type: 'school', region: o.region, state: o.state, city: o.city })),
        ...(collegeRes.colleges || []).map((o) => ({ id: o.id, name: o.name, type: 'college', region: o.region, state: o.state, city: o.city }))
      ].sort((a, b) => a.name.localeCompare(b.name));
      setInstitutions(list);
    } catch (error) {
      toast.error('Failed to load institutions');
      setInstitutions([]);
    }
  };

  // User management handlers
  const handleCreateUser = () => {
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

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        await adminService.updateUser(selectedUser.id, userFormData);
        toast.success('User updated successfully');
      } else {
        await adminService.createUser(userFormData);
        toast.success('User created successfully');
      }
      setShowUserModal(false);
      fetchUsers();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminService.deleteUser(userId);
      toast.success('User deactivated successfully');
      fetchUsers();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // TPO management handlers
  const handleCreateTPO = () => {
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

  const handleSaveTPO = async (e) => {
    e.preventDefault();
    try {
      if (selectedTPO) {
        await adminService.updateTPO(selectedTPO.id, tpoFormData);
        toast.success('TPO updated successfully');
      } else {
        await adminService.createTPO(tpoFormData);
        toast.success('TPO created successfully');
      }
      setShowTPOModal(false);
      fetchTPOs();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to save TPO');
    }
  };

  const handleDeleteTPO = async (tpoId) => {
    try {
      await adminService.deleteTPO(tpoId);
      toast.success('TPO deleted successfully');
      fetchTPOs();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to delete TPO');
    }
  };

  // University management handlers
  const handleCreateUniversity = () => {
    setSelectedUniversity(null);
    setUniversityFormData({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: ''
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
    setSelectedUniversity(university);
    setUniversityFormData({
      name: university.name,
      domain: university.domain,
      contactEmail: university.contactEmail,
      contactPhone: university.contactPhone || '',
      website: university.website || '',
      address: university.address || ''
    });
    setShowUniversityModal(true);
  };

  const handleSaveUniversity = async (e) => {
    e.preventDefault();
    try {
      if (selectedUniversity) {
        await adminService.updateOrganization(selectedUniversity.id, {
          ...universityFormData,
          type: 'university'
        });
        toast.success('University updated successfully');
      } else {
        await adminService.createOrganization({
          ...universityFormData,
          type: 'university'
        });
        toast.success('University created successfully');
      }
      setShowUniversityModal(false);
      fetchUniversities();
      fetchOrganizations();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to save university');
    }
  };

  const handleDeleteUniversity = async (universityId) => {
    try {
      await adminService.deleteOrganization(universityId);
      toast.success('University deleted successfully');
      fetchUniversities();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to delete university');
    }
  };

  const handleVerifyUniversity = async (universityId, isVerified) => {
    try {
      await adminService.verifyOrganization(universityId, isVerified);
      toast.success(`University ${isVerified ? 'verified' : 'unverified'} successfully`);
      fetchUniversities();
    } catch (error) {
      toast.error(error.message || 'Failed to update verification');
    }
  };

  // Company management handlers
  const handleCreateCompany = () => {
    setSelectedCompany(null);
    setCompanyFormData({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: ''
    });
    setApprovalInfoType('company');
    setShowApprovalInfo(true);
    // Show modal after user acknowledges approval info
  };

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setCompanyFormData({
      name: company.name,
      domain: company.domain,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone || '',
      website: company.website || '',
      address: company.address || ''
    });
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      if (selectedCompany) {
        await adminService.updateOrganization(selectedCompany.id, {
          ...companyFormData,
          type: 'company'
        });
        toast.success('Company updated successfully');
      } else {
        await adminService.createOrganization({
          ...companyFormData,
          type: 'company'
        });
        toast.success('Company created successfully');
      }
      setShowCompanyModal(false);
      fetchCompanies();
      fetchOrganizations();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to save company');
    }
  };

  const handleDeleteCompany = async (companyId) => {
    try {
      await adminService.deleteOrganization(companyId);
      toast.success('Company deleted successfully');
      fetchCompanies();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to delete company');
    }
  };

  const handleVerifyCompany = async (companyId, isVerified) => {
    try {
      await adminService.verifyOrganization(companyId, isVerified);
      toast.success(`Company ${isVerified ? 'verified' : 'unverified'} successfully`);
      fetchCompanies();
    } catch (error) {
      toast.error(error.message || 'Failed to update verification');
    }
  };

  // School management handlers
  const handleCreateSchool = () => {
    setSelectedSchool(null);
    setSchoolFormData({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: ''
    });
    setApprovalInfoType('school');
    setShowApprovalInfo(true);
  };

  const handleEditSchool = (school) => {
    setSelectedSchool(school);
    setSchoolFormData({
      name: school.name,
      domain: school.domain,
      contactEmail: school.contactEmail,
      contactPhone: school.contactPhone || '',
      website: school.website || '',
      address: school.address || ''
    });
    setShowSchoolModal(true);
  };

  const handleSaveSchool = async (e) => {
    e.preventDefault();
    try {
      if (selectedSchool) {
        await adminService.updateOrganization(selectedSchool.id, {
          ...schoolFormData,
          type: 'school'
        });
        toast.success('School updated successfully');
      } else {
        await adminService.createOrganization({
          ...schoolFormData,
          type: 'school'
        });
        toast.success('School created successfully');
      }
      setShowSchoolModal(false);
      fetchSchools();
      fetchOrganizations();
      fetchOverviewStats();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save school';
      toast.error(errorMessage);
    }
  };

  const handleDeleteSchool = async (schoolId) => {
    try {
      await adminService.deleteOrganization(schoolId);
      toast.success('School deleted successfully');
      fetchSchools();
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to delete school');
    }
  };

  const handleVerifySchool = async (schoolId, isVerified) => {
    try {
      await adminService.verifyOrganization(schoolId, isVerified);
      toast.success(`School ${isVerified ? 'verified' : 'unverified'} successfully`);
      fetchSchools();
    } catch (error) {
      toast.error(error.message || 'Failed to update verification');
    }
  };

  const handleApproveOrganization = async (organizationId, type) => {
    try {
      await adminService.verifyOrganization(organizationId, true);
      const typeLabel = type === 'university' ? 'University' : type === 'company' ? 'Company' : 'School';
      toast.success(`${typeLabel} approved successfully`);
      if (type === 'university') {
        fetchUniversities();
      } else if (type === 'company') {
        fetchCompanies();
      } else if (type === 'school') {
        fetchSchools();
      }
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to approve organization');
    }
  };

  const handleRejectOrganization = async (organizationId, type) => {
    try {
      await adminService.updateOrganization(organizationId, {
        approvalStatus: 'rejected'
      });
      const typeLabel = type === 'university' ? 'University' : type === 'company' ? 'Company' : 'School';
      toast.success(`${typeLabel} rejected successfully`);
      if (type === 'university') {
        fetchUniversities();
      } else if (type === 'company') {
        fetchCompanies();
      } else if (type === 'school') {
        fetchSchools();
      }
      fetchOverviewStats();
    } catch (error) {
      toast.error(error.message || 'Failed to reject organization');
    }
  };

  // Recruiter permissions handlers
  const handleOpenPermissions = async (recruiter) => {
    setSelectedRecruiter(recruiter);
    setSelectedOrgIds([]);
    setSelectedYears([]);
    setSelectedStreams([]);
    setSelectedRegions([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setShowPermissionsModal(true);
    setPermissionsLoading(true);
    try {
      const data = await adminService.getRecruiterPermissions(recruiter.id);
      setSelectedOrgIds(data.allowedOrganizationIds || []);
      setSelectedYears(Array.isArray(data.allowedYears) ? data.allowedYears.map((y) => Number(y)) : []);
      setSelectedStreams(Array.isArray(data.allowedStreams) ? [...data.allowedStreams] : []);
      setSelectedRegions(Array.isArray(data.allowedRegions) ? [...data.allowedRegions] : []);
      setSelectedStates(Array.isArray(data.allowedStates) ? [...data.allowedStates] : []);
      setSelectedCities(Array.isArray(data.allowedCities) ? [...data.allowedCities] : []);
    } catch (err) {
      toast.error('Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  };

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

  const handleStreamInput = (e) => {
    const raw = e.target.value || '';
    const list = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    setSelectedStreams(list);
  };

  const handleSaveRecruiterPermissions = async (e) => {
    e.preventDefault();
    if (!selectedRecruiter) return;
    try {
      setPermissionsSaving(true);
      await adminService.setRecruiterAllowedOrganizations(selectedRecruiter.id, {
        organizationIds: selectedOrgIds,
        allowedYears: selectedYears,
        allowedStreams: selectedStreams,
        allowedRegions: selectedRegions,
        allowedStates: selectedStates,
        allowedCities: selectedCities
      });
      toast.success('Recruiter permissions updated');
      setShowPermissionsModal(false);
      setSelectedRecruiter(null);
      setSelectedOrgIds([]);
      setSelectedYears([]);
      setSelectedStreams([]);
      setSelectedRegions([]);
      setSelectedStates([]);
      setSelectedCities([]);
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to update permissions';
      toast.error(msg);
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
      toast.error('Choose an Excel file and an organization.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await adminService.importStudentsExcel(
        importFile,
        parseInt(importOrganizationId, 10)
      );
      setImportResult(res);
      toast.success(
        `Import finished: ${res.summary?.created ?? 0} created, ${res.summary?.skipped ?? 0} skipped, ${res.summary?.errors ?? 0} errors.`
      );
      setImportFile(null);
      const input = document.getElementById('import-file-input');
      if (input) input.value = '';
    } catch (err) {
      toast.error(err?.message || 'Import failed');
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          subtitle="Universities, schools and companies"
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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Users by role">
          {stats.users?.byRole?.length ? (
            <div className="divide-y divide-ink-950/10">
              {stats.users.byRole.map((row) => (
                <MeterRow
                  key={row.role}
                  label={row.role.replace(/_/g, ' ')}
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
                  label={row.status}
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
        render: (value) => <StatusBadge status={value} />
      }
    ];

    const hasFilters = Boolean(
      usersFilters.role || usersFilters.organizationType || usersFilters.search
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
              <Button type="submit" form="admin-user-form">
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
                onChange={(e) =>
                  setUserFormData((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
              <Input
                label="Last name"
                required
                value={userFormData.lastName || ''}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              value={userFormData.email || ''}
              onChange={(e) => setUserFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
            {!selectedUser && (
              <Input
                label="Password"
                type="password"
                required
                value={userFormData.password || ''}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, password: e.target.value }))}
              />
            )}
            <Select
              label="Role"
              required
              value={userFormData.role || 'student'}
              onChange={(e) => setUserFormData((prev) => ({ ...prev, role: e.target.value }))}
              options={[
                { value: 'student', label: 'Student' },
                { value: 'recruiter', label: 'Recruiter' },
                { value: 'tpo', label: 'TPO' },
                { value: 'admin', label: 'Admin' }
              ]}
            />
            {userFormData.role !== 'admin' && (
              <Select
                label="Organization"
                required
                value={userFormData.organizationId || ''}
                onChange={(e) =>
                  setUserFormData((prev) => ({ ...prev, organizationId: e.target.value }))
                }
                options={[
                  { value: '', label: 'Select organization' },
                  ...organizations
                    .filter((org) => {
                      if (userFormData.role === 'student') {
                        return org.type === 'university' || org.type === 'school' || org.type === 'college';
                      }
                      if (userFormData.role === 'tpo') return org.type === 'university';
                      if (userFormData.role === 'recruiter') return org.type === 'company';
                      return true;
                    })
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
      { key: 'organization', label: 'University', render: (_, row) => row.organization?.name || '—' },
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
          emptyDescription="Create one to give a university a placement officer."
          actions={(row) => (
            <RowActions>
              <IconButton
                size="sm"
                icon={PencilSquareIcon}
                label={`Edit ${row.firstName} ${row.lastName}`}
                onClick={() => handleEditTPO(row)}
              />
              <IconButton
                size="sm"
                variant="danger"
                icon={TrashIcon}
                label={`Delete ${row.firstName} ${row.lastName}`}
                onClick={() =>
                  askToConfirm({
                    title: 'Delete this TPO?',
                    description: `${row.firstName} ${row.lastName} (${row.email}) will lose access immediately.`,
                    confirmLabel: 'Delete',
                    run: () => handleDeleteTPO(row.id)
                  })
                }
              />
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
              <Button type="submit" form="admin-tpo-form">
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
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, firstName: e.target.value }))}
              />
              <Input
                label="Last name"
                required
                value={tpoFormData.lastName || ''}
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              value={tpoFormData.email || ''}
              onChange={(e) => setTpoFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
            {!selectedTPO && (
              <Input
                label="Password"
                type="password"
                required
                value={tpoFormData.password || ''}
                onChange={(e) => setTpoFormData((prev) => ({ ...prev, password: e.target.value }))}
              />
            )}
            <Select
              label="University"
              required
              value={tpoFormData.organizationId || ''}
              onChange={(e) =>
                setTpoFormData((prev) => ({ ...prev, organizationId: e.target.value }))
              }
              options={[
                { value: '', label: 'Select university' },
                ...organizations
                  .filter((org) => org.type === 'university')
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
    const columns = [
      { key: 'name', label: 'Name', sortable: true },
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
            New {type}
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          emptyTitle={`No ${heading.toLowerCase()} yet`}
          emptyDescription={`Create the first ${type} to get started.`}
          actions={(row) => (
            <RowActions>
              {row.approvalStatus === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleApproveOrganization(row.id, type)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      askToConfirm({
                        title: `Reject ${row.name}?`,
                        description: `This ${type} will be marked rejected and its users will not be able to sign in.`,
                        confirmLabel: 'Reject',
                        run: () => handleRejectOrganization(row.id, type)
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
                label={`${row.isVerified ? 'Unverify' : 'Verify'} ${row.name}`}
                onClick={() => onVerify(row.id, !row.isVerified)}
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
                label={`Delete ${row.name}`}
                onClick={() =>
                  askToConfirm({
                    title: `Delete ${row.name}?`,
                    description: `This removes the ${type} from the platform. Accounts attached to it lose their organization.`,
                    confirmLabel: 'Delete',
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
          title={`${selected ? 'Edit' : 'New'} ${type}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={onModalClose}>
                Cancel
              </Button>
              <Button type="submit" form={`admin-${type}-form`}>
                {selected ? 'Save changes' : `Create ${type}`}
              </Button>
            </>
          }
        >
          <form id={`admin-${type}-form`} onSubmit={onSubmit}>
            <OrganizationFormFields value={formData} onChange={setFormData} noun={type} />
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
        <h2 className="font-display text-lg font-bold text-ink-950">Import students from Excel</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Upload an <strong>.xlsx</strong> or <strong>.xls</strong> file whose first row is the
          header. <strong>Email</strong> is required; First Name, Last Name, Phone, Student ID,
          Course, Branch, Year, Graduation Year, Gender, CGPA, Percentage and Date of Birth are
          optional.
        </p>
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
            Excel file
          </label>
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx,.xls"
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
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-india-800">Created</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.created) || 0}
              </p>
            </div>
            <div className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-saffron-800">Skipped</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.skipped) || 0}
              </p>
            </div>
            <div className="rounded-xl border border-red-600/25 bg-red-50 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-red-800">Errors</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink-950">
                {Number(importResult.summary?.errors) || 0}
              </p>
            </div>
          </div>

          {Number(importResult.summary?.skipped) > 0 && (
            <div className="rounded-xl border border-saffron-500/40 bg-saffron-50 px-4 py-3">
              <p className="text-sm font-semibold text-saffron-800">Why were rows skipped?</p>
              {/* The previous copy asserted "your 140 rows were skipped" — a
                  number that came from nowhere. Only the response's own
                  examples are shown now. */}
              <p className="mt-1 text-sm text-ink-700">
                A row is skipped when an account with that email already exists. No new account was
                created for it.
              </p>
              {importResult.skipped?.length > 0 && (
                <p className="mt-2 text-sm text-ink-600">
                  For example: {importResult.skipped.slice(0, 3).map((s) => s.email).join(', ')}
                </p>
              )}
            </div>
          )}

          {importResult.errors?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-800">
                Errors (first {Math.min(10, importResult.errors.length)})
              </p>
              <ul className="mt-1.5 list-inside list-disc text-sm text-red-700">
                {importResult.errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
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
      setSelectedStreams([]);
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
          <Table>
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
                            <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                              {type}s
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
                    value={selectedStreams.join(', ')}
                    onChange={handleStreamInput}
                    placeholder="e.g. CSE, ECE, Mechanical"
                    help="Comma- or space-separated. Leave empty for all streams."
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
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'import-students' && renderImportStudentsTab()}
      {activeTab === 'tpos' && renderTPOsTab()}
      {activeTab === 'universities' &&
        renderOrganizationTab({
          type: 'university',
          heading: 'Universities',
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

      {/* New organizations land in `pending`; this says so before the form. */}
      <AdminModal
        isOpen={showApprovalInfo}
        onClose={() => setShowApprovalInfo(false)}
        title={`New ${approvalInfoType} needs approval`}
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
              The {approvalInfoType} is created with <strong>pending</strong> approval status.
            </li>
            <li>Nobody can register against it until an admin approves it.</li>
            <li>You can approve it from this tab straight after creating it.</li>
          </ul>
        </div>
      </AdminModal>

      <Modal
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
        <p className="text-sm text-ink-700">This cannot be undone from here.</p>
      </Modal>
    </PageShell>
  );
};

export default AdminDashboard;
