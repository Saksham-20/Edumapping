// client/src/pages/dashboard/TPODashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import statisticsService from '../../services/statistics';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartBarIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const TPODashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    students: {},
    jobs: {},
    applications: {},
    events: {},
    recentActivity: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await statisticsService.getTPOStats();
      if (response && response.stats) {
        setDashboardData(response.stats);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error(error?.response?.data?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      placed: 'text-green-600 bg-green-100',
      unplaced: 'text-yellow-600 bg-yellow-100',
      active: 'text-green-600 bg-green-100',
      closed: 'text-red-600 bg-red-100',
      draft: 'text-yellow-600 bg-yellow-100',
      screening: 'text-blue-600 bg-blue-100',
      shortlisted: 'text-purple-600 bg-purple-100',
      interviewed: 'text-indigo-600 bg-indigo-100',
      selected: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    const icons = {
      placed: CheckCircleIcon,
      unplaced: ClockIcon,
      active: CheckCircleIcon,
      closed: XCircleIcon,
      draft: ExclamationTriangleIcon,
      screening: ClockIcon,
      shortlisted: ExclamationTriangleIcon,
      interviewed: ExclamationTriangleIcon,
      selected: CheckCircleIcon,
      rejected: XCircleIcon
    };
    return icons[status] || ClockIcon;
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            TPO Dashboard - {user?.organization?.name}
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive placement tracking and student analytics
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Students</dt>
                    <dd className="text-2xl font-bold text-gray-900">{dashboardData.students.total || 0}</dd>
                    <dd className="text-sm text-gray-500">
                      Enrolled students
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Placed Students</dt>
                    <dd className="text-2xl font-bold text-gray-900">{dashboardData.students.placed || 0}</dd>
                    <dd className="text-sm text-gray-500">
                      {dashboardData.students.placementRate || 0}% placement rate
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BriefcaseIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Jobs</dt>
                    <dd className="text-2xl font-bold text-gray-900">{dashboardData.jobs.active || 0}</dd>
                    <dd className="text-sm text-gray-500">
                      {dashboardData.jobs.total || 0} total jobs
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentTextIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Applications</dt>
                    <dd className="text-2xl font-bold text-gray-900">{dashboardData.applications.total || 0}</dd>
                    <dd className="text-sm text-gray-500">
                      Total submissions
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Placement Statistics */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <ChartBarIcon className="h-5 w-5 text-green-600 mr-2" />
                Placement Statistics
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboardData.students.byPlacementStatus && dashboardData.students.byPlacementStatus.length > 0 ? (
                  dashboardData.students.byPlacementStatus.map((placementStat) => {
                    const IconComponent = getStatusIcon(placementStat.placementStatus);
                    const total = dashboardData.students.total || 1;
                    return (
                      <div key={placementStat.placementStatus} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <IconComponent className={`h-4 w-4 mr-2 ${getStatusColor(placementStat.placementStatus).split(' ')[0]}`} />
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {placementStat.placementStatus || 'unplaced'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-lg font-semibold text-gray-900 mr-3">
                            {placementStat.count || 0}
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ 
                                width: `${((placementStat.count || 0) / total) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No placement data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Job Status Distribution */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <BriefcaseIcon className="h-5 w-5 text-purple-600 mr-2" />
                Job Status Distribution
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboardData.jobs.byStatus && dashboardData.jobs.byStatus.length > 0 ? (
                  dashboardData.jobs.byStatus.map((jobStat) => {
                    const IconComponent = getStatusIcon(jobStat.status);
                    const total = dashboardData.jobs.total || 1;
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
                            {jobStat.count || 0}
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{ 
                                width: `${((jobStat.count || 0) / total) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No job data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company Application Analytics */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 text-blue-600 mr-2" />
              Company Application Analytics
            </h2>
          </div>
          <div className="p-6">
            {dashboardData.applications.byCompany?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.applications.byCompany.slice(0, 10).map((companyStat, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {companyStat.job?.organization?.name || 'Unknown Company'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {companyStat.job?.title || 'Job Title'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {companyStat.count} applications
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No company applications yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Company application data will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <ChartBarIcon className="h-5 w-5 text-green-600 mr-2" />
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            {dashboardData.recentActivity?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.recentActivity.map((activity, index) => (
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
                  Student applications and activities will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  to="/jobs/new"
                  className="flex items-center p-4 text-sm text-gray-700 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <BriefcaseIcon className="h-6 w-6 text-purple-600 mr-3" />
                  <div>
                    <h3 className="font-medium">Post New Job</h3>
                    <p className="text-sm text-gray-600">Create a new job posting</p>
                  </div>
                </Link>
                
                <Link
                  to="/events/new"
                  className="flex items-center p-4 text-sm text-gray-700 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <CalendarIcon className="h-6 w-6 text-blue-600 mr-3" />
                  <div>
                    <h3 className="font-medium">Schedule Event</h3>
                    <p className="text-sm text-gray-600">Create a new campus event</p>
                  </div>
                </Link>
                
                {/* Was /students, which has never existed as a route — the tile
                    silently bounced to the landing page. The student roster
                    lives inside the analytics surface. */}
                <Link
                  to="/tpo/analytics"
                  className="flex items-center p-4 text-sm text-gray-700 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <AcademicCapIcon className="h-6 w-6 text-green-600 mr-3" />
                  <div>
                    <h3 className="font-medium">Students & analytics</h3>
                    <p className="text-sm text-gray-600">Placement performance and student roster</p>
                  </div>
                </Link>
                
                <Link
                  to="/applications"
                  className="flex items-center p-4 text-sm text-gray-700 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <DocumentTextIcon className="h-6 w-6 text-orange-600 mr-3" />
                  <div>
                    <h3 className="font-medium">View Applications</h3>
                    <p className="text-sm text-gray-600">Monitor all applications</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Event Summary</h2>
              <div className="text-center">
                <CalendarIcon className="mx-auto h-12 w-12 text-blue-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{dashboardData.events.total || 0}</p>
                <p className="text-sm text-gray-600">Total Events</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TPODashboard;