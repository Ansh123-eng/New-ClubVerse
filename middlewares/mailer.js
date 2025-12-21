import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Additional settings for Vercel/serverless environments
  tls: {
    rejectUnauthorized: false
  },
  // Connection timeout settings
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000, // 30 seconds
  socketTimeout: 60000 // 60 seconds
});

export default transporter;
