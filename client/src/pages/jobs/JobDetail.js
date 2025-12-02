// client/src/pages/jobs/JobDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const jobData = await api.get(`/jobs/${id}`);
      setJob(jobData);

      // Check if user has already applied
      if (user?.role === 'student') {
        // Use the job ID from the URL params since that's what we know is valid
        checkApplicationStatus(id);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('Failed to load job details');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async (jobId) => {
    if (!jobId) {
      console.warn('No job ID provided for application status check');
      return;
    }

    try {
      // Use the existing /applications endpoint to get all user applications
      const response = await api.get('/applications');

      // Check if user has already applied for this specific job
      // The response structure is { applications: [...], pagination: {...} }
      const applications = response.applications || [];
      const hasAppliedForThisJob = applications.some(app => app.jobId === parseInt(jobId));
      setHasApplied(hasAppliedForThisJob);
    } catch (error) {
      console.error('Error checking application status:', error);
      // Don't show error toast for this, just log it
      // This is expected if the user hasn't applied yet
    }
  };

  const handleApply = async () => {
    if (!user) {
      toast.error('Please login to apply');
      navigate('/login');
      return;
    }

    if (user.role !== 'student') {
      toast.error('Only students can apply for jobs');
      return;
    }

    // Ensure profile is complete and resume is generated before applying
    try {
      const resumeResponse = await api.get('/resume/data');
      const { personalInfo, profile, achievements } = resumeResponse.data || {};

      // Basic checks similar to profile completion logic
      const missingUserFields = [];
      if (!personalInfo?.firstName) missingUserFields.push('firstName');
      if (!personalInfo?.lastName) missingUserFields.push('lastName');
      if (!personalInfo?.email) missingUserFields.push('email');
      if (!personalInfo?.phone) missingUserFields.push('phone');

      const requiredProfileFields = [
        'course',
        'branch',
        'yearOfStudy',
        'graduationYear',
        'cgpa',
        'skills',
        'bio'
      ];

      const missingProfileFields = [];
      if (!profile) {
        missingProfileFields.push(...requiredProfileFields);
      } else {
        requiredProfileFields.forEach((field) => {
          const value = profile[field];
          const isCompleted =
            value && (Array.isArray(value) ? value.length > 0 : true);
          if (!isCompleted) {
            missingProfileFields.push(field);
          }
        });
      }

      if (missingUserFields.length > 0 || missingProfileFields.length > 0) {
        toast.error('Please complete your profile before applying for jobs.');
        navigate('/profile');
        return;
      }

      if (!profile?.resumeUrl) {
        toast.error('Please generate your resume from the Resume page before applying.');
        navigate('/resume');
        return;
      }
    } catch (error) {
      console.error('Error checking profile/resume before applying:', error);
      toast.error('Unable to verify your profile and resume. Please try again.');
      return;
    }

    try {
      setApplying(true);
      await api.post('/applications', {
        jobId: id,
        coverLetter: '' // You can add a cover letter modal here
      });

      toast.success('Application submitted successfully!');
      setHasApplied(true);
    } catch (error) {
      console.error('Error applying for job:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Job Not Found</h1>
          <button
            onClick={() => navigate('/jobs')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  // Safely handle requirements array
  const requirements = Array.isArray(job?.requirements) ? job.requirements : [
    "Bachelor's degree in Computer Science or related field",
    "2+ years of experience with React and Node.js",
    "Strong problem-solving skills"
  ];

  // Safely handle skills array
  const skills = Array.isArray(job?.skills) ? job.skills : [
    "React",
    "Node.js",
    "JavaScript",
    "MongoDB"
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
                {job?.title || 'Software Engineer'}
              </h1>
              <div className="flex items-center text-base sm:text-lg text-gray-600 mb-4">
                <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                {job?.company?.name || 'Tech Company'}
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" />
                  {job?.location || 'Remote'}
                </div>
                <div className="flex items-center">
                  <BriefcaseIcon className="h-4 w-4 mr-1" />
                  {job?.type || 'Full-time'}
                </div>
                <div className="flex items-center">
                  <CurrencyRupeeIcon className="h-4 w-4 mr-1" />
                  {job?.salary || 'Competitive'}
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  Apply by: {job?.applicationDeadline || 'TBD'}
                </div>
              </div>
            </div>
            {user?.role === 'student' && (
              <div className="w-full sm:w-auto sm:ml-6">
                {hasApplied ? (
                  <button
                    disabled
                    className="w-full sm:w-auto bg-green-100 text-green-800 px-6 py-3 rounded-md font-medium"
                  >
                    Applied ✓
                  </button>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {applying ? 'Applying...' : 'Apply Now'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="prose max-w-none text-gray-700">
                {job?.description || (
                  <div>
                    <p>We are looking for a talented Software Engineer to join our team...</p>
                    <h3>Responsibilities:</h3>
                    <ul>
                      <li>Develop and maintain web applications</li>
                      <li>Collaborate with cross-functional teams</li>
                      <li>Write clean, maintainable code</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="space-y-2">
                {requirements.map((req, index) => (
                  <div key={index} className="flex items-start">
                    <span className="h-2 w-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span className="text-gray-700">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Company Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About Company</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Company</dt>
                  <dd className="text-sm text-gray-900">{job?.company?.name || 'Tech Company'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Industry</dt>
                  <dd className="text-sm text-gray-900">{job?.company?.industry || 'Technology'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Size</dt>
                  <dd className="text-sm text-gray-900">{job?.company?.size || '100-500 employees'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Website</dt>
                  <dd className="text-sm text-blue-600 hover:text-blue-500">
                    <a href={job?.company?.website || '#'} target="_blank" rel="noopener noreferrer">
                      Visit Website
                    </a>
                  </dd>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Posted</dt>
                  <dd className="text-sm text-gray-900">{job?.createdAt || 'Today'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Experience</dt>
                  <dd className="text-sm text-gray-900">{job?.experience || '2-4 years'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Openings</dt>
                  <dd className="text-sm text-gray-900">{job?.openings || '2'} positions</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">CGPA Required</dt>
                  <dd className="text-sm text-gray-900">{job?.minCGPA || '7.0'} and above</dd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;