import { findUserByIdDAO } from '../daos/user.dao.js';
import AppError from '../utils/appError.js';
import { verifyAccessToken } from '../utils/auth.js';

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('authorization token is required', 401));
    }

    const token = authHeader.split(' ')[1];

    let decoded;

    decoded = verifyAccessToken(token);

    const currentUser = await findUserByIdDAO(decoded.id);

    if (!currentUser) {
        return next(new AppError('user belonging to this token no longer exists', 401));
    }

    req.user = currentUser;
    next();
};

export default protect;
