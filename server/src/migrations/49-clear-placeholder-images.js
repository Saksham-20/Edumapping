'use strict';

/**
 * Seeded and early accounts point their avatars and logos at
 * via.placeholder.com. The service now answers with an error graphic rather
 * than failing, so the client's fallback never fires and every one of those
 * users is shown a picture reading "400". No picture is better than that.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE users SET profile_picture = NULL WHERE profile_picture ILIKE '%placeholder.com%'`
    );
    await queryInterface.sequelize.query(
      `UPDATE organizations SET logo_url = NULL WHERE logo_url ILIKE '%placeholder.com%'`
    );
  },
  async down() {}
};
