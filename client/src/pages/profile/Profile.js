// client/src/pages/profile/Profile.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import authService from '../../services/auth';
import toast from 'react-hot-toast';
import { calculateProfileCompletion } from '../../utils/helpers';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DetailRow,
  Divider,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageShell,
  SectionBlock,
  Select,
  Skeleton,
  SkeletonCard,
  Tabs,
  Textarea
} from '../../components/ui';
import {
  UserCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
  TrophyIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

/** Achievement type → badge tone. */
const ACHIEVEMENT_TONES = {
  academic: 'info',
  project: 'success',
  certification: 'purple',
  competition: 'warning',
  publication: 'danger',
  other: 'neutral'
};

const YEAR_OPTIONS = [
  { value: '', label: 'Select year' },
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: '5', label: '5th year' },
  { value: '6', label: '6th year' }
];

// `REACT_APP_API_URL` already ends in `/api` (see services/api.js, which uses
// it verbatim as the axios baseURL). Appending another `/api` here produced
// `/api/api/files/…`, which 404s — so strip the suffix and keep the origin.
// Unset in dev, this collapses to a relative URL that the CRA proxy forwards.
const API_ORIGIN = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

/** Downloads a stored file through the API, honouring the bearer token. */
const fetchResumeBlob = async (fileId) => {
  // Built from REACT_APP_API_URL directly rather than through services/api
  // because this is a raw fetch for a binary body, not a JSON call.
  const token = authService.getAccessToken();
  if (!token) {
    toast.error('Authentication required. Please login again.');
    return null;
  }
  const response = await fetch(`${API_ORIGIN}/api/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    toast.error(errorData.message || 'Failed to open resume');
    return null;
  }
  return response.blob();
};

const Profile = () => {
  const { id } = useParams(); // Get user ID from URL params
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  // Which organisations have actually seen this profile. Recruiter access is
  // already scoped and already logged; this is the student's own view of it.
  const [dataAccess, setDataAccess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [addingAchievement, setAddingAchievement] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      // If viewing another user's profile, use /users/:id, otherwise use /users/profile
      const endpoint = id ? `/users/${id}` : '/users/profile';
      const response = await api.get(endpoint);
      const userData = response.user || response; // Handle different response formats
      setProfile(userData);

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
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData((prev) => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const { firstName, lastName, phone, ...profileData } = formData;
      // `email` is read-only server-side, so it is destructured out and dropped.
      delete profileData.email;

      const updateData = { firstName, lastName, phone };

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
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    const body = new FormData();
    body.append('profilePicture', file);

    const loadingToast = toast.loading('Uploading profile picture...');
    try {
      const response = await api.post('/users/profile/picture', body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.dismiss(loadingToast);
      toast.success('Profile picture updated successfully');

      const picture = response.data?.profilePicture || response.profilePicture;
      setProfile((prev) => ({ ...prev, profilePicture: picture }));
      updateUser({ ...user, profilePicture: picture });
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to upload profile picture');
    }
  };

  const handleAddAchievement = async () => {
    try {
      setAddingAchievement(true);
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

      // The field is a native date input, so it normally arrives as YYYY-MM-DD;
      // anything else is assumed to be DD-MM-YYYY and flipped.
      if (newAchievement.issueDate && newAchievement.issueDate.trim()) {
        const dateInput = newAchievement.issueDate.trim();
        if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
          achievementData.issueDate = dateInput;
        } else {
          const dateParts = dateInput.split('-');
          if (dateParts.length === 3) {
            achievementData.issueDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
          }
        }
      }

      if (newAchievement.credentialUrl && newAchievement.credentialUrl.trim()) {
        let url = newAchievement.credentialUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        achievementData.credentialUrl = url;
      }

      const response = await api.post('/achievements', achievementData);
      setAchievements((prev) => [response.achievement, ...prev]);
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
      // The axios interceptor rejects with `{ message, status, data }`.
      const details = error?.data?.details;
      if (details) {
        const errorMessages = details
          .map((detail) => `${detail.path || detail.param}: ${detail.msg}`)
          .join(', ');
        toast.error(`Validation error: ${errorMessages}`);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to add achievement');
      }
    } finally {
      setAddingAchievement(false);
    }
  };

  const handleDeleteAchievement = async (achievementId) => {
    try {
      await api.delete(`/achievements/${achievementId}`);
      setAchievements((prev) => prev.filter((a) => a.id !== achievementId));
      toast.success('Achievement deleted successfully');
    } catch (error) {
      toast.error('Failed to delete achievement');
    }
  };

  const handleViewResume = async () => {
    const blob = await fetchResumeBlob(profile.studentProfile.resumeFileId);
    if (!blob) return;
    const blobUrl = window.URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
  };

  const handleDownloadResume = async () => {
    const blob = await fetchResumeBlob(profile.studentProfile.resumeFileId);
    if (!blob) return;
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${profile.firstName}_${profile.lastName}_Resume.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    toast.success('Resume download started');
  };

  const isStudentProfile = profile?.role === 'student';

  useEffect(() => {
    // Fetched only when the tab is opened: most visits never ask this, and it
    // reads a broad slice of the audit table.
    if (activeTab !== 'privacy' || dataAccess) return;
    api
      .get('/audit/my-data', { silent: true })
      .then((res) => setDataAccess(res.entries || []))
      .catch(() => setDataAccess([]));
  }, [activeTab, dataAccess]);


  const tabs = useMemo(
    () => [
      { value: 'personal', label: 'Personal', icon: UserCircleIcon },
      ...(isStudentProfile
        ? [
            { value: 'academic', label: 'Academic', icon: AcademicCapIcon },
            { value: 'achievements', label: 'Achievements', icon: TrophyIcon, count: achievements.length },
            { value: 'resume', label: 'Resume', icon: DocumentTextIcon },
            { value: 'privacy', label: 'Who saw my profile', icon: ShieldCheckIcon }
          ]
        : [])
    ],
    [isStudentProfile, achievements.length]
  );

  if (isLoading) {
    return (
      <PageShell width="narrow">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={6} />
        </div>
      </PageShell>
    );
  }

  const profileCompletion = profile ? calculateProfileCompletion(profile, user?.role || 'student') : 0;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const studentProfile = profile?.studentProfile;
  const hasResume = Boolean(studentProfile?.resumeUrl || studentProfile?.resumeFileId);

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow={isViewingOtherUser ? 'Student profile' : 'Account'}
        title={fullName || 'Profile'}
        lead={[profile?.role?.replace(/_/g, ' '), profile?.organization?.name]
          .filter(Boolean)
          .join(' · ')}
        actions={
          !isViewingOtherUser && (
            <Button
              variant={isEditing ? 'secondary' : 'primary'}
              icon={isEditing ? XMarkIcon : PencilIcon}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel editing' : 'Edit profile'}
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={profile?.profilePicture} name={fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink-950">{fullName}</p>
            <p className="text-sm capitalize text-ink-600">{profile?.role?.replace(/_/g, ' ')}</p>
            {profile?.organization?.name && (
              <p className="text-sm text-ink-500">{profile.organization.name}</p>
            )}
          </div>
          {profileCompletion === 100 ? (
            <Badge tone="success" dot>
              Profile complete
            </Badge>
          ) : (
            <div className="w-full sm:w-56">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono uppercase tracking-[0.12em] text-ink-500">
                  Completion
                </span>
                <span className="font-semibold tabular-nums text-ink-800">
                  {profileCompletion}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Profile completion"
                aria-valuenow={profileCompletion}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bone-200"
              >
                <div
                  className="h-full rounded-full bg-saffron-500 transition-all duration-300"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {isEditing && !isViewingOtherUser && (
          <>
            <Divider className="my-5" />
            <label
              htmlFor="profile-picture"
              className="mb-1.5 block text-sm font-medium text-ink-800"
            >
              Update profile picture
            </label>
            <input
              id="profile-picture"
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="block w-full text-sm text-ink-600 file:mr-4 file:rounded-full file:border file:border-ink-950 file:bg-ink-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-800"
            />
            <p className="mt-1.5 text-xs text-ink-500">JPG or PNG, up to 5MB.</p>
          </>
        )}
      </Card>

      <Tabs className="mb-6 w-fit max-w-full" tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {isEditing && !isViewingOtherUser ? (
        <form onSubmit={handleSubmit}>
          {activeTab === 'personal' && (
            <Card className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="First name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
                <Input
                  label="Last name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                disabled
                help="Your sign-in email cannot be changed here."
              />
              <Input
                label="Phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />

              {isStudentProfile && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="Date of birth"
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                    />
                    <Select
                      label="Gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      options={[
                        { value: '', label: 'Select gender' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' }
                      ]}
                    />
                  </div>
                  <Textarea
                    label="Address"
                    rows={3}
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                  <Textarea
                    label="Bio"
                    rows={4}
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Tell us about yourself…"
                  />
                  <Divider />
                  <h2 className="font-display text-base font-bold text-ink-950">Social links</h2>
                  <Input
                    label="LinkedIn URL"
                    type="url"
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleInputChange}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                  <Input
                    label="GitHub URL"
                    type="url"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleInputChange}
                    placeholder="https://github.com/yourusername"
                  />
                  <Input
                    label="Portfolio URL"
                    type="url"
                    name="portfolioUrl"
                    value={formData.portfolioUrl}
                    onChange={handleInputChange}
                    placeholder="https://yourportfolio.com"
                  />
                </>
              )}
            </Card>
          )}

          {activeTab === 'academic' && isStudentProfile && (
            <Card className="space-y-5">
              <Input
                label="Student ID"
                name="studentId"
                value={formData.studentId}
                onChange={handleInputChange}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Course"
                  name="course"
                  value={formData.course}
                  onChange={handleInputChange}
                  placeholder="e.g. Bachelor of Technology"
                />
                <Input
                  label="Branch / specialization"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  placeholder="e.g. Computer Science Engineering"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <Select
                  label="Year of study"
                  name="yearOfStudy"
                  value={formData.yearOfStudy}
                  onChange={handleInputChange}
                  options={YEAR_OPTIONS}
                />
                <Input
                  label="Graduation year"
                  type="number"
                  min="2020"
                  max="2030"
                  name="graduationYear"
                  value={formData.graduationYear}
                  onChange={handleInputChange}
                />
                <Input
                  label="CGPA"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  name="cgpa"
                  value={formData.cgpa}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink-800">Skills</p>
                {formData.skills.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {formData.skills.map((skill) => (
                      <li key={skill}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-950/15 bg-bone-100 py-0.5 pl-3 pr-1 text-sm text-ink-800">
                          {skill}
                          <IconButton
                            size="sm"
                            icon={XMarkIcon}
                            label={`Remove ${skill}`}
                            onClick={() => handleRemoveSkill(skill)}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-end gap-2">
                  <Input
                    label="Add a skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="e.g. React"
                    onKeyDown={(e) => {
                      // Enter inside a field would otherwise submit the whole
                      // profile form instead of adding the skill.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddSkill}>
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {(activeTab === 'achievements' || activeTab === 'resume') && (
            <Card>
              <p className="text-sm text-ink-600">
                {activeTab === 'achievements'
                  ? 'Achievements are managed outside edit mode — cancel editing to add or remove them.'
                  : 'Your resume is generated from this profile. Cancel editing to view or download it.'}
              </p>
            </Card>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <>
          {activeTab === 'personal' && (
            <Card>
              <SectionBlock title="Basic information" className="mb-0">
                <dl>
                  <DetailRow label="Full name">{fullName || '—'}</DetailRow>
                  <DetailRow label="Email">{profile?.email}</DetailRow>
                  <DetailRow label="Phone">{profile?.phone || 'Not provided'}</DetailRow>
                  {isStudentProfile && studentProfile && (
                    <>
                      <DetailRow label="Date of birth">
                        {studentProfile.dateOfBirth
                          ? new Date(studentProfile.dateOfBirth).toLocaleDateString()
                          : 'Not provided'}
                      </DetailRow>
                      <DetailRow label="Gender">
                        <span className="capitalize">{studentProfile.gender || 'Not provided'}</span>
                      </DetailRow>
                      <DetailRow label="Address">
                        {studentProfile.address || 'Not provided'}
                      </DetailRow>
                      <DetailRow label="Bio">{studentProfile.bio || 'No bio added yet'}</DetailRow>
                    </>
                  )}
                </dl>
              </SectionBlock>

              {isStudentProfile && studentProfile && (
                <>
                  <Divider className="my-5" />
                  <h2 className="font-display text-base font-bold text-ink-950">Social links</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: 'LinkedIn', href: studentProfile.linkedinUrl },
                      { label: 'GitHub', href: studentProfile.githubUrl },
                      { label: 'Portfolio', href: studentProfile.portfolioUrl }
                    ]
                      .filter((link) => link.href)
                      .map((link) => (
                        <Button
                          key={link.label}
                          as="a"
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          variant="secondary"
                          iconRight={ArrowTopRightOnSquareIcon}
                        >
                          {link.label}
                        </Button>
                      ))}
                    {!studentProfile.linkedinUrl &&
                      !studentProfile.githubUrl &&
                      !studentProfile.portfolioUrl && (
                        <p className="text-sm text-ink-500">No links added yet.</p>
                      )}
                  </div>
                </>
              )}
            </Card>
          )}

          {activeTab === 'academic' && isStudentProfile && (
            <Card>
              <dl>
                <DetailRow label="Student ID">
                  {studentProfile?.studentId || 'Not provided'}
                </DetailRow>
                <DetailRow label="Course">{studentProfile?.course || 'Not provided'}</DetailRow>
                <DetailRow label="Branch">{studentProfile?.branch || 'Not provided'}</DetailRow>
                <DetailRow label="Year of study">
                  {studentProfile?.yearOfStudy
                    ? `${studentProfile.yearOfStudy} Year`
                    : 'Not provided'}
                </DetailRow>
                <DetailRow label="Graduation year">
                  {studentProfile?.graduationYear || 'Not provided'}
                </DetailRow>
                <DetailRow label="CGPA">{studentProfile?.cgpa || 'Not provided'}</DetailRow>
                <DetailRow label="Percentage">
                  {studentProfile?.percentage ? `${studentProfile.percentage}%` : 'Not provided'}
                </DetailRow>
                <DetailRow label="Skills">
                  {studentProfile?.skills?.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {studentProfile.skills.map((skill) => (
                        <li key={skill}>
                          <Badge tone="neutral">{skill}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'No skills added yet'
                  )}
                </DetailRow>
              </dl>
            </Card>
          )}

          {activeTab === 'achievements' && isStudentProfile && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">
                  Achievements
                </h2>
                {!isViewingOtherUser && (
                  <Button size="sm" icon={PlusIcon} onClick={() => setShowAchievementModal(true)}>
                    Add achievement
                  </Button>
                )}
              </div>

              {achievements.length > 0 ? (
                <ul className="space-y-3">
                  {achievements.map((achievement) => (
                    <li key={achievement.id}>
                      <Card>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-base font-bold text-ink-950">
                                {achievement.title}
                              </h3>
                              <Badge
                                tone={
                                  ACHIEVEMENT_TONES[achievement.achievementType] ||
                                  ACHIEVEMENT_TONES.other
                                }
                              >
                                {achievement.achievementType}
                              </Badge>
                            </div>
                            {achievement.issuingOrganization && (
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
                                <BriefcaseIcon aria-hidden="true" className="h-4 w-4 text-ink-500" />
                                {achievement.issuingOrganization}
                              </p>
                            )}
                            {achievement.description && (
                              <p className="mt-2 text-sm text-ink-700">{achievement.description}</p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                              {achievement.issueDate && (
                                <span>
                                  Issued {new Date(achievement.issueDate).toLocaleDateString()}
                                </span>
                              )}
                              {achievement.credentialUrl && (
                                <a
                                  href={achievement.credentialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-ink-800 underline underline-offset-2 hover:text-ink-950"
                                >
                                  View credential
                                </a>
                              )}
                            </div>
                          </div>
                          {!isViewingOtherUser && (
                            <IconButton
                              icon={TrashIcon}
                              variant="danger"
                              size="sm"
                              label={`Delete ${achievement.title}`}
                              onClick={() => handleDeleteAchievement(achievement.id)}
                            />
                          )}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={TrophyIcon}
                  title="No achievements yet"
                  description={
                    isViewingOtherUser
                      ? 'This student has not added any achievements.'
                      : 'Add certifications, awards and projects to show recruiters what you have done.'
                  }
                  action={
                    !isViewingOtherUser ? (
                      <Button icon={PlusIcon} onClick={() => setShowAchievementModal(true)}>
                        Add achievement
                      </Button>
                    ) : (
                      <Button as={Link} to="/dashboard" variant="secondary">
                        Back to dashboard
                      </Button>
                    )
                  }
                />
              )}
            </>
          )}

          {activeTab === 'privacy' && isStudentProfile && (
            <Card>
              <CardHeader
                title="Who has seen your profile"
                description="Recruiters only see students from institutions your placement cell has approved them for. Every time your profile is returned to one, it is recorded here."
              />
              {dataAccess === null ? (
                <p className="mt-4 text-sm text-ink-500">Loading…</p>
              ) : dataAccess.length === 0 ? (
                <EmptyState
                  icon={ShieldCheckIcon}
                  title="No recruiter has seen your profile yet"
                  description="When a company you are eligible for searches for candidates, that will show up here."
                />
              ) : (
                <ul className="mt-4 divide-y divide-ink-950/10">
                  {dataAccess.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-950">{entry.organization}</p>
                        <p className="text-sm text-ink-600">{entry.description}</p>
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-ink-500" dateTime={entry.at}>
                        {new Date(entry.at).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-ink-500">
                Showing the last 180 days. Companies are named rather than individual recruiters.
              </p>
            </Card>
          )}

          {activeTab === 'resume' && isStudentProfile && (
            <>
              {hasResume ? (
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-950/15 bg-bone-100 text-ink-700"
                      >
                        <DocumentTextIcon className="h-6 w-6" strokeWidth={1.6} />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
                          <CheckCircleIcon aria-hidden="true" className="h-5 w-5 text-india-600" />
                          Resume available
                        </p>
                        <p className="text-sm text-ink-600">
                          {studentProfile.resumeUrl?.includes('http')
                            ? 'External resume link'
                            : 'Resume file uploaded'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {studentProfile.resumeFileId ? (
                        <>
                          <Button
                            variant="secondary"
                            icon={DocumentTextIcon}
                            onClick={handleViewResume}
                          >
                            View resume
                          </Button>
                          <Button icon={DocumentArrowDownIcon} onClick={handleDownloadResume}>
                            Download
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            as="a"
                            href={studentProfile.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="secondary"
                            icon={DocumentTextIcon}
                          >
                            View resume
                          </Button>
                          <Button
                            as="a"
                            href={studentProfile.resumeUrl}
                            download={`${profile.firstName}_${profile.lastName}_Resume.pdf`}
                            icon={DocumentArrowDownIcon}
                          >
                            Download
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  icon={DocumentTextIcon}
                  title="No resume generated"
                  description={
                    isViewingOtherUser
                      ? 'This student has not generated a resume yet.'
                      : 'Complete your profile and generate your resume so recruiters and TPOs can see it.'
                  }
                  action={
                    !isViewingOtherUser ? (
                      <Button as={Link} to="/resume" icon={DocumentTextIcon}>
                        Go to resume builder
                      </Button>
                    ) : (
                      <Button as={Link} to="/dashboard" variant="secondary">
                        Back to dashboard
                      </Button>
                    )
                  }
                />
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={showAchievementModal}
        onClose={() => setShowAchievementModal(false)}
        title="Add achievement"
        description="Certifications, awards, publications and projects."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAchievementModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-achievement"
              loading={addingAchievement}
              disabled={!newAchievement.title.trim()}
            >
              Add achievement
            </Button>
          </>
        }
      >
        <form
          id="add-achievement"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddAchievement();
          }}
        >
          <Input
            label="Title"
            required
            value={newAchievement.title}
            onChange={(e) => setNewAchievement((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Achievement title"
          />
          <Select
            label="Type"
            value={newAchievement.achievementType}
            onChange={(e) =>
              setNewAchievement((prev) => ({ ...prev, achievementType: e.target.value }))
            }
            options={[
              { value: 'academic', label: 'Academic' },
              { value: 'project', label: 'Project' },
              { value: 'certification', label: 'Certification' },
              { value: 'competition', label: 'Competition' },
              { value: 'publication', label: 'Publication' },
              { value: 'other', label: 'Other' }
            ]}
          />
          <Textarea
            label="Description"
            rows={3}
            value={newAchievement.description}
            onChange={(e) =>
              setNewAchievement((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe your achievement"
          />
          <Input
            label="Issuing organization"
            value={newAchievement.issuingOrganization}
            onChange={(e) =>
              setNewAchievement((prev) => ({ ...prev, issuingOrganization: e.target.value }))
            }
            placeholder="Organization name"
          />
          <Input
            label="Issue date"
            type="date"
            value={newAchievement.issueDate}
            onChange={(e) => setNewAchievement((prev) => ({ ...prev, issueDate: e.target.value }))}
          />
          <Input
            label="Credential URL"
            type="url"
            value={newAchievement.credentialUrl}
            onChange={(e) =>
              setNewAchievement((prev) => ({ ...prev, credentialUrl: e.target.value }))
            }
            placeholder="https://example.com/certificate"
            help="Optional. https:// is added automatically if you leave it off."
          />
        </form>
      </Modal>
    </PageShell>
  );
};

export default Profile;
