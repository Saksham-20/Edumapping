// client/src/pages/dashboard/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import statisticsService from '../../services/statistics';
import adminService from '../../services/adminService';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import TabNavigation from '../../components/admin/TabNavigation';
import StatCard from '../../components/admin/StatCard';
import ChartCard from '../../components/admin/ChartCard';
import AdminModal from '../../components/admin/AdminModal';
import DataTable from '../../components/admin/DataTable';
import LineChart from '../../components/admin/LineChart';
import BarChart from '../../components/admin/BarChart';
import PieChart from '../../components/admin/PieChart';
import {
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { preparePieChartData, prepareLineChartData, prepareBarChartData } from '../../utils/chartUtils';

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
      console.error('Failed to fetch admin stats:', error);
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
      console.error('Failed to fetch advanced analytics:', error);
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
      console.error('Failed to fetch top performers:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/organizations?limit=1000');
      setOrganizations(response.organizations || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
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
      console.error('Failed to fetch users:', error);
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
      console.error('Failed to fetch TPOs:', error);
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
      console.error('Failed to fetch universities:', error);
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
      console.error('Failed to fetch companies:', error);
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
      console.error('Failed to fetch schools:', error);
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
      console.error('Failed to fetch recruiters:', error);
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
      console.error('Failed to fetch institutions:', error);
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
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
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
    if (!window.confirm('Are you sure you want to delete this TPO?')) return;
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
    if (!window.confirm('Are you sure you want to delete this university?')) return;
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
    if (!window.confirm('Are you sure you want to delete this company?')) return;
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
      console.error('Failed to save school:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save school';
      toast.error(errorMessage);
    }
  };

  const handleDeleteSchool = async (schoolId) => {
    if (!window.confirm('Are you sure you want to delete this school?')) return;
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
    if (!window.confirm(`Are you sure you want to reject this ${type}?`)) return;
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

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-100',
      closed: 'text-red-600 bg-red-100',
      draft: 'text-yellow-600 bg-yellow-100',
      pending: 'text-blue-600 bg-blue-100',
      approved: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
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
      console.error('Failed to load recruiter permissions:', err);
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

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading && activeTab === 'overview') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Render Overview Tab
  const renderOverviewTab = () => (
    <>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Users"
          value={stats.users?.total || 0}
          subtitle={`+${stats.users?.recentRegistrations || 0} this month`}
          icon={UsersIcon}
          color="blue"
        />
        <StatCard
          title="Organizations"
          value={stats.organizations?.total || 0}
          subtitle="Universities & Companies"
          icon={BuildingOfficeIcon}
          color="green"
        />
        <StatCard
          title="Total Jobs"
          value={stats.jobs?.total || 0}
          subtitle={`+${stats.jobs?.recentPostings || 0} this week`}
          icon={BriefcaseIcon}
          color="purple"
        />
        <StatCard
          title="Applications"
          value={stats.applications?.total || 0}
          subtitle="Total submissions"
          icon={DocumentTextIcon}
          color="orange"
        />
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <ChartCard title="User Distribution">
              <div className="space-y-4">
            {stats.users?.byRole?.map((roleStat) => (
                  <div key={roleStat.role} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {roleStat.role}
                    </span>
                    <div className="flex items-center">
                      <span className="text-lg font-semibold text-gray-900 mr-3">
                        {roleStat.count}
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${(roleStat.count / stats.users.total) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        </ChartCard>

        <ChartCard title="Job Status Distribution">
              <div className="space-y-4">
            {stats.jobs?.byStatus?.map((jobStat) => {
              const IconComponent = jobStat.status === 'active' ? CheckCircleIcon : 
                                   jobStat.status === 'closed' ? XCircleIcon : ExclamationTriangleIcon;
                  return (
                    <div key={jobStat.status} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <IconComponent className={`h-4 w-4 mr-2 ${getStatusColor(jobStat.status).split(' ')[0]}`} />
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {jobStat.status}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-lg font-semibold text-gray-900 mr-3">
                          {jobStat.count}
                        </span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ 
                              width: `${(jobStat.count / stats.jobs.total) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
        </ChartCard>
        </div>

      <ChartCard title="Recent Activity (Last 7 Days)">
            {stats.recentActivity?.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.student?.firstName} {activity.student?.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Applied to {activity.job?.title} at {activity.job?.organization?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Applications and activities will appear here.
                </p>
              </div>
            )}
      </ChartCard>
    </>
  );

  // Render Analytics Tab
  const renderAnalyticsTab = () => {
    if (isLoading || !analytics) {
      return <LoadingSpinner size="large" />;
    }

    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={analyticsPeriod}
              onChange={(e) => {
                setAnalyticsPeriod(e.target.value);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartCard title="User Growth Over Time">
            {analytics.userGrowth && analytics.userGrowth.length > 0 ? (
              <LineChart
                data={prepareLineChartData(analytics.userGrowth, 'date', ['total'])}
                xKey="date"
                yKeys={[{ key: 'total', name: 'New Users', color: '#3B82F6' }]}
              />
            ) : (
              <p className="text-center text-gray-500 py-8">No data available</p>
            )}
          </ChartCard>

          <ChartCard title="Job Posting Trends">
            {analytics.jobTrends?.daily && analytics.jobTrends.daily.length > 0 ? (
              <LineChart
                data={prepareLineChartData(analytics.jobTrends.daily, 'date', ['total'])}
                xKey="date"
                yKeys={[{ key: 'total', name: 'Jobs Posted', color: '#8B5CF6' }]}
              />
            ) : (
              <p className="text-center text-gray-500 py-8">No data available</p>
            )}
          </ChartCard>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartCard title="Application Funnel">
            {analytics.applicationTrends?.funnel ? (
              <BarChart
                data={Object.entries(analytics.applicationTrends.funnel).map(([key, value]) => ({
                  name: key,
                  value
                }))}
                xKey="name"
                yKeys={[{ key: 'value', name: 'Applications', color: '#10B981' }]}
              />
            ) : (
              <p className="text-center text-gray-500 py-8">No data available</p>
            )}
          </ChartCard>

          <ChartCard title="Placement Rate Trends">
            {analytics.placementTrends?.daily && analytics.placementTrends.daily.length > 0 ? (
              <LineChart
                data={prepareLineChartData(analytics.placementTrends.daily, 'date', ['placed'])}
                xKey="date"
                yKeys={[{ key: 'placed', name: 'Placed Students', color: '#10B981' }]}
              />
            ) : (
              <p className="text-center text-gray-500 py-8">No data available</p>
            )}
          </ChartCard>
        </div>

        {topPerformers && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ChartCard title="Top Universities">
              {topPerformers.universities && topPerformers.universities.length > 0 ? (
                <div className="space-y-2">
                  {topPerformers.universities.slice(0, 5).map((uni, index) => (
                    <div key={uni.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">
                        {index + 1}. {uni.name}
                      </span>
                      <span className="text-sm text-gray-600">{uni.placements} placements</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No data available</p>
              )}
            </ChartCard>

            <ChartCard title="Top Companies">
              {topPerformers.companies && topPerformers.companies.length > 0 ? (
                <div className="space-y-2">
                  {topPerformers.companies.slice(0, 5).map((company, index) => (
                    <div key={company.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">
                        {index + 1}. {company.name}
                      </span>
                      <span className="text-sm text-gray-600">{company.jobs} jobs</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No data available</p>
              )}
            </ChartCard>

            <ChartCard title="Top Students">
              {topPerformers.students && topPerformers.students.length > 0 ? (
                <div className="space-y-2">
                  {topPerformers.students.slice(0, 5).map((student, index) => (
                    <div key={student.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {index + 1}. {student.name}
                        </span>
                        <p className="text-xs text-gray-500">CGPA: {student.cgpa}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No data available</p>
              )}
            </ChartCard>
          </div>
        )}
      </>
    );
  };

  // Render Users Tab
  const renderUsersTab = () => {
    const userColumns = [
      { key: 'firstName', label: 'Name', sortable: true, render: (_, row) => `${row.firstName} ${row.lastName}` },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'role', label: 'Role', sortable: true, render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'admin' ? 'bg-red-100 text-red-800' :
          value === 'tpo' ? 'bg-blue-100 text-blue-800' :
          value === 'recruiter' ? 'bg-purple-100 text-purple-800' :
          'bg-green-100 text-green-800'
        }`}>
          {value}
        </span>
      )},
      { key: 'organization', label: 'Organization', render: (_, row) => (
        <div>
          <div className="font-medium">{row.organization?.name || 'N/A'}</div>
          {row.organization?.type && (
            <div className="text-xs text-gray-500 capitalize">{row.organization.type}</div>
          )}
        </div>
      )},
      { key: 'approvalStatus', label: 'Status', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      )}
    ];

    return (
      <>
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={usersFilters.search}
                  onChange={(e) => {
                    setUsersFilters(prev => ({ ...prev, search: e.target.value }));
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCreateUser}
              className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create User
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">Role:</label>
              <select
                value={usersFilters.role}
                onChange={(e) => {
                  setUsersFilters(prev => ({ ...prev, role: e.target.value }));
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="tpo">TPOs</option>
                <option value="recruiter">Recruiters</option>
                <option value="admin">Admins</option>
                <option value="principal">Principals</option>
                <option value="teacher">Teachers</option>
                <option value="school_admin">School Admins</option>
                <option value="career_counselor">Career Counselors</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Organization:</label>
              <select
                value={usersFilters.organizationType}
                onChange={(e) => {
                  setUsersFilters(prev => ({ ...prev, organizationType: e.target.value }));
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Organizations</option>
                <option value="university">Universities</option>
                <option value="company">Companies</option>
                <option value="school">Schools</option>
              </select>
            </div>
            {(usersFilters.role || usersFilters.organizationType || usersFilters.search) && (
              <button
                onClick={() => {
                  setUsersFilters({
                    search: '',
                    role: '',
                    approvalStatus: '',
                    organizationId: '',
                    organizationType: ''
                  });
                }}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={userColumns}
          data={users}
          actions={(row) => (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditUser(row);
                }}
                className="text-blue-600 hover:text-blue-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteUser(row.id);
                }}
                className="text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          pagination={usersPagination}
          onPageChange={fetchUsers}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title={selectedUser ? 'Edit User' : 'Create User'}
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  required
                  value={userFormData.firstName}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
                  </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  required
                  value={userFormData.lastName}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={userFormData.email}
                onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            {!selectedUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  value={userFormData.password}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                required
                value={userFormData.role}
                onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="student">Student</option>
                <option value="recruiter">Recruiter</option>
                <option value="tpo">TPO</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {userFormData.role !== 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization</label>
                <select
                  required
                  value={userFormData.organizationId}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, organizationId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select organization</option>
                  {organizations
                    .filter(org => {
                      if (userFormData.role === 'student') {
                        return org.type === 'university' || org.type === 'school';
                      } else if (userFormData.role === 'tpo') {
                        return org.type === 'university';
                      } else if (userFormData.role === 'recruiter') {
                        return org.type === 'company';
                      } else if (userFormData.role === 'principal' || userFormData.role === 'teacher' || 
                                 userFormData.role === 'school_admin' || userFormData.role === 'career_counselor') {
                        return org.type === 'school';
                      }
                      return true;
                    })
                    .map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                </select>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {selectedUser ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  // Render TPOs Tab
  const renderTPOsTab = () => {
    const tpoColumns = [
      { key: 'firstName', label: 'Name', sortable: true, render: (_, row) => `${row.firstName} ${row.lastName}` },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'organization', label: 'University', render: (_, row) => row.organization?.name || 'N/A' },
      { key: 'isActive', label: 'Status', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )}
    ];

    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Training & Placement Officers</h3>
          <button
            onClick={handleCreateTPO}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create TPO
          </button>
        </div>

        <DataTable
          columns={tpoColumns}
          data={tpos}
          actions={(row) => (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditTPO(row);
                }}
                className="text-blue-600 hover:text-blue-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTPO(row.id);
                }}
                className="text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          pagination={tposPagination}
          onPageChange={fetchTPOs}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showTPOModal}
          onClose={() => setShowTPOModal(false)}
          title={selectedTPO ? 'Edit TPO' : 'Create TPO'}
        >
          <form onSubmit={handleSaveTPO} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  required
                  value={tpoFormData.firstName}
                  onChange={(e) => setTpoFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
                  </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  required
                  value={tpoFormData.lastName}
                  onChange={(e) => setTpoFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={tpoFormData.email}
                onChange={(e) => setTpoFormData(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            {!selectedTPO && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  value={tpoFormData.password}
                  onChange={(e) => setTpoFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">University</label>
              <select
                required
                value={tpoFormData.organizationId}
                onChange={(e) => setTpoFormData(prev => ({ ...prev, organizationId: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select university</option>
                {organizations
                  .filter(org => org.type === 'university')
                  .map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowTPOModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {selectedTPO ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  // Render Universities Tab
  const renderUniversitiesTab = () => {
    const universityColumns = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'domain', label: 'Domain', sortable: true },
      { key: 'students', label: 'Students', render: (_, row) => (row.stats?.students ?? 0) || 0 },
      { key: 'tpos', label: 'TPOs', render: (_, row) => (row.stats?.tpos ?? 0) || 0 },
      { key: 'approvalStatus', label: 'Approval Status', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value || 'pending'}
        </span>
      )},
      { key: 'isVerified', label: 'Verified', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      )}
    ];

    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Universities</h3>
          <button
            onClick={handleCreateUniversity}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create University
          </button>
        </div>

        <DataTable
          columns={universityColumns}
          data={universities}
          actions={(row) => (
            <div className="flex items-center space-x-2">
              {row.approvalStatus === 'pending' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveOrganization(row.id, 'university');
                    }}
                    className="text-sm px-2 py-1 rounded text-green-600 hover:bg-green-50 font-medium"
                    title="Approve"
                  >
                    Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRejectOrganization(row.id, 'university');
                    }}
                    className="text-sm px-2 py-1 rounded text-red-600 hover:bg-red-50 font-medium"
                    title="Reject"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerifyUniversity(row.id, !row.isVerified);
                }}
                className={`text-sm px-2 py-1 rounded ${
                  row.isVerified ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {row.isVerified ? 'Unverify' : 'Verify'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditUniversity(row);
                }}
                className="text-blue-600 hover:text-blue-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteUniversity(row.id);
                }}
                className="text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          pagination={universitiesPagination}
          onPageChange={fetchUniversities}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showUniversityModal}
          onClose={() => setShowUniversityModal(false)}
          title={selectedUniversity ? 'Edit University' : 'Create University'}
        >
          <form onSubmit={handleSaveUniversity} className="space-y-4">
                  <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={universityFormData.name}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
                  </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="email"
                required
                placeholder="example@university.edu"
                value={universityFormData.domain}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, domain: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
                </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Email</label>
              <input
                type="email"
                required
                value={universityFormData.contactEmail}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
              <input
                type="text"
                value={universityFormData.contactPhone}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
          </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                value={universityFormData.website}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
        </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                value={universityFormData.address}
                onChange={(e) => setUniversityFormData(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
      </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUniversityModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {selectedUniversity ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  // Render Schools Tab
  const renderSchoolsTab = () => {
    const schoolColumns = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'domain', label: 'Domain', sortable: true },
      { key: 'students', label: 'Students', render: (_, row) => (row.stats?.students ?? 0) || 0 },
      { key: 'approvalStatus', label: 'Approval Status', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value || 'pending'}
        </span>
      )},
      { key: 'isVerified', label: 'Verified', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      )}
    ];

    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Schools</h3>
          <button
            onClick={handleCreateSchool}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create School
          </button>
        </div>

        <DataTable
          columns={schoolColumns}
          data={schools}
          actions={(row) => (
            <div className="flex items-center space-x-2">
              {row.approvalStatus === 'pending' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveOrganization(row.id, 'school');
                    }}
                    className="text-sm px-2 py-1 rounded text-green-600 hover:bg-green-50 font-medium"
                    title="Approve"
                  >
                    Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRejectOrganization(row.id, 'school');
                    }}
                    className="text-sm px-2 py-1 rounded text-red-600 hover:bg-red-50 font-medium"
                    title="Reject"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerifySchool(row.id, !row.isVerified);
                }}
                className={`text-sm px-2 py-1 rounded ${
                  row.isVerified ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {row.isVerified ? 'Unverify' : 'Verify'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditSchool(row);
                }}
                className="text-blue-600 hover:text-blue-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSchool(row.id);
                }}
                className="text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          pagination={schoolsPagination}
          onPageChange={fetchSchools}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showSchoolModal}
          onClose={() => setShowSchoolModal(false)}
          title={selectedSchool ? 'Edit School' : 'Create School'}
        >
          <form onSubmit={handleSaveSchool} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={schoolFormData.name}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="email"
                required
                placeholder="admin@school.edu.in"
                value={schoolFormData.domain}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, domain: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Email</label>
              <input
                type="email"
                required
                value={schoolFormData.contactEmail}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
              <input
                type="text"
                value={schoolFormData.contactPhone}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                value={schoolFormData.website}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                value={schoolFormData.address}
                onChange={(e) => setSchoolFormData(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowSchoolModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {selectedSchool ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  // Import Students tab (Admin only) – upload Excel and select organization
  const studentOrgs = organizations.filter(o => o.type === 'university' || o.type === 'college' || o.type === 'school');

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile || !importOrganizationId) {
      toast.error('Please select an Excel file and an organization.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await adminService.importStudentsExcel(importFile, parseInt(importOrganizationId, 10));
      setImportResult(res);
      toast.success(`Import completed: ${res.summary?.created ?? 0} created, ${res.summary?.skipped ?? 0} skipped, ${res.summary?.errors ?? 0} errors.`);
      setImportFile(null);
      if (document.getElementById('import-file-input')) document.getElementById('import-file-input').value = '';
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Import failed';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const renderImportStudentsTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Import students from Excel</h3>
          <p className="mt-1 text-sm text-gray-600">
            Upload an Excel file (.xlsx or .xls). First row must be headers. Required column: <strong>Email</strong>. Optional: First Name, Last Name, Phone, Student ID, Course, Branch, Year, Graduation Year, Gender, CGPA, Percentage, Date of Birth.
          </p>
        </div>

        <form onSubmit={handleImportSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-2xl">
          <div>
            <label htmlFor="import-org" className="block text-sm font-medium text-gray-700">Organization (University / College / School)</label>
            <select
              id="import-org"
              value={importOrganizationId}
              onChange={(e) => setImportOrganizationId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Select organization</option>
              {studentOrgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Excel file</label>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={importing || !importFile || !importOrganizationId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <LoadingSpinner size="small" className="mr-2 inline" /> : <ArrowUpTrayIcon className="w-4 h-4 mr-2" />}
            {importing ? 'Importing…' : 'Import students'}
          </button>
        </form>

        {importResult && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h4 className="font-medium text-gray-900">Import result</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-green-50 rounded p-3"><span className="font-medium text-green-800">Created:</span> {Number(importResult.summary?.created) || 0}</div>
              <div className="bg-amber-50 rounded p-3"><span className="font-medium text-amber-800">Skipped:</span> {Number(importResult.summary?.skipped) || 0}</div>
              <div className="bg-red-50 rounded p-3"><span className="font-medium text-red-800">Errors:</span> {Number(importResult.summary?.errors) || 0}</div>
            </div>
            {Number(importResult.summary?.skipped) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-sm font-medium text-amber-800 mb-1">Why skipped?</p>
                <p className="text-sm text-amber-700">
                  Rows are skipped when a student with that <strong>email</strong> already exists. Your 140 rows were skipped because those emails are already in the database (e.g. from a previous import). No new accounts were created.
                </p>
                {(importResult.skipped?.length > 0) && (
                  <p className="text-sm text-amber-700 mt-2">Example: {importResult.skipped.slice(0, 3).map(s => s.email).join(', ')}…</p>
                )}
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Error details (first 10):</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {(importResult.errors.slice(0, 10)).map((err, idx) => (
                    <li key={idx}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Recruiter permissions tab
  const renderRecruiterPermissionsTab = () => {
    if (isLoading && recruiters.length === 0) {
      return (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      );
    }
    return (
      <>
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900">Recruiter access</h3>
          <p className="mt-1 text-sm text-gray-600">
            Choose which recruiters can see students from which institutions. Recruiters can only access students from schools, colleges, or universities you allow.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recruiters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No recruiters found.
                  </td>
                </tr>
              ) : (
                recruiters.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {r.organization?.name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        type="button"
                        onClick={() => handleOpenPermissions(r)}
                        className="inline-flex items-center px-3 py-1.5 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
                      >
                        <ShieldCheckIcon className="h-4 w-4 mr-1.5" />
                        Set permissions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminModal
          isOpen={showPermissionsModal}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedRecruiter(null);
            setSelectedOrgIds([]);
            setSelectedYears([]);
            setSelectedStreams([]);
            setSelectedRegions([]);
            setSelectedStates([]);
            setSelectedCities([]);
          }}
          title={selectedRecruiter ? `Permissions — ${selectedRecruiter.firstName} ${selectedRecruiter.lastName}` : 'Recruiter permissions'}
        >
          <form onSubmit={handleSaveRecruiterPermissions} className="space-y-4">
            {permissionsLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="medium" /></div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Allowed institutions: select schools, colleges, and universities this recruiter can view students from. Optional filters below further restrict by region/state/city and by year/stream.
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-4">
                  {['school', 'college', 'university'].map((type) => {
                    const list = institutions.filter((i) => i.type === type);
                    if (list.length === 0) return null;
                    const label = type.charAt(0).toUpperCase() + type.slice(1) + 's';
                    return (
                      <div key={type}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{label}</h4>
                        <ul className="space-y-1.5">
                          {list.map((org) => (
                            <li key={org.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`org-${org.id}`}
                                checked={selectedOrgIds.includes(org.id)}
                                onChange={() => handlePermissionsToggle(org.id)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              />
                              <label htmlFor={`org-${org.id}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                                {org.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                {institutions.length === 0 && (
                  <p className="text-sm text-gray-500">No schools, colleges, or universities in the system yet.</p>
                )}

                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Region / State / City (optional)</h4>
                  <p className="text-xs text-gray-500">If set, only students from institutions in these locations are visible.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Regions</label>
                      <div className="max-h-28 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {[...new Set(institutions.map((i) => i.region).filter(Boolean))].sort().map((r) => (
                          <label key={r} className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRegions.includes(r)}
                              onChange={() => toggleRegion(r)}
                              className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{r}</span>
                          </label>
                        ))}
                        {![...new Set(institutions.map((i) => i.region).filter(Boolean))].length && (
                          <span className="text-xs text-gray-400">No regions in data</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">States</label>
                      <div className="max-h-28 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {[...new Set(institutions.map((i) => i.state).filter(Boolean))].sort().map((s) => (
                          <label key={s} className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStates.includes(s)}
                              onChange={() => toggleState(s)}
                              className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{s}</span>
                          </label>
                        ))}
                        {![...new Set(institutions.map((i) => i.state).filter(Boolean))].length && (
                          <span className="text-xs text-gray-400">No states in data</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cities</label>
                      <div className="max-h-28 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {[...new Set(institutions.map((i) => i.city).filter(Boolean))].sort().map((c) => (
                          <label key={c} className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCities.includes(c)}
                              onChange={() => toggleCity(c)}
                              className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{c}</span>
                          </label>
                        ))}
                        {![...new Set(institutions.map((i) => i.city).filter(Boolean))].length && (
                          <span className="text-xs text-gray-400">No cities in data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-800">Year & stream (optional)</h4>
                  <p className="text-xs text-gray-500">If set, only students in these years or streams are visible.</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Years (1–6)</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6].map((y) => (
                        <label key={y} className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedYears.includes(y)}
                            onChange={() => toggleYear(y)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-1.5 text-sm text-gray-700">Year {y}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Streams (comma- or space-separated)</label>
                    <input
                      type="text"
                      value={selectedStreams.join(', ')}
                      onChange={handleStreamInput}
                      placeholder="e.g. CSE, ECE, Mechanical"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedRecruiter(null);
                  setSelectedOrgIds([]);
                  setSelectedYears([]);
                  setSelectedStreams([]);
                  setSelectedRegions([]);
                  setSelectedStates([]);
                  setSelectedCities([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={permissionsSaving || permissionsLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {permissionsSaving ? 'Saving…' : 'Save permissions'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  // Render Companies Tab
  const renderCompaniesTab = () => {
    const companyColumns = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'domain', label: 'Domain', sortable: true },
      { key: 'recruiters', label: 'Recruiters', render: (_, row) => (row.stats?.recruiters ?? 0) || 0 },
      { key: 'jobs', label: 'Jobs', render: (_, row) => (row.stats?.jobs ?? 0) || 0 },
      { key: 'approvalStatus', label: 'Approval Status', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value || 'pending'}
        </span>
      )},
      { key: 'isVerified', label: 'Verified', render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      )}
    ];

    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Companies</h3>
          <button
            onClick={handleCreateCompany}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Company
          </button>
        </div>

        <DataTable
          columns={companyColumns}
          data={companies}
          actions={(row) => (
            <div className="flex items-center space-x-2">
              {row.approvalStatus === 'pending' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveOrganization(row.id, 'company');
                    }}
                    className="text-sm px-2 py-1 rounded text-green-600 hover:bg-green-50 font-medium"
                    title="Approve"
                  >
                    Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRejectOrganization(row.id, 'company');
                    }}
                    className="text-sm px-2 py-1 rounded text-red-600 hover:bg-red-50 font-medium"
                    title="Reject"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerifyCompany(row.id, !row.isVerified);
                }}
                className={`text-sm px-2 py-1 rounded ${
                  row.isVerified ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {row.isVerified ? 'Unverify' : 'Verify'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCompany(row);
                }}
                className="text-blue-600 hover:text-blue-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCompany(row.id);
                }}
                className="text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          pagination={companiesPagination}
          onPageChange={fetchCompanies}
          loading={isLoading}
        />

        <AdminModal
          isOpen={showCompanyModal}
          onClose={() => setShowCompanyModal(false)}
          title={selectedCompany ? 'Edit Company' : 'Create Company'}
        >
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={companyFormData.name}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="email"
                required
                placeholder="example@company.com"
                value={companyFormData.domain}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, domain: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Email</label>
              <input
                type="email"
                required
                value={companyFormData.contactEmail}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
              <input
                type="text"
                value={companyFormData.contactPhone}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                value={companyFormData.website}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                value={companyFormData.address}
                onChange={(e) => setCompanyFormData(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {selectedCompany ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </AdminModal>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">System overview and comprehensive analytics</p>
        </div>

        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'import-students' && renderImportStudentsTab()}
        {activeTab === 'tpos' && renderTPOsTab()}
        {activeTab === 'universities' && renderUniversitiesTab()}
        {activeTab === 'companies' && renderCompaniesTab()}
        {activeTab === 'schools' && renderSchoolsTab()}
        {activeTab === 'recruiter-permissions' && renderRecruiterPermissionsTab()}
      </div>

      {/* Approval Info Modal */}
      <AdminModal
        isOpen={showApprovalInfo}
        onClose={() => setShowApprovalInfo(false)}
        title={`New ${approvalInfoType === 'university' ? 'University' : 'Company'} Approval Required`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Admin Approval Required
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    All new {approvalInfoType === 'university' ? 'universities' : 'companies'} require admin approval before they can be used in the system.
                  </p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>The {approvalInfoType === 'university' ? 'university' : 'company'} will be created with <strong>pending</strong> approval status</li>
                    <li>An admin must review and approve it before users can register with this organization</li>
                    <li>You can approve it immediately after creation from the {approvalInfoType === 'university' ? 'Universities' : 'Companies'} tab</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowApprovalInfo(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprovalInfoConfirm}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default AdminDashboard;
