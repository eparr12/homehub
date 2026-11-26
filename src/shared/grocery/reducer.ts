import type { GroceryIntent } from './intents.ts';
import type { GroceryItem } from './item.ts';

/**
 * Why applyIntent refuses an intent. The server records a reason with its
 * mutation and a client keeps it with the change it shows as refused, so a
 * reason is added and never renamed or removed (SYNC-10).
 */
export const REJECTION_REASONS = [
  'item-not-found',
  'item-deleted',
  'item-exists',
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** The item as an intent leaves it, or why the intent is refused (TS-7). */
export type ApplyIntentResult =
  | { readonly ok: true; readonly item: GroceryItem }
  | { readonly ok: false; readonly reason: RejectionReason };

type AddItem = Extract<GroceryIntent, { intent: 'AddItem' }>;
// The intents that change an item that's already there.
type ItemChange = Exclude<GroceryIntent, { intent: 'AddItem' }>;

/**
 * Applies an intent to the item it names: the one definition of what each
 * intent does, which the client and the server both call (SYNC-3).
 *
 * The item is the one whose id is the intent's itemId, or undefined when there
 * is none. The actor is the short name of whoever made the change, which the
 * caller passes because no intent says who made it (SEC-3), and which is
 * trusted to be a short name, as the item's addedBy must be.
 *
 * Pure: the time comes from the intent's occurredAt and never from a clock
 * (TS-8), neither argument changes, and the item it returns is always a new
 * object (TS-12). The table it follows is in docs/project-overview.md, under
 * What each intent does.
 */
export function applyIntent(
  item: GroceryItem | undefined,
  intent: GroceryIntent,
  actor: string,
): ApplyIntentResult {
  if (item !== undefined && item.id !== intent.itemId) {
    // The caller looked up the wrong item: a bug, not an outcome (TS-7).
    throw new Error("applyIntent's item isn't the one the intent names");
  }
  if (intent.intent === 'AddItem') {
    // An ID is never used twice, so a deleted item's ID is taken too.
    return item === undefined
      ? { ok: true, item: addedItem(intent, actor) }
      : { ok: false, reason: 'item-exists' };
  }
  if (item === undefined) {
    return { ok: false, reason: 'item-not-found' };
  }
  if (item.isDeleted) {
    return intent.intent === 'DeleteItem'
      ? { ok: true, item: unchanged(item) }
      : { ok: false, reason: 'item-deleted' };
  }
  return { ok: true, item: changedItem(item, intent) };
}

/** The new item an AddItem describes, added by the actor. */
function addedItem(intent: AddItem, actor: string): GroceryItem {
  return {
    id: intent.itemId,
    name: intent.name,
    category: intent.category,
    quantity: intent.quantity,
    notes: intent.notes,
    status: 'needed',
    addedBy: actor,
    device: intent.device,
    addedAt: intent.occurredAt,
    updatedAt: intent.occurredAt,
    purchasedAt: null,
    isDeleted: false,
  };
}

// No default branch: with the explicit return type, an intent that has no
// case, such as a seventh one added to the union, fails the typecheck
// (TS2366). A change the list already shows is no change, and nobody gets a
// notice for it.
function changedItem(item: GroceryItem, intent: ItemChange): GroceryItem {
  switch (intent.intent) {
    case 'MarkPurchased':
      // So a second check-off leaves the first one's time.
      return item.status === 'purchased'
        ? unchanged(item)
        : {
            ...item,
            status: 'purchased',
            purchasedAt: intent.occurredAt,
            updatedAt: intent.occurredAt,
          };
    case 'NeedAgain':
      return item.status === 'needed'
        ? unchanged(item)
        : {
            ...item,
            status: 'needed',
            purchasedAt: null,
            updatedAt: intent.occurredAt,
          };
    case 'SetQuantity':
      return item.quantity === intent.quantity
        ? unchanged(item)
        : { ...item, quantity: intent.quantity, updatedAt: intent.occurredAt };
    case 'EditNotes':
      return item.notes === intent.notes
        ? unchanged(item)
        : { ...item, notes: intent.notes, updatedAt: intent.occurredAt };
    case 'DeleteItem':
      // A tombstone keeps every other field (SYNC-6).
      return { ...item, isDeleted: true, updatedAt: intent.occurredAt };
  }
}

/** The item as it was, updatedAt included, as a new object. */
function unchanged(item: GroceryItem): GroceryItem {
  return { ...item };
}
