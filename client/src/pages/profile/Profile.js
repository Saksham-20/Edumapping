// client/src/pages/profile/Profile.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import authService from '../../services/auth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { calculateProfileCompletion } from '../../utils/helpers';
import {
  UserCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  TrophyIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { id } = useParams(); // Get user ID from URL params
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const isViewingOtherUser = id && id !== user?.id; // Check if viewing another user's profile
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    // Student Profile
    studentId: '',
    dateOfBirth: '',
    gender: '',
    course: '',
    branch: '',
    yearOfStudy: '',
    graduationYear: '',
    cgpa: '',
    percentage: '',
    address: '',
    skills: [],
    bio: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: ''
  });
  const [newSkill, setNewSkill] = useState('');
  const [newAchievement, setNewAchievement] = useState({
    title: '',
    description: '',
    achievementType: 'academic',
    issuingOrganization: '',
    issueDate: '',
    credentialUrl: ''
  });
  const [showAchievementModal, setShowAchievementModal] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [id]); // Re-fetch when id changes

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      // If viewing another user's profile, use /users/:id, otherwise use /users/profile
      const endpoint = id ? `/users/${id}` : '/users/profile';
      const response = await api.get(endpoint);
      const userData = response.user || response; // Handle different response formats
      setProfile(userData);

      // Populate form data
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        studentId: userData.studentProfile?.studentId || '',
        dateOfBirth: userData.studentProfile?.dateOfBirth || '',
        gender: userData.studentProfile?.gender || '',
        course: userData.studentProfile?.course || '',
        branch: userData.studentProfile?.branch || '',
        yearOfStudy: userData.studentProfile?.yearOfStudy || '',
        graduationYear: userData.studentProfile?.graduationYear || '',
        cgpa: userData.studentProfile?.cgpa || '',
        percentage: userData.studentProfile?.percentage || '',
        address: userData.studentProfile?.address || '',
        skills: userData.studentProfile?.skills || [],
        bio: userData.studentProfile?.bio || '',
        linkedinUrl: userData.studentProfile?.linkedinUrl || '',
        githubUrl: userData.studentProfile?.githubUrl || '',
        portfolioUrl: userData.studentProfile?.portfolioUrl || ''
      });

      setAchievements(userData.achievements || []);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { firstName, lastName, email, phone, ...profileData } = formData;

      // Prepare update data
      const updateData = {
        firstName,
        lastName,
        phone
      };

      // Add profile data for students
      if (user.role === 'student') {
        Object.assign(updateData, profileData);
      }

      const response = await api.put('/users/profile', updateData);

      setProfile(response.user);
      updateUser(response.user);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    }
  };


  // In your Profile.js file, replace the handleAddAchievement function with this:

  const handleAddAchievement = async () => {
    try {
      // Prepare and validate data before sending
      const achievementData = {
        title: newAchievement.title.trim(),
        achievementType: newAchievement.achievementType
      };

      // Add optional fields only if they have values
      if (newAchievement.description && newAchievement.description.trim()) {
        achievementData.description = newAchievement.description.trim();
      }

      if (newAchievement.issuingOrganization && newAchievement.issuingOrganization.trim()) {
        achievementData.issuingOrganization = newAchievement.issuingOrganization.trim();
      }

      // Handle date conversion from DD-MM-YYYY to YYYY-MM-DD
      if (newAchievement.issueDate && newAchievement.issueDate.trim()) {
        const dateInput = newAchievement.issueDate.trim();
        console.log('Original date input:', dateInput); // Debug log

        // Check if date is already in YYYY-MM-DD format
        if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
          achievementData.issueDate = dateInput;
        } else {
          // Convert DD-MM-YYYY to YYYY-MM-DD
          const dateParts = dateInput.split('-');
          if (dateParts.length === 3) {
            achievementData.issueDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
          }
        }
        console.log('Converted date:', achievementData.issueDate); // Debug log
      }

      // Handle credential URL validation
      if (newAchievement.credentialUrl && newAchievement.credentialUrl.trim()) {
        let url = newAchievement.credentialUrl.trim();
        // Add https:// if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        achievementData.credentialUrl = url;
      }

      console.log('Final achievement data being sent:', achievementData); // Debug log

      const response = await api.post('/achievements', achievementData);
      setAchievements(prev => [response.achievement, ...prev]);
      setNewAchievement({
        title: '',
        description: '',
        achievementType: 'academic',
        issuingOrganization: '',
        issueDate: '',
        credentialUrl: ''
      });
      setShowAchievementModal(false);
      toast.success('Achievement added successfully');
    } catch (error) {
      console.error('Failed to add achievement:', error);
      console.error('Full error response:', error.response); // Debug log

      // Show specific validation errors if available
      if (error.response?.data?.details) {
        console.log('Validation details:', error.response.data.details); // Debug log
        const errorMessages = error.response.data.details.map(detail => `${detail.path || detail.param}: ${detail.msg}`).join(', ');
        toast.error(`Validation Error: ${errorMessages}`);
      } else if (error.response?.data?.message) {
        toast.error(`Error: ${error.response.data.message}`);
      } else {
        toast.error('Failed to add achievement');
      }
    }
  };

  const handleDeleteAchievement = async (achievementId) => {
    try {
      await api.delete(`/achievements/${achievementId}`);
      setAchievements(prev => prev.filter(a => a.id !== achievementId));
      toast.success('Achievement deleted successfully');
    } catch (error) {
      console.error('Failed to delete achievement:', error);
      toast.error('Failed to delete achievement');
    }
  };

  // Use unified helper function for profile completion
  const calculateProfileCompletionLocal = () => {
    if (!profile) return 0;
    return calculateProfileCompletion(profile, user?.role || 'student');
  };

  const getAchievementTypeColor = (type) => {
    const colors = {
      academic: 'bg-blue-100 text-blue-800',
      project: 'bg-green-100 text-green-800',
      certification: 'bg-purple-100 text-purple-800',
      competition: 'bg-yellow-100 text-yellow-800',
      publication: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors.other;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletionLocal();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img
                  className="h-16 w-16 rounded-full"
                  src={profile?.profilePicture || `https://ui-avatars.com/api/?name=${profile?.firstName}+${profile?.lastName}&background=156395&color=fff`}
                  alt="Profile"
                />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile?.firstName} {profile?.lastName}
                  </h1>
                  <p className="text-sm text-gray-600 capitalize">{profile?.role}</p>
                  <p className="text-sm text-gray-500">{profile?.organization?.name}</p>
                </div>
              </div>
              {!isViewingOtherUser && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>

          {/* Profile Picture Upload Modal/Input */}
          {isEditing && !isViewingOtherUser && (
            <div className="px-6 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Update Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('File size should be less than 5MB');
                      return;
                    }

                    const formData = new FormData();
                    formData.append('profilePicture', file);

                    try {
                      const loadingToast = toast.loading('Uploading profile picture...');
                      const response = await api.post('/users/profile/picture', formData, {
                        headers: {
                          'Content-Type': 'multipart/form-data',
                        },
                      });

                      toast.dismiss(loadingToast);
                      toast.success('Profile picture updated successfully');

                      // Update local state
                      setProfile(prev => ({
                        ...prev,
                        profilePicture: response.data?.profilePicture || response.profilePicture
                      }));
                      updateUser({
                        ...user,
                        profilePicture: response.data?.profilePicture || response.profilePicture
                      });

                    } catch (error) {
                      console.error('Failed to upload profile picture:', error);
                      toast.error('Failed to upload profile picture');
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Profile Completion */}
      <div className="px-6 py-4">
        {profileCompletion === 100 ? (
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">
                Profile Completed!
              </h3>
              <p className="text-sm text-green-700">
                You've completed all the required fields. Keep up the good work!
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Profile Completion</span>
              <span className="text-sm text-gray-600">{profileCompletion}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
          </>
        )}
      </div>


      {/* Tabs */}
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'personal', name: 'Personal Info', icon: UserCircleIcon },
              ...(profile?.role === 'student' ? [
                { id: 'academic', name: 'Academic Info', icon: AcademicCapIcon },
                { id: 'achievements', name: 'Achievements', icon: TrophyIcon },
                { id: 'resume', name: 'Resume', icon: DocumentTextIcon }
              ] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {isEditing && !isViewingOtherUser ? (
            <form onSubmit={handleSubmit}>
              {activeTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {profile?.role === 'student' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Gender
                          </label>
                          <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Address
                        </label>
                        <textarea
                          name="address"
                          rows={3}
                          value={formData.address}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Bio
                        </label>
                        <textarea
                          name="bio"
                          rows={4}
                          value={formData.bio}
                          onChange={handleInputChange}
                          placeholder="Tell us about yourself..."
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">Social Links</h4>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            LinkedIn URL
                          </label>
                          <input
                            type="url"
                            name="linkedinUrl"
                            value={formData.linkedinUrl}
                            onChange={handleInputChange}
                            placeholder="https://linkedin.com/in/yourprofile"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            GitHub URL
                          </label>
                          <input
                            type="url"
                            name="githubUrl"
                            value={formData.githubUrl}
                            onChange={handleInputChange}
                            placeholder="https://github.com/yourusername"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Portfolio URL
                          </label>
                          <input
                            type="url"
                            name="portfolioUrl"
                            value={formData.portfolioUrl}
                            onChange={handleInputChange}
                            placeholder="https://yourportfolio.com"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'academic' && profile?.role === 'student' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Student ID
                    </label>
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Course
                      </label>
                      <input
                        type="text"
                        name="course"
                        value={formData.course}
                        onChange={handleInputChange}
                        placeholder="e.g., Bachelor of Technology"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Branch/Specialization
                      </label>
                      <input
                        type="text"
                        name="branch"
                        value={formData.branch}
                        onChange={handleInputChange}
                        placeholder="e.g., Computer Science Engineering"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Year of Study
                      </label>
                      <select
                        name="yearOfStudy"
                        value={formData.yearOfStudy}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Year</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                        <option value="5">5th Year</option>
                        <option value="6">6th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Graduation Year
                      </label>
                      <input
                        type="number"
                        name="graduationYear"
                        value={formData.graduationYear}
                        onChange={handleInputChange}
                        min="2020"
                        max="2030"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        CGPA
                      </label>
                      <input
                        type="number"
                        name="cgpa"
                        value={formData.cgpa}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        max="10"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Skills Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Skills
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add a skill"
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      />
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            /* Display Mode */
            <div>
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                          <dd className="text-sm text-gray-900">{profile?.firstName} {profile?.lastName}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Email</dt>
                          <dd className="text-sm text-gray-900">{profile?.email}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Phone</dt>
                          <dd className="text-sm text-gray-900">{profile?.phone || 'Not provided'}</dd>
                        </div>
                        {profile?.role === 'student' && profile?.studentProfile && (
                          <>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                              <dd className="text-sm text-gray-900">
                                {profile.studentProfile.dateOfBirth
                                  ? new Date(profile.studentProfile.dateOfBirth).toLocaleDateString()
                                  : 'Not provided'
                                }
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Gender</dt>
                              <dd className="text-sm text-gray-900 capitalize">
                                {profile.studentProfile.gender || 'Not provided'}
                              </dd>
                            </div>
                          </>
                        )}
                      </dl>
                    </div>

                    {profile?.role === 'student' && profile?.studentProfile && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Info</h3>
                        <dl className="space-y-3">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Address</dt>
                            <dd className="text-sm text-gray-900">
                              {profile.studentProfile.address || 'Not provided'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Bio</dt>
                            <dd className="text-sm text-gray-900">
                              {profile.studentProfile.bio || 'No bio added yet'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>

                  {profile?.role === 'student' && profile?.studentProfile && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Social Links</h3>
                      <div className="flex flex-wrap gap-4">
                        {profile.studentProfile.linkedinUrl && (
                          <a
                            href={profile.studentProfile.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            LinkedIn
                          </a>
                        )}
                        {profile.studentProfile.githubUrl && (
                          <a
                            href={profile.studentProfile.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            GitHub
                          </a>
                        )}
                        {profile.studentProfile.portfolioUrl && (
                          <a
                            href={profile.studentProfile.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Portfolio
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'academic' && profile?.role === 'student' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Academic Details</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.studentId || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Course</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.course || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Branch</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.branch || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Year of Study</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.yearOfStudy
                              ? `${profile.studentProfile.yearOfStudy} Year`
                              : 'Not provided'
                            }
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Graduation Year</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.graduationYear || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">CGPA</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.cgpa || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Percentage</dt>
                          <dd className="text-sm text-gray-900">
                            {profile?.studentProfile?.percentage
                              ? `${profile.studentProfile.percentage}%`
                              : 'Not provided'
                            }
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Skills</h3>
                    {profile?.studentProfile?.skills?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.studentProfile.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No skills added yet</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'achievements' && profile?.role === 'student' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Achievements</h3>
                    {!isViewingOtherUser && (
                      <button
                        onClick={() => setShowAchievementModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add Achievement
                      </button>
                    )}
                  </div>

                  {achievements.length > 0 ? (
                    <div className="space-y-4">
                      {achievements.map((achievement) => (
                        <div key={achievement.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {achievement.title}
                                </h4>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAchievementTypeColor(achievement.achievementType)}`}>
                                  {achievement.achievementType}
                                </span>
                              </div>
                              {achievement.issuingOrganization && (
                                <p className="text-sm text-gray-600 mb-1">
                                  {achievement.issuingOrganization}
                                </p>
                              )}
                              {achievement.description && (
                                <p className="text-sm text-gray-700 mb-2">
                                  {achievement.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                {achievement.issueDate && (
                                  <span>
                                    Issued: {new Date(achievement.issueDate).toLocaleDateString()}
                                  </span>
                                )}
                                {achievement.credentialUrl && (
                                  <a
                                    href={achievement.credentialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    View Credential
                                  </a>
                                )}
                              </div>
                            </div>
                            {!isViewingOtherUser && (
                              <button
                                onClick={() => handleDeleteAchievement(achievement.id)}
                                className="ml-4 text-red-600 hover:text-red-800"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <TrophyIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No achievements yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Add your achievements, certifications, and awards to showcase your accomplishments.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'resume' && profile?.role === 'student' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Resume</h3>
                    {profile?.studentProfile?.resumeUrl || profile?.studentProfile?.resumeFileId ? (
                      <div className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <DocumentTextIcon className="h-12 w-12 text-blue-600" />
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">Resume Available</h4>
                              <p className="text-sm text-gray-500">
                                {profile.studentProfile.resumeUrl?.includes('http')
                                  ? 'External resume link'
                                  : 'Resume file uploaded'}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            {profile.studentProfile.resumeFileId ? (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                                      const downloadUrl = `${apiBaseUrl}/api/files/${profile.studentProfile.resumeFileId}/download`;
                                      const token = authService.getAccessToken();
                                      if (!token) {
                                        toast.error('Authentication required. Please login again.');
                                        return;
                                      }
                                      const response = await fetch(downloadUrl, {
                                        headers: {
                                          'Authorization': `Bearer ${token}`
                                        },
                                        credentials: 'include'
                                      });
                                      if (response.ok) {
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        window.open(blobUrl, '_blank');
                                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
                                      } else {
                                        const errorData = await response.json().catch(() => ({}));
                                        toast.error(errorData.message || 'Failed to view resume');
                                      }
                                    } catch (error) {
                                      console.error('Failed to view resume:', error);
                                      toast.error('Failed to view resume');
                                    }
                                  }}
                                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                                  View Resume
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                                      const downloadUrl = `${apiBaseUrl}/api/files/${profile.studentProfile.resumeFileId}/download`;
                                      const token = authService.getAccessToken();
                                      if (!token) {
                                        toast.error('Authentication required. Please login again.');
                                        return;
                                      }
                                      const response = await fetch(downloadUrl, {
                                        headers: {
                                          'Authorization': `Bearer ${token}`
                                        },
                                        credentials: 'include'
                                      });
                                      if (response.ok) {
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = `${profile.firstName}_${profile.lastName}_Resume.pdf`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(blobUrl);
                                        toast.success('Resume download started');
                                      } else {
                                        const errorData = await response.json().catch(() => ({}));
                                        toast.error(errorData.message || 'Failed to download resume');
                                      }
                                    } catch (error) {
                                      console.error('Failed to download resume:', error);
                                      toast.error('Failed to download resume');
                                    }
                                  }}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                                  Download
                                </button>
                              </>
                            ) : (
                              <>
                            <a
                              href={profile.studentProfile.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <DocumentTextIcon className="h-4 w-4 mr-2" />
                              View Resume
                            </a>
                            <a
                              href={profile.studentProfile.resumeUrl}
                              download={`${profile.firstName}_${profile.lastName}_Resume.pdf`}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                              Download
                            </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-8 text-center">
                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No resume generated</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {isViewingOtherUser
                            ? 'This student has not generated a resume yet.'
                            : 'Complete your profile and generate your resume from the Resume page to make it visible to recruiters and TPOs.'}
                        </p>
                        {!isViewingOtherUser && (
                          <div className="mt-4">
                            <Link
                              to="/resume"
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <DocumentTextIcon className="h-4 w-4 mr-2" />
                              Go to Resume Builder
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Achievement Modal */}
      {
        showAchievementModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Achievement</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      type="text"
                      value={newAchievement.title}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Achievement title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={newAchievement.achievementType}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, achievementType: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="academic">Academic</option>
                      <option value="project">Project</option>
                      <option value="certification">Certification</option>
                      <option value="competition">Competition</option>
                      <option value="publication">Publication</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={newAchievement.description}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Describe your achievement"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Issuing Organization</label>
                    <input
                      type="text"
                      value={newAchievement.issuingOrganization}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, issuingOrganization: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Organization name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Issue Date</label>
                    <input
                      type="date"
                      value={newAchievement.issueDate}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, issueDate: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Credential URL (Optional)</label>
                    <input
                      type="url"
                      value={newAchievement.credentialUrl}
                      onChange={(e) => setNewAchievement(prev => ({ ...prev, credentialUrl: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/certificate"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAchievementModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAchievement}
                    disabled={!newAchievement.title}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Achievement
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Profile;