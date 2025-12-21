import Membership from '../models/membership.js';
import DiscountCode from '../models/discountCode.js';

/**
 * Validate discount code and get membership details
 * @param {string} discountCode - The discount code to validate
 * @returns {object|null} Membership details or null if invalid
 */
export async function validateDiscountCode(discountCode) {
  try {
    const discount = await DiscountCode.findOne({
      code: discountCode.toUpperCase(),
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ]
    });

    if (!discount) {
      return null;
    }

    // Check usage limit if set
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return null;
    }

    // Increment usage count
    await DiscountCode.updateOne(
      { _id: discount._id },
      { $inc: { usageCount: 1 } }
    );

    return {
      membershipType: discount.membershipType,
      code: discount.code,
      description: discount.description,
      expiresAt: discount.expiresAt
    };
  } catch (error) {
    console.error('Error validating discount code:', error);
    return null;
  }
}

/**
 * Calculate reservation amount based on guests and membership type
 * @param {number} guests - Number of guests
 * @param {string} membershipType - Type of membership (none, gold, platinum, diamond)
 * @returns {number} Total amount
 */
export function calculateReservationAmount(guests, membershipType, basePrice = 350) {
  const guestCount = parseInt(guests);
  const membershipDiscounts = {
    none: 0,
    gold: 0.10,     // 10% discount
    platinum: 0.15, // 15% discount
    diamond: 0.25   // 25% discount
  };

  const baseAmount = guestCount * basePrice;
  const discount = membershipDiscounts[membershipType] || 0;
  const discountAmount = Math.round(baseAmount * discount);
  const totalAmount = baseAmount - discountAmount;

  return totalAmount;
}

/**
 * Get user membership type by email
 * @param {string} email - User email
 * @returns {string} Membership type (none, gold, platinum, diamond)
 */
export async function getUserMembershipType(email) {
  try {
    const membership = await Membership.findOne({
      email,
      status: 'active',
      endDate: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    return membership ? membership.membershipType : 'none';
  } catch (error) {
    console.error('Error fetching membership:', error);
    return 'none';
  }
}

/**
 * Get club base price by club ID
 * @param {string} clubId - Club ID
 * @returns {number} Base price for the club
 */
export function getClubBasePrice(clubId) {
  // Updated pricing for 6 clubs: 500, 550, 600, 650, 700, 750 per guest
  const clubPrices = {
    'club1': 500,  // Club A
    'club2': 550,  // Club B
    'club3': 600,  // Club C
    'club4': 650,  // Club D
    'club5': 700,  // Club E
    'club6': 750   // Club F
  };

  return clubPrices[clubId] || 500; // Default to ₹500 if club not found
}

/**
 * Get user membership type by email (alias for backward compatibility)
 * @param {string} email - User email
 * @returns {string} Membership type (none, gold, platinum, diamond)
 */
export async function getUserMembership(email) {
  return getUserMembershipType(email);
}

/**
 * Calculate dynamic pricing based on club, guests, and membership
 * @param {number} guests - Number of guests
 * @param {string} membershipType - Membership type (none, gold, platinum, diamond)
 * @param {number} basePrice - Base price per guest for the club
 * @returns {object} Pricing breakdown
 */
export function calculatePricing(guests, membershipType, basePrice) {
  const guestCount = parseInt(guests);

  // Updated membership discount rules:
  // Gold: 5% discount
  // Platinum: 15% discount
  // Diamond: 25% discount
  const membershipDiscounts = {
    none: 0,
    gold: 0.05,        // 5% discount
    platinum: 0.15,    // 15% discount
    diamond: 0.25      // 25% discount
  };

  // Calculate base amount
  const baseAmount = basePrice * guestCount;

  // Apply membership discount
  const discountRate = membershipDiscounts[membershipType] || 0;
  const discountAmount = Math.round(baseAmount * discountRate);

  // Calculate final total (no group discount as per new requirements)
  const totalAmount = baseAmount - discountAmount;

  return {
    baseAmount,
    discountAmount,
    totalAmount,
    discountPercentage: discountRate * 100,
    breakdown: {
      perGuest: basePrice,
      subtotal: baseAmount,
      membershipSavings: discountAmount,
      finalTotal: totalAmount
    }
  };
}
