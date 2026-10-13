// client/src/pages/events/EventForm.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { describeApiError, fieldErrorsFrom } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  EmptyState,
  PageLoader,
  Input,
  PageHeader,
  PageShell,
  SectionBlock,
  Select,
  Textarea
} from '../../components/ui';
import { LockClosedIcon } from '@heroicons/react/24/outline';

const EVENT_TYPES = [
  { value: 'campus_drive', label: 'Campus Drive' },
  { value: 'info_session', label: 'Information Session' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'job_fair', label: 'Job Fair' },
  { value: 'other', label: 'Other' }
];

/**
 * ISO timestamp → the "YYYY-MM-DDTHH:mm" a datetime-local input accepts, in
 * the viewer's own timezone. Splitting the ISO string on "T" (as this did)
 * left "…:00.000Z" on the end, which the input rejects, so every field came up
 * blank on edit; and it would have shown UTC, five and a half hours off in IST.
 */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

/** Adds https:// to a pasted link that has no scheme (meet.google.com/abc). */
const withScheme = (url) => (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `https://${url}` : url);

const isHttpUrl = (url) => {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
};

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Published — students can see it and register' },
  { value: 'draft', label: 'Draft — only organizers can see it' },
  { value: 'cancelled', label: 'Cancelled — shown as cancelled, registration closed' },
  { value: 'completed', label: 'Completed' }
];

const EventForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(Boolean(id));
  // Set when the loaded event belongs to another institution: the server
  // would refuse the save, so the form is not offered at all.
  const [forbidden, setForbidden] = useState(false);
  const [errors, setErrors] = useState({});
  const [orgOptions, setOrgOptions] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'campus_drive',
    location: '',
    startTime: '',
    endTime: '',
    maxParticipants: '',
    meetingPlatform: 'none',
    virtualLink: '',
    registrationDeadline: '',
    organizationId: '',
    status: 'scheduled'
  });

  const isEditing = Boolean(id);

  const inferMeetingPlatform = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (host.includes('zoom.us')) return 'zoom';
      if (host.includes('meet.google.com')) return 'google_meet';
      return 'custom';
    } catch {
      return 'custom';
    }
  };

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await api.get('/organizations?verified=all&limit=200', { silent: true });
      const orgs = res.organizations || [];
      // Put EduMapping first if present (global events)
      const edu = orgs.find((o) => (o.name || '').toLowerCase() === 'edumapping');
      const rest = orgs.filter((o) => (o.name || '').toLowerCase() !== 'edumapping');
      setOrgOptions(edu ? [edu, ...rest] : orgs);
    } catch (e) {
      // Not fatal: the select stays empty and the field error explains it.
      setErrors((prev) => ({
        ...prev,
        organizationId: 'Could not load the list of organizations. Reload the page to try again.'
      }));
    }
  }, []);

  const fetchEvent = useCallback(async () => {
    try {
      const response = await api.get(`/events/${id}`, { silent: true });
      const event = response.event;

      if (
        user &&
        user.role !== 'admin' &&
        (!user.organizationId || user.organizationId !== event.organizationId)
      ) {
        setForbidden(true);
        return;
      }

      setFormData({
        title: event.title || '',
        description: event.description || '',
        eventType: event.eventType || 'campus_drive',
        location: event.location || '',
        startTime: toLocalInput(event.startTime),
        endTime: toLocalInput(event.endTime),
        maxParticipants: event.maxParticipants || '',
        meetingPlatform: event.virtualLink ? inferMeetingPlatform(event.virtualLink) : 'none',
        virtualLink: event.virtualLink || '',
        registrationDeadline: toLocalInput(event.registrationDeadline),
        organizationId: event.organizationId || '',
        status: event.status || 'draft'
      });
    } catch (error) {
      toast.error(
        error?.status === 404
          ? 'That event no longer exists.'
          : 'Could not load the event. Check your connection and try again.'
      );
      navigate('/events');
    } finally {
      setLoadingEvent(false);
    }
  }, [id, navigate, user]);

  useEffect(() => {
    if (isEditing) fetchEvent();
    if (user?.role === 'admin') fetchOrganizations();
  }, [isEditing, fetchEvent, fetchOrganizations, user?.role]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  /** Client-side checks, one message per field, shown under that field. */
  const validate = () => {
    const errs = {};
    const title = formData.title.trim();
    if (title.length < 3) errs.title = 'Give the event a title of at least 3 characters';
    if (!formData.description.trim()) errs.description = 'Describe the event so students know what to expect';
    if (!formData.startTime) errs.startTime = 'Choose when the event starts';
    if (!formData.endTime) errs.endTime = 'Choose when the event ends';
    const start = formData.startTime ? new Date(formData.startTime) : null;
    const end = formData.endTime ? new Date(formData.endTime) : null;
    if (start && end && start >= end) errs.endTime = 'The event must end after it starts';
    if (!isEditing && start && start.getTime() < Date.now() - 5 * 60 * 1000) {
      errs.startTime = 'This time is in the past. Pick a future date and time.';
    }
    if (formData.registrationDeadline && end && new Date(formData.registrationDeadline) > end) {
      errs.registrationDeadline = 'Registration must close before the event ends';
    }
    if (formData.maxParticipants !== '' && formData.maxParticipants != null) {
      const n = Number(formData.maxParticipants);
      if (!Number.isInteger(n) || n < 1) errs.maxParticipants = 'Enter a whole number of 1 or more, or leave it empty';
    }
    if (user?.role === 'admin' && !String(formData.organizationId || '').trim()) {
      errs.organizationId = 'Choose which organization is running this event';
    }
    const link = formData.virtualLink.trim();
    if (formData.meetingPlatform !== 'none' && !link) {
      errs.virtualLink = 'Paste the meeting link, or choose "In-person" above';
    } else if (link && !isHttpUrl(withScheme(link))) {
      errs.virtualLink = 'Enter a full meeting link, for example https://meet.google.com/abc-defg-hij';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // a second tap while saving must not create a twin

    if (!user || user.role === 'student') {
      toast.error('Students cannot create events. Ask your placement office or teacher.');
      return;
    }

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Some details need fixing. Check the highlighted fields.');
      return;
    }

    try {
      setLoading(true);

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        eventType: formData.eventType,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        status: formData.status,
        // Optional fields are always sent: an empty string tells the server to
        // clear them. Only sending filled ones meant a link or limit, once
        // set, could never be removed on edit.
        location: formData.location.trim(),
        maxParticipants: formData.maxParticipants === '' ? '' : Number(formData.maxParticipants),
        virtualLink: formData.meetingPlatform === 'none' ? '' : withScheme(formData.virtualLink.trim()),
        registrationDeadline: formData.registrationDeadline
          ? new Date(formData.registrationDeadline).toISOString()
          : ''
      };

      // Admins may not be attached to an organization; send organizationId explicitly
      if (user.role === 'admin') {
        eventData.organizationId = parseInt(formData.organizationId, 10);
      }

      // `silent`: the catch below puts the reason under the field it is about.
      const response = isEditing
        ? await api.put(`/events/${id}`, eventData, { silent: true })
        : await api.post('/events', eventData, { silent: true });
      toast.success(isEditing ? 'Event updated' : 'Event created');
      navigate(`/events/${response.event.id}`);
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(describeApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role === 'student') {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={LockClosedIcon}
          title="Only organizers can create events"
          description="Students cannot create events. If you want an event added, ask your placement office or teacher."
          action={
            <Button variant="secondary" onClick={() => navigate('/events')}>
              Back to events
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (forbidden) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={LockClosedIcon}
          title="You cannot edit this event"
          description="It is run by another institution. Only its own organizers can change it."
          action={
            <Button variant="secondary" onClick={() => navigate(`/events/${id}`)}>
              Back to the event
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (loadingEvent) {
    return (
      <PageShell width="narrow">
        <PageLoader label="Loading event" />
      </PageShell>
    );
  }

  const linkPlaceholder =
    formData.meetingPlatform === 'zoom'
      ? 'https://zoom.us/j/...'
      : formData.meetingPlatform === 'google_meet'
      ? 'https://meet.google.com/...'
      : 'https://...';

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: 'Events', to: '/events' },
          { label: isEditing ? 'Edit event' : 'New event' }
        ]}
        eyebrow={isEditing ? 'Edit' : 'Create'}
        title={isEditing ? 'Edit event' : 'Create an event'}
        lead={
          isEditing
            ? 'Update the details students will see.'
            : 'Fill in the details below to publish a campus event.'
        }
      />

      <form onSubmit={handleSubmit} noValidate>
        <SectionBlock title="Basics">
          <Card className="space-y-5">
            {user?.role === 'admin' && (
              <Select
                label="Organization"
                required
                name="organizationId"
                value={formData.organizationId}
                onChange={handleInputChange}
                error={errors.organizationId}
                help="Choose EduMapping (Global) to create an event visible to every organization and student."
              >
                <option value="">Select organization</option>
                {orgOptions.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name?.toLowerCase() === 'edumapping'
                      ? 'EduMapping (Global — visible to all)'
                      : `${org.name} (${org.type})`}
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="Event title"
              required
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              error={errors.title}
              placeholder="Campus drive — TechCorp"
            />

            <Select
              label="Event type"
              required
              name="eventType"
              value={formData.eventType}
              onChange={handleInputChange}
              options={EVENT_TYPES}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Start time"
                required
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                error={errors.startTime}
              />
              <Input
                label="End time"
                required
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                error={errors.endTime}
              />
              <Input
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                error={errors.location}
                placeholder="Auditorium, Block C"
              />
              <Input
                label="Max participants"
                type="number"
                min="1"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleInputChange}
                error={errors.maxParticipants}
                placeholder="No limit if empty"
              />
              <Input
                label="Registration closes"
                type="datetime-local"
                name="registrationDeadline"
                value={formData.registrationDeadline}
                onChange={handleInputChange}
                error={errors.registrationDeadline}
                help="Optional. If empty, registration closes when the event starts."
              />
              <Select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                error={errors.status}
                options={
                  isEditing ? STATUS_OPTIONS : STATUS_OPTIONS.filter((o) => ['scheduled', 'draft'].includes(o.value))
                }
              />
            </div>

            <Textarea
              label="Event description"
              required
              rows={6}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              error={errors.description}
              placeholder="Describe the event, the agenda, and what participants can expect…"
            />
          </Card>
        </SectionBlock>

        <SectionBlock title="Online access">
          <Card className="space-y-5">
            <Select
              label="Meeting platform"
              name="meetingPlatform"
              value={formData.meetingPlatform}
              onChange={(e) => {
                const nextPlatform = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  meetingPlatform: nextPlatform,
                  virtualLink: nextPlatform === 'none' ? '' : prev.virtualLink
                }));
                setErrors((prev) => ({ ...prev, virtualLink: undefined }));
              }}
              options={[
                { value: 'none', label: 'In-person / no virtual meeting' },
                { value: 'google_meet', label: 'Google Meet' },
                { value: 'zoom', label: 'Zoom' },
                { value: 'custom', label: 'Other (paste link)' }
              ]}
            />
            <Input
              label="Virtual meeting link"
              type="url"
              name="virtualLink"
              value={formData.virtualLink}
              onChange={handleInputChange}
              placeholder={linkPlaceholder}
              error={errors.virtualLink}
              disabled={formData.meetingPlatform === 'none'}
              help={
                formData.meetingPlatform === 'none'
                  ? 'This event will be treated as in-person (no virtual link).'
                  : 'Paste the meeting invite link. Students see a Join button on the event.'
              }
            />
          </Card>
        </SectionBlock>

        <div className="flex justify-end gap-2 border-t border-ink-950/10 pt-6">
          <Button type="button" variant="secondary" onClick={() => navigate('/events')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Update event' : 'Create event'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
};

export default EventForm;
