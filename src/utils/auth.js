import jwt from 'jsonwebtoken';
import config from '../configs/env.js';
import AppError from './appError.js';

export const accessToken = (userId) =>
    jwt.sign({ id: userId }, config.ACCESS_SECRET, {
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
