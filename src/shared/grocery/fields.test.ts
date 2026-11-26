import { describe, expect, it } from 'vitest';
import { GROCERY_CATEGORIES } from './fields.ts';

// Every key the list has had. Add a key here when the list gains one, and
// never remove or rename one: items and outbox entries keep the key they were
// written with (SYNC-10).
const KEYS_EVER_LISTED = [
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
];

const LOWERCASE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('GROCERY_CATEGORIES', () => {
  it('still lists every key it has ever listed', () => {
    expect(GROCERY_CATEGORIES).toEqual(
      expect.arrayContaining(KEYS_EVER_LISTED),
    );
  });

  it('spells every key as a lowercase slug', () => {
    expect(
      GROCERY_CATEGORIES.filter((key) => !LOWERCASE_SLUG.test(key)),
    ).toEqual([]);
  });

  it('lists no key twice', () => {
    expect(
      GROCERY_CATEGORIES.filter(
        (key, index) => GROCERY_CATEGORIES.indexOf(key) !== index,
      ),
    ).toEqual([]);
  });
});
