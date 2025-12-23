import mongoose from 'mongoose';

const ticketBookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  eventId: { type: String, required: true },
  tickets: { type: Number, required: true },
  membershipType: { type: String, default: 'none' },
  discountCode: { type: String, default: null },
  totalAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const TicketBooking = mongoose.model('TicketBooking', ticketBookingSchema);
export default TicketBooking;
