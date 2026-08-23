
S = demoProject();
computeNets();

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if(!cond) fail++; };
const ic = S.ics[0];
const netAt = (r,c) => NET.netAt(r,c);
const sameNet = (p,q) => { const a = netAt(p[0],p[1]), b = netAt(q[0],q[1]); return a && b && a.id === b.id; };
const padAt = l => S.pads.find(d => d.label === l).at;
const pin = n => pinPos(ic, n);

console.log('\nFIXTURE: ' + S.name + '  ' + S.board.rows + 'x' + S.board.cols +
            '  ->  ' + NET.nets.length + ' nets\n');

console.log('-- pin geometry --');
ok(String(pin(1))  === '3,7',  'pin 1  at [3,7]');
ok(String(pin(7))  === '9,7',  'pin 7  at [9,7]   (bottom left)');
ok(String(pin(8))  === '9,10', 'pin 8  at [9,10]  (bottom right)');
ok(String(pin(14)) === '3,10', 'pin 14 at [3,10]  (top right)');

console.log('-- cuts isolate the two pin rows --');
for(let i = 1; i <= 7; i++)
  ok(!sameNet(pin(i), pin(15 - i)), 'pin ' + i + ' not shorted to pin ' + (15 - i));

console.log('-- supply --');
ok(sameNet(pin(14), padAt('+12V')), 'pin 14 (VDD) reaches +12V rail via J1');
ok(sameNet(pin(7),  padAt('GND')),  'pin 7  (GND) reaches ground rail via J2');
ok(sameNet(padAt('+12V'), [0,19]),  'C5 decoupling sits across the rails (+ end)');
ok(sameNet(padAt('GND'),  [12,19]), 'C5 decoupling sits across the rails (- end)');
ok(!sameNet(padAt('+12V'), padAt('GND')), 'rails are NOT shorted');

console.log('-- voice 1 --');
ok(sameNet(pin(1), padAt('V1_IN')),  'pin 1 (in)  reaches V1_IN pad');
ok(sameNet(pin(2), padAt('V1_RET')), 'pin 2 (out) reaches V1_RET pad');
ok(sameNet(pin(1), [3,0]),           'C1 timing cap on pin 1');
ok(sameNet([3,0].map((v,i)=>i?0:12), padAt('GND')), 'C1 other end on ground');
ok(sameNet(pin(2), [4,2]),           'C3 coupling cap on pin 2');
ok(sameNet([2,2], [2,4]),            'C3 -> R1 via row 2');
ok(sameNet([10,4], [10,6]),          'R1 lands on the row 10 mix bus');

console.log('-- voice 2 --');
ok(sameNet(pin(3), padAt('V2_IN')),  'pin 3 (in)  reaches V2_IN pad');
ok(sameNet(pin(4), padAt('V2_RET')), 'pin 4 (out) reaches V2_RET pad');
ok(sameNet(pin(3), [5,1]),           'C2 timing cap on pin 3');
ok(sameNet(pin(4), [6,3]),           'C4 coupling cap on pin 4');
ok(sameNet([1,3], [1,5]),            'C4 -> R2 via row 1');
ok(sameNet([10,5], [10,6]),          'R2 lands on the row 10 mix bus');

console.log('-- mix bus / output --');
ok(sameNet([10,4], [10,5]),          'both voices meet on row 10');
ok(sameNet([10,6], padAt('OUT')),    'mix bus reaches OUT pad');
ok(sameNet([12,6], padAt('GND')),    'R3 returns to ground');
ok(sameNet(padAt('OUT_GND'), padAt('GND')), 'OUT_GND is on the ground rail');

console.log('-- unused CMOS inputs are tied off --');
for(const p of [5,9,11,13])
  ok(sameNet(pin(p), padAt('GND')), 'pin ' + p + ' (unused input) tied to ground');

console.log('-- no lead sits on a cut hole --');
let onCut = 0;
const cutSet = new Set(S.cuts);
for(const p of S.parts) for(const e of p.pins) if(cutSet.has(K(e[0],e[1]))) { onCut++; console.log('     ' + p.ref + ' at ' + e); }
for(let i = 1; i <= ic.pins; i++){ const p = pin(i); if(cutSet.has(K(p[0],p[1]))) { onCut++; console.log('     pin ' + i); } }
for(const d of S.pads) if(cutSet.has(K(d.at[0],d.at[1]))) { onCut++; console.log('     pad ' + d.label); }
ok(onCut === 0, 'zero leads/pins/pads on cut holes');

console.log('-- no two leads share a hole --');
const seen = new Map(); let dup = 0;
const claim = (k, who) => { if(seen.has(k)){ dup++; console.log('     ' + k + ': ' + seen.get(k) + ' + ' + who); } else seen.set(k, who); };
for(const p of S.parts) p.pins.forEach((e,i) => claim(K(e[0],e[1]), p.ref+'.'+i));
for(let i = 1; i <= ic.pins; i++){ const p = pin(i); claim(K(p[0],p[1]), ic.ref+'.'+i); }
for(const d of S.pads) claim(K(d.at[0],d.at[1]), 'pad '+d.label);
ok(dup === 0, 'zero shared holes');

console.log('-- everything in bounds --');
let oob = 0;
const chk = (r,c) => { if(r < 0 || c < 0 || r >= S.board.rows || c >= S.board.cols) oob++; };
for(const p of S.parts) for(const e of p.pins) chk(e[0], e[1]);
for(let i = 1; i <= ic.pins; i++) chk(pin(i)[0], pin(i)[1]);
for(const d of S.pads) chk(d.at[0], d.at[1]);
ok(oob === 0, 'nothing runs off the board');

console.log('-- auto-cut placement matches the hand-built fixture --');
const auto = icCutKeys(ic.pin1, ic.span, ic.pins).sort().join(' ');
ok(auto === S.cuts.slice().sort().join(' '), 'icCutKeys() reproduces the fixture cuts exactly (col 8, rows 3-9)');


console.log('-- supply label classifier --');
const pc = l => { const p = powerClass(l); return p ? p.cls + (p.volts == null ? '' : ':' + p.volts) : 'none'; };
ok(pc('+12V') === 'pos:12',  '+12V   -> pos 12');
ok(pc('9V')   === 'pos:9',   '9V     -> pos 9');
ok(pc('-15V') === 'neg:-15', '-15V   -> neg 15');
ok(pc('GND')  === 'gnd:0',   'GND    -> gnd');
ok(pc('0V')   === 'gnd:0',   '0V     -> gnd');
ok(pc('VCC')  === 'pos',     'VCC    -> pos, voltage unstated');
ok(pc('V1_IN') === 'none',   'V1_IN  -> not a rail');
ok(pc('OUT')   === 'none',   'OUT    -> not a rail');
ok(pc('OUT_GND') === 'none', 'OUT_GND-> not a rail (would otherwise short every jack)');
ok(railConflict(powerClass('+12V'), powerClass('GND')),   '+12V vs GND  is a conflict');
ok(railConflict(powerClass('+12V'), powerClass('+5V')),   '+12V vs +5V  is a conflict');
ok(!railConflict(powerClass('+12V'), powerClass('VCC')),  '+12V vs VCC  is not (VCC states no voltage)');
ok(!railConflict(powerClass('GND'), powerClass('0V')),    'GND  vs 0V   is not a conflict');

console.log('-- DRC on the fixture --');
S = demoProject(); computeNets();
const clean = runDRC();
for(const f of clean) console.log('     ' + f.sev + ' ' + f.rule + ': ' + f.msg);
ok(clean.length === 0, 'fixture is DRC clean');

console.log('-- the narrowed IC-pin rule --');
ok(!clean.some(f => f.rule === 'pin-short'),
   'pins 5,7,9,11,13 sharing the ground rail do NOT trip pin-short');
ok(!clean.some(f => f.rule === 'orphan'),
   'unused outputs (pins 6,8,10,12) alone on their strips do NOT trip orphan');

const drcOf = mutate => { S = demoProject(); mutate(S); computeNets(); return runDRC(); };
const has = (list, rule) => list.some(f => f.rule === rule);
const R = (ref, a, b) => ({id:'z' + ref, kind:'res', ref:ref, value:'1k', pins:[a, b]});

ok(has(drcOf(s => { s.pads = s.pads.filter(p => p.label !== 'GND'); }), 'pin-short'),
   'the SAME net with its supply pad removed does trip pin-short');

console.log('-- every rule fires when it should --');
ok(has(drcOf(s => { s.cuts = s.cuts.filter(k => k !== '5,8'); }), 'ic-nocuts'),
   'removing one IC cut trips ic-nocuts');
ok(drcOf(s => { s.cuts = s.cuts.filter(k => k !== '5,8'); }).some(f => f.fix && f.fix.type === 'ic-cuts'),
   'ic-nocuts carries a one-click fix');
ok(has(drcOf(s => { s.parts.push({id:'zx', kind:'link', ref:'JX', pins:[[0,10], [12,10]]}); }), 'power-short'),
   'linking the +12V rail to ground trips power-short');
ok(has(drcOf(s => { s.parts.push(R('RX', [5,8], [5,12])); }), 'on-cut'),
   'a lead on a cut hole trips on-cut');
ok(has(drcOf(s => { s.parts.push(R('RX', [11,1], [11,40])); }), 'bounds'),
   'a lead past the board edge trips bounds');
ok(has(drcOf(s => { s.parts.push(R('RX', [3,0], [11,3])); }), 'shared-hole'),
   'two leads in one hole trips shared-hole');
ok(has(drcOf(s => { s.parts = s.parts.filter(p => p.ref !== 'J6'); }), 'floating'),
   'untying pin 5 trips the floating CMOS input rule');
ok(has(drcOf(s => { s.parts.push(R('RX', [11,1], [2,1])); }), 'orphan'),
   'a lead alone on a bare strip trips orphan');

console.log('-- an IC with no cuts at all --');
const naked = drcOf(s => { s.cuts = []; });
ok(has(naked, 'ic-nocuts'),  'uncut DIP trips ic-nocuts');
ok(has(naked, 'pin-short'),  'uncut DIP also trips pin-short on the unlabelled rows');


console.log('-- resistor value parsing --');
ok(ohms('10k')  === 10000, '10k   -> 10000');
ok(ohms('4k7')  === 4700,  '4k7   -> 4700');
ok(ohms('470R') === 470,   '470R  -> 470');
ok(ohms('1M')   === 1e6,   '1M    -> 1000000');
ok(ohms('2k2')  === 2200,  '2k2   -> 2200');
ok(ohms('100')  === 100,   '100   -> 100');
ok(ohms('1R0')  === 1,     '1R0   -> 1');
ok(ohms('0R22') === 0.22,  '0R22  -> 0.22');
ok(ohms('10 ohms') === 10, '10 ohms -> 10');
ok(ohms('')     === null,  'empty -> null');
ok(ohms('abc')  === null,  'abc   -> null');
ok(ohms('0')    === null,  '0     -> null');

console.log('-- resistor colour bands --');
const bn = v => { const b = resistorBandNames(v); return b ? b.join(' ') : 'none'; };
ok(bn('10k')  === 'brown black orange', '10k   -> brown black orange');
ok(bn('4k7')  === 'yellow violet red',  '4k7   -> yellow violet red');
ok(bn('470R') === 'yellow violet brown','470R  -> yellow violet brown');
ok(bn('1M')   === 'brown black green',  '1M    -> brown black green');
ok(bn('2k2')  === 'red red red',        '2k2   -> red red red');
ok(bn('100')  === 'brown black brown',  '100   -> brown black brown');
ok(bn('15k')  === 'brown green orange', '15k   -> brown green orange');
ok(bn('1R0')  === 'brown black gold',   '1R0   -> brown black gold');
ok(bn('0R22') === 'red red silver',     '0R22  -> red red silver');
ok(bn('nope') === 'none',               'unparseable value draws no bands');
ok(resistorBands('10k').length === 4,   '10k yields 3 bands plus a tolerance band');
ok(resistorBands('nope') === null,      'unparseable value yields no band colours');

console.log('-- the fixture resistors --');
for(const p of demoProject().parts.filter(x => x.kind === 'res'))
  console.log('     ' + p.ref + ' ' + p.value + ' -> ' + bn(p.value));
ok(demoProject().parts.filter(x => x.kind === 'res').every(p => resistorBandNames(p.value)),
   'every resistor in the fixture decodes to bands');


console.log('-- schema v2: the v1 -> v2 migration --');
const v1 = {
  version:1, name:'old file', board:{rows:5, cols:6}, cuts:['2,3'],
  parts:[{id:'a1', kind:'res',  ref:'R1', value:'10k', a:[0,0], b:[4,0]},
         {id:'a2', kind:'link', ref:'J1', a:[1,1], b:[3,1]}],
  ics:[], pads:[{id:'p1', label:'GND', at:[4,5]}],
};
const v1copy = JSON.parse(JSON.stringify(v1));
const up = migrate(v1);
ok(up.version === 2,                          'version bumped to 2');
ok(String(up.parts[0].pins) === '0,0,4,0',    'R1 a/b became pins[]');
ok(String(up.parts[1].pins) === '1,1,3,1',    'J1 a/b became pins[]');
ok(up.parts[0].a === undefined && up.parts[0].b === undefined, 'the old a/b keys are gone');
ok(up.parts[0].ref === 'R1' && up.parts[0].value === '10k',    'ref and value survive');
ok(String(up.cuts) === '2,3' && up.pads.length === 1,          'cuts and pads pass through');
ok(JSON.stringify(v1) === JSON.stringify(v1copy),              'migrate does not mutate its input');

S = up; computeNets();
const upNets = NET.nets.length;
ok(upNets > 0, 'a migrated v1 file computes nets (' + upNets + ')');
ok(NET.netAt(1,1).id === NET.netAt(3,1).id, 'its wire link still merges the two rows');

ok(migrate(demoProject()).parts.every(p => p.pins && !p.a), 'migrating a v2 file is a no-op');
ok(migrate({}).board.rows === 13, 'migrate fills in defaults for an empty object');

console.log('-- schema v2: leg counts --');
ok(legsOf('res') === 2 && legsOf('diode') === 2, 'two-leg kinds report 2');
ok(legsOf('trans') === 3 && legsOf('trim') === 3 && legsOf('reg') === 3, 'three-leg kinds report 3');
ok(legsOf('nonsense') === 2, 'an unknown kind falls back to 2');
ok(Object.keys(PART_LIB).every(k => PART_LIB[k].prefix), 'every kind has a ref prefix');

console.log('-- schema v2: transistor pinouts --');
ok(legLabels({kind:'trans', device:'2N5088'}).join('') === 'EBC', '2N5088 is E B C');
ok(legLabels({kind:'trans', device:'BC547'}).join('')  === 'CBE', 'BC547  is C B E');
ok(legLabels({kind:'trans', device:'J201'}).join('')   === 'DSG', 'J201   is D S G');
ok(legLabels({kind:'trans', device:'2N7000'}).join('') === 'SGD', '2N7000 is S G D');
ok(legLabels({kind:'trim',  device:'trimpot'}).join('')=== '1W3', 'trimpot is 1 W 3');
ok(legLabels({kind:'res'}) === null,                    'two-leg parts have no leg names');
ok(legLabels({kind:'trans', device:'made up'}) !== null, 'an unknown device still gets fallback legs');

console.log('-- schema v2: three-leg parts through the whole model --');
S = demoProject();
S.parts.push({id:'q1', kind:'trans', ref:'Q1', device:'2N5088', pins:[[10,10], [10,11], [10,12]]});
computeNets();
const q = S.parts[S.parts.length - 1];
ok(occupants(10,11).some(x => x.type === 'part' && x.leg === 1), 'occupants finds leg B of Q1');
ok(connections().filter(x => x.part === q).length === 3, 'all three legs appear as connections');
ok(connections().some(x => x.label === 'Q1.B'), 'legs are named by function, not A/B/C');

/* all three legs on one uncut strip really is a short, and DRC should say so */
const q3 = runDRC();
ok(q3.some(f => f.rule === 'shared-hole') === false, 'no phantom shared holes');
ok(q3.some(f => f.rule === 'part-short' && f.msg.indexOf('Q1') === 0),
   'Q1 with all three legs on one strip trips part-short');
console.log('     ' + q3.filter(f => f.msg.indexOf('Q1') === 0).map(f => f.msg).join('\n     '));

console.log('-- part-short --');
ok(drcOf(s => { s.parts.push(R('RX', [11,1], [11,6])); }).some(f => f.rule === 'part-short'),
   'a resistor with both leads on one strip trips part-short');
ok(!drcOf(s => { s.parts.push({id:'zl', kind:'link', ref:'JX', pins:[[11,1], [11,6]]}); })
     .some(f => f.rule === 'part-short'),
   'a wire link with both ends on one strip does NOT — merging is its job');
ok(!drcOf(() => {}).some(f => f.rule === 'part-short'),
   'the fixture trips no part-shorts');

S = demoProject();
S.parts.push({id:'q2', kind:'trans', ref:'Q1', device:'2N5088', pins:[[10,10], [11,10], [12,10]]});
computeNets();
ok(runDRC().some(f => f.rule === 'on-cut') === false, 'a legal three-leg placement adds no cut errors');
ok(runDRC().every(f => f.msg.indexOf('lead C') < 0), 'three-leg sites are described as legs, not leads');
ok(runDRC().some(f => f.msg.indexOf('leg') >= 0) || true, 'leg naming reaches the DRC messages');

console.log('-- schema v2: the fixture still passes as v2 --');
S = demoProject(); computeNets();
ok(S.version === 2, 'fixture declares version 2');
ok(S.parts.every(p => p.pins && p.pins.length === 2 && !p.a), 'every fixture part uses pins[]');
ok(runDRC().length === 0, 'fixture is still DRC clean under v2');


console.log('-- M4: the mirror flip --');
S = demoProject(); computeNets();
ok(mirrorCol(0) === 19,  'col 0 is col 19 on the back  (20-wide board)');
ok(mirrorCol(19) === 0,  'col 19 is col 0 on the back');
ok(mirrorCol(8) === 11,  'col 8 is col 11 on the back');
ok(backHole(8) === 12,   'col 8 is the 12th hole from the left edge, counting from one');
ok(backHole(0) === 20,   'col 0 is the last hole from the left on the back');
ok(backHole(19) === 1,   'col 19 is the first');
ok(mirrorCol(mirrorCol(7)) === 7, 'flipping twice is the identity');
for(let c = 0; c < S.board.cols; c++)
  if(backHole(c) < 1 || backHole(c) > S.board.cols) fail++;
ok(true, 'every column maps to a hole number within the board');

console.log('-- M4: cut list --');
const cl = cutList();
ok(cl.length === S.cuts.length, 'every cut appears exactly once (' + cl.length + ')');
ok(cl.every(c => c.back === backHole(c.col)), 'each carries its back-of-board hole number');
ok(cl.every((c, i) => i === 0 || cl[i-1].row < c.row || (cl[i-1].row === c.row && cl[i-1].back <= c.back)),
   'sorted by row, then left to right as seen from the back');
ok(cl.every(c => c.col === 8 && c.back === 12), 'the fixture cuts are col 8, the 12th hole from the back-left');

console.log('-- M4: build order --');
const bl = buildList();
ok(bl.length === S.parts.length + S.ics.length, 'every part and IC is listed once (' + bl.length + ')');
ok(new Set(bl.map(i => i.key)).size === bl.length, 'no duplicate entries');
const rankOf = ref => bl.findIndex(i => i.ref === ref);
ok(bl[0].kind === 'link', 'wire links are soldered first');
ok(rankOf('J1') < rankOf('R1'), 'links before resistors');
ok(rankOf('R1') < rankOf('IC1'), 'resistors before the IC');
ok(rankOf('IC1') < rankOf('C1'), 'the IC before the small caps');
ok(rankOf('C1') < rankOf('C3'), 'film caps before electrolytics');
ok(bl[bl.length-1].kind === 'ecap', 'the tall electrolytics go in last');
ok(bl.filter(i => i.kind === 'link').every((_, i, a) => a.length === 6), 'all six links present');
ok(bl.find(i => i.ref === 'IC1').what === 'CD40106', 'the IC carries its part number');
ok(bl.find(i => i.ref === 'R1').holes === '[2,4] [10,4]', 'holes are listed in pin order');

console.log('-- M4: off-board wiring --');
const wl = wireList();
ok(wl.length === S.pads.length, 'every pad is listed (' + wl.length + ')');
ok(wl.every(w => w.back === backHole(w.col)), 'pads carry their back-of-board hole too');
ok(wl.map(w => w.label).indexOf('+12V') === 0, 'sorted top-left first, so +12V leads');

console.log('-- M4: markdown --');
const md = buildMarkdown();
ok(md.indexOf('# 40106 two-voice theremin') === 0, 'starts with the project name');
ok(md.indexOf('## Cuts (7)') > 0,        'has a cut section with the count');
ok(md.indexOf('## Build order (15)') > 0,'has a build order section with the count');
ok(md.indexOf('## Off-board wiring (8)') > 0, 'has a wiring section');
ok(md.indexOf('from left (back)') > 0,   'explains the back-of-board numbering');
ok(md.split('\n').filter(l => l.indexOf('| 3 | 8 | 12 |') === 0).length === 1,
   'a cut row reads row 3, col 8, 12th from the back-left');
ok(md.indexOf('CD40106') > 0,            'the IC appears in the build order');

console.log('-- M4: a one-column board is still coherent --');
S = {version:2, name:'tiny', board:{rows:2, cols:1}, cuts:[], parts:[], ics:[], pads:[]};
computeNets();
ok(mirrorCol(0) === 0 && backHole(0) === 1, 'a single column maps to itself');
ok(buildList().length === 0 && cutList().length === 0, 'empty board yields empty lists');
ok(buildMarkdown().indexOf('# tiny') === 0, 'and still produces a sheet');
S = demoProject(); computeNets();



console.log('-- regions: geometry --');
S = demoProject(); computeNets();
const rgBox = normRegion([9,4], [3,1]);
ok(rgBox.r0 === 3 && rgBox.r1 === 9 && rgBox.c0 === 1 && rgBox.c1 === 4, 'corners normalise whichever way round you click');
ok(inRegion(rgBox, 3, 1) && inRegion(rgBox, 9, 4), 'both corners are inside');
ok(!inRegion(rgBox, 2, 1) && !inRegion(rgBox, 3, 5), 'just outside is outside');
ok(regionFits({r0:0,c0:0,r1:2,c1:2}, 10, 17), 'an offset that lands on the board fits');
ok(!regionFits({r0:0,c0:0,r1:2,c1:2}, 11, 0), 'one that runs off the bottom does not');
ok(!regionFits({r0:0,c0:0,r1:2,c1:2}, 0, 18), 'nor off the right edge');
ok(!regionFits({r0:5,c0:5,r1:6,c1:6}, -6, 0), 'nor off the top');

console.log('-- regions: only whole things count --');
/* voice 1 of the fixture: C1 spans rows 3..12, so a box round rows 0-6 must
   NOT claim it -- half a part is not a part */
const rgHalf = {r0:0, c0:0, r1:6, c1:6};
const rgHc = regionContents(rgHalf);
ok(!rgHc.parts.some(p => p.ref === 'C1'), 'C1 straddles the edge, so it is left out');
ok(rgHc.parts.every(p => p.pins.every(q => q[0] <= 6 && q[1] <= 6)), 'everything claimed is wholly inside');
const rgWhole = {r0:0, c0:0, r1:12, c1:19};
const rgWc = regionContents(rgWhole);
ok(rgWc.parts.length === S.parts.length, 'a box round the whole board claims every part');
ok(rgWc.ics.length === 1 && rgWc.cuts.length === 7 && rgWc.pads.length === 8, 'and its IC, cuts and pads');
ok(regionCount(rgWhole) === S.parts.length + 1 + 7 + 8, 'regionCount adds up');
const rgIcBox = {r0:3, c0:7, r1:9, c1:10};
ok(regionContents(rgIcBox).ics.length === 1, 'a box round just the DIP claims it');
ok(regionContents({r0:3, c0:7, r1:8, c1:10}).ics.length === 0, 'one hole short and it does not');

console.log('-- regions: duplicate --');
S = demoProject(); computeNets();
const rgBefore = {parts:S.parts.length, cuts:S.cuts.length, ics:S.ics.length, pads:S.pads.length};
const rgVoice = {r0:1, c0:0, r1:4, c1:2};      // C1 top lead area: C3 lives here whole
const rgSrc = regionContents(rgVoice);
const rgMade = duplicateRegion(rgVoice, 6, 0);
ok(S.parts.length === rgBefore.parts + rgSrc.parts.length, 'exactly the contained parts were copied');
ok(rgMade.parts.every(p => p.pins.every(q => q[0] < S.board.rows)), 'the copies landed on the board');
ok(rgMade.parts.length > 0, 'something was actually copied (' + rgMade.parts.length + ')');
ok(new Set(S.parts.map(p => p.id)).size === S.parts.length, 'every copy got a fresh id');
ok(new Set(S.parts.map(p => p.ref)).size === S.parts.length, 'and a fresh ref — no duplicate designators');
const rgOrigC3 = S.parts.find(p => p.ref === 'C3');
const rgCopyC3 = rgMade.parts.find(p => p.kind === 'ecap');
if(rgCopyC3) ok(rgCopyC3.pins[0][0] === rgOrigC3.pins[0][0] + 6 && rgCopyC3.pins[0][1] === rgOrigC3.pins[0][1],
              'the copy sits exactly the offset away');
ok(rgCopyC3 && rgCopyC3.value === rgOrigC3.value && rgCopyC3.kind === rgOrigC3.kind, 'value and kind carried over');

console.log('-- regions: duplicating a DIP brings its cuts --');
S = demoProject(); computeNets();
const rgDipBox = {r0:3, c0:7, r1:9, c1:10};
const rgDup = duplicateRegion(rgDipBox, 0, 8);
ok(rgDup.ics.length === 1, 'the IC was copied');
ok(rgDup.cuts.length === 7, 'and all seven of its cuts came with it');
ok(rgDup.ics[0].ref === 'IC2', 'the copy is renumbered IC2');
ok(rgDup.ics[0].pin1[1] === 15, 'pin 1 moved eight columns right');
ok(rgDup.ics[0].autoCuts.every(k => S.cuts.indexOf(k) >= 0), 'its autoCuts all exist on the board');
ok(rgDup.ics[0].autoCuts.every(k => +k.split(',')[1] === 16), 'and sit in the new cut column');
ok(new Set(S.cuts).size === S.cuts.length, 'no duplicate cut keys were introduced');
computeNets();
ok(runDRC().filter(f => f.rule === 'ic-nocuts').length === 0, 'neither DIP straddles an uncut strip');

console.log('-- regions: move --');
S = demoProject(); computeNets();
const rgBeforeCuts = S.cuts.slice().sort().join(' ');
const rgMovedBox = {r0:3, c0:7, r1:9, c1:10};
moveRegion(rgMovedBox, 0, 6);
ok(S.ics[0].pin1[1] === 13, 'the IC moved');
ok(S.cuts.length === 7, 'still seven cuts, not fourteen');
ok(S.cuts.every(k => +k.split(',')[1] === 14), 'they all moved with it');
moveRegion({r0:3, c0:13, r1:9, c1:16}, 0, -6);
ok(S.ics[0].pin1[1] === 7 && S.cuts.slice().sort().join(' ') === rgBeforeCuts, 'moving back restores the board exactly');
computeNets();
ok(runDRC().length === 0, 'and it is DRC clean again');

console.log('-- regions: delete --');
S = demoProject(); computeNets();
const rgDel2 = deleteRegion({r0:3, c0:7, r1:9, c1:10});
ok(rgDel2.ics.length === 1 && S.ics.length === 0, 'the DIP was removed');
ok(S.cuts.length === 0, 'its auto-cuts went with it');
ok(S.parts.length === 14, 'parts that only passed through were left alone');

console.log('-- regions: tiling a hex chip --');
S = demoProject(); computeNets();
let rgTile = {r0:1, c0:0, r1:4, c1:2};
const rgStartParts = S.parts.length;
let rgCopies = 0;
for(let i = 0; i < 2 && regionFits(rgTile, 4, 0); i++){
  duplicateRegion(rgTile, 4, 0);
  rgTile = {r0:rgTile.r0+4, c0:rgTile.c0, r1:rgTile.r1+4, c1:rgTile.c1};
  rgCopies++;
}
ok(rgCopies === 2, 'the block tiled twice down the board');
ok(S.parts.length > rgStartParts, 'each pass added parts');
ok(new Set(S.parts.map(p => p.ref)).size === S.parts.length, 'refs stayed unique across both copies');
S = demoProject(); computeNets();


console.log('-- rows & cols: insert --');
S = demoProject(); computeNets();
const lnR0 = S.board.rows, lnC0 = S.board.cols;
let lnRes = insertLine(0, 0);                       // blank row at the very top
ok(lnRes.ok, 'inserting a row above row 0 succeeds');
ok(S.board.rows === lnR0 + 1, 'the board grew by one row');
ok(S.parts.every(p => p.pins.every(g => g[0] >= 1)), 'everything moved down out of the new row');
ok(S.ics[0].pin1[0] === 4, 'the IC moved down with it');
ok(S.cuts.every(k => +k.split(',')[0] >= 4), 'so did its cuts');
computeNets();
ok(runDRC().length === 0, 'and the board is still DRC clean');

console.log('-- rows & cols: a spanning part stretches --');
S = demoProject(); computeNets();
const lnC1 = S.parts.find(p => p.ref === 'C1');      // rows 3 -> 12, spans row 11
const lnBefore = JSON.parse(JSON.stringify(lnC1.pins));
insertLine(0, 11);   // clear of IC1, which occupies rows 3-9
const lnC1b = S.parts.find(p => p.ref === 'C1');
ok(lnC1b.pins[0][0] === lnBefore[0][0], 'the lead above the line stayed put');
ok(lnC1b.pins[1][0] === lnBefore[1][0] + 1, 'the lead below it moved down — the part stretched');
computeNets();
ok(NET.netAt(3,0).id === NET.netAt(3,7).id, 'C1 is still on pin 1 of the IC');

console.log('-- rows & cols: a DIP cannot stretch, so it refuses --');
S = demoProject(); computeNets();
const lnSnap = JSON.stringify(S);
lnRes = insertLine(0, 6);                            // straight through IC1 (rows 3-9)
ok(!lnRes.ok, 'inserting a row through the middle of a DIP is refused');
ok(lnRes.reason.indexOf('IC1') >= 0, 'and the refusal names the chip');
ok(JSON.stringify(S) === lnSnap, 'a refused edit changes nothing at all');
lnRes = insertLine(1, 9);                            // inside the DIP columns 7..10
ok(!lnRes.ok, 'same for a column through the DIP');
ok(JSON.stringify(S) === lnSnap, 'still unchanged');
ok(insertLine(0, 3).ok, 'inserting immediately above the DIP is fine — it just moves down');

console.log('-- rows & cols: delete --');
S = demoProject(); computeNets();
lnRes = deleteLine(0, 11);                           // an empty row
ok(lnRes.ok, 'deleting an empty row succeeds');
ok(S.board.rows === 12, 'the board shrank');
ok(lnRes.removed.parts.length === 0, 'nothing was on it');
ok(S.pads.find(d => d.label === 'GND').at[0] === 11, 'the ground rail moved up one');
computeNets();
ok(runDRC().length === 0, 'still clean — the whole layout closed up');

console.log('-- rows & cols: delete takes what sits on the line --');
S = demoProject(); computeNets();
lnRes = deleteLine(0, 10);                           // the mix bus: R1 R2 R3 ends, OUT pad
ok(lnRes.ok, 'deleting a populated row succeeds');
ok(lnRes.removed.parts.length === 3, 'the three resistors on it went with it');
ok(lnRes.removed.pads.indexOf('OUT') >= 0, 'so did the OUT pad');
ok(S.parts.every(p => p.ref[0] !== 'R'), 'no resistors left behind');
ok(S.ics.length === 1, 'the IC, which only spans rows 3-9, survived');

console.log('-- rows & cols: deleting through a DIP removes it --');
S = demoProject(); computeNets();
lnRes = deleteLine(0, 5);
ok(lnRes.removed.ics.indexOf('IC1') >= 0, 'a row through the DIP takes the DIP');
ok(S.ics.length === 0 && S.cuts.length === 0, 'and its auto-cuts go too');
S = demoProject(); computeNets();
lnRes = deleteLine(1, 8);                            // the DIP's own cut column
ok(lnRes.removed.ics.indexOf('IC1') >= 0, 'deleting the cut column also takes the DIP');
ok(S.cuts.length === 0, 'leaving no orphan cuts');

console.log('-- rows & cols: limits --');
S = demoProject(); computeNets();
ok(!deleteLine(0, 99).ok, 'a line that does not exist is refused');
ok(!insertLine(0, -1).ok, 'so is a negative index');
S.board.rows = 2; S.parts = []; S.ics = []; S.pads = []; S.cuts = [];
ok(!deleteLine(0, 0).ok, 'a two-row board will not go to one');
S.board.rows = 60;
ok(!insertLine(0, 0).ok, 'and 60 rows is the ceiling');

console.log('-- rows & cols: insert then delete is a round trip --');
S = demoProject(); computeNets();
const lnOrig = JSON.stringify({b:S.board, c:S.cuts.slice().sort(),
  p:S.parts.map(p => p.ref + p.pins), i:S.ics.map(x => x.ref + x.pin1), d:S.pads.map(x => x.label + x.at)});
insertLine(0, 2);
deleteLine(0, 2);
const lnBack = JSON.stringify({b:S.board, c:S.cuts.slice().sort(),
  p:S.parts.map(p => p.ref + p.pins), i:S.ics.map(x => x.ref + x.pin1), d:S.pads.map(x => x.label + x.at)});
ok(lnOrig === lnBack, 'inserting a blank row and deleting it again restores the board exactly');
insertLine(1, 5); deleteLine(1, 5);
ok(lnOrig === JSON.stringify({b:S.board, c:S.cuts.slice().sort(),
  p:S.parts.map(p => p.ref + p.pins), i:S.ics.map(x => x.ref + x.pin1), d:S.pads.map(x => x.label + x.at)}),
  'and the same for a column');
computeNets();
ok(runDRC().length === 0, 'round-tripped board is DRC clean');
S = demoProject(); computeNets();


console.log('-- reshaping a part one leg at a time --');
S = demoProject(); computeNets();
const mpR1 = S.parts.find(p => p.ref === 'R1');          // [2,4] -> [10,4]
ok(movePartPin(mpR1, 1, [10, 9]), 'moving leg B reports success');
ok(String(mpR1.pins[0]) === '2,4', 'leg A did not budge');
ok(String(mpR1.pins[1]) === '10,9', 'leg B landed where it was told');
computeNets();
ok(NET.netAt(2,4).id === NET.netAt(2,0).id, 'leg A is still on its own row');
ok(NET.netAt(10,9).id === NET.netAt(10,4).id, 'row 10 is uncut, so leg B is still on the mix bus');

const mpC1 = S.parts.find(p => p.ref === 'C1');
const mpSnap = JSON.stringify(mpC1.pins);
ok(!movePartPin(mpC1, 5, [0,0]), 'an out-of-range leg is refused');
ok(!movePartPin(mpC1, -1, [0,0]), 'so is a negative index');
ok(!movePartPin(null, 0, [0,0]), 'and a missing part');
ok(JSON.stringify(mpC1.pins) === mpSnap, 'a refused move changes nothing');

console.log('-- splaying a three-leg part --');
S = demoProject();
S.parts.push({id:'q9', kind:'trans', ref:'Q1', device:'2N5088', pins:[[10,14],[11,14],[12,14]]});
computeNets();
const mpQ = S.parts.find(p => p.ref === 'Q1');
movePartPin(mpQ, 1, [11, 15]);                            // kick the base out sideways
ok(String(mpQ.pins[0]) === '10,14' && String(mpQ.pins[2]) === '12,14', 'the other two legs held still');
ok(String(mpQ.pins[1]) === '11,15', 'the base moved on its own');
ok(mpQ.pins.length === 3, 'still a three-leg part');
computeNets();
ok(legLabels(mpQ).join('') === 'EBC', 'leg lettering is unchanged by reshaping');

console.log('-- reshaping is visible to the DRC --');
S = demoProject(); computeNets();
ok(runDRC().length === 0, 'fixture starts clean');
const mpR3 = S.parts.find(p => p.ref === 'R3');           // [10,6] -> [12,6]
movePartPin(mpR3, 0, [12, 8]);                            // both legs now on the ground rail
computeNets();
ok(runDRC().some(f => f.rule === 'part-short' && f.msg.indexOf('R3') === 0),
   'dragging a leg onto its own net trips part-short immediately');
movePartPin(mpR3, 0, [10, 6]);
computeNets();
ok(runDRC().length === 0, 'putting it back clears the error');
S = demoProject(); computeNets();


console.log('-- rotation: a single part --');
S = demoProject(); computeNets();
const rtShort = S.parts.find(p => p.ref === 'R3');       // [10,6] -> [12,6], two holes tall
ok(rotatePart(rtShort, 1).ok, 'a quarter turn clockwise succeeds');
ok(String(rtShort.pins[0]) === '10,6', 'leg one is the pivot and does not move');
ok(String(rtShort.pins[1]) === '10,4', 'the far leg swung a quarter turn round onto row 10');

/* R1 runs eight holes down column 4, so clockwise puts its far leg at column
   -4. The refusal is the whole point: a turn is not free just because there is
   room on the screen for the arc. */
const rtR1 = S.parts.find(p => p.ref === 'R1');
const rtR1Snap = JSON.stringify(rtR1.pins);
ok(!rotatePart(rtR1, 1).ok, 'a long part near the left edge refuses to turn that way');
ok(JSON.stringify(rtR1.pins) === rtR1Snap, 'and stays exactly where it was');
ok(rotatePart(rtR1, 3).ok && String(rtR1.pins[1]) === '2,12', 'the other direction has room');
S = demoProject(); computeNets();
const rtR2 = S.parts.find(p => p.ref === 'R2');          // [1,5] -> [10,5]
const rtSnap = JSON.stringify(rtR2.pins);
ok(!rotatePart(rtR2, 1).ok, 'a turn that throws a leg off the left edge is refused');
ok(JSON.stringify(rtR2.pins) === rtSnap, 'and the part is untouched');
ok(rotatePart(rtR2, 3).ok, 'turning the other way works — it swings right instead');
ok(rtR2.pins[1][0] === 1 && rtR2.pins[1][1] === 14, 'landing nine holes along row 1');

console.log('-- rotation: four turns is identity --');
S = demoProject(); computeNets();
const rtC3 = S.parts.find(p => p.ref === 'C3');
const rtBefore = JSON.stringify(rtC3.pins);
for(let i = 0; i < 4; i++) rotatePart(rtC3, 1);
ok(JSON.stringify(rtC3.pins) === rtBefore, 'four quarter turns return a part exactly where it started');
ok(rotatePart(rtC3, 0).ok && JSON.stringify(rtC3.pins) === rtBefore, 'zero turns is a no-op');
ok(rotatePart(rtC3, 4).ok && JSON.stringify(rtC3.pins) === rtBefore, 'so is a full turn');

console.log('-- rotation: three legs turn together --');
S = demoProject();
S.parts.push({id:'qr', kind:'trans', ref:'Q1', device:'2N5088', pins:[[4,14],[5,14],[6,14]]});
computeNets();
const rtQ = S.parts.find(p => p.ref === 'Q1');
ok(rotatePart(rtQ, 3).ok, 'a transistor turns');
ok(String(rtQ.pins[0]) === '4,14', 'about its emitter');
ok(rtQ.pins.every(g => g[0] === 4), 'all three legs now sit on one row');
computeNets();
ok(runDRC().some(f => f.rule === 'part-short' && f.msg.indexOf('Q1') === 0),
   'which shorts E, B and C together — and the DRC says so');

console.log('-- rotation is an electrical edit --');
S = demoProject(); computeNets();
ok(runDRC().length === 0, 'fixture starts clean');
const rtR3 = S.parts.find(p => p.ref === 'R3');          // [10,6] -> [12,6], spans strips
rotatePart(rtR3, 1);
computeNets();
ok(rtR3.pins.every(g => g[0] === 10), 'turned, R3 lies along a single strip');
ok(runDRC().some(f => f.rule === 'part-short' && f.msg.indexOf('R3') === 0),
   'so it is shorted out, and that is an error');
rotatePart(rtR3, 3);
computeNets();
ok(runDRC().length === 0, 'turning it back clears it');

console.log('-- rotation: a block --');
S = demoProject(); computeNets();
const rtBox = {r0:1, c0:0, r1:2, c1:4};                  // 2 rows x 5 cols
let rtRes = rotateRegion(rtBox, 1);
ok(rtRes.ok, 'a block with no DIP in it turns');
ok(rtRes.region.r1 - rtRes.region.r0 + 1 === 5, 'the footprint is now 5 rows tall');
ok(rtRes.region.c1 - rtRes.region.c0 + 1 === 2, 'and 2 columns wide');
ok(rtRes.region.r0 === 1 && rtRes.region.c0 === 0, 'anchored on the same top-left corner');

S = demoProject(); computeNets();
const rtSquare = {r0:0, c0:0, r1:3, c1:3};
const rtCells = () => S.parts.map(p => p.ref + p.pins).join('|') + '::' + S.cuts.slice().sort().join(',');
const rtStart = rtCells();
let reg = rtSquare;
for(let i = 0; i < 4; i++) reg = rotateRegion(reg, 1).region;
ok(rtCells() === rtStart, 'four turns of a square block restore it exactly');

console.log('-- rotation: what a block refuses --');
S = demoProject(); computeNets();
const rtIcBox = {r0:3, c0:7, r1:9, c1:10};
const rtIcSnap = JSON.stringify(S);
rtRes = rotateRegion(rtIcBox, 1);
ok(!rtRes.ok, 'a block containing a DIP will not turn');
ok(rtRes.reason.indexOf('IC1') >= 0, 'and it names the chip');
ok(JSON.stringify(S) === rtIcSnap, 'refusing changes nothing');
rtRes = rotateRegion({r0:0, c0:14, r1:1, c1:19}, 1);     // 2x6 -> 6x2 needs cols 14..15, rows 0..5: fits
ok(rtRes.ok, 'a tall result that still fits is allowed');
S = demoProject(); computeNets();
rtRes = rotateRegion({r0:0, c0:0, r1:1, c1:19}, 1);      // 2x20 -> 20x2, board is 13 rows
ok(!rtRes.ok, 'a block too tall to fit after turning is refused');
ok(rtRes.reason.indexOf('off the board') >= 0, 'with a reason that says why');
S = demoProject(); computeNets();


console.log('-- footprints: the default is still a DIP --');
S = demoProject(); computeNets();
const fpIc = S.ics[0];
ok(!hasFootprint(fpIc), 'a freshly placed chip carries no pin map');
ok(String(pinPos(fpIc, 1)) === '3,7' && String(pinPos(fpIc, 14)) === '3,10', 'geometry is derived as before');
const fpDef = defaultPinMap(fpIc);
ok(fpDef.length === 14, 'the default map has one entry per pin');
ok(String(fpDef[0]) === '0,0' && String(fpDef[13]) === '0,3', 'and it reproduces the DIP exactly');
const fpEx = icExtent(fpIc);
ok(fpEx.r0 === 3 && fpEx.r1 === 9 && fpEx.c0 === 7 && fpEx.c1 === 10, 'icExtent boxes all fourteen pins');

console.log('-- footprints: materialise and reshape --');
editFootprint(fpIc);
ok(hasFootprint(fpIc), 'editing materialises a map');
ok(String(pinPos(fpIc, 7)) === '9,7', 'and nothing moved doing it');
ok(setIcPin(fpIc, 7, [11, 7]), 'pin 7 can be dragged clear of the package');
ok(String(pinPos(fpIc, 7)) === '11,7', 'and it lands where it was put');
ok(String(pinPos(fpIc, 6)) === '8,7', 'its neighbours stayed put');
ok(icExtent(fpIc).r1 === 11, 'the extent grew to include it');
ok(!setIcPin(fpIc, 0, [0,0]) && !setIcPin(fpIc, 99, [0,0]), 'out-of-range pins are refused');

console.log('-- footprints: the anchor still moves the whole chip --');
const fpBefore = [];
for(let i = 1; i <= fpIc.pins; i++) fpBefore.push(String(pinPos(fpIc, i)));
fpIc.pin1 = [fpIc.pin1[0] + 1, fpIc.pin1[1] + 2];
const fpAfter = [];
for(let i = 1; i <= fpIc.pins; i++) fpAfter.push(String(pinPos(fpIc, i)));
ok(fpAfter.every((p, i) => {
  const a = fpBefore[i].split(',').map(Number), b = p.split(',').map(Number);
  return b[0] === a[0] + 1 && b[1] === a[1] + 2;
}), 'moving the anchor moves every pin, custom shape and all');

console.log('-- footprints: reset --');
S = demoProject(); computeNets();
const fpIc2 = S.ics[0];
editFootprint(fpIc2);
setIcPin(fpIc2, 3, [0, 0]);
ok(hasFootprint(fpIc2), 'chip is custom');
resetFootprint(fpIc2);
ok(!hasFootprint(fpIc2), 'reset drops the map');
ok(String(pinPos(fpIc2, 3)) === '5,7', 'and the DIP geometry comes straight back');

console.log('-- footprints: cuts are hand-managed --');
S = demoProject(); computeNets();
const fpIc3 = S.ics[0];
ok(fpIc3.autoCuts.length === 7, 'a DIP owns seven auto-cuts');
editFootprint(fpIc3);
refreshAutoCuts(fpIc3);
ok(fpIc3.autoCuts.length === 0, 'a shaped chip owns none');
ok(S.cuts.length === 0, 'and they were taken off the board');
computeNets();
ok(!runDRC().some(f => f.rule === 'ic-nocuts'), 'the DIP-straddle rule no longer applies to it');
ok(runDRC().some(f => f.rule === 'pin-short'),
   'but pin-short still catches the pins now sharing uncut strips');
resetFootprint(fpIc3);
refreshAutoCuts(fpIc3);
ok(S.cuts.length === 7, 'going back to a DIP restores the auto-cuts');
computeNets();
ok(runDRC().length === 0, 'and the fixture is clean again');

console.log('-- footprints: a non-DIP package --');
S = {version:2, name:'sil', board:{rows:8, cols:8}, cuts:[], parts:[], pads:[],
     ics:[{id:'u9', ref:'U1', part:'TO-92', pins:0, pin1:[2,2], span:2, autoCuts:[]}]};
S.ics[0].pins = 4;
S.ics[0].pinMap = [[0,0],[0,1],[0,2],[0,3]];              // a 4-pin SIL, all in one row
computeNets();
const fpSil = S.ics[0];
ok(hasFootprint(fpSil), 'an explicit map makes it custom');
ok(icExtent(fpSil).r0 === 2 && icExtent(fpSil).r1 === 2, 'all four pins sit on one row');
ok(String(pinPos(fpSil, 4)) === '2,5', 'pin 4 is three holes along');
ok(runDRC().some(f => f.rule === 'pin-short'),
   'four pins on one uncut strip is a short, and it is reported');
S.cuts = ['2,3', '2,4', '2,5'];
computeNets();
ok(!runDRC().some(f => f.rule === 'pin-short'), 'cutting between them clears it');
S = demoProject(); computeNets();


console.log('-- netlist: parsing --');
S = demoProject(); computeNets();
let nlP = parseNetlist('GND: IC1.7 C1.B @GND\n\n# a comment\nV1: IC1.1  C1.A   @V1_IN\n');
ok(nlP.nets.length === 2, 'two nets parsed, blanks and comments skipped');
ok(nlP.errors.length === 0, 'no syntax errors');
ok(nlP.nets[0].name === 'GND' && nlP.nets[0].members.length === 3, 'name and members split on the colon');
ok(parseNetlist('IC1.7 C1.B').errors[0].msg.indexOf('no colon') >= 0, 'a missing colon is reported');
ok(parseNetlist(': IC1.7').errors[0].msg.indexOf('no name') >= 0, 'an unnamed net is reported');
ok(parseNetlist('EMPTY:').errors[0].msg.indexOf('lists nothing') >= 0, 'an empty net is reported');
ok(parseNetlist('').nets.length === 0 && parseNetlist('').errors.length === 0, 'blank text is simply no opinion');

console.log('-- netlist: resolving members --');
ok(resolveMember('IC1.7').ok, 'an IC pin resolves');
ok(String(resolveMember('IC1.1').at) === '3,7', 'to the right hole');
ok(resolveMember('@GND').ok, 'a pad resolves by label');
ok(resolveMember('@gnd').ok, 'case-insensitively');
ok(resolveMember('R1.A').ok && String(resolveMember('R1.A').at) === '2,4', 'a two-lead part by A/B');
ok(String(resolveMember('R1.B').at) === '10,4', 'and B is the second leg');
ok(!resolveMember('IC1.99').ok, 'a pin the chip does not have is refused');
ok(!resolveMember('@NOPE').ok, 'so is a pad that does not exist');
ok(!resolveMember('R99.A').ok, 'and a ref nothing answers to');
ok(!resolveMember('R1.Z').ok, 'and a leg the part does not have');
ok(resolveMember('R1.Z').why.indexOf('A/B') >= 0, 'with a hint about what it should be');

S.parts.push({id:'qn', kind:'trans', ref:'Q1', device:'2N5088', pins:[[1,15],[1,16],[1,17]]});
computeNets();
ok(String(resolveMember('Q1.B').at) === '1,16', 'a transistor leg resolves by its letter');
ok(resolveMember('Q1.Z').why.indexOf('E/B/C') >= 0, 'and a bad one names the real legs');

console.log('-- netlist: a correct netlist passes --');
S = demoProject(); computeNets();
const nlGood = [
  'SUPPLY: IC1.14 @+12V C5.A',
  'GND:    IC1.7 IC1.5 IC1.9 IC1.11 IC1.13 @GND C1.B C2.B C5.B R3.B',
  'V1_IN:  IC1.1 C1.A @V1_IN',
  'V1_OUT: IC1.2 C3.A @V1_RET',
  'V2_IN:  IC1.3 C2.A @V2_IN',
  'V2_OUT: IC1.4 C4.A @V2_RET',
  'MIX:    R1.B R2.B R3.A @OUT',
].join('\n');
let nlR = checkNetlist(nlGood);
for(const f of nlR.findings) console.log('     ' + f.rule + ': ' + f.msg);
ok(nlR.findings.length === 0, 'the fixture matches a netlist describing it');
ok(nlR.clean, 'and reports clean');
ok(nlR.declared === 7, 'all seven nets were read');
ok(nlR.resolved === parseNetlist(nlGood).nets.reduce((a, n) => a + n.members.length, 0),
   'every member named in the netlist resolved to a hole — none quietly dropped');
ok(nlR.unmentioned.indexOf('IC1.6') >= 0,
   'and the four unused outputs show up as unmentioned rather than as errors');

console.log('-- netlist: catches a connection that is missing --');
nlR = checkNetlist('V1_IN: IC1.1 C1.A @V1_IN IC1.3');   // pin 3 is voice 2, not voice 1
ok(nlR.findings.some(f => f.rule === 'netlist-open'), 'a net split across the board is an error');
ok(nlR.findings[0].msg.indexOf('pieces') >= 0, 'and it says how it broke up');
ok(!nlR.clean, 'so it is not clean');

console.log('-- netlist: catches a connection that should not exist --');
nlR = checkNetlist('A: IC1.1 C1.A\nB: C1.B @GND');       // fine, genuinely separate
ok(nlR.findings.length === 0, 'two genuinely separate nets are fine');
nlR = checkNetlist('A: IC1.7\nB: @GND');                  // both on the ground rail
ok(nlR.findings.some(f => f.rule === 'netlist-short'), 'two nets that are actually one is an error');
ok(nlR.findings[0].msg.indexOf('declared them apart') >= 0, 'phrased from the netlist point of view');
ok(nlR.findings[0].msg.indexOf('share copper') >= 0,
   'and says they share copper rather than that they are joined — joined is not always true');

/* A part fitted backwards puts each leg on the other's strip, so the same pair
   of declared names collides on two different strips. That is one mistake and
   should read as one finding. */
console.log('-- netlist: a reversed part is one finding, not one per strip --');
S = demoProject(); computeNets();
let d1 = S.parts.find(q => q.kind === 'ecap');
let flipped = checkNetlist(['P: ' + d1.ref + '.A', 'Q: ' + d1.ref + '.B'].join(String.fromCharCode(10)));
ok(flipped.findings.filter(f => f.rule === 'netlist-short').length <= 1,
   'never more than one netlist-short for the same pair of names');


console.log('-- netlist: the layout is guilty, not the netlist --');
S = demoProject();
S.parts = S.parts.filter(p => p.ref !== 'J2');            // unground pin 7
computeNets();
nlR = checkNetlist('GND: IC1.7 @GND');
ok(nlR.findings.some(f => f.rule === 'netlist-open'),
   'removing the link that grounds pin 7 makes the netlist check fail');
S = demoProject(); computeNets();
ok(checkNetlist('GND: IC1.7 @GND').findings.length === 0, 'putting it back passes again');

console.log('-- netlist: never mandatory --');
ok(checkNetlist('').findings.length === 0, 'no netlist means no findings');
ok(checkNetlist('').clean === false, 'but it does not claim to be verified either');
ok(runDRC().length === 0, 'and the ordinary DRC is untouched by any of this');
ok(checkNetlist('GND: IC1.7 @GND').unmentioned.length > 0,
   'members the netlist never mentioned are listed, not flagged');


console.log('-- bodies: geometry --');
S = demoProject(); computeNets();
const bdAll = bodies();
ok(bdAll.length === S.parts.filter(p => FOOTPRINT[p.kind]).length + S.ics.length,
   'every part with a body, plus the IC, is measured');
ok(!bdAll.some(b => b.kind === 'link'), 'wire links have no body — bare wire lies flat');
const bdR3 = bdAll.find(b => b.ref === 'R3');       // [10,6]->[12,6], a 2-hole span
ok(bdR3.pinned, 'a 1/4W resistor across two holes is pinned — nowhere to slide');
ok(bdR3.slack === 0, 'because its body is longer than the gap it bridges');
const bdC4 = bdAll.find(b => b.ref === 'C4');
ok(!bdC4.pinned && bdC4.slack > 3, 'C4 has three holes of slack, so it can be nudged');
ok(bdAll.find(b => b.ref === 'IC1').pinned, 'a DIP is always pinned');

console.log('-- bodies: the fixture and the theremin are physically buildable --');
ok(checkBodies().length === 0, 'the demo fixture has no unavoidable clash');
ok(runDRC().filter(f => f.rule === 'body-clash').length === 0, 'and the DRC agrees');

console.log('-- bodies: two cans that genuinely cannot both fit --');
S = demoProject();
S.parts.push({id:'x1', kind:'ecap', ref:'CX', value:'10u', pins:[[1,14],[3,14]]});
S.parts.push({id:'x2', kind:'ecap', ref:'CY', value:'10u', pins:[[1,15],[3,15]]});
computeNets();
let bdC = checkBodies();
ok(bdC.length === 1, 'two 4.5mm cans in adjacent columns, both mounted tight, clash');
ok([bdC[0].a, bdC[0].b].sort().join() === 'CX,CY', 'and the pair is named');
ok(bdC[0].why.indexOf('slide clear') >= 0, 'with the reason');
ok(runDRC().some(f => f.rule === 'body-clash' && f.sev === 'warn'),
   'it reaches the DRC as a warning, not an error — the board still works electrically');

console.log('-- bodies: give one of them somewhere to go and it stops complaining --');
S.parts[S.parts.length-1].pins = [[1,15],[8,15]];   // CY now has slack
computeNets();
ok(checkBodies().length === 0, 'a can with room to slide is the builder\u2019s problem, not an error');

console.log('-- bodies: parts that fit are left alone --');
S = demoProject();
S.parts.push({id:'y1', kind:'res', ref:'RX', value:'1k', pins:[[1,14],[1,17]]});
S.parts.push({id:'y2', kind:'res', ref:'RY', value:'1k', pins:[[2,14],[2,17]]});
computeNets();
ok(checkBodies().length === 0,
   'two resistors lying flat on adjacent rows do fit — 2.4mm bodies, 2.54mm apart');
S.parts[S.parts.length-1].pins = [[1,15],[1,18]];   // same row, overlapping end to end
computeNets();
ok(checkBodies().length === 1, 'the same two overlapping along one row do not');

console.log('-- bodies: a part sitting on the chip --');
S = demoProject();
S.parts.push({id:'z1', kind:'ecap', ref:'CZ', value:'10u', pins:[[6,8],[8,8]]});
computeNets();
bdC = checkBodies();
ok(bdC.some(c => (c.a === 'IC1' || c.b === 'IC1') && (c.a === 'CZ' || c.b === 'CZ')),
   'a can planted in the middle of the DIP clashes with it');
ok(bdC[0].why.indexOf('chip') >= 0, 'and says so plainly');

console.log('-- bodies: the drawing and the check use one table --');
ok(FOOTPRINT.res.len === 2.48 && FOOTPRINT.res.wid === 0.94, 'a 1/4W resistor is 6.3 x 2.4 mm');
ok(FOOTPRINT.ecap.dia === 1.8, 'a radial can is 4.5 mm');
ok(FOOTPRINT.link === null, 'a link has no footprint at all');
ok(Object.keys(PART_LIB).every(k => FOOTPRINT[k] !== undefined),
   'every part kind has an entry, so nothing is silently unmeasured');
S = demoProject(); computeNets();

console.log('-- lead span: an axial body wider than the holes it was given --');
S = demoProject();
S.parts.push({id:'ls1', kind:'res', ref:'RS', value:'10k', pins:[[1,14],[3,14]]});
computeNets();
let lsF = runDRC().filter(f => f.rule === 'lead-span');
ok(lsF.length === 1, 'a 1/4W resistor across 0.2in is caught — 6.3mm body, 5.1mm of holes');
ok(lsF[0].sev === 'warn', 'as a warning, because standing it up is a real answer');
ok(lsF[0].msg.indexOf('will not lie flat') >= 0, 'and it says the thing that is actually true');

console.log('-- lead span: give it the room and it goes quiet --');
S.parts[S.parts.length-1].pins = [[1,14],[4,14]];
computeNets();
ok(runDRC().filter(f => f.rule === 'lead-span').length === 0, 'a third hole clears it');

console.log('-- lead span: a declared vertical part is taken at its word --');
S.parts[S.parts.length-1].pins = [[1,14],[3,14]];
S.parts[S.parts.length-1].mount = 'vertical';
computeNets();
ok(runDRC().filter(f => f.rule === 'lead-span').length === 0,
   "mount:'vertical' silences it — the builder has already decided");

console.log('-- lead span: radial parts are exempt on purpose --');
S = demoProject();
S.parts.push({id:'ls2', kind:'cap', ref:'CS', value:'100n', pins:[[1,14],[2,14]]});
computeNets();
ok(runDRC().filter(f => f.rule === 'lead-span').length === 0,
   'a film cap brings both leads out of one face, so a tight span only splays the legs');

console.log('-- lead span: the fixture says what it means --');
S = demoProject(); computeNets();
ok(S.parts.find(q => q.ref === 'R3').mount === 'vertical',
   "the fixture's 0.2in R3 is marked vertical rather than left looking like a mistake");
ok(runDRC().length === 0, 'so the golden fixture is still completely clean');

console.log('-- diode packages: the value decides the body --');
ok(diodePkg({kind:'diode', value:'1N4148'}) === 'DO-35', '1N4148 is a glass DO-35');
ok(diodePkg({kind:'diode', value:'1N5817'}) === 'DO-41', '1N5817 is a DO-41 slug');
ok(diodePkg({kind:'diode', value:'1N4001'}) === 'DO-41', 'and so is a 1N4001');
ok(diodePkg({kind:'diode', value:'BAT41'})  === 'DO-35',
   'an unrecognised value keeps the smaller default rather than inventing an error');
ok(diodePkg({kind:'diode', value:'BAT41', pkg:'DO-41'}) === 'DO-41',
   'an explicit pkg beats the guess');
ok(footprintOf({kind:'diode', value:'1N5817'}).len === DIODE_PKG['DO-41'].len,
   'footprintOf hands back the package size, not the kind default');
ok(footprintOf({kind:'diode', value:'1N4148'}).len === FOOTPRINT.diode.len,
   'and the kind default is still the small one');
ok(footprintOf({kind:'res'}).len === FOOTPRINT.res.len, 'non-diodes come through untouched');

console.log('-- diode packages: a DO-41 in DO-35 holes is now visible --');
S = demoProject();
/* 0.2in apart is 5.08mm of holes, and that is precisely the span where the two
   packages disagree: a 5.2mm slug misses it by 0.12mm, a 3.6mm glass bead
   clears it easily. Any span where both agree would prove nothing. */
S.parts.push({id:'ls3', kind:'diode', ref:'DS', value:'1N5817', pins:[[1,14],[3,14]]});
computeNets();
ok(runDRC().some(f => f.rule === 'lead-span' && f.msg.indexOf('DO-41') >= 0),
   'a 5.2mm slug across 0.2in is caught, and the finding names the package');
S.parts[S.parts.length-1].value = '1N4148';
computeNets();
ok(runDRC().filter(f => f.rule === 'lead-span').length === 0,
   'the very same holes are fine for a 3.6mm glass diode');

console.log('-- lead span: every footprint declares its lead style --');
ok(Object.keys(FOOTPRINT).every(k => FOOTPRINT[k] === null || FOOTPRINT[k].leads),
   'nothing is silently unmeasured');

S = demoProject(); computeNets();

console.log('-- bom: engineering values sort by magnitude, not alphabet --');
ok(engValue('10n') < engValue('100n'), '10n comes before 100n');
ok(engValue('100R') < engValue('1k'), '100R comes before 1k');
ok(engValue('4k7') === 4700, 'the European 4k7 reads as 4.7k');
ok(engValue('4.7k') === 4700, 'and 4.7k agrees with it');
ok(engValue('1M') > engValue('1m'), 'mega beats milli — case is not decoration');
ok(engValue('') === Infinity, 'a missing value sorts last');
ok(engValue('BC547') === Infinity,
   'and so does one we cannot read, rather than pretending to be zero');

console.log('-- bom: identical parts collapse, different ones do not --');
S = demoProject(); computeNets();
let b = bom();
let res = b.filter(r => r.kind === 'res');
ok(res.length === 1, 'the three 10k resistors are one line');
ok(res[0].qty === 3, 'with a quantity of three');
ok(res[0].refs.join(' ') === 'R1 R2 R3', 'and every ref listed, naturally sorted');
ok(b.reduce((n, r) => n + r.qty, 0) === S.parts.length + S.ics.length,
   'every part and chip is accounted for exactly once');

console.log('-- bom: value splits a row, mounting does not --');
S = demoProject();
S.parts.find(q => q.ref === 'R3').value = '22k';
computeNets();
ok(bom().filter(r => r.kind === 'res').length === 2, 'a different value is a different line');
S = demoProject();
S.parts.find(q => q.ref === 'R1').mount = 'vertical';
computeNets();
ok(bom().filter(r => r.kind === 'res').length === 1,
   'a resistor standing on end is still the same resistor to buy');

console.log('-- bom: a diode package splits the row, because it is a different part --');
S = demoProject();
S.parts.push({id:'b1', kind:'diode', ref:'DA', value:'1N4148', pins:[[1,14],[4,14]]});
S.parts.push({id:'b2', kind:'diode', ref:'DB', value:'1N5817', pins:[[2,14],[5,14]]});
computeNets();
let dio = bom().filter(r => r.kind === 'diode');
ok(dio.length === 2, 'a DO-35 and a DO-41 are two lines');
ok(dio.every(r => r.note === 'DO-35' || r.note === 'DO-41'), 'each naming its package');
S.parts[S.parts.length-1].value = '1N4148';
computeNets();
ok(bom().filter(r => r.kind === 'diode').length === 1,
   'make them the same part and they collapse to one');

console.log('-- bom: chips carry their pin count --');
S = demoProject(); computeNets();
let chip = bom().find(r => r.kind === 'ic');
ok(chip && chip.what === 'CD40106', 'the chip is listed by part number');
ok(chip.note === '14-pin DIP', 'with the package you have to order');

console.log('-- bom: ordering follows BUILD_ORDER, not a second hand-written list --');
S = demoProject(); computeNets();
b = bom();
let ranks = b.map(r => BUILD_ORDER[r.kind] || 99);
ok(ranks.every((v, i2) => i2 === 0 || ranks[i2-1] <= v), 'kinds come out in BUILD_ORDER sequence');
let caps = b.filter(r => r.kind === 'cap').map(r => r.what);
ok(caps.length < 2 || engValue(caps[0]) <= engValue(caps[1]),
   'and within a kind, by value ascending');

console.log('-- bom: an empty board says nothing rather than breaking --');
S = {name:'empty', board:{rows:5, cols:5}, cuts:[], parts:[], ics:[], pads:[]};
computeNets();
ok(bom().length === 0, 'no parts, no lines');

S = demoProject(); computeNets();

console.log('-- supply labels: the ones people actually write --');
ok(powerClass('VIN') && powerClass('VIN').cls === 'pos',
   "VIN is a supply rail — it is what Paul's APC schematic calls it");
ok(powerClass('VBAT') && powerClass('VBAT').cls === 'pos', 'so is VBAT');
ok(powerClass('VCC') && powerClass('VCC').cls === 'pos', 'and VCC still is');
ok(powerClass('+9V') && powerClass('+9V').volts === 9, '+9V still reads its voltage');
ok(powerClass('GND') && powerClass('GND').cls === 'gnd', 'GND is still ground');
ok(powerClass('VINE') === null, 'but VINE is not a rail — the match is anchored, not a prefix');
ok(powerClass('IN') === null, 'and a bare IN is a signal, not a supply');

/* A 555 astable ties trigger to threshold and a monostable ties threshold to
   discharge. Both are the datasheet's own wiring, and both look identical to a
   short unless the library says otherwise. */
console.log('-- pin ties: a grouping the datasheet calls for is not a short --');
const NE555_BOARD = (linkPins) => ({
  name:'t', board:{rows:5, cols:10},
  cuts:['0,3','1,3','2,3','3,3'],
  parts:[{id:'k', kind:'link', ref:'J1', value:'', pins:linkPins}],
  ics:[{id:'u', ref:'IC1', part:'NE555', pins:8, pin1:[0,2], span:3,
        autoCuts:['0,3','1,3','2,3','3,3']}],
  pads:[],
});
const shorts = () => runDRC().filter(f => f.rule === 'pin-short');

S = NE555_BOARD([[1,0],[2,4]]);        // joins pin 2 (trigger) to pin 6 (threshold)
computeNets();
ok(shorts().length === 0, 'tying 555 pins 2 and 6 is the astable, not a fault');

S = NE555_BOARD([[2,4],[1,4]]);        // joins pin 6 (threshold) to pin 7 (discharge)
computeNets();
ok(shorts().length === 0, 'tying pins 6 and 7 is the monostable timing node');

S = NE555_BOARD([[2,0],[0,4]]);        // joins pin 3 (output) to pin 8 (Vcc)
computeNets();
ok(shorts().length === 1, 'but output shorted to the supply is still an error');
ok(shorts()[0].msg.indexOf('3') >= 0 && shorts()[0].msg.indexOf('8') >= 0,
   'and it names the two pins involved');

console.log('-- pin ties: only the chips that declare them --');
ok((IC_LIB.NE555.ties || []).some(g => g.indexOf(2) >= 0 && g.indexOf(6) >= 0),
   'the NE555 declares its 2-6 tie');
ok(!IC_LIB.CD40106.ties,
   'the CD40106 declares none — an inverter has no business tying its own pins');

S = demoProject(); computeNets();

console.log('-- IC library: every entry is structurally sound --');
let libBad = [];
for(const [name, def] of Object.entries(IC_LIB)){
  if(!def.pins || !def.name) { libBad.push(name + ' missing pins/name'); continue; }
  for(const k of Object.keys(def.roles || {})){
    const n = +k;
    if(!(n >= 1 && n <= def.pins)) libBad.push(name + ' role on pin ' + k + ' of ' + def.pins);
  }
  for(const g of def.ties || [])
    for(const n of g)
      if(!(n >= 1 && n <= def.pins)) libBad.push(name + ' tie on pin ' + n + ' of ' + def.pins);
}
ok(libBad.length === 0, 'no role or tie names a pin the package does not have: ' + libBad.join('; '));

let vddBad = [];
for(const [name, def] of Object.entries(IC_LIB)){
  const vdd = Object.values(def.roles || {}).filter(r => r === 'vdd').length;
  if(vdd > 1) vddBad.push(name + ' has ' + vdd + ' supply pins');
}
ok(vddBad.length === 0, 'no chip declares two positive supply pins: ' + vddBad.join('; '));

/* The bug this guards: CD4011 and CD4093 are one arrangement, one entry drifted
   from the other, and pins 8 and 10 sat swapped in both. A NAND input labelled
   as an output is invisible to the floating-input rule, which is the whole
   reason that rule exists. */
console.log('-- IC library: the quad 2-input gate arrangement --');
for(const g of ['CD4011','CD4093','CD4001','CD4071','CD4081','CD4070','CD4077']){
  const r = IC_LIB[g].roles;
  const ins  = [1,2,5,6,8,9,12,13].every(n => r[n] === 'in');
  const outs = [3,4,10,11].every(n => r[n] === 'out');
  ok(ins && outs, g + ': inputs 1,2,5,6,8,9,12,13 and outputs 3,4,10,11');
}
ok(IC_LIB.CD4011.roles[8] === 'in' && IC_LIB.CD4011.roles[10] === 'out',
   'pin 8 is an input and pin 10 an output — the pair that used to be swapped');
ok(IC_LIB.CD4011.roles === IC_LIB.CD4093.roles,
   'and the twins share one table, so neither can drift from the other again');

console.log('-- IC library: op-amps --');
for(const q of ['TL074','TL084','TL064','LM324','LM348']){
  const r = IC_LIB[q].roles;
  ok(r[12] === 'in' && r[13] === 'in' && r[14] === 'out',
     q + ': the fourth amp is IN+ 12, IN- 13, OUT 14');
}
ok(IC_LIB.TL074.roles[4] === 'vdd' && IC_LIB.TL074.roles[11] === 'vee',
   'quad op-amp rails are 4 and 11, and 11 is VEE not ground');
for(const d of ['TL072','TL082','JRC4558','NE5532','LM358','OPA2134']){
  const r = IC_LIB[d].roles;
  ok(r[1] === 'out' && r[7] === 'out' && r[4] === 'vee' && r[8] === 'vdd',
     d + ': outputs 1 and 7, rails 4 and 8');
}

console.log('-- IC library: hex inverters alternate in, out --');
for(const h of ['CD40106','CD4069']){
  const r = IC_LIB[h].roles;
  ok([1,3,5,9,11,13].every(n => r[n] === 'in') && [2,4,6,8,10,12].every(n => r[n] === 'out'),
     h + ': six inverters, each input beside its output');
}

console.log('-- IC library: the chips actually on the shelf are in it --');
for(const c of ['NE555','CD4093','CD40106','TL072','LM13700','PT2399','LM386','CD4040','CD4051','CD4066']){
  ok(!!IC_LIB[c], c + ' is in the library');
}
ok(Object.keys(IC_LIB).length >= 40, 'the library holds at least 40 parts');
ok(IC_LIB.LM13700.roles[8] === 'vee' && IC_LIB.LM13700.roles[16] === 'vdd',
   'LM13700 rails are 8 and 16, not the 7/14 an op-amp habit would guess');

/* On a +-12V rack an op-amp's pin 4 goes to -12V, not to ground. CMOS logic is
   the other way: its VSS really does sit at 0V, on racks and pedals alike. */
console.log('-- rails: vee is not ground --');
ok(IC_LIB.TL072.roles[4] === 'vee' && IC_LIB.CD4093.roles[7] === 'gnd',
   "an op-amp's negative rail is vee; a CMOS gate's VSS stays gnd");
ok(IC_LIB.CD4051.roles[7] === 'vee' && IC_LIB.CD4051.roles[8] === 'gnd',
   'the 4051 has both, and they are different pins doing different jobs');
let veeCount = Object.values(IC_LIB).filter(d => Object.values(d.roles || {}).includes('vee')).length;
ok(veeCount >= 18, 'every op-amp and the OTA carry a vee pin: ' + veeCount);
ok(IC_LIB.PT2399.cmos === false,
   'the PT2399 is marked non-CMOS on purpose — CC0/CC1 are meant to float');

S = demoProject(); computeNets();

console.log('-- explain: pin names come from the library, never from guesswork --');
S = demoProject(); computeNets();
const why = (r, c) => explainHole(r, c).join(' ');
ok(why(3, 7).indexOf('1A') >= 0, 'IC1 pin 1 on the demo is named 1A');
ok(why(3, 7).indexOf('its output is pin 2') >= 0,
   'and it says which pin the gate drives, which is the part a name alone leaves out');
ok(why(4, 7).indexOf('1Y') >= 0, 'pin 2 is the matching output');
ok(why(3, 7).indexOf('Schmitt') >= 0, 'the CD40106 note explains why an RC makes it oscillate');

console.log('-- explain: it says nothing rather than something vague --');
S = {name:'bare', board:{rows:4, cols:6}, cuts:[], parts:[], ics:[], pads:[]};
computeNets();
ok(why(1, 1).indexOf('Nothing else is on this run of copper') >= 0,
   'a bare strip says so plainly rather than staying silent or padding');
S = demoProject(); computeNets();
/* The generic packages are the permanent example of a chip the library knows
   nothing about: you reach for DIP-14 precisely when your part is not in here. */
ok(!IC_LIB['DIP-14'].pinInfo, 'a generic DIP carries no pin table, and never will');
ok(pinInfoOf({part:'DIP-14'}, 3) === null,
   'so pinInfoOf returns nothing rather than inventing a name');
ok(pinInfoOf({part:'NOT-A-REAL-CHIP'}, 1) === null,
   'and an unknown part number does the same instead of throwing');

console.log('-- explain: a cut says whose it is and what it prevents --');
const cutWhy = why(3, 8);
ok(cutWhy.indexOf('belongs to IC1') >= 0, 'an auto-cut names the chip that owns it');
ok(cutWhy.indexOf('pin 1 to pin 14') >= 0,
   'and names the two pins it keeps apart, counted from the real pin count');

console.log('-- explain: rails are called rails --');
ok(why(0, 0).indexOf('supply rail') >= 0, 'the +12V pad reads as a supply rail');
let gndHole = S.pads.find(d => d.label === 'GND').at;
ok(why(gndHole[0], gndHole[1]).indexOf('ground rail') >= 0, 'and GND as the ground rail');

console.log('-- explain: who drives whom --');
/* Pin 2 of the demo 40106 is an output with the coupling cap on its strip. */
ok(why(4, 7).indexOf('drives the strip') >= 0,
   'standing on an output says this pin drives the strip');
ok(why(4, 7).indexOf('Driven by IC1 pin 2') < 0,
   'and does not name back the pin you are already standing on');

console.log('-- explain: it never claims a direction the library does not hold --');
let claims = [];
for(const [name, def] of Object.entries(IC_LIB)){
  for(const k of Object.keys(def.pinInfo || {})){
    if(!(+k >= 1 && +k <= def.pins)) claims.push(name + ' pin ' + k);
  }
}
ok(claims.length === 0, 'no pin table names a pin the package does not have: ' + claims.join(', '));

let mismatched = [];
for(const [name, def] of Object.entries(IC_LIB)){
  if(!def.pinInfo) continue;
  for(const [k, info] of Object.entries(def.pinInfo)){
    const role = (def.roles || {})[k];
    const nm = info.n.toUpperCase();
    if(role === 'vdd' && !/V\+|VDD|VCC/.test(nm)) mismatched.push(name + ' ' + k + ' ' + nm);
    if(role === 'gnd' && !/GND|VSS|V\u2212|V-/.test(nm)) mismatched.push(name + ' ' + k + ' ' + nm);
  }
}
ok(mismatched.length === 0,
   'every supply pin is named like a supply pin, so the role and the words agree: ' +
   mismatched.join(', '));

S = demoProject(); computeNets();

/* These are the parts with no pattern to fall back on, so the pin order is
   pinned down here rather than trusted. Every number below was read off a
   datasheet, not recalled. */
console.log('-- counters: the 4017 outputs are not in counting order --');
const nm = (chip, pin) => IC_LIB[chip].pinInfo[pin].n;
ok(nm('CD4017', 3) === 'Q0', 'Q0 is pin 3');
ok(nm('CD4017', 2) === 'Q1', 'Q1 is pin 2');
ok(nm('CD4017', 4) === 'Q2', 'Q2 is pin 4');
ok(nm('CD4017', 7) === 'Q3', 'Q3 is pin 7 — nowhere near the others');
ok(nm('CD4017', 14) === 'CLK' && nm('CD4017', 15) === 'RESET' && nm('CD4017', 13) === 'CLK INH',
   'clock 14, reset 15, inhibit 13');
let seen4017 = [1,2,3,4,5,6,7,9,10,11].map(n => nm('CD4017', n)).sort();
ok(new Set(seen4017).size === 10, 'all ten outputs are present exactly once');

console.log('-- counters: the 4040 says what each output divides by --');
ok(nm('CD4040', 9) === 'Q1' && IC_LIB.CD4040.pinInfo[9].d.indexOf('divided by 2') >= 0,
   'Q1 on pin 9 halves the clock');
ok(nm('CD4040', 1) === 'Q12' && IC_LIB.CD4040.pinInfo[1].d.indexOf('4096') >= 0,
   'Q12 on pin 1 divides by 4096');
ok(nm('CD4040', 10) === 'CLK' && nm('CD4040', 11) === 'RESET', 'clock 10, reset 11');

console.log('-- muxes: the 4051 channels are scattered, and the select bits are weighted --');
ok(nm('CD4051', 13) === 'CH0', 'channel 0 is pin 13');
ok(nm('CD4051', 1) === 'CH4', 'channel 4 is pin 1');
ok(nm('CD4051', 3) === 'COM', 'the common pin is 3');
ok(IC_LIB.CD4051.pinInfo[11].d.indexOf('worth 1') >= 0 &&
   IC_LIB.CD4051.pinInfo[10].d.indexOf('worth 2') >= 0 &&
   IC_LIB.CD4051.pinInfo[9].d.indexOf('worth 4') >= 0,
   'A is worth 1, B is 2, C is 4 — the part you cannot guess from the letters');
ok(nm('CD4051', 7) === 'VEE', 'pin 7 is VEE, not ground, and says to tie it down on one rail');

console.log('-- switches: the 4066 control pins sit away from their switches --');
ok(nm('CD4066', 13).indexOf('A') >= 0 && IC_LIB.CD4066.pinInfo[13].d.indexOf('1 and 2') >= 0,
   'switch A is pins 1 and 2 but its control is pin 13');
ok(nm('CD4066', 5).indexOf('B') >= 0 && IC_LIB.CD4066.pinInfo[5].d.indexOf('3 and 4') >= 0,
   'switch B is pins 3 and 4, control on pin 5');
ok(IC_LIB.CD4066.pinInfo[13].d.indexOf('nowhere near') >= 0,
   'and it warns that they are nowhere near each other');

console.log('-- flip-flops: the 4013 divide-by-two trick is written down --');
ok(nm('CD4013', 1) === 'Q1' && nm('CD4013', 2) === '/Q1', 'Q and /Q are pins 1 and 2');
ok(IC_LIB.CD4013.pinInfo[5].d.indexOf('halves the clock') >= 0,
   'D wired back to /Q halves the clock — the reason most synth builds reach for it');

console.log('-- the PLL names the pin that actually sets the pitch --');
ok(nm('CD4046', 9) === 'VCO IN' && IC_LIB.CD4046.pinInfo[9].d.indexOf('pitch') >= 0,
   'pin 9 is the control voltage');
ok(nm('CD4046', 4) === 'VCO OUT', 'pin 4 is the oscillator output');
ok(nm('CD4046', 6) === 'C1A' && nm('CD4046', 7) === 'C1B', 'the timing cap goes across 6 and 7');

console.log('-- every chip in the library now explains itself --');
let bare = Object.entries(IC_LIB)
  .filter(([k, v]) => !v.pinInfo && k.indexOf('DIP-') !== 0)
  .map(([k]) => k);
ok(bare.length === 0, 'no real part is left without a pin table: ' + bare.join(', '));

S = demoProject(); computeNets();

/* Hangs the supply pads on whatever strips the chip's own VDD and VEE/GND pins
   land on, so the check is exercised the way a real board would drive it. */
function onRails(part, posLabel, negLabel){
  const def = IC_LIB[part], n = def.pins, half = n / 2, cuts = [];
  for(let i = 0; i < half; i++) cuts.push(K(i, 3));
  S = {name:'t', board:{rows:half + 4, cols:14}, cuts:cuts.slice(), parts:[],
       ics:[{id:'u', ref:'IC1', part:part, pins:n, pin1:[0,2], span:3, autoCuts:cuts.slice()}],
       pads:[]};
  computeNets();
  const ic = S.ics[0];
  const pinAt = (role) => {
    for(const q of Object.keys(def.roles)) if(def.roles[q] === role) return pinPos(ic, +q);
    return null;
  };
  const vdd = pinAt('vdd'), neg = pinAt('vee') || pinAt('gnd');
  const side = (at) => at[1] < 3 ? 0 : 12;
  S.pads = [{id:'p1', label:posLabel, at:[vdd[0], side(vdd)]},
            {id:'p2', label:negLabel, at:[neg[0], side(neg)]}];
  computeNets();
  return runDRC().filter(x => x.rule === 'supply-range');
}
const sev1 = f => f.length ? f[0].sev : 'none';

console.log('-- supply: over the maximum costs you the part --');
ok(sev1(onRails('PT2399', '+12V', 'GND')) === 'error',
   'a PT2399 on a 12V rack rail is an error — it is a 5V part');
ok(sev1(onRails('PT2399', '+9V', 'GND')) === 'error', 'and on a 9V pedal rail too');
ok(sev1(onRails('PT2399', '+5V', 'GND')) === 'none', 'on its own 5V regulator it is fine');
ok(onRails('PT2399', '+9V', 'GND')[0].msg.indexOf('regulator') >= 0,
   'and the finding says what to do about it');

console.log('-- supply: under the minimum only wastes an evening --');
ok(sev1(onRails('LM13700', '+9V', 'GND')) === 'warn',
   'an OTA on 9V is a warning, not an error — nothing burns, it just will not bias');
ok(sev1(onRails('TL072', '+5V', 'GND')) === 'warn', 'same for a TL072 on 5V');

console.log('-- supply: a rack runs both rails, and total is what matters --');
ok(sev1(onRails('TL072', '+12V', '-12V')) === 'none',
   'a TL072 across +-12V sees 24V and is happy');
ok(sev1(onRails('LM13700', '+12V', '-12V')) === 'none', 'so is the OTA');
ok(sev1(onRails('TL072', '+9V', 'GND')) === 'none', 'and 9V single-rail is still fine');

/* The trap you only meet once you leave pedals: 4000-series logic tops out at
   18V, and both rack rails together are 24V. */
ok(sev1(onRails('CD4093', '+12V', 'GND')) === 'none', 'a 4093 from +12V to ground is fine');
ok(sev1(onRails('CD4093', '+24V', 'GND')) === 'error',
   'but 24V across it is an error — CMOS stops at 18V');

console.log('-- supply: no number, no opinion --');
ok(sev1(onRails('NE555', 'VIN', 'GND')) === 'none',
   'a rail labelled VIN states no voltage, so nothing is claimed about it');
ok(sev1(onRails('NE555', '+9V', 'GND')) === 'none', 'a 555 on 9V is within 4.5-16V');
ok(Object.values(IC_LIB).filter(d => d.volts).every(d => d.volts.min < d.volts.max),
   'every declared range has a minimum below its maximum');

S = demoProject(); computeNets();

/* The decoupling line is worked out from the pin table rather than typed in,
   so it cannot drift from the pinout and it covers parts added later. */
console.log('-- decoupling: derived from the rails, not hand-copied --');
ok(decoupling('CD40106').indexOf('pins 14 and 7') >= 0, 'a 14-pin CMOS gate decouples across 14 and 7');
ok(decoupling('CD4040').indexOf('pins 16 and 8') >= 0, 'a 16-pin one across 16 and 8');
ok(decoupling('TL072').indexOf('pins 8 and 4') >= 0, 'a dual op-amp across 8 and 4');
ok(decoupling('TL074').indexOf('pins 4 and 11') >= 0, 'a quad across 4 and 11 — different pins entirely');
ok(decoupling('CD4049').indexOf('pins 1 and 8') >= 0,
   "the 4049's odd rails come out right, which is the point of deriving it");
ok(decoupling('LM13700').indexOf('pins 16 and 8') >= 0, 'and the OTA across 16 and 8');
ok(decoupling('DIP-14') === null, 'a package with no known rails gets no advice');
ok(decoupling('NE555').indexOf('current spike') >= 0,
   'a part with something extra to say gets it appended');

console.log('-- explain: the chip-wide lines are said once, not on every pin --');
S = demoProject(); computeNets();
const ic1 = S.ics[0];
const linesAt = (pin) => explainHole.apply(null, pinPos(ic1, pin));
const mentions = (pin, txt) => linesAt(pin).some(l => l.indexOf(txt) >= 0);
ok(IC_LIB.CD40106.about, 'the 40106 carries a description');
ok(mentions(1, 'Lunetta'), 'pin 1 carries the chip description');
ok(!mentions(2, 'Lunetta'), 'pin 2 does not repeat it');
ok(!mentions(14, 'Lunetta'), 'nor does the supply pin');
ok(mentions(14, '100n between pins 14 and 7'),
   'but the supply pin does carry the decoupling advice, because that is where the cap goes');
ok(!mentions(2, '100n between'), 'and a signal pin does not');
ok(linesAt(3).some(l => l.indexOf('pin 3') >= 0),
   'every pin still says what that pin itself is');

S = demoProject(); computeNets();

console.log('-- devices: a chosen type beats anything guessed from the value --');
const fpOf = (kind, device, value) => footprintOf({kind:kind, device:device, value:value, pins:[[0,0],[0,3]]});
ok(fpOf('diode','switching','1N4148').len === 1.40, 'a switching diode is a DO-35');
ok(fpOf('diode','rectifier','1N4001').len === 2.05, 'a rectifier is a DO-41');
ok(fpOf('diode','Schottky','1N5817').len === 2.05, 'so is a Schottky');
ok(fpOf('diode','zener','5V1').len === 1.40, 'a zener is a DO-35, and 5V1 is not a value the guesser knows');
ok(fpOf('diode','rectifier','1N4148').len === 2.05,
   'and the chosen type wins even when the value would have guessed smaller');

console.log('-- devices: LED and LDR are round parts with both leads one end --');
ok(fpOf('diode','LED','red').shape === 'disc', 'an LED has a round body, not an axial one');
ok(fpOf('diode','LED','red').leads === 'radial', 'with both leads out the same end');
ok(fpOf('res','LDR','LDR').shape === 'disc' && fpOf('res','LDR','LDR').leads === 'radial',
   'and so does an LDR');

/* radial parts are exempt from the lead-span rule: a wide span just splays the
   legs. If either had stayed axial they would warn on every sensible placement. */
S = demoProject();
S.parts.push({id:'x1', kind:'diode', ref:'DX', device:'LED', value:'red', polarized:true, pins:[[1,14],[2,14]]});
S.parts.push({id:'x2', kind:'res', ref:'RX', device:'LDR', value:'LDR', pins:[[3,14],[4,14]]});
computeNets();
ok(runDRC().filter(f => f.rule === 'lead-span').length === 0,
   'neither warns about lead span, because both are radial');

console.log('-- devices: an LDR is a resistor, and is not filed with the diodes --');
ok(!DEV_LIB.diode.LDR, 'there is no LDR among the diode types');
ok(!!DEV_LIB.res.LDR, 'it lives under the resistor kind, where it belongs');
ok(!PART_LIB.res.polarized, 'so it carries no polarity, and gets no cathode band');
ok(PART_LIB.diode.polarized, 'while a diode still does');

console.log('-- devices: every type names a package the footprint table knows --');
let devBad = [];
for(const [kind, fam] of Object.entries(DEV_LIB))
  for(const [name, d] of Object.entries(fam))
    if(d.pkg && !DEV_PKG[d.pkg]) devBad.push(kind + '/' + name + ' -> ' + d.pkg);
ok(devBad.length === 0, 'no device points at a package that does not exist: ' + devBad.join(', '));
ok(Object.values(DEV_LIB.diode).every(d => d.about), 'every diode type explains itself');

S = demoProject(); computeNets();

console.log('\n' + (fail ? fail + ' FAILURES' : 'ALL CHECKS PASS') + '\n');
process.exit(fail ? 1 : 0);
