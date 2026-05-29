import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './db.js';
import Destination from './models/Destination.js';
import Log from './models/Log.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrateData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();

        const CONFIG_PATH = path.join(__dirname, '../database/navigation_config.json');
        const ANALYTICS_PATH = path.join(__dirname, '../database/analytics.json');

        console.log('Reading local JSON files...');
        let configData, analyticsData;
        try {
            const rawConfig = await fs.readFile(CONFIG_PATH, 'utf-8');
            configData = JSON.parse(rawConfig).destinations;
        } catch (e) {
            console.log('No navigation config found or error reading it.');
            configData = [];
        }

        try {
            const rawAnalytics = await fs.readFile(ANALYTICS_PATH, 'utf-8');
            analyticsData = JSON.parse(rawAnalytics);
        } catch (e) {
            console.log('No analytics found or error reading it.');
            analyticsData = [];
        }

        console.log(`Found ${configData.length} destinations and ${analyticsData.length} logs.`);

        if (configData.length > 0) {
            console.log('Migrating destinations...');
            for (const dest of configData) {
                await Destination.findOneAndUpdate(
                    { id: dest.id },
                    dest,
                    { upsert: true, new: true }
                );
            }
        }

        if (analyticsData.length > 0) {
            console.log('Migrating logs...');
            for (const log of analyticsData) {
                const logEntry = new Log({
                    ...log,
                    timestamp: new Date(log.timestamp)
                });
                await logEntry.save();
            }
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrateData();
