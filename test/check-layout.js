/* Run a saved layout through the model and report what the DRC makes of it.
 *
 *   node test/check-layout.js layouts/optical-theremin.json
 *   node test/check-layout.js layouts/optical-theremin.json --json
 *
 * Same trick as fixture.test.js: the model is lifted verbatim out of the app,
 * so this is the real checker, not a reimplementation of it.
 *
 * --json prints the solved board as data on stdout: the nets by name with
 * their members, the findings, the cut list, the BOM and the off-board wires.
 * It exists because the most useful thing in a layout file - what is actually
 * connected to what - was also the least machine-readable, so anybody writing
 * their own tooling had to re-implement the geometry solver to reach what
 * this file had already worked out. Said plainly on Sept 15 2026 by somebody
 * who had done exactly that.
 *
 * It is DERIVED here rather than stored in the layout, and that is the point:
 * the copper is the truth and the nets are a view of it. A view written into
 * the file is a second record that can disagree with the first, which is the
 * one thing this tool exists not to do.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const asJson = process.argv.includes('--json');
const target = process.argv.slice(2).filter(a => !a.startsWith('--'))[0];
if(!target){ console.error('usage: node test/check-layout.js <layout.json> [--json]'); process.exit(2); }

const html = fs.readFileSync(path.join(__dirname, '..', 'copper-bottom.html'), 'utf8');
const m = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if(!m){ console.error('could not find the #region model markers'); process.exit(2); }

const layout = JSON.parse(fs.readFileSync(target, 'utf8'));
const ctx = vm.createContext({ console, layout, out:{} });
vm.runInContext(m[1] + `
S = migrate(layout);
computeNets();
out.nets = NET.nets.length;
out.findings = runDRC();
out.cuts = cutList();
out.build = buildList();
out.bom = bom();
out.wires = wireList();
out.md = buildMarkdown();
out.netlist = S.netlist ? checkNetlist(S.netlist) : null;
out.byName = {};
for(const r of netTableFromBoard()) out.byName[r.name] = r.members;
out.board = S.board;
out.name = S.name;
out.netTable = NET.nets.map(n => ({
  id: n.id,
  holes: n.holes.length,
  segs: n.segs.length,
  pads: padsOnNet(n).map(d => d.label),
  pins: pinsOnNet(n).map(p => p.ic.ref + '.' + p.pin +
        (IC_LIB[p.ic.part] && IC_LIB[p.ic.part].roles[p.pin] ? '(' + IC_LIB[p.ic.part].roles[p.pin] + ')' : '')),
  parts: connections().filter(c => c.kind === 'lead' && NET.netAt(c.at[0], c.at[1]) &&
         NET.netAt(c.at[0], c.at[1]).id === n.id).map(c => c.label),
}));
`, ctx, { filename:'model' });

const o = ctx.out;

if(asJson){
  /* every number here was worked out from the copper a moment ago, so it
     cannot be stale the way a stored copy could be */
  console.log(JSON.stringify({
    name: o.name, board: o.board,
    nets: o.byName,
    findings: o.findings.map(f => ({sev:f.sev, rule:f.rule, msg:f.msg, at:f.at, why:f.why})),
    cuts: o.cuts, bom: o.bom, wires: o.wires,
  }, null, 2));
  process.exit(o.findings.some(f => f.sev === 'error') ? 1 : 0);
}
console.log('\n' + layout.name + '   ' + layout.board.rows + ' x ' + layout.board.cols +
            '   ' + o.nets + ' nets\n');

console.log('NETS');
for(const n of o.netTable){
  const members = [].concat(n.pads.map(s => '[' + s + ']'), n.pins, n.parts);
  if(!members.length) continue;
  console.log('  ' + String(n.id).padStart(2) + '  ' + String(n.holes).padStart(2) + 'h  ' +
              members.join('  '));
}

console.log('\nPARTS');
for(const r of o.bom)
  console.log('  ' + String(r.qty).padStart(2) + ' x  ' + r.name.padEnd(13) +
              (r.what || '-').padEnd(9) + (r.note ? '(' + r.note + ')' : '').padEnd(14) +
              r.refs.join(' '));

console.log('\nDRC');
if(!o.findings.length){
  console.log('  clean — nothing shorted, nothing floating, nothing off the board');
}else{
  for(const f of o.findings){
    console.log('  ' + f.sev.toUpperCase().padEnd(5) + ' ' + f.rule.padEnd(12) + ' ' + f.msg);
    /* the consequence, wrapped under the finding it belongs to */
    if(f.why){
      let line = '';
      for(const w of f.why.split(' ')){
        if((line + ' ' + w).length > 74){ console.log('        ' + line); line = w; }
        else line = line ? line + ' ' + w : w;
      }
      if(line) console.log('        ' + line);
    }
  }
}
if(o.netlist){
  console.log('');
  console.log('NETLIST');
  if(!o.netlist.findings.length){
    console.log('  matches — ' + o.netlist.declared + ' declared nets, ' +
                o.netlist.resolved + ' connections checked');
  }else{
    for(const f of o.netlist.findings) console.log('  ' + f.rule.padEnd(16) + ' ' + f.msg);
  }
  if(o.netlist.unmentioned.length)
    console.log('  not mentioned:   ' + o.netlist.unmentioned.join(' '));
}
console.log('');
const bad = o.findings.some(f => f.sev === 'error') ||
            (o.netlist && o.netlist.findings.length > 0);
process.exit(bad ? 1 : 0);
