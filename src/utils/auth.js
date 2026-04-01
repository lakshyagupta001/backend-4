import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../configs/env.js';
import AppError from './appError.js';

// Hash a token using SHA-256 (used for storing refresh tokens securely)
// SHA-256 is one-way — you can hash a raw token to compare, but can't reverse it
export const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

export const accessToken = (userId,sessionId) =>
    jwt.sign({ id: userId ,sessionId}, config.ACCESS_SECRET, {
        expiresIn: '15m',
    });

export const refreshToken = (userId) =>
    jwt.sign({ id: userId }, config.REFRESH_SECRET, {
        expiresIn: '7d',
    });

export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, config.ACCESS_SECRET);
    } catch (error) {
        throw new AppError('Invalid or expired access token', 401);
    }
};

export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, config.REFRESH_SECRET);
    } catch (error) {
        throw new AppError('Invalid or expired refresh token', 401);
    }
};
