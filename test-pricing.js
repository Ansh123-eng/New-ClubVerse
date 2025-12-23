import { calculateReservationAmount, getUserMembershipType } from './utils/pricing.js';
import connectDB from './db.js';
import Membership from './models/membership.js';

const testPricing = async () => {
  await connectDB();

  console.log('Testing pricing calculation...');

  // Test pricing for different membership types
  const testCases = [
    { guests: 2, membership: 'none', expected: 50 },
    { guests: 2, membership: 'gold', expected: 45 },
    { guests: 2, membership: 'platinum', expected: 42.5 },
    { guests: 2, membership: 'diamond', expected: 40 },
    { guests: 4, membership: 'none', expected: 100 },
    { guests: 4, membership: 'gold', expected: 90 }
  ];

  testCases.forEach(test => {
    const result = calculateReservationAmount(test.guests, test.membership);
    console.log(`Guests: ${test.guests}, Membership: ${test.membership}, Amount: ₹${result}, Expected: ₹${test.expected}`);
  });

  // Test membership lookup
  console.log('\nTesting membership lookup...');
  const membershipType = await getUserMembershipType('test@example.com');
  console.log(`Membership type for test@example.com: ${membershipType}`);

  // Create a test membership if none exists
  const existingMembership = await Membership.findOne({ email: 'test@example.com' });
  if (!existingMembership) {
    console.log('Creating test membership...');
    const membership = new Membership({
      userId: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
      membershipType: 'gold',
      membershipPeriod: 'monthly',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      totalAmount: 150,
      paymentStatus: 'completed'
    });
    await membership.save();
    console.log('Test membership created');
  }

  // Test again after creating membership
  const newMembershipType = await getUserMembershipType('test@example.com');
  console.log(`Membership type after creation: ${newMembershipType}`);

  process.exit();
};

testPricing().catch(console.error);
