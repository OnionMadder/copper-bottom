/* Regression test for the connectivity engine and the build documentation.
 *
 * The model is extracted verbatim from copper-bottom.html between the
 * #region model markers, so there is exactly one source of truth --
 * this test cannot drift from the app.
 *
 *   node test/fixture.test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.join(__dirname, '..', 'copper-bottom.html');
const html = fs.readFileSync(file, 'utf8');

/* Parse the whole script first. The model tests below only ever see the model
 * region, so a syntax error anywhere else -- in the renderer, the export code,
 * the event wiring -- would leave every test passing while the app itself
 * failed to start. That happened once. It does not get to happen twice. */
/* EVERY block, not the first and not one greedy match across all of them.
 * The app grew a second <script> in <head> on Aug 27 2026 - the one that sets
 * the theme before the stylesheet is parsed - and the old greedy pattern
 * quietly began capturing the HTML between the two, so this failed on markup
 * rather than on code. A per-block, non-greedy sweep is what the comment
 * above always claimed this was. Built with RegExp() and [^] so the pattern
 * carries no backslashes to be mangled by whatever edits this next. */
const blocks = [];
const reScript = new RegExp('<script>([^]*?)</script>', 'g');
let sm;
while((sm = reScript.exec(html)) !== null) blocks.push(sm[1]);
if(!blocks.length){ console.error('no <script> block found in copper-bottom.html'); process.exit(2); }
blocks.forEach((src, i) => {
  const where = 'copper-bottom.html <script> ' + (i + 1) + ' of ' + blocks.length;
  try{
    new vm.Script(src, {filename:where});
  }catch(err){
    console.error('  FAIL  ' + where + ' does not parse: ' + err.message);
    process.exit(1);
  }
});
console.log('  PASS  all ' + blocks.length + ' <script> blocks parse');

/* ---- US spelling, watched by a machine instead of by whoever reads the diff */
const spelling = require('./spelling.js');
const selfFail = spelling.selfTest();
if(selfFail){
  console.error('  FAIL  the spelling check is broken: ' + selfFail);
  process.exit(1);
}
const brit = spelling.findBriticisms(html);
if(brit.length){
  console.error('  FAIL  British spelling in copper-bottom.html (this app is US English):');
  for(const b of brit.slice(0, 25)) console.error('          line ' + b.line + ': ' + b.word);
  if(brit.length > 25) console.error('          ... and ' + (brit.length - 25) + ' more');
  process.exit(1);
}
console.log('  PASS  US spelling (' + spelling.BRITICISMS.length +
            ' words watched; NETCOLOUR and aria-labelledby exempt by word boundary)');

const m = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if(!m){ console.error('could not find the #region model markers in copper-bottom.html'); process.exit(2); }

const checks = fs.readFileSync(path.join(__dirname, 'checks.js'), 'utf8');
const ctx = vm.createContext({ console, process });
vm.runInContext(m[1] + '\n' + checks, ctx, { filename:'model+checks' });
