import { z } from 'zod';
import {
  categorySchema,
  deviceSchema,
  idSchema,
  instantSchema,
  nameSchema,
  notesSchema,
  quantitySchema,
  shortNameSchema,
} from './fields.ts';

/**
 * A grocery item, as the server's pull sends it and each client keeps it.
 * A field it doesn't know is dropped, not refused, so an older app can read a
 * newer server's rows (SYNC-10).
 */
export const groceryItemSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    category: categorySchema,
    quantity: quantitySchema,
    notes: notesSchema,
    status: z.enum(['needed', 'purchased']),
    // Who added it and where: the short name and the AddItem's device.
    addedBy: shortNameSchema,
    device: deviceSchema,
    addedAt: instantSchema,
    updatedAt: instantSchema,
    // Null while the item is needed.
    purchasedAt: instantSchema.nullable(),
    // Pulls return deleted items too, as tombstones (SYNC-6).
    isDeleted: z.boolean(),
  })
  .readonly();

export type GroceryItem = z.infer<typeof groceryItemSchema>;
