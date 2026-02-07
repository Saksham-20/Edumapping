// client/src/pages/events/EventDetails.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import {
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
  ShareIcon,
  LinkIcon
} from '@heroicons/react/24/outline';

const EventDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/events/${id}`);
      setEvent(response.event || null);
      setIsRegistered(Boolean(response.event?.userRegistration));
    } catch (error) {
      console.error('Failed to fetch event:', error);
      toast.error('Event not found');
      navigate('/events');
    } finally {
      setIsLoading(false);
    }
  };

  const getEventTypeColor = (type) => {
    const colors = {
      campus_drive: 'bg-blue-100 text-blue-800',
      info_session: 'bg-green-100 text-green-800',
      workshop: 'bg-purple-100 text-purple-800',
      seminar: 'bg-yellow-100 text-yellow-800',
      job_fair: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors.other;
  };

  const formatEventTime = (startTime, endTime) => {
    if (!startTime || !endTime) return { dateStr: '', timeStr: '' };
    const start = new Date(startTime);
    const end = new Date(endTime);
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    return { dateStr, timeStr };
  };

  const isEventFull = () => {
    return event?.maxParticipants && (event.registrationCount || 0) >= event.maxParticipants;
  };

  const isRegistrationOpen = () => {
    if (!event) return false;
    if (event.registrationDeadline) {
      return new Date() <= new Date(event.registrationDeadline);
    }
    return new Date() < new Date(event.startTime);
  };

  const canEdit = user && user.role !== 'student' && event?.organizationId === (user.organizationId || event?.organizationId);

  const handleRegister = async (register = true) => {
    if (!event?.id) return;
    try {
      setActionLoading(true);
      if (register) {
        await api.post(`/events/${event.id}/register`);
        setIsRegistered(true);
        toast.success('Successfully registered for this event!');
      } else {
        await api.post(`/events/${event.id}/cancel`);
        setIsRegistered(false);
        toast.success('Registration cancelled');
      }
      fetchEvent();
    } catch (error) {
      console.error('Register/cancel failed:', error);
      toast.error(register ? 'Failed to register' : 'Failed to cancel registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event?.id}`;
    const result = await shareUrl({
      title: event?.title || 'Campus Event',
      text: event?.title ? `Join: ${event.title}` : 'Check out this event',
      url
    });
    if (result?.shared) toast.success('Shared');
    else if (result?.copied) toast.success('Link copied');
    else toast.error('Could not share');
  };

  const handleJoinMeeting = () => {
    if (!event?.virtualLink) return;
    const ok = openMeetingLink(event.virtualLink);
    if (!ok) toast.error('Invalid meeting link');
  };

  if (isLoading || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const { dateStr, timeStr } = formatEventTime(event.startTime, event.endTime);
  const full = isEventFull();
  const registrationOpen = isRegistrationOpen();
  const canRegister = user?.role === 'student' && registrationOpen && !full;
  const isGlobal = (event.organization?.name || '').toLowerCase() === 'edumapping';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/events')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to events
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getEventTypeColor(event.eventType)}`}>
                {event.eventType?.replace('_', ' ').toUpperCase()}
              </span>
              {isGlobal && (
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                  Global
                </span>
              )}
              {event.status && event.status !== 'scheduled' && (
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {event.status}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {event.title}
            </h1>
            {event.organization?.name && (
              <div className="flex items-center text-gray-600 mb-6">
                <BuildingOfficeIcon className="h-5 w-5 mr-2 text-gray-400" />
                <span>{event.organization.name}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {dateStr && (
                <div className="flex items-start">
                  <CalendarIcon className="h-5 w-5 mr-3 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{dateStr}</p>
                    {timeStr && <p className="text-gray-600">{timeStr}</p>}
                  </div>
                </div>
              )}
              {event.location && (
                <div className="flex items-start">
                  <MapPinIcon className="h-5 w-5 mr-3 text-gray-400 mt-0.5" />
                  <p className="text-gray-700">{event.location}</p>
                </div>
              )}
              <div className="flex items-center text-gray-600">
                <UserGroupIcon className="h-5 w-5 mr-3 text-gray-400" />
                <span>
                  {event.registrationCount ?? 0}
                  {event.maxParticipants ? ` / ${event.maxParticipants} registered` : ' registered'}
                  {full && <span className="ml-2 text-red-600 font-semibold">(Full)</span>}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="prose prose-gray max-w-none mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {(event.contactEmail || event.contactPhone) && (
              <div className="text-sm text-gray-600 mb-6">
                {event.contactEmail && <p>Contact: {event.contactEmail}</p>}
                {event.contactPhone && <p>Phone: {event.contactPhone}</p>}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
              {canRegister && (
                <button
                  onClick={() => handleRegister(true)}
                  disabled={actionLoading || isRegistered}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegistered ? 'Registered' : 'Register for this event'}
                </button>
              )}
              {user?.role === 'student' && isRegistered && registrationOpen && (
                <button
                  onClick={() => handleRegister(false)}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel registration
                </button>
              )}
              {event.virtualLink && (
                <button
                  onClick={handleJoinMeeting}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <LinkIcon className="h-5 w-5 mr-2" />
                  Join meeting
                </button>
              )}
              <button
                onClick={handleShare}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <ShareIcon className="h-5 w-5 mr-2" />
                Share
              </button>
              {canEdit && (
                <button
                  onClick={() => navigate(`/events/${event.id}/edit`)}
                  className="inline-flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  <PencilSquareIcon className="h-5 w-5 mr-2" />
                  Edit event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
