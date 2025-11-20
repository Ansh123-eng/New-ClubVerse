import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import dotenv from 'dotenv';
import debugModule from 'debug';
import axios from 'axios';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import mongoose from 'mongoose';
import fs from 'fs';
import https from 'https';
import http from 'http';
import jwt from 'jsonwebtoken';

import logger, { logger as winstonLogger } from './middlewares/logger.js';
import errorHandler from './middlewares/errorHandler.js';
import { protect } from './middlewares/auth.js';
import connectDB, { connectPostgres, connectRedis, getRedisClient } from './db.js';
import apiRoutes from './api/apiRoutes.js';

const debug = debugModule('clubverse:server');
debug('Starting server...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const HTTP_PORT = process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 8080;
const HTTPS_PORT = process.env.HTTPS_PORT ? Number(process.env.HTTPS_PORT) : 8443;

// ====== MIDDLEWARES ======
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'", "*"],
      "img-src": ["'self'", "https:", "data:"],
      "script-src": ["'self'", "*", "'unsafe-inline'"],
      "script-src-attr": ["'self'", "*", "'unsafe-inline'"]
    }
  })
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RATE LIMITERS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  headers: true
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF PROTECTION
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    // only secure cookie in production (so local dev over http doesn't break)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

app.use(logger);
app.use((req, res, next) => {
  winstonLogger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// STATIC FILES WITH CACHE
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// ====== ROOT ROUTE ======
app.get('/', (req, res) => {
  res.redirect('/login');
});

// ====== ROUTES ======
app.use('/api', apiRoutes);

// LOGIN & REGISTER ROUTES WITH CSRF
app.get('/login', csrfProtection, (req, res) => {
  res.render('login', { csrfToken: req.csrfToken() });
});

app.get('/register', csrfProtection, (req, res) => {
  res.render('register', { error: null, csrfToken: req.csrfToken() });
});

// APPLY CSRF PROTECTION TO API endpoints that handle auth actions
app.use('/api/login', csrfProtection, authLimiter);
app.use('/api/register', csrfProtection, registerLimiter);

// CSRF ERROR HANDLER
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

// ====== DATABASE CONNECTIONS ======
winstonLogger.info("DEBUG MONGO_URI:", { mongoUri: process.env.MONGO_URI });

connectDB();
connectPostgres();
connectRedis();

// ====== HTTPS SETUP ======
let httpsServer;
try {
  const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
  };

  // HTTPS SERVER
  httpsServer = https.createServer(sslOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    winstonLogger.info(`HTTPS Server running at https://localhost:${HTTPS_PORT}`);
  });

  // HTTP → HTTPS REDIRECT
  const httpApp = express();
  httpApp.use((req, res) => {
    const hostWithoutPort = req.headers.host.replace(/:\d+$/, '');
    res.redirect(`https://${hostWithoutPort}:${HTTPS_PORT}${req.url}`);
  });
  http.createServer(httpApp).listen(HTTP_PORT, () => {
    winstonLogger.info(`HTTP Server redirecting to HTTPS`);
  });
} catch (err) {
  // If SSL files are not present (local dev), fallback to HTTP only for convenience
  winstonLogger.warn('SSL setup failed or files missing. Falling back to HTTP (dev only).', err);
  const server = app.listen(process.env.PORT || 3000, () => {
    winstonLogger.info(`HTTP Server running at http://localhost:${process.env.PORT || 3000}`);
  });
}

// ====== Simple helper: decode JWT if present ======
function decodeTokenFromRequest(req) {
  // Try cookie first
  let token = null;
  if (req.cookies && req.cookies.token) token = req.cookies.token;

  // Then Authorization header
  if (!token && req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET || 'your_jwt_secret';
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    winstonLogger.warn('Invalid or expired JWT:', err.message || err);
    return null;
  }
}

// ====== DASHBOARD route that populates req.user if token present ======
app.get('/api/dashboard', (req, res) => {
  // Attempt to decode token and attach to req.user
  const decoded = decodeTokenFromRequest(req);
  if (decoded) {
    // If your token stores user as { id, email, name } or similar, adapt accordingly.
    req.user = decoded;
  } else {
    req.user = null;
  }

  const instaImages = [
    'food.jpg', 'drink.jpg', 'pizza.jpg', 'beerr.avif',
    'hand.png', 'taco.png',
    'drum.png', 'wine.png'
  ];

  // If you prefer redirecting unauthorized users to login:
  // if (!req.user) return res.redirect('/login');

  // If your frontend expects JSON:
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      message: "Dashboard Loaded Successfully",
      user: req.user || null
    });
  }

  // Otherwise render dashboard EJS view (server-rendered)
  res.render('dashboard', { instaImages, user: req.user });
});

// ====== OTHER PAGES (example kept intact) ======
app.get('/api/membership', (req, res) => {
  res.render('membership', { error: null, success: null, user: null });
});

const chdBars = [
  { name: "BREWESTATE", image: "/images/brewestate.png", link: "/api/brewestate" },
  { name: "BOULEVARD", image: "/images/boul.png", link: "/api/boulevard" },
  { name: "KALA-GHODA", image: "/images/kalaghoda.jpg", link: "/api/kalaghoda" },
  { name: "MOBE", image: "/images/mobe.png", link: "/api/mobe" }
];

const ldhBars = [
  { name: "PAARA - NIGHT CLUB", image: "/images/paara2.jpg", link: "/api/paara" },
  { name: "ROMEO LANE", image: "/images/romeolane.jpg", link: "/api/romeo-ldh" },
  { name: "LUNA - NIGHT CLUB", image: "/images/luna2.avif", link: "/api/luna-ldh" },
  { name: "BAKLAVI - BAR & KITCHEN", image: "/images/baklavi.jpg", link: "/api/baklavi-ldh" }
];

app.get('/api/bar', (req, res) => {
  // attach user if token present
  const decoded = decodeTokenFromRequest(req);
  req.user = decoded || null;
  res.render('baars', { chdBars, ldhBars, user: req.user });
});

const team = [
  { name: "Ansh Vohra", role: "Back-End Web Developer", image: "/images/ansh.jpg" },
  { name: "Akhil Handa", role: "Back-End Web Developer", image: "/images/akhil.jpg" },
  { name: "Anmol Singh", role: "Back-End Web Developer", image: "/images/anmol11.jpg" }
];
app.get('/api/team', (req, res) => {
  const decoded = decodeTokenFromRequest(req);
  req.user = decoded || null;
  res.render('team', { team, user: req.user });
});

app.get('/api/reserve-table', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reservation.html'));
});

const barPages = ['brewestate', 'boulevard', 'kalaghoda', 'mobe', 'paara', 'romeo-ldh', 'luna-ldh', 'baklavi-ldh'];
barPages.forEach(page => {
  app.get(`/api/${page}`, (req, res) => {
    req.user = decodeTokenFromRequest(req) || null;
    res.render(page, { user: req.user });
  });
});

const staticPages = ['faq', 'ourservices', 'contactus'];
staticPages.forEach(page => {
  app.get(`/api/${page}`, (req, res) => {
    res.render(page);
  });
});

// Weather route
app.get('/api/weather', async (req, res) => {
  try {
    console.log('Received /api/weather request from', req.ip || req.connection.remoteAddress);
    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY;
    console.log('OPENWEATHER_API_KEY present?', !!apiKey);
    if (!apiKey) {
      console.error('OPENWEATHER_API_KEY environment variable is missing');
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    const ldhResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Ludhiana&appid=${apiKey}&units=metric`);
    const chdResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Chandigarh&appid=${apiKey}&units=metric`);

    const ldh = {
      city: ldhResponse.data.name,
      temp: Math.round(ldhResponse.data.main.temp),
      icon: ldhResponse.data.weather[0].icon,
      condition: ldhResponse.data.weather[0].description
    };

    const chd = {
      city: chdResponse.data.name,
      temp: Math.round(chdResponse.data.main.temp),
      icon: chdResponse.data.weather[0].icon,
      condition: chdResponse.data.weather[0].description
    };

    res.render('weather', { ldh, chd });
  } catch (error) {
    console.error('Weather API error:', error && error.stack ? error.stack : error);
    if (error.response) {
      console.error('Weather API response status:', error.response.status);
      console.error('Weather API response data:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// ====== ERROR HANDLER ======
app.use(errorHandler);

// ====== GLOBAL ERROR HANDLING ======
process.on('uncaughtException', (err) => {
  winstonLogger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  winstonLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});