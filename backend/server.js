import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import connectDB from './db.js';
import Destination from './models/Destination.js';
import Log from './models/Log.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_USER = process.env.ADMIN_USER || 'sachin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sachin123';

// Middleware
app.use(cors());
app.use(express.json());

// Simple Auth Middleware
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`).toString('base64');
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ==========================================
// API ROUTES
// ==========================================

// POST: Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        const token = Buffer.from(`${username}:${password}`).toString('base64');
        res.json({ status: 'success', token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// GET: Server Health Stats
app.get('/api/health/stats', requireAuth, (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0]; // 1 minute load average

    res.json({
        status: 'success',
        uptime: process.uptime(),
        memory: {
            total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            percent: ((usedMem / totalMem) * 100).toFixed(1) + '%'
        },
        cpuLoad: cpuLoad.toFixed(2)
    });
});

// GET: Backup Data
app.get('/api/backup', requireAuth, async (req, res) => {
    try {
        const destinations = await Destination.find({});
        const logs = await Log.find({});
        
        const backupBundle = {
            timestamp: new Date().toISOString(),
            navigation_config: { destinations },
            analytics: logs
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=campus_ar_backup.json');
        res.send(JSON.stringify(backupBundle, null, 2));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Backup failed' });
    }
});

// GET: Navigation Configuration
app.get('/api/navigation-config', async (req, res) => {
    try {
        const destinations = await Destination.find({}).lean();
        // Send in the old format { destinations: [...] }
        res.json({ destinations: destinations.map(d => {
            const { _id, createdAt, updatedAt, __v, ...rest } = d;
            return rest;
        })});
    } catch (err) {
        console.error("Error reading config:", err);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

// POST: Add or Update Navigation Configuration
app.post('/api/navigation-config', requireAuth, async (req, res) => {
    try {
        const newDest = req.body;
        if (!newDest.id || !newDest.name) return res.status(400).json({ error: 'Missing required fields' });
        
        await Destination.findOneAndUpdate(
            { id: newDest.id },
            newDest,
            { upsert: true, new: true }
        );
        
        res.status(201).json({ status: 'success', dest: newDest });
    } catch (err) {
        console.error("Error updating config:", err);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// DELETE: Remove Navigation Configuration
app.delete('/api/navigation-config/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Destination.deleteOne({ id });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Destination not found' });
        }
        
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error("Error deleting config:", err);
        res.status(500).json({ error: 'Failed to delete configuration' });
    }
});


// POST: Log Telemetry
app.post('/api/telemetry/log', async (req, res) => {
    try {
        const logEntry = new Log({
            ...req.body,
            timestamp: req.body.timestamp || new Date(),
            ip: req.ip || req.connection.remoteAddress
        });
        await logEntry.save();
        
        res.status(201).json({ status: 'success' });
    } catch (err) {
        console.error("Error writing telemetry:", err);
        res.status(500).json({ error: 'Failed to save telemetry' });
    }
});

// GET: Telemetry Stats
app.get('/api/telemetry/stats', requireAuth, async (req, res) => {
    try {
        const logs = await Log.find({});
        
        // Aggregate statistics
        const totalSessions = logs.length;
        const modes = { video: 0, ar: 0 };
        const popularDestinations = {};
        
        logs.forEach(log => {
            if (log.mode) modes[log.mode] = (modes[log.mode] || 0) + 1;
            if (log.destination) popularDestinations[log.destination] = (popularDestinations[log.destination] || 0) + 1;
        });

        // Convert popular destinations to sorted array
        const sortedDestinations = Object.entries(popularDestinations)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const recentLogs = await Log.find({}).sort({ timestamp: -1 }).limit(10);

        res.json({ totalSessions, modes, popularDestinations: sortedDestinations, recentLogs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// ==========================================
// ADMIN DASHBOARD
// ==========================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ==========================================
// START SERVER / EXPORT FOR VERCEL
// ==========================================
await connectDB();

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ Backend Server running on http://localhost:${PORT}`);
        console.log(`➡️ Analytics Dashboard: http://localhost:${PORT}/dashboard`);
    });
}

export default app;
