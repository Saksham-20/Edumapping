'use strict';

/**
 * Indexes for the queries every dashboard and listing runs.
 *
 * A placement cell's roster filters users by institution and role on every
 * page load; recruiter scoping joins the allow-list on both columns; the file
 * access check looks a stored path up by value. All of these were sequential
 * scans, fine on seed data and not on a college with five thousand students.
 * Each index is created only if it does not already exist, so the migration is
 * safe on a database that dev `sync({ alter })` has already touched.
 */
const INDEXES = [
  ['users', ['organization_id', 'role'], 'users_organization_role_idx'],
  ['applications', ['student_id'], 'applications_student_id_idx'],
  ['applications', ['job_id', 'status'], 'applications_job_status_idx'],
  ['jobs', ['organization_id', 'status'], 'jobs_organization_status_idx'],
  ['files', ['file_path'], 'files_file_path_idx'],
  ['recruiter_allowed_organizations', ['recruiter_profile_id', 'organization_id'], 'recruiter_allowed_orgs_profile_org_idx'],
  ['otp_verifications', ['identifier', 'purpose', 'expires_at'], 'otp_verifications_lookup_idx'],
  ['event_registrations', ['event_id', 'status'], 'event_registrations_event_status_idx'],
  ['audit_logs', ['user_id', 'action'], 'audit_logs_user_action_idx'],
  ['notifications', ['user_id', 'is_read'], 'notifications_user_read_idx'],
  ['offers', ['student_id', 'status'], 'offers_student_status_idx'],
  ['student_profiles', ['verification_status'], 'student_profiles_verification_idx']
];

module.exports = {
  async up(queryInterface) {
    for (const [table, fields, name] of INDEXES) {
      const columns = await queryInterface.describeTable(table).catch(() => null);
      if (!columns || !fields.every((f) => columns[f])) continue;
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${fields.map((f) => `"${f}"`).join(', ')})`
      );
    }
  },
  async down(queryInterface) {
    for (const [, , name] of INDEXES) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
    }
  }
};
