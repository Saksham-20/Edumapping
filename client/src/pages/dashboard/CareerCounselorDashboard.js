// client/src/pages/dashboard/CareerCounselorDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  BriefcaseIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const CareerCounselorDashboard = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('counseling');

  const tabs = [
    { id: 'counseling', label: 'Career Counseling', icon: LightBulbIcon },
    { id: 'students', label: 'Students', icon: UserGroupIcon },
    { id: 'assessments', label: 'Assessments', icon: ClipboardDocumentCheckIcon },
    { id: 'workshops', label: 'Workshops', icon: BeakerIcon },
    { id: 'events', label: 'Events', icon: CalendarIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon }
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

  const renderCounselingTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <LightBulbIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Career Counseling</h3>
            <p className="text-gray-700 leading-relaxed">
              Provide comprehensive career guidance to students, helping them discover their interests, 
              strengths, and career paths. Conduct psychometric assessments, organize career workshops, 
              and guide students in making informed decisions about their future.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Through personalized counseling sessions, you can help students understand various career 
              options, plan their academic journey, and prepare for higher education or professional opportunities.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">Scheduled Sessions</h4>
          <p className="text-gray-600 text-sm">View and manage upcoming counseling sessions with students.</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">Career Resources</h4>
          <p className="text-gray-600 text-sm">Access career information, industry insights, and educational resources.</p>
        </div>
      </div>
    </div>
  );

  const renderStudentsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Counseling</h3>
        <p className="text-gray-600">Manage student counseling sessions and track their career development progress.</p>
      </div>
    </div>
  );

  const renderAssessmentsTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Psychometric Assessments</h3>
            <p className="text-gray-700 leading-relaxed">
              Conduct and manage psychometric tests to help students understand their personality traits, 
              interests, aptitudes, and career preferences. These assessments provide valuable insights 
              for career guidance and decision-making.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <p className="text-gray-600">Assessment management features will be available here.</p>
      </div>
    </div>
  );

  const renderWorkshopsTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <BeakerIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Career Workshops & Industrial Training</h3>
            <p className="text-gray-700 leading-relaxed">
              Organize and manage career development workshops and industrial training programs. These 
              sessions help students gain practical knowledge about various industries, understand career 
              requirements, and develop essential skills for their professional journey.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <p className="text-gray-600">Workshop management features will be available here.</p>
      </div>
    </div>
  );

  const renderEventsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Career Events</h3>
        <p className="text-gray-600">Manage career fairs, industry visits, and other career-related events.</p>
      </div>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Counseling Analytics</h3>
        <p className="text-gray-600">View insights and statistics about student counseling sessions and career development.</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'counseling':
        return renderCounselingTab();
      case 'students':
        return renderStudentsTab();
      case 'assessments':
        return renderAssessmentsTab();
      case 'workshops':
        return renderWorkshopsTab();
      case 'events':
        return renderEventsTab();
      case 'analytics':
        return renderAnalyticsTab();
      default:
        return renderCounselingTab();
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
            Welcome, {user?.firstName || 'Counselor'}!
          </h1>
          <p className="text-gray-600">
            {user?.organization?.name || 'School'} - Career Counselor Dashboard
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

export default CareerCounselorDashboard;

