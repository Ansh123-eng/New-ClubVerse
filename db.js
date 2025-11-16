import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        console.log('DEBUG MONGO_URI:', process.env.MONGO_URI);

        if (!process.env.MONGO_URI) {
            console.log('MONGO_URI not set, skipping MongoDB connection');
            return;
        }

        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'clubverse',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || 'anshvohra@2002',
    {
        host: process.env.POSTGRES_HOST || 'localhost',
        dialect: 'postgres',
        logging: false
    }
);

const connectPostgres = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL Connected for reservations and memberships');

        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized');
    } catch (error) {
        console.error('PostgreSQL connection error:', error);
        console.log('Continuing without PostgreSQL - using in-memory storage for now');
    }
};

// Redis client for caching
let redisClient = null;

const connectRedis = async () => {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://redis-10894.c8.us-east-1-4.ec2.cloud.redislabs.com:10894',
            password: process.env.REDIS_PASSWORD
        });

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        await redisClient.connect();
        console.log('Redis Connected for caching');
    } catch (error) {
        console.error('Redis connection error:', error);
        console.log('Continuing without Redis - caching disabled');
    }
};

const getRedisClient = () => redisClient;

export default connectDB;
export { sequelize, connectPostgres, connectRedis, getRedisClient };
