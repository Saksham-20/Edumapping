'use strict';

/**
 * Ensures a special "EduMapping" organization exists.
 * Events created under this org are treated as "global" and should be visible to all users.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🏢 Ensuring EduMapping organization exists...');

    const table = await queryInterface.describeTable('organizations');

    // If org already exists, do nothing
    const [existing] = await queryInterface.sequelize.query(`
      SELECT id, name FROM organizations WHERE LOWER(name) = 'edumapping' LIMIT 1;
    `);
    if (existing && existing.length > 0) {
      console.log(`✅ EduMapping organization already exists (id=${existing[0].id})`);
      return;
    }

    const now = new Date();

    // Build row only with columns that exist in this environment (migration-order safe)
    const row = {
      name: 'EduMapping',
      type: 'company',
      domain: 'edumapping@edumapping.com',
      created_at: now,
      updated_at: now
    };

    if (table.is_verified) row.is_verified = true;
    if (table.approval_status) row.approval_status = 'approved';
    if (table.approved_by) row.approved_by = null;
    if (table.approved_at) row.approved_at = null;
    if (table.approval_notes) row.approval_notes = 'System organization for global events';
    if (table.contact_email) row.contact_email = 'support@edumapping.com';
    if (table.website) row.website = 'https://edumapping.com';

    await queryInterface.bulkInsert('organizations', [row]);
    console.log('✅ EduMapping organization created');
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️ Removing EduMapping organization (if present)...');
    await queryInterface.sequelize.query(`
      DELETE FROM organizations WHERE LOWER(name) = 'edumapping';
    `);
  }
};

