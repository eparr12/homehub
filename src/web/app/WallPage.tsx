import type { ReactNode } from 'react';
import { OfflineBadge } from '../components/OfflineBadge.tsx';
import { StatusTile } from '../features/status/StatusTile.tsx';
import { type WallCardSpec, WallGrid } from './WallGrid.tsx';

/**
 * The wall's cards in reading order. Placed on a 3 by 3 grid:
 *
 *   photos     photos     countdown
 *   photos     photos     countdown
 *   groceries  groceries  status
 */
export const WALL_CARDS: readonly WallCardSpec[] = [
  {
    id: 'photos',
    title: 'Photos',
    placement: 'col-span-2 row-span-2',
    Content: PhotosPlaceholder,
    isExpandable: true,
  },
  {
    id: 'countdown',
    title: 'Countdown',
    placement: 'row-span-2',
    Content: CountdownPlaceholder,
    isExpandable: true,
  },
  {
    id: 'groceries',
    title: 'Groceries',
    placement: 'col-span-2',
    Content: GroceriesPlaceholder,
    isExpandable: true,
  },
  {
    id: 'status',
    title: 'Status',
    placement: '',
    Content: StatusCardContent,
    isExpandable: false,
  },
];

/** The wall layout at /wall, for the 1920 by 1080 touchscreen. */
export function WallPage() {
  return <WallGrid cards={WALL_CARDS} />;
}

/**
 * The server's status, then the offline badge. The badge sits in the card's
 * flow, on a card with no button, so it never covers something to tap.
 */
function StatusCardContent() {
  return (
    <div className="flex flex-col items-start gap-4 text-2xl">
      <StatusTile />
      <OfflineBadge />
    </div>
  );
}

function PhotosPlaceholder() {
  return <Placeholder>Photos from Lightroom will appear here.</Placeholder>;
}

function CountdownPlaceholder() {
  return <Placeholder>The next holidays will count down here.</Placeholder>;
}

function GroceriesPlaceholder() {
  return <Placeholder>The grocery list will appear here.</Placeholder>;
}

function Placeholder({ children }: { readonly children: ReactNode }) {
  return <p className="text-2xl text-text-muted">{children}</p>;
}
