import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts after each test on its own only when Vitest's
// globals are on, and they're off here (TEST-8).
afterEach(() => {
  cleanup();
});
