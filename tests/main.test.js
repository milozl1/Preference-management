/**
 * Shared main.js — Comprehensive Tests
 * Tests stamp resolution logic, address normalization, and mapping integrity
 */
import { describe, it, expect } from 'vitest';

// ---- Inline core logic from shared/js/main.js ----

const ADDRESS_STAMP_MAP = {
    'HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552': 'HKG stamp.jpg',
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-7967': 'HKG stamp.jpg',
    'Hella Innenleuchten Systeme GmbH, Maienbuhlstr. 7, D-79677': 'HKG stamp.jpg',
    'Hella Fahrzeugkomponenten GmbH, Dortmunder Str. 5, D-28199': 'HKG stamp.jpg',
    'HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85': 'HAN stamp.jpg',
    'UAB HELLA Lithuania, Oro parko str. 6, 54460': 'HLT stamp.jpg',
    'HELLA Romania SRL, Str. Hella Nr. 3, 307200': 'HRO stamp.png',
    'HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31': 'HSK stamp.jpg',
    'Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000': 'HSS stamp.jpg'
};

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

function normalizeAddress(str) {
    return (str || '').replace(/\s+/g, ' ').trim();
}

function resolveStampFilename(lu) {
    if (!lu) return null;
    const normalized = normalizeAddress(lu);
    if (ADDRESS_STAMP_MAP[normalized]) {
        return `./STAMPS/${ADDRESS_STAMP_MAP[normalized]}`;
    }
    const prefix = Object.keys(PREFIX_STAMP_MAP).find(p => normalized.startsWith(p));
    return prefix ? `./STAMPS/${PREFIX_STAMP_MAP[prefix]}` : null;
}

// ---- Tests ----

describe('Main — normalizeAddress', () => {
    it('should collapse multiple spaces', () => {
        expect(normalizeAddress('HELLA   GmbH')).toBe('HELLA GmbH');
    });

    it('should trim leading/trailing whitespace', () => {
        expect(normalizeAddress('  HELLA GmbH  ')).toBe('HELLA GmbH');
    });

    it('should handle empty string', () => {
        expect(normalizeAddress('')).toBe('');
    });

    it('should handle null', () => {
        expect(normalizeAddress(null)).toBe('');
    });

    it('should handle undefined', () => {
        expect(normalizeAddress(undefined)).toBe('');
    });

    it('should handle tabs and newlines', () => {
        expect(normalizeAddress('HELLA\tGmbH\n')).toBe('HELLA GmbH');
    });
});

describe('Main — resolveStampFilename', () => {
    it('should resolve exact address for HELLA GmbH', () => {
        const result = resolveStampFilename('HELLA GmbH & Co. KGaA, Rixbecker Str. 75, D-59552');
        expect(result).toBe('./STAMPS/HKG stamp.jpg');
    });

    it('should resolve exact address for Romania', () => {
        const result = resolveStampFilename('HELLA Romania SRL, Str. Hella Nr. 3, 307200');
        expect(result).toBe('./STAMPS/HRO stamp.png');
    });

    it('should resolve exact address for Lithuania', () => {
        const result = resolveStampFilename('UAB HELLA Lithuania, Oro parko str. 6, 54460');
        expect(result).toBe('./STAMPS/HLT stamp.jpg');
    });

    it('should resolve exact address for Slovakia', () => {
        const result = resolveStampFilename('HELLA Slovakia Lighting s.r.o., Kočovce 228, SK-916 31');
        expect(result).toBe('./STAMPS/HSK stamp.jpg');
    });

    it('should resolve exact address for Slovenija', () => {
        const result = resolveStampFilename('Hella Saturnus Slovenija d.o.o., Letališka cesta 17, SI-1000');
        expect(result).toBe('./STAMPS/HSS stamp.jpg');
    });

    it('should resolve exact address for Autotechnik NOVA', () => {
        const result = resolveStampFilename('HELLA Autotechnik NOVA s.r.o., Druzstevni 338/16, CZ-789 85');
        expect(result).toBe('./STAMPS/HAN stamp.jpg');
    });

    it('should fall back to prefix match for partial address', () => {
        const result = resolveStampFilename('HELLA Romania SRL, Some Other Address');
        expect(result).toBe('./STAMPS/HRO stamp.png');
    });

    it('should fall back to prefix match for Innenleuchten', () => {
        const result = resolveStampFilename('Hella Innenleuchten Systeme GmbH, Other Address');
        expect(result).toBe('./STAMPS/HKG stamp.jpg');
    });

    it('should return null for unknown address', () => {
        const result = resolveStampFilename('Unknown Company, Unknown Address');
        expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(resolveStampFilename('')).toBeNull();
    });

    it('should return null for null', () => {
        expect(resolveStampFilename(null)).toBeNull();
    });

    it('should return null for undefined', () => {
        expect(resolveStampFilename(undefined)).toBeNull();
    });

    it('should handle extra whitespace in address', () => {
        const result = resolveStampFilename('HELLA  Romania  SRL,  Str.  Hella  Nr.  3,  307200');
        // Extra whitespace normalized — should still match via prefix
        expect(result).toBe('./STAMPS/HRO stamp.png');
    });
});

describe('Main — Stamp Mapping Data Integrity', () => {
    it('ADDRESS_STAMP_MAP should have 9 entries', () => {
        expect(Object.keys(ADDRESS_STAMP_MAP).length).toBe(9);
    });

    it('PREFIX_STAMP_MAP should have 8 entries', () => {
        expect(Object.keys(PREFIX_STAMP_MAP).length).toBe(8);
    });

    it('all stamp filenames should end in .jpg or .png', () => {
        for (const filename of Object.values(ADDRESS_STAMP_MAP)) {
            expect(filename).toMatch(/\.(jpg|png)$/);
        }
        for (const filename of Object.values(PREFIX_STAMP_MAP)) {
            expect(filename).toMatch(/\.(jpg|png)$/);
        }
    });

    it('each ADDRESS_STAMP_MAP entry should have a corresponding PREFIX_STAMP_MAP prefix', () => {
        for (const address of Object.keys(ADDRESS_STAMP_MAP)) {
            const hasPrefix = Object.keys(PREFIX_STAMP_MAP).some(p => address.startsWith(p));
            expect(hasPrefix).toBe(true);
        }
    });

    it('ADDRESS_STAMP_MAP and PREFIX_STAMP_MAP should produce same stamp for same entity', () => {
        for (const [address, stamp] of Object.entries(ADDRESS_STAMP_MAP)) {
            const prefix = Object.keys(PREFIX_STAMP_MAP).find(p => address.startsWith(p));
            if (prefix) {
                expect(PREFIX_STAMP_MAP[prefix]).toBe(stamp);
            }
        }
    });
});
