import AppError from '../utils/appError.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegisterInput = (payload) => {
    if (!payload || typeof payload !== 'object') {
        throw new AppError('request body is required', 400);
    }

    const { name, email, password } = payload;

    if (!name || !email || !password) {
        throw new AppError('name, email and password are required', 400);
    }

    if (typeof email !== 'string' || !emailRegex.test(email.trim().toLowerCase())) {
        throw new AppError('invalid email format', 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
        throw new AppError('password must be at least 6 characters', 400);
    }
};

export const validateLoginInput = (payload) => {
    if (!payload || typeof payload !== 'object') {
        throw new AppError('request body is required', 400);
    }

    const { email, password } = payload;

    if (!email || !password) {
        throw new AppError('email and password are required', 400);
    }

    if (typeof email !== 'string' || !emailRegex.test(email.trim().toLowerCase())) {
        throw new AppError('invalid email format', 400);
    }
};
