import { z } from 'zod';

// A limit can widen but never narrow: an item or an outbox entry may already
// hold a value at its edge.
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;
const MAX_DEVICE_LENGTH = 32;
// Milliseconds: what Date#toISOString writes, and what DATA-3's columns hold.
const INSTANT_FRACTION_DIGITS = 3;
// At least one, as config.ts allows in a short name.
const LOWERCASE_LETTERS_DIGITS_AND_HYPHENS = /^[a-z0-9-]+$/;

/**
 * The keys of the categories an item can be in, in the order screens list
 * them. A key is added and never removed or renamed, because items and outbox
 * entries keep the key they were written with (SYNC-10).
 */
export const GROCERY_CATEGORIES = [
  'produce',
  'bakery',
  'deli',
  'meat',
  'dairy',
  'frozen',
  'pantry',
  'snacks',
  'beverages',
  'household',
  'personal-care',
  'other',
] as const;

/**
 * An ID: a UUIDv7 in lowercase, as uuid's v7() writes it (TS-9). One spelling,
 * so that equal IDs are equal strings, as SQLite and IndexedDB compare keys;
 * z.uuidv7() alone takes uppercase hex.
 */
export const idSchema = z.uuidv7().lowercase();

/**
 * An instant: UTC with exactly three fraction digits, such as
 * 2026-11-28T16:10:00.000Z (SRV-5). One spelling, so that equal instants are
 * equal strings, and at a fixed width instants sort by time as plain strings,
 * in code and in a Dexie index. Temporal's default toString() writes a whole
 * second as 2026-11-28T16:10:00Z, which this refuses, so write one with
 * toString({ fractionalSecondDigits: 3 }).
 */
export const instantSchema = z.iso.datetime({
  precision: INSTANT_FRACTION_DIGITS,
});

/** Where a change was made, such as alex-phone or wall. */
export const deviceSchema = z
  .string()
  .max(MAX_DEVICE_LENGTH)
  .regex(LOWERCASE_LETTERS_DIGITS_AND_HYPHENS);

/** A user as logs and the app show them, in place of their login (SEC-7). */
export const shortNameSchema = z
  .string()
  .regex(LOWERCASE_LETTERS_DIGITS_AND_HYPHENS);

/** An item's name, trimmed. */
export const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH)
  .max(MAX_NAME_LENGTH);

/** An item's notes, trimmed, and empty when there are none. */
export const notesSchema = z.string().trim().max(MAX_NOTES_LENGTH);

/** How many to buy: a whole number, never text. */
export const quantitySchema = z.int().min(MIN_QUANTITY).max(MAX_QUANTITY);

/** One of GROCERY_CATEGORIES. */
export const categorySchema = z.enum(GROCERY_CATEGORIES);
