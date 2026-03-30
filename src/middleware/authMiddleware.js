import jwt from 'jsonwebtoken';
import config from '../configs/env.js';
import { findUserByIdDAO } from '../daos/user.dao.js';
import AppError from '../utils/appError.js';

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('authorization token is required', 401));
    }

    const token = authHeader.split(' ')[1];

    let decoded;

    try {
        decoded = jwt.verify(token, config.JWT_SECRET || 'dev-secret');
    } catch (error) {
        return next(new AppError('invalid or expired token', 401));
    }

    const currentUser = await findUserByIdDAO(decoded.id);

    if (!currentUser) {
        return next(new AppError('user belonging to this token no longer exists', 401));
    }

    // Make the authenticated user available to later middleware/controllers.
    req.user = currentUser;
    next();
};

export default protect;
