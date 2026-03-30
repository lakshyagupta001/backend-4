import jwt from 'jsonwebtoken';
import config from '../configs/env.js';

export const signToken = (userId) =>
    jwt.sign({ id: userId }, config.JWT_SECRET || 'dev-secret', {
        expiresIn: '7d',
    });
