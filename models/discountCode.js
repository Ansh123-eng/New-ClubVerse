import mongoose from 'mongoose';

const discountCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  membershipType: {
    type: String,
    required: true,
    enum: ['gold', 'platinum', 'diamond']
  },
  description: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  expiresAt: {
    type: Date,
    required: false
  },
  usageLimit: {
    type: Number,
    required: false,
    default: null // null means unlimited
  },
  usageCount: {
    type: Number,
    required: false,
    default: 0
  },
  createdBy: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Index for efficient lookups
discountCodeSchema.index({ code: 1, isActive: 1 });
discountCodeSchema.index({ expiresAt: 1 });

// Pre-save middleware to ensure code is uppercase
discountCodeSchema.pre('save', function(next) {
  this.code = this.code.toUpperCase();
  next();
});

export default mongoose.model('DiscountCode', discountCodeSchema);