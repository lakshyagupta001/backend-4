import express from 'express';
import protect from '../middleware/auth.middleware.js';
import validate from '../middleware/validation.middleware.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import {
    registerUser,
    loginUser,
    getAllUsers,
    getUserProfile,
    refreshAccessToken,
    logoutUser,
    logoutAll,
} from '../controllers/user.controller.js';
import {
    registerSchema,
    loginSchema,
} from '../validations/user.validation.js';

const router = express.Router();

router.post('/register', validate(registerSchema), asyncWrapper(registerUser));
router.post('/login', validate(loginSchema), asyncWrapper(loginUser));
router.post('/refresh', asyncWrapper(refreshAccessToken));
router.post('/logout', protect, asyncWrapper(logoutUser));
router.post('/logout-all', protect, asyncWrapper(logoutAll));
router.get('/', protect, asyncWrapper(getAllUsers));
router.get('/profile', protect, asyncWrapper(getUserProfile));

export default router;
