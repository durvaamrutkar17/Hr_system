const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/database');
const Holiday = require('../models/Holiday');

const holidays = [
  { name: 'Republic Day', date: '2018-01-26', type: 'National', description: 'Republic Day' },
  { name: 'Holi (2nd Day)', date: '2018-03-02', type: 'Regional', description: 'Holi (2nd Day)' },
  { name: 'Maharashtra Day', date: '2018-05-01', type: 'Regional', description: 'Maharashtra Day' },
  { name: 'Independence Day', date: '2018-08-15', type: 'National', description: 'Independence Day' },
  { name: 'Ganesh Chaturthi', date: '2018-09-13', type: 'Regional', description: 'Ganesh Chaturthi' },
  { name: 'Gandhi Jayanti', date: '2018-10-02', type: 'National', description: 'Gandhi Jayanti' },
  { name: 'Dussehra', date: '2018-10-18', type: 'Regional', description: 'Dussehra' },
  { name: 'Diwali', date: '2018-11-07', type: 'Regional', description: 'Diwali' },
  { name: 'Christmas', date: '2018-12-25', type: 'National', description: 'Christmas' },
  { name: 'Ramzan Id', date: '2018-06-15', type: 'Regional', description: 'Optional Holiday', isOptional: true },
  { name: 'Diwali (Bhaiduj)', date: '2018-11-09', type: 'Regional', description: 'Optional Holiday', isOptional: true }
];

const run = async () => {
  await connectDB();

  await Holiday.deleteMany({});
  await Holiday.insertMany(holidays);

  console.log(`Seeded ${holidays.length} holidays`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('Failed to seed holidays:', error.message);
  process.exit(1);
});
