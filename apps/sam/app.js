// =====================
// SAM Revamped Matching
// =====================

// Data model: agreements with code lists + short description
const AGREEMENTS = {
    _FE11: { codes: ['KE','ACP','MAR','EAC'], desc: 'EU - EAC countries' },
    _FE06: { codes: ['AND','CO','PE','EC'], desc: 'EU - Andean countries' },
    _FE08: { codes: ['C+M','XC','XL'], desc: 'EU - Ceuta & Melilla' },
    _FECA: { codes: ['CA','CETA'], desc: 'EU - Canada (CETA)' },
    _FE05: { codes: ['CAF','VC','TT','SR','LC','KN','JM','GY','GD','DO','DM','BZ','BS','BB','AG','CARIFORUM'], desc: 'EU - CARIFORUM' },
    _FE01: { codes: ['CAM','SV','PA','NI','HN','GT','CR'], desc: 'EU - Central America' },
    _FECI: { codes: ['CI'], desc: 'EU - Côte d\'Ivoire' },
    _FE57: { codes: ['CAS','CM'], desc: 'EU - Central African States' },
    _FECL: { codes: ['CL'], desc: 'EU - Chile' },
    _FEDZ: { codes: ['DZ'], desc: 'EU - Algeria' },
    _FE03: { codes: ['ESA','ZV','SC','MU','MG','KM'], desc: 'EU - Eastern & Southern Africa' },
    _FEGB: { codes: ['GB','UK'], desc: 'EU - United Kingdom' },
    _FEGH: { codes: ['GH'], desc: 'EU - Ghana' },
    _FEIL: { codes: ['IL'], desc: 'EU - Israel' },
    _FEKR: { codes: ['KR'], desc: 'EU - Republic of Korea' },
    _FELB: { codes: ['LB'], desc: 'EU - Lebanon' },
    _FEMX: { codes: ['MX'], desc: 'EU - Mexico' },
    _F046: { codes: ['OBC','UZ','TJ','SY','NU','NG','IN','ID','FM','CK','CG','AM','PK','PH','MN','LK','KG','CV','BO'], desc: 'EU - OBC group' },
    _FE09: { codes: ['OCT','WF','TF','SX','PM','PF','NC','GL','CW','BQ','AQ'], desc: 'EU - Overseas Territories' },
    _FEPS: { codes: ['PS'], desc: 'EU - West Bank & Gaza' },
    _FE61: { codes: ['SADC','ZA','SZ','NA','MZ','LS','BW'], desc: 'EU - SADC States' },
    _FESG: { codes: ['SG'], desc: 'EU - Singapore' },
    _FETR: { codes: ['TR'], desc: 'EU - Turkey' },
    _FEVN: { codes: ['VN'], desc: 'EU - Vietnam' },
    _FE07: { codes: ['WPS','WS','SB','FJ'], desc: 'EU - West-Pacific States' },
    _F045: { codes: ['LDC'], desc: 'EU - Least Developed Countries' },
    _FENZ: { codes: ['NZ'], desc: 'EU - New Zealand' },
    // Renamed to _FY prefix
    _FYAL: { codes: ['AL'], desc: 'EU - Albania' },
    _FYBA: { codes: ['BA'], desc: 'EU - Bosnia & Herzegovina' },
    _FYCH: { codes: ['CH/LI','CH','LI'], desc: 'EU - Switzerland / Liechtenstein' },
    _FYEG: { codes: ['EG'], desc: 'EU - Egypt' },
    _FYFO: { codes: ['FO'], desc: 'EU - Faroe Islands' },
    _FYGE: { codes: ['GE'], desc: 'EU - Georgia' },
    _FYIS: { codes: ['IS'], desc: 'EU - Iceland' },
    _FYJO: { codes: ['JO'], desc: 'EU - Jordan' },
    _FYMA: { codes: ['MA'], desc: 'EU - Morocco' },
    _FYMD: { codes: ['MD'], desc: 'EU - Moldova' },
    _FYME: { codes: ['ME'], desc: 'EU - Montenegro' },
    _FYMK: { codes: ['MK'], desc: 'EU - North Macedonia' },
    _FYNO: { codes: ['NO'], desc: 'EU - Norway' },
    _FYTN: { codes: ['TN'], desc: 'EU - Tunisia' },
    _FYUA: { codes: ['UA'], desc: 'EU - Ukraine' },
    _FYXK: { codes: ['XK'], desc: 'EU - Kosovo' },
    _FYXS: { codes: ['XS','RS'], desc: 'EU - Serbia' },
};

// Cache DOM references
const textInput = document.getElementById('textInput');
const startButton = document.getElementById('startButton');
const positiveList = document.getElementById('positiveList');
const negativeList = document.getElementById('negativeList');
const copyPositiveBtn = document.getElementById('copyPositiveBtn');
const copyNegativeBtn = document.getElementById('copyNegativeBtn');
const clearInputBtn = document.getElementById('clearInputBtn');
const summaryPanel = document.getElementById('summaryPanel');
const totalAgreementsEl = document.getElementById('totalAgreements');
const positiveCountEl = document.getElementById('positiveCount');
const negativeCountEl = document.getElementById('negativeCount');
const coveragePercentEl = document.getElementById('coveragePercent');
const summaryNoteEl = document.getElementById('summaryNote');

// Special visual classes per specific codes
const SPECIAL_CLASSES = {
    _FYEG: 'sam-fy-eg',
    _FEDZ: 'sam-fe-special',
    _FEIL: 'sam-fe-special',
    _FELB: 'sam-fe-special',
    _FEPS: 'sam-fe-special',
    _FETR: 'sam-fe-special',
};

// Explanatory notes per specific codes
    const SPECIAL_NOTES = {
        _FEDZ: 'from PEM but not ratified',
        _FEIL: 'from PEM but not ratified',
        _FELB: 'from PEM but not ratified',
        _FEPS: 'from PEM but not ratified',
        _FETR: 'from PEM but not ratified',
        _FYEG: 'Both rules',
    };

// Utility: tokenize input string into uppercased distinct tokens
function tokenizeInput(raw) {
    return raw
        .toUpperCase()
        .split(/[\s,\/;\.()\n\r]+/)
        .map(t => t.trim())
        .filter(Boolean);
}

function computeMatches(tokens) {
    const tokenSet = new Set(tokens);
    const positives = [];
    const negatives = [];
    for (const key of Object.keys(AGREEMENTS)) {
        const { codes } = AGREEMENTS[key];
        const hit = codes.some(c => tokenSet.has(c));
        if (hit) positives.push(key); else negatives.push(key);
    }
    return { positives, negatives };
}

function renderResults({ positives, negatives }) {
    positiveList.innerHTML = '';
    negativeList.innerHTML = '';
                positives.forEach(code => {
        const li = document.createElement('li');
                const fy = code.startsWith('_FY') ? ' sam-fy' : '';
                const extra = SPECIAL_CLASSES[code] ? ' ' + SPECIAL_CLASSES[code] : '';
                li.className = 'sam-hit' + fy + extra;
            const noteText = SPECIAL_NOTES[code];
            const note = noteText ? ` <span class="sam-badge-note" title="${noteText}">${noteText}</span>` : '';
                    li.innerHTML = `<span>${code}</span><span class="code-desc">${AGREEMENTS[code].desc}${note}</span>`;
        positiveList.appendChild(li);
    });
        negatives.forEach(code => {
        const li = document.createElement('li');
                const fy = code.startsWith('_FY') ? 'sam-fy' : '';
                const extra = SPECIAL_CLASSES[code] ? ' ' + SPECIAL_CLASSES[code] : '';
                li.className = fy + extra;
        const noteText2 = SPECIAL_NOTES[code];
        const note2 = noteText2 ? ` <span class="sam-badge-note" title="${noteText2}">${noteText2}</span>` : '';
            li.innerHTML = `<span>${code}</span><span class="code-desc">${AGREEMENTS[code].desc}${note2}</span>`;
        negativeList.appendChild(li);
    });
    copyPositiveBtn.disabled = positives.length === 0;
    copyNegativeBtn.disabled = negatives.length === 0;
    updateSummary(positives.length, negatives.length);
}

function updateSummary(posCount, negCount) {
    const total = posCount + negCount;
    totalAgreementsEl.textContent = Object.keys(AGREEMENTS).length;
    positiveCountEl.textContent = posCount;
    negativeCountEl.textContent = negCount;
    const coverage = total ? Math.round((posCount / total) * 100) : 0;
    coveragePercentEl.textContent = coverage + '%';
    summaryNoteEl.textContent = posCount === 0
        ? 'No agreements matched yet.'
        : `Matched ${posCount} of ${total} visible agreements.`;
    summaryPanel.hidden = false;
}

async function copyListToClipboard(listEl) {
    const lines = Array.from(listEl.querySelectorAll('li')).map(li => li.firstChild.textContent.trim());
    const text = lines.join('\n');
    try {
        await navigator.clipboard.writeText(text);
        // basic flash feedback
        listEl.style.outline = '2px solid #0a6ed1';
        setTimeout(() => (listEl.style.outline = ''), 600);
    } catch {
        alert('Clipboard copy failed.');
    }
}

function runMatching() {
    const tokens = tokenizeInput(textInput.value);
    const matches = computeMatches(tokens);
    renderResults(matches);
}

// Events
startButton.addEventListener('click', runMatching);
textInput.addEventListener('input', () => {
    // live matching
    runMatching();
});
copyPositiveBtn.addEventListener('click', () => copyListToClipboard(positiveList));
copyNegativeBtn.addEventListener('click', () => copyListToClipboard(negativeList));
clearInputBtn.addEventListener('click', () => {
    textInput.value = '';
    runMatching();
    textInput.focus();
});

// Initial render (shows all as negative by default)
runMatching();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AGREEMENTS, tokenizeInput, computeMatches, SPECIAL_NOTES };
}
