/* Run a saved layout through the model and report what the DRC makes of it.
 *
 *   node test/check-layout.js layouts/optical-theremin.json
 *
 * Same trick as fixture.test.js: the model is lifted verbatim out of the app,
 * so this is the real checker, not a reimplementation of it.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const target = process.argv[2];
if(!target){ console.error('usage: node test/check-layout.js <layout.json>'); process.exit(2); }

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
out.wires = wireList();
out.md = buildMarkdown();
out.netlist = S.netlist ? checkNetlist(S.netlist) : null;
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
console.log('\n' + layout.name + '   ' + layout.board.rows + ' x ' + layout.board.cols +
            '   ' + o.nets + ' nets\n');

console.log('NETS');
for(const n of o.netTable){
  const members = [].concat(n.pads.map(s => '[' + s + ']'), n.pins, n.parts);
  if(!members.length) continue;
  console.log('  ' + String(n.id).padStart(2) + '  ' + String(n.holes).padStart(2) + 'h  ' +
              members.join('  '));
}

console.log('\nDRC');
if(!o.findings.length){
  console.log('  clean — nothing shorted, nothing floating, nothing off the board');
}else{
  for(const f of o.findings)
    console.log('  ' + f.sev.toUpperCase().padEnd(5) + ' ' + f.rule.padEnd(12) + ' ' + f.msg);
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
