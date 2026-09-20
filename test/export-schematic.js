/* Render a saved layout to a schematic SVG, headless.
 *
 *   node test/export-schematic.js <layout.json> <out.svg>
 *
 * Same lift as export-classic.js: the model region verbatim, then the drawing
 * functions by brace balance from their own declarations, so what is rendered
 * here cannot drift from what the app renders.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const [target, outPath] = process.argv.slice(2);
if (!target || !outPath) {
  console.error('usage: node test/export-schematic.js <layout.json> <out.svg>');
  process.exit(2);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'copper-bottom.html'), 'utf8');
const model = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if (!model) { console.error('could not find the #region model markers'); process.exit(2); }

function lift(sig) {
  const start = html.indexOf(sig);
  if (start < 0) { console.error('could not find: ' + sig); process.exit(2); }
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  console.error('no closing brace for: ' + sig);
  process.exit(2);
}
const oneLine = (sig) => {
  const i = html.indexOf(sig);
  if (i < 0) { console.error('could not find: ' + sig); process.exit(2); }
  return html.slice(i, html.indexOf('\n', i));
};

const layout = JSON.parse(fs.readFileSync(target, 'utf8'));
const ctx = vm.createContext({ console, layout, out: {} });
const src = [
  model[1],
  oneLine('const esc ='),
  oneLine('const SCH = {'),
  lift('function schSymbol('),
  oneLine('const TRANS_TERM = {'),
  lift('function schTransistor('),
  lift('function schematicSVG('),
  'S = migrate(layout); computeNets();',
  'out.svg = schematicSVG(); out.name = S.name;',
].join('\n');
vm.runInContext(src, ctx, { filename: 'model+schematicSVG' });

fs.writeFileSync(outPath, ctx.out.svg, 'utf8');
console.log('wrote ' + outPath + '  (' + ctx.out.svg.length + ' bytes)  for "' + ctx.out.name + '"');
