'use strict';

/**
 * Adds `pending_review` to the job status ENUM, plus the review audit columns.
 *
 * Recruiters were approved but their postings were not: an approved recruiter
 * could publish a job straight to every eligible student with nobody in
 * between. One badly-worded or fraudulent posting reaching a whole cohort is a
 * reputational event for the placement cell, which is why the platforms this is
 * modelled on gate every listing rather than only the account behind it.
 *
 * `reviewed_by` / `reviewed_at` / `review_notes` record who made the call and
 * why, so a rejection can be explained back to the recruiter instead of the
 * posting silently never appearing.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Postgres has no "ADD VALUE IF NOT EXISTS" before 12, and the enum's
    // generated name is not guaranteed, so find it by a label we know is in it.
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        enum_type_name text;
      BEGIN
        SELECT t.typname INTO enum_type_name
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE e.enumlabel = 'cancelled'
          AND t.typname LIKE '%jobs_status%'
        LIMIT 1;

        IF enum_type_name IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'pending_review'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = enum_type_name)
          ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_type_name, 'pending_review');
          END IF;
        ELSE
          BEGIN
            ALTER TYPE "enum_jobs_status" ADD VALUE 'pending_review';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);

    const table = await queryInterface.describeTable('jobs');

    if (!table.reviewed_by) {
      await queryInterface.addColumn('jobs', 'reviewed_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!table.reviewed_at) {
      await queryInterface.addColumn('jobs', 'reviewed_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.review_notes) {
      await queryInterface.addColumn('jobs', 'review_notes', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    // The queue is read by status on every load of the review screen.
    await queryInterface.addIndex('jobs', ['status'], { name: 'jobs_status_idx' }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('jobs', 'jobs_status_idx').catch(() => {});
    const table = await queryInterface.describeTable('jobs');
    if (table.review_notes) await queryInterface.removeColumn('jobs', 'review_notes');
    if (table.reviewed_at) await queryInterface.removeColumn('jobs', 'reviewed_at');
    if (table.reviewed_by) await queryInterface.removeColumn('jobs', 'reviewed_by');
    // Postgres cannot drop a value from an ENUM without rebuilding the type;
    // leaving 'pending_review' in place is harmless once no rows use it.
    console.warn('Leaving pending_review in the job status enum: Postgres cannot remove enum values.');
  }
};
