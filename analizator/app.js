// Configurare PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State management
let currentMaterials = [];
let filteredMaterials = [];
let detectedCompanyName = '';

// DOM Elements
const fileInput = document.getElementById('pdf-file');
const fileInputLabel = document.querySelector('.file-input-label');
const fileSelectedName = document.getElementById('file-selected-name');
const analyzeBtn = document.getElementById('analyze-btn');
const progressSection = document.getElementById('progress-section');
const progressText = document.getElementById('progress-text');
const resultsSection = document.getElementById('results-section');
const summarySection = document.getElementById('summary-section');
const filtersSection = document.getElementById('filters-section');
const materialsTable = document.getElementById('materials-table');
const materialsTableBody = document.getElementById('materials-tbody');
const noResultsMessage = document.getElementById('no-results-message');
const exportCsvBtn = document.getElementById('export-csv-btn');
const resetBtn = document.getElementById('reset-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const emailMissingCooBtn = document.getElementById('email-missing-coo-btn');
// Footer elements
const footerFileName = document.getElementById('footer-file-name');
const footerRowCount = document.getElementById('footer-row-count');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const themeToggleBtn = document.getElementById('theme-toggle');
const backToTopBtn = document.getElementById('back-to-top');
const printBtn = document.getElementById('print-btn');

// Statistici
const totalMaterialsEl = document.getElementById('total-materials');
const incompleteMaterialsEl = document.getElementById('incomplete-materials');
const completeMaterialsEl = document.getElementById('complete-materials');
const completionStatusEl = document.getElementById('completion-status');
const missingCooCountEl = document.getElementById('missing-coo-count');
const missingCommodityCountEl = document.getElementById('missing-commodity-count');
const prefInconsistentCountEl = document.getElementById('pref-inconsistent-count');

// Filtre
const filterMaterial = document.getElementById('filter-material');
const filterDescription = document.getElementById('filter-description');
const filterStatus = document.getElementById('filter-status');
const filterCommodity = document.getElementById('filter-commodity');
const filterCOO = document.getElementById('filter-coo');
const filterPreference = document.getElementById('filter-preference');
const filterPrefInconsistent = document.getElementById('filter-pref-inconsistent');

// App initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('LTSD app initialized');
    
    // Check File API support
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        showErrorMessage('Unsupported browser', 
            'Your browser does not support the features required to upload files.');
        analyzeBtn.disabled = true;
        return;
    }

    // Inițializare event listeners
    setupEventListeners();
    
    // Ensure DOM elements exist
    if (!fileInput || !analyzeBtn) {
        console.error('Missing DOM elements');
        return;
    }
    
    // Initial button state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Please select a PDF file first';
});

// Funcție pentru configurarea event listeners
function setupEventListeners() {
    // Event listeners pentru încărcarea fișierelor
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Drag and drop functionality
    if (fileInputLabel) {
        fileInputLabel.addEventListener('dragover', handleDragOver);
        fileInputLabel.addEventListener('dragleave', handleDragLeave);
        fileInputLabel.addEventListener('drop', handleDrop);
    }
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzePDF);
    }
    
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    if (emailMissingCooBtn) {
        emailMissingCooBtn.addEventListener('click', emailMissingCoo);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetApplication);
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    // Filtre în timp real
    if (filterMaterial) {
        filterMaterial.addEventListener('input', applyFilters);
    }
    if (filterDescription) {
        filterDescription.addEventListener('input', applyFilters);
    }
    if (filterStatus) {
        filterStatus.addEventListener('change', applyFilters);
    }
        if (filterCommodity) {
            filterCommodity.addEventListener('input', applyFilters);
        }
        if (filterCOO) {
            filterCOO.addEventListener('input', applyFilters);
        }
        if (filterPreference) {
            filterPreference.addEventListener('change', applyFilters);
        }
        if (filterPrefInconsistent) {
            filterPrefInconsistent.addEventListener('change', applyFilters);
        }

    // Footer actions
    if (helpBtn && helpModal) {
        const toggleModal = (show) => {
            if (show) helpModal.classList.remove('hidden');
            else helpModal.classList.add('hidden');
        };
        helpBtn.addEventListener('click', () => toggleModal(true));
        helpModal.addEventListener('click', (e) => {
            if (e.target.matches('[data-close-modal]') || e.target.classList.contains('modal')) {
                toggleModal(false);
            }
        });
    }
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const root = document.documentElement;
            const current = root.getAttribute('data-color-scheme');
            const next = current === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-color-scheme', next);
            themeToggleBtn.setAttribute('aria-pressed', String(next === 'dark'));
            themeToggleBtn.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
        });
    }
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    fileInputLabel.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    fileInputLabel.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    fileInputLabel.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelection({ target: { files: files } });
    }
}

// Handle file selection
function handleFileSelection(event) {
    console.log('File selection event triggered');
    
    const file = event.target.files[0];
    
    // Remove previous error messages
    removeErrorMessages();
    
    if (file) {
        console.log('File selected:', file.name, file.type, file.size);
        
        // Update selected file name
        fileSelectedName.textContent = file.name;
        fileSelectedName.classList.add('has-file');
        
        if (file.type === 'application/pdf') {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Document';
            analyzeBtn.classList.remove('btn--secondary');
            analyzeBtn.classList.add('btn--primary');
        } else {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Please select a valid PDF file';
            analyzeBtn.classList.remove('btn--primary');
            analyzeBtn.classList.add('btn--secondary');
            showErrorMessage('Invalid file type', 
                `The file "${file.name}" is not a valid PDF. Please select a PDF file.`);
            // Nu resetăm fileInput.value pentru a păstra numele fișierului
        }
    } else {
        console.log('No file selected');
        fileSelectedName.textContent = 'No file selected';
        fileSelectedName.classList.remove('has-file');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Please select a PDF file first';
        analyzeBtn.classList.remove('btn--primary');
        analyzeBtn.classList.add('btn--secondary');
    }
}

// Analyze the selected PDF
async function analyzePDF() {
    console.log('Analyze PDF function called');
    
    const file = fileInput.files[0];
    if (!file) {
        showErrorMessage('Missing file', 'Please select a PDF file first.');
        return;
    }

    if (file.type !== 'application/pdf') {
        showErrorMessage('Invalid file type', 'Please select a valid PDF file.');
        return;
    }

    // Clear previous errors
    removeErrorMessages();
    
    showProgressSection();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Processing...';
    analyzeBtn.classList.add('loading');

    try {
        progressText.textContent = 'Loading PDF document...';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
    progressText.textContent = 'Extracting text from document...';
        
        // Colectăm elementele de text cu poziții pentru toate paginile
        const totalPages = pdf.numPages;
        const pagesItems = [];
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const items = textContent.items.map(it => ({
                str: (it.str || '').trim(),
                x: it.transform?.[4] ?? 0,
                y: it.transform?.[5] ?? 0,
                dir: it.dir || 'ltr'
            })).filter(it => it.str.length > 0);
            pagesItems.push({ page: pageNum, items });
            progressText.textContent = `Processing page ${pageNum} of ${totalPages}...`;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Extract company name from the first page (text before the first ' / ' on the first non-empty line with delimiter)
        detectedCompanyName = extractCompanyNameFromFirstPage(pagesItems) || '';

    progressText.textContent = 'Analyzing tables and materials...';

        // Parsăm materialele din elementele cu poziții
    const materials = parseMaterialsFromItems(pagesItems, file.name);

        if (materials.length === 0) {
            throw new Error('No materials identified in the document (no valid rows detected).');
        }

        currentMaterials = materials;
        filteredMaterials = [...materials];
    // Update footer info
    if (footerFileName) footerFileName.textContent = file.name || '—';
    if (footerRowCount) footerRowCount.textContent = String(materials.length || 0);
        
    progressText.textContent = 'Generating results...';
        await new Promise(resolve => setTimeout(resolve, 250));
        displayResults();
        
    } catch (error) {
    console.error('Error while processing PDF:', error);
        hideProgressSection();
    showErrorMessage('Could not extract materials', 'Please verify the PDF is an LTSD with recognizable headers. If the problem persists, share a sample so we can adjust the parser.');
        
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Document';
        analyzeBtn.classList.remove('loading');
        analyzeBtn.classList.add('btn--primary');
    }
}

// Header terms used for detection (supports common variants)
const HEADER_SYNONYMS = {
    materialNumber: [/^material\b/i, /material\s*(no\.?|nr\.?|number)?/i],
    description: [/description/i, /descriere/i],
    commodityCode: [/commodity\s*code/i, /hs\s*code/i, /tariff\s*code/i, /customs\s*code/i],
    coo: [/\bcoo\b/i, /country\s*of\s*origin/i, /origin/i],
    preference: [/preference/i]
};

// Utility: normalize line text
function normalizeText(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
}

// Group text items by Y coordinate (tolerance)
function groupTextItemsByLine(items, tolerance = 2.5) {
    const lines = [];
    // sort by Y desc (top to bottom), then X asc
    const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
    for (const it of sorted) {
        let line = lines.find(l => Math.abs(l.y - it.y) <= tolerance);
        if (!line) {
            line = { y: it.y, items: [] };
            lines.push(line);
        }
        line.items.push(it);
    }
    // order items in each line by X asc
    lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
    // add full line text
    lines.forEach(l => {
        l.text = normalizeText(l.items.map(i => i.str).join(' '));
    });
    // lines already sorted top-to-bottom
    return lines;
}

// Detect header in a line and return columns mapping to X positions
function detectHeaderColumns(line) {
    const result = {};
    const lowerText = line.text.toLowerCase();
    // must contain at least two key fields to count as a header
    let matchedKinds = 0;
    const kinds = Object.keys(HEADER_SYNONYMS);
    for (const kind of kinds) {
        const patterns = HEADER_SYNONYMS[kind];
        const has = patterns.some(re => re.test(lowerText));
        if (has) matchedKinds++;
    }
    if (matchedKinds < 2) return null;

    // Determine X for each column label
    for (const [kind, patterns] of Object.entries(HEADER_SYNONYMS)) {
        let posX = undefined;
        for (const it of line.items) {
            const s = it.str.toLowerCase();
            if (patterns.some(re => re.test(s))) {
                posX = it.x;
                break;
            }
        }
        if (posX !== undefined) {
            result[kind] = posX;
        }
    }

    // Require at least materialNumber and description as anchors
    if (result.materialNumber === undefined || result.description === undefined) {
        return null;
    }

    // Build column order by X
    const ordered = Object.entries(result).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    return {
        anchors: result,
        order: ordered
    };
}

// Scan pages to find header anchors (column X positions)
function findHeaderAnchors(pagesItems) {
    try {
        for (const page of pagesItems) {
            const lines = groupTextItemsByLine(page.items);
            for (const line of lines) {
                const info = detectHeaderColumns(line);
                if (info && info.anchors) return info.anchors;
            }
        }
        return null;
    } catch {
        return null;
    }
}

// Build boundaries between columns based on header X positions
function buildColumnBoundaries(headerInfo) {
    const keys = headerInfo.order;
    const xs = keys.map(k => headerInfo.anchors[k]);
    xs.sort((a, b) => a - b);
    const boundaries = [];
    for (let i = 0; i < xs.length - 1; i++) {
        boundaries.push((xs[i] + xs[i + 1]) / 2);
    }
    // last boundary is +Infinity
    boundaries.push(Number.POSITIVE_INFINITY);
    return { keys, xs, boundaries };
}

// Split a line into columns using boundaries
function splitLineIntoColumns(line, boundaries, keys) {
    const buckets = new Array(keys.length).fill('').map(() => []);
    for (const it of line.items) {
        // găsește primul boundary > x
        let idx = boundaries.findIndex(b => it.x < b);
        if (idx === -1) idx = keys.length - 1;
        buckets[idx].push(it.str);
    }
    return buckets.map(parts => normalizeText(parts.join(' ')));
}

// Extract the company name from the first page: take the first non-empty line that contains ' / ' and keep the text before it
function extractCompanyNameFromFirstPage(pagesItems) {
    try {
        if (!Array.isArray(pagesItems) || pagesItems.length === 0) return '';
        const first = pagesItems.find(p => p.page === 1) || pagesItems[0];
        if (!first || !Array.isArray(first.items) || first.items.length === 0) return '';
        const lines = groupTextItemsByLine(first.items);
        let candidate = lines.find(l => (l.text || '').includes(' / '));
        if (!candidate) {
            candidate = lines.find(l => (l.text || '').trim().length > 0);
            if (!candidate) return '';
        }
        const before = String(candidate.text).split(' / ')[0].trim();
        // Basic sanitation: collapse spaces
        return before.replace(/\s+/g, ' ').trim();
    } catch (e) {
        return '';
    }
}

// Clean raw field values
function cleanFieldValues(obj) {
    const out = { ...obj };
    if (out.materialNumber) out.materialNumber = out.materialNumber.replace(/\s+/g, ' ').trim();
    if (out.description) out.description = out.description.replace(/\s+/g, ' ').trim();
    if (out.commodityCode) out.commodityCode = out.commodityCode.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (out.coo) {
        // extract ISO-2 if present in text
        const m = out.coo.toUpperCase().match(/\b[A-Z]{2}\b/);
        out.coo = m ? m[0] : out.coo.toUpperCase().trim();
    }
    if (out.preference) {
        const v = out.preference.toString().trim().toLowerCase();
        out.preference = v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '';
    }
    return out;
}

// Fallback heuristic if no clear header: try to identify row-like lines
function fallbackParseLines(lines) {
    const materials = [];
    for (const line of lines) {
        const text = line.text;
    // material number: alphanumeric at the start of the line
        const matMatch = text.match(/^([A-Z0-9\-\.]{4,})\s+(.+)$/i);
        if (!matMatch) continue;
        let materialNumber = matMatch[1];
        let rest = matMatch[2];
    // commodity code: 6-12 digits near the end
        const ccMatch = rest.match(/(\d[\d\s]{5,11}\d)/);
        let commodityCode = '';
        if (ccMatch) {
            commodityCode = ccMatch[1].replace(/\s+/g, '');
            rest = rest.replace(ccMatch[1], '').trim();
        }
    // COO: ISO-2 at the end
        const cooMatch = rest.match(/\b([A-Z]{2})\b$/i);
        let coo = '';
        if (cooMatch) {
            coo = cooMatch[1].toUpperCase();
            rest = rest.replace(cooMatch[1], '').trim();
        }
        // Preference Yes/No if present in the trailing segment
        let preference = '';
        const prefMatch = rest.match(/\b(Yes|No)\b/i);
        if (prefMatch) {
            preference = prefMatch[1];
            rest = rest.replace(prefMatch[1], '').trim();
        }
        const description = rest.trim();
        const row = cleanFieldValues({ materialNumber, description, commodityCode, coo, preference });
        materials.push({ ...row, status: getItemStatus(row) });
    }
    return materials;
}

// Main parser anchored on Material Number (8/9 digits)
function parseMaterialsFromItems(pagesItems, fileName) {
    console.log('Parsing PDF items (anchor by Material Number) for file:', fileName);

    // 1) Build all lines from all pages
    const allLines = pagesItems.flatMap(p => groupTextItemsByLine(p.items));
    // Try to detect header anchors to lock column positions (prevents picking values from other columns)
    const headerAnchors = findHeaderAnchors(pagesItems);

    const REGEX_MAT = /\b(?:\d{8}M|\d{8,9})\b/;
    const REGEX_CC = /\b\d{8}\b/;
    const REGEX_COO = /\b[A-Z]{2}\b/;
    const REGEX_PREF = /\b(?:Yes|No)\b/i;

    // 2) Segment into row blocks based on the leftmost 8/9-digit token
    const rows = [];
    let current = null;

    function startNewRowFromLine(line) {
        // find the leftmost 8/9-digit token in the line
        let best = null;
        for (const it of line.items) {
            const m = it.str.match(REGEX_MAT);
            if (m) {
                if (!best || it.x < best.x) {
                    best = { x: it.x, value: m[0] };
                }
            }
        }
        if (!best) return false;
        current = {
            materialNumber: best.value,
            matX: best.x,
            lines: [line]
        };
        rows.push(current);
        return true;
    }

    for (const line of allLines) {
        if (!line.text) continue;
    // If the line contains a new material number (leftmost), start a new row
        let hasNew = false;
        for (const it of line.items) {
            if (REGEX_MAT.test(it.str)) {
                // if we already had a row and a new material number appears, start a new one
                if (current) {
                    // finalizează rândul curent adăugând liniile curente (deja adăugate)
                }
                hasNew = startNewRowFromLine(line);
                break;
            }
        }
        if (!hasNew) {
            // belongs to current row (continued description or other columns)
            if (current) current.lines.push(line);
        }
    }

    if (rows.length === 0) {
    console.warn('No rows detected by material anchor; trying header or fallback.');
        // încercăm mai întâi antetul nostru
        const headerBased = (() => {
            const materials = [];
            let currentColumns = null;
            let keys = [];
            let lastRow = null;
            for (const page of pagesItems) {
                const lines = groupTextItemsByLine(page.items);
                for (const line of lines) {
                    const headerInfo = detectHeaderColumns(line);
                    if (headerInfo) {
                        const boundariesInfo = buildColumnBoundaries(headerInfo);
                        currentColumns = boundariesInfo;
                        keys = boundariesInfo.keys;
                        lastRow = null;
                        continue;
                    }
                    if (!currentColumns) continue;
                    const cols = splitLineIntoColumns(line, currentColumns.boundaries, keys);
                    const rowObj = { materialNumber: '', description: '', commodityCode: '', coo: '' };
                    cols.forEach((val, idx) => {
                        const k = keys[idx];
                        if (!k) return;
                        if (k === 'materialNumber') rowObj.materialNumber = val;
                        else if (k === 'description') rowObj.description = val;
                        else if (k === 'commodityCode') rowObj.commodityCode = val;
                        else if (k === 'coo') rowObj.coo = val;
                    });
                    const cleaned = cleanFieldValues(rowObj);
                    const hasAny = Object.values(cleaned).some(v => (v || '').length > 0);
                    const hasMaterial = (cleaned.materialNumber || '').length > 0;
                    if (!hasAny) continue;
                    if (!hasMaterial && lastRow) {
                        if (cleaned.description) {
                            lastRow.description = normalizeText(`${lastRow.description} ${cleaned.description}`);
                        }
                        if (cleaned.commodityCode && !lastRow.commodityCode) lastRow.commodityCode = cleaned.commodityCode;
                        if (cleaned.coo && !lastRow.coo) lastRow.coo = cleaned.coo;
                        lastRow.status = getItemStatus(lastRow);
                        continue;
                    }
                    if (hasMaterial) {
                        const finalRow = { ...cleaned };
                        finalRow.status = getItemStatus(finalRow);
                        materials.push(finalRow);
                        lastRow = finalRow;
                    }
                }
            }
            return materials;
        })();
        if (headerBased.length > 0) return headerBased;
        // fallback brut pe linii
        return fallbackParseLines(allLines);
    }

    // 3) Estimate median X for Commodity and COO columns
    const commodityXs = [];
    const cooXs = [];
    const prefXs = [];
    for (const r of rows) {
        const matX = r.matX;
        for (const l of r.lines) {
            for (const it of l.items) {
                if (it.x <= matX + 30) continue; // trebuie să fie la dreapta material number
                const within = (x, anchor) => (typeof anchor === 'number') ? Math.abs(x - anchor) <= 150 : (x < matX + 2000);
                // colectăm candidați 8 cifre pentru commodity în banda coloanei (dacă o știm)
                if (REGEX_CC.test(it.str) && within(it.x, headerAnchors?.commodityCode)) {
                    commodityXs.push(it.x);
                }
                // ISO2 pentru COO în banda coloanei COO (dacă o știm)
                if (REGEX_COO.test(it.str) && /^[A-Z]{2}$/.test(it.str) && within(it.x, headerAnchors?.coo)) {
                    cooXs.push(it.x);
                }
                // Preference (Yes/No) în banda coloanei Preference (dacă o știm)
                if (REGEX_PREF.test(it.str) && within(it.x, headerAnchors?.preference)) {
                    prefXs.push(it.x);
                }
            }
        }
    }

    function median(arr) {
        if (!arr.length) return undefined;
        const s = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    // If too few candidates, use default offsets from Material X
    const defaultCommodityOffset = 250;
    const defaultCooOffset = 360;
    let commodityXMedian = median(commodityXs) ?? (median(rows.map(r => r.matX)) + defaultCommodityOffset);
    let cooXMedian = median(cooXs) ?? (commodityXMedian + (defaultCooOffset - defaultCommodityOffset));
    let prefXMedian = median(prefXs) ?? (cooXMedian ? cooXMedian + 100 : commodityXMedian + 200);
    // Override with header anchors if available (authoritative positions)
    if (typeof headerAnchors?.commodityCode === 'number') commodityXMedian = headerAnchors.commodityCode;
    if (typeof headerAnchors?.coo === 'number') cooXMedian = headerAnchors.coo;
    if (typeof headerAnchors?.preference === 'number') prefXMedian = headerAnchors.preference;

    const TOL_X = 70; // pixel tolerance for column band

    // 4) Build final materials from rows
    const materials = [];
    for (const r of rows) {
        const matNum = (r.materialNumber || '').match(REGEX_MAT)?.[0] || '';
        if (!matNum) continue;
        const matX = r.matX;

        let descParts = [];
        let commodityCode = '';
        let coo = '';
        let preference = '';

        for (const l of r.lines) {
            const leftText = l.items.filter(it => it.x < (matX - 5)).map(it => it.str).join(' ').trim();
            if (leftText) descParts.push(leftText);
            // Commodity Code: primul token 8 cifre în fereastra mediană
            if (!commodityCode) {
                const ccCandidate = l.items.find(it => Math.abs(it.x - commodityXMedian) <= TOL_X && REGEX_CC.test(it.str));
                if (ccCandidate) {
                    const m = ccCandidate.str.match(REGEX_CC);
                    if (m) commodityCode = m[0];
                }
            }
            // COO: ISO2 în banda coloanei COO
            if (!coo) {
                const cooCand = l.items.find(it => Math.abs(it.x - cooXMedian) <= TOL_X && /^[A-Z]{2}$/.test(it.str));
                if (cooCand) coo = cooCand.str.toUpperCase();
            }
            // Preference Yes/No
            if (!preference) {
                const prefCand = l.items.find(it => Math.abs(it.x - prefXMedian) <= TOL_X && REGEX_PREF.test(it.str));
                if (prefCand) preference = prefCand.str.match(REGEX_PREF)?.[0] || '';
            }
        }

    // Relax search if not found in median bands
        if (!commodityCode) {
            outer: for (const l of r.lines) {
                for (const it of l.items) {
                    if (it.x > matX + 30 && it.x < matX + 600) {
                        const m = it.str.match(REGEX_CC);
                        if (m) { commodityCode = m[0]; break outer; }
                    }
                }
            }
        }
        if (!coo) {
            // Fallback COO: dacă știm coloana, lărgim puțin banda; altfel, nu trecem de coloana Preference (evită Exclusion of agreements)
            if (Number.isFinite(cooXMedian)) {
                fallback_band: for (const l of r.lines) {
                    for (const it of l.items) {
                        if (Math.abs(it.x - cooXMedian) <= (TOL_X + 40) && /^[A-Z]{2}$/.test(it.str)) {
                            coo = it.str.toUpperCase();
                            break fallback_band;
                        }
                    }
                }
            } else {
                const maxX = Number.isFinite(prefXMedian) ? (prefXMedian - 15) : (matX + 600);
                outer2: for (const l of r.lines) {
                    for (const it of l.items) {
                        if (it.x > matX + 30 && it.x < maxX && /^[A-Z]{2}$/.test(it.str)) {
                            coo = it.str.toUpperCase();
                            break outer2;
                        }
                    }
                }
            }
        }
        if (!preference) {
            // broaden fallback band significantly
            outer3: for (const l of r.lines) {
                for (const it of l.items) {
                    if (it.x > matX + 30 && it.x < matX + 3000 && REGEX_PREF.test(it.str)) {
                        preference = it.str.match(REGEX_PREF)?.[0] || '';
                        break outer3;
                    }
                }
            }
        }
        if (!preference) {
            // final catch-all: pick the Yes/No closest to the expected X, if any
            let best = null;
            for (const l of r.lines) {
                for (const it of l.items) {
                    if (REGEX_PREF.test(it.str)) {
                        const d = Math.abs((prefXMedian || (matX + 500)) - it.x);
                        if (!best || d < best.d) best = { d, v: it.str.match(REGEX_PREF)?.[0] };
                    }
                }
            }
            if (best) preference = best.v || '';
        }

        const row = cleanFieldValues({
            materialNumber: matNum,
            description: normalizeText(descParts.join(' ')),
            commodityCode,
            coo,
            preference
        });
        materials.push({ ...row, status: getItemStatus(row) });
    }

    // If no/very few materials, try fallbacks
    if (materials.length === 0) {
        console.warn('Anchor-based parsing produced 0 rows; trying fallback.');
        const fb = fallbackParseLines(allLines);
        return fb;
    }

    return materials;
}

// NOTĂ: generatorul de date simulate a fost eliminat în favoarea parserului real.

// Determine material status
function getItemStatus(item) {
    const missingCOO = !item.coo || item.coo.trim() === '';
    const missingCommodity = !item.commodityCode || item.commodityCode.trim() === '';
    const prefYesNonEU = isPreferenceInconsistent(item);
    
    if (missingCOO && missingCommodity) {
        return 'missing-both';
    } else if (missingCOO) {
        return 'missing-coo';
    } else if (missingCommodity) {
        return 'missing-commodity';
    } else if (prefYesNonEU) {
        return 'pref-inconsistent';
    } else {
        return 'complete';
    }
}

// EU country list for COO validation (ISO-2)
const EU_ISO2 = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
    // Common alias used by EU for Greece
    'EL'
]);

function normalizeCooIso2(code) {
    const up = (code || '').toUpperCase();
    // Map EU alias EL -> GR (Greece)
    if (up === 'EL') return 'GR';
    return up;
}

function isPreferenceInconsistent(item) {
    if (!item) return false;
    const pref = (item.preference || '').toLowerCase();
    const coo = normalizeCooIso2(item.coo || '');
    if (pref === 'yes' && coo && !EU_ISO2.has(coo)) return true;
    return false;
}

// Display results
function displayResults() {
    hideProgressSection();
    updateSummaryStats();
    renderMaterialsTable();
    showResultsSection();
}

// Update summary stats
function updateSummaryStats() {
    const total = currentMaterials.length;
    const incomplete = currentMaterials.filter(m => m.status !== 'complete').length;
    const complete = total - incomplete;
    const missingCoo = currentMaterials.filter(m => m.status === 'missing-coo' || m.status === 'missing-both').length;
    const missingCommodity = currentMaterials.filter(m => m.status === 'missing-commodity' || m.status === 'missing-both').length;
    const prefInconsistent = currentMaterials.filter(m => isPreferenceInconsistent(m)).length;
    
    totalMaterialsEl.textContent = total;
    incompleteMaterialsEl.textContent = incomplete;
    completeMaterialsEl.textContent = complete;
    if (missingCooCountEl) missingCooCountEl.textContent = missingCoo;
    if (missingCommodityCountEl) missingCommodityCountEl.textContent = missingCommodity;
    if (prefInconsistentCountEl) prefInconsistentCountEl.textContent = prefInconsistent;
    
    // Completion status
    const completionPercentage = total > 0 ? Math.round((complete / total) * 100) : 0;
    
    if (incomplete === 0) {
        completionStatusEl.textContent = `✅ All materials have complete data (${completionPercentage}%)`;
        completionStatusEl.className = 'completion-status complete';
    } else {
        completionStatusEl.textContent = `⚠️ ${incomplete} materials have incomplete data (${completionPercentage}% complete)`;
        completionStatusEl.className = 'completion-status incomplete';
    }
}

// Render materials table
function renderMaterialsTable() {
    if (!materialsTableBody) return;
    
    materialsTableBody.innerHTML = '';
    
    if (filteredMaterials.length === 0) {
        materialsTable.style.display = 'none';
        noResultsMessage.classList.remove('hidden');
        return;
    }
    
    materialsTable.style.display = 'table';
    noResultsMessage.classList.add('hidden');
    
    filteredMaterials.forEach(material => {
        const row = createMaterialRow(material);
        materialsTableBody.appendChild(row);
    });
}

// Create table row
function createMaterialRow(material) {
    const row = document.createElement('tr');
    
    const materialNumberCell = document.createElement('td');
    materialNumberCell.textContent = material.materialNumber;
    
    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = material.description;
    
    const commodityCodeCell = document.createElement('td');
    if (material.commodityCode && material.commodityCode.trim() !== '') {
        commodityCodeCell.textContent = material.commodityCode;
    } else {
        commodityCodeCell.innerHTML = '<span class="missing-data">Missing</span>';
    }
    
    const cooCell = document.createElement('td');
    if (material.coo && material.coo.trim() !== '') {
        cooCell.textContent = material.coo;
    } else {
        cooCell.innerHTML = '<span class="missing-data">Missing</span>';
    }
    
    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${material.status}`;
    
    switch (material.status) {
        case 'complete':
            statusBadge.textContent = 'Complete';
            break;
        case 'missing-coo':
            statusBadge.textContent = 'Missing COO';
            break;
        case 'missing-commodity':
            statusBadge.textContent = 'Missing Commodity Code';
            break;
        case 'missing-both':
            statusBadge.textContent = 'Both Missing';
            break;
        case 'pref-inconsistent':
            statusBadge.textContent = 'Preference Yes but COO non‑EU';
            break;
    }
    
    statusCell.appendChild(statusBadge);
    
    row.appendChild(materialNumberCell);
    row.appendChild(descriptionCell);
    row.appendChild(commodityCodeCell);
    row.appendChild(cooCell);
    // Preference cell
    const prefCell = document.createElement('td');
    prefCell.textContent = material.preference || '';
    row.appendChild(prefCell);
    row.appendChild(statusCell);
    
    return row;
}

// Apply filters
function applyFilters() {
    if (!filterMaterial || !filterDescription || !filterStatus) return;
    
    const materialFilter = filterMaterial.value.toLowerCase().trim();
    const descriptionFilter = filterDescription.value.toLowerCase().trim();
    const statusFilter = filterStatus.value;
    const commodityFilter = (filterCommodity?.value || '').replace(/\s+/g, '').toLowerCase();
    const cooFilterRaw = (filterCOO?.value || '').toUpperCase();
    const cooFilterList = cooFilterRaw
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(s => s.length === 2);
    const prefFilter = (filterPreference?.value || 'all');
    const onlyPrefInconsistent = !!(filterPrefInconsistent?.checked);
    
    filteredMaterials = currentMaterials.filter(material => {
        // Filter by material number
        if (materialFilter && !material.materialNumber.toLowerCase().includes(materialFilter)) {
            return false;
        }
        
        // Filter by description
        if (descriptionFilter && !material.description.toLowerCase().includes(descriptionFilter)) {
            return false;
        }
        // Filter by commodity code (prefix or exact numeric match)
        if (commodityFilter) {
            const cc = (material.commodityCode || '').toString().replace(/\s+/g, '').toLowerCase();
            if (!cc.startsWith(commodityFilter)) {
                return false;
            }
        }

        // Filter by COO list (any of provided ISO-2 codes)
        if (cooFilterList.length > 0) {
            const coo = (material.coo || '').toUpperCase();
            if (!coo || !cooFilterList.includes(coo)) {
                return false;
            }
        }

        // Filter by status
        let statusOk = true;
        switch (statusFilter) {
            case 'incomplete':
                statusOk = material.status !== 'complete';
                break;
            case 'missing-coo':
                statusOk = material.status === 'missing-coo' || material.status === 'missing-both';
                break;
            case 'missing-commodity':
                statusOk = material.status === 'missing-commodity' || material.status === 'missing-both';
                break;
            case 'all':
            default:
                statusOk = true;
        }
        if (!statusOk) return false;

        // Filter by Preference
        if (prefFilter !== 'all') {
            const pref = (material.preference || '').toLowerCase();
            if (pref !== prefFilter) {
                return false;
            }
        }

        // Only preference-inconsistent
        if (onlyPrefInconsistent && !isPreferenceInconsistent(material)) {
            return false;
        }

        return true;
    });
    
    renderMaterialsTable();
}

// Clear filters
function clearFilters() {
    if (filterMaterial) filterMaterial.value = '';
    if (filterDescription) filterDescription.value = '';
    if (filterStatus) filterStatus.value = 'all';
        if (filterCommodity) filterCommodity.value = '';
        if (filterCOO) filterCOO.value = '';
        if (filterPreference) filterPreference.value = 'all';
        if (filterPrefInconsistent) filterPrefInconsistent.checked = false;
    
    filteredMaterials = [...currentMaterials];
    renderMaterialsTable();
}

// Export CSV
function exportToCSV() {
    if (filteredMaterials.length === 0) {
        showErrorMessage('Cannot export', 'There is no data to export.');
        return;
    }
    
    try {
        const headers = ['Material Number', 'Material Description', 'Commodity Code', 'COO', 'Preference', 'Status'];
        // Ensure Material Number keeps leading zeros in Excel by using ="value" pattern
            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const csvContent = [
                headers.join(','),
                ...filteredMaterials.map(material => {
                    const mat = material.materialNumber || '';
                    const matAsText = `="${mat}"`;
                    return [
                        esc(matAsText),
                        esc(material.description || ''),
                        esc(material.commodityCode || 'Missing'),
                        esc(material.coo || 'Missing'),
                        esc(material.preference || ''),
                        esc(getStatusText(material.status))
                    ].join(',');
                })
            ].join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `materiale_LTSD_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('CSV export successful');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showErrorMessage('Export error', 'An error occurred while exporting the CSV file.');
    }
}

// Generate CSV of materials missing COO, download it, and open Outlook compose
function emailMissingCoo() {
    // Collect missing COO rows (status missing-coo or missing-both)
    const missing = currentMaterials.filter(m => m.status === 'missing-coo' || m.status === 'missing-both');
    if (missing.length === 0) {
        showErrorMessage('Nothing to email', 'There are no materials with missing COO.');
        return;
    }

    try {
        // Only one column: Material Number (as Excel text to preserve leading zeros)
        const headers = ['Material Number'];
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csvContent = [
            headers.join(','),
            ...missing.map(material => {
                const mat = material.materialNumber || '';
                const matAsText = `="${mat}"`;
                return [ esc(matAsText) ].join(',');
            })
        ].join('\n');

    // Download the CSV locally so the user can attach it
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `materials_missing_COO_${dateStr}.csv`;
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Open Outlook compose with prefilled subject/body (attachments via mailto are not supported by browsers)
    const to = 'foreigntradeservices@forvia.com';
    const ccRecipients = ['irinacristina.cotirta@forvia.com','valentinarthur.predoiu@forvia.com'];
    const cc = encodeURIComponent(ccRecipients.join(';'));
    const company = detectedCompanyName && detectedCompanyName.length > 0 ? ` - ${detectedCompanyName}` : '';
    const subject = encodeURIComponent(`Materials missing COO${company}`);
        const nl = "\r\n"; // CRLF for Outlook
        const bodyPlain = [
            'Hello,',
            '',
            'Setati va rog COO pentru lista atasata.',
            '',
            'Multumesc,'
        ].join(nl);
        const body = encodeURIComponent(bodyPlain);
    const mailto = `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;
        window.location.href = mailto;
    } catch (error) {
        console.error('Error preparing email:', error);
        showErrorMessage('Email preparation error', 'Could not prepare the email or CSV.');
    }
}


// Get status text
function getStatusText(status) {
    switch (status) {
        case 'complete': return 'Complete';
        case 'missing-coo': return 'Missing COO';
        case 'missing-commodity': return 'Missing Commodity Code';
        case 'missing-both': return 'Both Missing';
        case 'pref-inconsistent': return 'Preference Yes but COO non‑EU';
        default: return 'Unknown';
    }
}

// Reset application
function resetApplication() {
    currentMaterials = [];
    filteredMaterials = [];
    fileInput.value = '';
    fileSelectedName.textContent = 'No file selected';
    fileSelectedName.classList.remove('has-file');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Please select a PDF file first';
    analyzeBtn.classList.remove('btn--primary');
    analyzeBtn.classList.add('btn--secondary');
    
    hideResultsSection();
    hideProgressSection();
    clearFilters();
    removeErrorMessages();
    
    console.log('Application reset');
}

// Show/hide sections
function showProgressSection() {
    if (progressSection) {
        progressSection.classList.remove('hidden');
    }
    if (resultsSection) {
        resultsSection.classList.add('hidden');
    }
}

function hideProgressSection() {
    if (progressSection) {
        progressSection.classList.add('hidden');
    }
}

function showResultsSection() {
    if (resultsSection) {
        resultsSection.classList.remove('hidden');
    }
}

function hideResultsSection() {
    if (resultsSection) {
        resultsSection.classList.add('hidden');
    }
}

// Show error message
function showErrorMessage(title, message) {
    // Remove previous messages
    removeErrorMessages();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('data-error-message', 'true');
    errorDiv.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
    `;
    
    // Insert after upload section
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection && uploadSection.parentNode) {
        uploadSection.parentNode.insertBefore(errorDiv, uploadSection.nextSibling);
    }
    
    // Auto-remove after 10s
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 10000);
}

// Remove error messages
function removeErrorMessages() {
    const errorMessages = document.querySelectorAll('[data-error-message="true"]');
    errorMessages.forEach(msg => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    });
}

// Export core logic for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeText,
        cleanFieldValues,
        getItemStatus,
        isPreferenceInconsistent,
        normalizeCooIso2,
        EU_ISO2,
        getStatusText,
        HEADER_SYNONYMS
    };
}