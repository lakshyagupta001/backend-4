import AppError from '../utils/appError.js';

const errorHandler = (err, req, res, next) => {

    console.error(err.stack);

    if (err instanceof AppError) {
        // Sends controlled error response to client
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    } else {
        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error',
        });
    }
};

export default errorHandler;
