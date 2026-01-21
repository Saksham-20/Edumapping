import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);

  const eventUrl = useMemo(() => `${window.location.origin}/events/${id}`, [id]);

  const fetchEvent = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/events/${id}`);
      setEvent(res.event);
      setIsRegistered(Boolean(res.event?.userRegistration));
    } catch (e) {
      console.error('Failed to fetch event:', e);
      toast.error('Failed to load event');
      navigate('/events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleShare = async () => {
    const result = await shareUrl({
      title: event?.title || 'Campus Event',
      text: event?.title ? `Join: ${event.title}` : 'Check out this event',
      url: eventUrl
    });

    if (result.shared) toast.success('Shared');
    else if (result.copied) toast.success('Link copied');
    else toast.error('Could not share');
  };

  const handleJoin = () => {
    if (!event?.virtualLink) return;
    const ok = openMeetingLink(event.virtualLink);
    if (!ok) toast.error('Invalid meeting link');
  };

  const handleRegistration = async (register = true) => {
    try {
      if (!user || user.role !== 'student') return;
      if (register) await api.post(`/events/${id}/register`);
      else await api.post(`/events/${id}/cancel`);
      toast.success(register ? 'Registered successfully' : 'Registration cancelled');
      fetchEvent();
    } catch (e) {
      console.error('Registration error:', e);
      toast.error(register ? 'Failed to register' : 'Failed to cancel registration');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!event) return null;

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const isGlobal = (event.organization?.name || '').toLowerCase() === 'edumapping';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/events')}
            className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Events
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ShareIcon className="h-4 w-4 mr-2" />
              Share
            </button>

            {user?.role !== 'student' && (
              <Link
                to={`/events/${id}/edit`}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PencilSquareIcon className="h-4 w-4 mr-2" />
                Edit
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm text-gray-600">{event.organization?.name}</p>
                  {isGlobal && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Global
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <UserGroupIcon className="h-4 w-4 mr-1 text-gray-400" />
                {event.registrationCount || 0}
                {event.maxParticipants && ` / ${event.maxParticipants}`}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                {start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} -{' '}
                {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {event.location && (
                <div className="flex items-center sm:col-span-2">
                  <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />
                  {event.location}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
              <p className="text-gray-700 whitespace-pre-line">{event.description}</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {event.virtualLink && (
                <button
                  onClick={handleJoin}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Join Event
                </button>
              )}

              {user?.role === 'student' && (
                <>
                  {isRegistered ? (
                    <button
                      onClick={() => handleRegistration(false)}
                      className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                      Cancel Registration
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRegistration(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Register
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;

