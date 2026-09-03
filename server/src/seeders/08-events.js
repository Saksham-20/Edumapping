// server/src/seeders/08-events.js
'use strict';

/**
 * Event times are relative to seed time, not hardcoded calendar dates.
 *
 * These were fixed 2024 timestamps, so every seeded event was in the past and
 * its registration deadline had expired — a freshly seeded install had no
 * event anyone could register for, and the "upcoming" filter was always empty.
 */
const at = (daysFromNow, hourUtc) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('events', [
      {
        id: 1,
        organization_id: 1, // Tech University
        // Year taken from the clock so the title does not read as stale.
        title: `Annual Tech Career Fair ${new Date().getFullYear()}`,
        description: 'Join us for the biggest tech career fair of the year! Meet top companies, network with industry professionals, and discover exciting career opportunities.',
        event_type: 'job_fair',
        start_time: at(14, 9),
        end_time: at(14, 17),
        location: 'Tech University Main Campus, Grand Hall',
        virtual_link: null,
        max_participants: 500,
        registration_deadline: at(11, 23),
        status: 'scheduled',
        created_by: 2, // TPO Jane Smith
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        organization_id: 1, // Tech University
        title: 'Software Engineering Workshop',
        description: 'Hands-on workshop covering modern software development practices, including Git workflows, CI/CD pipelines, and cloud deployment.',
        event_type: 'workshop',
        start_time: at(7, 14),
        end_time: at(7, 18),
        location: 'Tech University, Computer Science Building, Room 101',
        virtual_link: 'https://meet.google.com/abc-defg-hij',
        max_participants: 50,
        registration_deadline: at(5, 23),
        status: 'scheduled',
        created_by: 2, // TPO Jane Smith
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        organization_id: 2, // TechCorp Industries
        title: 'TechCorp Info Session',
        description: 'Learn about career opportunities at TechCorp Industries. Our team will share insights about our culture, projects, and growth opportunities.',
        event_type: 'info_session',
        start_time: at(21, 16),
        end_time: at(21, 18),
        location: 'Tech University, Business School, Auditorium A',
        virtual_link: 'https://zoom.us/j/123456789',
        max_participants: 200,
        registration_deadline: at(19, 23),
        status: 'scheduled',
        created_by: 3, // Michael Johnson
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        organization_id: 3, // StartupXYZ
        title: 'Startup Innovation Seminar',
        description: 'Discover the world of startups! Learn about entrepreneurship, innovation, and how to build successful tech companies from industry experts.',
        event_type: 'seminar',
        start_time: at(28, 10),
        end_time: at(28, 12),
        location: 'Tech University, Innovation Center',
        virtual_link: null,
        max_participants: 100,
        registration_deadline: at(26, 23),
        status: 'scheduled',
        created_by: 4, // Sarah Williams
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 5,
        organization_id: 1, // Tech University
        title: 'Campus Drive - TechCorp Industries',
        description: 'Exclusive campus recruitment drive for final year students. Multiple positions available in software development, data science, and DevOps.',
        event_type: 'campus_drive',
        start_time: at(35, 9),
        end_time: at(35, 16),
        location: 'Tech University, Placement Cell',
        virtual_link: null,
        max_participants: 100,
        registration_deadline: at(33, 23),
        status: 'scheduled',
        created_by: 2, // TPO Jane Smith
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('events', null, {});
  }
};
