'use strict';

/**
 * Seeders insert rows with explicit ids, which leaves each table's id
 * sequence behind its data. The first insert after that collides with an
 * existing row ("Key (id)=(1) already exists") and surfaces as a 500 — on
 * production this broke saving a new recruiter's allowed colleges. Migrations
 * 21–29 fixed a handful of tables one at a time; this resets every table that
 * has a serial `id`, so the whole class of failure is gone.
 *
 * Idempotent: setval to MAX(id) (or 1 with is_called=false when empty) is safe
 * to run any number of times and never moves a sequence backwards past data.
 */
module.exports = {
  async up(queryInterface) {
    const [tables] = await queryInterface.sequelize.query(`
      SELECT c.table_name, pg_get_serial_sequence(quote_ident(c.table_name), 'id') AS seq
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'id'
    `);
    for (const { table_name: table, seq } of tables) {
      if (!seq) continue;
      await queryInterface.sequelize.query(
        `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
      );
    }
  },
  async down() {}
};
