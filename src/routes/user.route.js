import express from 'express';
import protect from '../middleware/authMiddleware.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import {
    registerUser,
    loginUser,
    getAllUsers,
    getUserProfile,
    refreshAccessToken,
    logoutUser,
} from '../controllers/user.controller.js';

const router = express.Router();

router.post('/register', asyncWrapper(registerUser));
router.post('/login', asyncWrapper(loginUser));
router.post('/refresh', asyncWrapper(refreshAccessToken));      // public — uses RT cookie
router.post('/logout', protect, asyncWrapper(logoutUser));      // protected — needs access token
router.get('/', protect, asyncWrapper(getAllUsers));
router.get('/profile', protect, asyncWrapper(getUserProfile));

export default router;
