import { AnimatePresence, motion } from 'motion/react';
import { type ComponentType, useId, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { OfflineBadge } from '../components/OfflineBadge.tsx';

/** One card on the wall's grid. */
export interface WallCardSpec {
  readonly id: string;
  readonly title: string;
  /** Tailwind classes that place the card on the grid. */
  readonly placement: string;
  /** What the card shows; an expandable card shows it full screen too. */
  readonly Content: ComponentType;
  /** Whether tapping the card opens it full screen. */
  readonly isExpandable: boolean;
}

const CARD_FRAME =
  'relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-surface-raised p-8 select-none';
const FOCUS_RING = 'focus-visible:outline-4 focus-visible:outline-accent';
// 64 px tall at the least, the wall's touch target (WEB-7).
const WALL_BUTTON = `min-h-16 min-w-16 rounded-2xl bg-text px-8 text-3xl font-semibold text-surface ${FOCUS_RING} focus-visible:outline-offset-4`;

// Opacity and transform only (WEB-8). MotionConfig in main.tsx drops the
// scale for anyone who prefers reduced motion.
const HIDDEN = { opacity: 0, scale: 0.96 };
const SHOWN = { opacity: 1, scale: 1 };
const TRANSITION = { duration: 0.2, ease: 'easeOut' } as const;

/**
 * The wall layout: a grid that fills the screen without scrolling (WEB-10),
 * with each card in its own error boundary (WEB-9). Tapping an expandable
 * card opens it full screen.
 */
export function WallGrid({
  cards,
}: {
  readonly cards: readonly WallCardSpec[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const openCard = cards.find((card) => card.id === openId);

  return (
    <>
      <main
        inert={openCard !== undefined}
        className="grid h-dvh grid-cols-3 grid-rows-3 gap-6 overflow-hidden p-6"
      >
        <h1 className="sr-only">HomeHub</h1>
        {cards.map((card) => (
          <WallCard
            key={card.id}
            card={card}
            onOpen={(opener) => {
              openerRef.current = opener;
              setOpenId(card.id);
            }}
          />
        ))}
      </main>
      <AnimatePresence
        onExitComplete={() => {
          openerRef.current?.focus();
        }}
      >
        {openCard !== undefined && (
          <FullScreenCard
            key={openCard.id}
            card={openCard}
            onClose={() => {
              setOpenId(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface WallCardProps {
  readonly card: WallCardSpec;
  readonly onOpen: (opener: HTMLButtonElement) => void;
}

/** A card in its own error boundary, so one that throws leaves the rest up. */
function WallCard({ card, onOpen }: WallCardProps) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <CardFallback
          card={card}
          onRetry={() => {
            resetErrorBoundary();
          }}
        />
      )}
    >
      <CardFace card={card} onOpen={onOpen} />
    </ErrorBoundary>
  );
}

function CardFace({ card, onOpen }: WallCardProps) {
  const titleId = useId();
  const { Content } = card;
  return (
    <section
      aria-labelledby={titleId}
      className={`${CARD_FRAME} ${card.placement}`}
    >
      <h2 id={titleId} className="text-4xl font-semibold">
        {card.title}
      </h2>
      <Content />
      {card.isExpandable && (
        // Covers the card, so a tap anywhere on it opens the card. It shows
        // focus inside the card, where overflow-hidden can't clip it.
        <button
          type="button"
          aria-labelledby={titleId}
          onClick={(event) => {
            onOpen(event.currentTarget);
          }}
          className={`absolute inset-0 rounded-3xl ${FOCUS_RING} focus-visible:-outline-offset-4`}
        />
      )}
    </section>
  );
}

interface CardFallbackProps {
  readonly card: WallCardSpec;
  readonly onRetry: () => void;
}

/** Stands in for a card that threw while rendering; the other cards stay up. */
function CardFallback({ card, onRetry }: CardFallbackProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={`${CARD_FRAME} ${card.placement}`}
    >
      <h2 id={titleId} className="text-4xl font-semibold">
        {card.title}
      </h2>
      <p className="text-2xl text-text-muted">This card stopped working.</p>
      <button
        type="button"
        onClick={onRetry}
        className={`${WALL_BUTTON} self-start`}
      >
        Try again
      </button>
    </section>
  );
}

interface FullScreenCardProps {
  readonly card: WallCardSpec;
  readonly onClose: () => void;
}

function FullScreenCard({ card, onClose }: FullScreenCardProps) {
  const titleId = useId();
  const { Content } = card;
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // Focusable, so Escape still reaches it after a click on its background.
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      initial={HIDDEN}
      animate={SHOWN}
      exit={HIDDEN}
      transition={TRANSITION}
      className="fixed inset-0 flex flex-col gap-8 bg-surface p-12 select-none"
    >
      <div className="flex items-center justify-between gap-8">
        <h2 id={titleId} className="text-6xl font-semibold">
          {card.title}
        </h2>
        <div className="flex items-center gap-6 text-2xl">
          <OfflineBadge />
          <button
            type="button"
            ref={focusOnMount}
            onClick={onClose}
            className={WALL_BUTTON}
          >
            Close
          </button>
        </div>
      </div>
      <ErrorBoundary
        fallback={
          <p className="text-3xl text-text-muted">
            This view stopped working. Close it and try again.
          </p>
        }
      >
        <Content />
      </ErrorBoundary>
    </motion.div>
  );
}

/** Moves focus into the full-screen view as it opens (WAI-ARIA dialog pattern). */
function focusOnMount(element: HTMLElement | null): void {
  element?.focus();
}
