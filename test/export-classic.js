/* Render a saved layout to the classic share SVG, headless.
 *
 *   node test/export-classic.js <layout.json> <out.svg>
 *
 * Same trick as check-layout.js: the model is lifted verbatim out of the app.
 * classicSVG() lives outside the #region model markers, so it is lifted by
 * name as well - it is a pure string builder over S, so it needs no DOM.
 * Anything it reaches for that is neither in the model nor pulled in here
 * shows up as a plain ReferenceError naming the symbol.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const target = process.argv[2], outPath = process.argv[3];
if (!target || !outPath) {
  console.error('usage: node test/export-classic.js <layout.json> <out.svg>');
  process.exit(2);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'copper-bottom.html'), 'utf8');

const model = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if (!model) { console.error('could not find the #region model markers'); process.exit(2); }

/* lift classicSVG() by brace balance from its own declaration */
const start = html.indexOf('function classicSVG(){');
if (start < 0) { console.error('could not find classicSVG()'); process.exit(2); }
let depth = 0, end = -1;
for (let i = html.indexOf('{', start); i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) { console.error('classicSVG() has no closing brace'); process.exit(2); }
const exporter = html.slice(start, end);

/* helpers classicSVG() leans on that live outside the model region. Lifted by
 * their own source line so they cannot drift from the app either. */
const helpers = ['const esc =']
  .map(sig => {
    const i = html.indexOf(sig);
    if (i < 0) { console.error('could not find helper: ' + sig); process.exit(2); }
    return html.slice(i, html.indexOf('\n', i));
  })
  .join('\n');

const layout = JSON.parse(fs.readFileSync(target, 'utf8'));
const ctx = vm.createContext({ console, layout, out: {} });
vm.runInContext(model[1] + '\n' + helpers + '\n' + exporter + `
S = migrate(layout);
computeNets();
out.svg = classicSVG();
out.name = S.name;
`, ctx, { filename: 'model+classicSVG' });

fs.writeFileSync(outPath, ctx.out.svg, 'utf8');
console.log('wrote ' + outPath + '  (' + ctx.out.svg.length + ' bytes)  for "' + ctx.out.name + '"');
