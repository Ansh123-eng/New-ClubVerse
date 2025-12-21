import mongoose from 'mongoose';

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    type: String,
    required: true
  },
  basePrice: {
    type: Number,
    required: true,
    min: 300 // Minimum ₹300 for 1 guest
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.0
  },
  amenities: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Club', clubSchema);
