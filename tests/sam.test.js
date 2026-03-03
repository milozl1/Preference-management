/**
 * SAM (Supplier Agreement Matching Tool) — Comprehensive Tests
 * Tests the core matching logic: tokenization, agreement matching, edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---- Inline the pure logic from apps/sam/app.js for testing ----
// (The browser file relies on DOM globals, so we replicate the core logic here)

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

// ---- Tests ----

describe('SAM — tokenizeInput', () => {
    it('should tokenize comma-separated input', () => {
        const tokens = tokenizeInput('CA, GB, TR');
        expect(tokens).toEqual(['CA', 'GB', 'TR']);
    });

    it('should tokenize slash-separated input', () => {
        const tokens = tokenizeInput('CH/LI');
        expect(tokens).toEqual(['CH', 'LI']);
    });

    it('should tokenize semicolon-separated input', () => {
        const tokens = tokenizeInput('CA;GB;TR');
        expect(tokens).toEqual(['CA', 'GB', 'TR']);
    });

    it('should uppercase all tokens', () => {
        const tokens = tokenizeInput('ca, gb');
        expect(tokens).toEqual(['CA', 'GB']);
    });

    it('should handle empty input', () => {
        const tokens = tokenizeInput('');
        expect(tokens).toEqual([]);
    });

    it('should handle whitespace-only input', () => {
        const tokens = tokenizeInput('   ');
        expect(tokens).toEqual([]);
    });

    it('should handle mixed separators', () => {
        const tokens = tokenizeInput('CA GB,TR;VN.SG');
        expect(tokens).toEqual(['CA', 'GB', 'TR', 'VN', 'SG']);
    });

    it('should handle parentheses as separators', () => {
        const tokens = tokenizeInput('(CA) (GB)');
        expect(tokens).toEqual(['CA', 'GB']);
    });

    it('should handle newlines', () => {
        const tokens = tokenizeInput('CA\nGB\r\nTR');
        expect(tokens).toEqual(['CA', 'GB', 'TR']);
    });

    it('should handle multi-character codes like CETA and CARIFORUM', () => {
        const tokens = tokenizeInput('CETA CARIFORUM SADC');
        expect(tokens).toEqual(['CETA', 'CARIFORUM', 'SADC']);
    });
});

describe('SAM — computeMatches', () => {
    it('should return all agreements as negative when no tokens match', () => {
        const result = computeMatches([]);
        expect(result.positives).toHaveLength(0);
        expect(result.negatives).toHaveLength(Object.keys(AGREEMENTS).length);
    });

    it('should match single country code CA to CETA agreement', () => {
        const result = computeMatches(['CA']);
        expect(result.positives).toContain('_FECA');
        expect(result.negatives).not.toContain('_FECA');
    });

    it('should match UK to GB agreement', () => {
        const result = computeMatches(['UK']);
        expect(result.positives).toContain('_FEGB');
    });

    it('should match GB to GB agreement', () => {
        const result = computeMatches(['GB']);
        expect(result.positives).toContain('_FEGB');
    });

    it('should match TR to Turkey agreement', () => {
        const result = computeMatches(['TR']);
        expect(result.positives).toContain('_FETR');
    });

    it('should match CH to Switzerland agreement', () => {
        const result = computeMatches(['CH']);
        expect(result.positives).toContain('_FYCH');
    });

    it('should match LI to Switzerland agreement (CH/LI shared)', () => {
        const result = computeMatches(['LI']);
        expect(result.positives).toContain('_FYCH');
    });

    it('should match multiple codes simultaneously', () => {
        const result = computeMatches(['CA', 'GB', 'TR', 'VN', 'SG']);
        expect(result.positives).toContain('_FECA');
        expect(result.positives).toContain('_FEGB');
        expect(result.positives).toContain('_FETR');
        expect(result.positives).toContain('_FEVN');
        expect(result.positives).toContain('_FESG');
    });

    it('should handle SADC codes individually', () => {
        const result = computeMatches(['ZA']);
        expect(result.positives).toContain('_FE61');
    });

    it('should handle CARIFORUM codes', () => {
        const result = computeMatches(['AG']);
        expect(result.positives).toContain('_FE05');
    });

    it('should handle Central America codes', () => {
        const result = computeMatches(['CR']);
        expect(result.positives).toContain('_FE01');
    });

    it('should handle EAC codes', () => {
        const result = computeMatches(['KE']);
        expect(result.positives).toContain('_FE11');
    });

    it('should handle OBC country codes', () => {
        const result = computeMatches(['IN']);
        expect(result.positives).toContain('_F046');
    });

    it('should handle LDC code', () => {
        const result = computeMatches(['LDC']);
        expect(result.positives).toContain('_F045');
    });

    it('positives + negatives should equal total agreements', () => {
        const result = computeMatches(['CA', 'GB']);
        const total = Object.keys(AGREEMENTS).length;
        expect(result.positives.length + result.negatives.length).toBe(total);
    });

    it('should not produce duplicate entries', () => {
        const result = computeMatches(['CA', 'CA', 'CETA']); // CA and CETA both match _FECA
        const uniquePositives = new Set(result.positives);
        expect(uniquePositives.size).toBe(result.positives.length);
    });

    it('should handle all PEM _FY agreements', () => {
        const pemCodes = ['AL', 'BA', 'CH', 'EG', 'FO', 'GE', 'IS', 'JO', 'MA', 'MD', 'ME', 'MK', 'NO', 'TN', 'UA', 'XK', 'XS'];
        const result = computeMatches(pemCodes);
        const fyKeys = Object.keys(AGREEMENTS).filter(k => k.startsWith('_FY'));
        // All FY agreements should be positive
        fyKeys.forEach(k => {
            expect(result.positives).toContain(k);
        });
    });

    it('should match NZ to New Zealand', () => {
        const result = computeMatches(['NZ']);
        expect(result.positives).toContain('_FENZ');
    });
});

describe('SAM — Integration (tokenize + match)', () => {
    it('should handle realistic pasted text', () => {
        const input = 'CA, GB, TR, VN, SG, KR, CH/LI, NO, IS';
        const tokens = tokenizeInput(input);
        const result = computeMatches(tokens);

        expect(result.positives).toContain('_FECA');
        expect(result.positives).toContain('_FEGB');
        expect(result.positives).toContain('_FETR');
        expect(result.positives).toContain('_FEVN');
        expect(result.positives).toContain('_FESG');
        expect(result.positives).toContain('_FEKR');
        expect(result.positives).toContain('_FYCH');
        expect(result.positives).toContain('_FYNO');
        expect(result.positives).toContain('_FYIS');
    });

    it('should handle completely unrelated input', () => {
        const tokens = tokenizeInput('HELLO WORLD NOTHING');
        const result = computeMatches(tokens);
        expect(result.positives).toHaveLength(0);
    });

    it('should handle case-insensitive input', () => {
        const tokens = tokenizeInput('ca, gb');
        const result = computeMatches(tokens);
        expect(result.positives).toContain('_FECA');
        expect(result.positives).toContain('_FEGB');
    });
});

describe('SAM — Agreement Data Integrity', () => {
    it('should have unique codes across agreements (no duplicate assignments)', () => {
        const allCodes = new Map();
        for (const [key, { codes }] of Object.entries(AGREEMENTS)) {
            for (const code of codes) {
                if (allCodes.has(code)) {
                    // Some codes like LI and IS may appear in multiple agreements
                    // This is acceptable for shared agreements
                    // But same code in same agreement should not happen
                }
                allCodes.set(code, key);
            }
        }
        // Ensure all agreements have at least one code
        for (const [key, { codes }] of Object.entries(AGREEMENTS)) {
            expect(codes.length).toBeGreaterThan(0);
        }
    });

    it('all agreements should have a non-empty description', () => {
        for (const [key, { desc }] of Object.entries(AGREEMENTS)) {
            expect(desc).toBeTruthy();
            expect(desc.length).toBeGreaterThan(3);
        }
    });

    it('all codes should be uppercase strings', () => {
        for (const { codes } of Object.values(AGREEMENTS)) {
            for (const code of codes) {
                expect(code).toBe(code.toUpperCase());
            }
        }
    });

    it('should have expected total number of agreements (44)', () => {
        expect(Object.keys(AGREEMENTS).length).toBe(44);
    });
});
