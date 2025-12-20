import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  membershipType: {
    type: String,
    enum: ['gold', 'platinum', 'diamond'],
    required: true
  },
  membershipPeriod: {
    type: String,
    enum: ['weekly', 'monthly', 'annually'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate end date and pricing
membershipSchema.pre('save', function(next) {
  const startDate = new Date(this.startDate);
  let endDate;

  switch (this.membershipPeriod) {
    case 'weekly':
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      break;
    case 'monthly':
      endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + 1);
      break;
    case 'annually':
      endDate = new Date(startDate);
      endDate.setFullYear(startDate.getFullYear() + 1);
      break;
    default:
      endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + 1);
  }

  this.endDate = endDate;

  const basePrices = {
    gold: { weekly: 50, monthly: 150, annually: 1500 },
    platinum: { weekly: 80, monthly: 250, annually: 2500 },
    diamond: { weekly: 120, monthly: 400, annually: 4000 }
  };

  this.totalAmount = basePrices[this.membershipType][this.membershipPeriod];
  next();
});

const Membership = mongoose.model('Membership', membershipSchema);

export default Membership;
