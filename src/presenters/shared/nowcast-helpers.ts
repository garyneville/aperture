import type { NowcastSignal } from '../../contracts/index.js';

export function nowcastBadgeText(signal: NowcastSignal | null | undefined): string | null {
  if (!signal || signal.direction === 'neutral') return null;

  const verb = signal.direction === 'clearing' ? 'Clearing' : 'Thickening';
  const qualifier = signal.confidence === 'high' ? '' : signal.confidence === 'medium' ? ' (likely)' : ' (possible)';
  return `${verb} vs forecast${qualifier}`;
}

export function nowcastBadgeIcon(signal: NowcastSignal | null | undefined): string | null {
  if (!signal || signal.direction === 'neutral') return null;
  return signal.direction === 'clearing' ? '🌤️' : '☁️';
}

export function nowcastBadgeClass(signal: NowcastSignal | null | undefined): string | null {
  if (!signal || signal.direction === 'neutral') return null;
  return signal.direction === 'clearing' ? 'nowcast-clearing' : 'nowcast-thickening';
}

export function isNowcastSignificant(signal: NowcastSignal | null | undefined): boolean {
  return signal != null && signal.direction !== 'neutral' && signal.magnitude >= 0.15;
}
