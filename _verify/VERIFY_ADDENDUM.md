# Verification addendum — final build re-check (2026-11-21)

`VERIFICATION_REPORT.md` (wave 3, 11:00) records **56 PASS, 1 FAIL, 1 NEEDS-BROWSER**:
the FAIL is the scientific-calculator keypad `)` case (§(a) sci row, §(g)).

That FAIL **does not reproduce on the final build**. The full calc harness
(`_verify/calc-harness.js`) was re-run against the final generated pages,
and the standalone repro (`_verify/repro-sci-bracket.js`) was also re-run:

- Full harness, final build: **57 PASS, 0 FAIL, 1 NEEDS-BROWSER** (of 58).
- sci row: `expr (45+15)*3-100/4 = 155; keypad bracketed = 155;
  keypad unparenthesised = 65 (JS precedence); sin(30°) = 0.5` — PASS.
- Repro: `(2+3)=` keypad → `5`; `(2+3)*4=` keypad → `20`;
  `(45+15)*3-100/4` keypad → `155`; expr field → `155`; after `(2+3)`
  keypad, dExpr shows `(2+3)`, dNum `5`.
- Fresh `calc-results.json` (re-written by the re-run) shows the same
  57 / 0 / 1 counts.

The report's FAIL came from an intermediate build state; the shipped
code passes. The original `VERIFICATION_REPORT.md` is left untouched as
the record of that run.

Still outstanding (unchanged): `qrscan` NEEDS-BROWSER (camera +
BarcodeDetector path — no DOM-runnable core); QR Generator needs
internet (api.qrserver.com); `main.js` (search / theme / Recently Used)
has only been syntax-checked, never executed in a real browser — a
phone/browser test of the Calculate path with real values is still owed.
