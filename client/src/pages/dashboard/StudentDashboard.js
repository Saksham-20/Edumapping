// client/src/pages/dashboard/StudentDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  BriefcaseIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  AcademicCapIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    applications: [],
    recommendedJobs: [],
    upcomingEvents: [],
    achievements: [],
    profile: null,
    stats: {
      totalApplications: 0,
      activeApplications: 0,
      interviewsScheduled: 0,
      offers: 0,
      profileCompletion: 0,
      skillsCount: 0,
      achievementsCount: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();

    // Test: Let's also fetch profile data the same way Profile.js does
    const testProfileFetch = async () => {
      try {
        console.log('Dashboard: Testing profile fetch like Profile.js...');
        const response = await api.get('/users/profile');
        console.log('Dashboard: Test profile response:', response);
        console.log('Dashboard: Test profile.user:', response.user);
        console.log('Dashboard: Test profile.data:', response.data);

        // Test the calculation with the same data structure
        if (response.user) {
          const testCompletion = calculateProfileCompletion(response.user);
          console.log('Dashboard: Test completion with response.user:', testCompletion);
        }
      } catch (error) {
        console.error('Dashboard: Test profile fetch failed:', error);
      }
    };

    // Test server connectivity
    const testServerConnectivity = async () => {
      try {
        console.log('Dashboard: Testing server connectivity...');
        const response = await fetch('/api/health');
        console.log('Dashboard: Server health check response:', response);
      } catch (error) {
        console.error('Dashboard: Server connectivity test failed:', error);
        console.error('Dashboard: This might mean the server is not running!');
      }
    };

    testProfileFetch();
    testServerConnectivity();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      console.log('Dashboard: Starting to fetch data...');

      // Test each API call individually to see which ones fail
      try {
        const applicationsRes = await api.get('/applications?limit=10');
        console.log('Dashboard: Applications API success:', applicationsRes);
      } catch (error) {
        console.error('Dashboard: Applications API failed:', error);
      }

      try {
        const jobsRes = await api.get('/jobs/recommended?limit=6');
        console.log('Dashboard: Jobs API success:', jobsRes);
      } catch (error) {
        console.error('Dashboard: Jobs API failed:', error);
      }

      try {
        const eventsRes = await api.get('/events?upcoming=true&limit=5');
        console.log('Dashboard: Events API success:', eventsRes);
      } catch (error) {
        console.error('Dashboard: Events API failed:', error);
      }

      try {
        const statsRes = await api.get('/applications/stats');
        console.log('Dashboard: Stats API success:', statsRes);
      } catch (error) {
        console.error('Dashboard: Stats API failed:', error);
      }

      try {
        const achievementsRes = await api.get('/achievements?limit=5');
        console.log('Dashboard: Achievements API success:', achievementsRes);
      } catch (error) {
        console.error('Dashboard: Achievements API failed:', error);
      }

      try {
        const profileRes = await api.get('/users/profile');
        console.log('Dashboard: Profile API success:', profileRes);
      } catch (error) {
        console.error('Dashboard: Profile API failed:', error);
      }

      // Now try all together
      const [applicationsRes, jobsRes, eventsRes, statsRes, achievementsRes, profileRes] = await Promise.all([
        api.get('/applications?limit=10'),
        api.get('/jobs/recommended?limit=6'),
        api.get('/events?upcoming=true&limit=5'),
        api.get('/applications/stats'),
        api.get('/achievements?limit=5'),
        api.get('/users/profile') // Fetch complete profile data
      ]);

      console.log('Dashboard: Profile API response:', profileRes);

      // Use the complete profile data from the API
      let profile = profileRes.user || profileRes.data || profileRes;
      console.log('Dashboard: Extracted profile data:', profile);

      // Ensure we have the correct profile structure
      if (!profile && profileRes.user) {
        console.log('Dashboard: Using profileRes.user instead');
        profile = profileRes.user;
      }

      const profileCompletion = calculateProfileCompletion(profile);
      console.log('Dashboard: Calculated profile completion:', profileCompletion);

      setDashboardData({
        applications: applicationsRes.applications || [],
        recommendedJobs: jobsRes.jobs || [],
        upcomingEvents: eventsRes.events || [],
        achievements: achievementsRes.achievements || [],
        profile: profile, // Use complete profile data
        stats: {
          totalApplications: Array.isArray(statsRes.stats?.byStatus) ? statsRes.stats.byStatus.reduce((sum, stat) => sum + (parseInt(stat.count) || 0), 0) : 0,
          activeApplications: Array.isArray(statsRes.stats?.byStatus) ? statsRes.stats.byStatus.filter(s =>
            s && s.status && ['applied', 'screening', 'shortlisted', 'interviewed'].includes(s.status)
          ).reduce((sum, stat) => sum + (parseInt(stat.count) || 0), 0) : 0,
          interviewsScheduled: Array.isArray(statsRes.stats?.byStatus) ? parseInt(statsRes.stats.byStatus.find(s => s && s.status === 'interviewed')?.count) || 0 : 0,
          offers: Array.isArray(statsRes.stats?.byStatus) ? parseInt(statsRes.stats.byStatus.find(s => s && s.status === 'selected')?.count) || 0 : 0,
          profileCompletion,
          skillsCount: Array.isArray(profile?.studentProfile?.skills) ? profile.studentProfile.skills.length : 0,
          achievementsCount: Array.isArray(achievementsRes.achievements) ? achievementsRes.achievements.length : 0
        }
      });

      console.log('Dashboard: Final dashboard data:', {
        profileCompletion,
        profile: profile,
        stats: {
          profileCompletion,
          skillsCount: Array.isArray(profile?.studentProfile?.skills) ? profile.studentProfile.skills.length : 0,
          achievementsCount: Array.isArray(achievementsRes.achievements) ? achievementsRes.achievements.length : 0
        }
      });

    } catch (error) {
      console.error('Dashboard: Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProfileCompletion = (profile) => {
    console.log('Dashboard: calculateProfileCompletion called with profile:', profile);

    if (!profile) {
      console.log('Dashboard: No profile data available for completion calculation');
      return 0;
    }

    // Use the EXACT same logic as Profile.js
    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone'
    ];

    const studentFields = [
      'course', 'branch', 'yearOfStudy', 'graduationYear', 'cgpa', 'skills', 'bio'
    ];

    let totalFields = requiredFields.length;
    let completedFields = 0;

    console.log('Dashboard: Checking required fields:', requiredFields);

    // Check basic fields
    requiredFields.forEach(field => {
      const value = profile[field];
      const isCompleted = !!value;
      console.log(`Dashboard: Field ${field}: "${value}" - Completed: ${isCompleted}`);
      if (isCompleted) completedFields++;
    });

    console.log('Dashboard: Basic fields completed:', completedFields, 'out of', totalFields);

    // Check student specific fields
    if (user && user.role === 'student' && profile.studentProfile) {
      console.log('Dashboard: Checking student fields:', studentFields);
      console.log('Dashboard: Student profile data:', profile.studentProfile);

      totalFields += studentFields.length;
      studentFields.forEach(field => {
        const value = profile.studentProfile[field];
        const isCompleted = value && (Array.isArray(value) ? value.length > 0 : true);
        console.log(`Dashboard: Student field ${field}: "${value}" - Completed: ${isCompleted}`);
        if (isCompleted) completedFields++;
      });
    } else {
      console.log('Dashboard: User role is not student or no studentProfile:', {
        userRole: user?.role,
        hasStudentProfile: !!profile.studentProfile
      });
    }

    const completion = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    console.log(`Dashboard: Final calculation: ${completedFields}/${totalFields} = ${completion}%`);

    // Also calculate using the same method as Profile.js for comparison
    const profilePageCalculation = calculateProfileCompletionLikeProfilePage(profile);
    console.log(`Dashboard: Profile page calculation: ${profilePageCalculation}%`);

    return completion;
  };

  // Duplicate the exact logic from Profile.js for comparison
  const calculateProfileCompletionLikeProfilePage = (profile) => {
    if (!profile) return 0;

    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone'
    ];

    const studentFields = [
      'course', 'branch', 'yearOfStudy', 'graduationYear', 'cgpa', 'skills', 'bio'
    ];

    let totalFields = requiredFields.length;
    let completedFields = 0;

    // Check basic fields
    requiredFields.forEach(field => {
      if (profile[field]) completedFields++;
    });

    // Check student specific fields
    if (user && user.role === 'student' && profile.studentProfile) {
      totalFields += studentFields.length;
      studentFields.forEach(field => {
        const value = profile.studentProfile[field];
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          completedFields++;
        }
      });
    }

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  };

  const getStatusColor = (status) => {
    if (!status) return 'text-gray-600 bg-gray-100';

    const colors = {
      applied: 'text-blue-600 bg-blue-100',
      screening: 'text-yellow-600 bg-yellow-100',
      shortlisted: 'text-purple-600 bg-purple-100',
      interviewed: 'text-orange-600 bg-orange-100',
      selected: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100',
      withdrawn: 'text-gray-600 bg-gray-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    if (!status) return <DocumentTextIcon className="h-4 w-4" />;

    switch (status) {
      case 'applied': return <DocumentTextIcon className="h-4 w-4" />;
      case 'screening': return <ClockIcon className="h-4 w-4" />;
      case 'shortlisted': return <StarIcon className="h-4 w-4" />;
      case 'interviewed': return <UserGroupIcon className="h-4 w-4" />;
      case 'selected': return <CheckCircleIcon className="h-4 w-4" />;
      case 'rejected': return <ExclamationTriangleIcon className="h-4 w-4" />;
      default: return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = "blue", subtitle, trend }) => {
    const colorClasses = {
      blue: "text-blue-600",
      green: "text-green-600",
      orange: "text-orange-600",
      purple: "text-purple-600"
    };

    return (
      <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Icon className={`h-6 w-6 ${colorClasses[color] || colorClasses.blue}`} />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                <dd className="text-lg font-medium text-gray-900">{value}</dd>
                {subtitle && (
                  <dd className="text-sm text-gray-600">{subtitle}</dd>
                )}
                {trend && (
                  <dd className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}% from last month
                  </dd>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'Student'}! 👋
              </h1>
              <p className="text-gray-600 mt-2">
                Here's what's happening with your job search and career development
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/profile"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <AcademicCapIcon className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Browse Jobs
              </Link>
            </div>
          </div>
        </div>

        {/* Profile Completion Alert */}
        {dashboardData.stats.profileCompletion < 100 && dashboardData.stats.profileCompletion < 80 && dashboardData.stats.profileCompletion > 0 && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-medium text-blue-800">
                  Complete your profile to get better opportunities
                </h3>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm text-blue-700">
                    <span>Profile completion</span>
                    <span className="font-medium">{dashboardData.stats.profileCompletion || 0}%</span>
                  </div>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${dashboardData.stats.profileCompletion}%` }}
                    ></div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-blue-700">
                  Add your academic details, skills, and achievements to increase your chances of being discovered by recruiters.
                </p>
                <div className="mt-4">
                  <Link
                    to="/profile"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    Complete Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
        {dashboardData.stats.profileCompletion === 100 && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-medium text-green-800">
                  Your profile is complete!
                </h3>
                <p className="mt-2 text-sm text-green-700">
                  You've completed all the required fields. Keep up the good work!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Applications"
            value={dashboardData.stats.totalApplications || 0}
            icon={DocumentTextIcon}
            color="blue"
            subtitle="Across all jobs"
          />
          <StatCard
            title="Active Applications"
            value={dashboardData.stats.activeApplications || 0}
            icon={BriefcaseIcon}
            color="green"
            subtitle="In progress"
          />
          <StatCard
            title="Interviews Scheduled"
            value={dashboardData.stats.interviewsScheduled || 0}
            icon={CalendarIcon}
            color="orange"
            subtitle="Upcoming"
          />
          <StatCard
            title="Offers Received"
            value={dashboardData.stats.offers || 0}
            icon={StarIcon}
            color="purple"
            subtitle="Congratulations!"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'applications', name: 'Applications', icon: DocumentTextIcon },
              { id: 'opportunities', name: 'Opportunities', icon: BriefcaseIcon },
              { id: 'events', name: 'Events', icon: CalendarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Applications */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Recent Applications</h2>
                    <Link
                      to="/applications"
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      View all
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {Array.isArray(dashboardData.applications) && dashboardData.applications.length > 0 ? (
                    (Array.isArray(dashboardData.applications) ? dashboardData.applications.slice(0, 5) : []).map((application) => (
                      <div key={application?.id || Math.random()} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900">
                              {application.job?.title || 'Job title unavailable'}
                            </h3>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                              {application.job?.organization?.name || 'Organization unavailable'}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 mt-1">
                              <MapPinIcon className="h-4 w-4 mr-1" />
                              {application.job?.location || 'Location unavailable'}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Applied {(() => {
                                try {
                                  return new Date(application.appliedAt).toLocaleDateString();
                                } catch (error) {
                                  return 'Date unavailable';
                                }
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                              {getStatusIcon(application.status)}
                              <span className="ml-1">{application.status ? application.status.replace('_', ' ') : 'Unknown'}</span>
                            </span>
                            <Link
                              to={`/applications/${application?.id || '#'}`}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center">
                      <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No applications yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Start by browsing available jobs and applying to ones that interest you.
                      </p>
                      <div className="mt-6">
                        <Link
                          to="/jobs"
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                          Browse Jobs
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Profile Summary */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Profile Summary</h2>
                </div>
                <div className="p-6 space-y-4">
                  {dashboardData.stats.profileCompletion === 100 ? (
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <span className="text-sm font-medium text-green-800">Profile Completed!</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Completion</span>
                        <span className="text-sm font-medium text-gray-900">{dashboardData.stats.profileCompletion || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${dashboardData.stats.profileCompletion || 0}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Skills:</span>
                      <span className="ml-2 font-medium text-gray-900">{dashboardData.stats.skillsCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Achievements:</span>
                      <span className="ml-2 font-medium text-gray-900">{dashboardData.stats.achievementsCount || 0}</span>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    className="block w-full text-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    {dashboardData.stats.profileCompletion === 100 ? 'View Profile' : 'Update Profile'}
                  </Link>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
                </div>
                <div className="p-6 space-y-3">
                  <Link
                    to="/resume"
                    className="flex items-center p-3 text-sm text-gray-700 rounded-lg border hover:bg-gray-50"
                  >
                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                    Update Resume
                  </Link>
                  <Link
                    to="/jobs"
                    className="flex items-center p-3 text-sm text-gray-700 rounded-lg border hover:bg-gray-50"
                  >
                    <BriefcaseIcon className="h-5 w-5 text-gray-400 mr-3" />
                    Browse Jobs
                  </Link>
                  <Link
                    to="/events"
                    className="flex items-center p-3 text-sm text-gray-700 rounded-lg border hover:bg-gray-50"
                  >
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                    View Events
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">All Applications</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {Array.isArray(dashboardData.applications) && dashboardData.applications.length > 0 ? (
                dashboardData.applications.map((application) => (
                  <div key={application?.id || Math.random()} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {application.job?.title || 'Job title unavailable'}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                          {application.job?.organization?.name || 'Organization unavailable'}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          {application.job?.location || 'Location unavailable'}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Applied {(() => {
                            try {
                              return new Date(application.appliedAt).toLocaleDateString();
                            } catch (error) {
                              return 'Date unavailable';
                            }
                          })()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                          {getStatusIcon(application.status)}
                          <span className="ml-1">{application.status ? application.status.replace('_', ' ') : 'Unknown'}</span>
                        </span>
                        <Link
                          to={`/applications/${application?.id || '#'}`}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No applications yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Start by browsing available jobs and applying to ones that interest you.
                  </p>
                  <div className="mt-6">
                    <Link
                      to="/jobs"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                      Browse Jobs
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended Jobs */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recommended Jobs</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {Array.isArray(dashboardData.recommendedJobs) && dashboardData.recommendedJobs.length > 0 ? (
                  dashboardData.recommendedJobs.map((job) => (
                    <div key={job?.id || Math.random()} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900 mb-1">
                            {job.title || 'Job title unavailable'}
                          </h3>
                          <p className="text-xs text-gray-600 mb-2">
                            {job.organization?.name || 'Organization unavailable'}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <MapPinIcon className="h-4 w-4 mr-1" />
                            <span>{job.location || 'Location unavailable'}</span>
                            {job.matchScore && !isNaN(job.matchScore) && (
                              <span className="ml-2 text-green-600 font-medium">
                                {Math.round(job.matchScore)}% match
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          to={`/jobs/${job?.id || '#'}`}
                          className="text-blue-600 hover:text-blue-500 text-xs font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-4 text-center text-sm text-gray-500">
                    Complete your profile to get personalized job recommendations
                  </div>
                )}
              </div>
              <div className="px-6 py-3 bg-gray-50">
                <Link
                  to="/jobs"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                >
                  View all jobs →
                </Link>
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Achievements</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {Array.isArray(dashboardData.achievements) && dashboardData.achievements.length > 0 ? (
                  dashboardData.achievements.map((achievement) => (
                    <div key={achievement?.id || Math.random()} className="px-6 py-4 hover:bg-gray-50">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        {achievement.title || 'Achievement title unavailable'}
                      </h3>
                      <p className="text-xs text-gray-600 mb-1">
                        {achievement.issuingOrganization || 'Organization unavailable'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {achievement.issueDate && (() => {
                          try {
                            return new Date(achievement.issueDate).toLocaleDateString();
                          } catch (error) {
                            return 'Date unavailable';
                          }
                        })()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-4 text-center text-sm text-gray-500">
                    No achievements yet
                  </div>
                )}
              </div>
              <div className="px-6 py-3 bg-gray-50">
                <Link
                  to="/profile"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                >
                  Add achievements →
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Upcoming Events</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {Array.isArray(dashboardData.upcomingEvents) && dashboardData.upcomingEvents.length > 0 ? (
                dashboardData.upcomingEvents.map((event) => (
                  <div key={event?.id || Math.random()} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                          {event.title || 'Event title unavailable'}
                        </h3>
                        <p className="text-xs text-gray-600 mb-1">
                          {event.organization?.name || 'Organization unavailable'}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <span>{(() => {
                            try {
                              return `${new Date(event.startTime).toLocaleDateString()} at ${new Date(event.startTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}`;
                            } catch (error) {
                              return 'Date unavailable';
                            }
                          })()}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <MapPinIcon className="h-4 w-4 mr-1" />
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500">
                          {event.registrationCount && !isNaN(event.registrationCount) ? event.registrationCount : 0} registered
                        </span>
                        <Link
                          to={`/events/${event?.id || '#'}`}
                          className="text-blue-600 hover:text-blue-500 text-xs font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming events</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Check back later for new events and opportunities.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-gray-50">
              <Link
                to="/events"
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                View all events →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;