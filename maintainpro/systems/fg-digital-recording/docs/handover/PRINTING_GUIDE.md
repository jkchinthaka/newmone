# Printing guide

Print output is A4 HTML + `@media print`. The application sidebar and action buttons are hidden in print CSS.

## What to print

| Action | URL / entry | Contents |
| --- | --- | --- |
| Print current record | Daily Records → Open → Print, or History → Print | Form header, identity, **actual saved answers**, recorder, checker, verifier, timestamps |
| Print monthly pack | Daily Records → Print monthly pack | Day columns of stored answers plus recorder/checker/verifier index |
| Print dispatch record | Same as current record for NMS/PPU/CL/18 | All ten samples |

## Expected print behaviour

- Portrait for cleaning and truck; landscape for cold room and dispatch monthly packs
- Black-and-white readable; colour is not required
- Draft prints warn that the record is not submitted
- Submitted prints use immutable snapshot answers
- Evaluation PASS/FAIL is measurement-only text

## Validation still required on a physical printer

Browser print-preview of populated records is the technical check. Company printer drivers, margins, and duplex settings remain an operator UAT item (`UAT-11`).
