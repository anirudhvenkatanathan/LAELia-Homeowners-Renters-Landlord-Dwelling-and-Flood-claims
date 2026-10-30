import 'dotenv/config';
import mongoose, { Schema } from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

const MenuItemModel = mongoose.model('triage_menu', new Schema({ id: String, label: String, path: String, parentId: String }), 'triage_menu');

async function main() {
  await mongoose.connect(MONGO_URI);
  const all = await MenuItemModel.find({ label: /service provider assignment/i }).lean();
  console.log('Matches by label:', JSON.stringify(all, null, 2));
  const byPath = await MenuItemModel.find({ path: /vendor-selection-logic/i }).lean();
  console.log('Matches by path:', JSON.stringify(byPath, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
