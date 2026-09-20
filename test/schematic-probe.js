/* Dump schematicModel() for a saved layout, headless.
 *
 *   node test/schematic-probe.js <layout.json>
 *
 * Same lift as export-classic.js: the model region is taken verbatim out of
 * the app, so what is probed here cannot drift from what the app runs.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const target = process.argv[2];
if (!target) { console.error('usage: node test/schematic-probe.js <layout.json>'); process.exit(2); }

const html = fs.readFileSync(path.join(__dirname, '..', 'copper-bottom.html'), 'utf8');
const model = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if (!model) { console.error('could not find the #region model markers'); process.exit(2); }

const layout = JSON.parse(fs.readFileSync(target, 'utf8'));
const ctx = vm.createContext({ console, layout, out: {} });
vm.runInContext(model[1] + `
S = migrate(layout);
computeNets();
out.m = schematicModel();
out.name = S.name;
`, ctx, { filename: 'model+schematicModel' });

const m = ctx.out.m;
const railName = k => m.rails[k] ? m.rails[k].name : '-';
console.log('\n=== ' + ctx.out.name + ' ===');
console.log('rails   +:' + railName('pos') + '   -:' + railName('neg') + '   gnd:' + railName('gnd'));
console.log('columns ' + m.nodes.length + '   lanes ' + m.lanes + '   devices ' + m.devices.length);
console.log('\nnode lines, left to right:');
console.log('   ' + m.nodes.map((n, i) => i + ':' + n.name).join('  '));

const by = {};
for (const p of m.devices) (by[p.shape] = by[p.shape] || []).push(p);
console.log('\nplacement:');
for (const shape of ['block', 'series', 'shunt', 'across']) {
  for (const p of (by[shape] || [])) {
    const d = p.dev;
    const legs = d.legs.map(l => l.name + '>' + (l.net ? l.net.name : 'OPEN')).join(' ');
    console.log('   ' + shape.padEnd(7) + ' lane' + String(p.lane).padEnd(3) +
                ' cols ' + (p.from === p.to ? String(p.from) : p.from + '-' + p.to).padEnd(6) +
                (p.rails.length ? '[' + p.rails.join(',') + '] ' : '') +
                d.ref.padEnd(5) + ' ' + legs);
  }
}
const open = m.devices.filter(p => p.open);
if (open.length) console.log('\nlegs on no net: ' + open.map(p => p.dev.ref).join(' '));
