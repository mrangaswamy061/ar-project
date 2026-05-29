import mongoose from 'mongoose';

let cachedConnection = null;

const connectDB = async () => {
    try {
        if (cachedConnection) {
            console.log('Using cached MongoDB connection');
            return cachedConnection;
        }

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in the environment variables.');
        }

        const conn = await mongoose.connect(uri);
        cachedConnection = conn;

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        throw error;
    }
};

export default connectDB;
