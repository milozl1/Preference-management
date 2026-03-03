/**
 * DAF (Agreement Exclusions) — Comprehensive Tests
 * Tests the matching logic and default positive results
 */
import { describe, it, expect } from 'vitest';

// ---- Inline core logic from apps/daf/DAF.js ----

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

const DEFAULT_POSITIVES = new Set([
    'AD',
    'MAR-ACP (CM / KE /.)',
    'JP**',
    'PEM-Countries (Regional Convention)*** (AL / BA / CH / DZ / EG / EU / FO / GE / IL / IS / JO / LB / LI / MA / MD / ME / MK / NO / PS / RS / SY / TN / TR / UA / XK (= KO) /. )',
    'PEM-Countries (Transitional rules)**** (AL / CH / EU / FO / GE / IS / JO / LI / MD / ME / MK / NO / PS / RS / UA / XK (= KO) /.)',
    'GSP* (LDC and OBC.)'
]);

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

// ---- Tests ----

describe('DAF — Default Positive Results', () => {
    it('should always include default positives even with empty input', () => {
        const result = computeDAFMatches('');
        const parts = result.split(';');
        expect(parts).toContain('AD');
        expect(parts).toContain('JP**');
        expect(parts).toContain('GSP* (LDC and OBC.)');
    });

    it('default positives set should have exactly 6 entries', () => {
        expect(DEFAULT_POSITIVES.size).toBe(6);
    });
});

describe('DAF — Matching Logic', () => {
    it('should match CA code', () => {
        const result = computeDAFMatches('CA');
        expect(result.split(';')).toContain('CA');
    });

    it('should match GB code', () => {
        const result = computeDAFMatches('GB');
        expect(result.split(';')).toContain('GB');
    });

    it('should match UK to GB agreement', () => {
        const result = computeDAFMatches('UK');
        expect(result.split(';')).toContain('GB');
    });

    it('should match SADC group codes', () => {
        const result = computeDAFMatches('ZA');
        const parts = result.split(';');
        const sadc = parts.find(p => p.includes('SADC'));
        expect(sadc).toBeTruthy();
    });

    it('should match CARIFORUM by constituent country', () => {
        const result = computeDAFMatches('JM');
        const parts = result.split(';');
        const cari = parts.find(p => p.includes('Cariforum'));
        expect(cari).toBeTruthy();
    });

    it('should match Central America by country code', () => {
        const result = computeDAFMatches('CR');
        const parts = result.split(';');
        const cam = parts.find(p => p.includes('Central America'));
        expect(cam).toBeTruthy();
    });

    it('should match C+M code for Ceuta & Melilla', () => {
        const result = computeDAFMatches('C+M');
        // 'XC;XL' is the key but semicolons are also the joiner, so check the raw result contains it
        expect(result).toContain('XC;XL');
    });

    it('should handle multiple codes at once', () => {
        const result = computeDAFMatches('CA, GB, VN, SG');
        const parts = result.split(';');
        expect(parts).toContain('CA');
        expect(parts).toContain('GB');
        expect(parts).toContain('VN');
        expect(parts).toContain('SG');
    });

    it('should handle EEA country codes', () => {
        const result = computeDAFMatches('IS, LI, NO');
        const parts = result.split(';');
        const eea = parts.find(p => p.includes('E.E.A'));
        expect(eea).toBeTruthy();
    });

    it('should be case-insensitive', () => {
        const result = computeDAFMatches('ca, gb');
        const parts = result.split(';');
        expect(parts).toContain('CA');
        expect(parts).toContain('GB');
    });
});

describe('DAF — Edge Cases', () => {
    it('should handle null input gracefully', () => {
        const result = computeDAFMatches(null);
        expect(result.split(';').length).toBeGreaterThanOrEqual(DEFAULT_POSITIVES.size);
    });

    it('should handle undefined input gracefully', () => {
        const result = computeDAFMatches(undefined);
        expect(result.split(';').length).toBeGreaterThanOrEqual(DEFAULT_POSITIVES.size);
    });

    it('should not duplicate results when same code appears multiple times in input', () => {
        const result = computeDAFMatches('CA CA CA');
        const parts = result.split(';');
        const caCount = parts.filter(p => p === 'CA').length;
        expect(caCount).toBe(1);
    });

    it('should handle special characters in input', () => {
        const result = computeDAFMatches('CA/GB;VN.SG(TR)');
        const parts = result.split(';');
        expect(parts).toContain('CA');
        expect(parts).toContain('GB');
        expect(parts).toContain('VN');
        expect(parts).toContain('SG');
    });

    it('should handle unrecognized codes gracefully', () => {
        const result = computeDAFMatches('XYZ UNKNOWN CODES');
        const parts = result.split(';');
        // Should still have default positives
        expect(parts.length).toBe(DEFAULT_POSITIVES.size);
    });
});

describe('DAF — Data Integrity', () => {
    it('should have keywords for all expected agreements', () => {
        expect(Object.keys(DAF_KEYWORDS).length).toBe(25);
    });

    it('all keyword arrays should be non-empty', () => {
        for (const [key, codes] of Object.entries(DAF_KEYWORDS)) {
            expect(codes.length).toBeGreaterThan(0);
        }
    });

    it('all codes should be uppercase strings', () => {
        for (const codes of Object.values(DAF_KEYWORDS)) {
            for (const code of codes) {
                expect(code).toBe(code.toUpperCase());
            }
        }
    });
});
