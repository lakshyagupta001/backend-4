import mongoose from "mongoose";
import config from "./env.js";
import AppError from "../utils/appError.js";

//using try and catch with async await
const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGODB_URI);
        console.log("MongoDB connected successfully 🚀");
    } catch (error) {
        throw new AppError("MongoDB connection error:", error);
        process.exit(1);
    }
};



export default connectDB;
