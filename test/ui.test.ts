import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WidgetUI } from '../src/ui';
import { normalizeOptions } from '../src/config';
import type { DisplayState } from '../src/decide';

function makeState(overrides: Partial<DisplayState> = {}): DisplayState {
  return {
    kind: 'critical',
    headline: 'Major outage',
    body: 'Login unavailable',
    detail: null,
    moreCount: 1,
    linkUrl: 'https://allquiet.eu/status/pixelunion',
    ids: ['i-1', 'i-2'],
    ...overrides,
  };
}

describe('WidgetUI', () => {
  let ui: WidgetUI | null = null;
  let dismissed: number;
  const cfg = normalizeOptions({ statusUrl: 'https://x/status.json' })!;

  beforeEach(() => {
    dismissed = 0;
  });

  afterEach(() => {
    ui?.destroy();
    ui = null;
  });

  function host(): HTMLElement {
    return document.querySelector('[data-allquiet-status-widget]') as HTMLElement;
  }

  function shadow(): ShadowRoot {
    return host().shadowRoot!;
  }

  it('mounts a shadow host and stays hidden until rendered', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    expect(host()).not.toBeNull();
    expect(shadow().querySelector('.aqsw')!.classList.contains('visible')).toBe(false);
  });

  it('renders a full-color card with headline, body, +N more and status link', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    ui.render(makeState());

    const container = shadow().querySelector('.aqsw')!;
    expect(container.classList.contains('visible')).toBe(true);
    expect(container.getAttribute('role')).toBe('status');
    expect(container.getAttribute('aria-live')).toBe('polite');

    const card = container.querySelector('.card')!;
    expect(card.classList.contains('kind-critical')).toBe(true);
    expect(card.querySelector('.headline')!.textContent).toBe('Major outage');
    expect(card.querySelector('.body')!.textContent).toBe('Login unavailable');
    expect(card.querySelector('.more')!.textContent).toBe('+1 more');

    const link = card.querySelector('a.main') as HTMLAnchorElement;
    expect(link.href).toBe('https://allquiet.eu/status/pixelunion');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('renders maintenance detail text and position class', () => {
    const leftCfg = normalizeOptions({ statusUrl: 'https://x', position: 'bottom-left' })!;
    ui = new WidgetUI(leftCfg, () => dismissed++);
    ui.render(
      makeState({ kind: 'maintenance', detail: 'Starts in 30 min', moreCount: 0 }),
    );
    expect(shadow().querySelector('.aqsw')!.classList.contains('pos-bottom-left')).toBe(true);
    expect(shadow().querySelector('.card')!.classList.contains('kind-maintenance')).toBe(true);
    expect(shadow().querySelector('.detail')!.textContent).toBe('Starts in 30 min');
  });

  it('renders a non-link card when no status page URL exists', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    ui.render(makeState({ linkUrl: null }));
    expect(shadow().querySelector('a.main')).toBeNull();
    expect(shadow().querySelector('div.main')).not.toBeNull();
    expect(shadow().querySelector('.cta')).toBeNull();
  });

  it('dismisses via the close button', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    ui.render(makeState());
    (shadow().querySelector('.close') as HTMLButtonElement).click();
    expect(dismissed).toBe(1);
  });

  it('dismisses via Escape only while visible', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });

    document.dispatchEvent(esc);
    expect(dismissed).toBe(0);

    ui.render(makeState());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissed).toBe(1);

    ui.render(null);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissed).toBe(1);
  });

  it('hides on render(null)', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    ui.render(makeState());
    ui.render(null);
    const container = shadow().querySelector('.aqsw')!;
    expect(container.classList.contains('visible')).toBe(false);
    expect(container.querySelector('.card')).toBeNull();
  });

  it('does not rebuild the DOM when the state is unchanged (focus preservation)', () => {
    ui = new WidgetUI(cfg, () => dismissed++);
    ui.render(makeState());
    const firstCard = shadow().querySelector('.card');
    ui.render(makeState());
    expect(shadow().querySelector('.card')).toBe(firstCard);
    ui.render(makeState({ body: 'Changed' }));
    expect(shadow().querySelector('.card')).not.toBe(firstCard);
  });

  it('removes everything on destroy', () => {
    const localUi = new WidgetUI(cfg, () => dismissed++);
    localUi.render(makeState());
    localUi.destroy();
    expect(document.querySelector('[data-allquiet-status-widget]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissed).toBe(0);
  });
});
