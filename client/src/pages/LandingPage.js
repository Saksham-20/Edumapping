import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Slider from 'react-slick';
import WhatsAppChat from '../components/common/WhatsAppChat';
import api from '../services/api';
import { openMeetingLink } from '../utils/helpers';
import { CalendarIcon, ClockIcon, MapPinIcon, BuildingOfficeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import './LandingPage.css';

// Carousel Settings
const carouselSettings = {
  dots: true,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 4000,
  fade: true,
  arrows: false
};

// Audience Configuration
const AUDIENCE = {
  college: {
    heroTitle: "Empowering Colleges with Complete Career Solutions",
    heroSub: "Workshops, career guidance, placements, and training programs designed for college students.",
    ctas: [
      { text: "View College Programs", action: "college" },
      { text: "Talk to Us", action: "contact" }
    ],
    pillars: [
      { 
        icon: "💼", 
        title: "Placements & Internships", 
        desc: "Connect with top employers through our extensive network and streamlined placement portal.",
        color: "from-[#FF9933] to-[#FF9933]"
      },
      { 
        icon: "🏭", 
        title: "Industrial Workshops", 
        desc: "Hands-on workshops with industry experts covering latest technologies and real-world applications.",
        color: "from-[#138808] to-[#138808]"
      },
      { 
        icon: "🎯", 
        title: "Career Guidance & Psychometrics", 
        desc: "Comprehensive assessments and personalized counselling to help students choose the right career path.",
        color: "from-[#FF9933] to-[#138808]"
      },
      { 
        icon: "📚", 
        title: "Skill Training Programs", 
        desc: "Industry-aligned training in tech, soft skills, and domain expertise to make students job-ready.",
        color: "from-[#FF9933] to-[#138808]"
      }
    ],
    whoWeServe: [
      { role: "TPOs & Placement Officers", desc: "Streamline placement processes and connect with employers" },
      { role: "Faculty", desc: "Track student progress and support career development" },
      { role: "Students & Alumni", desc: "Access job opportunities and career resources" }
    ],
    stats: [
      { value: "7500+", label: "Active Students", color: "text-[#FF9933]" },
      { value: "2000+", label: "Placements", color: "text-[#138808]" },
      { value: "50+", label: "Partner Companies", color: "text-[#156395]" }
    ]
  },
  school: {
    heroTitle: "Empowering School Students for Future Success",
    heroSub: "Industrial workshops, psychometric tests for career counselling, training programs, and early internship opportunities.",
    ctas: [
      { text: "View School Programs", action: "school" },
      { text: "Talk to Us", action: "contact" }
    ],
    pillars: [
      { 
        icon: "🏭", 
        title: "Industrial Workshops", 
        desc: "Hands-on workshops exposing students to real-world industry tools, workflows, and career paths.",
        color: "from-[#FF8C42] to-[#FF8C42]"
      },
      { 
        icon: "🧠", 
        title: "Psychometric Tests", 
        desc: "Comprehensive assessments for personalized career counselling and guidance.",
    color: "from-[#138808] to-[#138808]"
      },
      { 
        icon: "🎯", 
        title: "Career Guidance", 
        desc: "Expert mentorship and counselling to help students discover their passion and plan their career path.",
    color: "from-[#FF8C42] to-[#138808]"
      },
      { 
        icon: "📚", 
        title: "Training Programs", 
        desc: "Diverse skill-building programs in tech, creative arts, and soft skills designed for school students.",
    color: "from-[#FF8C42] to-[#138808]"
      }
    ],
    whoWeServe: [
      { role: "School Administrators", desc: "Provide comprehensive career development programs for students" },
      { role: "Career Counsellors", desc: "Access psychometric tools and resources for student guidance" },
      { role: "Students", desc: "Discover career paths and build essential skills early" }
    ],
    stats: [
      { value: "5000+", label: "School Students", color: "text-[#FF8C42]" },
      { value: "100+", label: "Training Programs", color: "text-[#138808]" },
      { value: "300+", label: "Internships", color: "text-[#FF8C42]" }
    ]
  }
};

const LandingPage = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSchoolMode, setIsSchoolMode] = useState(false);
  const [showAudienceContent, setShowAudienceContent] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Fetch upcoming global events
  useEffect(() => {
    const fetchGlobalEvents = async () => {
      try {
        setIsLoadingEvents(true);
        const params = new URLSearchParams({
          upcoming: 'true',
          limit: '6',
          status: 'scheduled'
        });
        const response = await api.get(`/events?${params}`);
        const events = response.events || [];
        // Filter for EduMapping (global) events only
        const globalEvents = events.filter(event => 
          event.organization && 
          event.organization.name && 
          event.organization.name.toLowerCase() === 'edumapping'
        );
        setUpcomingEvents(globalEvents);
      } catch (error) {
        console.error('Failed to fetch events:', error);
        setUpcomingEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchGlobalEvents();
  }, []);

  const closeEventModal = () => setSelectedEvent(null);

  const handleJoinFromLanding = (e, event) => {
    e?.stopPropagation?.();
    if (!event?.virtualLink) return;
    openMeetingLink(event.virtualLink);
  };

  // Scroll animations observer
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setIsMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for your message! We will get back to you soon.');
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeInOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeInOut" } }
  };

  // Unified Overview Section
  const renderUnifiedOverview = () => (
    <div className="page-content">
      {/* Hero Section - EduMapping Overview */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF9933]/10 via-white/50 to-[#138808]/10 z-0" />
        
        <div className="container mx-auto px-4 z-10 pt-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div
              className="flex-1 text-center lg:text-left"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900 leading-tight mt-4 sm:mt-6 lg:mt-8"
                variants={fadeInUp}
              >
                Welcome to <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-md">
                  EduMapping
                </span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-gray-600 mb-4 max-w-2xl mx-auto lg:mx-0"
                variants={fadeInUp}
              >
                <span className="font-semibold text-gray-800">Workshops • Career Guidance • Placements • Training</span>
              </motion.p>

              <motion.p
                className="text-base sm:text-lg text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                variants={fadeInUp}
              >
                We partner with schools and colleges to make students job-ready with essential employability skills, connecting education with employment opportunities.
              </motion.p>

              <motion.div
                className="flex flex-wrap justify-center lg:justify-start gap-4 mb-8"
                variants={fadeInUp}
              >
                <button
                  onClick={() => {
                    setIsSchoolMode(false);
                    setShowAudienceContent(true);
                    window.scrollTo(0, 0);
                  }}
                  className="px-8 py-4 bg-[#138808] text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  View for Colleges
                </button>
                <button
                  onClick={() => {
                    setIsSchoolMode(true);
                    setShowAudienceContent(true);
                    window.scrollTo(0, 0);
                  }}
                  className="px-8 py-4 bg-white text-[#138808] border-2 border-[#138808] rounded-full font-semibold hover:bg-green-50 transition-all transform hover:-translate-y-1"
                >
                  View for Schools
                </button>
                <Link
                  to={isSchoolMode && showAudienceContent ? "/login/school" : "/login/college"}
                  state={{ from: { pathname: '/dashboard' } }}
                  className="px-8 py-4 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-full font-semibold backdrop-blur-md shadow-lg hover:from-[#138808]/60 hover:to-[#138808]/40 hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Try Demo
                </Link>
              </motion.div>

              <motion.div
                className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center"
                variants={fadeInUp}
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#FF9933]">12,500+</div>
                  <div className="text-sm text-gray-600">Active Students</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#156395]">100+</div>
                  <div className="text-sm text-gray-600">Partner Institutions</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#138808]">2,300+</div>
                  <div className="text-sm text-gray-600">Successful Placements</div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="flex-1 w-full max-w-lg lg:max-w-xl"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative rounded-3xl overflow-hidden">
                <Slider {...carouselSettings}>
                  {/* Slide 1: Workshops */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF9933]/20 to-[#FF9933]/5 backdrop-blur-lg border border-[#FF9933]/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF9933]/30 rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF9933]/20 rounded-full -ml-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Industrial Workshops</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Hands-on workshops with industry experts covering real-world applications.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 2: Career Guidance */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#138808]/20 to-[#138808]/5 backdrop-blur-lg border border-[#138808]/20 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-[#138808]/30 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#138808]/20 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Career Guidance</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Expert mentorship and psychometric assessments for personalized career counselling.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 3: Placements */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 backdrop-blur-lg border border-blue-500/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl"></div>
                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Placements</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Connect students with top employers through our extensive placement network.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 4: Training */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 backdrop-blur-lg border border-purple-500/20 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/30 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-pink-500/20 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Training Programs</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Industry-aligned skill training to make students job-ready.
                        </p>
                      </div>
                    </div>
                  </div>
                </Slider>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Do</h2>
            <p className="text-xl text-gray-600">Comprehensive solutions to bridge the gap between education and employment</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                icon: "🏭", 
                title: "Industrial Workshops", 
                desc: "Hands-on workshops with industry experts covering latest technologies and real-world applications.",
                color: "from-[#FF9933] to-[#FF9933]"
              },
              { 
                icon: "🎯", 
                title: "Career Guidance", 
                desc: "Psychometric assessments and personalized counselling to help students choose the right career path.",
                color: "from-[#138808] to-[#138808]"
              },
              { 
                icon: "💼", 
                title: "Placements", 
                desc: "Connect with top employers through our extensive network and streamlined placement portal.",
                color: "from-[#FF9933] to-[#138808]"
              },
              { 
                icon: "📚", 
                title: "Training Programs", 
                desc: "Industry-aligned training in tech, soft skills, and domain expertise to make students job-ready.",
                color: "from-[#FF9933] to-[#138808]"
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                className="relative group p-8 rounded-3xl border border-gray-100 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 group-hover:text-[#FF9933] transition-colors">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Global Events Section */}
      {!isLoadingEvents && upcomingEvents.length > 0 && (
        <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
              <p className="text-xl text-gray-600">Join our global events and workshops</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto">
              {upcomingEvents.map((event, idx) => {
                const startDate = new Date(event.startTime);
                const endDate = new Date(event.endTime);
                const dateStr = startDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                const timeStr = `${startDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })} - ${endDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`;

                return (
                  <motion.div
                    key={event.id}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -5 }}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {event.eventType?.replace('_', ' ').toUpperCase() || 'EVENT'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                            Global
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                          <CalendarIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                        {event.title}
                      </h3>

                      <div className="flex items-center text-sm text-gray-700 mb-4">
                        <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="truncate">{event.organization?.name || 'EduMapping'}</span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-5">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{dateStr}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{timeStr}</span>
                        </div>
                        
                        {event.location && (
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-200 flex justify-end">
                        {event.virtualLink ? (
                          <button
                            onClick={(e) => handleJoinFromLanding(e, event)}
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            Join Event
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Details inside</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/events"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                View All Events
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Landing Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeEventModal}
            />

            <motion.div
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                      Global
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {selectedEvent.eventType?.replace('_', ' ').toUpperCase() || 'EVENT'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h3>
                  <div className="flex items-center text-sm text-gray-700 mt-1">
                    <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{selectedEvent.organization?.name || 'EduMapping'}</span>
                  </div>
                </div>

                <button
                  onClick={closeEventModal}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                    {new Date(selectedEvent.startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                    {new Date(selectedEvent.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(selectedEvent.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center sm:col-span-2">
                      <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />
                      {selectedEvent.location}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">About</h4>
                  <p className="text-gray-700 whitespace-pre-line">{selectedEvent.description}</p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={closeEventModal}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Close
                </button>
                {selectedEvent.virtualLink && (
                  <button
                    onClick={(e) => handleJoinFromLanding(e, selectedEvent)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Join Event
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Who We Work With Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Who We Work With</h2>
            <p className="text-xl text-gray-600">Partnering with educational institutions to empower students</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Colleges */}
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-6 text-center">🎓</div>
              <h3 className="text-3xl font-bold mb-6 text-center text-gray-900">Colleges & Universities</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">TPOs & Placement Officers</p>
                    <p className="text-gray-600 text-sm">Streamline placement processes and connect with employers</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Faculty</p>
                    <p className="text-gray-600 text-sm">Track student progress and support career development</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Students & Alumni</p>
                    <p className="text-gray-600 text-sm">Access job opportunities and career resources</p>
                  </div>
                </li>
              </ul>
              <button
                onClick={() => {
                  setIsSchoolMode(false);
                  setShowAudienceContent(true);
                  window.scrollTo(0, 0);
                }}
                className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-full font-semibold backdrop-blur-md shadow-lg hover:from-[#138808]/60 hover:to-[#138808]/40 transition-all"
              >
                View for Colleges →
              </button>
            </motion.div>

            {/* Schools */}
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-6 text-center">🏫</div>
              <h3 className="text-3xl font-bold mb-6 text-center text-gray-900">Schools</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">School Administrators</p>
                    <p className="text-gray-600 text-sm">Provide comprehensive career development programs for students</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Career Counsellors</p>
                    <p className="text-gray-600 text-sm">Access psychometric tools and resources for student guidance</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Students</p>
                    <p className="text-gray-600 text-sm">Discover career paths and build essential skills early</p>
                  </div>
                </li>
              </ul>
              <button
                onClick={() => {
                  setIsSchoolMode(true);
                  setShowAudienceContent(true);
                  window.scrollTo(0, 0);
                }}
                className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-[#FF8C42]/50 to-[#FF8C42]/30 border border-[#FF8C42]/60 text-white rounded-full font-semibold backdrop-blur-md shadow-lg hover:from-[#FF8C42]/60 hover:to-[#FF8C42]/40 transition-all"
              >
                View for Schools →
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Ready to transform your institution?</h2>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Join hundreds of schools and colleges already using EduMapping to improve student outcomes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => {
                  setIsSchoolMode(false);
                  setShowAudienceContent(true);
                  window.scrollTo(0, 0);
                }}
                className="px-8 py-4 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-full font-bold backdrop-blur-md shadow-lg hover:from-[#138808]/60 hover:to-[#138808]/40 transition-all transform hover:-translate-y-1"
              >
                View for Colleges
              </button>
              <button
                onClick={() => {
                  setIsSchoolMode(true);
                  setShowAudienceContent(true);
                  window.scrollTo(0, 0);
                }}
                className="px-8 py-4 bg-gradient-to-r from-[#FF8C42]/50 to-[#FF8C42]/30 border border-[#FF8C42]/60 text-white rounded-full font-bold backdrop-blur-md shadow-lg hover:from-[#FF8C42]/60 hover:to-[#FF8C42]/40 transition-all transform hover:-translate-y-1"
              >
                View for Schools
              </button>
              <Link
                to={isSchoolMode && showAudienceContent ? "/login/school" : "/login/college"}
                state={{ from: { pathname: '/dashboard' } }}
                className="px-8 py-4 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-full font-bold backdrop-blur-md shadow-lg hover:from-[#138808]/60 hover:to-[#138808]/40 hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Try Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );

  // Audience-Specific Content Renderer
  const renderAudienceContent = () => {
    const audience = isSchoolMode ? AUDIENCE.school : AUDIENCE.college;
    const gradientColors = isSchoolMode 
      ? "from-orange-50 via-white to-green-50" 
      : "from-orange-50 via-white to-green-50";
    const accentGradient = isSchoolMode
      ? "from-[#FF8C42] to-[#138808]"
      : "from-[#FF9933] to-[#138808]";

    return (
      <div className="page-content">
        {/* Hero Section - Audience Specific */}
        <section className={`relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradientColors}`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${isSchoolMode ? 'from-[#FF8C42]/10 via-white/50 to-[#138808]/10' : 'from-[#FF9933]/10 via-white/50 to-[#138808]/10'} z-0`} />
          
          <div className="container mx-auto px-4 z-10 pt-20">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <motion.div
                className="flex-1 text-center lg:text-left"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight mt-4 sm:mt-6 lg:mt-8"
                  variants={fadeInUp}
                >
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isSchoolMode ? 'from-[#FF8C42] to-[#138808]' : 'from-[#FF9933] to-[#138808]'} drop-shadow-md`}>
                    {audience.heroTitle}
                  </span>
                </motion.h1>

                <motion.p
                  className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                  variants={fadeInUp}
                >
                  {audience.heroSub}
                </motion.p>

                <motion.div
                  className="flex flex-wrap justify-center lg:justify-start gap-4 mb-8"
                  variants={fadeInUp}
                >
              <Link
                to={isSchoolMode ? "/login/school" : "/login/college"}
                state={{ from: { pathname: '/dashboard' } }}
                className={`px-8 py-4 bg-gradient-to-r ${isSchoolMode ? 'from-[#FF8C42]/50 to-[#FF8C42]/30 border-[#FF8C42]/60 hover:from-[#FF8C42]/60 hover:to-[#FF8C42]/40' : 'from-[#138808]/50 to-[#138808]/30 border-[#138808]/60 hover:from-[#138808]/60 hover:to-[#138808]/40'} border text-white rounded-full font-semibold backdrop-blur-md shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1`}
              >
                Get Started
              </Link>
                  <button
                    onClick={() => handlePageChange('features')}
                    className={`px-8 py-4 bg-white ${isSchoolMode ? 'text-[#FF8C42] border-2 border-[#FF8C42] hover:bg-orange-50' : 'text-[#138808] border-2 border-[#138808] hover:bg-green-50'} rounded-full font-semibold transition-all transform hover:-translate-y-1`}
                  >
                    Explore Features
                  </button>
                </motion.div>

                <motion.div
                  className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center"
                  variants={fadeInUp}
                >
                  {audience.stats.map((stat, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                      <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-sm text-gray-600">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div
                className="flex-1 w-full max-w-lg lg:max-w-xl"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="relative rounded-3xl overflow-hidden">
                  <Slider {...carouselSettings}>
                    {audience.pillars.map((pillar, idx) => {
                      // Map colors to actual Tailwind classes
                      const colorMap = {
                        'from-[#FF9933] to-[#FF9933]': {
                          bg: 'from-[#FF9933]/20 to-[#FF9933]/5',
                          border: 'border-[#FF9933]/20',
                          blur1: 'bg-[#FF9933]/30',
                          blur2: 'bg-[#FF9933]/20'
                        },
                        'from-[#138808] to-[#138808]': {
                          bg: 'from-[#138808]/20 to-[#138808]/5',
                          border: 'border-[#138808]/20',
                          blur1: 'bg-[#138808]/30',
                          blur2: 'bg-[#138808]/20'
                        },
                        'from-[#FF9933] to-[#138808]': {
                          bg: 'from-[#FF9933]/20 to-[#138808]/5',
                          border: 'border-[#FF9933]/20',
                          blur1: 'bg-[#FF9933]/30',
                          blur2: 'bg-[#138808]/20'
                        },
                        'from-[#FF8C42] to-[#FF8C42]': {
                          bg: 'from-[#FF8C42]/20 to-[#FF8C42]/5',
                          border: 'border-[#FF8C42]/20',
                          blur1: 'bg-[#FF8C42]/30',
                          blur2: 'bg-[#FF8C42]/20'
                        },
                        'from-[#138808] to-[#138808]': {
                          bg: 'from-[#138808]/20 to-[#138808]/5',
                          border: 'border-[#138808]/20',
                          blur1: 'bg-[#138808]/30',
                          blur2: 'bg-[#138808]/20'
                        },
                        'from-[#FF8C42] to-[#138808]': {
                          bg: 'from-[#FF8C42]/20 to-[#138808]/5',
                          border: 'border-[#FF8C42]/20',
                          blur1: 'bg-[#FF8C42]/30',
                          blur2: 'bg-[#138808]/20'
                        }
                      };
                      const colors = colorMap[pillar.color] || colorMap['from-[#FF9933] to-[#138808]'];
                      
                      return (
                        <div key={idx} className="outline-none px-2">
                          <div className={`h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br ${colors.bg} backdrop-blur-lg border ${colors.border} flex items-center justify-center group`}>
                            <div className={`absolute top-0 right-0 w-64 h-64 ${colors.blur1} rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110`}></div>
                            <div className={`absolute bottom-0 left-0 w-48 h-48 ${colors.blur2} rounded-full -ml-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110`}></div>
                            <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                              <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">{pillar.title}</h3>
                              <p className="text-gray-700 text-xl leading-relaxed font-medium">{pillar.desc}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Slider>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Offer</h2>
              <p className="text-xl text-gray-600">Comprehensive solutions tailored for {isSchoolMode ? 'school students' : 'college students'}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {audience.pillars.map((pillar, idx) => (
                <motion.div
                  key={idx}
                  className="relative group p-8 rounded-3xl border border-gray-100 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ y: -10 }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${pillar.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{pillar.icon}</div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-900">{pillar.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{pillar.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Who We Serve Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Who We Serve</h2>
              <p className="text-xl text-gray-600">Supporting {isSchoolMode ? 'schools' : 'colleges'} at every level</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {audience.whoWeServe.map((item, idx) => (
                <motion.div
                  key={idx}
                  className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <h3 className="text-2xl font-bold mb-4 text-gray-900">{item.role}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={`relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br ${gradientColors}`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold mb-6 text-gray-900">Ready to get started?</h2>
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
                Join {isSchoolMode ? 'thousands of school students' : 'hundreds of institutions'} already using EduMapping.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to={isSchoolMode ? "/login/school" : "/login/college"}
                  state={{ from: { pathname: '/dashboard' } }}
                  className={`px-8 py-4 bg-gradient-to-r ${isSchoolMode ? 'from-[#FF8C42]/50 to-[#FF8C42]/30 border-[#FF8C42]/60 hover:from-[#FF8C42]/60 hover:to-[#FF8C42]/40' : 'from-[#138808]/50 to-[#138808]/30 border-[#138808]/60 hover:from-[#138808]/60 hover:to-[#138808]/40'} border text-white rounded-full font-bold backdrop-blur-md shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1`}
                >
                  Get Started
                </Link>
                <button
                  onClick={() => handlePageChange('contact')}
                  className={`px-8 py-4 bg-white ${isSchoolMode ? 'text-[#FF8C42] border-2 border-[#FF8C42] hover:bg-orange-50' : 'text-[#138808] border-2 border-[#138808] hover:bg-green-50'} rounded-full font-bold transition-all transform hover:-translate-y-1`}
                >
                  Contact Us
                </button>
                <button
                  onClick={() => setShowAudienceContent(false)}
                  className="px-8 py-4 bg-gray-200 text-gray-700 rounded-full font-bold hover:bg-gray-300 transition-all"
                >
                  ← Back to Overview
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Upcoming Global Events Section */}
        {!isLoadingEvents && upcomingEvents.length > 0 && (
          <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
                <p className="text-xl text-gray-600">Join our global events and workshops</p>
              </div>

              <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto">
                {upcomingEvents.map((event, idx) => {
                  const startDate = new Date(event.startTime);
                  const endDate = new Date(event.endTime);
                  const dateStr = startDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                  const timeStr = `${startDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} - ${endDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`;

                  return (
                    <motion.div
                      key={event.id}
                      className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-md"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -5 }}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {event.eventType?.replace('_', ' ').toUpperCase() || 'EVENT'}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                              Global
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                            <CalendarIcon className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                          {event.title}
                        </h3>

                        <div className="flex items-center text-sm text-gray-700 mb-4">
                          <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="truncate">{event.organization?.name || 'EduMapping'}</span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-5">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{dateStr}</span>
                          </div>
                          
                          <div className="flex items-center">
                            <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{timeStr}</span>
                          </div>
                          
                          {event.location && (
                            <div className="flex items-center">
                              <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-gray-200 flex justify-end">
                          {event.virtualLink ? (
                            <button
                              onClick={(e) => handleJoinFromLanding(e, event)}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Join Event
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">Details inside</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="text-center mt-12">
                <Link
                  to="/events"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  View All Events
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

  // School Landing Page
  const renderSchoolHomePage = () => (
    <div className="page-content">
      {/* Hero Section with Carousel & Tricolor Gradient */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C42]/10 via-white/50 to-[#138808]/10 z-0" />

        <div className="container mx-auto px-4 z-10 pt-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div
              className="flex-1 text-center lg:text-left"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight mt-4 sm:mt-6 lg:mt-8"
                variants={fadeInUp}
              >
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#138808] drop-shadow-md">
                  Empowering School Students for Future Success
                </span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                variants={fadeInUp}
              >
                Unlock your potential with training programs, industrial workshops, psychometric tests for career counselling, and internship opportunities designed for school students
              </motion.p>

              <motion.div
                className="flex flex-wrap justify-center lg:justify-start gap-4"
                variants={fadeInUp}
              >
                <Link
                  to="/login/school"
                  state={{ from: { pathname: '/dashboard' } }}
                className="px-8 py-4 bg-[#FF8C42] text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Get Started
                </Link>
                <button
                  onClick={() => handlePageChange('features')}
                  className="px-8 py-4 bg-white text-[#FF8C42] border-2 border-[#FF8C42] rounded-full font-semibold hover:bg-orange-50 transition-all transform hover:-translate-y-1"
                >
                  Explore Features
                </button>
              </motion.div>

              <motion.div
                className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center"
                variants={fadeInUp}
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#FF8C42]">5000+</div>
                  <div className="text-sm text-gray-600">School Students</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#138808]">100+</div>
                  <div className="text-sm text-gray-600">Training Programs</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#FF8C42]">300+</div>
                  <div className="text-sm text-gray-600">Internships</div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="flex-1 w-full max-w-lg lg:max-w-xl"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative rounded-3xl overflow-hidden">
                <Slider {...carouselSettings}>
                  {/* Slide 1: Training Programs */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF8C42]/20 to-[#FF8C42]/5 backdrop-blur-lg border border-[#FF8C42]/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8C42]/30 rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF8C42]/20 rounded-full -ml-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Training Programs</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Skill-building programs designed to prepare you for real-world challenges.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 2: Internship Opportunities */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#138808]/20 to-[#138808]/5 backdrop-blur-lg border border-[#138808]/20 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-[#138808]/30 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#138808]/20 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Internship Opportunities</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Gain hands-on experience with industry-leading companies and startups.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 3: Career Guidance */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF8C42]/20 to-[#138808]/10 backdrop-blur-lg border border-[#FF8C42]/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-[#FF8C42]/30 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#138808]/20 rounded-full blur-3xl"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Career Guidance</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Expert mentorship to help you discover and pursue your passion.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 4: Psychometric Tests */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 backdrop-blur-lg border border-purple-500/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/30 rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full -ml-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Psychometric Tests</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Comprehensive assessments for personalized career counselling and guidance.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 5: Industrial Workshops */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-lg border border-blue-500/20 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/30 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/20 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Industrial Workshops</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Hands-on workshops exposing you to real-world industry tools and workflows.
                        </p>
                      </div>
                    </div>
                  </div>
                </Slider>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Training Programs Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Training Programs</h2>
            <p className="text-xl text-gray-600">Comprehensive programs designed to build essential skills for school students</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "🎨", title: "Creative Skills", desc: "Design, Writing, Digital Arts, Content Creation", color: "bg-orange-50 text-[#FF8C42]" },
              { icon: "💻", title: "Tech Skills", desc: "Coding Basics, Web Development, App Development, Robotics", color: "bg-green-50 text-[#138808]" },
              { icon: "🤝", title: "Soft Skills", desc: "Communication, Leadership, Teamwork, Problem Solving", color: "bg-orange-100 text-[#FF8C42]" }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                className="p-8 rounded-3xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow bg-white"
                whileHover={{ y: -10 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center text-3xl mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything for School Students</h2>
            <p className="text-xl text-gray-600">Empowering young minds with opportunities and skills</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "🎓", title: "Student Profiles", desc: "Build your profile and showcase your achievements" },
              { icon: "📚", title: "Training Programs", desc: "Access diverse skill-building programs" },
              { icon: "💼", title: "Internships", desc: "Find internships that match your interests" },
              { icon: "📝", title: "Portfolio Builder", desc: "Create a professional portfolio of your work" },
              { icon: "🎯", title: "Career Guidance", desc: "Get expert advice on career paths" },
              { icon: "🧠", title: "Psychometric Tests", desc: "Take assessments for personalized career counselling" },
              { icon: "🏭", title: "Industrial Workshops", desc: "Hands-on industry exposure and real-world experience" },
              { icon: "🏆", title: "Achievements", desc: "Track and display your accomplishments" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Ready to start your journey?</h2>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Join thousands of school students already building their future with EduMapping.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/login/school"
                state={{ from: { pathname: '/dashboard' } }}
                className="px-8 py-4 bg-gradient-to-r from-[#FF8C42]/50 to-[#FF8C42]/30 border border-[#FF8C42]/60 text-white rounded-full font-bold backdrop-blur-md shadow-lg hover:from-[#FF8C42]/60 hover:to-[#FF8C42]/40 hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Get Started
              </Link>
              <button
                onClick={() => handlePageChange('contact')}
                className="px-8 py-4 bg-white text-[#FF8C42] border-2 border-[#FF8C42] rounded-full font-bold hover:bg-orange-50 transition-all transform hover:-translate-y-1"
              >
                Contact Us
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Upcoming Global Events Section */}
      {!isLoadingEvents && upcomingEvents.length > 0 && (
        <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
              <p className="text-xl text-gray-600">Join our global events and workshops</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto">
              {upcomingEvents.map((event, idx) => {
                const startDate = new Date(event.startTime);
                const endDate = new Date(event.endTime);
                const dateStr = startDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                const timeStr = `${startDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })} - ${endDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`;

                return (
                  <motion.div
                    key={event.id}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -5 }}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {event.eventType?.replace('_', ' ').toUpperCase() || 'EVENT'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                            Global
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                          <CalendarIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                        {event.title}
                      </h3>

                      <div className="flex items-center text-sm text-gray-700 mb-4">
                        <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="truncate">{event.organization?.name || 'EduMapping'}</span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-5">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{dateStr}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{timeStr}</span>
                        </div>
                        
                        {event.location && (
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-200 flex justify-end">
                        {event.virtualLink ? (
                          <button
                            onClick={(e) => handleJoinFromLanding(e, event)}
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            Join Event
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Details inside</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/events"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                View All Events
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );

  // ... (Keep other render functions: renderFeaturesPage, renderAboutPage, renderServicesPage, renderContactPage)
  // For brevity, I'll implement them with similar modern styling but keep the core content.

  // College/University Features Page
  const renderFeaturesPage = () => (
    <div className="pt-20">
      {/* Features Hero */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF9933]/10 via-white/50 to-[#138808]/10 z-0" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Powerful Features for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808]">
              Modern Campus Management
            </span>
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Everything you need to streamline placement processes and enhance student employability.
          </motion.p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "📊",
                title: "Advanced Analytics",
                desc: "Real-time insights into placement trends, student performance, and recruiter engagement.",
                color: "from-orange-400 to-orange-600"
              },
              {
                icon: "🤝",
                title: "Recruiter Connect",
                desc: "Seamless communication channel between TPOs and recruiters for efficient drive management.",
                color: "from-blue-400 to-blue-600"
              },
              {
                icon: "📝",
                title: "Resume Builder",
                desc: "AI-powered resume builder helping students create ATS-friendly professional resumes.",
                color: "from-green-400 to-green-600"
              },
              {
                icon: "🎯",
                title: "Skill Assessment",
                desc: "Integrated assessment tools to evaluate and improve student employability skills.",
                color: "from-purple-400 to-purple-600"
              },
              {
                icon: "📅",
                title: "Drive Management",
                desc: "End-to-end automation of placement drives, from scheduling to offer letter generation.",
                color: "from-pink-400 to-pink-600"
              },
              {
                icon: "📱",
                title: "Mobile Ready",
                desc: "Fully responsive design ensuring access to critical features on any device, anywhere.",
                color: "from-green-500 to-green-700"
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                className="relative group p-8 rounded-3xl border border-gray-100 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 group-hover:text-[#FF9933] transition-colors">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  // School Features Page
  const renderSchoolFeaturesPage = () => (
    <div className="pt-20">
      {/* Features Hero */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C42]/10 via-white/50 to-[#138808]/10 z-0" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Powerful Features for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#138808]">
              School Students
            </span>
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Everything you need to access training programs, internships, and build your career foundation.
          </motion.p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "📚",
                title: "Training Programs",
                desc: "Access diverse skill-building programs in tech, creative arts, and soft skills designed for school students.",
                color: "from-[#FF8C42] to-[#FF8C42]"
              },
              {
                icon: "💼",
                title: "Internship Portal",
                desc: "Discover and apply for internships with companies looking for talented school students.",
                color: "from-[#138808] to-[#138808]"
              },
              {
                icon: "📝",
                title: "Portfolio Builder",
                desc: "Create a professional portfolio showcasing your projects, achievements, and skills.",
                color: "from-[#FF8C42] to-[#138808]"
              },
              {
                icon: "🏭",
                title: "Industrial Workshops",
                desc: "Hands-on industry workshops that expose school students to real-world tools, workflows, and career paths.",
                color: "from-[#138808] to-[#138808]"
              },
              {
                icon: "🎯",
                title: "Career Guidance",
                desc: "Get expert mentorship and guidance to discover your passion and plan your career path.",
                color: "from-[#FF8C42] to-[#FF8C42]"
              },
              {
                icon: "🧠",
                title: "Psychometric Career Tests",
                desc: "Psychometric assessments that inform career counselling with personalized recommendations.",
                color: "from-[#FF8C42] to-[#138808]"
              },
              {
                icon: "🏆",
                title: "Achievement Tracking",
                desc: "Track and display your accomplishments, certificates, and milestones in one place.",
                color: "from-[#138808] to-[#138808]"
              },
              {
                icon: "📱",
                title: "Mobile Ready",
                desc: "Access all features on any device, anywhere. Learn and grow on the go.",
                color: "from-[#FF8C42] to-[#138808]"
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                className="relative group p-8 rounded-3xl border border-gray-100 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 group-hover:text-[#FF8C42] transition-colors">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  // College/University About Page
  const renderAboutPage = () => (
    <div className="pt-20">
      {/* About Hero */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.span
              className="inline-block py-1 px-3 rounded-full bg-orange-100 text-[#FF9933] font-semibold text-sm mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              Our Story
            </motion.span>
            <motion.h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8 text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Bridging the Gap Between <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808]">
                Education & Employment
              </span>
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 leading-relaxed mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              EduMapping is dedicated to transforming the educational landscape by empowering students with essential skills, connecting institutions with opportunities, and making youth job-ready through comprehensive career development programs.
            </motion.p>
            <motion.p
              className="text-lg text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              We partner with <strong>schools and colleges</strong> to provide <strong>workshops, career guidance, placements, and training programs</strong> that bridge the gap between education and employment.
            </motion.p>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Do</h2>
            <p className="text-xl text-gray-600">Comprehensive solutions for educational institutions and students</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              { 
                icon: "🏭", 
                title: "Industrial Workshops", 
                desc: "Hands-on workshops with industry experts covering latest technologies and real-world applications for both school and college students.",
              },
              { 
                icon: "🎯", 
                title: "Career Guidance", 
                desc: "Psychometric assessments and personalized counselling to help students choose the right career path, from school to college level.",
              },
              { 
                icon: "💼", 
                title: "Placements & Internships", 
                desc: "Connect students with top employers through our extensive network. For colleges: full placement support. For schools: early internship opportunities.",
              },
              { 
                icon: "📚", 
                title: "Training Programs", 
                desc: "Industry-aligned skill training in tech, soft skills, and domain expertise to make students job-ready at every level.",
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                className="relative group p-8 rounded-3xl border border-gray-100 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className="relative z-10">
                  <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Work With Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Who We Work With</h2>
            <p className="text-xl text-gray-600">Serving educational institutions at every level</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Colleges */}
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-6 text-center">🎓</div>
              <h3 className="text-3xl font-bold mb-6 text-center text-gray-900">Colleges & Universities</h3>
              <p className="text-gray-600 mb-6 text-center">
                Comprehensive placement and career development solutions for higher education institutions.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">TPOs & Placement Officers</p>
                    <p className="text-gray-600 text-sm">Streamline placement processes and connect with employers</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Faculty</p>
                    <p className="text-gray-600 text-sm">Track student progress and support career development</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#FF9933] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Students & Alumni</p>
                    <p className="text-gray-600 text-sm">Access job opportunities and career resources</p>
                  </div>
                </li>
              </ul>
            </motion.div>

            {/* Schools */}
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-5xl mb-6 text-center">🏫</div>
              <h3 className="text-3xl font-bold mb-6 text-center text-gray-900">Schools</h3>
              <p className="text-gray-600 mb-6 text-center">
                Early career development programs to help students discover their potential and build essential skills.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">School Administrators</p>
                    <p className="text-gray-600 text-sm">Provide comprehensive career development programs for students</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Career Counsellors</p>
                    <p className="text-gray-600 text-sm">Access psychometric tools and resources for student guidance</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#138808] text-xl mt-1">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">Students</p>
                    <p className="text-gray-600 text-sm">Discover career paths and build essential skills early</p>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              className="relative rounded-3xl overflow-hidden shadow-2xl"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF9933]/20 to-[#138808]/20 mix-blend-overlay z-10" />
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Team collaboration" className="w-full h-full object-cover" />
            </motion.div>

            <div className="space-y-12">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mb-6 text-[#FF9933]">🚀</div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Our Mission</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  To democratize access to career opportunities by providing comprehensive solutions that bridge education and employment. We empower students at every level—from schools to colleges—with essential skills, training programs, industrial workshops, career guidance, and placement opportunities through cutting-edge technology and data-driven insights.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl mb-6 text-[#138808]">👁️</div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Our Vision</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  To be the global standard for career development and campus placements, creating a world where every student—whether in school or college—has the opportunity to discover their potential, build essential skills, and find their dream career based on their talents, skills, and aspirations.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-20 bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Impact</h2>
            <p className="text-xl text-gray-600">Making a difference across educational institutions</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { value: "12,500+", label: "Active Students", icon: "🎓", color: "text-[#FF9933]" },
              { value: "100+", label: "Partner Institutions", icon: "🏛️", color: "text-[#156395]" },
              { value: "2,300+", label: "Successful Placements", icon: "💼", color: "text-[#138808]" },
              { value: "500+", label: "Training Programs", icon: "📚", color: "text-[#FF9933]" }
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="text-5xl mb-4">{stat.icon}</div>
                <div className={`text-4xl font-bold mb-2 ${stat.color}`}>{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-16 text-gray-900">Our Core Values</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { title: "Innovation", desc: "Constantly pushing boundaries to solve complex problems in education and employment.", icon: "💡", color: "bg-blue-50 text-blue-600" },
              { title: "Integrity", desc: "Building trust through transparency and honest practices with all our partners.", icon: "🤝", color: "bg-orange-50 text-orange-600" },
              { title: "Impact", desc: "Measuring success by the careers we help launch and lives we transform.", icon: "🌟", color: "bg-green-50 text-green-600" },
              { title: "Empowerment", desc: "Giving students the tools, skills, and confidence to pursue their dreams.", icon: "🚀", color: "bg-purple-50 text-purple-600" }
            ].map((value, idx) => (
              <motion.div
                key={idx}
                className="bg-white p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all"
                whileHover={{ y: -10 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="text-5xl mb-4">{value.icon}</div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">{value.title}</h3>
                <p className="text-gray-600">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  // School About Page
  const renderSchoolAboutPage = () => (
    <div className="pt-20">
      {/* About Hero */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.span
              className="inline-block py-1 px-3 rounded-full bg-orange-100 text-[#FF8C42] font-semibold text-sm mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              Our Story
            </motion.span>
            <motion.h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#138808] drop-shadow-md">
                Empowering School Students for Future Success
              </span>
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              EduMapping is dedicated to helping school students discover their potential through training programs, internships, and career guidance that prepares them for future success.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              className="relative rounded-3xl overflow-hidden shadow-2xl"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF8C42]/20 to-[#138808]/20 mix-blend-overlay z-10" />
              <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="School students learning" className="w-full h-full object-cover" />
            </motion.div>

            <div className="space-y-12">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mb-6 text-[#FF8C42]">🚀</div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Our Mission</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  To empower school students with essential skills, training programs, and internship opportunities that help them discover their passions and build a strong foundation for their future careers.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl mb-6 text-[#138808]">👁️</div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Our Vision</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  To create a world where every school student has access to quality training, real-world experience through internships, and expert guidance to shape their future with confidence.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-16 text-gray-900">Our Core Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Empowerment", desc: "Giving school students the tools and confidence to pursue their dreams.", color: "bg-orange-50 text-[#FF8C42]" },
              { title: "Growth", desc: "Fostering continuous learning and skill development from an early age.", color: "bg-green-50 text-[#138808]" },
              { title: "Opportunity", desc: "Creating pathways for students to explore and excel in their interests.", color: "bg-orange-100 text-[#FF8C42]" }
            ].map((value, idx) => (
              <motion.div
                key={idx}
                className="bg-white p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all"
                whileHover={{ y: -10 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className={`w-20 h-20 mx-auto rounded-full ${value.color} flex items-center justify-center text-3xl mb-6`}>
                  {value.title[0]}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">{value.title}</h3>
                <p className="text-gray-600">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderServicesPage = () => (
    <div className="pt-20">
      <section className="bg-[#156395] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Our Services</h1>
        </div>
      </section>
    </div>
  );

  // Extracted ContactSection Component
  const ContactSection = ({ isSchoolMode: schoolMode }) => {
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e) => {
      e.preventDefault();

      const subject = `Contact Form Submission from ${formData.name}`;
      const body = `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`;

      window.location.href = `mailto:hello@edumapping.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      setStatus({ type: 'success', message: 'Opening your email client...' });
      setFormData({ name: '', email: '', message: '' });
    };

    const gradientClass = schoolMode 
      ? "bg-gradient-to-br from-orange-50 via-white to-green-50"
      : "bg-gradient-to-br from-orange-50 via-white to-green-50";
    
    const textGradient = schoolMode
      ? "bg-gradient-to-r from-[#FF8C42] to-[#138808]"
      : "bg-gradient-to-r from-[#FF9933] to-[#138808]";

    const buttonGradient = schoolMode
      ? "bg-[#FF8C42]"
      : "bg-[#138808]";

    const focusRingColor = schoolMode
      ? "focus:ring-[#FF8C42]"
      : "focus:ring-[#FF9933]";

    const contactTitle = schoolMode
      ? "Questions about Training Programs or Internships?"
      : "Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.";

    return (
      <div className="pt-20">
        {/* Contact Hero */}
        <section className={`relative py-20 overflow-hidden ${gradientClass}`}>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Get in Touch with <br />
              <span className={`text-transparent bg-clip-text ${textGradient}`}>
                EduMapping
              </span>
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {contactTitle}
            </motion.p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info Cards */}
            <div className="space-y-6">
              <motion.div
                className="p-8 rounded-3xl bg-white shadow-lg border border-gray-100"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl mb-4 text-blue-600">📧</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Email Us</h3>
                <p className="text-gray-600">hello@edumapping.com<br />support@edumapping.com</p>
              </motion.div>

              <motion.div
                className="p-8 rounded-3xl bg-white shadow-lg border border-gray-100"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl mb-4 text-[#138808]">📞</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Call Us</h3>
                <p className="text-gray-600">+91 9104991059<br />Mon - Fri, 9am - 6pm</p>
              </motion.div>

              <motion.div
                className="p-8 rounded-3xl bg-white shadow-lg border border-gray-100"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl mb-4 text-purple-600">📍</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Meet Us</h3>
                <p className="text-gray-600 mb-4">
                  EduMapping Office<br />
                  India
                </p>
                <div className="flex justify-center">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://maps.google.com/?q=EduMapping+Office+India" 
                    alt="Location QR Code" 
                    className="w-32 h-32 border border-gray-200 rounded-lg"
                  />
                </div>
              </motion.div>
            </div>

            {/* Contact Form */}
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-2xl font-bold mb-6 text-gray-900">Contact EduMapping</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full p-4 rounded-xl border border-gray-200 focus:ring-2 ${focusRingColor} focus:border-transparent outline-none transition-all`}
                    required
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full p-4 rounded-xl border border-gray-200 focus:ring-2 ${focusRingColor} focus:border-transparent outline-none transition-all`}
                    required
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows="5"
                    className={`w-full p-4 rounded-xl border border-gray-200 focus:ring-2 ${focusRingColor} focus:border-transparent outline-none transition-all`}
                    required
                    placeholder="How can we help you?"
                  ></textarea>
                </div>

                {status.message && (
                  <div className={`p-4 rounded-xl ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 ${buttonGradient} text-white rounded-xl font-bold hover:shadow-lg transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </div >
    );
  };

  return (
    <div className="font-sans text-gray-900">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${currentPage === 'home' ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-white shadow-sm'}`}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            <button
              onClick={() => {
                handlePageChange('home');
                setShowAudienceContent(false);
                window.scrollTo(0, 0);
              }}
              className="flex items-center gap-2"
            >
              <img src="/logo.svg" alt="EduMapping" className="h-12 w-auto" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-sm">
                  EduMapping
                </span>
                <span className="text-[11px] sm:text-xs text-gray-600 font-medium leading-tight text-center">
                  Nurturing Young Minds
                </span>
              </div>
            </button>

            <div className="hidden md:flex items-center gap-6">
              {['Home', 'Features', 'About', 'Connect with Us'].map((item) => (
                <button
                  key={item}
                  onClick={() => handlePageChange(item === 'Connect with Us' ? 'contact' : item.toLowerCase())}
                  className={`text-sm font-medium hover:text-[#FF9933] transition-colors ${currentPage === (item === 'Connect with Us' ? 'contact' : item.toLowerCase()) ? 'text-[#FF9933]' : 'text-gray-600'}`}
                >
                  {item}
                </button>
              ))}
              
              {/* Toggle Button */}
              <div className="flex items-center gap-2 px-1 py-1 bg-gray-100 rounded-full border border-gray-200">
                <motion.button
                  onClick={() => {
                    setIsSchoolMode(false);
                    setShowAudienceContent(true);
                    if (currentPage === 'home') window.scrollTo(0, 0);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative ${
                    !isSchoolMode && showAudienceContent
                      ? 'text-white shadow-md' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {!isSchoolMode && showAudienceContent && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 bg-[#138808] rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <span>🎓</span> College
                  </span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setIsSchoolMode(true);
                    setShowAudienceContent(true);
                    if (currentPage === 'home') window.scrollTo(0, 0);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative ${
                    isSchoolMode && showAudienceContent
                      ? 'text-white shadow-md' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSchoolMode && showAudienceContent && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 bg-[#FF8C42] rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <span>🏫</span> School
                  </span>
                </motion.button>
              </div>

              <Link
                to={isSchoolMode && showAudienceContent ? "/login/school" : "/login/college"}
                state={{ from: { pathname: '/dashboard' } }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-full font-medium backdrop-blur-md hover:from-[#138808]/60 hover:to-[#138808]/40 hover:shadow-lg transition-all shadow-md"
              >
                Try Demo
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden text-gray-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t"
            >
              <div className="flex flex-col p-4 gap-4">
                {['Home', 'Features', 'About', 'Connect with Us'].map((item) => (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item === 'Connect with Us' ? 'contact' : item.toLowerCase())}
                    className="text-left py-2 text-gray-600 font-medium"
                  >
                    {item}
                  </button>
                ))}
                
                {/* Mobile Toggle Button */}
                <div className="flex items-center gap-2 px-1 py-1 bg-gray-100 rounded-full border border-gray-200 my-2">
                  <motion.button
                    onClick={() => {
                      setIsSchoolMode(false);
                      setShowAudienceContent(true);
                      if (currentPage === 'home') window.scrollTo(0, 0);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative flex-1 ${
                      !isSchoolMode && showAudienceContent
                        ? 'text-white shadow-md' 
                        : 'text-gray-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {!isSchoolMode && showAudienceContent && (
                      <motion.div
                        layoutId="activeModeMobile"
                        className="absolute inset-0 bg-[#138808] rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <span>🎓</span> College
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setIsSchoolMode(true);
                      setShowAudienceContent(true);
                      if (currentPage === 'home') window.scrollTo(0, 0);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative flex-1 ${
                      isSchoolMode && showAudienceContent
                        ? 'text-white shadow-md' 
                        : 'text-gray-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isSchoolMode && showAudienceContent && (
                      <motion.div
                        layoutId="activeModeMobile"
                        className="absolute inset-0 bg-[#FF8C42] rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <span>🏫</span> School
                    </span>
                  </motion.button>
                </div>

                <Link
                  to={isSchoolMode && showAudienceContent ? "/login/school" : "/login/college"}
                  state={{ from: { pathname: '/dashboard' } }}
                className="text-center py-3 bg-gradient-to-r from-[#138808]/50 to-[#138808]/30 border border-[#138808]/60 text-white rounded-xl font-medium backdrop-blur-md hover:from-[#138808]/60 hover:to-[#138808]/40 hover:shadow-lg transition-all"
                >
                  Try Demo
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main>
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <motion.div
              key={showAudienceContent ? (isSchoolMode ? 'school' : 'college') : 'unified'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              {showAudienceContent ? renderAudienceContent() : renderUnifiedOverview()}
            </motion.div>
          )}
          {currentPage === 'features' && (
            <motion.div
              key={isSchoolMode ? 'school-features' : 'college-features'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              {isSchoolMode ? renderSchoolFeaturesPage() : renderFeaturesPage()}
            </motion.div>
          )}
          {currentPage === 'about' && (
            <motion.div
              key={isSchoolMode ? 'school-about' : 'college-about'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              {renderAboutPage()}
            </motion.div>
          )}
          {currentPage === 'services' && (
            <motion.div
              key="services"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              {renderServicesPage()}
            </motion.div>
          )}
          {currentPage === 'contact' && (
            <motion.div
              key={isSchoolMode ? 'school-contact' : 'college-contact'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              <ContactSection isSchoolMode={isSchoolMode} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* WhatsApp Chat Button */}
      <WhatsAppChat />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.svg" alt="EduMapping" className="h-10" />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808]">
                    EduMapping
                  </span>
                  <span className="text-xs text-gray-400 font-medium text-center">Nurturing Young Minds</span>
                </div>
              </div>
              <p className="mb-4 max-w-sm">Making youth job-ready with essential employability skills.</p>
              <p className="text-sm text-gray-500">
                Brand by <span className="text-[#FF9933]">eTraze</span>
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                {['Home', 'Features', 'About', 'Connect with Us'].map((item) => (
                  <li key={item}>
                    <button onClick={() => handlePageChange(item === 'Connect with Us' ? 'contact' : item.toLowerCase())} className="hover:text-white transition-colors">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-sm">
                <li>hello@edumapping.com</li>
                <li>www.edumapping.com</li>
                <li>+91 9104991059</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 md:pr-28">
            <p>&copy; {new Date().getFullYear()} EduMapping. All rights reserved. | <Link to="/privacy" className="hover:text-white underline">Privacy Policy</Link></p>
            <p className="text-sm">Developed by <span className="text-white font-medium">Globoniks</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
