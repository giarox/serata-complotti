import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';

/** A worn ink stamp; decorative only. */
export function Stamp({ children, sub, className = '' }: { children: ReactNode; sub?: string; className?: string }) {
  return (
    <span className={'stamp ' + className} aria-hidden="true">
      {children}
      {sub && <small>{sub}</small>}
    </span>
  );
}

/** The eye in the triangle. */
export function Mark({ large = false }: { large?: boolean }) {
  return (
    <div className={'mark ' + (large ? 'large' : '')}>
      <Eye strokeWidth={1.3} />
    </div>
  );
}

export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type={rest.type ?? 'button'}
      {...rest}
      disabled={disabled}
      onClick={onClick}
      className={'button ' + (secondary ? 'secondary ' : '') + (rest.className ?? '')}
    >
      {children}
    </button>
  );
}

/** First word of a full name, for friendly greetings. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
