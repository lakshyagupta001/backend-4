import { ZodError } from 'zod';
import AppError from '../utils/appError.js';

/**
 * Generic validation middleware.
 * Validates req.body, req.query, and req.params against a Zod schema.
 * On failure, forwards a structured 400 AppError to the global error handler.
 *
 * Note: req.query and req.params are read-only getters in Express,
 * so we only write back parsed body data. Query and params are
 * still validated but not reassigned.
 */
const validate = (schema) => async (req, res, next) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Only req.body is writable — req.query & req.params are read-only getters in Express
        if (parsed.body) req.body = parsed.body;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const message = error.issues
                .map((e) => `${e.path.slice(1).join('.')}: ${e.message}`)
                .join(', ');

            return next(new AppError(message, 400));
        }

        next(error);
    }
};

export default validate;

// /**
//  * Generic validation middleware.
//  * Pass a Zod schema — it validates req.body before the controller runs.
//  * On failure, a 400 AppError is forwarded to the global error handler.
//  */
// const validate = (schema) => (req, res, next) => {
//     const result = schema.safeParse(req.body);

//     if (!result.success) {
//         // Collect the first error message from Zod's error list
//         const message =
//             result.error.errors[0]?.message ?? 'invalid request body';

//         return next(new AppError(message, 400));
//     }

//     // Replace req.body with the parsed (and possibly coerced) data
//     req.body = result.data;

//     next();
// };

// export default validate;