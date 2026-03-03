/**
 * IHK (Origin Certificate Generator) — Comprehensive Tests
 * Tests date validation, form validation logic, place auto-mapping
 */
import { describe, it, expect } from 'vitest';

// ---- Inline core logic from apps/ihk/ihk.js ----

function monthDiff(start, end) {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (e.getDate() < s.getDate()) months -= 1;
    return months;
}

function validateDateRange(fromStr, toStr) {
    if (!fromStr || !toStr) return { ok: false, reason: 'Missing date(s)' };
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (to < from) return { ok: false, reason: 'End before start' };
    const months = monthDiff(from, to);
    if (months > 24) return { ok: false, reason: `Exceeds 24 months (${months})` };
    return { ok: true, months };
}

const placeAutoMap = {
    'HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552': 'LIPPSTADT',
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-7967': 'WEMBACH',
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-79677': 'WEMBACH',
    'Hella Fahrzeugkomponenten GmbH, Dortmunder Str. 5, D-28199': 'BREMEN',
    'HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85': 'MOHELNICE',
    'UAB HELLA Lithuania, Oro parko str. 6, 54460': 'KARMELAVA, KAUNAS DISTRICT',
    'HELLA Romania SRL, Str. Hella Nr. 3, 307200': 'GHIRODA - JUDETUL TIMIS',
    'HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31': 'KOCOVCE',
    'Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000': 'LJUBLJANA'
};

// ---- Tests ----

describe('IHK — monthDiff', () => {
    it('same month should return 0', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2025-01-20'))).toBe(0);
    });

    it('one month difference', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2025-02-01'))).toBe(1);
    });

    it('adjusts when end day is earlier than start day', () => {
        expect(monthDiff(new Date('2025-01-31'), new Date('2025-02-01'))).toBe(0);
    });

    it('12 months (one year)', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2026-01-01'))).toBe(12);
    });

    it('24 months (two years)', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2027-01-01'))).toBe(24);
    });

    it('25 months exceeds limit', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2027-02-01'))).toBe(25);
    });

    it('same date should return 0', () => {
        expect(monthDiff(new Date('2025-06-15'), new Date('2025-06-15'))).toBe(0);
    });

    it('6 months', () => {
        expect(monthDiff(new Date('2025-01-01'), new Date('2025-07-01'))).toBe(6);
    });

    it('handles year boundary correctly', () => {
        expect(monthDiff(new Date('2025-12-01'), new Date('2026-01-01'))).toBe(1);
    });

    it('handles end of month edge case', () => {
        // Jan 31 to Feb 28 - end day < start day, so adjust
        expect(monthDiff(new Date('2025-01-31'), new Date('2025-02-28'))).toBe(0);
    });

    it('handles full month when days align', () => {
        expect(monthDiff(new Date('2025-01-15'), new Date('2025-02-15'))).toBe(1);
    });
});

describe('IHK — validateDateRange', () => {
    it('valid range within 12 months', () => {
        const result = validateDateRange('2025-01-01', '2026-01-01');
        expect(result.ok).toBe(true);
        expect(result.months).toBe(12);
    });

    it('valid range exactly 24 months', () => {
        const result = validateDateRange('2025-01-01', '2027-01-01');
        expect(result.ok).toBe(true);
        expect(result.months).toBe(24);
    });

    it('exceeding 24 months should fail', () => {
        const result = validateDateRange('2025-01-01', '2027-02-01');
        expect(result.ok).toBe(false);
        expect(result.reason).toMatch(/Exceeds/);
    });

    it('end before start should fail', () => {
        const result = validateDateRange('2025-05-01', '2025-04-30');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('End before start');
    });

    it('missing from date should fail', () => {
        const result = validateDateRange('', '2025-12-31');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('Missing date(s)');
    });

    it('missing to date should fail', () => {
        const result = validateDateRange('2025-01-01', '');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('Missing date(s)');
    });

    it('null dates should fail', () => {
        const result = validateDateRange(null, null);
        expect(result.ok).toBe(false);
    });

    it('same day should be valid with 0 months', () => {
        const result = validateDateRange('2025-06-15', '2025-06-15');
        expect(result.ok).toBe(true);
        expect(result.months).toBe(0);
    });

    it('typical full year range should be valid', () => {
        const result = validateDateRange('2025-01-01', '2025-12-31');
        expect(result.ok).toBe(true);
        expect(result.months).toBe(11);
    });
});

describe('IHK — Place Auto-Mapping', () => {
    it('should map HELLA GmbH to LIPPSTADT', () => {
        expect(placeAutoMap['HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552']).toBe('LIPPSTADT');
    });

    it('should map Innenleuchten (full zip) to WEMBACH', () => {
        expect(placeAutoMap['Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-79677']).toBe('WEMBACH');
    });

    it('should map Innenleuchten (short zip variant) to WEMBACH', () => {
        expect(placeAutoMap['Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-7967']).toBe('WEMBACH');
    });

    it('should map Fahrzeugkomponenten to BREMEN', () => {
        expect(placeAutoMap['Hella Fahrzeugkomponenten GmbH, Dortmunder Str. 5, D-28199']).toBe('BREMEN');
    });

    it('should map Autotechnik NOVA to MOHELNICE', () => {
        expect(placeAutoMap['HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85']).toBe('MOHELNICE');
    });

    it('should map Lithuania to KARMELAVA, KAUNAS DISTRICT', () => {
        expect(placeAutoMap['UAB HELLA Lithuania, Oro parko str. 6, 54460']).toBe('KARMELAVA, KAUNAS DISTRICT');
    });

    it('should map Romania to GHIRODA - JUDETUL TIMIS', () => {
        expect(placeAutoMap['HELLA Romania SRL, Str. Hella Nr. 3, 307200']).toBe('GHIRODA - JUDETUL TIMIS');
    });

    it('should map Slovakia to KOCOVCE', () => {
        expect(placeAutoMap['HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31']).toBe('KOCOVCE');
    });

    it('should map Saturnus Slovenija to LJUBLJANA', () => {
        expect(placeAutoMap['Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000']).toBe('LJUBLJANA');
    });

    it('should have 9 entries in the map', () => {
        expect(Object.keys(placeAutoMap).length).toBe(9);
    });

    it('unknown legal unit should return undefined', () => {
        expect(placeAutoMap['Unknown Company']).toBeUndefined();
    });
});

describe('IHK — Text Constants', () => {
    // Inline from text.js
    const IHK_TEXT = {
        headings: [
            '(Langzeit-) Erklärung-IHK für den nichtpräferenziellen Ursprung gemäß Artikel 59-61 Zollkodex der Union (UZK)',
            '(Long-term) supplier\u2019s declaration (CCI) for non-preferential origin as per Article 59-61 Union Customs Code (UCC)'
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
            '1). Warenbezeichnung',
            '2). Name und Anschrift',
            '3). Nur eine Möglichkeit',
            '4). Ursprungsland (Mitgliedsstaat)',
            '5). Ursprungsland außerhalb',
            '6). Datumsangabe nur bei',
            '7). Zuständige IHK',
            '8). Erklärung kann als'
        ]
    };

    it('headings should have exactly 2 entries (DE + EN)', () => {
        expect(IHK_TEXT.headings).toHaveLength(2);
    });

    it('all text arrays should have exactly 2 entries (DE + EN)', () => {
        expect(IHK_TEXT.goodsLeadIn).toHaveLength(2);
        expect(IHK_TEXT.suppliedTo).toHaveLength(2);
        expect(IHK_TEXT.singleShipment).toHaveLength(2);
        expect(IHK_TEXT.longTerm).toHaveLength(2);
        expect(IHK_TEXT.footnotes).toHaveLength(2);
    });

    it('undertake should be a function returning 2-element array', () => {
        expect(typeof IHK_TEXT.undertake).toBe('function');
        const result = IHK_TEXT.undertake('TestCustomer');
        expect(result).toHaveLength(2);
        expect(result[0]).toContain('TestCustomer');
        expect(result[1]).toContain('TestCustomer');
    });

    it('detailedFootnotes should have 8 entries', () => {
        expect(IHK_TEXT.detailedFootnotes).toHaveLength(8);
    });

    it('DE heading should contain IHK', () => {
        expect(IHK_TEXT.headings[0]).toContain('IHK');
    });

    it('EN heading should contain CCI', () => {
        expect(IHK_TEXT.headings[1]).toContain('CCI');
    });
});
