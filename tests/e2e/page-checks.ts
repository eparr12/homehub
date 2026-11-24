import { AxeBuilder } from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

/** How far a page overflows its viewport, in CSS pixels. */
export interface Overflow {
  readonly x: number;
  readonly y: number;
}

/** An axe violation, cut down to what a failure message needs. */
export interface Violation {
  readonly id: string;
  readonly help: string;
  readonly targets: readonly unknown[];
}

/** How far the page can scroll each way: 0 by 0 when it can't (WEB-10). */
export async function readOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const { scrollWidth, scrollHeight, clientWidth, clientHeight } =
      document.documentElement;
    return { x: scrollWidth - clientWidth, y: scrollHeight - clientHeight };
  });
}

/**
 * The named targets smaller than minPx in either direction, each with its
 * size as drawn, transforms included (WEB-7). Empty when every one is big
 * enough.
 */
export async function findSmallTargets(
  targets: Readonly<Record<string, Locator>>,
  minPx: number,
): Promise<string[]> {
  const measured = await Promise.all(
    Object.entries(targets).map(async ([name, target]) => ({
      name,
      box: await target.boundingBox(),
    })),
  );
  return measured.flatMap(({ name, box }) => {
    if (box === null) return [`${name}: not drawn`];
    if (box.width >= minPx && box.height >= minPx) return [];
    return [`${name}: ${String(box.width)} by ${String(box.height)}`];
  });
}

/**
 * axe's violations on the page as it is now, under the server's real
 * Content Security Policy. Only violations: axe lists what it can't decide,
 * such as text under a button that covers it, as incomplete, and
 * themes.test.ts checks every color pair the UI draws (WEB-6).
 */
export async function findViolations(page: Page): Promise<Violation[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.map(({ id, help, nodes }) => ({
    id,
    help,
    targets: nodes.map(({ target }) => target),
  }));
}
