import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  guests: { type: String, required: true },
  specialRequests: { type: String },
  club: { type: String, required: true },
  clubLocation: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Reservation', reservationSchema);
