import {
	registerUserService,
	loginUserService,
	getAllUsersService,
	getUserProfileService,
	refreshTokenService,
	logoutUserService,
} from '../services/user.service.js';

// Cookie options — httpOnly so JS cannot access the token
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
	sameSite: 'strict',
	maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export const registerUser = async (req, res) => {
	const data = await registerUserService(req.body);
	res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);

	res.status(201).json({
		status: 'success',
		message: 'user registered',
		data: {
			accessToken: data.accessToken,
			user: data.user,
		},
	});
};

export const loginUser = async (req, res) => {
	const data = await loginUserService(req.body);
	res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);

	res.status(200).json({
		status: 'success',
		message: 'login successful',
		data: {
			accessToken: data.accessToken,
			user: data.user,
		},
	});
};

export const refreshAccessToken = async (req, res) => {
	// Token comes from the httpOnly cookie
	const token = req.cookies.refreshToken;
	const data = await refreshTokenService(token);

	res.status(200).json({
		status: 'success',
		data,
	});
};

export const logoutUser = async (req, res) => {
	await logoutUserService(req.user._id);
	res.clearCookie('refreshToken', COOKIE_OPTIONS);

	res.status(200).json({
		status: 'success',
		message: 'logged out successfully',
	});
};

export const getAllUsers = async (req, res) => {
	const users = await getAllUsersService();

	res.status(200).json({
		status: 'success',
		results: users.length,
		data: {
			users,
		},
	});
};

export const getUserProfile = async (req, res) => {
	const user = await getUserProfileService(req.user._id);

	res.status(200).json({
		status: 'success',
		data: {
			user,
		},
	});
};

