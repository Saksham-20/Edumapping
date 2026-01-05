// client/src/pages/dashboard/SchoolDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  AcademicCapIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  LightBulbIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

const SchoolDashboard = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('workshops');

  const tabs = [
    { id: 'workshops', label: 'Workshops', icon: BeakerIcon },
    { id: 'events', label: 'Events', icon: CalendarIcon },
    { id: 'co-curricular', label: 'Co-Curricular', icon: UserGroupIcon },
    { id: 'assessments', label: 'Assessments', icon: ClipboardDocumentCheckIcon }
  ];

  useEffect(() => {
    // Fetch dashboard data when component mounts or tab changes
    fetchTabData();
  }, [activeTab]);

  const fetchTabData = async () => {
    try {
      setIsLoading(true);
      // TODO: Implement API calls for each tab
      // For now, we'll just simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderWorkshopsTab = () => (
    <div className="space-y-6">
      {/* Introduction Section */}
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <BeakerIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Industrial Workshops & Training</h3>
            <p className="text-gray-700 leading-relaxed">
              EduMapping provides comprehensive industrial workshops and training programs designed to bridge the gap 
              between academic learning and real-world industry requirements. Our workshops are conducted by industry 
              experts and cover various domains including technology, business, soft skills, and emerging fields. 
              These hands-on training sessions help students gain practical knowledge, understand industry standards, 
              and develop skills that are directly applicable in their future careers.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Through our industrial training programs, students get exposure to current industry practices, tools, 
              and methodologies. We collaborate with leading companies and professionals to deliver workshops that 
              enhance employability and prepare students for the competitive job market.
            </p>
          </div>
        </div>
      </div>

      {/* Workshops List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder workshop cards */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#FF8C42]/10 rounded-lg">
              <BriefcaseIcon className="h-6 w-6 text-[#FF8C42]" />
            </div>
            <h4 className="font-semibold text-gray-900">Upcoming Workshop</h4>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Workshop details will be displayed here. Students can register and track their participation.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEventsTab = () => (
    <div className="space-y-6">
      {/* Introduction Section */}
      <div className="bg-gradient-to-r from-[#138808]/10 to-[#FF9933]/10 rounded-xl p-6 border border-[#138808]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CalendarIcon className="h-8 w-8 text-[#138808]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Career Development Events</h3>
            <p className="text-gray-700 leading-relaxed">
              Our events platform hosts various career development activities including career fairs, industry 
              interaction sessions, guest lectures, and networking events. These events provide students with 
              opportunities to connect with industry professionals, learn about different career paths, and gain 
              insights into the working world.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Students can participate in webinars, seminars, and interactive sessions that cover topics ranging 
              from career exploration to professional development. These events are designed to inspire, educate, 
              and guide students in making informed career decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#138808]/10 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-[#138808]" />
            </div>
            <h4 className="font-semibold text-gray-900">Upcoming Event</h4>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Event details will be displayed here. Students can view schedules and register for events.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCoCurricularTab = () => (
    <div className="space-y-6">
      {/* Introduction Section */}
      <div className="bg-gradient-to-r from-[#FF9933]/10 to-[#138808]/10 rounded-xl p-6 border border-[#FF9933]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <UserGroupIcon className="h-8 w-8 text-[#FF8C42]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Co-Curricular Activities</h3>
            <p className="text-gray-700 leading-relaxed">
              Co-curricular activities play a vital role in holistic student development. Our platform tracks and 
              manages various co-curricular activities including clubs, competitions, projects, and community 
              service initiatives. These activities help students develop leadership skills, teamwork, creativity, 
              and social responsibility.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Students can explore different clubs and societies, participate in competitions, and contribute to 
              community projects. These experiences not only enrich their learning but also enhance their profiles 
              and prepare them for future challenges.
            </p>
          </div>
        </div>
      </div>

      {/* Co-Curricular List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#FF8C42]/10 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-[#FF8C42]" />
            </div>
            <h4 className="font-semibold text-gray-900">Activity</h4>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Co-curricular activity details will be displayed here. Students can join clubs and track participation.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAssessmentsTab = () => (
    <div className="space-y-6">
      {/* Introduction Section */}
      <div className="bg-gradient-to-r from-[#138808]/10 to-[#FF9933]/10 rounded-xl p-6 border border-[#138808]/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-[#138808]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Career Counselling & Assessments</h3>
            <p className="text-gray-700 leading-relaxed">
              Our comprehensive career counselling program includes psychometric tests and assessments designed to 
              help students understand their interests, aptitudes, and personality traits. These assessments provide 
              valuable insights that guide students in making informed career choices aligned with their strengths 
              and aspirations.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Through personalized career counselling sessions, students receive guidance on career paths, course 
              selection, skill development, and future planning. Our certified career counsellors work with students 
              to create individualized career development plans that set them on the path to success.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              The assessment platform includes various tests covering aptitude, personality, interests, and career 
              readiness. Students can take these assessments, review their results, and access detailed reports that 
              help them understand their potential and areas for growth.
            </p>
          </div>
        </div>
      </div>

      {/* Assessments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#138808]/10 rounded-lg">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-[#138808]" />
            </div>
            <h4 className="font-semibold text-gray-900">Available Assessment</h4>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Assessment details will be displayed here. Students can take tests and view their results.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'workshops':
        return renderWorkshopsTab();
      case 'events':
        return renderEventsTab();
      case 'co-curricular':
        return renderCoCurricularTab();
      case 'assessments':
        return renderAssessmentsTab();
      default:
        return renderWorkshopsTab();
    }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.firstName || 'Student'}!
          </h1>
          <p className="text-gray-600">
            {user?.organization?.name || 'School'} Dashboard
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

export default SchoolDashboard;

