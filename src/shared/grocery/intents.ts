import { z } from 'zod';
import {
  categorySchema,
  deviceSchema,
  idSchema,
  instantSchema,
  nameSchema,
  notesSchema,
  quantitySchema,
} from './fields.ts';

// What every intent carries. None says who made it: the reducer takes that
// from its caller, and the server passes the short name from the request's
// identity (SEC-3).
const commonFields = {
  // Made by the client; the server applies each one at most once (SYNC-4).
  mutationId: idSchema,
  itemId: idSchema,
  occurredAt: instantSchema,
  device: deviceSchema,
};

/**
 * One change to the grocery list, as the outbox holds it and the server
 * applies it: an intent, never a whole row (SYNC-2). A field it doesn't know
 * is dropped, not refused, so an older server can take an intent from a newer
 * app (SYNC-10).
 */
export const groceryIntentSchema = z
  .discriminatedUnion('intent', [
    z.object({
      intent: z.literal('AddItem'),
      ...commonFields,
      name: nameSchema,
      category: categorySchema,
      quantity: quantitySchema,
      notes: notesSchema,
    }),
    z.object({ intent: z.literal('MarkPurchased'), ...commonFields }),
    z.object({ intent: z.literal('NeedAgain'), ...commonFields }),
    z.object({
      intent: z.literal('SetQuantity'),
      ...commonFields,
      quantity: quantitySchema,
    }),
    z.object({
      intent: z.literal('EditNotes'),
      ...commonFields,
      notes: notesSchema,
    }),
    z.object({ intent: z.literal('DeleteItem'), ...commonFields }),
  ])
  .readonly();

export type GroceryIntent = z.infer<typeof groceryIntentSchema>;
