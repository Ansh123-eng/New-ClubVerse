import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

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
    process.env.PG_DATABASE || 'clubverse_reservations',
    process.env.PG_USER || 'postgres',
    process.env.PG_PASSWORD || 'password',
    {
        host: process.env.PG_HOST || 'localhost',
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

export default connectDB;
export { sequelize, connectPostgres };
