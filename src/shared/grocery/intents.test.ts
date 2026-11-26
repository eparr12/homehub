import { describe, expect, it } from 'vitest';
import { groceryIntentSchema } from './intents.ts';

// The six intents as an outbox holds them. Add an entry when an intent gains a
// field, and never edit one: a phone may hold an entry like it, unsent, from an
// older version of the app, and the server must still take it (SYNC-10).
const ADD_ITEM = {
  mutationId: '01a222a4-4f0c-7b1e-8f3a-6c2d9e0b4a71',
  itemId: '01a222a4-4f0c-7e2a-9c41-b8f05d3e7a26',
  intent: 'AddItem',
  occurredAt: '2026-11-28T14:52:03.212Z',
  device: 'wall',
  name: 'Eggs',
  category: 'dairy',
  quantity: 1,
  notes: '',
} as const;
const MARK_PURCHASED = {
  mutationId: '01a222eb-abc0-7d58-a2e7-4f19c6b03d8e',
  itemId: '01a21eea-76cd-7a64-b0d2-5e8c47f19a3b',
  intent: 'MarkPurchased',
  occurredAt: '2026-11-28T16:10:00.000Z',
  device: 'alex-phone',
} as const;
const NEED_AGAIN = {
  mutationId: '01a22376-59d2-7f41-8b6e-d3a9c20e5f17',
  itemId: '01a21eea-76cd-7a64-b0d2-5e8c47f19a3b',
  intent: 'NeedAgain',
  occurredAt: '2026-11-28T18:41:27.530Z',
  device: 'wall',
} as const;
const SET_QUANTITY = {
  mutationId: '01a222b0-c990-7c25-9a8f-17e4b6d0c3a2',
  itemId: '01a222a4-4f0c-7e2a-9c41-b8f05d3e7a26',
  intent: 'SetQuantity',
  occurredAt: '2026-11-28T15:05:41.008Z',
  device: 'sam-phone',
  quantity: 2,
} as const;
const EDIT_NOTES = {
  mutationId: '01a222b1-1e93-7a0d-b5c8-2f6e9d14a7b3',
  itemId: '01a222a4-4f0c-7e2a-9c41-b8f05d3e7a26',
  intent: 'EditNotes',
  occurredAt: '2026-11-28T15:06:02.771Z',
  device: 'sam-phone',
  notes: 'Brown, a dozen',
} as const;
const DELETE_ITEM = {
  mutationId: '01a222be-8895-7e6c-8d2b-a5f03c9e1b74',
  itemId: '01a1f3c8-0b5e-7d93-a4f1-6b2c8e7d05f9',
  intent: 'DeleteItem',
  occurredAt: '2026-11-28T15:20:41.877Z',
  device: 'wall',
} as const;

const OUTBOX = [
  ADD_ITEM,
  MARK_PURCHASED,
  NEED_AGAIN,
  SET_QUANTITY,
  EDIT_NOTES,
  DELETE_ITEM,
];

// What uuid's v4() and crypto.randomUUID() make (TS-9).
const UUID_V4 = '9b2f1c3e-4d5a-4b6c-8d7e-0f1a2b3c4d5e';

/** A copy of a sample with one field left out. */
function without(
  sample: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(sample).filter(([key]) => key !== field),
  );
}

// Intents that parse to something other than what was sent.
const ADJUSTED = [
  ...OUTBOX.map((entry) => ({
    case: `${entry.intent} without a field it doesn't know`,
    intent: { ...entry, fromNewerApp: true },
    parsed: entry,
  })),
  {
    case: 'an AddItem name, trimmed',
    intent: { ...ADD_ITEM, name: ' Eggs\n' },
    parsed: ADD_ITEM,
  },
  {
    case: 'blank AddItem notes, trimmed to none',
    intent: { ...ADD_ITEM, notes: '\t ' },
    parsed: ADD_ITEM,
  },
  {
    case: 'EditNotes notes, trimmed',
    intent: { ...EDIT_NOTES, notes: '  Brown, a dozen ' },
    parsed: EDIT_NOTES,
  },
  // Trimmed before the limit applies: a phone's keyboard leaves a space behind.
  {
    case: 'a name of 80 characters and a space, trimmed',
    intent: { ...ADD_ITEM, name: 'n'.repeat(80) + ' ' },
    parsed: { ...ADD_ITEM, name: 'n'.repeat(80) },
  },
  {
    case: 'EditNotes notes of 500 characters and a line break, trimmed',
    intent: { ...EDIT_NOTES, notes: 'n'.repeat(500) + '\n' },
    parsed: { ...EDIT_NOTES, notes: 'n'.repeat(500) },
  },
];

// Numbers, not the constants: a limit can widen but never narrow, because an
// item or an outbox entry may already hold a value at its edge.
const AT_THE_LIMITS = [
  { case: 'a name of 1 character', intent: { ...ADD_ITEM, name: 'n' } },
  {
    case: 'a name of 80 characters',
    intent: { ...ADD_ITEM, name: 'n'.repeat(80) },
  },
  {
    case: 'AddItem notes of 500 characters',
    intent: { ...ADD_ITEM, notes: 'n'.repeat(500) },
  },
  {
    case: 'EditNotes notes of 500 characters',
    intent: { ...EDIT_NOTES, notes: 'n'.repeat(500) },
  },
  {
    case: 'EditNotes that clears the notes',
    intent: { ...EDIT_NOTES, notes: '' },
  },
  { case: 'an AddItem quantity of 99', intent: { ...ADD_ITEM, quantity: 99 } },
  {
    case: 'a SetQuantity quantity of 99',
    intent: { ...SET_QUANTITY, quantity: 99 },
  },
  {
    case: 'a device name of 32 characters',
    intent: { ...MARK_PURCHASED, device: 'd'.repeat(32) },
  },
];

// One wrong thing in an otherwise good intent. Every intent's own fields come
// from one shape, so MarkPurchased stands for all six; an intent's extra fields
// are checked in each intent that has them.
const REFUSED = [
  {
    case: "an intent name it doesn't know",
    intent: { ...MARK_PURCHASED, intent: 'MarkBought' },
  },
  { case: 'no intent name', intent: without(MARK_PURCHASED, 'intent') },
  {
    case: 'a UUIDv4 as the mutationId',
    intent: { ...MARK_PURCHASED, mutationId: UUID_V4 },
  },
  {
    case: 'a UUIDv4 as the itemId',
    intent: { ...MARK_PURCHASED, itemId: UUID_V4 },
  },
  {
    case: 'a mutationId in uppercase',
    intent: {
      ...MARK_PURCHASED,
      mutationId: MARK_PURCHASED.mutationId.toUpperCase(),
    },
  },
  {
    case: 'an itemId in uppercase',
    intent: { ...MARK_PURCHASED, itemId: MARK_PURCHASED.itemId.toUpperCase() },
  },
  { case: 'no mutationId', intent: without(MARK_PURCHASED, 'mutationId') },
  { case: 'no itemId', intent: without(MARK_PURCHASED, 'itemId') },
  { case: 'no occurredAt', intent: without(MARK_PURCHASED, 'occurredAt') },
  { case: 'no device', intent: without(MARK_PURCHASED, 'device') },
  {
    case: 'an occurredAt without milliseconds',
    intent: { ...MARK_PURCHASED, occurredAt: '2026-11-28T16:10:00Z' },
  },
  {
    case: 'an occurredAt with an offset',
    intent: { ...MARK_PURCHASED, occurredAt: '2026-11-28T11:10:00.000-05:00' },
  },
  {
    case: 'an occurredAt with no Z',
    intent: { ...MARK_PURCHASED, occurredAt: '2026-11-28T16:10:00.000' },
  },
  {
    case: 'a device name with a space',
    intent: { ...MARK_PURCHASED, device: 'alex phone' },
  },
  {
    case: 'a device name in uppercase',
    intent: { ...MARK_PURCHASED, device: 'Alex-Phone' },
  },
  { case: 'an empty device name', intent: { ...MARK_PURCHASED, device: '' } },
  {
    case: 'a device name of 33 characters',
    intent: { ...MARK_PURCHASED, device: 'd'.repeat(33) },
  },
  { case: 'a blank name', intent: { ...ADD_ITEM, name: ' \t ' } },
  {
    case: 'a name of 81 characters',
    intent: { ...ADD_ITEM, name: 'n'.repeat(81) },
  },
  {
    case: 'AddItem notes of 501 characters',
    intent: { ...ADD_ITEM, notes: 'n'.repeat(501) },
  },
  {
    case: 'EditNotes notes of 501 characters',
    intent: { ...EDIT_NOTES, notes: 'n'.repeat(501) },
  },
  {
    case: 'a category off the list',
    intent: { ...ADD_ITEM, category: 'Dairy' },
  },
  { case: 'AddItem without a name', intent: without(ADD_ITEM, 'name') },
  { case: 'AddItem without a category', intent: without(ADD_ITEM, 'category') },
  { case: 'AddItem without a quantity', intent: without(ADD_ITEM, 'quantity') },
  { case: 'AddItem without notes', intent: without(ADD_ITEM, 'notes') },
  {
    case: 'SetQuantity without a quantity',
    intent: without(SET_QUANTITY, 'quantity'),
  },
  { case: 'EditNotes without notes', intent: without(EDIT_NOTES, 'notes') },
  ...[ADD_ITEM, SET_QUANTITY].flatMap((entry) =>
    [0, -1, 1.5, 100, '2'].map((quantity) => ({
      case: `${entry.intent} with a quantity of ${JSON.stringify(quantity)}`,
      intent: { ...entry, quantity },
    })),
  ),
];

// In time order. A spelling the schema refuses would sort out of it as a
// plain string: a whole second without milliseconds after the instants inside
// that second, and an instant with an offset by its local time.
const OCCURRED_AT_IN_TIME_ORDER = [
  '2026-11-28T16:09:59.999Z',
  '2026-11-28T16:10:00Z',
  '2026-11-28T16:10:00.001Z',
  '2026-11-28T16:10:00.500Z',
  '2026-11-28T11:10:00.750-05:00',
  '2026-11-28T16:10:01.000Z',
  '2026-11-29T00:00:00.000Z',
];

// Date#toISOString always writes the milliseconds, even for a whole second.
const WHOLE_SECOND = new Date('2026-11-28T16:12:00Z').toISOString();

describe('groceryIntentSchema', () => {
  it.each(OUTBOX)('takes $intent as an outbox holds it', (entry) => {
    expect(groceryIntentSchema.parse(entry)).toEqual(entry);
  });

  it.each(ADJUSTED)('takes $case', ({ intent, parsed }) => {
    expect(groceryIntentSchema.parse(intent)).toEqual(parsed);
  });

  it.each(AT_THE_LIMITS)('takes $case', ({ intent }) => {
    expect(groceryIntentSchema.parse(intent)).toEqual(intent);
  });

  it.each(REFUSED)('refuses $case', ({ intent }) => {
    expect(groceryIntentSchema.safeParse(intent).success).toBe(false);
  });

  it('takes an occurredAt only in a spelling that sorts by time as a string', () => {
    const accepted = OCCURRED_AT_IN_TIME_ORDER.filter(
      (occurredAt) =>
        groceryIntentSchema.safeParse({ ...MARK_PURCHASED, occurredAt })
          .success,
    );

    expect(accepted.toSorted()).toEqual(accepted);
  });

  it('takes an occurredAt that Date#toISOString wrote for a whole second', () => {
    const intent = { ...MARK_PURCHASED, occurredAt: WHOLE_SECOND };

    expect(groceryIntentSchema.parse(intent)).toEqual(intent);
  });

  it('returns an intent that nothing can change (TS-12)', () => {
    const intent = groceryIntentSchema.parse(MARK_PURCHASED);

    expect(() => {
      // @ts-expect-error -- the type is read-only, and the object is frozen.
      intent.device = 'wall';
    }).toThrow(TypeError);
  });
});

const SAMPLES = [
  ...OUTBOX.map((entry) => ({
    case: `the outbox's ${entry.intent}`,
    intent: entry,
  })),
  ...ADJUSTED,
  ...AT_THE_LIMITS,
  ...REFUSED,
  ...OCCURRED_AT_IN_TIME_ORDER.map((occurredAt) => ({
    case: `an occurredAt of ${occurredAt}`,
    intent: { ...MARK_PURCHASED, occurredAt },
  })),
  {
    case: 'an occurredAt from Date#toISOString',
    intent: { ...MARK_PURCHASED, occurredAt: WHOLE_SECOND },
  },
];

// The browser runs Zod with jitless set, because the security policy blocks
// eval (src/web/zod-config.ts), while Node compiles a parser for each object
// schema. A phone and the server must decide alike. Nothing in these schemas
// makes the two differ: this is here for Zod updates.
describe('groceryIntentSchema without compiled parsers', () => {
  it.each(SAMPLES)('gives $case the same answer', ({ intent }) => {
    const compiled = groceryIntentSchema.safeParse(intent);
    const interpreted = groceryIntentSchema.safeParse(intent, {
      jitless: true,
    });

    expect([interpreted.success, interpreted.data]).toEqual([
      compiled.success,
      compiled.data,
    ]);
  });
});
