import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const Reservation = sequelize.define('Reservation', {
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
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  guests: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  specialRequests: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'special_requests'
  },
  club: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clubLocation: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'club_location'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'confirmed'
  }
}, {
  tableName: 'reservations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Reservation;
