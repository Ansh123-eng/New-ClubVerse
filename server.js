// import express from 'express';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// import dotenv from 'dotenv';
// import debugModule from 'debug';
// import axios from 'axios';
// import morgan from 'morgan';
// import helmet from 'helmet';
// import cors from 'cors';
// import rateLimit from 'express-rate-limit';
// import cookieParser from 'cookie-parser';
// import csurf from 'csurf';
// import mongoose from 'mongoose';

// import logger, { logger as winstonLogger } from './middlewares/logger.js';
// import errorHandler from './middlewares/errorHandler.js';
// import { protect } from './middlewares/auth.js';
// import connectDB, { connectPostgres, connectRedis, getRedisClient } from './db.js';
// import apiRoutes from './api/apiRoutes.js';

// const debug = debugModule('clubverse:server');
// debug('Starting server...');

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// dotenv.config({ path: path.join(__dirname, '.env') });

// const app = express();
// const PORT = 3000;

// // ====== MIDDLEWARES ======
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));

// app.use(morgan('dev'));
// app.use(helmet.contentSecurityPolicy({
//   useDefaults: true,
//   directives: {
//     "default-src": ["'self'", "*"],
//     "img-src": ["'self'", "https:", "data:"],
//     "script-src": ["'self'", "*", "'unsafe-inline'"],
//     "script-src-attr": ["'self'", "*", "'unsafe-inline'"]
//   }
// }));
// app.use(cors());
// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // RATE LIMITERS
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests from this IP, please try again later.',
//   headers: true
// });
// app.use('/api', apiLimiter);

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, 
//   max: 5, 
//   message: 'Too many login attempts, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// const registerLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, 
//   max: 3, 
//   message: 'Too many registration attempts, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // CSRF PROTECTION
// const csrfProtection = csurf({
//   cookie: {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'strict'
//   }
// });

// app.use(logger);
// app.use((req, res, next) => {
//   winstonLogger.info(`Incoming request: ${req.method} ${req.url}`);
//   next();
// });

// // STATIC FILES WITH CACHE
// app.use(express.static(path.join(__dirname, 'public'), {
//   setHeaders: (res, path) => {
//     if (path.endsWith('.css') || path.endsWith('.js')) {
//       res.setHeader('Cache-Control', 'public, max-age=31536000');
//     } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
//       res.setHeader('Cache-Control', 'public, max-age=86400');
//     }
//   }
// }));

// // ====== ROOT ROUTE ======
// app.get('/', (req, res) => {
//   res.redirect('/login');
// });

// // ====== ROUTES ======
// app.use('/api', apiRoutes);

// // LOGIN & REGISTER ROUTES WITH CSRF
// app.get('/login', csrfProtection, (req, res) => {
//   res.render('login', { csrfToken: req.csrfToken() });
// });

// app.get('/register', csrfProtection, (req, res) => {
//   res.render('register', { error: null, csrfToken: req.csrfToken() });
// });

// // APPLY CSRF PROTECTION TO API
// app.use('/api/login', csrfProtection, authLimiter);
// app.use('/api/register', csrfProtection, registerLimiter);

// // CSRF ERROR HANDLER
// app.use((err, req, res, next) => {
//   if (err.code === 'EBADCSRFTOKEN') {
//     return res.status(403).json({ error: 'Invalid CSRF token' });
//   }
//   next(err);
// });

// // DASHBOARD
// app.get('/api/dashboard', protect, (req, res) => {
//   const instaImages = [
//     'food.jpg', 'drink.jpg', 'pizza.jpg', 'beerr.avif',
//     'hand.png', 'taco.png',
//     'drum.png', 'wine.png'
//   ];
//   res.render('dashboard', { instaImages, user: req.user });
// });

// // MEMBERSHIP PAGE
// app.get('/api/membership', (req, res) => {
//   res.render('membership', { error: null, success: null, user: null });
// });

// // BAR PAGES
// const chdBars = [
//   { name: "BREWESTATE", image: "/images/brewestate.png", link: "/api/brewestate" },
//   { name: "BOULEVARD", image: "/images/boul.png", link: "/api/boulevard" },
//   { name: "KALA-GHODA", image: "/images/kalaghoda.jpg", link: "/api/kalaghoda" },
//   { name: "MOBE", image: "/images/mobe.png", link: "/api/mobe" }
// ];

// const ldhBars = [
//   { name: "PAARA - NIGHT CLUB", image: "/images/paara2.jpg", link: "/api/paara" },
//   { name: "ROMEO LANE", image: "/images/romeolane.jpg", link: "/api/romeo-ldh" },
//   { name: "LUNA - NIGHT CLUB", image: "/images/luna2.avif", link: "/api/luna-ldh" },
//   { name: "BAKLAVI - BAR & KITCHEN", image: "/images/baklavi.jpg", link: "/api/baklavi-ldh" }
// ];

// app.get('/api/bar', protect, (req, res) => {
//   res.render('baars', { chdBars, ldhBars, user: req.user });
// });

// // TEAM PAGE
// app.get('/api/team', protect, (req, res) => {
//   const team = [
//     { name: "Ansh Vohra", role: "Back-End Web Developer", image: "/images/ansh.jpg" },
//     { name: "Akhil Handa", role: "Back-End Web Developer", image: "/images/akhil.jpg" },
//     { name: "Anmol Singh", role: "Back-End Web Developer", image: "/images/anmol11.jpg" }
//   ];
//   res.render('team', { team, user: req.user });
// });

// // RESERVATION PAGE
// app.get('/api/reserve-table', protect, (req, res) => {
//   res.sendFile(path.join(__dirname, 'views', 'reservation.html'));
// });

// // WEATHER PAGE WITH REDIS CACHE
// app.get(['/weather', '/api/weather'], async (req, res) => {
//   try {
//     const redisClient = getRedisClient();
//     const cacheKey = 'weather_data_page';

//     if (redisClient) {
//       const cachedData = await redisClient.get(cacheKey);
//       if (cachedData) {
//         console.log('Serving weather page from cache');
//         return res.render('weather', JSON.parse(cachedData));
//       }
//     }

//     const apiKey = process.env.OPENWEATHER_API_KEY;
//     const [ldhRes, chdRes] = await Promise.all([
//       axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Ludhiana,in&appid=${apiKey}&units=metric`),
//       axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Chandigarh,in&appid=${apiKey}&units=metric`)
//     ]);

//     const weatherData = {
//       ldh: {
//         city: ldhRes.data.name,
//         temp: ldhRes.data.main.temp,
//         condition: ldhRes.data.weather[0].description,
//         icon: ldhRes.data.weather[0].icon
//       },
//       chd: {
//         city: chdRes.data.name,
//         temp: chdRes.data.main.temp,
//         condition: chdRes.data.weather[0].description,
//         icon: chdRes.data.weather[0].icon
//       }
//     };

//     if (redisClient) {
//       await redisClient.setEx(cacheKey, 600, JSON.stringify(weatherData));
//       console.log('Weather page data cached in Redis');
//     }

//     res.render('weather', weatherData);
//   } catch (error) {
//     console.error('Error fetching weather:', error);
//     res.status(500).send('Failed to fetch weather. Try again later.');
//   }
// });

// // STATIC & BAR PAGES
// const barPages = ['brewestate', 'boulevard', 'kalaghoda', 'mobe', 'paara', 'romeo-ldh', 'luna-ldh', 'baklavi-ldh'];
// barPages.forEach(page => {
//   app.get(`/api/${page}`, protect, (req, res) => {
//     res.render(page, { user: req.user });
//   });
// });

// const staticPages = ['faq', 'ourservices', 'contactus'];
// staticPages.forEach(page => {
//   app.get(`/api/${page}`, (req, res) => {
//     res.render(page);
//   });
// });

// // ERROR HANDLER
// app.use(errorHandler);

// // ====== DATABASE CONNECTIONS ======
// winstonLogger.info("DEBUG MONGO_URI:", { mongoUri: process.env.MONGO_URI });

// connectDB();
// connectPostgres();
// connectRedis();

// let server;

// // ====== GLOBAL ERROR HANDLING ======
// process.on('uncaughtException', (err) => {
//   winstonLogger.error('Uncaught Exception:', err);
//   if (server) {
//     server.close(() => {
//       winstonLogger.info('Server closed due to uncaught exception');
//       mongoose.connection.close(() => {
//         winstonLogger.info('MongoDB connection closed');
//         process.exit(1);
//       });
//     });
//   } else {
//     process.exit(1);
//   }
// });

// process.on('unhandledRejection', (reason, promise) => {
//   winstonLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   if (server) {
//     server.close(() => {
//       winstonLogger.info('Server closed due to unhandled rejection');
//       mongoose.connection.close(() => {
//         winstonLogger.info('MongoDB connection closed');
//         process.exit(1);
//       });
//     });
//   } else {
//     process.exit(1);
//   }
// });

// // ====== START SERVER ======
// server = app.listen(PORT, () => {
//   winstonLogger.info(`Server is running at http://localhost:${PORT}`);
// });
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
const HTTP_PORT = 80;
const HTTPS_PORT = 443;

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
    secure: true, // HTTPS required
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

// APPLY CSRF PROTECTION TO API
app.use('/api/login', csrfProtection, authLimiter);
app.use('/api/register', csrfProtection, registerLimiter);

// CSRF ERROR HANDLER
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
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
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

// HTTPS SERVER
const httpsServer = https.createServer(sslOptions, app);
httpsServer.listen(HTTPS_PORT, () => {
  winstonLogger.info(`HTTPS Server running at https://localhost`);
});

// HTTP → HTTPS REDIRECT
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect(`https://${req.headers.host}${req.url}`);
});
http.createServer(httpApp).listen(HTTP_PORT, () => {
  winstonLogger.info(`HTTP Server redirecting to HTTPS`);
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
