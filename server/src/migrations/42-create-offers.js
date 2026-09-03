'use strict';

/**
 * Offers as a record in their own right.
 *
 * Until now the only trace of a placement was `applications.status = 'selected'`
 * — a value in an enum. That cannot carry a salary, cannot be revoked with a
 * reason, cannot distinguish a pre-placement offer from a campus one, and
 * cannot be reported on. Every downstream thing a placement cell is actually
 * measured on needs it: median CTC, the highest and lowest package, NIRF
 * Graduation Outcomes, and any policy rule expressed as "a better offer than
 * the one you hold".
 *
 * One offer per application: the application is the thread from posting to
 * outcome, and two offers against one application would mean the second is
 * really a revision of the first.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('offers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      application_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'applications', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      job_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // Annual cost to company. DECIMAL rather than FLOAT because this is money
      // and it is reported on: a median computed over binary floats is not a
      // number anyone should put in a compliance return.
      ctc: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      // Base, variable, joining bonus, stock, retention — named components vary
      // by company, so this stays open rather than becoming twelve columns.
      ctc_breakup: { type: Sequelize.JSON, allowNull: true, defaultValue: {} },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      role_title: { type: Sequelize.STRING(255), allowNull: true },
      location: { type: Sequelize.STRING(255), allowNull: true },
      // 'offered' until the student responds. 'revoked' is deliberately distinct
      // from 'declined': one is the company withdrawing, the other the student
      // saying no, and conflating them makes the placement rate a lie.
      status: {
        type: Sequelize.ENUM('offered', 'accepted', 'declined', 'revoked'),
        allowNull: false,
        defaultValue: 'offered'
      },
      // A pre-placement offer consumes a student's policy budget but does not
      // come from a campus drive, and is counted separately in most returns.
      is_ppo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      offer_letter_url: { type: Sequelize.STRING(500), allowNull: true },
      offered_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      responded_at: { type: Sequelize.DATE, allowNull: true },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      revoked_reason: { type: Sequelize.TEXT, allowNull: true },
      joining_date: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // "This student's offers" and "this drive's offers" are the two reads that
    // happen constantly; status narrows both.
    await queryInterface.addIndex('offers', ['student_id'], { name: 'offers_student_id_idx' });
    await queryInterface.addIndex('offers', ['job_id'], { name: 'offers_job_id_idx' });
    await queryInterface.addIndex('offers', ['organization_id'], { name: 'offers_organization_id_idx' });
    await queryInterface.addIndex('offers', ['status'], { name: 'offers_status_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('offers');
    // Sequelize leaves the ENUM type behind on drop.
    await queryInterface.sequelize
      .query('DROP TYPE IF EXISTS "enum_offers_status";')
      .catch(() => {});
  }
};
