import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    destination: { type: String },
    mode: { type: String },
    device: { type: String },
    timestamp: { type: Date, default: Date.now },
    ip: { type: String }
});

const Log = mongoose.model('Log', logSchema);

export default Log;
