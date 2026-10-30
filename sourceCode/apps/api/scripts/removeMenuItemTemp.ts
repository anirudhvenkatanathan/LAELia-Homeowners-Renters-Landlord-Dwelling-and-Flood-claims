import 'dotenv/config';
import mongoose, { Schema } from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';
const MENU_ID = 'menu-admin-vendor-selection-logic-001';

const MenuItemModel = mongoose.model('triage_menu', new Schema({ id: String }), 'triage_menu');
const LoginUserAccessModel = mongoose.model('login_user_access', new Schema({ menuId: String }), 'login_user_access');

async function main() {
  await mongoose.connect(MONGO_URI);
  const menuResult = await MenuItemModel.deleteOne({ id: MENU_ID });
  const accessResult = await LoginUserAccessModel.deleteMany({ menuId: MENU_ID });
  console.log('Menu item deleted:', JSON.stringify(menuResult));
  console.log('Orphaned access grants deleted:', JSON.stringify(accessResult));
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
