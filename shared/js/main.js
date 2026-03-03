// Cache for already fetched stamp images (Data URLs)
const __stampCache = {};

// Exact address → stamp filename mapping (per user specification)
// Includes both provided and current datalist variant for the Innenleuchten address
const ADDRESS_STAMP_MAP = {
    'HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552': 'HKG stamp.jpg',
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-7967': 'HKG stamp.jpg', // user-provided (typo variant?)
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-79677': 'HKG stamp.jpg', // datalist variant
    'Hella Fahrzeugkomponenten GmbH, Dortmunder Str. 5, D-28199': 'HKG stamp.jpg',
    'HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85': 'HAN stamp.jpg',
    'UAB HELLA Lithuania, Oro parko str. 6, 54460': 'HLT stamp.jpg',
    'HELLA Romania SRL, Str. Hella Nr. 3, 307200': 'HRO stamp.png',
    'HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31': 'HSK stamp.jpg',
    'Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000': 'HSS stamp.jpg'
};

// Fallback prefix mapping (in case user only types the company part)
const PREFIX_STAMP_MAP = {
    'HELLA GmbH & Co. KGaA': 'HKG stamp.jpg',
    'Hella Innenleuchten Systeme GmbH': 'HKG stamp.jpg',
    'Hella Fahrzeugkomponenten GmbH': 'HKG stamp.jpg',
    'HELLA Autotechnik NOVA s.r.o.': 'HAN stamp.jpg',
    'UAB HELLA Lithuania': 'HLT stamp.jpg',
    'HELLA Romania SRL': 'HRO stamp.png',
    'HELLA Slovakia Lighting s.r.o.': 'HSK stamp.jpg',
    'Hella Saturnus Slovenija d.o.o.': 'HSS stamp.jpg'
};

function normalizeAddress(str){
    return (str || '').replace(/\s+/g,' ').trim();
}

function resolveStampFilename(lu){
    if(!lu) return null;
    const normalized = normalizeAddress(lu);
    if (ADDRESS_STAMP_MAP[normalized]) {
        return `./STAMPS/${ADDRESS_STAMP_MAP[normalized]}`;
    }
    // Try prefix match if full address not found
    const prefix = Object.keys(PREFIX_STAMP_MAP).find(p => normalized.startsWith(p));
    return prefix ? `./STAMPS/${PREFIX_STAMP_MAP[prefix]}` : null;
}
function fetchStampDataURL(lu){
    const path = resolveStampFilename(lu);
    if(!path) return Promise.resolve(null);
    if(__stampCache[path]) return Promise.resolve(__stampCache[path]);
    return fetch(path).then(r => {
        if(!r.ok) throw new Error('Stamp not found');
        return r.blob();
    }).then(blob => new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => { __stampCache[path] = reader.result; res(reader.result); };
        reader.readAsDataURL(blob);
    })).catch(()=> null);
}

// Generic image fetcher for logo (and could be reused)
function fetchImageDataURL(path){
    if(!path) return Promise.resolve(null);
    if(__stampCache[path]) return Promise.resolve(__stampCache[path]);
    return fetch(path).then(r => {
        if(!r.ok) throw new Error('Image not found');
        return r.blob();
    }).then(blob => new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => { __stampCache[path] = reader.result; res(reader.result); };
        reader.readAsDataURL(blob);
    })).catch(()=> null);
}

function generatePDF(){
    const customer = document.getElementById('denumire').value.trim();
    const lu = document.getElementById('lu2').value.trim();
    const shipmentRef = document.getElementById('eu_ursprung')?.value.trim();
    const langzeitVon = document.getElementById('langzeit_von')?.value;
    const langzeitBis = document.getElementById('langzeit_bis')?.value;
    const person = document.getElementById('person1').value.trim();
    const place = document.getElementById('place1').value.trim();
    const doc = document.getElementById('numar_doc').value.trim();
    const declarationType = document.querySelector('input[name="declarationType"]:checked')?.value || 'single';
    const lang = (document.getElementById('langSelect')?.value || 'DE').toUpperCase();
    const signatureData = (document.getElementById('signaturePreview')?.src || '').trim();
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;

    const tableRows = document.querySelectorAll('#data-table tbody tr');
    const bodyRows = [];
    tableRows.forEach(row => {
        const cells = Array.from(row.cells).slice(0,5).map(c => c.textContent.trim());
        if(cells.some(v => v)) bodyRows.push(cells);
    });
    const headersEN = ['Material Number','Customer Material Number','Description','Commodity Code','Country of Origin'];
    const headersDE = ['Materialnummer','Kundenmaterialnummer','Beschreibung','Warentarifnummer','Ursprungsland'];
    const chosenHeaders = lang === 'DE' ? headersDE : headersEN;
    const widthsDE = [85,115,'*',95,90];
    // Expand English widths to keep long labels single-line
    const widthsEN = [85,130,'*',95,90];
    const chosenWidths = lang==='DE'?widthsDE:widthsEN;
    const tableElement = {
        table:{
            headerRows:1,
            widths: chosenWidths,
            body:[chosenHeaders, ...bodyRows]
        },
        layout:{
            fillColor: (r) => r===0 ? '#0b4a84' : (r%2===1 ? '#f2f6fb' : null),
            hLineWidth: ()=>0.6,
            vLineWidth: ()=>0.6,
            hLineColor: ()=>'#b5c2cc',
            vLineColor: ()=>'#b5c2cc'
        }
    };
    const T = window.IHK_TEXT || {};
    const content = [];
    const headings = (T.headings || [
        '(Langzeit-) Erklärung-IHK für den nichtpräferenziellen Ursprung gemäß Artikel 59-61 Zollkodex der Union (UZK)',
        '(Long-term) supplier’s declaration (CCI) for non-preferential origin as per Article 59-61 Union Customs Code (UCC)'
    ]);
    content.push({ text: lang==='DE'?headings[0]:headings[1], style:'heading' });
    content.push({ text:`Document No.: ${doc}`, style:'docNumber', margin:[0,6,0,10] });
    const goodsLeadIn = (T.goodsLeadIn || [
        'Der Unterzeichner erklärt, dass die nachstehend bezeichneten Waren 1):',
        'I, the undersigned, declare that the goods described below:'
    ]);
    content.push({ text: lang==='DE'?goodsLeadIn[0]:goodsLeadIn[1], style:'lead' });
    content.push({ text:' ', margin:[0,4,0,0] });
    content.push(tableElement);
    content.push({ text:' ', margin:[0,10,0,0] });
    const suppliedTo = (T.suppliedTo || [
        'Die (regelmäßig) geliefert werden an 2):',
        'Being (regularly) supplied to:'
    ]);
    content.push({ text: lang==='DE'?suppliedTo[0]:suppliedTo[1], style:'lead' });
    content.push({ text: customer, style:'customer' });
    content.push({ text:' ', margin:[0,10,0,0] });
    if(declarationType==='single'){
        const singleShipment = (T.singleShipment || [
            'Diese Erklärung ist nur gültig für die unten genannte Sendung. (Einzelerklärung):',
            'This declaration is valid only for the below mentioned shipment:'
        ]);
        content.push({ text: lang==='DE'?singleShipment[0]:singleShipment[1], style:'lead' });
        content.push({ text: shipmentRef || '-', style:'customer' });
    } else {
        const longTermArr = (T.longTerm || [
            'Diese (Langzeit-) Erklärung ist gültig für alle Sendungen dieser Waren vom 6):',
            'This declaration is valid for all shipments of these goods dispatched from:'
        ]);
        content.push({ text: lang==='DE'?longTermArr[0]:longTermArr[1], style:'lead' });
        content.push({ text:`${langzeitVon} bis/to ${langzeitBis}`, style:'customer' });
    }
    content.push({ text:' ', margin:[0,10,0,0] });
    const undertake = (T.undertake ? T.undertake(customer) : [
        `Der Unterzeichner verpflichtet sich ${customer} umgehend zu unterrichten, wenn diese Erklärung nicht mehr gültig ist 2).`,
        `I undertake to inform ${customer} immediately if this declaration is no longer valid.`
    ]);
    content.push({ text: lang==='DE'?undertake[0]:undertake[1], style:'paragraph' });

    const logoPath = './STAMPS/LOGO.png';
    Promise.all([fetchImageDataURL(logoPath), fetchStampDataURL(lu)]).then(([logoData, stampData]) => {
        if(logoData){
            content.unshift({ columns:[{ width:'*', text:'' },{ image:logoData, width:100, alignment:'right', margin:[0,0,0,6]}], margin:[0,0,0,4] });
        }
        const STAMP_WIDTH = 120; // enlarged stamp width per user request
        const SIGNATURE_WIDTH = 60; // further reduced signature width
        const signatureBlock = {
            unbreakable:true,
            margin:[0,12,0,10],
            stack:[
                { canvas:[{ type:'line', x1:0,y1:0,x2:520,y2:0,lineWidth:1,lineColor:'#668099'}], margin:[0,0,0,6] },
                // Place moved beneath signature per user request; this row now only shows Legal Unit.
                { columns:[{ width:'*', text: lu, style:'signLeft' }, { width:'*', text:'', style:'signRight' }] },
                {
                    columns:[
                        stampData ? { image: stampData, width: STAMP_WIDTH, alignment:'left', margin:[0,6,0,4] } : { text:'', width: STAMP_WIDTH, margin:[0,6,0,4] },
                        { width:'*', text:'' }, // spacer in middle
                        signatureData ? { image: signatureData, width: SIGNATURE_WIDTH, alignment:'right', margin:[0,6,0,4] } : { text:'', width: SIGNATURE_WIDTH, margin:[0,6,0,4] }
                    ]
                },
                // Place directly under signature image.
                { text: place, style:'signRight', margin:[0,2,0,0] },
                { text:`Date: ${formattedDate}`, style:'signRight', margin:[0,4,0,0] },
                { columns:[{ width:'*', text:'' }, { width:'*', text: person, style:'signRight' }] },
                { columns:[{ width:'*', text:'' }, { width:'*', text:'Member of Foreign Trade Team', style:'signRight' }] },
                { canvas:[{ type:'line', x1:0,y1:0,x2:520,y2:0,lineWidth:1,lineColor:'#668099'}], margin:[0,6,0,0] }
            ]
        };
        content.push(signatureBlock);
        // Removed automatic generation disclaimer per user request.
        const footHead = (T.footnotes || ['Fußnoten – nur zur Erläuterung:', 'Footnotes – for explanation only:']);
        content.push({ text: lang==='DE'?footHead[0]:footHead[1], style:'footnoteHead' });
        const ftArr = (T.detailedFootnotes || [
            '1). Warenbezeichnung, Handelsübliche Warenbezeichnung auf der Rechnung, z. B. Modellnummer / Commercial designation as used on the invoice, e. g. model no.',
            '2). Name und Anschrift (inkl. Staat) des Unternehmens, an das die Waren geliefert werden (Empfänger oder Käufer). / Name and address (country) of company to which goods are supplied (consignee or buyer).',
            '3). Nur eine Möglichkeit verwenden. Ausnahme: Kombination aus EU- und Nicht-EU-Ursprung erfordert klare Ursprungsangabe auf jedem Handelsdokument. / Only one option to be used. Exception: Mixed EU/non‑EU origin requires clear origin indication for each item on commercial documents.',
            '4). Ursprungsland (Mitgliedsstaat der EU). / Country of origin (member state of the EU).',
            '5). Ursprungsland außerhalb der EU – nur dann grundsätzlich IHK-Bescheinigung erforderlich; Drittlandsursprung mit Vorpapiere nachweisen. / Non-EU country of origin – CCI certification required only in these cases; origin must be proven.',
            '6). Datumsangabe nur bei Langzeiterklärung; Dauer max. 24 Monate (IHK-Bescheinigung max. 12). / Dates only for long-term declaration; period <=24 months (<=12 if certified).',
            '7). Zuständige IHK im Bezirk des Lieferanten. / Supplier’s local Chamber of Commerce.',
            '8). Erklärung kann als Vornachweis dienen (z.B. Ursprungszeugnis); Nachweise können angefordert werden. / Declaration may support origin documents; evidence may be requested.'
        ]);
        if(lang==='DE'){
            ftArr.forEach(line => {
                const germanPart = line.split(' / ')[0];
                content.push({ text:germanPart, style:'footnoteItem' });
            });
        } else {
            ftArr.forEach(line => {
                const englishPart = line.split(' / ')[1] || line;
                content.push({ text:englishPart, style:'footnoteItem' });
            });
        }

        const styles = {
            heading:{ fontSize:13, bold:true, alignment:'center', margin:[0,0,0,2], color:'#0b4a84' },
            docNumber:{ fontSize:10, bold:true, alignment:'right', color:'#0b4a84' },
            lead:{ fontSize:10, margin:[0,2,0,2], alignment:'justify' },
            customer:{ fontSize:11, bold:true, alignment:'center', margin:[0,4,0,0] },
            paragraph:{ fontSize:10, alignment:'justify', margin:[0,2,0,0] },
            signLeft:{ fontSize:10, bold:true, alignment:'left' },
            signRight:{ fontSize:10, bold:true, alignment:'right' },
            footnoteIntro:{ fontSize:8, italics:true, alignment:'justify' },
            footnoteHead:{ fontSize:9, bold:true, margin:[0,4,0,2], color:'#0b4a84' },
            footnoteItem:{ fontSize:8, margin:[0,0,0,2], alignment:'justify' },
            tableHeader:{ bold:true, fontSize:9, color:'#fff', alignment:'center' }
        };
        tableElement.table.body[0] = tableElement.table.body[0].map(h => ({ text:h, style:'tableHeader', noWrap:true }));
        const docDefinition = {
            pageMargins:[30,36,30,40],
            content,
            styles,
            defaultStyle:{ fontSize:10 },
            footer:(currentPage,pageCount)=>({ text:`Page ${currentPage} / ${pageCount}`, alignment:'right', margin:[0,0,20,0], fontSize:8, color:'#4d5b66' })
        };
        pdfMake.createPdf(docDefinition).download(`IHK_${doc || 'document'}_${now.getFullYear()}.pdf`);
    });
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeAddress,
        resolveStampFilename,
        ADDRESS_STAMP_MAP,
        PREFIX_STAMP_MAP
    };
}
