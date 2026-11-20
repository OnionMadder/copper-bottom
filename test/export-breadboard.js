/* Translate a saved layout onto a solderless breadboard, headless.
 *
 *   node test/export-breadboard.js <layout.json> <out.json>
 *
 * Writes what the app's "to breadboard" button shows, as data: the written
 * steps, the picture, and the self-check's verdict.
 *
 *   { name, version, failed, ok, problems, terminals, half, cols, notes, text, svg }
 *
 * `failed` is set when the app refuses to translate at all (DRC errors, an
 * empty board, a layout too big for one board); `ok` is the self-check, which
 * rebuilds connectivity from the planned holes and compares it with the
 * stripboard's nets. Nothing should be published from a result where `failed`
 * is set or `ok` is false, and the exit code says so: 0 clean, 1 refused or
 * failed, 2 usage.
 *
 * Same trick as export-classic.js: the model is lifted verbatim out of the
 * app, and breadboardSVG(), which lives outside the #region model markers, is
 * lifted by brace balance. Anything it reaches for that is in neither shows up
 * as a plain ReferenceError naming the symbol.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const target = args[0], outPath = args[1];
if (!target || !outPath) {
  console.error('usage: node test/export-breadboard.js <layout.json> <out.json>');
  process.exit(2);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'copper-bottom.html'), 'utf8');
const model = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if (!model) { console.error('could not find the #region model markers'); process.exit(2); }

function lift(signature) {
  const start = html.indexOf(signature);
  if (start < 0) { console.error('could not find ' + signature); process.exit(2); }
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  console.error(signature + ' has no closing brace'); process.exit(2);
}
function liftLine(signature) {
  const i = html.indexOf(signature);
  if (i < 0) { console.error('could not find helper: ' + signature); process.exit(2); }
  return html.slice(i, html.indexOf('\n', i));
}

/* each helper is named here only because a ReferenceError asked for it */
const LINES = ['const esc =', 'const MM = 2.54;'];
const extra = LINES.map(liftLine).concat([lift('function breadboardSVG(plan){')]).join('\n');
const layout = JSON.parse(fs.readFileSync(target, 'utf8'));
const ctx = vm.createContext({ console, layout, out: {} });
vm.runInContext(model[1] + '\n' + extra + `
S = migrate(layout);
computeNets();
const plan = breadboardPlan();
out.name = S.name;
out.version = APP_VERSION;
out.failed = plan.failed || null;
out.text = breadboardText(plan);
if(!plan.failed){
  out.ok = plan.check.ok;
  out.problems = plan.check.problems;
  out.terminals = plan.check.terminals;
  out.half = plan.half;
  out.cols = plan.cols;
  out.notes = plan.notes;
  out.svg = plan.check.ok ? breadboardSVG(plan) : null;
}
`, ctx, { filename: 'model+breadboardSVG' });

fs.writeFileSync(outPath, JSON.stringify(ctx.out, null, 1), 'utf8');
const o = ctx.out;
console.log((o.failed ? 'REFUSED ' : o.ok ? 'OK ' : 'FAILED ') + '"' + o.name + '"' +
            (o.failed ? '  ' + o.failed : '  ' + o.terminals + ' terminals, ' + o.cols + ' columns'));
process.exit(o.failed || !o.ok ? 1 : 0);
