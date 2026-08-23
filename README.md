# Copper Bottom

A stripboard layout editor that tells you what's actually connected to what.

Named for the copper bottom of the board — the side you flip to, the side you cut —
and for *copper-bottomed*, meaning a thing you can rely on.

Single self-contained HTML file. No build step, no install, no server — double-click
`copper-bottom.html` and it opens. Works offline at the bench.

```bash
node test/fixture.test.js
```

555 checks against the CD40106 two-voice fixture. The test parses the entire `<script>`
block first, then extracts the model verbatim from `copper-bottom.html` (between the
`#region model` markers) and runs against that, so it can't drift from the app. Every
DRC rule has both a positive test (it fires when it should) and a negative one (it
stays quiet when it shouldn't).

The parse check exists because a stray escaped apostrophe once broke the whole script
while every model test still passed — the model region parsed fine on its own, so
nothing noticed the app would not start.

Saved layouts live in `layouts/`. To check one without opening the app:

```bash
node test/check-layout.js layouts/optical-theremin.json
```

It lifts the same model out of the app and prints the net table — every node with the
pads, IC pins and part leads sitting on it — followed by the DRC. Reading the net table
is the real check: it says what the circuit *is*, where the DRC only says nothing is
obviously broken. Exit code is non-zero if there are errors, so it suits a pre-commit hook.

## Status

| Milestone | |
|---|---|
| M0 board and cuts | done |
| M1 two-lead parts, links, inspect, undo | done |
| M2 ICs with auto-cuts and pin resolution | done |
| M3 DRC panel | done |
| schema v2 — multi-leg parts | done |
| select, move, edit | done |
| M4 build sheet — 1:1 export, mirrored view, cut list, build order | done |
| region duplicate | done |
| insert / delete a row or column | done |
| drag a single lead | done |
| rotate a part or a block | done |
| pad destinations | done |
| netlist check (optional) | done |
| body collision DRC | done |
| footprint editor | done |
| lead-span DRC + diode packages | done |
| bill of materials | done |
| chip library — ~40 parts, shared family pinouts | done |
| explain layer — what a hole is FOR, not just what it is | done |
| pin descriptions for all 40 parts | done |
| supply-voltage ranges + the supply-range DRC | done |
| decoupling advice + what each part is for | done |
| reference pane — a schematic beside the board | done |
| diode + resistor types with their own symbols | done |

Layouts autosave to browser storage, and `export .json` / `import` move them between
machines. Old v1 files still load.

See `ROADMAP.md` for what's next.

## Keys

| | | | |
|---|---|---|---|
| `V` inspect | `S` select / move | `A` region | `B` rows & cols |
| `X` cut | `J` wire link | `R` resistor | `C` capacitor |
| `E` electrolytic (first hole is `+`) | `D` diode (band on the second hole) | `Q` transistor | `W` trimpot |
| `G` regulator | `U` IC / DIP | `P` pad | `N` strip colour |
| `[` `]` zoom | `,` `.` turn the selection | `Esc` cancel / deselect | `Del` erase tool, or delete the selection |

`Ctrl+Z` / `Ctrl+Shift+Z` undo and redo everything.

Parts take one click per leg — two for a resistor, three for a transistor. Refs
auto-increment. Placing an IC inserts the column of cuts between its pin rows
automatically, and dragging that IC takes its cuts with it.

With `S`, click a part or IC to pick it up: drag to move, arrow keys to nudge one hole,
`Del` to remove. A selected part grows a green handle on each leg — drag one of those and
only that leg moves, so a resistor whose far end is already placed can be restretched
without disturbing it. Works on three-leg parts too, which is how you splay a transistor. The left panel edits ref, value, device and kind in place — the kind
list only offers parts with the same number of legs, so a resistor can become a diode
but never a transistor.

## Regions

A 40106 gives you six identical voices. Laying the second one out by hand is tedious;
laying out the sixth is a mistake waiting to happen.

`A`, then click two opposite corners to box off a block. **Only things wholly inside
count** — a resistor with one lead outside the box belongs to the circuitry around it,
and copying half of it means nothing. The panel reports what it caught, and offers a row
and column offset with **duplicate**, **move** and **delete contents**.

The offset defaults to one block-height straight down, which is what you want for another
voice of the same circuit. Duplicating renumbers as it goes — a copied `R1 R2` becomes
`R3 R4` — and the block then walks along by the offset, so clicking duplicate again tiles
the next copy rather than stacking a second one on the first. Copy a DIP and its
auto-cuts come with it. An offset that would run off the board disables the buttons
rather than silently clipping.

## Rows and columns

Running out of room one row short shouldn't mean moving the whole layout by hand.

`B`, then click any hole — its row and column light up and the panel offers to insert or
delete either. Inserting pushes everything past the line along and **stretches anything
spanning it**, so a capacitor reaching across the new row simply gets longer. Deleting
closes the gap the same way, and takes whatever was sitting on the line with it; the
panel says what went, and undo brings it back.

A DIP can't stretch. Rather than silently tearing a chip away from what it was wired to,
inserting a line that runs through one is refused and tells you which chip. Move it
first. Deleting through a chip does remove it, along with its auto-cuts — that's what
deleting the row it lives on means.

## Footprints

A chip's pins are derived from `pin1` and `span` — pins down one column, back up the
other, like a real DIP. Select an IC and hit **edit footprint** to break out of that: every
pin grows a numbered handle you can drag to any hole. Use it for a package that isn't a
plain DIP, a socket wired oddly, or a chip whose real pinout doesn't match the library.

Under the hood the chip gains a `pinMap` — one offset per pin, measured from `pin1`. That
keeps `pin1` as the anchor the whole shape hangs off, so moving, duplicating, rotating a
block and shifting a row all keep working untouched: they only ever move the anchor.

Two consequences worth knowing:

- **A shaped chip manages its own cuts.** There's no "column between the pin rows" any
  more, so the auto-cut column stops applying and the DIP-straddle warning goes quiet.
  Entering footprint mode *hands you* the existing cuts rather than deleting them — they
  stay on the board, the chip just stops owning them. `pin-short` still catches any two
  pins that end up sharing a strip, which is the check that actually matters.
- **back to a DIP** drops the map and the standard geometry returns.

## Turning things

On stripboard a quarter turn is not cosmetic. A resistor lying along a strip is shorted
out; the same resistor turned 90° spans strips and does its job. So rotation is an
electrical edit here, and the DRC re-runs on it like any other — turn R3 in the demo and
the `part-short` error appears the moment it lands.

`,` and `.` turn whatever is active, or use the panel buttons. A **part** turns about its
first leg, so that leg stays soldered where it is and every other lands exactly on a hole.
A **block** turns about its top-left corner, so the corner holds still and the footprint
transposes.

Two refusals, both for the same reason as the row/column one: a DIP straddles its strips
one way only, so neither a chip nor a block containing one will turn. And a turn that
would throw a leg off the board is refused rather than clipped — try the other direction,
which swings the opposite way.

## The netlist check — optional, always

Every other tool in this space starts from a schematic and checks the board against it.
That is the one door this tool refuses to make anyone walk through, so a netlist here is
a **second opinion you may supply, never a prerequisite**. No netlist means no opinion,
not "nothing is connected", and the ordinary DRC is unaffected either way.

The **netlist** button opens a pane: your description on the left, the verdict on the
right, updating as you type. One net per line:

    GND:    IC1.7 C1.B @GND
    V1_IN:  IC1.1 C1.A @V1_IN

`R1.A` is a part leg, `IC1.7` an IC pin, `@GND` a pad by its label. Legs are A/B, or the
real leg letters on a three-leg part (`E`/`B`/`C`). `#` starts a comment.

It reports two kinds of disagreement, which are the two ways a layout goes wrong:

- **declared together, actually apart** — "GND is broken into 2 pieces on the board", and
  it lists which members ended up in which piece
- **declared apart, actually together** — two of your nets that ended up sharing copper.
  Reported once per pair of names, however many strips it happens on: a part fitted the wrong
  way round collides on two strips at once, and both sightings naming the same component is
  the clue that the part is reversed rather than the wiring wrong

Anything on the board the netlist never mentions is listed but not flagged; you are often
describing only part of a circuit.

Why it earns its place: the plain DRC can only tell you a pin *looks* lonely. Delete the
link that grounds pin 7 of the demo and the DRC manages a warning — "IC1.7 is the only
thing on its net". The netlist says which node broke and into exactly which two pieces.
The netlist knows what you meant; the DRC can only see what you built.

The netlist saves inside the layout, so a shared `.json` carries its own proof.

## The build sheet

**build sheet** in the header opens the document you actually work from at the bench.
It is white on paper whatever the app's theme, and everything on it is printable.

- **Component side and solder side, both at true 1:1.** The SVG is authored in
  millimetres — 2.54 mm per hole — so the file carries real physical size and a printout
  at 100% can sit next to the board.
- **A calibration bar.** One inch, ticked at quarters, captioned *measure me*. No browser
  can be trusted to print at 100%, and a printout that lies about its scale is worse than
  no printout at all. Put a ruler on it before you trust the sheet.
- **The solder side is mirrored**, because that is how you see the board when you turn it
  over to cut tracks. The column numbers stay the layout's own and simply run right to
  left, so a coordinate from the cut list finds the same hole on either view. An arrow
  marks where hole `[0,0]` ends up — everyone gets that wrong once.
- **The cut list does the flip for you.** Alongside each cut's `[row, col]` it gives the
  hole number counting from the left edge *as seen from the back*. That mental flip is
  where builds die. Cuts are ordered row by row, left to right across the back.
- **Parts** is the same set collapsed into what you buy: quantities, values and the refs
  on each line. The build order answers *what do I solder next*; this answers *do I own
  all of this*, which is a question you want settled the night before rather than with an
  iron already hot. It counts by the part you order, so a resistor marked
  `mount:"vertical"` is still the same resistor and shares a line, while a DO-41 diode
  gets its own row because it is not a DO-35. Values sort by magnitude rather than
  alphabetically — 10n before 100n — and `4k7` reads the same as `4.7k`.
- **Build order** puts flat parts first and tall ones last — links, resistors, diodes, the
  IC, film caps, transistors, electrolytics, trimpots — so nothing blocks the iron.
- **Every row has a checkbox**, kept in memory and mirrored to localStorage. You are
  standing at a bench with an iron; you want to tick things off, not read a table. The
  boxes print as empty squares.
- **Off-board wiring** lists each pad, its hole, the hole number seen from the back, and
  where the wire goes. Select a pad with `S` and fill in **GOES TO** — "LDR1 leg 1",
  "output jack tip". Off-board wiring is where a working board becomes a non-working
  pedal, and it is the part no other tool writes down. Left blank, it still prints as a
  ruled column to fill in by hand.

`copy markdown` puts the whole thing on the clipboard as tables. `component .svg` and
`solder .svg` download the two views on their own.

## Parts

Two-leg: wire link, resistor, capacitor, electrolytic, diode.
Three-leg: transistor, trimpot, regulator.

Three-leg devices carry a **pinout**, and the leg letters are drawn on the board next to
each hole — `E B C` for a 2N5088, `C B E` for a BC547, `D S G` for a J201. Getting that
backwards is the classic stripboard build-killer. Stripboard Editor draws the TO-92
flat so you can see which way a part faces; naming the individual legs per device looks
to be ours.

Pinouts are read left to right with the flat face toward you and the legs pointing down. **Check
any device you're unsure of against its own datasheet** — packages vary by manufacturer,
and the library is a convenience, not an authority.

## DRC rules

Click any finding to ring the offending hole and pin its net. Hover to light the net.

| Severity | Rule |
|---|---|
| error | lead, pin or pad sits on a cut hole |
| error | lead, pin or pad is off the board |
| error | two pads naming different supply rails share a net |
| error | two pins of one IC share a net that carries no supply pad |
| error | two legs of one part share a net — shorted out |
| warn | a DIP straddles an uncut strip — offers a one-click fix |
| warn | two things share a hole |
| warn | a CMOS input pin connects to nothing |
| warn | a net has exactly one connection — goes nowhere |
| warn | two part bodies want the same physical space |
| warn | an axial part is wider than the holes it spans — will not lie flat |
| error | a chip is on a supply outside its datasheet range |
| warn | a chip is below its minimum supply |

### Lead span, and why it says "will not lie flat"

A 1/4W resistor is a 6.3 mm body. Give it two holes — 5.08 mm — and it cannot lie down.
Neither can a 1N5817 across one hole. Nothing else in the DRC sees this: the body-clash
rule asks whether two parts collide with *each other*, while this asks whether one part
collides with *its own holes*, which is a question about a single part in isolation.

Three things keep it from becoming noise, which is the fate it deserved as first imagined:

- **Axial parts only.** Leads leaving opposite ends of a package need the room. A film
  cap, a radial can or a TO-92 brings its leads out of one face, so a wide span is just
  splayed legs — normal, and not worth a word. `FOOTPRINT` records which style each kind
  has, so this is data rather than a special case.
- **It is a warning, and it says "will not lie flat", not "will not fit".** The stronger
  wording would be false. Standing an axial part on end is ordinary stripboard practice
  and takes two adjacent holes. What the builder needs told is that the board just got
  taller — which is the thing that bites when the lid goes on a 1590BB.
- **`mount:'vertical'` settles it for good.** Say once that a part stands up and the
  warning stops. The demo's R3 is a 0.2" span and now carries that flag, because standing
  up is what it always meant; leaving it unflagged made a deliberate choice look like an
  oversight.

Known limitation, chosen rather than missed: the body-clash rule still measures a vertical
part as though it were lying flat, so it can over-warn about collisions and will never
under-warn. The renderer draws stood-up parts flat too, and a check that disagreed with
the drawing would be the worse lie — see *How it draws*.

### Diodes come in two sizes, and the difference decides whether a board is buildable

`FOOTPRINT.diode` used to be DO-35 glass for every diode, so a 1N4001 or a 1N5817 was
drawn *and* checked about a third too small — small enough to pass a board that cannot be
built. `DIODE_PKG` now splits DO-35 (3.6 × 1.8 mm glass) from DO-41 (5.2 × 2.7 mm plastic),
and `DIODE_PKG_BY_VALUE` recognises the families that can be named with confidence —
1N400x, 1N540x and 1N58xx are DO-41; 1N4148, 1N4448 and 1N914 are DO-35.

An unrecognised value keeps the smaller default deliberately. Guessing the bigger body for
an unknown diode would invent errors that are not real, and a DRC that cries wolf gets
switched off. Set `pkg` on the part to say so explicitly and the guess is skipped.

Everything reaches a footprint through `footprintOf(part)` — the collision check, the lead
span check, and the drawing — so the one-table rule below still holds for packages too.

### Three rules deliberately narrower than the original plan

**IC pins on one net.** As first written this fired five times on the fixture that's
supposed to be clean: pin 7 plus the four tied-off unused inputs all correctly land on
ground. A net carrying a supply pad *is* a rail, and multiple pins on a rail is how CMOS
is meant to be built — so only unlabelled nets are flagged. Delete the `GND` pad and the
same layout does trip the rule, which is the test that proves the narrowing is a filter
and not a hole.

**Orphan nets.** The plan's version was "a net contains only one hole." Every cut near a
board edge makes one of those, so it would have been mostly noise. The rule now fires on
a net with exactly one *connection* — and not when that connection is an unused IC
output, because leaving an output open is correct practice. The fixture has four of them
(pins 6, 8, 10, 12) and stays quiet.

**Legs of one part on one net** is the discrete-component counterpart of the IC rule, and
schema v2 is what made it possible to write. A wire link exists precisely to merge nets,
so its two ends sharing one is the point of it — links are exempt. Anything else with two
legs on the same strip is shorted out: a resistor doing nothing, or a transistor with its
collector tied to its emitter. No supply-pad exemption here; unlike an IC, a discrete part
has no legitimate reason to put two legs on one rail.

### The body clash rule, and why it stays quiet so often

Two parts can be electrically perfect and still refuse to share the board. Footprints are
real package sizes in hole units — a 1/4W resistor is 6.3 × 2.4 mm, a radial can 4.5 mm —
and **the same table drives the drawing**, so nothing is ever tested against a size it
wasn't drawn at.

The subtlety is that a two-lead body can *slide along its own leads*. A can bridging two
holes has nowhere to go; the same can on leads bent across eight holes can be nudged
anywhere along them. So the rule only fires when **both** parts are pinned — under
0.6 holes of play — because that is the only case where the overlap is a fact rather than
something you solve by eye while soldering.

That is why the demo fixture stays clean even though C3 and C4 visibly overlap as drawn:
C3 is pinned, but C4 has three holes of slack, so you just nudge it. Plant two cans in
adjacent columns both bridging two holes and it fires immediately — and drag one lead to
give one of them room and it clears again.

It is a **warning**, never an error. The board still works electrically; you just have to
mount something differently. ICs are always pinned, so a part planted on top of a chip is
reported plainly as that.

Wire-link leads are excluded from connection counts throughout: a link defines a net, it
doesn't populate one. Counting its ends would hide exactly the dead nets this is for.

## How it draws

The board is deliberately quiet — copper-toned strips, so the parts and the cuts are
what your eye lands on. Hovering lights one net at full colour, which is the whole
point of the inspect tool: if every net is lit all the time, nothing is. `N` (or the
footer button) switches to painting every net at once if you want the full map.

Parts are drawn as the physical component, at real size:

- **resistors** carry decoded colour bands — `10k` draws brown-black-orange-gold, so
  you can check the layout against the part in your fingers without reading a number.
  The inspector spells the bands out too.
- **film caps** are blue boxes, **electrolytics** are dark cans with the silver stripe
  down the *negative* side, which is how the real part is marked. A `+` sits by the
  positive lead. **Diodes** carry the cathode band at the second hole clicked.
- **transistors and regulators** are TO-92 outlines with the flat facing their legs;
  **trimpots** are square with a wiper slot.
- **cuts** are drawn last, on top of everything. A DIP body sits directly over its own
  auto-cuts, and those are the cuts you have to make before the IC goes in — covering
  them was hiding the most important marks on the board.
- **pin 1** of a DIP gets a square pad, the way a silkscreen marks it.
- part labels are drawn in a second pass above every body and wire link, and sit on the
  bare lead where the part is long enough to leave room.

Bodies are scaled to real dimensions (a 1/4W resistor really is two holes long), which
means the drawing shows you when parts physically collide even though the layout is
electrically fine. In the demo fixture, C3 and C4 overlap — 4.5 mm cans one column
apart. Electrically correct, and you would have to splay them on the real board.
Turning that observation into a DRC rule is item 5 on the roadmap.

## Data model

Version 2. Parts store `pins: [[row,col], ...]` — one entry per leg, in click order.

```json
{ "id":"q1", "kind":"trans", "ref":"Q1", "device":"2N5088",
  "pins": [[9,15],[10,15],[11,15]] }
```

Version 1 stored two-lead parts as `a` / `b`. Those files still load: `migrate()` rewrites
them to `pins[]` on the way in, and the test suite covers the conversion. Two other
additions beyond the original plan:

- `ics[].autoCuts` — the cuts a DIP placement inserted, so erasing or moving the IC
  takes exactly those with it and leaves any hand-cut holes alone.
- `IC_LIB` and `LEG_LIB` in the source — pin counts, per-pin roles (`in` / `out` / `vdd` /
  `gnd`) and three-leg pinouts. Roles colour the pin numbers, and the floating-input rule
  can't exist without them. The part picker is built straight from
  `Object.keys(IC_LIB)`, so adding a chip is one entry and nothing else.

## The chip library

Around forty parts: the CMOS 4000 series a noise box reaches for (hex inverters and
buffers, the quad gate family, 4013, 4017, 4040, 4046, 4051, 4066), the op-amps a pedal
reaches for (TL07x/TL08x singles, duals and quads, 4558, 4580, 5532, 5534, LM358, LM324,
LM833, OPA134/2134), the NE555, and the odd-shaped ones — LM386, LM13700, PT2399.

Pinouts inside a family are written **once** and shared by reference — `GATE_QUAD2`,
`OPAMP_DUAL`, `OPAMP_QUAD`, `INV_HEX`, `BUF_HEX`. That is not tidiness. `CD4011` and
`CD4093` are the same arrangement, one entry had drifted from the other, and pins 8 and
10 sat swapped in both: a NAND input labelled as an output, which is exactly the pin the
floating-input rule is there to catch and exactly the pin it stayed silent on. Sharing
the table makes that class of drift impossible, and the test suite asserts the family
arrangements pin by pin.

**A pin left out of `roles` is deliberate.** It means the tool does not claim to know that
pin's direction — an analog switch throw on a 4066, a timing cap leg, an offset-null pin.
Saying nothing is honest, and it keeps the floating-input rule off pins where floating is
the normal case. For the same reason the PT2399 is marked `cmos:false` despite being CMOS
silicon: its `CC0`/`CC1` pins are meant to be left open on most delay builds, and the rule
is aimed at unbuffered logic inputs, not at every chip made on a CMOS process.

Two optional per-part fields say things the geometry cannot work out on its own. Both are
plain properties on the part, so `export .json` carries them and `import` returns them
without any migration:

- `mount: "vertical"` — this part stands on end. Only the lead-span rule reads it, and
  only to stay quiet.
- `pkg: "DO-35" | "DO-41"` — the diode body, when the value isn't one the library
  recognises. Overrides `DIODE_PKG_BY_VALUE`.

```json
{ "id":"d1", "kind":"diode", "ref":"D1", "value":"1N5817",
  "polarized": true, "pkg":"DO-41", "pins": [[0,2],[1,5]] }
```

## Licence

Copyright © 2026 Kellye Strickland. Released under the
[GNU General Public License v3.0](LICENSE).

Use it, study it, change it, share it. The one condition is that anything you build on
top of it stays free the same way — if you distribute a modified version, it carries the
same licence and the source goes with it.

That choice is deliberate rather than a default. The parts of this worth having are the
ideas: that the nets come from the board rather than a schematic, that a netlist is a
second opinion and never a gate, and that a check which knows a pin is a CMOS input can
say something a geometric one cannot. Those should stay where anyone can read them.
