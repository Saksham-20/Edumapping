// client/src/pages/resume/ResumePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import authService from '../../services/auth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { calculateProfileCompletion } from '../../utils/helpers';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const ResumePage = () => {
  const { user } = useAuth();
  const [resumeData, setResumeData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchResumeData();
  }, []);

  const fetchResumeData = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/resume/data');
      setResumeData(response.data);
    } catch (error) {
      console.error('Failed to fetch resume data:', error);
      toast.error('Failed to load resume data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateResume = async () => {
    try {
      setIsGenerating(true);
      const response = await api.post('/resume/generate');
      toast.success('Resume generated successfully!');

      // Refresh resume data
      await fetchResumeData();

    } catch (error) {
      console.error('Failed to generate resume:', error);
      toast.error('Failed to generate resume');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadResume = async () => {
    try {
      // Use File ID for download if available (preferred method)
      if (resumeData?.profile?.resumeFileId) {
        const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const downloadUrl = `${apiBaseUrl}/api/files/${resumeData.profile.resumeFileId}/download`;
        
        // Get token using auth service (properly retrieves from localStorage)
        const token = authService.getAccessToken();
        if (!token) {
          toast.error('Authentication required. Please login again.');
          return;
        }
        
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include' // Include cookies if needed
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${user.firstName}_${user.lastName}_Resume.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          toast.success('Resume download started');
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || errorData.error || 'Failed to download resume';
          console.error('Download failed:', response.status, errorMessage);
          toast.error(errorMessage);
        }
      } else if (resumeData?.profile?.resumeUrl) {
        // Fallback for backward compatibility with old resumeUrl format
        const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const link = document.createElement('a');
        link.href = `${apiBaseUrl}${resumeData.profile.resumeUrl}`;
        link.download = `${user.firstName}_${user.lastName}_Resume.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Resume download started');
      } else {
        toast.error('No resume available to download');
      }
    } catch (error) {
      console.error('Failed to download resume:', error);
      toast.error(error.message || 'Failed to download resume');
    }
  };

  const getProfileCompletionScore = () => {
    if (!resumeData) return 0;

    // Use unified helper function
    const profileData = {
      ...resumeData.personalInfo,
      studentProfile: resumeData.profile,
      achievements: resumeData.achievements
    };
    
    return calculateProfileCompletion(profileData, 'student');
  };

  const ResumePreview = () => {
    if (!resumeData) return null;

    const { personalInfo, profile, achievements } = resumeData;

    return (
      <div className="bg-white p-4 sm:p-6 md:p-8 shadow-lg max-w-full sm:max-w-2xl mx-auto border border-gray-200" style={{ minHeight: '842px' }}>
        {/* Header */}
        <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 uppercase break-words">
            {personalInfo.firstName} {personalInfo.lastName}
          </h1>
          {profile?.course && (
            <p className="text-base sm:text-lg text-gray-600 mt-1">
              {profile.course} - Year {profile.yearOfStudy}
            </p>
          )}
          <div className="flex flex-col sm:flex-row justify-center items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-gray-600">
            <span>{personalInfo.email}</span>
            {personalInfo.phone && <span>•</span>}
            {personalInfo.phone && <span>{personalInfo.phone}</span>}
          </div>
        </div>

        {/* Professional Summary */}
        {profile?.bio && (
          <div className="mb-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3 uppercase">
              Professional Summary
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed text-justify">{profile.bio}</p>
          </div>
        )}

        {/* Education */}
        {profile && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3 uppercase">
              Education
            </h2>
            <div>
              <h3 className="font-semibold text-gray-900">{profile.course}</h3>
              {profile.branch && (
                <p className="text-sm text-gray-700">Specialization: {profile.branch}</p>
              )}
              <div className="text-sm text-gray-600 mt-1">
                {profile.cgpa && <span>CGPA: {profile.cgpa}</span>}
                {profile.percentage && profile.cgpa && <span> | </span>}
                {profile.percentage && <span>Percentage: {profile.percentage}%</span>}
                {profile.graduationYear && (
                  <span> | Expected Graduation: {profile.graduationYear}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Technical Skills */}
        {profile?.skills && (Array.isArray(profile.skills) ? profile.skills.length > 0 : Object.keys(profile.skills).length > 0) && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3 uppercase">
              Technical Skills
            </h2>
            {Array.isArray(profile.skills) ? (
              <p className="text-sm text-gray-700">{profile.skills.join(', ')}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(profile.skills).map(([category, skills]) => (
                  <div key={category}>
                    <span className="font-semibold text-sm text-gray-900">{category}: </span>
                    <span className="text-sm text-gray-700">{Array.isArray(skills) ? skills.join(', ') : skills}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Achievements & Experience */}
        {achievements && achievements.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3 uppercase">
              Achievements & Experience
            </h2>
            {achievements.map((achievement, index) => (
              <div key={achievement.id} className={index > 0 ? 'mt-4' : ''}>
                <h3 className="font-semibold text-gray-900">{achievement.title}</h3>
                {achievement.issuingOrganization && (
                  <p className="text-sm text-gray-600 italic">
                    {achievement.issuingOrganization}
                    {achievement.issueDate && (
                      <span> | {new Date(achievement.issueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long'
                      })}</span>
                    )}
                  </p>
                )}
                {achievement.description && (
                  <p className="text-sm text-gray-700 mt-1 text-justify">{achievement.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Additional Information */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3 uppercase">
            Additional Information
          </h2>
          <div className="text-sm text-gray-700 space-y-1">
            {profile?.githubUrl && (
              <p><span className="font-semibold">GitHub:</span> {profile.githubUrl}</p>
            )}
            {profile?.portfolioUrl && (
              <p><span className="font-semibold">Portfolio:</span> {profile.portfolioUrl}</p>
            )}
            {profile?.linkedinUrl && (
              <p><span className="font-semibold">LinkedIn:</span> {profile.linkedinUrl}</p>
            )}
            {profile?.address && (
              <p><span className="font-semibold">Address:</span> {profile.address}</p>
            )}
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

  const completionScore = getProfileCompletionScore();
  const isProfileComplete = completionScore >= 80; // Threshold for "complete"
  const hasResume = resumeData?.profile?.resumeUrl;

  return (
    <div className="min-h-screen bg-gray-50 py-8 relative">
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <LoadingSpinner size="large" />
            <h3 className="mt-6 text-xl font-bold text-gray-900">Generating Resume</h3>
            <p className="mt-2 text-gray-600 text-center">
              Please wait while we compile your profile data into a professional resume...
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Resume</h1>
            <p className="text-gray-600 mt-1">
              Manage and preview your professional resume
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
            {isProfileComplete ? (
              <>
                {hasResume ? (
                  <>
                    <button
                      onClick={handleGenerateResume}
                      disabled={isGenerating}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                    >
                      <ArrowPathIcon className={`h-5 w-5 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                    <button
                      onClick={handleDownloadResume}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                      Download PDF
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGenerateResume}
                    disabled={isGenerating}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                  >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Generate Resume
                  </button>
                )}
              </>
            ) : (
              <Link
                to="/profile"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
              >
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                Complete Profile
              </Link>
            )}
          </div>
        </div>

        {/* Profile Completion Warning */}
        {!isProfileComplete && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-r-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Profile Incomplete ({completionScore}%)
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You need to complete your profile before you can generate a resume.
                    Please add your education, skills, and at least one achievement or bio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-8">
          {hasResume ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Resume Generated
                </h3>
                <span className="text-xs text-gray-500">
                  Last updated: {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="p-4 sm:p-6 md:p-8 bg-gray-100 overflow-auto">
                <ResumePreview />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <DocumentTextIcon className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Resume Generated</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-8">
                {isProfileComplete
                  ? "Your profile is ready! Click the 'Generate Resume' button above to create your professional resume."
                  : "Complete your profile details to unlock resume generation. A professional resume increases your chances of getting hired."}
              </p>
              {isProfileComplete ? (
                <button
                  onClick={handleGenerateResume}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                  Generate Now
                </button>
              ) : (
                <Link
                  to="/profile"
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Go to Profile
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumePage;