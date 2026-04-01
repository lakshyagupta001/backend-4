import { z } from 'zod';

const emailSchema = z
    .string({ required_error: 'email is required' })
    .email('invalid email format')
    .trim()
    .toLowerCase();

const passwordSchema = z
    .string({ required_error: 'password is required' })
    .min(6, 'password must be at least 6 characters');

export const registerSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: 'name is required' })
            .trim()
            .min(1, 'name cannot be empty'),
        email: emailSchema,
        password: passwordSchema,
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: emailSchema,
        password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
    }),
});
