import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;
const sequelize = new Sequelize({
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  dialect: 'postgres',
  logging: false,
});

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

const connectPostgres = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL Connected');
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
  }
};

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:tC7fn193iUgMdldscwbwF4idP5qSMN5R@redis-11306.c283.us-east-1-4.ec2.cloud.redislabs.com:11306',
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis Connected for caching');
  } catch (error) {
    console.error('Redis connection error:', error);
  }
};

const getRedisClient = () => redisClient;

export default connectMongoDB;
export { sequelize, connectPostgres, connectRedis, getRedisClient };
