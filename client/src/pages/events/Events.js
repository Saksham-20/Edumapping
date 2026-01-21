// client/src/pages/events/Events.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import {
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  ClockIcon,
  BuildingOfficeIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

const Events = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [registeredEvents, setRegisteredEvents] = useState(new Set());

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);

      // Students should only see scheduled events in Upcoming.
      // Non-students may create drafts; include them in Upcoming so creators can find their events.
      const statusParam =
        filter === 'upcoming'
          ? (user?.role === 'student' ? 'scheduled' : 'all')
          : 'all';

      const params = new URLSearchParams({
        upcoming: filter === 'upcoming' ? 'true' : 'false',
        status: statusParam,
        limit: '20'
      });

      const response = await api.get(`/events?${params}`);
      
      setEvents(response.events || []);
      
      // Track registered events
      const registered = new Set();
      response.events?.forEach(event => {
        if (event.userRegistration) {
          registered.add(event.id);
        }
      });
      setRegisteredEvents(registered);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventRegistration = async (eventId, isRegistering = true) => {
    try {
      if (isRegistering) {
        await api.post(`/events/${eventId}/register`);
        setRegisteredEvents(prev => new Set([...prev, eventId]));
        toast.success('Successfully registered for event!');
      } else {
        await api.post(`/events/${eventId}/cancel`);
        setRegisteredEvents(prev => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
        toast.success('Registration cancelled successfully');
      }
      
      // Refresh events to get updated registration count
      fetchEvents();
    } catch (error) {
      console.error('Failed to register for event:', error);
      toast.error(isRegistering ? 'Failed to register for event' : 'Failed to cancel registration');
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

  const getEventTypeIcon = (type) => {
    const icons = {
      campus_drive: BuildingOfficeIcon,
      info_session: UserGroupIcon,
      workshop: ClockIcon,
      seminar: CalendarIcon,
      job_fair: BuildingOfficeIcon,
      other: CalendarIcon
    };
    return icons[type] || icons.other;
  };

  const formatEventTime = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const timeStr = `${start.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })} - ${end.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    
    return { dateStr, timeStr };
  };

  const isEventFull = (event) => {
    return event.maxParticipants && event.registrationCount >= event.maxParticipants;
  };

  const isRegistrationOpen = (event) => {
    if (event.registrationDeadline) {
      return new Date() <= new Date(event.registrationDeadline);
    }
    return new Date() < new Date(event.startTime);
  };

  const EventCard = ({ event }) => {
    const { dateStr, timeStr } = formatEventTime(event.startTime, event.endTime);
    const TypeIcon = getEventTypeIcon(event.eventType);
    const isRegistered = registeredEvents.has(event.id);
    const isFull = isEventFull(event);
    const canRegister = isRegistrationOpen(event) && !isFull;
    const isGlobal = (event.organization?.name || '').toLowerCase() === 'edumapping';

    const handleShare = async () => {
      const url = `${window.location.origin}/events/${event.id}`;
      const result = await shareUrl({
        title: event.title || 'Campus Event',
        text: event.title ? `Join: ${event.title}` : 'Check out this event',
        url
      });
      if (result.shared) toast.success('Shared');
      else if (result.copied) toast.success('Link copied');
      else toast.error('Could not share');
    };

    const handleJoin = () => {
      if (!event.virtualLink) return;
      const ok = openMeetingLink(event.virtualLink);
      if (!ok) toast.error('Invalid meeting link');
    };

    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${getEventTypeColor(event.eventType)}`}>
                <TypeIcon className="h-6 w-6" />
              </div>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(event.eventType)}`}>
                  {event.eventType.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center text-sm text-gray-500">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              {event.registrationCount || 0}
              {event.maxParticipants && ` / ${event.maxParticipants}`}
              {isFull && <span className="ml-2 text-red-600 font-medium">FULL</span>}
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            <button
              onClick={() => navigate(`/events/${event.id}`)}
              className="text-left hover:underline"
            >
              {event.title}
            </button>
          </h3>

          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {event.description}
          </p>

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <div className="flex items-center">
              <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
              <span>{event.organization?.name}</span>
              {isGlobal && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  Global
                </span>
              )}
            </div>
            
            <div className="flex items-center">
              <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
              {dateStr}
            </div>
            
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
              {timeStr}
            </div>
            
            {event.location && (
              <div className="flex items-center">
                <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />
                {event.location}
              </div>
            )}

            {event.registrationDeadline && (
              <div className="flex items-center text-orange-600">
                <ClockIcon className="h-4 w-4 mr-2" />
                Registration closes: {new Date(event.registrationDeadline).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              {isRegistered && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckIcon className="h-3 w-3 mr-1" />
                  Registered
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleShare}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <ShareIcon className="h-4 w-4 mr-1" />
                Share
              </button>

              {user.role === 'student' && (
                <>
                  {isRegistered ? (
                    <button
                      onClick={() => handleEventRegistration(event.id, false)}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Cancel Registration
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEventRegistration(event.id, true)}
                      disabled={!canRegister}
                      className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded ${
                        canRegister
                          ? 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                          : 'border-gray-300 text-gray-500 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      {isFull ? 'Event Full' : !isRegistrationOpen(event) ? 'Registration Closed' : 'Register'}
                    </button>
                  )}
                </>
              )}

              {event.virtualLink && (
                <button
                  onClick={handleJoin}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                >
                  Join Virtual Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Campus Events</h1>
          <p className="text-gray-600 mt-1">
            Discover networking opportunities, workshops, and career events
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-4">
              <button
                onClick={() => setFilter('upcoming')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  filter === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Upcoming Events
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                All Events
              </button>
              {user.role === 'student' && (
                <button
                  onClick={() => setFilter('registered')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filter === 'registered'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  My Events
                </button>
              )}
            </div>

            {user.role !== 'student' && (
              <button
                onClick={() => navigate('/events/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Event
              </button>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="large" />
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No events found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'upcoming' 
                ? 'There are no upcoming events at the moment.'
                : filter === 'registered'
                ? "You haven't registered for any events yet."
                : 'No events match your current filter.'
              }
            </p>
            
            {filter === 'registered' && (
              <div className="mt-6">
                <button
                  onClick={() => setFilter('upcoming')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Browse Events
                </button>
              </div>
            )}
          </div>
        )}

        {/* Event Tips for Students */}
        {user.role === 'student' && events.length > 0 && (
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Make the Most of Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Prepare questions about the company and role opportunities
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Bring copies of your resume and dress professionally
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Network with recruiters and other students
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Follow up with connections made at the event
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Take notes during presentations and workshops
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 mr-3"></span>
                  Register early as popular events fill up quickly
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;