import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL_ENV || process.env.VERCEL_URL;

// Create logs directory if it doesn't exist and we're not in serverless
if (!isServerless) {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// Only add file transports if not in serverless environment
if (!isServerless) {
  try {
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  } catch (error) {
    // In case file system operations fail in serverless environments
    console.warn('File logging disabled due to file system restrictions:', error.message);
  }
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'club-verse' },
  transports
});

const requestLogger = (req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
};

export default requestLogger;
export { logger };
