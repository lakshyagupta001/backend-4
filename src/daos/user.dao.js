import User from '../models/user.models.js';

export const createUserDAO = async (payload) => User.create(payload);

export const findUserByEmailDAO = async (email) => User.findOne({ email });

export const findUserByIdDAO = async (id) =>
    User.findById(id, { password: 0 });

export const findUserByEmailWithPasswordDAO = async (email) =>
    User.findOne({ email }).select('+password +salt');

export const getAllUsersDAO = async () =>
    User.find({}, { password: 0 }).sort({ createdAt: -1 });

export const saveRefreshTokenDAO = async (userId, token) =>
    User.findByIdAndUpdate(userId, { refreshToken: token });

export const findUserByRefreshTokenDAO = async (token) =>
    User.findOne({ refreshToken: token });

export const clearRefreshTokenDAO = async (userId) =>
    User.findByIdAndUpdate(userId, { refreshToken: null });
