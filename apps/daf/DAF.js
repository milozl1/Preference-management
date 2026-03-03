// Selectează elementele HTML necesare
const textInput = document.getElementById('textInput');
const startButton = document.getElementById('startButton');
const resultArea = document.getElementById('resultArea'); // Element pentru afișarea rezultatului
const copyButton = document.getElementById('copyButton'); // Buton pentru copierea rezultatului

// Funcție pentru a copia rezultatele în clipboard (modernized)
async function copyResultsToClipboard() {
    const text = resultArea.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
    } catch {
        // Fallback for older browsers
        resultArea.select();
        document.execCommand('copy');
    }
}

// Data model: keywords map for DAF agreement matching
const DAF_KEYWORDS = {
    'AD': ['EX'],
    'Andean-countries (CO / EC / PE /.)': ['AND'],
    'XC;XL': ['C+M', 'XC', 'XL'],
    'CA': ['CA'],
    'EPA-Cariforum (AG / BB / BS / BZ / DM / DO / GD / GY / JM / KN / LC / SR / TT / VC /.)': ['CAF', 'VC', 'TT', 'SR', 'LC', 'KN', 'JM', 'GY', 'GD', 'DO', 'DM', 'BZ', 'BS', 'BB', 'AG', 'CARIFORUM'],
    'Central America (CR / GT / HN / NI / PA / SV /.)': ['CAM', 'SV', 'PA', 'NI', 'HN', 'GT', 'CR'],
    'CI': ['CI'],
    'EPA-Central Africa (CM /.)': ['CAS', 'CM'],
    'CL': ['CL'],
    'EPA-ESA (KM / MG / MU / SC / ZW /.)': ['ESA', 'ZV', 'SC', 'MU', 'MG', 'KM'],
    'GB': ['GB', 'UK'],
    'GH': ['GH'],
    'E.E.A. (EU / IS / LI / NO /.)': ['IS', 'LI', 'NO'],
    'KR': ['KR'],
    'MX': ['MX'],
    'MAR-ACP (CM / KE /.)': ['EX1'],
    'OCT (AW / BL / BQ / CW / GL / NC / PF / PM / SX / TF / WF /.)': ['OCT', 'WF', 'TF', 'SX', 'PM', 'PF', 'NC', 'GL', 'CW', 'BQ', 'AQ'],
    'EPA-SADC (BW / LS / MZ / NA / SZ / ZA /.)': ['SADC', 'ZA', 'SZ', 'NA', 'MZ', 'LS', 'BW'],
    'SG': ['SG'],
    'JP**': ['EX3'],
    'VN': ['VN'],
    'EPA-Pacific (FJ / PG / SB / WS /.)': ['WPS', 'WS', 'SB', 'FJ'],
    'PEM-Countries (Regional Convention)*** (AL / BA / CH / DZ / EG / EU / FO / GE / IL / IS / JO / LB / LI / MA / MD / ME / MK / NO / PS / RS / SY / TN / TR / UA / XK (= KO) /. )': ['EX6'],
    'PEM-Countries (Transitional rules)**** (AL / CH / EU / FO / GE / IS / JO / LI / MD / ME / MK / NO / PS / RS / UA / XK (= KO) /.)': ['EX5'],
    'GSP* (LDC and OBC.)': ['EX4'],
};

// Default positive results (always included)
const DEFAULT_POSITIVES = new Set([
    'AD',
    'MAR-ACP (CM / KE /.)',
    'JP**',
    'PEM-Countries (Regional Convention)*** (AL / BA / CH / DZ / EG / EU / FO / GE / IL / IS / JO / LB / LI / MA / MD / ME / MK / NO / PS / RS / SY / TN / TR / UA / XK (= KO) /. )',
    'PEM-Countries (Transitional rules)**** (AL / CH / EU / FO / GE / IS / JO / LI / MD / ME / MK / NO / PS / RS / UA / XK (= KO) /.)',
    'GSP* (LDC and OBC.)'
]);

/**
 * Compute DAF matching results from input text.
 * @param {string} inputText - Raw input text
 * @returns {string} Semicolon-separated matching results
 */
function computeDAFMatches(inputText) {
    const upperInput = (inputText || '').toUpperCase();
    const uniquePositiveResults = new Set(DEFAULT_POSITIVES);

    const inputKeywords = upperInput.split(/[\s,\/;\.()]+/).filter(Boolean);

    inputKeywords.forEach(keyword => {
        for (const result in DAF_KEYWORDS) {
            if (DAF_KEYWORDS[result].includes(keyword)) {
                uniquePositiveResults.add(result);
                break;
            }
        }
    });

    return Array.from(uniquePositiveResults).join(';');
}

// Adaugă un eveniment pentru butonul "Start"
startButton.addEventListener('click', () => {
    resultArea.value = computeDAFMatches(textInput.value);
});

// Adaugă un eveniment pentru butonul "Copy to Clipboard"
copyButton.addEventListener('click', copyResultsToClipboard);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeDAFMatches, DAF_KEYWORDS, DEFAULT_POSITIVES };
}
