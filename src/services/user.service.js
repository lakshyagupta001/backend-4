import bcrypt from 'bcryptjs';
import AppError from '../utils/appError.js';
import { signToken } from '../utils/auth.js';
import { toRegisterDTO, toLoginDTO } from '../dtos/user.dto.js';
import {
    validateRegisterInput,
    validateLoginInput,
} from '../validations/user.validation.js';
import {
    createUserDAO,
    findUserByEmailDAO,
    findUserByEmailWithPasswordDAO,
    getAllUsersDAO,
} from '../daos/user.dao.js';

export const registerUserService = async (payload) => {
    validateRegisterInput(payload);
    const dto = toRegisterDTO(payload);
    const existingUser = await findUserByEmailDAO(dto.email);

    if (existingUser) {
        throw new AppError('email already registered', 409);//If you only write new AppError(...):
        //It just creates an error object.
        //Execution continues normally.
        //Your asyncWrapper and error middleware will not be triggered.
        
        // Service throws error.
        // Promise rejects.
        // asyncWrapper catches and calls next(error).
        // Global error middleware sends proper response.

    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await createUserDAO({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
    });

    return {
        token: signToken(user._id),
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
        throw new AppError('invalid email or password', 401);
    }

    return {
        token: signToken(user._id),
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },
    };
};

export const getAllUsersService = async () => getAllUsersDAO();
