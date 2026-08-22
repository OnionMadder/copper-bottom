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
const script = /<script>([\s\S]*)<\/script>/.exec(html);
if(!script){ console.error('no <script> block found in copper-bottom.html'); process.exit(2); }
try{
  new vm.Script(script[1], {filename:'copper-bottom.html <script>'});
  console.log('  PASS  the whole <script> block parses');
}catch(err){
  console.error('\n  FAIL  copper-bottom.html <script> does not parse:\n        ' + err.message + '\n');
  process.exit(1);
}

const m = /\/\*#region model[^*]*\*\/([\s\S]*?)\/\*#endregion model \*\//.exec(html);
if(!m){ console.error('could not find the #region model markers in copper-bottom.html'); process.exit(2); }

const checks = fs.readFileSync(path.join(__dirname, 'checks.js'), 'utf8');
const ctx = vm.createContext({ console, process });
vm.runInContext(m[1] + '\n' + checks, ctx, { filename:'model+checks' });
