import {
	registerUserService,
	loginUserService,
	getAllUsersService,
	getUserProfileService,
	refreshTokenService,
	logoutUserService,
	logoutAllService,
} from '../services/user.service.js';

// Cookie options — httpOnly so JS cannot access the token
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict',
	maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const registerUser = async (req, res) => {
	const reqMeta = { userAgent: req.get('user-agent'), ipAddress: req.ip };
	const data = await registerUserService(req.body, reqMeta);
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
	const reqMeta = { userAgent: req.get('user-agent'), ipAddress: req.ip };
	const data = await loginUserService(req.body, reqMeta);
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
	const rawToken = req.cookies.refreshToken;
	const reqMeta = { userAgent: req.get('user-agent'), ipAddress: req.ip };
	const data = await refreshTokenService(rawToken, reqMeta);
	res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);

	res.status(200).json({
		status: 'success',
		data: {
			accessToken: data.accessToken,
		},
	});
};

export const logoutUser = async (req, res) => {
	// req.sessionId is set by the auth middleware (decoded from JWT)
	await logoutUserService(req.sessionId);
	res.clearCookie('refreshToken', COOKIE_OPTIONS);

	res.status(200).json({
		status: 'success',
		message: 'logged out successfully',
	});
};

export const logoutAll = async (req, res) => {
	await logoutAllService(req.user._id);
	res.clearCookie('refreshToken', COOKIE_OPTIONS);

	res.status(200).json({
		status: 'success',
		message: 'logged out from all devices',
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
