import express from 'express';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandling.js';
import userRouter from './routes/user.route.js';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/users', userRouter);

app.use(errorHandler);
export default app;