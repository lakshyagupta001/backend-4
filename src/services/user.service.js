import crypto from 'crypto';
import AppError from '../utils/appError.js';
import { accessToken, refreshToken, verifyRefreshToken } from '../utils/auth.js';
import { toRegisterDTO, toLoginDTO } from '../dtos/user.dto.js';
import {
    validateRegisterInput,
    validateLoginInput,
} from '../validations/user.validation.js';
import {
    createUserDAO,
    findUserByEmailDAO,
    findUserByEmailWithPasswordDAO,
    findUserByIdDAO,
    getAllUsersDAO,
    saveRefreshTokenDAO,
    findUserByRefreshTokenDAO,
    clearRefreshTokenDAO,
} from '../daos/user.dao.js';

export const registerUserService = async (payload) => {
    validateRegisterInput(payload);
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
        salt: salt,
    });

    const newRefreshToken = refreshToken(user._id);
    await saveRefreshTokenDAO(user._id, newRefreshToken);

    return {
        accessToken: accessToken(user._id),
        refreshToken: newRefreshToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    };
};

export const loginUserService = async (payload) => {
    validateLoginInput(payload);
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

    const newRefreshToken = refreshToken(user._id);
    await saveRefreshTokenDAO(user._id, newRefreshToken);

    return {
        accessToken: accessToken(user._id),
        refreshToken: newRefreshToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    };
};

export const refreshTokenService = async (token) => {
    if (!token) {
        throw new AppError('refresh token is required', 401);
    }

    // 1. Verify JWT signature & expiry
    const decoded = verifyRefreshToken(token);

    // 2. Check token exists in DB (prevents use after logout)
    const user = await findUserByRefreshTokenDAO(token);
    if (!user) {
        throw new AppError('refresh token is invalid or has been revoked', 401);
    }

    // 3. Issue a new access token
    const newAccessToken = accessToken(decoded.id);

    return { accessToken: newAccessToken };
};

export const logoutUserService = async (userId) => {
    await clearRefreshTokenDAO(userId);
};

export const getAllUsersService = async () => getAllUsersDAO();

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

