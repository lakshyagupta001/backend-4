import User from '../models/user.model.js';
import Session from '../models/session.model.js';

// ──── User DAOs ────
export const createUserDAO = async (payload) => User.create(payload);

export const findUserByEmailDAO = async (email) => User.findOne({ email });

export const findUserByIdDAO = async (id) =>
    User.findById(id, { password: 0 });

export const findUserByEmailWithPasswordDAO = async (email) =>
    User.findOne({ email }).select('+password +salt');

export const getAllUsersDAO = async () =>
    User.find({}, { password: 0 }).sort({ createdAt: -1 });

// ──── Session DAOs ────
export const createSessionDAO = async (payload) => Session.create(payload);

// Find a session by its _id (used by auth middleware to check isRevoked)
export const findSessionByIdDAO = async (sessionId) =>
    Session.findById(sessionId);

// Find a session by userId and hashed token regardless of revocation status
// Used for reuse-detection: distinguishes "token never existed" vs "token already used"
export const findSessionByHashDAO = async (userId, hashedToken) =>
    Session.findOne({ userId, refreshToken: hashedToken });

// Find an active (non-revoked) session by userId and hashed token
export const findActiveSessionDAO = async (userId, hashedToken) =>
    Session.findOne({ userId, refreshToken: hashedToken, isRevoked: false });

// Revoke a single session (logout from one device)
export const revokeSessionDAO = async (sessionId) =>
    Session.findByIdAndUpdate(sessionId, { isRevoked: true });

// Revoke ALL sessions for a user (logout from all devices)
export const revokeAllSessionsDAO = async (userId) =>
    Session.updateMany({ userId, isRevoked: false }, { isRevoked: true });
