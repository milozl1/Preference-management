// Global text constants for IHK PDF generation (prepare for future i18n)
// Each key holds multilingual variants or composite arrays.
window.IHK_TEXT = {
  // Only German and English retained (removed French variants)
  headings: [
    '(Langzeit-) Erklärung-IHK für den nichtpräferenziellen Ursprung gemäß Artikel 59-61 Zollkodex der Union (UZK)',
    '(Long-term) supplier’s declaration (CCI) for non-preferential origin as per Article 59-61 Union Customs Code (UCC)'
  ],
  goodsLeadIn: [
    'Der Unterzeichner erklärt, dass die nachstehend bezeichneten Waren 1):',
    'I, the undersigned, declare that the goods described below:'
  ],
  suppliedTo: [
    'Die (regelmäßig) geliefert werden an 2):',
    'Being (regularly) supplied to:'
  ],
  singleShipment: [
    'Diese Erklärung ist nur gültig für die unten genannte Sendung. (Einzelerklärung):',
    'This declaration is valid only for the below mentioned shipment:'
  ],
  longTerm: [
    'Diese (Langzeit-) Erklärung ist gültig für alle Sendungen dieser Waren vom 6):',
    'This declaration is valid for all shipments of these goods dispatched from:'
  ],
  undertake: customer => [
    `Der Unterzeichner verpflichtet sich ${customer} umgehend zu unterrichten, wenn diese Erklärung nicht mehr gültig ist 2).`,
    `I undertake to inform ${customer} immediately if this declaration is no longer valid.`
  ],
  footnotes: [
    'Fußnoten – nur zur Erläuterung:',
    'Footnotes – for explanation only:'
  ],
  detailedFootnotes: [
    '1). Warenbezeichnung, Handelsübliche Warenbezeichnung auf der Rechnung, z. B. Modellnummer / Commercial designation as used on the invoice, e. g. model no.',
    '2). Name und Anschrift (inkl. Staat) des Unternehmens, an das die Waren geliefert werden (Empfänger oder Käufer). / Name and address (country) of company to which goods are supplied (consignee or buyer).',
    '3). Nur eine Möglichkeit verwenden. Ausnahme: Kombination aus EU- und Nicht-EU-Ursprung erfordert klare Ursprungsangabe auf jedem Handelsdokument. / Only one option to be used. Exception: Mixed EU/non‑EU origin requires clear origin indication for each item on commercial documents.',
    '4). Ursprungsland (Mitgliedsstaat der EU). / Country of origin (member state of the EU).',
    '5). Ursprungsland außerhalb der EU – nur dann grundsätzlich IHK-Bescheinigung erforderlich; Drittlandsursprung mit Vorpapiere nachweisen. / Non-EU country of origin – CCI certification required only in these cases; origin must be proven.',
    '6). Datumsangabe nur bei Langzeiterklärung; Dauer max. 24 Monate (IHK-Bescheinigung max. 12). / Dates only for long-term declaration; period <=24 months (<=12 if certified).',
    '7). Zuständige IHK im Bezirk des Lieferanten. / Supplier’s local Chamber of Commerce.',
    '8). Erklärung kann als Vornachweis dienen (z.B. Ursprungszeugnis); Nachweise können angefordert werden. / Declaration may support origin documents; evidence may be requested.'
  ]
};
