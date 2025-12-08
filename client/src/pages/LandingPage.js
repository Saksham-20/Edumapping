import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Slider from 'react-slick';
import WhatsAppChat from '../components/common/WhatsAppChat';
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

const LandingPage = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSchoolMode, setIsSchoolMode] = useState(false);

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

  const renderHomePage = () => (
    <div className="page-content">
      {/* Hero Section with Carousel & Tricolor Gradient */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
        {/* Animated Background Gradient */}
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
                className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 text-gray-900 leading-tight"
                variants={fadeInUp}
              >
                Welcome to <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-md">
                  EduMapping
                </span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                variants={fadeInUp}
              >
                Where learning meets limitless possibilities
              </motion.p>

              <motion.div
                className="flex flex-wrap justify-center lg:justify-start gap-4"
                variants={fadeInUp}
              >
                <Link
                  to="/login"
                  state={{ from: { pathname: '/dashboard' } }}
                  className="px-8 py-4 bg-gradient-to-r from-[#FF9933] to-[#138808] text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Try Demo
                </Link>
                <button
                  onClick={() => handlePageChange('features')}
                  className="px-8 py-4 bg-white text-[#138808] border-2 border-[#138808] rounded-full font-semibold hover:bg-green-50 transition-all transform hover:-translate-y-1"
                >
                  Explore Features
                </button>
              </motion.div>

              <motion.div
                className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center"
                variants={fadeInUp}
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#FF9933]">7500+</div>
                  <div className="text-sm text-gray-600">Active Students</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#156395]">50+</div>
                  <div className="text-sm text-gray-600">Partners</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-[#138808]">2000+</div>
                  <div className="text-sm text-gray-600">Placements</div>
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
                  {/* Slide 1: Career Growth - Saffron */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF9933]/20 to-[#FF9933]/5 backdrop-blur-lg border border-[#FF9933]/20 flex items-center justify-center group">
                      {/* Abstract Shapes */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF9933]/30 rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF9933]/20 rounded-full -ml-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Career Growth</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Accelerate your professional journey with our structured placement programs.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 2: Skill Development - White/Blue (Chakra) */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/40 to-blue-50/20 backdrop-blur-lg border border-white/40 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-[#000080]/10 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#000080]/10 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Skill Development</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Preparing the next generation of creators & Innovators
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 3: Industry Connect - Green */}
                  <div className="outline-none px-2">
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#138808]/20 to-[#138808]/5 backdrop-blur-lg border border-[#138808]/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-[#138808]/30 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#138808]/20 rounded-full blur-3xl"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Industry Connect</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Bridge the gap between academia and industry with our recruiter network.
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

      {/* Modules Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Training Modules</h2>
            <p className="text-xl text-gray-600">Comprehensive modules designed to make youth job-ready</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "💬", title: "Soft Skills", desc: "Communication, Teamwork, Leadership, Time Management", color: "bg-blue-50 text-blue-600" },
              { icon: "🌟", title: "Life Skills", desc: "Confidence Building, Decision Making, Emotional Intelligence", color: "bg-orange-50 text-orange-600" },
              { icon: "💼", title: "Workplace Readiness", desc: "Handling Real-world Challenges, Problem Solving, Adaptability", color: "bg-green-50 text-green-600" }
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
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need</h2>
            <p className="text-xl text-gray-600">Streamline your educational institution's operations</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "🎓", title: "Student Management", desc: "Comprehensive student profiles and academic tracking" },
              { icon: "💼", title: "Job Placements", desc: "Connect students with top companies" },
              { icon: "📊", title: "Analytics Dashboard", desc: "Real-time insights for better decision making" },
              { icon: "📝", title: "Resume Builder", desc: "Professional resume creation tools" },
              { icon: "🎪", title: "Event Management", desc: "Organize campus events and career fairs" },
              { icon: "🔔", title: "Smart Notifications", desc: "Stay updated with personalized alerts" }
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
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Ready to transform your campus?</h2>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Join hundreds of institutions already using EduMapping to improve student outcomes.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/login"
                state={{ from: { pathname: '/dashboard' } }}
                className="px-8 py-4 bg-gradient-to-r from-[#FF9933] to-[#138808] text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Get Started
              </Link>
              <button
                onClick={() => handlePageChange('contact')}
                className="px-8 py-4 bg-white text-[#138808] border-2 border-[#138808] rounded-full font-bold hover:bg-green-50 transition-all transform hover:-translate-y-1"
              >
                Connect with Us
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );

  // School Landing Page
  const renderSchoolHomePage = () => (
    <div className="page-content">
      {/* Hero Section with Carousel & Tricolor Gradient */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-teal-50">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C42]/10 via-white/50 to-[#20B2AA]/10 z-0" />

        <div className="container mx-auto px-4 z-10 pt-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div
              className="flex-1 text-center lg:text-left"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1
                className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 text-gray-900 leading-tight"
                variants={fadeInUp}
              >
                Empowering <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#20B2AA] drop-shadow-md">
                  School Students
                </span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                variants={fadeInUp}
              >
                Unlock your potential with training programs and internship opportunities designed for school students
              </motion.p>

              <motion.div
                className="flex flex-wrap justify-center lg:justify-start gap-4"
                variants={fadeInUp}
              >
                <Link
                  to="/login"
                  state={{ from: { pathname: '/dashboard' } }}
                  className="px-8 py-4 bg-gradient-to-r from-[#FF8C42] to-[#20B2AA] text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Get Started
                </Link>
                <button
                  onClick={() => handlePageChange('features')}
                  className="px-8 py-4 bg-white text-[#FF8C42] border-2 border-[#FF8C42] rounded-full font-semibold hover:bg-orange-50 transition-all transform hover:-translate-y-1"
                >
                  Explore Programs
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
                  <div className="text-3xl font-bold text-[#20B2AA]">100+</div>
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
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#20B2AA]/20 to-[#20B2AA]/5 backdrop-blur-lg border border-[#20B2AA]/20 flex items-center justify-center group">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-[#20B2AA]/30 rounded-full -ml-16 -mt-16 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                      <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#20B2AA]/20 rounded-full -mr-10 -mb-10 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

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
                    <div className="h-[320px] sm:h-[380px] lg:h-[460px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF8C42]/20 to-[#20B2AA]/10 backdrop-blur-lg border border-[#FF8C42]/20 flex items-center justify-center group">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-[#FF8C42]/30 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#20B2AA]/20 rounded-full blur-3xl"></div>

                      <div className="relative z-10 text-center p-8 max-w-md mx-auto">
                        <h3 className="text-4xl font-bold mb-4 tracking-tight text-gray-800 drop-shadow-sm">Career Guidance</h3>
                        <p className="text-gray-700 text-xl leading-relaxed font-medium">
                          Expert mentorship to help you discover and pursue your passion.
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
              { icon: "💻", title: "Tech Skills", desc: "Coding Basics, Web Development, App Development, Robotics", color: "bg-teal-50 text-[#20B2AA]" },
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
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-teal-50">
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
                to="/login"
                state={{ from: { pathname: '/dashboard' } }}
                className="px-8 py-4 bg-gradient-to-r from-[#FF8C42] to-[#20B2AA] text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
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
            className="text-5xl font-bold mb-6 text-gray-900"
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
                color: "from-teal-400 to-teal-600"
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
      <section className="relative py-20 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-teal-50">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C42]/10 via-white/50 to-[#20B2AA]/10 z-0" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1
            className="text-5xl font-bold mb-6 text-gray-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Powerful Features for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#20B2AA]">
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
                color: "from-[#20B2AA] to-[#20B2AA]"
              },
              {
                icon: "📝",
                title: "Portfolio Builder",
                desc: "Create a professional portfolio showcasing your projects, achievements, and skills.",
                color: "from-[#FF8C42] to-[#20B2AA]"
              },
              {
                icon: "🎯",
                title: "Career Guidance",
                desc: "Get expert mentorship and guidance to discover your passion and plan your career path.",
                color: "from-[#FF8C42] to-[#FF8C42]"
              },
              {
                icon: "🏆",
                title: "Achievement Tracking",
                desc: "Track and display your accomplishments, certificates, and milestones in one place.",
                color: "from-[#20B2AA] to-[#20B2AA]"
              },
              {
                icon: "📱",
                title: "Mobile Ready",
                desc: "Access all features on any device, anywhere. Learn and grow on the go.",
                color: "from-[#FF8C42] to-[#20B2AA]"
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
              className="text-5xl lg:text-6xl font-bold mb-8 text-gray-900"
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
              className="text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              EduMapping is dedicated to transforming the placement landscape by empowering students with skills and connecting institutions with top-tier opportunities.
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
                  To democratize access to career opportunities by providing cutting-edge technology solutions that streamline the placement process and enhance student employability through data-driven insights.
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
                  To be the global standard for campus placements, creating a world where every student has the opportunity to find their dream career based on their skills and potential.
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
              { title: "Innovation", desc: "Constantly pushing boundaries to solve complex problems.", color: "bg-blue-50 text-blue-600" },
              { title: "Integrity", desc: "Building trust through transparency and honest practices.", color: "bg-orange-50 text-orange-600" },
              { title: "Impact", desc: "Measuring success by the careers we help launch.", color: "bg-green-50 text-green-600" }
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

  // School About Page
  const renderSchoolAboutPage = () => (
    <div className="pt-20">
      {/* About Hero */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-br from-orange-50 via-white to-teal-50">
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
              className="text-5xl lg:text-6xl font-bold mb-8 text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Empowering School Students <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C42] to-[#20B2AA]">
                Through Skills & Opportunities
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
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF8C42]/20 to-[#20B2AA]/20 mix-blend-overlay z-10" />
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
                <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center text-3xl mb-6 text-[#20B2AA]">👁️</div>
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
              { title: "Growth", desc: "Fostering continuous learning and skill development from an early age.", color: "bg-teal-50 text-[#20B2AA]" },
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
      ? "bg-gradient-to-br from-orange-50 via-white to-teal-50"
      : "bg-gradient-to-br from-orange-50 via-white to-green-50";
    
    const textGradient = schoolMode
      ? "bg-gradient-to-r from-[#FF8C42] to-[#20B2AA]"
      : "bg-gradient-to-r from-[#FF9933] to-[#138808]";

    const buttonGradient = schoolMode
      ? "bg-gradient-to-r from-[#FF8C42] to-[#20B2AA]"
      : "bg-gradient-to-r from-[#FF9933] to-[#138808]";

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
              className="text-5xl font-bold mb-6 text-gray-900"
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
              onClick={() => handlePageChange('home')}
              className="flex flex-col items-start gap-1 text-left"
            >
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="EduMapping" className="h-12 w-auto" />
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808] drop-shadow-sm">
                  EduMapping
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-gray-600 font-medium leading-tight">
                Nurturing Young Minds
              </span>
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
                    window.scrollTo(0, 0);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative ${
                    !isSchoolMode 
                      ? 'text-white shadow-md' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {!isSchoolMode && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 bg-gradient-to-r from-[#FF9933] to-[#138808] rounded-full"
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
                    window.scrollTo(0, 0);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative ${
                    isSchoolMode 
                      ? 'text-white shadow-md' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSchoolMode && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 bg-gradient-to-r from-[#FF8C42] to-[#20B2AA] rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <span>🏫</span> School
                  </span>
                </motion.button>
              </div>

              <Link
                to="/login"
                state={{ from: { pathname: '/dashboard' } }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#FF9933] to-[#138808] text-white rounded-full font-medium hover:shadow-lg transition-all shadow-md"
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
                      window.scrollTo(0, 0);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative flex-1 ${
                      !isSchoolMode 
                        ? 'text-white shadow-md' 
                        : 'text-gray-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {!isSchoolMode && (
                      <motion.div
                        layoutId="activeModeMobile"
                        className="absolute inset-0 bg-gradient-to-r from-[#FF9933] to-[#138808] rounded-full"
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
                      window.scrollTo(0, 0);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all relative flex-1 ${
                      isSchoolMode 
                        ? 'text-white shadow-md' 
                        : 'text-gray-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isSchoolMode && (
                      <motion.div
                        layoutId="activeModeMobile"
                        className="absolute inset-0 bg-gradient-to-r from-[#FF8C42] to-[#20B2AA] rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <span>🏫</span> School
                    </span>
                  </motion.button>
                </div>

                <Link
                  to="/login"
                  state={{ from: { pathname: '/dashboard' } }}
                  className="text-center py-3 bg-[#156395] text-white rounded-xl font-medium"
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
              key={isSchoolMode ? 'school' : 'college'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
            >
              {isSchoolMode ? renderSchoolHomePage() : renderHomePage()}
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
              {isSchoolMode ? renderSchoolAboutPage() : renderAboutPage()}
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
              <div className="flex flex-col items-start mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <img src="/logo.svg" alt="EduMapping" className="h-10" />
                  <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#138808]">
                    EduMapping
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-medium">Nurturing Young Minds</span>
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
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>&copy; {new Date().getFullYear()} EduMapping. All rights reserved. | <Link to="/privacy" className="hover:text-white underline">Privacy Policy</Link></p>
            <p className="text-sm">Developed by <span className="text-white font-medium">Globoniks</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
