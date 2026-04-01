import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // fast lookup by userId
        },
        refreshToken: {
            type: String,
            required: true,
        },
        userAgent: {
            type: String,
            default: 'unknown',
        },
        ipAddress: {
            type: String,
            default: 'unknown',
        },
        isRevoked: {
            type: Boolean,
            default: false,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }, // TTL index — MongoDB auto-deletes expired sessions
        },
    },
    { timestamps: true }
);

export default mongoose.model("Session", sessionSchema);