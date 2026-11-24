import { act, fireEvent, render, screen } from '@testing-library/react';
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

function renderGrid(cards: readonly WallCardSpec[] = CARDS): void {
  const connectivity = createConnectivity({
    navigator: { onLine: true },
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

  it('keeps the other cards up when one throws', () => {
    // React reports the caught error to the console.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderGrid([{ ...CARDS[0], Content: Broken }, ...CARDS.slice(1)]);

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
    renderGrid([{ ...CARDS[0], Content: Flaky }, ...CARDS.slice(1)]);
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
});
