import { describe, expect, it } from 'vitest';

// Fails on purpose: its pull request proves that a failing unit test blocks
// the merge (build-plan step 1.7), and never merges.
describe('the merge gate', () => {
  it('blocks a pull request whose unit test fails', () => {
    expect(1 + 1).toBe(3);
  });
});
