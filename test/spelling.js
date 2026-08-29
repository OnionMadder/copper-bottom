/* American English, mechanically.
 *
 * This app is US English and had a de-Briticising pass once. It did not hold:
 * a later session put twenty of them back, mostly "colour" in comments, and
 * nobody noticed until a human read the diff and said "ew". A word list is a
 * thing a machine should be watching, not a person.
 *
 * The list is copied from the site's own _admin/checks.py so the two cannot
 * drift apart.
 *
 * Word boundaries do the exempting for free: NETCOLOUR has no boundary before
 * COLOUR, and aria-labelledby has none after labelled, so neither the
 * identifier nor the HTML attribute matches. That is ASSERTED below rather
 * than assumed - a guard that cannot fire is worse than no guard, because it
 * reads as coverage. Twice in one day a check here passed on something it
 * could not see.
 */
const BRITICISMS = [
  'centre', 'centred', 'colour', 'colours', 'coloured', 'grey', 'labelled',
  'moulded', 'recognise', 'recognised', 'behaviour', 'neighbour', 'maths',
  'travelling', 'pyjamas', 'aluminium', 'maximise', 'minimise', 'organise',
  'organised', 'favourite', 'litre', 'metre',
];

const B = String.fromCharCode(92);                 // a backslash, built not typed
const re = new RegExp(B + 'b(' + BRITICISMS.join('|') + ')' + B + 'b', 'gi');
const NL = String.fromCharCode(10);

function findBriticisms(text){
  const out = [];
  text.split(NL).forEach((line, i) => {
    let hit;
    re.lastIndex = 0;
    while((hit = re.exec(line)) !== null) out.push({ line: i + 1, word: hit[1] });
  });
  return out;
}

/* the guard's own guard */
function selfTest(){
  const miss = findBriticisms('let NETCOLOUR = false;  <div aria-labelledby="askTitle">');
  if(miss.length) return 'flags its own exemptions: ' + miss.map(m => m.word).join(', ');
  const hit = findBriticisms('/* the colour of the centre strip is grey */');
  if(hit.length !== 3) return 'missed a plain Briticism - it would pass forever';
  return null;
}

module.exports = { BRITICISMS, findBriticisms, selfTest };
