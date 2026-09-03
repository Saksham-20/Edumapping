// server/src/seeders/09-event-registrations.js
'use strict';

/**
 * Timestamps are relative to seed time.
 *
 * These were fixed January 2024 dates, which put every seeded application
 * outside any "this week / this month / this year" window — so the dashboards'
 * recent-activity panels and the date-ranged analytics were empty on a fresh
 * install even though the rows existed.
 */
const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('event_registrations', [
      {
        id: 1,
        event_id: 1, // Annual Tech Career Fair
        user_id: 5, // John Doe
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        event_id: 1, // Annual Tech Career Fair
        user_id: 6, // Alice Wilson
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        event_id: 1, // Annual Tech Career Fair
        user_id: 7, // Bob Martinez
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        event_id: 1, // Annual Tech Career Fair
        user_id: 8, // Emma Davis
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 5,
        event_id: 2, // Software Engineering Workshop
        user_id: 5, // John Doe
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 6,
        event_id: 2, // Software Engineering Workshop
        user_id: 6, // Alice Wilson
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 7,
        event_id: 3, // TechCorp Info Session
        user_id: 5, // John Doe
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 8,
        event_id: 3, // TechCorp Info Session
        user_id: 6, // Alice Wilson
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 9,
        event_id: 4, // Startup Innovation Seminar
        user_id: 8, // Emma Davis
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 10,
        event_id: 5, // Campus Drive - TechCorp Industries
        user_id: 5, // John Doe
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 11,
        event_id: 5, // Campus Drive - TechCorp Industries
        user_id: 6, // Alice Wilson
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 12,
        event_id: 5, // Campus Drive - TechCorp Industries
        user_id: 8, // Emma Davis
        status: 'registered',
        registered_at: daysAgo(12),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('event_registrations', null, {});
  }
};
