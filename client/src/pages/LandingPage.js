// client/src/pages/LandingPage.js
//
// Public marketing site. This component owns only the shell — nav, the
// lightweight in-page routing between Home / Features / About / Connect, and
// the footer. Every section lives in components/landing/ so this file stays
// readable.
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import Nav from '../components/landing/Nav';
import EventsSection from '../components/landing/EventsSection';
import {
  RecordHero,
  RecordChain,
  RuleCheck,
  SeasonLedger,
  InspectionReport,
  RecordClose
} from '../components/landing/Record';
import { AboutPage, ContactPage, FeaturesPage } from '../components/landing/InnerPages';
import Footer from '../components/landing/Footer';
import WhatsAppChat from '../components/common/WhatsAppChat';

import '../styles/carousel.css';
import './LandingPage.css';

const PAGE_TITLES = {
  home: 'EduMapping — From classroom to career',
  features: 'Features — EduMapping',
  about: 'About — EduMapping',
  contact: 'Connect with us — EduMapping'
};

const LandingPage = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [audience, setAudience] = useState('college');
  const reduce = useReducedMotion();

  // Keep the tab title in step with the in-page route.
  useEffect(() => {
    document.title = PAGE_TITLES[currentPage] || PAGE_TITLES.home;
  }, [currentPage]);

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Choosing an audience opens the features page in that audience's terms;
  // the home page itself speaks to colleges first.
  const handleSelectAudience = useCallback(
    (key) => {
      setAudience(key);
      if (key === 'school') {
        setCurrentPage('features');
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }
    },
    [reduce]
  );

  // School visitors get the school login; everyone else the college one.
  const loginPath = audience === 'school' ? '/login/school' : '/login/college';

  const transition = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.28, ease: 'easeOut' }
      };

  return (
    <div className="min-h-screen bg-bone-50 font-sans text-ink-950 antialiased">
      <a
        href="#lp-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-[10px] focus:border focus:border-ink-950 focus:bg-saffron-500 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>

      <Nav
        currentPage={currentPage}
        onNavigate={handleNavigate}
        audience={audience}
        onSelectAudience={handleSelectAudience}
        loginPath={loginPath}
      />

      <main id="lp-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={currentPage} {...transition}>
            {currentPage === 'home' && (
              <>
                <RecordHero
                  onNavigate={handleNavigate}
                  loginPath={loginPath}
                  onSelectAudience={handleSelectAudience}
                />
                <RecordChain />
                <RuleCheck />
                <SeasonLedger onNavigate={handleNavigate} />
                <InspectionReport />
                <EventsSection />
                <RecordClose loginPath={loginPath} />
              </>
            )}

            {currentPage === 'features' && <FeaturesPage audience={audience} />}
            {currentPage === 'about' && <AboutPage />}
            {currentPage === 'contact' && <ContactPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer onNavigate={handleNavigate} />
      <WhatsAppChat />
    </div>
  );
};

export default LandingPage;
