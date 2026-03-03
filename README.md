# Preference Management Apps

This folder organizes multiple small web apps under a single entry point.

## Structure

- index.html (home menu)
- apps/
  - sam/
    - index.html
    - app.js
  - daf/
    - index.html
    - DAF.js
  - ihk/
    - index.html
  - affidavit/
    - index.html
- analizator/
  - index.html
  - app.js
  - style.css
- shared/
  - css/
    - styles1.css (SAM/DAF)
    - test.css (IHK/Affidavit)
    - styles2.css (Home page buttons)
  - js/
    - main.js (PDF generation for IHK/Affidavit)

## Usage

Open `index.html` and click an app button. Ensure you serve files from the `Javascript app` folder so relative paths resolve.

## Notes

- External libraries are loaded via CDN where needed (e.g., pdfmake, pdf.js).
- If you later move or rename folders, update links in the respective HTML files accordingly.
