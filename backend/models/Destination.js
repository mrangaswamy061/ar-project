import mongoose from 'mongoose';

const destinationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    video_time: { type: Number },
    ar_rot: { type: String },
    instructions: { type: String }
}, { timestamps: true });

const Destination = mongoose.model('Destination', destinationSchema);

export default Destination;
