/**
 * Analizator (LTSD Analyzer) — Comprehensive Tests
 * Tests the core parsing utilities: normalizeText, cleanFieldValues,
 * getItemStatus, isPreferenceInconsistent, EU country list, etc.
 */
import { describe, it, expect } from 'vitest';

// ---- Inline core logic from analizator/app.js ----

function normalizeText(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
}

const EU_ISO2 = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
    'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','EL'
]);

function normalizeCooIso2(code) {
    const up = (code || '').toUpperCase();
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

function cleanFieldValues(obj) {
    const out = { ...obj };
    if (out.materialNumber) out.materialNumber = out.materialNumber.replace(/\s+/g, ' ').trim();
    if (out.description) out.description = out.description.replace(/\s+/g, ' ').trim();
    if (out.commodityCode) out.commodityCode = out.commodityCode.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (out.coo) {
        const m = out.coo.toUpperCase().match(/\b[A-Z]{2}\b/);
        out.coo = m ? m[0] : out.coo.toUpperCase().trim();
    }
    if (out.preference) {
        const v = out.preference.toString().trim().toLowerCase();
        out.preference = v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '';
    }
    return out;
}

function getItemStatus(item) {
    const missingCOO = !item.coo || item.coo.trim() === '';
    const missingCommodity = !item.commodityCode || item.commodityCode.trim() === '';
    const prefYesNonEU = isPreferenceInconsistent(item);

    if (missingCOO && missingCommodity) return 'missing-both';
    else if (missingCOO) return 'missing-coo';
    else if (missingCommodity) return 'missing-commodity';
    else if (prefYesNonEU) return 'pref-inconsistent';
    else return 'complete';
}

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

// ---- Tests ----

describe('Analizator — normalizeText', () => {
    it('should collapse multiple spaces', () => {
        expect(normalizeText('hello   world')).toBe('hello world');
    });

    it('should trim leading and trailing whitespace', () => {
        expect(normalizeText('  hello  ')).toBe('hello');
    });

    it('should handle empty string', () => {
        expect(normalizeText('')).toBe('');
    });

    it('should handle null/undefined', () => {
        expect(normalizeText(null)).toBe('');
        expect(normalizeText(undefined)).toBe('');
    });

    it('should handle tabs and newlines', () => {
        expect(normalizeText('hello\t\nworld')).toBe('hello world');
    });

    it('should preserve single spaces', () => {
        expect(normalizeText('hello world')).toBe('hello world');
    });
});

describe('Analizator — normalizeCooIso2', () => {
    it('should uppercase country code', () => {
        expect(normalizeCooIso2('de')).toBe('DE');
    });

    it('should map EL to GR (Greece alias)', () => {
        expect(normalizeCooIso2('EL')).toBe('GR');
        expect(normalizeCooIso2('el')).toBe('GR');
    });

    it('should handle empty string', () => {
        expect(normalizeCooIso2('')).toBe('');
    });

    it('should handle null', () => {
        expect(normalizeCooIso2(null)).toBe('');
    });

    it('should pass through normal codes unchanged', () => {
        expect(normalizeCooIso2('FR')).toBe('FR');
        expect(normalizeCooIso2('RO')).toBe('RO');
    });
});

describe('Analizator — EU_ISO2', () => {
    it('should contain all 27 EU member states + EL alias', () => {
        expect(EU_ISO2.size).toBe(28); // 27 members + EL
    });

    it('should contain Germany (DE)', () => {
        expect(EU_ISO2.has('DE')).toBe(true);
    });

    it('should contain France (FR)', () => {
        expect(EU_ISO2.has('FR')).toBe(true);
    });

    it('should contain Romania (RO)', () => {
        expect(EU_ISO2.has('RO')).toBe(true);
    });

    it('should contain Greece alias (EL)', () => {
        expect(EU_ISO2.has('EL')).toBe(true);
    });

    it('should contain Greece (GR)', () => {
        expect(EU_ISO2.has('GR')).toBe(true);
    });

    it('should NOT contain non-EU countries', () => {
        expect(EU_ISO2.has('US')).toBe(false);
        expect(EU_ISO2.has('CN')).toBe(false);
        expect(EU_ISO2.has('GB')).toBe(false);
        expect(EU_ISO2.has('TR')).toBe(false);
        expect(EU_ISO2.has('CH')).toBe(false);
    });

    it('should contain all current EU members', () => {
        const allMembers = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
        allMembers.forEach(m => {
            expect(EU_ISO2.has(m)).toBe(true);
        });
    });
});

describe('Analizator — isPreferenceInconsistent', () => {
    it('should detect preference=Yes for non-EU country', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'US' })).toBe(true);
    });

    it('should NOT flag preference=Yes for EU country', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'DE' })).toBe(false);
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'FR' })).toBe(false);
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'RO' })).toBe(false);
    });

    it('should NOT flag preference=No regardless of COO', () => {
        expect(isPreferenceInconsistent({ preference: 'No', coo: 'US' })).toBe(false);
        expect(isPreferenceInconsistent({ preference: 'No', coo: 'DE' })).toBe(false);
    });

    it('should NOT flag when preference is empty', () => {
        expect(isPreferenceInconsistent({ preference: '', coo: 'US' })).toBe(false);
    });

    it('should NOT flag when COO is empty', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: '' })).toBe(false);
    });

    it('should handle null item', () => {
        expect(isPreferenceInconsistent(null)).toBe(false);
    });

    it('should handle undefined item', () => {
        expect(isPreferenceInconsistent(undefined)).toBe(false);
    });

    it('should handle EL (Greece alias) as EU', () => {
        // EL maps to GR which is in EU
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'EL' })).toBe(false);
    });

    it('should be case-insensitive for preference', () => {
        expect(isPreferenceInconsistent({ preference: 'yes', coo: 'CN' })).toBe(true);
        expect(isPreferenceInconsistent({ preference: 'YES', coo: 'CN' })).toBe(true);
    });

    it('should flag China (CN) with preference Yes', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'CN' })).toBe(true);
    });

    it('should flag Turkey (TR) with preference Yes (not EU)', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'TR' })).toBe(true);
    });

    it('should flag Switzerland (CH) with preference Yes (not EU)', () => {
        expect(isPreferenceInconsistent({ preference: 'Yes', coo: 'CH' })).toBe(true);
    });
});

describe('Analizator — cleanFieldValues', () => {
    it('should clean material number whitespace', () => {
        const result = cleanFieldValues({ materialNumber: '  12345678  ' });
        expect(result.materialNumber).toBe('12345678');
    });

    it('should clean description whitespace', () => {
        const result = cleanFieldValues({ description: '  LED  Module  ' });
        expect(result.description).toBe('LED Module');
    });

    it('should extract only digits from commodity code', () => {
        const result = cleanFieldValues({ commodityCode: '8539 90.90' });
        expect(result.commodityCode).toBe('85399090');
    });

    it('should extract ISO-2 from COO text', () => {
        const result = cleanFieldValues({ coo: 'Germany DE' });
        expect(result.coo).toBe('DE');
    });

    it('should normalize preference Yes', () => {
        const result = cleanFieldValues({ preference: 'yes' });
        expect(result.preference).toBe('Yes');
    });

    it('should normalize preference No', () => {
        const result = cleanFieldValues({ preference: 'no' });
        expect(result.preference).toBe('No');
    });

    it('should clear invalid preference', () => {
        const result = cleanFieldValues({ preference: 'maybe' });
        expect(result.preference).toBe('');
    });

    it('should handle empty fields', () => {
        const result = cleanFieldValues({});
        expect(result).toEqual({});
    });

    it('should not mutate original object', () => {
        const original = { materialNumber: '  123  ', description: 'Test' };
        const result = cleanFieldValues(original);
        expect(original.materialNumber).toBe('  123  ');
        expect(result.materialNumber).toBe('123');
    });
});

describe('Analizator — getItemStatus', () => {
    it('should return "complete" when all fields present (EU COO)', () => {
        expect(getItemStatus({ coo: 'DE', commodityCode: '85399090', preference: 'Yes' })).toBe('complete');
    });

    it('should return "complete" when all fields present (preference No)', () => {
        expect(getItemStatus({ coo: 'CN', commodityCode: '85399090', preference: 'No' })).toBe('complete');
    });

    it('should return "missing-coo" when COO missing', () => {
        expect(getItemStatus({ coo: '', commodityCode: '85399090' })).toBe('missing-coo');
    });

    it('should return "missing-commodity" when commodity code missing', () => {
        expect(getItemStatus({ coo: 'DE', commodityCode: '' })).toBe('missing-commodity');
    });

    it('should return "missing-both" when both missing', () => {
        expect(getItemStatus({ coo: '', commodityCode: '' })).toBe('missing-both');
    });

    it('should return "pref-inconsistent" for preference Yes + non-EU COO', () => {
        expect(getItemStatus({ coo: 'CN', commodityCode: '85399090', preference: 'Yes' })).toBe('pref-inconsistent');
    });

    it('should handle null COO as missing', () => {
        expect(getItemStatus({ coo: null, commodityCode: '85399090' })).toBe('missing-coo');
    });

    it('should handle undefined commodityCode as missing', () => {
        expect(getItemStatus({ coo: 'DE', commodityCode: undefined })).toBe('missing-commodity');
    });

    it('should handle whitespace-only COO as missing', () => {
        expect(getItemStatus({ coo: '  ', commodityCode: '85399090' })).toBe('missing-coo');
    });

    it('should handle whitespace-only commodity code as missing', () => {
        expect(getItemStatus({ coo: 'DE', commodityCode: '   ' })).toBe('missing-commodity');
    });
});

describe('Analizator — getStatusText', () => {
    it('should return "Complete" for complete status', () => {
        expect(getStatusText('complete')).toBe('Complete');
    });

    it('should return correct text for missing-coo', () => {
        expect(getStatusText('missing-coo')).toBe('Missing COO');
    });

    it('should return correct text for missing-commodity', () => {
        expect(getStatusText('missing-commodity')).toBe('Missing Commodity Code');
    });

    it('should return correct text for missing-both', () => {
        expect(getStatusText('missing-both')).toBe('Both Missing');
    });

    it('should return correct text for pref-inconsistent', () => {
        expect(getStatusText('pref-inconsistent')).toContain('Preference Yes');
    });

    it('should return "Unknown" for unrecognized status', () => {
        expect(getStatusText('random')).toBe('Unknown');
        expect(getStatusText('')).toBe('Unknown');
    });
});
