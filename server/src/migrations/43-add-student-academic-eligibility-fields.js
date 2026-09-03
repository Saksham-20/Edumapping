'use strict';

/**
 * The academic facts Indian job descriptions actually gate on.
 *
 * Eligibility here could express a CGPA floor, a branch list and a graduation
 * year — which is not the eligibility line on most real Indian postings. The
 * criteria that appear again and again are:
 *
 *   * active backlogs (very often "no active backlogs" as an absolute bar)
 *   * Class X and Class XII percentages, canonically "60% in 10th and 12th"
 *   * a diploma percentage for lateral-entry students
 *   * education gaps, usually capped at one or two years
 *
 * None of them could be stored, so none could be checked, and a recruiter's
 * stated bar had to be applied by hand after the fact.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('student_profiles');

    const columns = {
      // Active backlogs — currently failed papers, not historical ones. The
      // distinction matters: "no active backlogs" is satisfiable by clearing
      // them, "never had a backlog" is not, and postings mean the former.
      active_backlogs: { type: Sequelize.INTEGER, allowNull: true },
      total_backlogs: { type: Sequelize.INTEGER, allowNull: true },
      // Percentages rather than CGPA: school boards report percentages, and
      // every posting states these as percentages.
      class10_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      class12_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      // Lateral-entry students have a diploma in place of Class XII.
      diploma_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      // Years of break in education. Capped by many employers at one or two.
      education_gap_years: { type: Sequelize.INTEGER, allowNull: true }
    };

    for (const [name, spec] of Object.entries(columns)) {
      if (!table[name]) {
        await queryInterface.addColumn('student_profiles', name, spec);
      }
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('student_profiles');
    for (const name of [
      'education_gap_years',
      'diploma_percentage',
      'class12_percentage',
      'class10_percentage',
      'total_backlogs',
      'active_backlogs'
    ]) {
      if (table[name]) await queryInterface.removeColumn('student_profiles', name);
    }
  }
};
