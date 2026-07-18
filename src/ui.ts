import type { DisplayState } from './decide';
import type { WidgetConfig } from './config';
import { formatString } from './strings';

/**
 * Shadow-DOM rendering. The host page and the widget can't leak styles into
 * each other. Styles go in via adoptedStyleSheets (immune to style-src CSP)
 * with a <style> element fallback.
 *
 * Full-color card per locked design: background in the severity color.
 * Contrast (WCAG AA, verified): #c62828/#fff 5.6:1, #c2410c/#fff 5.2:1,
 * #f9a825/#111827 8.7:1, #1565c0/#fff 5.7:1.
 */
const CSS = `
:host { all: initial; }
.aqsw {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  display: none;
  max-width: 420px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.aqsw.pos-bottom-right { right: calc(20px + env(safe-area-inset-right, 0px)); }
.aqsw.pos-bottom-left { left: calc(20px + env(safe-area-inset-left, 0px)); }
.aqsw.visible { display: block; animation: aqsw-in 0.25s ease-out; }
@keyframes aqsw-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .aqsw.visible { animation: none; }
}
.card {
  position: relative;
  border-radius: 14px;
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}
.kind-critical { --bg: #c62828; --fg: #ffffff; }
.kind-warning { --bg: #c2410c; --fg: #ffffff; }
.kind-minor { --bg: #f9a825; --fg: #111827; }
.kind-maintenance { --bg: #1565c0; --fg: #ffffff; }
.main {
  display: block;
  padding: 22px 60px 22px 24px;
  color: inherit;
  text-decoration: none;
}
a.main { cursor: pointer; }
a.main:focus-visible { outline: 2px solid var(--fg); outline-offset: -4px; border-radius: 14px; }
.headline { display: block; font-size: 18px; font-weight: 700; line-height: 1.3; }
.body { display: block; font-size: 15px; line-height: 1.5; margin-top: 8px; opacity: 0.95; overflow-wrap: anywhere; }
.detail { display: block; font-size: 15px; line-height: 1.5; margin-top: 4px; opacity: 0.95; }
.more { display: block; font-size: 14px; margin-top: 8px; opacity: 0.85; }
.cta { display: block; font-size: 15px; font-weight: 600; margin-top: 14px; text-decoration: underline; text-underline-offset: 3px; }
.close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
}
.close:hover { opacity: 1; background: rgba(0, 0, 0, 0.18); }
.close:focus-visible { opacity: 1; outline: 2px solid currentColor; outline-offset: -2px; }
@media (max-width: 480px) {
  .aqsw {
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    max-width: none;
  }
}
`;

export class WidgetUI {
  private readonly host: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private lastKey: string | null = null;
  private escListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly cfg: WidgetConfig,
    private readonly onDismiss: () => void,
  ) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-allquiet-status-widget', '');
    const root = this.host.attachShadow({ mode: 'open' });

    let styled = false;
    try {
      if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
        styled = true;
      }
    } catch {
      // Older engines: fall through to <style>.
    }
    if (!styled) {
      const style = document.createElement('style');
      style.textContent = CSS;
      root.appendChild(style);
    }

    this.container = document.createElement('div');
    this.container.className = `aqsw pos-${cfg.position}`;
    this.container.style.zIndex = String(cfg.zIndex);
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    root.appendChild(this.container);
    document.body.appendChild(this.host);
  }

  render(state: DisplayState | null): void {
    const key = state === null ? null : JSON.stringify(state);
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.container.textContent = '';
    if (state === null) {
      this.container.classList.remove('visible');
      this.unbindEsc();
      return;
    }

    this.container.appendChild(this.buildCard(state));
    this.container.classList.add('visible');
    this.bindEsc();
  }

  destroy(): void {
    this.unbindEsc();
    this.host.remove();
  }

  private buildCard(state: DisplayState): HTMLDivElement {
    const card = document.createElement('div');
    card.className = `card kind-${state.kind}`;

    const main = document.createElement(state.linkUrl ? 'a' : 'div');
    main.className = 'main';
    if (state.linkUrl && main instanceof HTMLAnchorElement) {
      main.href = state.linkUrl;
      main.target = '_blank';
      main.rel = 'noopener noreferrer';
    }

    main.appendChild(this.span('headline', state.headline));
    if (state.body !== '') main.appendChild(this.span('body', state.body));
    if (state.detail !== null) main.appendChild(this.span('detail', state.detail));
    if (state.moreCount > 0) {
      main.appendChild(this.span('more', formatString(this.cfg.strings.more, { n: state.moreCount })));
    }
    if (state.linkUrl) {
      const cta = this.span('cta', this.cfg.strings.viewStatusPage);
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = ' →';
      cta.appendChild(arrow);
      main.appendChild(cta);
    }
    card.appendChild(main);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.setAttribute('aria-label', this.cfg.strings.dismiss);
    close.textContent = '✕';
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onDismiss();
    });
    card.appendChild(close);

    return card;
  }

  private span(className: string, text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }

  private bindEsc(): void {
    if (this.escListener) return;
    this.escListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.onDismiss();
    };
    document.addEventListener('keydown', this.escListener);
  }

  private unbindEsc(): void {
    if (!this.escListener) return;
    document.removeEventListener('keydown', this.escListener);
    this.escListener = null;
  }
}
