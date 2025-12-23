import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

import User from '../models/user.js';
import Reservation from '../models/reservation.js';
import Membership from '../models/membership.js';
import Query from '../models/query.js';
import Club from '../models/club.js';
import TicketBooking from '../models/ticketBooking.js';

import transporter from '../middlewares/mailer.js';
import {
  checkPasswordStrength,
  validateEmail,
  validateName,
  validatePasswordConfirmation,
  generateResetToken,
  hashResetToken,
  getClientIP
} from '../utils/validation.js';

import { logger } from '../middlewares/logger.js';

import {
  calculatePricing,
  getClubBasePrice,
  validateDiscountCode,
  getUserMembershipType
} from '../utils/pricing.js';

const router = express.Router();

/* ---------------- CONSTANTS ---------------- */

const MEMBERSHIP_DISCOUNTS = { gold: 0.05, platinum: 0.15, diamond: 0.25 };
const GROUP_DISCOUNT_THRESHOLD = 10;
const GROUP_DISCOUNT_RATE = 0.05;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 });

/* ---------------- DASHBOARD ---------------- */

router.get('/dashboard', async (req, res) => {
  try {
    let userData = null;
    const token = req.cookies?.token;

    if (token) {
      try {
        userData = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      } catch {}
    }

    if (userData?.id) {
      const membership = await Membership.findOne({
        userId: userData.id,
        status: 'active'
      }).sort({ createdAt: -1 });

      if (membership) {
        userData.membership = {
          type: membership.membershipType,
          startDate: membership.startDate,
          endDate: membership.endDate
        };
      }
    }

    const instaImages = [
      'food.jpg','drink.jpg','pizza.jpg','beerr.avif',
      'hand.png','taco.png','drum.png','wine.png'
    ];

    res.render('dashboard', { instaImages, user: userData || null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

/* ---------------- LOGIN ---------------- */

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email).isValid)
      return res.render('login', { error: 'Invalid email' });

    const user = await User.findOne({ email });
    if (!user) return res.render('login', { error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, { httpOnly: true });
    res.redirect('/api/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Server error' });
  }
});

/* ---------------- REGISTER ---------------- */

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword)
      return res.render('register', { error: 'All fields required' });

    if (!validateEmail(email).isValid)
      return res.render('register', { error: 'Invalid email' });

    if (!checkPasswordStrength(password).isValid)
      return res.render('register', { error: 'Weak password' });

    if (!validatePasswordConfirmation(password, confirmPassword).isValid)
      return res.render('register', { error: 'Passwords do not match' });

    const exists = await User.findOne({ email });
    if (exists) return res.render('register', { error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed });

    res.render('login', { success: 'Registration successful' });
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Server error' });
  }
});

/* ---------------- LOGOUT ---------------- */

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

/* ---------------- USER MEMBERSHIP ---------------- */

router.post('/user-membership', async (req, res) => {
  try {
    const { email } = req.body;
    const membershipType = await getUserMembershipType(email);
    res.json({ success: true, membershipType });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* ---------------- CALCULATE PRICE ---------------- */

router.post('/calculate-price', async (req, res) => {
  try {
    const { clubName, guests, membershipType } = req.body;

    const guestCount = Number(guests) || 1;
    let basePrice = 300;

    if (clubName) {
      const club = await Club.findOne({ name: clubName });
      if (club?.basePrice) basePrice = club.basePrice;
    }

    const subtotal = basePrice * guestCount;
    const memberDiscount = subtotal * (MEMBERSHIP_DISCOUNTS[membershipType] || 0);
    const groupDiscount = guestCount >= GROUP_DISCOUNT_THRESHOLD
      ? subtotal * GROUP_DISCOUNT_RATE
      : 0;

    res.json({
      success: true,
      data: {
        basePrice,
        subtotal,
        membershipDiscount: Math.round(memberDiscount),
        groupDiscount: Math.round(groupDiscount),
        totalAmount: Math.round(subtotal - memberDiscount - groupDiscount)
      }
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* ---------------- RESERVATION ---------------- */

router.post('/reservations', async (req, res) => {
  try {
    const { name, email, phone, date, time, guests, club } = req.body;

    const pricing = calculatePricing(
      Number(guests),
      'none',
      getClubBasePrice(club)
    );

    const reservation = await Reservation.create({
      name,
      email,
      phone,
      date,
      time,
      guests,
      club,
      ...pricing
    });

    res.status(201).json({ success: true, reservation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reservation failed' });
  }
});

/* ---------------- BOOK TICKETS (FIXED) ---------------- */

router.get('/book-tickets', async (req, res) => {
  const clubs = await Club.find({}, { name: 1 });
  res.render('bookTickets', {
    club: req.query.club || '',
    event: req.query.event || '',
    clubs: clubs.map(c => c.name)
  });
});

router.post('/book-tickets', async (req, res) => {
  try {
    console.log('🟡 RAW BOOKING BODY:', req.body);

    const booking = await TicketBooking.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      club: req.body.club || 'UNKNOWN_CLUB',
      eventId: req.body.eventId || req.body.event || 'UNKNOWN_EVENT',
      tickets: Number(req.body.tickets || 1),
      membershipType: req.body.membershipType || 'none',
      discountCode: req.body.discountCode || null,
      totalAmount: Number(req.body.totalAmount || 0)
    });

    console.log('✅ TICKET SAVED:', booking._id);

    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error('❌ Ticket error:', err);
    res.status(500).json({ error: 'Ticket booking failed' });
  }
});

/* ---------------- CONTACT ---------------- */

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const query = await Query.create({
      name,
      email,
      phone,
      subject,
      message
    });

    res.status(201).json({ success: true, message: 'Thank you for your feedback! Our team will connect with you soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit query' });
  }
});

export default router;
