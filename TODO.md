# TODO: Migrate Reservation Data to PostgreSQL

## Tasks
- [ ] Update package.json to add Sequelize, pg, and mysql2 dependencies
- [ ] Update db.js to add PostgreSQL connection using Sequelize
- [ ] Convert models/reservation.js to Sequelize model for PostgreSQL
- [ ] Update api/apiRoutes.js to use Sequelize for reservations and remove JSON saving
- [ ] Remove reservation saving logic from utils/fileOps.js
- [ ] Test reservation creation to ensure data goes to PostgreSQL
- [ ] Verify users still use MongoDB
