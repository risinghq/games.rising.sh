// The ordered list of sim modules. Hook order is list order: weather rolls the day first, economy before the
// slices, then story and events last so beats and the director see the day's fresh state. game.js additionally
// runs the beat runner and the director after every module's dayStart/tick.
// Slices replace their own files; nobody needs to edit this list.
import * as weather from './weather.js';
import * as economy from './economy.js';
import * as patch from './patch.js';
import * as genetics from './genetics.js';
import * as giant from './giant.js';
import * as season from './season.js';
import * as weighoff from './weighoff.js';
import * as winter from './winter.js';
// the growing-year tracks (plan §6.0): stubs from the foundation, filled by their owners. After the slices, so they see
// the day's growth; before story and events, so beats, the moments queue and the director see what they did.
import * as firsts from './firsts.js';
import * as mischief from './mischief.js';
import * as pokes from './pokes.js';
import * as crawl from './crawl.js';
import * as story from './story.js';
import * as events from './events.js';
import type { SimModule } from './types.js';

// Namespaces by id, for ctx.mod(id) (named helper exports such as economy.has or events.isActive).
export const NS = { weather, economy, patch, genetics, giant, season, weighoff, winter, firsts, mischief, pokes, crawl, story, events };
export const MODULES: readonly SimModule[] = Object.values(NS).map((ns) => ns.default);
for (const [id, ns] of Object.entries(NS)) if (ns.default.id !== id) throw new Error(`modules: ${id} exports id ${ns.default.id}`);
export default MODULES;
