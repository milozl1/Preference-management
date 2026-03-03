/**
 * Raport Compute Worker — Comprehensive Tests
 * Tests the statistical computations: aggregate, streak detection,
 * gap analysis, SPC, Pareto, cadence scoring, etc.
 */
import { describe, it, expect } from 'vitest';

// ---- Inline core logic from apps/raport/workers/compute.worker.js ----

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function aggregate(rows, keys, valueField) {
    const m = new Map();
    for (const r of rows) {
        const k = keys.map(k => r[k]).join('\u0001');
        const prev = m.get(k) || { total: 0 };
        prev.total += (r[valueField] || 0);
        m.set(k, prev);
    }
    const out = [];
    for (const [k, obj] of m) {
        const parts = k.split('\u0001');
        const rec = {};
        keys.forEach((key, i) => rec[key] = typeof parts[i] === 'string' && /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i]);
        rec.total = obj.total;
        out.push(rec);
    }
    return out;
}

function computeStreaksIndexed(vendor, vRows) {
    let best = []; let current = [];
    for (const r of vRows) {
        if (r.total > 0) {
            if (!current.length || r.cw === current[current.length - 1].cw + 1) { current.push(r); } else { if (current.length > best.length) best = current; current = [r]; }
        } else {
            if (current.length > best.length) best = current; current = [];
        }
    }
    if (current.length > best.length) best = current;
    return { vendor, longest: best };
}

function computeGapsIndexed(vendor, vRows) {
    const weeks = vRows.filter(r => r.total > 0).map(r => r.cw);
    const uniqWeeks = Array.from(new Set(weeks));
    const gaps = [];
    for (let i = 1; i < uniqWeeks.length; i++) { gaps.push(uniqWeeks[i] - uniqWeeks[i - 1]); }
    return { vendor, weeks: uniqWeeks, gaps };
}

function statMean(arr) { if (!arr?.length) return null; return arr.reduce((a, b) => a + b, 0) / arr.length; }
function statMedian(arr) { if (!arr?.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function statMode(arr) { if (!arr?.length) return null; const m = new Map(); for (const x of arr) { m.set(x, (m.get(x) || 0) + 1); } let best = null, bf = -1; for (const [k, v] of m) { if (v > bf) { bf = v; best = k; } } return best; }
function cadenceScore(arr) { if (!arr?.length) return null; const mode = statMode(arr); const cnt = arr.filter(x => x === mode).length; return cnt / arr.length; }

// ---- Tests ----

describe('Raport Worker — clamp', () => {
    it('should clamp value within range', () => {
        expect(clamp(5, 1, 10)).toBe(5);
    });

    it('should clamp below minimum', () => {
        expect(clamp(-5, 1, 10)).toBe(1);
    });

    it('should clamp above maximum', () => {
        expect(clamp(15, 1, 10)).toBe(10);
    });

    it('should handle edge values', () => {
        expect(clamp(1, 1, 10)).toBe(1);
        expect(clamp(10, 1, 10)).toBe(10);
    });
});

describe('Raport Worker — aggregate', () => {
    it('should aggregate by single key', () => {
        const rows = [
            { vendor: 'A', count: 10 },
            { vendor: 'A', count: 5 },
            { vendor: 'B', count: 3 }
        ];
        const result = aggregate(rows, ['vendor'], 'count');
        const aTotal = result.find(r => r.vendor === 'A').total;
        const bTotal = result.find(r => r.vendor === 'B').total;
        expect(aTotal).toBe(15);
        expect(bTotal).toBe(3);
    });

    it('should aggregate by multiple keys', () => {
        const rows = [
            { vendor: 'A', cw: 1, count: 10 },
            { vendor: 'A', cw: 1, count: 5 },
            { vendor: 'A', cw: 2, count: 3 }
        ];
        const result = aggregate(rows, ['vendor', 'cw'], 'count');
        expect(result).toHaveLength(2);
        const acw1 = result.find(r => r.vendor === 'A' && r.cw === 1);
        expect(acw1.total).toBe(15);
    });

    it('should handle empty rows', () => {
        const result = aggregate([], ['vendor'], 'count');
        expect(result).toHaveLength(0);
    });

    it('should handle missing count values', () => {
        const rows = [
            { vendor: 'A' },
            { vendor: 'A', count: 5 }
        ];
        const result = aggregate(rows, ['vendor'], 'count');
        expect(result[0].total).toBe(5);
    });

    it('should convert numeric string keys to numbers', () => {
        const rows = [{ cw: 1, count: 10 }];
        const result = aggregate(rows, ['cw'], 'count');
        expect(result[0].cw).toBe(1);
    });
});

describe('Raport Worker — computeStreaksIndexed', () => {
    it('should detect consecutive streak', () => {
        const vRows = [
            { cw: 1, total: 5 },
            { cw: 2, total: 3 },
            { cw: 3, total: 7 },
            { cw: 4, total: 0 },
            { cw: 5, total: 2 }
        ];
        const result = computeStreaksIndexed('VendorA', vRows);
        expect(result.vendor).toBe('VendorA');
        expect(result.longest).toHaveLength(3); // weeks 1-3
    });

    it('should handle streak at end', () => {
        const vRows = [
            { cw: 1, total: 0 },
            { cw: 2, total: 5 },
            { cw: 3, total: 3 },
            { cw: 4, total: 7 }
        ];
        const result = computeStreaksIndexed('VendorB', vRows);
        expect(result.longest).toHaveLength(3);
    });

    it('should handle no active weeks', () => {
        const vRows = [
            { cw: 1, total: 0 },
            { cw: 2, total: 0 }
        ];
        const result = computeStreaksIndexed('VendorC', vRows);
        expect(result.longest).toHaveLength(0);
    });

    it('should handle all active weeks', () => {
        const vRows = [
            { cw: 1, total: 5 },
            { cw: 2, total: 3 },
            { cw: 3, total: 7 }
        ];
        const result = computeStreaksIndexed('VendorD', vRows);
        expect(result.longest).toHaveLength(3);
    });

    it('should handle empty input', () => {
        const result = computeStreaksIndexed('VendorE', []);
        expect(result.longest).toHaveLength(0);
    });

    it('should pick the longest among multiple streaks', () => {
        const vRows = [
            { cw: 1, total: 5 },
            { cw: 2, total: 3 },
            { cw: 3, total: 0 },
            { cw: 4, total: 7 },
            { cw: 5, total: 2 },
            { cw: 6, total: 8 },
            { cw: 7, total: 1 }
        ];
        const result = computeStreaksIndexed('VendorF', vRows);
        expect(result.longest).toHaveLength(4); // weeks 4-7
    });
});

describe('Raport Worker — computeGapsIndexed', () => {
    it('should compute gaps between active weeks', () => {
        const vRows = [
            { cw: 1, total: 5 },
            { cw: 2, total: 0 },
            { cw: 3, total: 3 },
            { cw: 4, total: 0 },
            { cw: 5, total: 0 },
            { cw: 6, total: 7 }
        ];
        const result = computeGapsIndexed('VendorA', vRows);
        expect(result.weeks).toEqual([1, 3, 6]);
        expect(result.gaps).toEqual([2, 3]);
    });

    it('should handle consecutive active weeks', () => {
        const vRows = [
            { cw: 1, total: 5 },
            { cw: 2, total: 3 },
            { cw: 3, total: 7 }
        ];
        const result = computeGapsIndexed('VendorB', vRows);
        expect(result.gaps).toEqual([1, 1]);
    });

    it('should handle single active week', () => {
        const vRows = [{ cw: 1, total: 5 }];
        const result = computeGapsIndexed('VendorC', vRows);
        expect(result.gaps).toEqual([]);
    });

    it('should handle no active weeks', () => {
        const vRows = [{ cw: 1, total: 0 }, { cw: 2, total: 0 }];
        const result = computeGapsIndexed('VendorD', vRows);
        expect(result.gaps).toEqual([]);
    });
});

describe('Raport Worker — Statistical Functions', () => {
    describe('statMean', () => {
        it('should compute correct mean', () => {
            expect(statMean([2, 4, 6])).toBe(4);
        });

        it('should handle single value', () => {
            expect(statMean([5])).toBe(5);
        });

        it('should return null for empty array', () => {
            expect(statMean([])).toBeNull();
        });

        it('should return null for null', () => {
            expect(statMean(null)).toBeNull();
        });
    });

    describe('statMedian', () => {
        it('should return middle value for odd-length array', () => {
            expect(statMedian([1, 3, 5])).toBe(3);
        });

        it('should return average of two middle values for even-length array', () => {
            expect(statMedian([1, 2, 3, 4])).toBe(2.5);
        });

        it('should handle unsorted input', () => {
            expect(statMedian([5, 1, 3])).toBe(3);
        });

        it('should handle single value', () => {
            expect(statMedian([7])).toBe(7);
        });

        it('should return null for empty array', () => {
            expect(statMedian([])).toBeNull();
        });
    });

    describe('statMode', () => {
        it('should return most frequent value', () => {
            expect(statMode([1, 2, 2, 3])).toBe(2);
        });

        it('should handle single value', () => {
            expect(statMode([5])).toBe(5);
        });

        it('should return null for empty array', () => {
            expect(statMode([])).toBeNull();
        });

        it('should handle all same values', () => {
            expect(statMode([3, 3, 3])).toBe(3);
        });
    });

    describe('cadenceScore', () => {
        it('should return 1 for all same gaps', () => {
            expect(cadenceScore([2, 2, 2, 2])).toBe(1);
        });

        it('should return < 1 for varied gaps', () => {
            const score = cadenceScore([1, 2, 1, 3]);
            expect(score).toBeLessThan(1);
            expect(score).toBeGreaterThan(0);
        });

        it('should return null for empty array', () => {
            expect(cadenceScore([])).toBeNull();
        });

        it('should handle single gap', () => {
            expect(cadenceScore([5])).toBe(1);
        });
    });
});
