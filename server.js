import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import dotenv from 'dotenv';
import debugModule from 'debug';
import axios from 'axios';

const debug = debugModule('clubverse:server');
debug('Starting server...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 8080;

app.get('/api/weather', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    const cacheKey = 'weather_data';

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.error('OPENWEATHER_API_KEY is not set in environment');
      return res.status(500).send('Weather API key is not configured');
    }

    // Check cache first
    if (redisClient) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('Serving weather data from cache');
        const weatherData = JSON.parse(cachedData);
        return res.render('weather', weatherData);
      }
    }

    const ldhRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Ludhiana,in&appid=${apiKey}&units=metric`
    );

    const chdRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Chandigarh,in&appid=${apiKey}&units=metric`
    );
    const ldhWeather = ldhRes.data;
    const chdWeather = chdRes.data;

    const weatherData = {
      ldh: {
        city: ldhWeather.name,
        temp: ldhWeather.main.temp,
        condition: ldhWeather.weather[0].description,
        icon: ldhWeather.weather[0].icon
      },
      chd: {
        city: chdWeather.name,
        temp: chdWeather.main.temp,
        condition: chdWeather.weather[0].description,
        icon: chdWeather.weather[0].icon
      }
    };

    // Cache the data for 10 minutes
    if (redisClient) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(weatherData));
      console.log('Weather data cached in Redis');
    }

    res.render('weather', weatherData);
  } catch (error) {
    console.error('Error fetching weather (api):', error && error.stack ? error.stack : error);
    res.status(500).send('Failed to fetch weather data');
  }
});

app.get('/test-debug', (req, res) => {
  debug('Someone opened /test-debug route');
  res.send('Debugging works!');
});

import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import logger, { logger as winstonLogger } from './middlewares/logger.js';
import errorHandler from './middlewares/errorHandler.js';
import { protect } from './middlewares/auth.js';
import connectDB, { connectPostgres, connectRedis, getRedisClient } from './db.js';
import mongoose from 'mongoose';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'", "*"],
    "img-src": ["'self'", "https:", "data:"],
    "script-src": ["'self'", "*", "'unsafe-inline'"],
    "script-src-attr": ["'self'", "*", "'unsafe-inline'"]
  }
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  headers: true
});
app.use('/api', limiter);


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




app.use(logger);

app.use((req, res, next) => {
  winstonLogger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

import apiRoutes from './api/apiRoutes.js';
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  const { error, success } = req.query;
  res.render('login', { error, success });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.get('/api/dashboard', protect, (req, res) => {
  const instaImages = [
    'food.jpg', 'drink.jpg', 'pizza.jpg', 'beerr.avif',
    'hand.png', 'taco.png',
    'drum.png', 'wine.png'
  ];
  res.render('dashboard', {
    instaImages,
    user: req.user
  });
});

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

app.get('/api/bar', protect, (req, res) => {
  res.render('baars', {
    chdBars,
    ldhBars,
    user: req.user
  });
});

app.get('/api/reserve-table', protect, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reservation.html'));
});

app.get('/api/team', protect, (req, res) => {
  const team = [
    { name: "Ansh Vohra", role: "Back-End Web Developer", image: "/images/ansh.jpg" },
    { name: "Akhil Handa", role: "Back-End Web Developer", image: "/images/akhil.jpg" },
    { name: "Anmol Singh", role: "Back-End Web Developer", image: "/images/anmol11.jpg" }
  ];
  res.render('team', { team, user: req.user });
});



app.get('/weather', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    const cacheKey = 'weather_data_page';

    // Check cache first
    if (redisClient) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('Serving weather page from cache');
        const weatherData = JSON.parse(cachedData);
        return res.render('weather', weatherData);
      }
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;

    const ldhRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Ludhiana,in&appid=${apiKey}&units=metric`
    );

    const chdRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Chandigarh,in&appid=${apiKey}&units=metric`
    );
    const ldhWeather = ldhRes.data;
    const chdWeather = chdRes.data;

    const weatherData = {
      ldh: {
        city: ldhWeather.name,
        temp: ldhWeather.main.temp,
        condition: ldhWeather.weather[0].description,
        icon: ldhWeather.weather[0].icon
      },
      chd: {
        city: chdWeather.name,
        temp: chdWeather.main.temp,
        condition: chdWeather.weather[0].description,
        icon: chdWeather.weather[0].icon
      }
    };

    // Cache the data for 10 minutes
    if (redisClient) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(weatherData));
      console.log('Weather page data cached in Redis');
    }

    res.render('weather', weatherData);
  } catch (error) {
    console.error('Error fetching weather:', error);
    res.status(500).send('Failed to fetch weather. Try again later.');
  }
});



const barPages = ['brewestate', 'boulevard', 'kalaghoda', 'mobe', 'paara', 'romeo-ldh', 'luna-ldh', 'baklavi-ldh'];
barPages.forEach(page => {
  app.get(`/api/${page}`, protect, (req, res) => {
    res.render(page, { user: req.user });
  });
});

const staticPages = ['faq', 'ourservices', 'contactus'];
staticPages.forEach(page => {
  app.get(`/api/${page}`, (req, res) => {
    res.render(page);
  });
});

app.use(errorHandler);

winstonLogger.info("DEBUG MONGO_URI:", { mongoUri: process.env.MONGO_URI });

connectDB();
connectPostgres();
connectRedis();

let server;

process.on('uncaughtException', (err) => {
  winstonLogger.error('Uncaught Exception:', err);
  if (server) {
    server.close(() => {
      winstonLogger.info('Server closed due to uncaught exception');
      mongoose.connection.close(() => {
        winstonLogger.info('MongoDB connection closed');
        process.exit(1);
      });
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  winstonLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (server) {
    server.close(() => {
      winstonLogger.info('Server closed due to unhandled rejection');
      mongoose.connection.close(() => {
        winstonLogger.info('MongoDB connection closed');
        process.exit(1);
      });
    });
  } else {
    process.exit(1);
  }
});

server = app.listen(PORT, () => {
  winstonLogger.info(`Server is running at http://localhost:${PORT}`);
});
