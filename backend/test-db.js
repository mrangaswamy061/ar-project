import dotenv from 'dotenv';
import connectDB from './db.js';
import Destination from './models/Destination.js';

dotenv.config();

const run = async () => {
    await connectDB();
    const dests = await Destination.find({}).lean();
    console.log("Destinations in DB:", dests);
    process.exit(0);
};

run();
