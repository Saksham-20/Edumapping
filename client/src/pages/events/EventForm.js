// client/src/pages/events/EventForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { isValidURL } from '../../utils/helpers';

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

  useEffect(() => {
    if (isEditing) {
      fetchEvent();
    }
    if (user?.role === 'admin') {
      fetchOrganizations();
    }
  }, [id]);

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

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/organizations?verified=all&limit=200');
      const orgs = res.organizations || [];
      // Put EduMapping first if present (global events)
      const edu = orgs.find(o => (o.name || '').toLowerCase() === 'edumapping');
      const rest = orgs.filter(o => (o.name || '').toLowerCase() !== 'edumapping');
      setOrgOptions(edu ? [edu, ...rest] : orgs);
    } catch (e) {
      console.error('Failed to fetch organizations:', e);
      // Not fatal; admin can still paste org id if needed
    }
  };

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      const event = response.event;
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        eventType: event.eventType || 'campus_drive',
        location: event.location || '',
        startTime: event.startTime ? event.startTime.split('T')[0] + 'T' + event.startTime.split('T')[1] : '',
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
      console.error('Failed to fetch event:', error);
      toast.error('Failed to load event details');
      navigate('/events');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
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
        status: formData.status,
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
      console.error('Error saving event:', error);
      if (error.data && error.data.details) {
        // Show specific validation errors
        const errorMessages = error.data.details.map(detail => detail.message).join(', ');
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

  const eventTypes = [
    { value: 'campus_drive', label: 'Campus Drive' },
    { value: 'info_session', label: 'Information Session' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'seminar', label: 'Seminar' },
    { value: 'job_fair', label: 'Job Fair' },
    { value: 'other', label: 'Other' }
  ];

  if (!user || user.role === 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You are not authorized to create events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Event' : 'Create New Event'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditing ? 'Update event details' : 'Fill in the details below to create a new event'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {user?.role === 'admin' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization *
                  </label>
                  <select
                    name="organizationId"
                    value={formData.organizationId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select organization</option>
                    {orgOptions.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name?.toLowerCase() === 'edumapping'
                          ? 'EduMapping (Global - visible to all)'
                          : `${org.name} (${org.type})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select <b>EduMapping (Global)</b> to create an event visible to all organizations and students.
                  </p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter event title"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type *
                </label>
                <select
                  name="eventType"
                  value={formData.eventType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="No limit if empty"
                />
              </div>
            </div>

            {/* Online Event Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Platform
                </label>
                <select
                  name="meetingPlatform"
                  value={formData.meetingPlatform}
                  onChange={(e) => {
                    const nextPlatform = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      meetingPlatform: nextPlatform,
                      virtualLink: nextPlatform === 'none' ? '' : prev.virtualLink
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">In-person / No virtual meeting</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="custom">Other (paste link)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Virtual Meeting Link
                </label>
                <input
                  type="url"
                  name="virtualLink"
                  value={formData.virtualLink}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    formData.meetingPlatform === 'zoom'
                      ? 'https://zoom.us/j/...'
                      : formData.meetingPlatform === 'google_meet'
                      ? 'https://meet.google.com/...'
                      : 'https://...'
                  }
                  disabled={formData.meetingPlatform === 'none'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.meetingPlatform === 'none'
                    ? 'This event will be treated as in-person (no virtual link).'
                    : 'Paste the meeting invite link. On Join, users will be redirected to the respective app when possible.'}
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the event, agenda, and what participants can expect..."
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventForm;
