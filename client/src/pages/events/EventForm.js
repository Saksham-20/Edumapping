// client/src/pages/events/EventForm.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { isValidURL } from '../../utils/helpers';
import {
  Button,
  Card,
  EmptyState,
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

const EventForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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
    organizationId: '',
    contactEmail: '',
    contactPhone: '',
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
      const res = await api.get('/organizations?verified=all&limit=200');
      const orgs = res.organizations || [];
      // Put EduMapping first if present (global events)
      const edu = orgs.find((o) => (o.name || '').toLowerCase() === 'edumapping');
      const rest = orgs.filter((o) => (o.name || '').toLowerCase() !== 'edumapping');
      setOrgOptions(edu ? [edu, ...rest] : orgs);
    } catch (e) {
      // Not fatal; admin can still paste an org id if needed.
      console.error('Failed to fetch organizations:', e);
    }
  }, []);

  const fetchEvent = useCallback(async () => {
    try {
      const response = await api.get(`/events/${id}`);
      const event = response.event;

      setFormData({
        title: event.title || '',
        description: event.description || '',
        eventType: event.eventType || 'campus_drive',
        location: event.location || '',
        startTime: event.startTime
          ? event.startTime.split('T')[0] + 'T' + event.startTime.split('T')[1]
          : '',
        endTime: event.endTime ? event.endTime.split('T')[0] + 'T' + event.endTime.split('T')[1] : '',
        maxParticipants: event.maxParticipants || '',
        meetingPlatform: event.virtualLink ? inferMeetingPlatform(event.virtualLink) : 'none',
        virtualLink: event.virtualLink || '',
        organizationId: event.organizationId || '',
        contactEmail: event.contactEmail || '',
        contactPhone: event.contactPhone || '',
        status: event.status || 'draft'
      });
    } catch (error) {
      toast.error('Failed to load event details');
      navigate('/events');
    }
  }, [id, navigate]);

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || user.role === 'student') {
      toast.error('You are not authorized to create events');
      return;
    }

    // Frontend validation
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Event description is required');
      return;
    }

    if (!formData.startTime) {
      toast.error('Start time is required');
      return;
    }

    if (!formData.endTime) {
      toast.error('End time is required');
      return;
    }

    if (new Date(formData.startTime) >= new Date(formData.endTime)) {
      toast.error('End time must be after start time');
      return;
    }

    if (user.role === 'admin' && (!formData.organizationId || !String(formData.organizationId).trim())) {
      toast.error('Please select an organization');
      return;
    }

    if (formData.meetingPlatform !== 'none' && (!formData.virtualLink || !formData.virtualLink.trim())) {
      toast.error('Please provide the meeting link');
      return;
    }

    if (formData.virtualLink && formData.virtualLink.trim() && !isValidURL(formData.virtualLink.trim())) {
      toast.error('Please provide a valid meeting link URL');
      return;
    }

    try {
      setLoading(true);

      // Clean and format the data
      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        eventType: formData.eventType,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        status: formData.status
        // server will set organizationId/createdBy from token
      };

      // Admins may not be attached to an organization; send organizationId explicitly
      if (user.role === 'admin') {
        eventData.organizationId = parseInt(formData.organizationId);
      }

      // Only add optional fields if they have values
      if (formData.location && formData.location.trim()) {
        eventData.location = formData.location.trim();
      }

      if (formData.maxParticipants && formData.maxParticipants > 0) {
        eventData.maxParticipants = parseInt(formData.maxParticipants);
      }

      if (formData.virtualLink && formData.virtualLink.trim()) {
        eventData.virtualLink = formData.virtualLink.trim();
      }

      let response;
      if (isEditing) {
        response = await api.put(`/events/${id}`, eventData);
        toast.success('Event updated successfully!');
      } else {
        response = await api.post('/events', eventData);
        toast.success('Event created successfully!');
      }

      navigate(`/events/${response.event.id}`);
    } catch (error) {
      if (error.data && error.data.details) {
        // Show specific validation errors
        const errorMessages = error.data.details.map((detail) => detail.message).join(', ');
        toast.error(`Validation error: ${errorMessages}`);
      } else if (error.status === 403) {
        toast.error('You are not authorized to create events');
      } else {
        toast.error('Failed to save event');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role === 'student') {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={LockClosedIcon}
          title="Access denied"
          description="You are not authorized to create events."
          action={
            <Button variant="secondary" onClick={() => navigate('/events')}>
              Back to events
            </Button>
          }
        />
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
              />
              <Input
                label="End time"
                required
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
              />
              <Input
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Auditorium, Block C"
              />
              <Input
                label="Max participants"
                type="number"
                min="1"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleInputChange}
                placeholder="No limit if empty"
              />
            </div>

            <Textarea
              label="Event description"
              required
              rows={6}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
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
              disabled={formData.meetingPlatform === 'none'}
              help={
                formData.meetingPlatform === 'none'
                  ? 'This event will be treated as in-person (no virtual link).'
                  : 'Paste the meeting invite link. On Join, users are redirected to the app where possible.'
              }
            />
          </Card>
        </SectionBlock>

        <SectionBlock title="Contact">
          <Card>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Contact email"
                type="email"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                placeholder="contact@example.com"
              />
              <Input
                label="Contact phone"
                type="tel"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleInputChange}
                placeholder="+91 90000 00000"
              />
            </div>
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
