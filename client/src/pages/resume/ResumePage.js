// client/src/pages/resume/ResumePage.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import openProtectedFile from '../../utils/openProtectedFile';
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
  CheckCircleIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

/** Largest resume the upload route accepts (server MAX_FILE_SIZE default). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const formatWhen = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

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
          <span className="break-all">{personalInfo.email}</span>
          {/* Stacked on a phone, so the separator would sit alone on a line. */}
          {personalInfo.phone && <span aria-hidden="true" className="hidden sm:inline">•</span>}
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
          {resumeData.institution && <p className="text-sm text-ink-800">{resumeData.institution}</p>}
          <p className="mt-1 text-sm text-ink-600">
            {profile.cgpa && <span>CGPA: {profile.cgpa}</span>}
            {profile.percentage && profile.cgpa && <span> | </span>}
            {profile.percentage && <span>Percentage: {profile.percentage}%</span>}
            {profile.graduationYear && <span> | Expected graduation: {profile.graduationYear}</span>}
          </p>
          {/* Same school scores the generated PDF prints. */}
          {[
            ['Class XII', profile.class12Percentage],
            ['Diploma', profile.diplomaPercentage],
            ['Class X', profile.class10Percentage]
          ].some(([, v]) => v !== null && v !== undefined) && (
            <p className="mt-1 text-sm text-ink-600">
              {[
                ['Class XII', profile.class12Percentage],
                ['Diploma', profile.diplomaPercentage],
                ['Class X', profile.class10Percentage]
              ]
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([label, v]) => `${label}: ${Number(v)}%`)
                .join(' | ')}
            </p>
          )}
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
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef(null);

  const fetchResumeData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/resume/data');
      setResumeData({ ...response.data, institution: user?.organization?.name || null });
    } catch (error) {
      // The api interceptor has already said why.
    } finally {
      setIsLoading(false);
    }
  }, [user?.organization?.name]);

  useEffect(() => {
    fetchResumeData();
  }, [fetchResumeData]);

  const handleGenerateResume = async () => {
    try {
      setIsGenerating(true);
      await api.post('/resume/generate');
      toast.success('Resume generated');
      await fetchResumeData();
    } catch (error) {
      // The api interceptor has already shown the server's reason.
    } finally {
      setIsGenerating(false);
    }
  };

  // A student's own CV, for those who already have a better one than the
  // generated layout. It replaces the generated PDF for new applications;
  // applications already sent keep the resume they went out with.
  const handleUploadResume = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Upload your resume as a PDF. Save it as PDF from Word or Google Docs first.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('That file is over 10 MB. Export a smaller PDF and try again.');
      return;
    }
    const body = new FormData();
    body.append('resume', file);
    setIsUploading(true);
    try {
      await api.post('/resume/upload', body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      toast.success('Resume uploaded');
      await fetchResumeData();
    } catch (error) {
      // The api interceptor has already shown the server's reason.
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownloadResume = async () => {
    // Through the authenticated file route: resumes are no longer served from
    // the public /uploads folder, so a bare link would 404 (and used to be
    // readable by anyone holding the URL).
    const filename = `${user.firstName}_${user.lastName}_Resume.pdf`;
    const source = resumeData?.profile?.resumeFileId
      ? `/files/${resumeData.profile.resumeFileId}/download`
      : resumeData?.profile?.resumeUrl;
    if (!source) {
      toast.error('No resume available to download');
      return;
    }
    const ok = await openProtectedFile(source, { download: true, filename });
    if (ok) toast.success('Resume download started');
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
  const resumeFile = resumeData?.profile?.resumeFile || null;
  const isUploaded = resumeFile?.source === 'uploaded';
  // A generated PDF is a snapshot. If the profile changed afterwards the PDF
  // recruiters download no longer matches what this page previews.
  const isStale =
    !isUploaded &&
    resumeFile?.createdAt &&
    resumeData?.profile?.updatedAt &&
    new Date(resumeData.profile.updatedAt) - new Date(resumeFile.createdAt) > 60000;

  const uploadButton = (
    <Button
      variant="secondary"
      icon={ArrowUpTrayIcon}
      loading={isUploading}
      onClick={() => fileRef.current?.click()}
    >
      {isUploaded ? 'Replace my PDF' : 'Upload my own PDF'}
    </Button>
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Student"
        title="My resume"
        lead="Generate a PDF from your profile, then share it with recruiters and your TPO."
        actions={
          <>
            {/* Download is never hidden behind profile completion: a student
                with a resume must always be able to get it back. */}
            {hasResume && (
              <Button icon={ArrowDownTrayIcon} onClick={handleDownloadResume}>
                Download PDF
              </Button>
            )}
            {isProfileComplete ? (
              <Button
                variant={hasResume ? 'secondary' : 'primary'}
                icon={hasResume ? ArrowPathIcon : DocumentTextIcon}
                loading={isGenerating}
                onClick={handleGenerateResume}
              >
                {hasResume ? (isUploaded ? 'Generate from profile' : 'Regenerate') : 'Generate resume'}
              </Button>
            ) : (
              <Button as={Link} to="/profile" variant="saffron" icon={ExclamationTriangleIcon}>
                Complete profile
              </Button>
            )}
            {uploadButton}
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Upload your resume as a PDF"
        onChange={(e) => handleUploadResume(e.target.files?.[0])}
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

      {hasResume && isStale && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-saffron-500/40 bg-saffron-50 p-4 text-sm text-saffron-900">
          <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Your profile has changed since this PDF was made, so it may be out of date. Regenerate it so
            new applications get the current version.
          </p>
        </div>
      )}

      {hasResume && isUploaded ? (
        // An uploaded CV has its own layout; previewing the profile here would
        // show the student something recruiters never receive.
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-950/15 bg-bone-100 text-ink-700"
            >
              <DocumentTextIcon className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
                <CheckCircleIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-india-600" />
                Using your own resume
              </p>
              <p className="break-words text-sm text-ink-600">
                {resumeFile.originalName}
                {formatWhen(resumeFile.createdAt) ? ` · uploaded ${formatWhen(resumeFile.createdAt)}` : ''}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-600">
            This PDF goes with every new application. Jobs you already applied to keep the resume you
            sent at the time.
          </p>
        </Card>
      ) : hasResume ? (
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-950/10 bg-bone-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
              <CheckCircleIcon aria-hidden="true" className="h-5 w-5 text-india-600" />
              Resume generated
            </h2>
            <Badge tone="neutral">
              {formatWhen(resumeFile?.createdAt) ? `Made ${formatWhen(resumeFile.createdAt)}` : 'Preview of your PDF'}
            </Badge>
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
              ? 'Your profile is ready. Generate a resume from it, or upload your own PDF. You need one to apply for jobs.'
              : 'Complete your profile to generate a resume from it, or upload your own PDF now. You need one to apply for jobs.'
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
