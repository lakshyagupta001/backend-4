import dotenv from 'dotenv';
import AppError from '../utils/appError.js';

dotenv.config();

if (!process.env.MONGODB_URI) {
    throw new AppError('MONGODB_URI environment variable is not defined.');
}

if (!process.env.ACCESS_SECRET) {
    throw new AppError('ACCESS_SECRET environment variable is not defined.');
}

if (!process.env.REFRESH_SECRET) {
    throw new AppError('REFRESH_SECRET environment variable is not defined.');
}

const config = {
    PORT: process.env.PORT || 8000,
    MONGODB_URI: process.env.MONGODB_URI,
    ACCESS_SECRET: process.env.ACCESS_SECRET,
    REFRESH_SECRET: process.env.REFRESH_SECRET,
};

export default config;
