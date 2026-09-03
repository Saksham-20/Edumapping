// client/src/pages/resume/ResumePage.js
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import authService from '../../services/auth';
import toast from 'react-hot-toast';
import { calculateProfileCompletion } from '../../utils/helpers';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageShell,
  Skeleton,
  SkeletonCard
} from '../../components/ui';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// `REACT_APP_API_URL` already ends in `/api` (services/api.js uses it verbatim
// as the axios baseURL). Appending another `/api` here produced
// `/api/api/files/…`, which 404s, and the `resumeUrl` fallback pointed at
// `/api/uploads/…` instead of `/uploads/…`. Strip the suffix and keep the
// origin; unset in dev this collapses to a relative URL the CRA proxy forwards.
const API_ORIGIN = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

/** Threshold at which the API will accept a generate request. */
const COMPLETE_AT = 80;

/**
 * The rendered CV. Deliberately styled like a printed page rather than like the
 * app: black on white, serif-free, hairline rules — it is a preview of a PDF,
 * not another card in the UI.
 */
const ResumePreview = ({ resumeData }) => {
  if (!resumeData) return null;
  const { personalInfo, profile, achievements } = resumeData;

  return (
    <article
      className="mx-auto max-w-full border border-ink-950/15 bg-white p-5 text-ink-900 sm:max-w-2xl sm:p-8"
      style={{ minHeight: '842px' }}
    >
      <header className="mb-6 border-b-2 border-ink-950/20 pb-4 text-center">
        <h2 className="break-words font-display text-xl font-bold uppercase tracking-tight text-ink-950 sm:text-2xl">
          {personalInfo.firstName} {personalInfo.lastName}
        </h2>
        {profile?.course && (
          <p className="mt-1 text-base text-ink-600 sm:text-lg">
            {profile.course} — Year {profile.yearOfStudy}
          </p>
        )}
        <p className="mt-2 flex flex-col items-center justify-center gap-x-3 text-xs text-ink-600 sm:flex-row sm:text-sm">
          <span>{personalInfo.email}</span>
          {personalInfo.phone && <span aria-hidden="true">•</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
        </p>
      </header>

      {profile?.bio && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-ink-950/15 pb-1 font-display text-base font-bold uppercase text-ink-950 sm:text-lg">
            Professional summary
          </h3>
          <p className="text-sm leading-relaxed text-ink-800">{profile.bio}</p>
        </section>
      )}

      {profile && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-ink-950/15 pb-1 font-display text-lg font-bold uppercase text-ink-950">
            Education
          </h3>
          <h4 className="font-semibold text-ink-950">{profile.course}</h4>
          {profile.branch && (
            <p className="text-sm text-ink-800">Specialization: {profile.branch}</p>
          )}
          <p className="mt-1 text-sm text-ink-600">
            {profile.cgpa && <span>CGPA: {profile.cgpa}</span>}
            {profile.percentage && profile.cgpa && <span> | </span>}
            {profile.percentage && <span>Percentage: {profile.percentage}%</span>}
            {profile.graduationYear && <span> | Expected graduation: {profile.graduationYear}</span>}
          </p>
        </section>
      )}

      {profile?.skills &&
        (Array.isArray(profile.skills)
          ? profile.skills.length > 0
          : Object.keys(profile.skills).length > 0) && (
          <section className="mb-6">
            <h3 className="mb-3 border-b border-ink-950/15 pb-1 font-display text-lg font-bold uppercase text-ink-950">
              Technical skills
            </h3>
            {Array.isArray(profile.skills) ? (
              <p className="text-sm text-ink-800">{profile.skills.join(', ')}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(profile.skills).map(([category, skills]) => (
                  <p key={category} className="text-sm text-ink-800">
                    <span className="font-semibold text-ink-950">{category}: </span>
                    {Array.isArray(skills) ? skills.join(', ') : skills}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

      {achievements && achievements.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-ink-950/15 pb-1 font-display text-lg font-bold uppercase text-ink-950">
            Achievements &amp; experience
          </h3>
          {achievements.map((achievement, index) => (
            <div key={achievement.id} className={index > 0 ? 'mt-4' : ''}>
              <h4 className="font-semibold text-ink-950">{achievement.title}</h4>
              {achievement.issuingOrganization && (
                <p className="text-sm italic text-ink-600">
                  {achievement.issuingOrganization}
                  {achievement.issueDate && (
                    <span>
                      {' | '}
                      {new Date(achievement.issueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </span>
                  )}
                </p>
              )}
              {achievement.description && (
                <p className="mt-1 text-sm text-ink-800">{achievement.description}</p>
              )}
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-3 border-b border-ink-950/15 pb-1 font-display text-lg font-bold uppercase text-ink-950">
          Additional information
        </h3>
        <div className="space-y-1 text-sm text-ink-800">
          {profile?.githubUrl && (
            <p>
              <span className="font-semibold text-ink-950">GitHub:</span> {profile.githubUrl}
            </p>
          )}
          {profile?.portfolioUrl && (
            <p>
              <span className="font-semibold text-ink-950">Portfolio:</span> {profile.portfolioUrl}
            </p>
          )}
          {profile?.linkedinUrl && (
            <p>
              <span className="font-semibold text-ink-950">LinkedIn:</span> {profile.linkedinUrl}
            </p>
          )}
          {profile?.address && (
            <p>
              <span className="font-semibold text-ink-950">Address:</span> {profile.address}
            </p>
          )}
        </div>
      </section>
    </article>
  );
};

const ResumePage = () => {
  const { user } = useAuth();
  const [resumeData, setResumeData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchResumeData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/resume/data');
      setResumeData(response.data);
    } catch (error) {
      toast.error('Failed to load resume data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumeData();
  }, [fetchResumeData]);

  const handleGenerateResume = async () => {
    try {
      setIsGenerating(true);
      await api.post('/resume/generate');
      toast.success('Resume generated successfully!');
      await fetchResumeData();
    } catch (error) {
      toast.error('Failed to generate resume');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadResume = async () => {
    try {
      // Use File ID for download if available (preferred method)
      if (resumeData?.profile?.resumeFileId) {
        // Built from REACT_APP_API_URL directly rather than through services/api
        // because this is a raw fetch for a binary body, not a JSON call.
        const downloadUrl = `${API_ORIGIN}/api/files/${resumeData.profile.resumeFileId}/download`;

        const token = authService.getAccessToken();
        if (!token) {
          toast.error('Authentication required. Please login again.');
          return;
        }

        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
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
          toast.error(errorData.message || errorData.error || 'Failed to download resume');
        }
      } else if (resumeData?.profile?.resumeUrl) {
        // Fallback for backward compatibility with old resumeUrl format
        const link = document.createElement('a');
        link.href = `${API_ORIGIN}${resumeData.profile.resumeUrl}`;
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
      toast.error(error.message || 'Failed to download resume');
    }
  };

  const getProfileCompletionScore = () => {
    if (!resumeData) return 0;
    return calculateProfileCompletion(
      {
        ...resumeData.personalInfo,
        studentProfile: resumeData.profile,
        achievements: resumeData.achievements
      },
      'student'
    );
  };

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-10 w-56" />
        <div className="mt-8 space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={8} />
        </div>
      </PageShell>
    );
  }

  const completionScore = getProfileCompletionScore();
  const isProfileComplete = completionScore >= COMPLETE_AT;
  const hasResume = resumeData?.profile?.resumeUrl;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Student"
        title="My resume"
        lead="Generate a PDF from your profile, then share it with recruiters and your TPO."
        actions={
          isProfileComplete ? (
            hasResume ? (
              <>
                <Button
                  variant="secondary"
                  icon={ArrowPathIcon}
                  loading={isGenerating}
                  onClick={handleGenerateResume}
                >
                  Regenerate
                </Button>
                <Button icon={ArrowDownTrayIcon} onClick={handleDownloadResume}>
                  Download PDF
                </Button>
              </>
            ) : (
              <Button
                icon={DocumentTextIcon}
                loading={isGenerating}
                onClick={handleGenerateResume}
              >
                Generate resume
              </Button>
            )
          ) : (
            <Button as={Link} to="/profile" variant="saffron" icon={ExclamationTriangleIcon}>
              Complete profile
            </Button>
          )
        }
      />

      {!isProfileComplete && (
        <div
          role="status"
          className="mb-8 rounded-2xl border border-saffron-500/40 bg-saffron-50 p-5"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-saffron-700"
            />
            <div>
              <h2 className="font-display text-base font-bold text-saffron-900">
                Profile incomplete ({completionScore}%)
              </h2>
              <p className="mt-1 text-sm text-saffron-800">
                You need at least {COMPLETE_AT}% before you can generate a resume. Add your
                education, your skills, and either a bio or one achievement.
              </p>
              <div
                aria-hidden="true"
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-saffron-100"
              >
                <div
                  className="h-full rounded-full bg-saffron-500"
                  style={{ width: `${completionScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {hasResume ? (
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-950/10 bg-bone-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
              <CheckCircleIcon aria-hidden="true" className="h-5 w-5 text-india-600" />
              Resume generated
            </h2>
            <Badge tone="neutral">Preview of your PDF</Badge>
          </div>
          <div className="overflow-auto bg-bone-200 p-4 sm:p-6 md:p-8">
            <ResumePreview resumeData={resumeData} />
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={DocumentTextIcon}
          title="No resume yet"
          description={
            isProfileComplete
              ? 'Your profile is ready. Generate your resume and it becomes visible to recruiters and TPOs.'
              : 'Complete your profile details to unlock resume generation. A professional resume improves your chances of getting hired.'
          }
          action={
            isProfileComplete ? (
              <Button
                icon={DocumentTextIcon}
                loading={isGenerating}
                onClick={handleGenerateResume}
              >
                Generate now
              </Button>
            ) : (
              <Button as={Link} to="/profile" variant="secondary">
                Go to profile
              </Button>
            )
          }
        />
      )}
    </PageShell>
  );
};

export default ResumePage;
