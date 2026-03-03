# IHK Origin Certificate Generator

Generates a bilingual (DE/EN) origin declaration PDF (single shipment or long‑term) using client-side data only.

## Features

- Single vs Long-Term declaration toggle (radio buttons)
- Dynamic materials table with add/remove rows + auto-add on last cell edit
- Validation: required fields, non-empty material row, long-term range <= 24 months, date ordering
- Accessible form semantics (fieldset/legend, labels, ARIA states, focus styles)
- Internationalization-ready text dictionary (`text.js`)
- Conditional PDF sections (shipment reference OR date range) built via pdfMake
- Automatic stamp + logo embedding in PDF (based on Legal Unit)
- Auto-fill of Place field from selected Legal Unit address

## Form Fields (Required)

Legal Unit, Issuing Person, Place (auto-filled when Legal Unit matches known address), Customer Name, Document Number, and either:

- Single: Shipment Reference
- Long-Term: Valid From + Valid To (<= 24 months)

## Materials Table

Each row consists of: Material Number, Customer Material Number, Description, Commodity Code, Country of Origin.
Use Add Row to create empty rows. A new row is auto-created once you type in the last cell of the final row. Remove rows with the ✕ button.

## Validation Errors

Displayed in the red alert panel above the form. PDF generation is blocked until all issues are fixed.

## PDF Output

File name pattern: `IHK_<DocumentNumber>_<Year>.pdf` (falls back to `IHK_document_<Year>.pdf` if empty). Content includes headings (logo top-right), tabular data (empty rows skipped), declaration section (single or long-term), undertakings, and footnotes.

## Text Constants / i18n

`text.js` exposes `window.IHK_TEXT` used by `main.js` to construct multilingual sections. Extend by adding locale-specific arrays or language keys and modifying the build routine.

## Testing Helpers

`ihk.js` exposes `window.IHK_TEST_API` with:

- `monthDiff(startDate, endDate)` → integer month distance (adjusts if end day earlier)
- `validateDateRange(fromISO, toISO)` → `{ ok:boolean, months?, reason? }`

Open the console to manually assert:

```js
IHK_TEST_API.validateDateRange('2025-01-01','2026-01-01');
IHK_TEST_API.validateDateRange('2025-01-10','2027-02-09'); // exceeds 24 months
```

## Future Enhancements (Ideas)

- CSV import/export for materials
- Persistence (localStorage) / load template
- Column sorting and filtering
- Language switcher UI
- Keyboard shortcuts (Ctrl+Enter generate)
- Bulk row paste (multi-line clipboard to rows)
- Stamp preview + logo size adjustment UI

## Troubleshooting

- Empty PDF / missing rows: ensure at least one non-empty material row.
- Range hidden: check Long-Term selected; Single Shipment hides date range.
- Validation panel not visible: there are no current errors; force an error by clearing a required field to verify visibility.

## Dependencies

- pdfMake (loaded via CDN)
- SheetJS (xlsx) for Excel template import/export

No server required; open `apps/ihk/index.html` in a modern browser (Chrome, Edge, Firefox). For strict path resolution, serve via a lightweight HTTP server.

## Auto Place Mapping

The Place field is auto-filled when the Legal Unit input matches one of the known addresses:

```text
HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552           -> LIPPSTADT
Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-7967   -> WEMBACH
Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-79677  -> WEMBACH
Hella Fahrzeugkomponenten GmbH, Dortmunder Str. 5, D-28199  -> BREMEN
HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85 -> MOHELNICE
UAB HELLA Lithuania, Oro parko str. 6, 54460                -> KARMELAVA, KAUNAS DISTRICT
HELLA Romania SRL, Str. Hella Nr. 3, 307200                 -> GHIRODA - JUDETUL TIMIS
HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31      -> KOCOVCE
Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000 -> LJUBLJANA
```

Manual edits to Place after auto-fill are preserved unless the Legal Unit field is changed again to a mapped address.
