import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://anshvohra22_club-verse:Anshvohra2002@cluster0.7am7qih.mongodb.net/club-verse?appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('MongoDB Atlas Connected to database: club-verse');
  } catch (error) {
    console.error('MongoDB Atlas connection error:', error);
  }
};

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:8mINCf66aVgm0TrKAWwYOPHHBk4sHDWH@redis-16018.c266.us-east-1-3.ec2.cloud.redislabs.com:16018',
    });

    redisClient.on('error', (err) => {
      // Suppress Redis errors to avoid log spam if Redis is not available
      // console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis Connected for caching');
  } catch (error) {
    // Redis connection failed, set to null and continue without caching
    redisClient = null;
    console.warn('Redis not available, caching disabled');
  }
};

const getRedisClient = () => redisClient;

export default connectMongoDB;
export { connectRedis, getRedisClient };
