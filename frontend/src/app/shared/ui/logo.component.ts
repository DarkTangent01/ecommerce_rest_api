import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * AeroScript mark and wordmark. The mark is a delta wing that doubles as an "A". Decorative: the
 * wordmark text carries the accessible name, so screen readers hear "AeroScript".
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.inverse]': "tone() === 'inverse'", '[class.compact]': 'compact()' },
  template: `
    <svg class="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" class="tile" />
      <path d="M16 5.5 26 25.5 16 20.6 6 25.5Z" class="wing" />
      <path d="M16 5.5 16 20.6 6 25.5Z" class="wing-shade" />
      <path d="M11.2 17.8h9.6" class="bar" />
    </svg>
    @if (!compact()) {
      <span class="word"><span class="aero">Aero</span><span class="script">Script</span></span>
    } @else {
      <span class="visually-hidden">AeroScript</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--as-text);
      line-height: 1;
    }
    .tile {
      fill: var(--as-ink-900);
    }
    :host(.inverse) .tile {
      fill: var(--as-brand-600);
    }
    .wing {
      fill: var(--as-flare-500);
    }
    .wing-shade {
      fill: #ffffff;
      opacity: 0.28;
    }
    .bar {
      stroke: var(--as-ink-900);
      stroke-width: 1.6;
      stroke-linecap: round;
    }
    .word {
      font-family: var(--as-font-display);
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
    }
    .script {
      color: var(--as-brand-600);
    }
    :host(.inverse) {
      color: var(--as-text-inverse);
    }
    :host(.inverse) .script {
      color: var(--as-flare-500);
    }
  `,
})
export class LogoComponent {
  readonly tone = input<'default' | 'inverse'>('default');
  readonly compact = input(false);
}
