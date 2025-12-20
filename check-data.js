import mongoose from 'mongoose';
import User from './models/user.js';
import Reservation from './models/reservation.js';
import Membership from './models/membership.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  try {
    console.log('🔍 Checking data in MongoDB Atlas...');

    // Connect to MongoDB Atlas
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://anshvohra22_club-verse:Anshvohra2002@cluster0.7am7qih.mongodb.net/?appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');

    // Check Users
    const userCount = await User.countDocuments();
    console.log(`👥 Users in MongoDB Atlas: ${userCount}`);

    if (userCount > 0) {
      const users = await User.find({}, 'name email').limit(5);
      console.log('📋 Sample users:');
      users.forEach(user => console.log(`  - ${user.name} (${user.email})`));
    }

    // Check Reservations
    const reservationCount = await Reservation.countDocuments();
    console.log(`📅 Reservations in MongoDB Atlas: ${reservationCount}`);

    if (reservationCount > 0) {
      const reservations = await Reservation.find({}, 'name email club date').limit(5);
      console.log('📋 Sample reservations:');
      reservations.forEach(res => {
        const dateStr = res.date instanceof Date ? res.date.toDateString() : String(res.date);
        console.log(`  - ${res.name} (${res.email}) - ${res.club} on ${dateStr}`);
      });
    }

    // Check Memberships
    const membershipCount = await Membership.countDocuments();
    console.log(`💎 Memberships in MongoDB Atlas: ${membershipCount}`);

    if (membershipCount > 0) {
      const memberships = await Membership.find({}, 'name email membershipType status').limit(5);
      console.log('📋 Sample memberships:');
      memberships.forEach(mem => console.log(`  - ${mem.name} (${mem.email}) - ${mem.membershipType} (${mem.status})`));
    }

    console.log('\n📊 Summary:');
    console.log(`  Total Users: ${userCount}`);
    console.log(`  Total Reservations: ${reservationCount}`);
    console.log(`  Total Memberships: ${membershipCount}`);

    if (userCount > 0 || reservationCount > 0 || membershipCount > 0) {
      console.log('\n✅ Data is already present in MongoDB Atlas!');
      console.log('ℹ️  If you have additional data in PostgreSQL that needs to be migrated,');
      console.log('   please ensure PostgreSQL is running and accessible.');
    } else {
      console.log('\n📭 No data found in MongoDB Atlas.');
      console.log('ℹ️  If you have data in PostgreSQL, run the migration script after ensuring');
      console.log('   PostgreSQL connection is properly configured.');
    }

  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

checkData();
