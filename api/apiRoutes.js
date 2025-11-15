import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/auth.js';
import User from '../models/user.js';
import Reservation from '../models/reservation.js';
import transporter from '../middlewares/mailer.js';
const router = express.Router();


router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).render('login', { error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, 
      sameSite: 'strict'
    });

    return res.status(302).redirect('/api/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).render('login', { error: 'Server error occurred. Please try again.' });
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).render('register', {
        error: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).render('register', {
        error: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('register', {
        error: 'User already exists with this email'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    return res.status(201).render('login', {
      success: 'Registration successful! Please login.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).render('register', {
      error: 'Server error occurred. Please try again.'
    });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  return res.redirect('/');
});

router.post('/reservations', async (req, res) => {
  try {
    const { name, email, phone, date, time, guests, specialRequests, club, clubLocation } = req.body;
    if (!name || !email || !phone || !date || !time || !guests || !club) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const reservation = await Reservation.create({
      name,
      email,
      phone,
      date,
      time,
      guests,
      specialRequests,
      club,
      clubLocation
    });


    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your Table Reservation at ${club}`,
      html: `<h2>Thank you for booking with Club-Verse!</h2>
        <p>Hi ${name},</p>
        <p>Your reservation at <b>${club}</b> is confirmed for <b>${date}</b> at <b>${time}</b> for <b>${guests}</b> guest(s).</p>
        <p>Location: ${clubLocation || ''}</p>
        <p>Special Requests: ${specialRequests || 'None'}</p>
        <p>We look forward to hosting you!</p>
        <br><small>This is an automated email. Please do not reply.</small>`
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Email send error:', err);
      }
    });

    res.status(201).json({ message: 'Reservation successful! Confirmation email sent.' });
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

export default router;
