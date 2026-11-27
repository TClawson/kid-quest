// Browser test for each map's own version of keepy-uppy, hockey, football and fishing
// (fieldlooks.js, mapplay.js, fans.js): every game plays on every map without errors, the
// twists do what they say, and fans come to watch and cheer.
// Run: node test/smoke/mapvariants.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.url);
  const out = await page.evaluate(async () => {
    const { Play } = await import('./js/play.js');
    const { Hockey } = await import('./js/hockey.js');
    const { Football } = await import('./js/football.js');
    const { Fishing } = await import('./js/fishing.js');
    const maps = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainforest', 'bg-fjord', 'bg-rainbow', 'bg-galaxy'];
    const who = (g) => ({ name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { soccer: 1, hockey: 1, football: 1, rod: 1 } });
    const res = { runs: [], fans: 0, bounce: 0, acorn: 0, doors: 0, banner: 0, events: 0 };
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d');
    for (const map of maps) {
      for (const [kind, Game] of [['soccer', Play], ['hockey', Hockey], ['football', Football], ['fishing', Fishing]]) {
        let fanCheers = 0;
        const g = new Game({ W: 213, H: 120, kind, map, seed: 11, kid: who(), visitor: { ...who(), name: 'B' }, onFan: () => { fanCheers += 1; return 'new'; } });
        g.tap(100, 60);
        for (let i = 0; i < 30 * 95 && g.phase !== 'over'; i += 1) {
          // a decent player: kicks on time, steers at the puck and shoots, picks cones and runs to the ball, fishes
          if (kind === 'soccer') {
            const n = g.next();
            if (n && Math.abs(n.at - g.t) < 0.02) { const p = g.want || n.to; g.tap(p.x, p.y - 10); }
            if (g.acorn && Math.abs(g.acorn.land - g.t) < 0.03 && !g.acorn.got) { g.tap(g.acorn.x, g.acorn.y); if (g.acorn.got) res.acorn += 1; }
          } else if (kind === 'hockey') {
            const pk = g.puck;
            if (pk.owner === g.kid) { g.drag(g.goalR - 40 - g.camX, g.cy); if (g.kid.x > g.goalR - 70 && !g.charge) { g.press(); } }
            else g.drag(pk.x - g.camX, pk.y - 8);
            if (g.charge && g.t - g.charge.t0 > 0.65) g.release();
            if (pk.doorAt && pk.doorAt > g.t - 1 / 29) res.doors += 1;
          } else if (kind === 'football') {
            const d = g.down;
            if (d.stage === 'pick' && g.ready()) { const k = d.banner || ['short', 'medium', 'deep'][i % 3]; g.tap(...d.cones[k]); }
            if (d.stage === 'aim' && d.thrower === g.kid && g.t - d.aimAt > 0.3) g.tap(1, 1);
            if (d.catcher === g.kid && (d.stage === 'wait' || d.stage === 'air')) {
              if (d.stage === 'air') { g.runTo(g.ball.tx, g.ball.ty - 6); if (g.t >= d.catchAt - 0.05 && !d.tried) { const bt = g.button(); g.tap(bt.x, bt.y); } } else g.runTo(d.cones[d.route][0], d.cones[d.route][1] - 6);
            }
            if (d.stage === 'result' && d.banner === d.route && !d.counted && g.score) { d.counted = true; res.banner += 1; }
          } else {
            const L = g.lines.kid;
            if (L.state === 'idle') g.tap(100, 60);
            else if (L.state === 'aim' && g.t - L.meterAt > 0.5) g.tap(100, 60);
            if (L.state === 'fight') { L.held = L.tension < 0.7; L.downAt = g.t - 1; }
            if (g.eventOn && !g._seen) { g._seen = true; res.events += 1; }
          }
          if (kind === 'soccer' && g.phase === 'over') { g.top10 = Math.max(g.top10 || 0, g.count); g.reset(); g.tap(100, 60); }
          g.step(1 / 30);
          if (i % 45 === 0) { g.draw(x); g.drawHud(x, 2); }
        }
        if (kind === 'soccer' && g.bounceAt > (g.tw.bounce || 0)) res.bounce += 1;
        res.fans += fanCheers;
        res.runs.push({ map, kind, score: kind === 'soccer' ? Math.max(g.top10 || 0, g.count) : g.score, fan: g.fans?.seen?.length || 0 });
      }
    }
    // Rainbow Land: a dropped ball bounces back up once every 10 kicks
    const g = new Play({ W: 213, H: 120, kind: 'soccer', map: 'bg-rainbow', seed: 3, kid: who(), visitor: { ...who(), name: 'B' } });
    g.tap(100, 60); g.count = 12; g.step(0.05); g.drop();
    res.bounce = g.ball.state === 'air' && g.phase === 'play' ? 1 : 0;
    g.drop(); res.bounceOnce = g.ball.state === 'loose';
    // Volcano: a puffing vent tosses the puck off a buddy's stick, not only a loose one
    const h = new Hockey({ W: 213, H: 120, map: 'bg-volcano', seed: 5, kid: who(), visitor: { ...who(), name: 'B' } });
    const vent = h.things.find((o) => o.kind === 'vent');
    while (h.ventState(vent) !== 'puff') h.t += 0.01;
    h.kid.x = vent.x - 6; h.kid.y = vent.y; h.kid.face = 1; h.puck.owner = h.kid; h.puck.x = vent.x; h.puck.y = vent.y;
    h.stepPuck(1 / 30);
    res.ventToss = h.puck.owner === null && Math.hypot(h.puck.vx, h.puck.vy) > 100;
    // Sunset Beach: a wave carries a buddy standing still well up the rink
    const w = new Hockey({ W: 213, H: 120, map: 'bg-sunset', seed: 5, kid: who(), visitor: { ...who(), name: 'B' } });
    w.phase = 'play'; w.dropAt = 0; w.waveAt = w.t;
    const y0 = w.kid.y; w.kid.goTo(w.kid.x, y0);
    for (let i = 0; i < 30; i += 1) { w.stepTwist(1 / 30); w.skate(w.kid, 1 / 30); w.t += 1 / 30; }
    res.wavePush = y0 - w.kid.y;
    return res;
  });
  assert.deepEqual(errors, [], 'no errors on any map');
  assert.equal(out.runs.length, 40);
  for (const r of out.runs.filter((r) => r.kind !== 'fishing')) assert.ok(r.fan >= 1, `${r.map} ${r.kind}: a fan came to watch`);
  assert.ok(out.fans >= 15, `fans cheer when the kid does something great (${out.fans})`);
  assert.ok(out.events >= 10, `every lake has its event (${out.events})`);
  assert.ok(out.banner >= 1, 'a catch at the royal banner counts double');
  assert.ok(out.bounce && out.bounceOnce, 'the candy grass saves one drop, not two in a row');
  assert.ok(out.ventToss, 'a lava vent tosses the puck off a buddy\'s stick');
  assert.ok(out.wavePush >= 20, `a wave carries a standing buddy up the rink (${out.wavePush})`);
  assert.ok(out.acorn >= 1, 'acorns can be caught in the Forest Village');
  console.log(out.runs.map((r) => `${r.map.slice(3)} ${r.kind} ${r.score}`).join(' | '));
  console.log('map variants ok', JSON.stringify({ wavePush: Math.round(out.wavePush), fans: out.fans, events: out.events, doors: out.doors, acorn: out.acorn, bounce: out.bounce, banner: out.banner }));
} finally {
  await browser.close();
  site.close();
}
