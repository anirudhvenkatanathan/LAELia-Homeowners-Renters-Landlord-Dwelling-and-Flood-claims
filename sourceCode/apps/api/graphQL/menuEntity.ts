import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { logError } from '../services/errorLogService';

// ─── Mongoose Schema ──────────────────────────────────────────────────────────

export interface IMenuItem extends Document {
  id: string;
  label: string;
  icon: string;
  path: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

const MenuItemSchema = new Schema<IMenuItem>({
  id:        { type: String, required: true, unique: true },
  label:     { type: String, required: true },
  icon:      { type: String, default: '' },
  path:      { type: String, default: '' },
  parentId:  { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
});

export const MenuItemModel =
  mongoose.models['triage_menu'] as mongoose.Model<IMenuItem> ||
  mongoose.model<IMenuItem>('triage_menu', MenuItemSchema);

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const menuTypeDefs = gql`
  type MenuItem {
    id: String!
    label: String!
    icon: String
    path: String
    parentId: String
    sortOrder: Int
  }

  extend type Query {
    menuItems: [MenuItem!]!
  }
`;

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const menuResolvers = {
  Query: {
    menuItems: async (): Promise<{
      id: string;
      label: string;
      icon: string;
      path: string;
      parentId: string | null;
      sortOrder: number;
    }[]> => {
      try {
        const items = await MenuItemModel
          .find({ isActive: true })
          .sort({ sortOrder: 1 })
          .lean()
          .exec();

        return items.map((item) => ({
          id:        item.id,
          label:     item.label,
          icon:      item.icon,
          path:      item.path,
          parentId:  item.parentId ?? null,
          sortOrder: item.sortOrder,
        }));
      } catch (err) {
        await logError(err as Error, 'menuEntity.menuItems');
        return [];
      }
    },
  },
};
