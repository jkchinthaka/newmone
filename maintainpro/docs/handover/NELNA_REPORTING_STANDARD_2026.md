# Nelna Enterprise Report Standard 2026

Approved corporate layout for MaintainPro report files and print views.

## Logo

- Web: `apps/web/public/brand/nelna-group-logo.jpg`
- API: `apps/api/assets/brand/nelna-group-logo.jpg`
- Component: `apps/web/components/brand/nelna-logo.tsx`

The JPEG is embedded as supplied. Width is set and height follows the file. It is used when the organization name matches Nelna. Other tenant names are printed as text without the Nelna mark.

## Shared renderer

`apps/api/src/modules/reports/ners-layout.ts`

- PDF: A4 portrait, or landscape when a table has more than six columns. Header, green rule, title, Colombo timestamp, KPIs, table, coverage notes, page numbers.
- Excel: Summary, Data, and Filters sheets. Frozen header, autofilter, numeric cost cells, formula text prefixed with a quote.
- CSV stays a data file. It keeps the UTF-8 BOM and does not add a logo or title row. A truncation sentence is appended only when the export cap is hit, and the PDF/Excel coverage note says the file is not complete.

Central module exports in `reports.service.ts` use this renderer. Business totals are unchanged. RBAC still runs through `assertCanExportReport`.

## Print and QR

Report screens print the logo and title and hide the application sidebar, header, and navigation. Asset QR print keeps the existing QR image URL and adds the logo plus the asset tag. The encoded identifier is not changed. A physical scan was not performed.

## Not converted in this pass

Import workbooks (asset tag upload, ERP stock, vehicle master import) stay machine templates. Direct module exports outside `ReportsService` were not given a second copy of the layout. Browser print of work-order and inspection screens still uses the shared print CSS rather than a separate PDF job card.

## Tests

`apps/api/test/ners-layout.spec.ts` checks the PDF signature, title, workbook sheets, a numeric cell, and formula neutralization.
