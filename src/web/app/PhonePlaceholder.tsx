import type { ReactNode } from 'react';

interface PhonePlaceholderProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** A phone view that a later build-plan phase fills in. */
export function PhonePlaceholder({ title, children }: PhonePlaceholderProps) {
  return (
    <>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-text-muted">{children}</p>
    </>
  );
}
