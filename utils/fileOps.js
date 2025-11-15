const fs = require('fs');
const path = require('path');

function saveReservationToFile(data) {
  const filePath = path.join(path.resolve(), 'data', 'reservations.json');

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  let reservations = [];
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      reservations = JSON.parse(fileContent);
      if (!Array.isArray(reservations)) {
        reservations = [reservations];
      }
    } catch (err) {
      reservations = [];
    }
  }

  reservations.push(data);
  fs.writeFileSync(filePath, JSON.stringify(reservations, null, 2));
}

module.exports = {
  saveReservationToFile
};
