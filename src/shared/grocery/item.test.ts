import { describe, expect, it } from 'vitest';
import { groceryItemSchema } from './item.ts';

const NEEDED = {
  id: '01a222a4-4f0c-7e2a-9c41-b8f05d3e7a26',
  name: 'Eggs',
  category: 'dairy',
  quantity: 1,
  notes: '',
  status: 'needed',
  addedBy: 'sam',
  device: 'wall',
  addedAt: '2026-11-28T14:52:03.212Z',
  updatedAt: '2026-11-28T14:52:03.212Z',
  purchasedAt: null,
  isDeleted: false,
} as const;
const PURCHASED = {
  id: '01a21eea-76cd-7a64-b0d2-5e8c47f19a3b',
  name: 'Milk',
  category: 'dairy',
  quantity: 2,
  notes: 'The big jug',
  status: 'purchased',
  addedBy: 'alex',
  device: 'alex-phone',
  addedAt: '2026-11-27T21:30:12.045Z',
  updatedAt: '2026-11-28T16:10:00.000Z',
  purchasedAt: '2026-11-28T16:10:00.000Z',
  isDeleted: false,
} as const;
// A tombstone, which pulls return too (SYNC-6).
const DELETED = {
  id: '01a1f3c8-0b5e-7d93-a4f1-6b2c8e7d05f9',
  name: 'Bread',
  category: 'bakery',
  quantity: 1,
  notes: '',
  status: 'needed',
  addedBy: 'alex',
  device: 'alex-phone',
  addedAt: '2026-11-19T12:28:56.030Z',
  updatedAt: '2026-11-28T15:20:41.877Z',
  purchasedAt: null,
  isDeleted: true,
} as const;

const TAKEN = [
  { case: 'a needed item', item: NEEDED },
  { case: 'a purchased item', item: PURCHASED },
  { case: 'a deleted item', item: DELETED },
  // Numbers, not the constants: a limit can go up, but never down, because a
  // row may already hold a value that long.
  {
    case: 'a name of 80 characters',
    item: { ...NEEDED, name: 'n'.repeat(80) },
  },
  {
    case: 'notes of 500 characters',
    item: { ...NEEDED, notes: 'n'.repeat(500) },
  },
  { case: 'a quantity of 99', item: { ...NEEDED, quantity: 99 } },
  {
    case: 'a device name of 32 characters',
    item: { ...NEEDED, device: 'd'.repeat(32) },
  },
];

const ADJUSTED = [
  {
    case: "an item without a field it doesn't know",
    item: { ...PURCHASED, fromNewerServer: true },
    parsed: PURCHASED,
  },
  {
    case: 'a name, trimmed',
    item: { ...PURCHASED, name: '\tMilk ' },
    parsed: PURCHASED,
  },
  {
    case: 'notes, trimmed',
    item: { ...PURCHASED, notes: ' The big jug\n' },
    parsed: PURCHASED,
  },
];

// One wrong value in each field.
const REFUSED = [
  {
    case: 'an id in uppercase',
    item: { ...NEEDED, id: NEEDED.id.toUpperCase() },
  },
  { case: 'a blank name', item: { ...NEEDED, name: '  ' } },
  { case: 'a category off the list', item: { ...NEEDED, category: 'Dairy' } },
  { case: 'a quantity of 0', item: { ...NEEDED, quantity: 0 } },
  {
    case: 'notes of 501 characters',
    item: { ...NEEDED, notes: 'n'.repeat(501) },
  },
  { case: 'a status off the list', item: { ...NEEDED, status: 'bought' } },
  { case: 'an empty addedBy', item: { ...NEEDED, addedBy: '' } },
  { case: 'an addedBy in uppercase', item: { ...NEEDED, addedBy: 'Sam' } },
  { case: 'a device name in uppercase', item: { ...NEEDED, device: 'Wall' } },
  {
    case: 'an addedAt without milliseconds',
    item: { ...PURCHASED, addedAt: '2026-11-27T21:30:12Z' },
  },
  {
    case: 'an updatedAt without milliseconds',
    item: { ...PURCHASED, updatedAt: '2026-11-28T16:10:00Z' },
  },
  {
    case: 'a purchasedAt without milliseconds',
    item: { ...PURCHASED, purchasedAt: '2026-11-28T16:10:00Z' },
  },
  {
    case: 'no purchasedAt at all',
    item: Object.fromEntries(
      Object.entries(NEEDED).filter(([key]) => key !== 'purchasedAt'),
    ),
  },
  { case: 'isDeleted as a number', item: { ...DELETED, isDeleted: 1 } },
];

describe('groceryItemSchema', () => {
  it.each(TAKEN)('takes $case as the server sends it', ({ item }) => {
    expect(groceryItemSchema.parse(item)).toEqual(item);
  });

  it.each(ADJUSTED)('takes $case', ({ item, parsed }) => {
    expect(groceryItemSchema.parse(item)).toEqual(parsed);
  });

  it.each(REFUSED)('refuses $case', ({ item }) => {
    expect(groceryItemSchema.safeParse(item).success).toBe(false);
  });

  it('returns an item that nothing can change (TS-12)', () => {
    const item = groceryItemSchema.parse(NEEDED);

    expect(() => {
      // @ts-expect-error -- the type is read-only, and the object is frozen.
      item.quantity = 2;
    }).toThrow(TypeError);
  });
});

// The browser runs Zod with jitless set, because the security policy blocks
// eval (src/web/zod-config.ts), while Node compiles a parser for each object
// schema. A phone and the server must decide alike. Nothing in these schemas
// makes the two differ: this is here for Zod updates.
describe('groceryItemSchema without compiled parsers', () => {
  it.each([...TAKEN, ...ADJUSTED, ...REFUSED])(
    'gives $case the same answer',
    ({ item }) => {
      const compiled = groceryItemSchema.safeParse(item);
      const interpreted = groceryItemSchema.safeParse(item, { jitless: true });

      expect([interpreted.success, interpreted.data]).toEqual([
        compiled.success,
        compiled.data,
      ]);
    },
  );
});
