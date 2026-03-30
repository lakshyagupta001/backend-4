import mongoose from "mongoose";
import config from "./env.js";
import AppError from "../utils/appError.js";

//using try and catch with async await
const connectDB = async () => {
    try {//one can also not write try block and just write await mongoose.connect(config.MONGODB_URI) and it will work,
        //if there is an error in connecting to the database, it will go to the catch block and log the error message.

        await mongoose.connect(config.MONGODB_URI);
        console.log("MongoDB connected successfully 🚀");
    } catch (error) {
        throw new AppError("MongoDB connection error:", error);
        process.exit(1);
    }
};


//using then and catch with promises
// const connectDB = () => {
//     mongoose.connect(config.MONGODB_URI)
//         .then(() => console.log("MongoDB connected successfully 🚀")
//         .catch((error) => {
//             console.error("MongoDB connection error:", error);
//             process.exit(1);
//         });
// };
//if i use then catch then we dont need to put connectDB inside an async function in server.js file,
//  we can just call connectDB() and it will work. but if we use async await then we need to put 
// connectDB inside an async function in server.js file and call that function.
export default connectDB;
