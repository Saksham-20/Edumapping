// client/src/pages/dashboard/SchoolAdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  UsersIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  Cog6ToothIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const SchoolAdminDashboard = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BuildingOfficeIcon },
    { id: 'students', label: 'Students', icon: UserGroupIcon },
    { id: 'staff', label: 'Staff', icon: UsersIcon },
    { id: 'workshops', label: 'Workshops', icon: BeakerIcon },
    { id: 'events', label: 'Events', icon: CalendarIcon },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      // TODO: Implement API calls for dashboard data
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Cog6ToothIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">School Administration</h3>
            <p className="text-gray-700 leading-relaxed">
              Manage all administrative aspects of the school including student records, staff management, 
              workshops, events, and system settings.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">-</p>
            </div>
            <UserGroupIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">-</p>
            </div>
            <UsersIcon className="h-8 w-8 text-[#138808]" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Workshops</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">-</p>
            </div>
            <BeakerIcon className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Events</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">-</p>
            </div>
            <CalendarIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStudentsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Management</h3>
        <p className="text-gray-600">Manage student records, enrollments, and academic information.</p>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Management</h3>
        <p className="text-gray-600">Manage staff members, roles, and permissions.</p>
      </div>
    </div>
  );

  const renderWorkshopsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Workshop Management</h3>
        <p className="text-gray-600">Organize and manage school workshops and training programs.</p>
      </div>
    </div>
  );

  const renderEventsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Management</h3>
        <p className="text-gray-600">Plan and manage school events and activities.</p>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">School Settings</h3>
        <p className="text-gray-600">Configure school settings and preferences.</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'students':
        return renderStudentsTab();
      case 'staff':
        return renderStaffTab();
      case 'workshops':
        return renderWorkshopsTab();
      case 'events':
        return renderEventsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return renderOverviewTab();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.firstName || 'Admin'}!
          </h1>
          <p className="text-gray-600">
            {user?.organization?.name || 'School'} - Administration Dashboard
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                      ${isActive
                        ? 'border-[#FF8C42] text-[#FF8C42]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;

