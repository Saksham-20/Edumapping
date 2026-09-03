'use strict';

/**
 * Resynchronise every identity sequence with the data the seeders inserted.
 *
 * The seeders insert explicit primary keys (`id: 1`, `id: 2`, …), which does
 * NOT advance the underlying Postgres sequence. So immediately after seeding,
 * the next INSERT that lets the database assign an id picks 1 — a value that
 * already exists — and fails on the primary key.
 *
 * That is why `fix-user-sequence.js`, `fix-events-sequence.js` and
 * `fix-organizations-sequence.js` exist as loose scripts in the server root,
 * and why migrations 24-26 and 29 do the same thing. Those cover four tables;
 * every other table was left broken. In practice that meant a freshly seeded
 * install could not accept a single job application — `POST /api/applications`
 * died on a duplicate key before it ever wrote a row.
 *
 * Running this as the last seeder fixes all of them at once, so `db:seed`
 * leaves a database that actually works.
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT
        c.relname                        AS table_name,
        a.attname                        AS column_name,
        pg_get_serial_sequence(quote_ident(c.relname), a.attname) AS sequence_name
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL
    `);
    // quote_ident is required: pg_get_serial_sequence folds an unquoted name
    // to lower case, and the mixed-case "SequelizeMeta" table then resolves to
    // a relation that does not exist and aborts the whole query.

    for (const { table_name: table, column_name: column, sequence_name: sequence } of rows) {
      // setval(..., false) when the table is empty so the next value is 1
      // rather than 2; COALESCE keeps an empty table from erroring on max().
      await queryInterface.sequelize.query(`
        SELECT setval(
          '${sequence}',
          COALESCE((SELECT MAX("${column}") FROM "${table}"), 1),
          (SELECT MAX("${column}") IS NOT NULL FROM "${table}")
        )
      `);
    }
  },

  async down() {
    // Nothing to undo: this only realigns sequences with existing rows.
  }
};
