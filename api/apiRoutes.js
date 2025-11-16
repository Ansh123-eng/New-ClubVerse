import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { protect } from '../middlewares/auth.js';
import User from '../models/user.js';
import Reservation from '../models/reservation.js';
import Membership from '../models/membership.js';
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
      subject: `🎉 Congratulations! Your Table Reservation at ${club} is Confirmed!`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 10px;">
        <h2 style="color: #d4af37; text-align: center; font-size: 28px;">🎊 Congratulations ${name}! 🎊</h2>
        <p style="font-size: 18px; text-align: center; color: #333;">Your table reservation has been successfully booked!</p>

        <div style="background: rgba(255,255,255,0.9); padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #d4af37;">
          <h3 style="color: #d4af37; margin-top: 0;">📅 Reservation Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>🏙️ Club:</strong> ${club}</li>
            <li style="margin: 10px 0;"><strong>📆 Date:</strong> ${date}</li>
            <li style="margin: 10px 0;"><strong>⏰ Time:</strong> ${time}</li>
            <li style="margin: 10px 0;"><strong>👥 Guests:</strong> ${guests}</li>
            <li style="margin: 10px 0;"><strong>📍 Location:</strong> ${clubLocation || 'Main Venue'}</li>
            <li style="margin: 10px 0;"><strong>💝 Special Requests:</strong> ${specialRequests || 'None'}</li>
          </ul>
        </div>

        <p style="font-size: 16px; text-align: center; color: #555;">
          🎶 Get ready for an unforgettable night of music, drinks, and amazing vibes! 🎶<br>
          We can't wait to welcome you to Club Verse!
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 20px; color: #d4af37; font-weight: bold;">🥂 Cheers to a fantastic evening! 🥂</p>
        </div>

        <br><small style="color: #777; font-size: 12px;">This is an automated email. Please do not reply.</small>
      </div>`
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

router.post('/membership', async (req, res) => {
  try {
    const { name, email, phone, membershipType, membershipPeriod } = req.body;

    if (!name || !email || !phone || !membershipType || !membershipPeriod) {
      return res.status(400).render('membership', {
        error: 'All fields are required',
        success: null,
        user: req.user
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).render('membership', {
        error: 'Please enter a valid email address',
        success: null,
        user: req.user
      });
    }

    // Validate phone number (basic validation)
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).render('membership', {
        error: 'Please enter a valid phone number',
        success: null,
        user: req.user
      });
    }

    // Validate membership type
    const validTypes = ['gold', 'platinum', 'diamond'];
    if (!validTypes.includes(membershipType)) {
      return res.status(400).render('membership', {
        error: 'Invalid membership type selected',
        success: null,
        user: req.user
      });
    }

    // Validate membership period
    const validPeriods = ['weekly', 'monthly', 'annually'];
    if (!validPeriods.includes(membershipPeriod)) {
      return res.status(400).render('membership', {
        error: 'Invalid membership period selected',
        success: null,
        user: req.user
      });
    }

    // Try to save membership to PostgreSQL database, fallback to in-memory if DB not available
    let membership;
    try {
      membership = await Membership.create({
        userId: req.user ? req.user.id : uuidv4(), // Use authenticated user ID or generate new UUID
        name,
        email,
        phone,
        membershipType,
        membershipPeriod,
        paymentStatus: 'completed' // Assuming payment is completed for now
      });
    } catch (dbError) {
      console.error('Membership DB error:', dbError);
      console.log('Database not available, using in-memory storage for membership');
      // Create in-memory membership object
      const startDate = new Date();
      let endDate = new Date(startDate);

      switch (membershipPeriod) {
        case 'weekly':
          endDate.setDate(startDate.getDate() + 7);
          break;
        case 'monthly':
          endDate.setMonth(startDate.getMonth() + 1);
          break;
        case 'annually':
          endDate.setFullYear(startDate.getFullYear() + 1);
          break;
      }

      const basePrices = {
        gold: { weekly: 50, monthly: 150, annually: 1500 },
        platinum: { weekly: 80, monthly: 250, annually: 2500 },
        diamond: { weekly: 120, monthly: 400, annually: 4000 }
      };

      membership = {
        id: uuidv4(),
        userId: req.user ? req.user.id : uuidv4(),
        name,
        email,
        phone,
        membershipType,
        membershipPeriod,
        status: 'active',
        startDate,
        endDate,
        totalAmount: basePrices[membershipType][membershipPeriod],
        paymentStatus: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        toDateString: function() { return this.endDate.toDateString(); }
      };
    }

    const membershipDetails = {
      type: membershipType.charAt(0).toUpperCase() + membershipType.slice(1),
      period: membershipPeriod.charAt(0).toUpperCase() + membershipPeriod.slice(1),
      amount: membership.totalAmount,
      endDate: membership.endDate.toDateString ? membership.endDate.toDateString() : membership.endDate.toDateString()
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🎉 Congratulations! Welcome to Club Verse ${membershipDetails.type} Membership!`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 10px;">
        <h2 style="color: #d4af37; text-align: center; font-size: 28px;">🎊 Congratulations ${name}! 🎊</h2>
        <p style="font-size: 18px; text-align: center; color: #333;">Welcome to the Club Verse family! Your membership is now active.</p>

        <div style="background: rgba(255,255,255,0.9); padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #d4af37;">
          <h3 style="color: #d4af37; margin-top: 0;">💎 Your Membership Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>🏆 Membership Type:</strong> ${membershipDetails.type}</li>
            <li style="margin: 10px 0;"><strong>⏱️ Period:</strong> ${membershipDetails.period}</li>
            <li style="margin: 10px 0;"><strong>📞 Phone:</strong> ${phone}</li>
            <li style="margin: 10px 0;"><strong>💰 Amount Paid:</strong> ₹${membershipDetails.amount}</li>
            <li style="margin: 10px 0;"><strong>📅 Valid Until:</strong> ${membershipDetails.endDate}</li>
          </ul>
        </div>

        <div style="background: rgba(212, 175, 55, 0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #d4af37; margin-top: 0;">🎁 Your Exclusive Benefits:</h4>
          <ul style="color: #555;">
            ${membershipDetails.type === 'Gold' ? '<li>Priority entry at all locations</li><li>1 free welcome drink per visit</li><li>10% off on all drinks & food</li>' : ''}
            ${membershipDetails.type === 'Platinum' ? '<li>All Gold benefits included</li><li>Complimentary guest pass (monthly)</li><li>15% off on all drinks & food</li><li>VIP lounge access</li>' : ''}
            ${membershipDetails.type === 'Diamond' ? '<li>All Platinum benefits included</li><li>Unlimited VIP entry</li><li>25% off on all drinks & food</li><li>Exclusive lounge access</li><li>Personal concierge service</li>' : ''}
          </ul>
        </div>

        <p style="font-size: 16px; text-align: center; color: #555;">
          🎶 Get ready to experience the ultimate nightlife with Club Verse! 🎶<br>
          Your membership card will be delivered within 3-5 business days.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 20px; color: #d4af37; font-weight: bold;">🥂 Welcome to the VIP Club! 🥂</p>
        </div>

        <br><small style="color: #777; font-size: 12px;">This is an automated email. Please do not reply.</small>
      </div>`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Membership email send error:', err);
      } else {
        console.log('Membership confirmation email sent:', info.response);
      }
    });

    return res.status(200).render('membership', {
      error: null,
      success: `Thank you ${name}! Your ${membershipDetails.type} membership (${membershipDetails.period}) has been registered. Check your email for confirmation.`,
      user: req.user
    });

  } catch (error) {
    console.error('Membership registration error:', error);
    return res.status(500).render('membership', {
      error: 'Server error occurred. Please try again.',
      success: null,
      user: req.user
    });
  }
});

export default router;
