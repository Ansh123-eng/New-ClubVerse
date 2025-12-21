import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

import { protect } from '../middlewares/auth.js';
import User from '../models/user.js';
import Reservation from '../models/reservation.js';
import Membership from '../models/membership.js';
import Query from '../models/query.js';
import Club from '../models/club.js';
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

const MEMBERSHIP_DISCOUNTS = {
  'gold': 0.05,     // 5% discount
  'platinum': 0.15, // 15% discount
  'diamond': 0.25   // 25% discount
};

const GROUP_DISCOUNT_THRESHOLD = 10;
const GROUP_DISCOUNT_RATE = 0.05; // 5% discount for large groups

router.post('/user-membership', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const membershipType = await getUserMembershipType(email);

    res.json({
      success: true,
      membershipType: membershipType
    });
  } catch (error) {
    logger.error('User membership fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch membership' });
  }
});

router.post('/calculate-price', async (req, res) => {
  try {
    const { clubName, guests, membershipType } = req.body;

    // Validate inputs
    const guestCount = parseInt(guests) || 1;
    const safeMembership = membershipType ? membershipType.toLowerCase() : 'none';

    // 1. Get Base Price for the selected club from MongoDB
    let basePrice = 300; // Default/minimum base price
    if (clubName) {
      const club = await Club.findOne({ name: clubName }).lean();
      // Use club's base price if found, otherwise the default
      if (club && club.basePrice) {
        basePrice = club.basePrice;
      }
    }

    // 2. Calculate Subtotal
    const subtotal = basePrice * guestCount;

    // 3. Calculate Membership Discount
    const discountRate = MEMBERSHIP_DISCOUNTS[safeMembership] || 0;
    const membershipDiscount = subtotal * discountRate;

    // 4. Calculate Group Discount (if applicable)
    let groupDiscount = 0;
    if (guestCount >= GROUP_DISCOUNT_THRESHOLD) {
      groupDiscount = subtotal * GROUP_DISCOUNT_RATE;
    }

    // 5. Final Total
    const totalAmount = Math.max(0, subtotal - membershipDiscount - groupDiscount);

    res.json({
      success: true,
      data: {
        basePrice,
        subtotal,
        membershipDiscount: Math.round(membershipDiscount),
        groupDiscount: Math.round(groupDiscount),
        totalAmount: Math.round(totalAmount)
      }
    });
  } catch (error) {
    logger.error('Pricing calculation error:', error);
    res.status(500).json({ success: false, message: 'Calculation failed' });
  }
});

// Auth-specific rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection removed to fix server errors

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientIP = getClientIP(req);

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      logger.warn(`Invalid email format attempt from ${clientIP}: ${email}`);
      return res.status(400).render('login', { error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Login attempt for non-existent user: ${email} from ${clientIP}`);
      return res.status(401).render('login', { error: 'Invalid email or password' });
    }

    if (user.isLocked) {
      const lockoutMessage = `Account locked due to too many failed attempts. Try again after ${new Date(user.lockUntil).toLocaleString()}`;
      logger.warn(`Login attempt on locked account: ${email} from ${clientIP}`);
      return res.status(423).render('login', { error: 'Account temporarily locked', lockoutMessage });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await user.incLoginAttempts();
      logger.warn(`Failed login attempt for user: ${email} from ${clientIP}. Attempts: ${user.failedAttempts + 1}`);

      if (user.failedAttempts >= 4) {
        const lockoutMessage = 'Account locked for 2 hours due to multiple failed attempts';
        return res.status(423).render('login', { error: 'Account temporarily locked', lockoutMessage });
      }

      return res.status(401).render('login', { error: 'Invalid email or password' });
    }

    await user.resetLoginAttempts();
    logger.info(`Successful login for user: ${email} from ${clientIP}`);

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
    logger.error('Login error:', error);
    return res.status(500).render('login', { error: 'Server error occurred. Please try again.' });
  }
});

router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const clientIP = getClientIP(req);

    // Basic field validation
    if (!name || !email || !password || !confirmPassword) {
      logger.warn(`Registration attempt with missing fields from ${clientIP}`);
      return res.status(400).render('register', {
        error: 'All fields are required'
      });
    }


    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      logger.warn(`Invalid name format from ${clientIP}: ${name}`);
      return res.status(400).render('register', {
        error: nameValidation.error
      });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      logger.warn(`Invalid email format from ${clientIP}: ${email}`);
      return res.status(400).render('register', {
        error: emailValidation.error
      });
    }

    // Validate password strength
    const passwordValidation = checkPasswordStrength(password);
    if (!passwordValidation.isValid) {
      logger.warn(`Weak password attempt from ${clientIP}`);
      return res.status(400).render('register', {
        error: 'Password does not meet security requirements. Please choose a stronger password.'
      });
    }

    // Validate password confirmation
    const confirmValidation = validatePasswordConfirmation(password, confirmPassword);
    if (!confirmValidation.isValid) {
      logger.warn(`Password confirmation mismatch from ${clientIP}`);
      return res.status(400).render('register', {
        error: confirmValidation.error
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`Registration attempt for existing email from ${clientIP}: ${email}`);
      return res.status(400).render('register', {
        error: 'User already exists with this email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name: nameValidation.sanitizedName,
      email,
      password: hashedPassword
    });

    await user.save();
    logger.info(`New user registered: ${email} from ${clientIP}`);

    return res.status(201).render('login', {
      success: 'Registration successful! Please login.'
    });
  } catch (error) {
    logger.error('Registration error:', error);
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
    const {
      name,
      email,
      phone,
      date,
      time,
      guests,
      specialRequests,
      club,
      clubLocation,
      membershipType,
      discountCode
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !date || !time || !guests || !club) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const guestCount = parseInt(guests);
    if (isNaN(guestCount) || guestCount < 1) {
      return res.status(400).json({ error: 'Invalid number of guests' });
    }

    // Get club base price
    const basePrice = getClubBasePrice(club);

    // Determine membership type
    let finalMembershipType = 'none';
    let validatedDiscountCode = null;

    if (membershipType && membershipType !== 'none') {
      // If membership type is provided directly, validate it belongs to the user
      const userMembership = await getUserMembershipType(email);
      if (userMembership === membershipType) {
        finalMembershipType = membershipType;
      } else {
        return res.status(400).json({ error: 'Invalid membership type for this user' });
      }
    } else if (discountCode) {
      // Validate discount code
      const discountValidation = await validateDiscountCode(discountCode);
      if (discountValidation) {
        finalMembershipType = discountValidation.membershipType;
        validatedDiscountCode = discountCode;
      } else {
        return res.status(400).json({ error: 'Invalid or expired discount code' });
      }
    }

    // Calculate pricing
    const pricing = calculatePricing(guestCount, finalMembershipType, basePrice);

    // Create reservation with calculated pricing
    const reservation = await Reservation.create({
      name,
      email,
      phone,
      date,
      time,
      guests: guestCount,
      specialRequests,
      club,
      clubLocation,
      baseAmount: pricing.baseAmount,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
      membershipType: finalMembershipType,
      discountCode: validatedDiscountCode
    });

    // Send confirmation email with pricing details
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
            <li style="margin: 10px 0;"><strong>👥 Guests:</strong> ${guestCount}</li>
            <li style="margin: 10px 0;"><strong>📍 Location:</strong> ${clubLocation || 'Main Venue'}</li>
            <li style="margin: 10px 0;"><strong>💝 Special Requests:</strong> ${specialRequests || 'None'}</li>
          </ul>
        </div>

        <div style="background: rgba(255,255,255,0.9); padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #28a745;">
          <h3 style="color: #28a745; margin-top: 0;">💰 Payment Summary:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>Base Amount:</strong> ₹${pricing.baseAmount}</li>
            ${pricing.discountAmount > 0 ? `<li style="margin: 8px 0; color: #28a745;"><strong>Membership Discount:</strong> -₹${pricing.discountAmount}</li>` : ''}
            <li style="margin: 8px 0; font-size: 18px; font-weight: bold;"><strong>Total Amount:</strong> ₹${pricing.totalAmount}</li>
            ${finalMembershipType !== 'none' ? `<li style="margin: 8px 0;"><strong>Membership Applied:</strong> ${finalMembershipType.charAt(0).toUpperCase() + finalMembershipType.slice(1)}</li>` : ''}
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

    res.status(201).json({
      message: 'Reservation successful! Confirmation email sent.',
      reservation: {
        id: reservation._id,
        totalAmount: pricing.totalAmount,
        discountAmount: pricing.discountAmount,
        membershipType: finalMembershipType
      }
    });
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/membership', async (req, res) => {
  try {
    // Decode token to get authenticated user
    const decoded = jwt.verify(
      req.cookies.token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    );
    req.user = decoded;

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

    // Create membership in MongoDB Atlas
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

    const membership = new Membership({
      userId: req.user.id, // Use authenticated user ID from JWT token
      name,
      email,
      phone,
      membershipType,
      membershipPeriod,
      status: 'active',
      startDate,
      endDate,
      totalAmount: basePrices[membershipType][membershipPeriod],
      paymentStatus: 'completed' // Assuming payment is completed for now
    });

    await membership.save();

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

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = await Query.create({
      name,
      email,
      phone,
      subject,
      message
    });

    res.status(201).json({ message: 'Query submitted successfully!' });
  } catch (error) {
    console.error('Query submission error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

export default router;
