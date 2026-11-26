// Decision cards (design §12): a centred modal that pauses the clock (the sim blocks while s.story.cards is not
// empty). Slices register builders by kind; anything else uses the generic builder over the card data convention
// { eyebrow?, title, text, speaker?, choices: [{ id, label, sub, primary }] }.
import { el, need } from './dom.js';
import { REG } from './registry.js';
import { portraitEl } from './dialog.js';
import type { Card, State } from '../sim/types.js';
import type { Api } from './types.js';

export function genericCard(box: HTMLElement, s: State, card: Card, api: Api) {
  const d = card.data;
  const head = el('div.head', {}, d.speaker ? portraitEl(api, d.speaker, s) : null,
    el('div', {}, d.eyebrow ? el('div.eyebrow', { text: d.eyebrow }) : null, el('h2', { text: d.title || 'A decision' })));
  box.append(head);
  if (d.text) box.append(el('p', { text: d.text }));
  const choices: typeof d.choices = d.choices.length ? d.choices : [{ id: 'ok', label: 'OK' }];
  box.append(el('div.choices', {}, choices.map((ch) => el('button.choice', {
    class: ch.primary ? 'primary' : null,
    onclick: () => api.dispatch({ type: 'card/answer', id: card.id, choice: ch.id }),
  }, el('b', { text: ch.label }), ch.sub ? el('span', { text: ch.sub }) : null))));
}

export function createCards(api: Api) {
  const root = need('#cards');
  let shown: string|null = null;
  function hide() { root.classList.remove('on'); root.innerHTML = ''; shown = null; }
  function show(card: Card, s: State) {
    root.innerHTML = '';
    const box = el('div.decision', { role: 'dialog', 'aria-modal': 'true' });
    (REG.cards.get(card.kind)?.build || genericCard)(box, s, card, api);
    root.append(box);
    root.classList.add('on');
    shown = card.id;
    api.sound('pop'); api.haptic(12);
    box.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
  return {
    sync(s: State) {
      const head = s?.story.cards[0];
      if (!head) { if (shown) hide(); return; }
      if (head.id !== shown) show(head, s);
    },
    hide,
    get open() { return !!shown; },
  };
}

// A yes/no confirm in the same modal style (api.confirm). Resolves true/false.
export function confirmModal(text: string, { yes = 'Yes', no = 'Not now', title = 'Are you sure?' }: { yes?: string; no?: string; title?: string } = {}) {
  const root = need('#cards');
  return new Promise<boolean>((resolve) => {
    const prev = [...root.childNodes], wasOn = root.classList.contains('on');
    const done = (v: boolean) => { box.remove(); prev.forEach((n) => root.append(n)); root.classList.toggle('on', wasOn); resolve(v); };
    const box = el('div.decision', { role: 'alertdialog', 'aria-modal': 'true' },
      el('div.head', {}, el('div', {}, el('h2', { text: title }))), el('p', { text }),
      el('div.choices', {}, el('button.choice.primary', { onclick: () => done(true) }, el('b', { text: yes })),
        el('button.choice', { onclick: () => done(false) }, el('b', { text: no }))));
    prev.forEach((n) => n.remove());
    root.append(box);
    root.classList.add('on');
    box.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  });
}
