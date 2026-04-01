import { findUserByIdDAO, findSessionByIdDAO } from '../daos/user.dao.js';
import AppError from '../utils/appError.js';
import { verifyAccessToken } from '../utils/auth.js';

const protect = async (req, res, next) => {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('authorization token is required', 401));
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify JWT signature & expiry
    const decoded = verifyAccessToken(token);

    // 3. Check if the session is still active (not revoked)
    // This is what makes logout instant — even if the JWT hasn't expired,
    // a revoked session means the access token is useless
    const session = await findSessionByIdDAO(decoded.sessionId);

    if (!session || session.isRevoked) {
        return next(new AppError('session has been revoked, please login again', 401));
    }

    // 4. Check if user still exists
    const currentUser = await findUserByIdDAO(decoded.id);

    if (!currentUser) {
        return next(new AppError('user belonging to this token no longer exists', 401));
    }

    // 5. Attach user and sessionId to req for downstream use
    req.user = currentUser;
    req.sessionId = decoded.sessionId;
    next();
};

export default protect;
