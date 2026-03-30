import dotenv from 'dotenv';
import AppError from '../utils/appError.js';
dotenv.config();
if (!process.env.PORT) {
    throw new AppError("PORT environment variable is not defined.");
}
if (!process.env.MONGODB_URI) {
    throw new AppError("MONGODB_URI environment variable is not defined.");
}
const config = {
    PORT: process.env.PORT || 8000,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
};

export default config;
