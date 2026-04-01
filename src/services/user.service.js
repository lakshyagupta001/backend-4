import crypto from 'crypto';
import AppError from '../utils/appError.js';
import { accessToken, refreshToken, verifyRefreshToken, hashToken } from '../utils/auth.js';
import { toRegisterDTO, toLoginDTO } from '../dtos/user.dto.js';

import {
    createUserDAO,
    findUserByEmailDAO,
    findUserByEmailWithPasswordDAO,
    findUserByIdDAO,
    getAllUsersDAO,
    createSessionDAO,
    findActiveSessionDAO,
    revokeSessionDAO,
    revokeAllSessionsDAO,
} from '../daos/user.dao.js';

// ──── Helper: create a session and return tokens ────
// Used by both register and login to avoid code duplication
const createSessionAndTokens = async (userId, reqMeta) => {
    const rawRefreshToken = refreshToken(userId);
    const hashedRefreshToken = hashToken(rawRefreshToken);

    const session = await createSessionDAO({
        userId,
        refreshToken: hashedRefreshToken,
        userAgent: reqMeta.userAgent || 'unknown',
        ipAddress: reqMeta.ipAddress || 'unknown',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const newAccessToken = accessToken(userId, session._id);

    return {
        accessToken: newAccessToken,
        refreshToken: rawRefreshToken, // raw token goes to the client (cookie)
    };
};

// ──── Register ────
export const registerUserService = async (payload, reqMeta) => {
    const dto = toRegisterDTO(payload);
    const existingUser = await findUserByEmailDAO(dto.email);

    if (existingUser) {
        throw new AppError('email already registered', 409);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto
        .pbkdf2Sync(dto.password, salt, 1000, 64, 'sha512')
        .toString('hex');

    const user = await createUserDAO({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        salt,
    });

    const tokens = await createSessionAndTokens(user._id, reqMeta);

    return {
        ...tokens,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    };
};

// ──── Login ────
export const loginUserService = async (payload, reqMeta) => {
    const dto = toLoginDTO(payload);
    const user = await findUserByEmailWithPasswordDAO(dto.email);

    if (!user) {
        throw new AppError('invalid email or password', 401);
    }

    const isPasswordValid =
        crypto
            .pbkdf2Sync(dto.password, user.salt, 1000, 64, 'sha512')
            .toString('hex') === user.password;

    if (!isPasswordValid) {
        throw new AppError('invalid email or password', 401);
    }

    const tokens = await createSessionAndTokens(user._id, reqMeta);

    return {
        ...tokens,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    };
};

// ──── Refresh Token (with rotation) ────
export const refreshTokenService = async (rawToken, reqMeta) => {
    if (!rawToken) {
        throw new AppError('refresh token is required', 401);
    }

    // 1. Verify JWT signature & expiry
    const decoded = verifyRefreshToken(rawToken);

    // 2. Hash the incoming token and find matching active session
    const hashedToken = hashToken(rawToken);
    const session = await findActiveSessionDAO(decoded.id, hashedToken);

    if (!session) {
        throw new AppError('refresh token is invalid or has been revoked', 401);
    }

    // 3. Revoke the old session (one-time use)
    await revokeSessionDAO(session._id);

    // 4. Create a brand new session (token rotation)
    const tokens = await createSessionAndTokens(decoded.id, reqMeta);

    return tokens;
};

// ──── Logout (single device) ────
export const logoutUserService = async (sessionId) => {
    await revokeSessionDAO(sessionId);
};

// ──── Logout All Devices ────
export const logoutAllService = async (userId) => {
    await revokeAllSessionsDAO(userId);
};

// ──── Get All Users ────
export const getAllUsersService = async () => getAllUsersDAO();

// ──── Get User Profile ────
export const getUserProfileService = async (userId) => {
    const user = await findUserByIdDAO(userId);
    if (!user) {
        throw new AppError('user not found', 404);
    }
    return {
        id: user._id,
        name: user.name,
        email: user.email,
    };
};
