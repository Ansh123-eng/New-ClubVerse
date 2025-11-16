import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const Membership = sequelize.define('Membership', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: () => uuidv4(),
    field: 'user_id'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  membershipType: {
    type: DataTypes.ENUM('gold', 'platinum', 'diamond'),
    allowNull: false,
    field: 'membership_type'
  },
  membershipPeriod: {
    type: DataTypes.ENUM('weekly', 'monthly', 'annually'),
    allowNull: false,
    field: 'membership_period'
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'start_date'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_date'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_amount'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'payment_status'
  }
}, {
  tableName: 'memberships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Calculate end date and pricing based on type and period
Membership.beforeCreate(async (membership) => {
  const startDate = new Date(membership.startDate);
  let endDate;

  switch (membership.membershipPeriod) {
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

  membership.endDate = endDate;

  const basePrices = {
    gold: { weekly: 50, monthly: 150, annually: 1500 },
    platinum: { weekly: 80, monthly: 250, annually: 2500 },
    diamond: { weekly: 120, monthly: 400, annually: 4000 }
  };

  membership.totalAmount = basePrices[membership.membershipType][membership.membershipPeriod];
});

export default Membership;
