import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ConnectivityContext,
  createConnectivity,
} from '../data/connectivity.ts';
import { type WallCardSpec, WallGrid } from './WallGrid.tsx';

// Longer than the card transition, so an exit animation has finished.
const TRANSITION_DONE_MS = 1_000;
const FALLBACK_TEXT = 'This card stopped working.';
const FULL_SCREEN_FALLBACK_TEXT =
  'This view stopped working. Close it and try again.';

function testCard(title: string, isExpandable = true): WallCardSpec {
  return {
    id: title.toLowerCase(),
    title,
    placement: '',
    Content: () => <p>Content of {title}</p>,
    isExpandable,
  };
}

const CARDS = [
  testCard('One'),
  testCard('Two'),
  testCard('Three'),
  testCard('Four', false),
] as const;

function Broken(): never {
  throw new Error('broken card');
}

function renderGrid({
  cards = CARDS,
  isOnline = true,
}: { cards?: readonly WallCardSpec[]; isOnline?: boolean } = {}): void {
  const connectivity = createConnectivity({
    navigator: { onLine: isOnline },
    addEventListener: () => undefined,
  });
  render(
    <ConnectivityContext value={connectivity}>
      <WallGrid cards={cards} />
    </ConnectivityContext>,
  );
}

async function advance(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

// One fake clock for the whole file. jsdom runs animation frames on an
// interval it creates once, on whichever clock is installed then, and Motion
// keeps one frame loop for the page, so a clock swapped out between tests
// would leave later tests without frames.
beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WallGrid', () => {
  it('opens a card full screen with its Close button focused', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'One' }));

    const dialog = screen.getByRole('dialog', { name: 'One' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    );
    expect(dialog.textContent).toContain('Content of One');
  });

  it('closes the full-screen card and returns focus to the card', async () => {
    renderGrid();
    const card = screen.getByRole('button', { name: 'One' });
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await advance(TRANSITION_DONE_MS);

    expect({
      isDialogGone: screen.queryByRole('dialog') === null,
      isCardFocused: document.activeElement === card,
    }).toEqual({ isDialogGone: true, isCardFocused: true });
  });

  it('closes the full-screen card with Escape', async () => {
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'One' }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), {
      key: 'Escape',
    });
    await advance(TRANSITION_DONE_MS);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('makes the grid inert while a card is open', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'One' }));

    expect(screen.getByRole('main').hasAttribute('inert')).toBe(true);
  });

  it('shows the offline badge in the full-screen view', () => {
    renderGrid({ isOnline: false });

    fireEvent.click(screen.getByRole('button', { name: 'One' }));

    const dialog = screen.getByRole('dialog', { name: 'One' });
    expect(within(dialog).getByRole('status').textContent).toBe('Offline');
  });

  it('keeps the other cards up when one throws', () => {
    // React reports the caught error to the console.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderGrid({
      cards: [{ ...CARDS[0], Content: Broken }, ...CARDS.slice(1)],
    });

    expect({
      fallbacks: screen.getAllByText(FALLBACK_TEXT).length,
      cards: screen.getAllByText(/^Content of/).map((p) => p.textContent),
    }).toEqual({
      fallbacks: 1,
      cards: ['Content of Two', 'Content of Three', 'Content of Four'],
    });
  });

  it('brings a card that threw back with Try again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let isBroken = true;
    function Flaky() {
      if (isBroken) throw new Error('flaky card');
      return <p>Content of One</p>;
    }
    renderGrid({ cards: [{ ...CARDS[0], Content: Flaky }, ...CARDS.slice(1)] });
    isBroken = false;

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      screen.getAllByText(/^Content of/).map((p) => p.textContent),
    ).toEqual([
      'Content of One',
      'Content of Two',
      'Content of Three',
      'Content of Four',
    ]);
  });

  it('keeps Close in the full-screen view when the content throws there', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let isBroken = false;
    function Fragile() {
      if (isBroken) throw new Error('fragile card');
      return <p>Content of One</p>;
    }
    renderGrid({
      cards: [{ ...CARDS[0], Content: Fragile }, ...CARDS.slice(1)],
    });
    isBroken = true;

    fireEvent.click(screen.getByRole('button', { name: 'One' }));

    const dialog = screen.getByRole('dialog', { name: 'One' });
    expect({
      hasFallback:
        within(dialog).queryByText(FULL_SCREEN_FALLBACK_TEXT) !== null,
      hasClose:
        within(dialog).queryByRole('button', { name: 'Close' }) !== null,
    }).toEqual({ hasFallback: true, hasClose: true });
  });
});
