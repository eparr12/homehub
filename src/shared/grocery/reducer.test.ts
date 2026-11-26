import { assert, describe, expect, it } from 'vitest';
import type { GroceryIntent } from './intents.ts';
import { groceryItemSchema, type GroceryItem } from './item.ts';
import { applyIntent } from './reducer.ts';

// Who the caller says made each change. The items below were added by someone
// else, on another device, so a change that writes either field shows.
const ACTOR = 'alex';
const ITEM_ID = '01a222a4-4f0c-7e2a-9c41-b8f05d3e7a26';
const OTHER_ID = '01a21eea-76cd-7a64-b0d2-5e8c47f19a3b';

// The item the intents name, in each state the table has. Its quantity isn't
// the lowest and its notes aren't empty, so a change that resets either shows
// when the whole item is compared.
const NEEDED: GroceryItem = {
  id: ITEM_ID,
  name: 'Eggs',
  category: 'dairy',
  quantity: 2,
  notes: 'Brown, a dozen',
  status: 'needed',
  addedBy: 'sam',
  device: 'wall',
  addedAt: '2026-11-27T21:30:12.045Z',
  updatedAt: '2026-11-28T09:15:30.250Z',
  purchasedAt: null,
  isDeleted: false,
};
const CHECKED_OFF: GroceryItem = {
  ...NEEDED,
  status: 'purchased',
  updatedAt: '2026-11-28T16:10:00.000Z',
  purchasedAt: '2026-11-28T16:10:00.000Z',
};
// Tombstones keep the status they had when they were deleted (SYNC-6).
const DELETED_NEEDED: GroceryItem = {
  ...NEEDED,
  updatedAt: '2026-11-28T15:20:41.877Z',
  isDeleted: true,
};
const DELETED_CHECKED_OFF: GroceryItem = {
  ...CHECKED_OFF,
  updatedAt: '2026-11-28T17:02:19.340Z',
  isDeleted: true,
};

// When the changes below were made: after anything the items record.
const CHANGED_AT = '2026-11-28T18:41:27.530Z';

const ADD_ITEM = {
  intent: 'AddItem',
  mutationId: '01a222a4-4f0c-7b1e-8f3a-6c2d9e0b4a71',
  itemId: ITEM_ID,
  occurredAt: '2026-11-27T21:30:12.045Z',
  device: 'wall',
  name: 'Eggs',
  category: 'dairy',
  quantity: 2,
  notes: 'Brown, a dozen',
} as const satisfies GroceryIntent;
const MARK_PURCHASED = {
  intent: 'MarkPurchased',
  mutationId: '01a222eb-abc0-7d58-a2e7-4f19c6b03d8e',
  itemId: ITEM_ID,
  occurredAt: CHANGED_AT,
  device: 'alex-phone',
} as const satisfies GroceryIntent;
const NEED_AGAIN = {
  intent: 'NeedAgain',
  mutationId: '01a22376-59d2-7f41-8b6e-d3a9c20e5f17',
  itemId: ITEM_ID,
  occurredAt: CHANGED_AT,
  device: 'alex-phone',
} as const satisfies GroceryIntent;
const SET_QUANTITY = {
  intent: 'SetQuantity',
  mutationId: '01a222b0-c990-7c25-9a8f-17e4b6d0c3a2',
  itemId: ITEM_ID,
  occurredAt: CHANGED_AT,
  device: 'alex-phone',
  quantity: 4,
} as const satisfies GroceryIntent;
const EDIT_NOTES = {
  intent: 'EditNotes',
  mutationId: '01a222b1-1e93-7a0d-b5c8-2f6e9d14a7b3',
  itemId: ITEM_ID,
  occurredAt: CHANGED_AT,
  device: 'alex-phone',
  notes: 'Free range',
} as const satisfies GroceryIntent;
const DELETE_ITEM = {
  intent: 'DeleteItem',
  mutationId: '01a222be-8895-7e6c-8d2b-a5f03c9e1b74',
  itemId: ITEM_ID,
  occurredAt: CHANGED_AT,
  device: 'alex-phone',
} as const satisfies GroceryIntent;

const INTENTS = [
  ADD_ITEM,
  MARK_PURCHASED,
  NEED_AGAIN,
  SET_QUANTITY,
  EDIT_NOTES,
  DELETE_ITEM,
];

// What AddItem builds when there's no item: everything from the intent but
// who added it, which comes from the caller.
const ADDED: GroceryItem = {
  id: ADD_ITEM.itemId,
  name: ADD_ITEM.name,
  category: ADD_ITEM.category,
  quantity: ADD_ITEM.quantity,
  notes: ADD_ITEM.notes,
  status: 'needed',
  addedBy: ACTOR,
  device: ADD_ITEM.device,
  addedAt: ADD_ITEM.occurredAt,
  updatedAt: ADD_ITEM.occurredAt,
  purchasedAt: null,
  isDeleted: false,
};

// A second AddItem, in which every field differs from the first, so that a
// field filled in from anywhere but the intent shows.
const OTHER_ADD_ITEM = {
  intent: 'AddItem',
  mutationId: '01a222c3-5a17-7d2e-b4f8-0c9e3a6d21b5',
  itemId: OTHER_ID,
  occurredAt: '2026-11-28T15:31:58.604Z',
  device: 'sam-phone',
  name: 'Bread',
  category: 'bakery',
  quantity: 1,
  notes: '',
} as const satisfies GroceryIntent;

const DELETED_ITEMS = [
  { state: 'a deleted item that was needed', item: DELETED_NEEDED },
  { state: 'a deleted item that was checked off', item: DELETED_CHECKED_OFF },
];
const EXISTING_ITEMS = [
  { state: 'a needed item', item: NEEDED },
  { state: 'a checked-off item', item: CHECKED_OFF },
  ...DELETED_ITEMS,
];
// The intents a deleted item refuses as item-deleted: all but AddItem, which
// it refuses as item-exists, and DeleteItem, which is no change.
const REFUSED_WHEN_DELETED = [
  MARK_PURCHASED,
  NEED_AGAIN,
  SET_QUANTITY,
  EDIT_NOTES,
];

// The table's refusals. Its deleted column is here twice, for a deleted item
// that was needed and one that was checked off, so that a status checked
// before isDeleted shows.
const REFUSED = [
  ...EXISTING_ITEMS.map(({ state, item }) => ({
    state,
    item,
    intent: ADD_ITEM,
    reason: 'item-exists',
  })),
  ...DELETED_ITEMS.flatMap(({ state, item }) =>
    REFUSED_WHEN_DELETED.map((intent) => ({
      state,
      item,
      intent,
      reason: 'item-deleted',
    })),
  ),
  ...[...REFUSED_WHEN_DELETED, DELETE_ITEM].map((intent) => ({
    state: 'no item',
    item: undefined,
    intent,
    reason: 'item-not-found',
  })),
];

// The table's cells where an intent applies, and the item each returns. A
// change sets updatedAt to the intent's occurredAt and moves nothing the table
// doesn't name; no change returns the item as it was, updatedAt included.
// Vitest cuts a value in a test's name at 40 characters, so each `does` fits.
const APPLIED = [
  {
    does: 'adds the item for an ID that has none',
    item: undefined,
    intent: ADD_ITEM,
    returns: ADDED,
  },
  {
    does: 'checks off a needed item',
    item: NEEDED,
    intent: MARK_PURCHASED,
    returns: {
      ...NEEDED,
      status: 'purchased',
      updatedAt: CHANGED_AT,
      purchasedAt: CHANGED_AT,
    },
  },
  {
    does: 'keeps a checked-off item as it was',
    item: CHECKED_OFF,
    intent: MARK_PURCHASED,
    returns: CHECKED_OFF,
  },
  {
    does: 'keeps a needed item as it was',
    item: NEEDED,
    intent: NEED_AGAIN,
    returns: NEEDED,
  },
  {
    does: 'puts a checked-off item back on the list',
    item: CHECKED_OFF,
    intent: NEED_AGAIN,
    returns: {
      ...CHECKED_OFF,
      status: 'needed',
      updatedAt: CHANGED_AT,
      purchasedAt: null,
    },
  },
  {
    does: "raises a needed item's quantity",
    item: NEEDED,
    intent: SET_QUANTITY,
    returns: { ...NEEDED, quantity: 4, updatedAt: CHANGED_AT },
  },
  {
    does: "lowers a needed item's quantity",
    item: NEEDED,
    intent: { ...SET_QUANTITY, quantity: 1 },
    returns: { ...NEEDED, quantity: 1, updatedAt: CHANGED_AT },
  },
  {
    does: "sets a checked-off item's quantity",
    item: CHECKED_OFF,
    intent: SET_QUANTITY,
    returns: { ...CHECKED_OFF, quantity: 4, updatedAt: CHANGED_AT },
  },
  {
    does: 'keeps an item at that quantity as it was',
    item: NEEDED,
    intent: { ...SET_QUANTITY, quantity: NEEDED.quantity },
    returns: NEEDED,
  },
  {
    does: "sets a needed item's notes",
    item: NEEDED,
    intent: EDIT_NOTES,
    returns: { ...NEEDED, notes: 'Free range', updatedAt: CHANGED_AT },
  },
  {
    does: "clears a needed item's notes",
    item: NEEDED,
    intent: { ...EDIT_NOTES, notes: '' },
    returns: { ...NEEDED, notes: '', updatedAt: CHANGED_AT },
  },
  {
    does: "sets a checked-off item's notes",
    item: CHECKED_OFF,
    intent: EDIT_NOTES,
    returns: { ...CHECKED_OFF, notes: 'Free range', updatedAt: CHANGED_AT },
  },
  {
    does: 'keeps an item with those notes as it was',
    item: NEEDED,
    intent: { ...EDIT_NOTES, notes: NEEDED.notes },
    returns: NEEDED,
  },
  {
    does: 'makes a needed item a tombstone',
    item: NEEDED,
    intent: DELETE_ITEM,
    returns: { ...NEEDED, updatedAt: CHANGED_AT, isDeleted: true },
  },
  {
    does: 'makes a checked-off item a tombstone',
    item: CHECKED_OFF,
    intent: DELETE_ITEM,
    returns: { ...CHECKED_OFF, updatedAt: CHANGED_AT, isDeleted: true },
  },
  {
    does: 'keeps a needed tombstone as it was',
    item: DELETED_NEEDED,
    intent: DELETE_ITEM,
    returns: DELETED_NEEDED,
  },
  {
    does: 'keeps a checked-off tombstone as it was',
    item: DELETED_CHECKED_OFF,
    intent: DELETE_ITEM,
    returns: DELETED_CHECKED_OFF,
  },
];

// The caller looked up the wrong item. It's a bug whatever the item's state,
// so each intent meets a live item and a deleted one.
const WRONG_ITEMS = INTENTS.flatMap((intent) => [
  { state: 'a needed item', item: { ...NEEDED, id: OTHER_ID }, intent },
  {
    state: 'a deleted item',
    item: { ...DELETED_NEEDED, id: OTHER_ID },
    intent,
  },
]);

// Someone else checks the item off later, with no signal: their intent can't
// know about the first one.
const SECOND_CHECK_OFF = {
  ...MARK_PURCHASED,
  mutationId: '01a22377-0d4e-7a19-9f2c-5b8e1d3a6c40',
  occurredAt: '2026-11-28T18:42:05.119Z',
  device: 'sam-phone',
} as const satisfies GroceryIntent;

// One item's trip: added, its quantity raised, checked off in the store,
// checked off again by the other shopper, then a note.
const TRIP = [
  ADD_ITEM,
  { ...SET_QUANTITY, occurredAt: '2026-11-28T15:05:41.008Z', quantity: 3 },
  { ...MARK_PURCHASED, occurredAt: '2026-11-28T16:10:00.000Z' },
  { ...SECOND_CHECK_OFF, occurredAt: '2026-11-28T16:10:07.340Z' },
  {
    ...EDIT_NOTES,
    occurredAt: '2026-11-28T16:12:30.500Z',
    notes: 'The last dozen',
  },
];

/** The item applyIntent returns, in a case where the table says it applies. */
function appliedItem(
  item: GroceryItem | undefined,
  intent: GroceryIntent,
): GroceryItem {
  const result = applyIntent(item, intent, ACTOR);
  assert(result.ok, `applyIntent refused ${intent.intent}`);
  return result.item;
}

describe('applyIntent', () => {
  it.each(REFUSED)(
    'refuses $intent.intent for $state as $reason',
    ({ item, intent, reason }) => {
      expect(applyIntent(item, intent, ACTOR)).toEqual({ ok: false, reason });
    },
  );

  it.each(APPLIED)('$intent.intent $does', ({ item, intent, returns }) => {
    expect(applyIntent(item, intent, ACTOR)).toEqual({
      ok: true,
      item: returns,
    });
  });

  it.each([
    { actor: 'alex', intent: ADD_ITEM, returns: ADDED },
    {
      actor: 'sam',
      intent: OTHER_ADD_ITEM,
      returns: {
        id: OTHER_ID,
        name: 'Bread',
        category: 'bakery',
        quantity: 1,
        notes: '',
        status: 'needed',
        addedBy: 'sam',
        device: 'sam-phone',
        addedAt: '2026-11-28T15:31:58.604Z',
        updatedAt: '2026-11-28T15:31:58.604Z',
        purchasedAt: null,
        isDeleted: false,
      },
    },
  ])(
    'adds $intent.name as its AddItem describes, added by $actor as the caller says',
    ({ actor, intent, returns }) => {
      expect(applyIntent(undefined, intent, actor)).toEqual({
        ok: true,
        item: returns,
      });
    },
  );

  it("keeps the first check-off's time when someone checks an item off again", () => {
    const checkedOff = appliedItem(NEEDED, MARK_PURCHASED);

    expect(applyIntent(checkedOff, SECOND_CHECK_OFF, 'sam')).toEqual({
      ok: true,
      item: checkedOff,
    });
  });

  it.each(WRONG_ITEMS)(
    'throws for $intent.intent given $state with another id',
    ({ item, intent }) => {
      expect(() => applyIntent(item, intent, ACTOR)).toThrow(
        /isn't the one the intent names/,
      );
    },
  );

  it('folds a trip from no item into the item its last change left', () => {
    const item = TRIP.reduce<GroceryItem | undefined>(appliedItem, undefined);

    expect(item).toEqual({
      ...ADDED,
      quantity: 3,
      notes: 'The last dozen',
      status: 'purchased',
      updatedAt: '2026-11-28T16:12:30.500Z',
      purchasedAt: '2026-11-28T16:10:00.000Z',
    });
  });

  // A write to a frozen object throws in a module, and the schemas freeze
  // what they return, so the item and intent a caller passes may be frozen.
  it.each(APPLIED)(
    'changes neither argument when $intent.intent $does',
    ({ item, intent }) => {
      const frozenItem =
        item === undefined ? undefined : Object.freeze({ ...item });
      const frozenIntent = Object.freeze({ ...intent });

      applyIntent(frozenItem, frozenIntent, ACTOR);

      expect([frozenItem, frozenIntent]).toEqual([item, intent]);
    },
  );

  it.each(APPLIED)(
    'returns a new item, never the one it was given, when $intent.intent $does',
    ({ item, intent }) => {
      expect(appliedItem(item, intent)).not.toBe(item);
    },
  );

  it.each(APPLIED)(
    'returns an item the item schema takes as it is when $intent.intent $does',
    ({ item, intent }) => {
      const returned = appliedItem(item, intent);

      expect(groceryItemSchema.parse(returned)).toEqual(returned);
    },
  );
});
