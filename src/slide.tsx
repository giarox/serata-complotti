import type { ReactNode } from 'react';
import { Mark } from './ui';
import { Fit } from './fit';
import type { Participant } from './domain';

/**
 * Projector typography (Gianluca's reference, 28 Oct): a header rule — eye — rule with tiny file codes,
 * a sans kicker in brass, statements in white typewriter, people in brass typewriter, sans labels in white,
 * a sans footnote in brass, a closing rule.
 */
export function Head({ left, right, large = false }: { left?: ReactNode; right?: ReactNode; large?: boolean }) {
  return (
    <div className={'pj-head' + (large ? ' large' : '')}>
      <span className="pj-code">{left}</span>
      <i />
      <Mark large={large} />
      <i />
      <span className="pj-code">{right}</span>
    </div>
  );
}
export const Rule = () => <div className="pj-rule" aria-hidden="true" />;
export const Kicker = ({ children }: { children: ReactNode }) => <p className="pj-kicker">{children}</p>;
export const Label = ({ children }: { children: ReactNode }) => <p className="pj-label">{children}</p>;

/** Who is on stage, in the order the host announces them: title, speaker, co-speaker. */
export function OnStage({ p, label = 'Relatore' }: { p: Participant; label?: string }) {
  const co = p.partner === 'copresenter' && p.partnerName ? p.partnerName : '';
  return (
    <>
      {p.role && <Fit className="pj-role">{p.role}</Fit>}
      <Label>{label}</Label>
      <Fit as="h1" className="pj-name" lines={co ? 1 : 2} min={0.45}>
        {p.name}
      </Fit>
      {co && (
        <>
          <Label>&amp; co-relatore</Label>
          <Fit className="pj-co-name" lines={1} min={0.45}>
            {co}
          </Fit>
        </>
      )}
    </>
  );
}
