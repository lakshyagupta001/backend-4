import mongoose from "mongoose";
import config from "./env.js";

//using try and catch with async await
const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGODB_URI);
        console.log("MongoDB connected successfully 🚀");
    } catch (error) {
        throw new Error("MongoDB connection error:", error);//why is this error not caught by the error handling middleware?
        //because the error is thrown before the error handling middleware is called
        //and the error handling middleware is only called when there is an error in the request-response cycle i.e in controller
        //section and not in the config section 
        process.exit(1);
    }
};



export default connectDB;
