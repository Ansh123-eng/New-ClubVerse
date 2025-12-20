import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const reservationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: () => uuidv4()
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  guests: {
    type: String,
    required: true,
  },
  specialRequests: {
    type: String,
    required: false
  },
  club: {
    type: String,
    required: true,
  },
  clubLocation: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: false,
    default: 'confirmed'
  }
}, {
  timestamps: true
});

export default mongoose.model('Reservation', reservationSchema);
