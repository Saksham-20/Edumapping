// server/src/seeders/04-recruiter-profiles.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('recruiter_profiles', [
      {
        id: 1,
        user_id: 3, // Michael Johnson from TechCorp
        department: 'Human Resources',
        position: 'Senior Recruiter',
        bio: 'Experienced HR professional with 8+ years in technical recruitment. Specialized in hiring software engineers and data scientists.',
        experience: 8,
        linkedin_url: 'https://linkedin.com/in/michaeljohnson',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        user_id: 4, // Sarah Williams from StartupXYZ
        department: 'Talent Acquisition',
        position: 'HR Manager',
        bio: 'HR manager with 5+ years experience in startup environments. Passionate about building diverse and inclusive teams.',
        experience: 5,
        linkedin_url: 'https://linkedin.com/in/sarahwilliams',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Grant both seeded recruiters access to the seeded universities.
    //
    // Recruiter reach is defined by `recruiter_allowed_organizations`, and an
    // empty allow-list correctly means "see nothing" — `applyRecruiterOrgScope`
    // forces a query that returns no rows. Nothing seeded these rows, so on a
    // fresh install every recruiter signed in to an entirely empty platform:
    // no candidates, no student lists, nothing to review. That reads as a
    // broken product rather than as the deliberate default it is.
    //
    // Only the two universities are granted. Schools stay out — recruiters
    // hire graduates, not pupils — and this is seed data, so a real recruiter
    // still starts with no access until somebody grants it.
    await queryInterface.bulkInsert('recruiter_allowed_organizations', [
      { recruiter_profile_id: 1, organization_id: 1, created_at: new Date(), updated_at: new Date() },
      { recruiter_profile_id: 1, organization_id: 4, created_at: new Date(), updated_at: new Date() },
      { recruiter_profile_id: 2, organization_id: 1, created_at: new Date(), updated_at: new Date() },
      { recruiter_profile_id: 2, organization_id: 4, created_at: new Date(), updated_at: new Date() }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('recruiter_allowed_organizations', null, {});
    await queryInterface.bulkDelete('recruiter_profiles', null, {});
  }
};
