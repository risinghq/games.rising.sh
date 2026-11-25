// Boot: URL params, the renderer (src/render/index.js, or the dev stub with ?render=stub), the UI app, then the title
// screen, a quick new farm (?new) or a bot jump (?jump=y1-oct3). Exposes window.qsc for Playwright scripts.
//   ?seed=123  deterministic new game      ?new        skip the title (quick new farm)
//   ?jump=y1-oct3  headless bot to a target, then hand over      ?speed=4  start at a speed
//   ?debug     overlay (phase, clock, events, FPS)      ?mute  no sound      ?render=stub  the dev test renderer
import { createApp, loadSettings } from './ui/app.js';
import { jumpTo } from './sim/bots.js';

const q = new URLSearchParams(location.search);
const params = {
  seed: q.has('seed') ? (+q.get('seed') >>> 0) || 1 : undefined,
  new: q.has('new'), jump: q.get('jump') || null, speed: q.get('speed'), debug: q.has('debug'), mute: q.has('mute'),
  render: q.get('render') || 'game',
};
const settings = loadSettings();
if (params.mute) settings.sound = false;            // for this session only
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const phone = touch && Math.min(innerWidth, innerHeight) < 820;
if (touch) document.body.classList.add('touch');

async function makeRenderer() {
  const container = document.getElementById('stage');
  const stub = async () => (await import('../dev/stub-render.js')).createRenderer({ container, phone, settings });
  if (params.render === 'stub') return stub();
  try {
    return await (await import('./render/index.js')).createRenderer({ container, phone, settings });
  } catch (e) {
    // The real renderer is still being written in parallel; keep the UI testable rather than showing a blank page.
    console.error('Quarter Sun Cove: the renderer failed to start, using the dev stub renderer instead.', e);
    container.innerHTML = '';
    return stub();
  }
}

const R = await makeRenderer();
const app = createApp({ R, settings, params });
window.qsc = {
  app, api: app.api, R, jumpTo,
  get game() { return app.game; },
  get s() { return app.game?.s; },
  dispatch: (a) => app.api.dispatch(a),
  advanceDays: (n = 1) => app.game?.advanceDays(n),
  advanceTicks: (n = 1) => app.game?.advanceTicks(n),
  setSpeed: (speed) => app.api.dispatch({ type: 'clock/speed', speed }),
  // run the balanced bot to a target ('y1-aug1', 'y1-weighoff', ...) and hand over
  jump(target) { if (!app.game) app.startNow(); jumpTo(app.game.s, target); return app.game.s.clock; },
};
if (params.jump || params.new) app.startNow();
else app.showTitleScreen();
app.start();
