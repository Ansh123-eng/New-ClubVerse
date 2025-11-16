import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';

dotenv.config();

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

// PostgreSQL connection for reservations and memberships
const sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'clubverse_reservations',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || 'password',
    {
        host: process.env.POSTGRES_HOST || 'localhost',
        dialect: 'postgres',
        logging: false,
    }
);

const connectPostgres = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL Connected for reservations and memberships');

        // Sync models with database
        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized');
    } catch (error) {
        console.error('PostgreSQL connection error:', error);
        console.log('Continuing without PostgreSQL - using in-memory storage for now');
        // Don't exit process, continue with app
    }
};

export default connectDB;
export { sequelize, connectPostgres };
