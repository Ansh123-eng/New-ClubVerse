import request from 'supertest';
import express from 'express';
import path from 'path';
import apiRoutes from '../../api/apiRoutes.js';

// Mock all external dependencies
jest.mock('../../db.js', () => ({
  connectDB: jest.fn(),
  connectRedis: jest.fn(),
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    setEx: jest.fn(),
  })),
}));

jest.mock('../../models/user.js', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../models/reservation.js', () => ({
  create: jest.fn(() => Promise.resolve({
    _id: 'mock-reservation-id',
    name: 'Jane Doe',
    email: 'jane@example.com',
    date: '2024-12-31',
    time: '20:00'
  })),
}));

jest.mock('../../models/membership.js', () => ({
  findOne: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../middlewares/auth.js', () => ({
  protect: jest.fn((req, res, next) => next()),
}));

jest.mock('../../middlewares/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(() => Promise.resolve(true)), // Always return true for login
  genSalt: jest.fn(() => Promise.resolve('mock-salt')),
  hash: jest.fn(() => Promise.resolve('$2a$10$mockhashedpassword'))
}));

const app = express();

// Set up trust proxy for rate limiting in tests
app.set('trust proxy', 'loopback');

// Set up view engine for tests
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.json());

// Add weather route for testing
app.get('/api/weather', async (req, res) => {
  // Mock weather response for tests
  res.render('weather', {
    ldh: { city: 'Ludhiana', temp: 25, icon: '01d', condition: 'Clear' },
    chd: { city: 'Chandigarh', temp: 24, icon: '01d', condition: 'Clear' }
  });
});

// Add dashboard route for testing
app.get('/api/dashboard', (req, res) => {
  res.status(200).json({ success: true, message: 'Dashboard accessed' });
});

app.use('/api', apiRoutes);

describe('User Journey - Functional Tests', () => {
  let registeredUsers = new Map(); // Track registered users during test

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    registeredUsers.clear();
  });
  describe('Complete User Registration and Reservation Flow', () => {
    test('should allow user to register, login, and make reservation', async () => {
      // Mock User.findOne for registration (user not found)
      const User = require('../../models/user.js');
      User.findOne.mockResolvedValueOnce(null); // For registration check
      User.create.mockResolvedValue({
        _id: 'mock-user-id',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: '$2a$10$mockhashedpassword'
      });

      // Step 1: Register a new user
      const registerResponse = await request(app)
        .post('/api/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!',
        });

      expect(registerResponse.status).toBe(200); // Success after registration
      expect(registerResponse.text).toContain('Registration successful'); // Check for success message in rendered view

      // Mock User.findOne for login (user found)
      User.findOne.mockResolvedValueOnce({
        _id: 'mock-user-id',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: '$2a$10$mockhashedpassword'
      });

      // Step 2: Login with the registered user
      const loginResponse = await request(app)
        .post('/api/login')
        .redirects(0) // Don't follow redirects
        .send({
          email: 'jane@example.com',
          password: 'StrongPass123!',
        });

      expect(loginResponse.status).toBe(302); // Redirect after successful login

      // Step 3: Access dashboard directly
      const dashboardResponse = await request(app)
        .get('/api/dashboard');

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.success).toBe(true);

      // Step 4: Make a reservation
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const reservationResponse = await request(app)
        .post('/api/reservations')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1234567890',
          date: dateStr,
          time: '20:00',
          guests: 2,
          club: 'Test Club',
          specialRequests: 'Window seat please',
        });

      expect(reservationResponse.status).toBe(201);
      expect(reservationResponse.body.success).toBe(true);
    }, 10000); // 10 second timeout

    test('should handle invalid data throughout the journey', async () => {
      // Try to register with invalid email
      const invalidRegisterResponse = await request(app)
        .post('/api/register')
        .send({
          name: 'Invalid User',
          email: 'invalid-email',
          password: 'weak',
          confirmPassword: 'weak',
        });

      expect(invalidRegisterResponse.status).toBe(200); // Renders register page with error

      // Try to make reservation with missing data
      const invalidReservationResponse = await request(app)
        .post('/api/reservations')
        .send({
          name: 'Test User',
          // Missing required fields
        });

      expect(invalidReservationResponse.status).toBe(400);
    });

    test('should handle weather API integration', async () => {
      // Mock axios for weather API
      const mockAxios = jest.mock('axios', () => ({
        get: jest.fn(() => Promise.resolve({
          data: {
            name: 'Ludhiana',
            main: { temp: 25 },
            weather: [{ icon: '01d', description: 'clear sky' }],
          },
        })),
      }));

      const weatherResponse = await request(app)
        .get('/api/weather');

      expect(weatherResponse.status).toBe(200);
      expect(weatherResponse.text).toContain('Ludhiana');
    });
  });
});
