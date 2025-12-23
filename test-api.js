import http from 'http';

const API_BASE = 'http://localhost:3000/api';

async function testCalculatePrice() {
  console.log('Testing /api/calculate-price endpoint...');

  const testCases = [
    { clubId: 'club1', guests: 2, membership: 'none' },
    { clubId: 'club1', guests: 2, membership: 'gold' },
    { clubId: 'club2', guests: 4, membership: 'platinum' },
    { clubId: 'club3', guests: 6, membership: 'diamond' },
  ];

  for (const testCase of testCases) {
    try {
      const postData = JSON.stringify(testCase);

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/calculate-price',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const result = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              resolve(`✅ ${testCase.clubId}, ${testCase.guests} guests, ${testCase.membership}: ₹${response.totalAmount}`);
            } else {
              resolve(`❌ Failed for ${JSON.stringify(testCase)}: ${res.statusCode}`);
            }
          });
        });

        req.on('error', (e) => {
          reject(e);
        });

        req.write(postData);
        req.end();
      });

      console.log(result);
    } catch (error) {
      console.log(`❌ Error for ${JSON.stringify(testCase)}: ${error.message}`);
    }
  }
}

async function testReservationWithDiscountCode() {
  console.log('Testing /api/reservations endpoint with discount code...');

  const testCases = [
    {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      date: '2024-12-31',
      time: '20:00',
      guests: '4',
      specialRequests: 'Birthday celebration',
      club: 'Club Verse Main',
      clubLocation: 'Downtown',
      discountCode: 'ABC12345' // Assuming this is a valid discount code
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '0987654321',
      date: '2024-12-31',
      time: '21:00',
      guests: '2',
      specialRequests: 'Anniversary dinner',
      club: 'Club Verse VIP',
      clubLocation: 'Uptown',
      discountCode: 'INVALID12' // Invalid discount code
    },
    {
      name: 'Bob Johnson',
      email: 'bob@example.com',
      phone: '5555555555',
      date: '2024-12-31',
      time: '19:00',
      guests: '6',
      specialRequests: 'Corporate event',
      club: 'Club Verse Lounge',
      clubLocation: 'Midtown'
      // No discount code
    }
  ];

  for (const testCase of testCases) {
    try {
      const postData = JSON.stringify(testCase);

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/reservations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const result = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 201) {
              const response = JSON.parse(data);
              resolve(`✅ Reservation successful for ${testCase.name}: ${response.message}`);
            } else if (res.statusCode === 400) {
              const response = JSON.parse(data);
              resolve(`❌ Bad request for ${testCase.name}: ${response.error}`);
            } else {
              resolve(`❌ Failed for ${testCase.name}: ${res.statusCode} - ${data}`);
            }
          });
        });

        req.on('error', (e) => {
          reject(e);
        });

        req.write(postData);
        req.end();
      });

      console.log(result);
    } catch (error) {
      console.log(`❌ Error for ${testCase.name}: ${error.message}`);
    }
  }
}

testCalculatePrice();
testReservationWithDiscountCode();
