require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/claim_triage';

async function reset() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected');

  const clientHash = await bcrypt.hash('client@123', 10);
  await mongoose.connection.db.collection('login_user').updateOne(
    { loginId: 'client-login-001' },
    { $set: { password: clientHash } }
  );
  console.log('client@gmail.com => client@123');

  const vendorHash = await bcrypt.hash('vendor@123', 10);
  await mongoose.connection.db.collection('login_user').updateOne(
    { loginId: 'vendor-login-001' },
    { $set: { password: vendorHash } }
  );
  console.log('vendor@gmail.com => vendor@123');

  await mongoose.disconnect();
  console.log('Done.');
}

reset().catch((err) => { console.error(err); process.exit(1); });
