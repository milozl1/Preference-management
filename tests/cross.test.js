/**
 * COO Cross-Reference Tool — Comprehensive Tests
 *
 * Tests the core logic: buildLookupMap, fillCOO, processCrossReference
 * Verifies correct Material+Plant matching, edge cases, and data integrity.
 */
import { describe, it, expect } from 'vitest';

const { buildLookupMap, fillCOO, processCrossReference } = require('../apps/cross/cross.js');

/* ── Helper: create reference data (with header) ──────────────────── */
function makeRefSheet(rows) {
  return [['Product', 'Plant', 'COO'], ...rows];
}

/* ── Helper: create data sheet (with header) ──────────────────────── */
function makeDataSheet(rows) {
  return [
    ['Material', 'Plant', 'COO', 'Movement Type', 'Qty'],
    ...rows.map(r => [r[0], r[1], '', r[2] || '101', r[3] || 100]),
  ];
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  buildLookupMap                                                    */
/* ═══════════════════════════════════════════════════════════════════ */
describe('buildLookupMap', () => {
  it('builds a map from reference rows', () => {
    const ref = makeRefSheet([
      ['MAT001', '1004', 'DE'],
      ['MAT001', '7000', 'CZ'],
      ['MAT002', '1004', 'FR'],
    ]);
    const map = buildLookupMap(ref);
    expect(map.size).toBe(3);
    expect(map.get('MAT001|1004')).toBe('DE');
    expect(map.get('MAT001|7000')).toBe('CZ');
    expect(map.get('MAT002|1004')).toBe('FR');
  });

  it('skips the header row', () => {
    const ref = makeRefSheet([['MAT001', '1004', 'DE']]);
    const map = buildLookupMap(ref);
    expect(map.has('Product|Plant')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('handles empty COO values', () => {
    const ref = makeRefSheet([['MAT001', '3151', '']]);
    const map = buildLookupMap(ref);
    expect(map.get('MAT001|3151')).toBe('');
  });

  it('trims whitespace from keys and values', () => {
    const ref = makeRefSheet([['  MAT001 ', ' 1004 ', ' DE ']]);
    const map = buildLookupMap(ref);
    expect(map.get('MAT001|1004')).toBe('DE');
  });

  it('handles numeric material and plant values', () => {
    const ref = makeRefSheet([[71475605, 7000, 'CZ']]);
    const map = buildLookupMap(ref);
    expect(map.get('71475605|7000')).toBe('CZ');
  });

  it('returns empty map for header-only sheet', () => {
    const ref = makeRefSheet([]);
    const map = buildLookupMap(ref);
    expect(map.size).toBe(0);
  });

  it('skips rows with missing product or plant', () => {
    const ref = makeRefSheet([
      ['', '1004', 'DE'],
      ['MAT001', '', 'FR'],
      [null, '1004', 'CZ'],
    ]);
    const map = buildLookupMap(ref);
    expect(map.size).toBe(0);
  });

  it('handles rows shorter than 3 columns', () => {
    const ref = [['Product', 'Plant', 'COO'], ['MAT001']];
    const map = buildLookupMap(ref);
    expect(map.size).toBe(0);
  });

  it('last duplicate wins (same Product+Plant)', () => {
    const ref = makeRefSheet([
      ['MAT001', '1004', 'DE'],
      ['MAT001', '1004', 'FR'],
    ]);
    const map = buildLookupMap(ref);
    expect(map.get('MAT001|1004')).toBe('FR');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  fillCOO                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
describe('fillCOO', () => {
  it('fills COO for matching rows', () => {
    const data = makeDataSheet([
      ['MAT001', '1004'],
      ['MAT002', '7000'],
    ]);
    const map = new Map([
      ['MAT001|1004', 'DE'],
      ['MAT002|7000', 'CZ'],
    ]);
    const result = fillCOO(data, map);
    expect(result.filled).toBe(2);
    expect(result.notFound).toBe(0);
    expect(data[1][2]).toBe('DE');
    expect(data[2][2]).toBe('CZ');
  });

  it('reports unmatched rows', () => {
    const data = makeDataSheet([
      ['MAT001', '1004'],
      ['MAT999', '5555'],
    ]);
    const map = new Map([['MAT001|1004', 'DE']]);
    const result = fillCOO(data, map);
    expect(result.filled).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.unmatchedKeys).toEqual([{ material: 'MAT999', plant: '5555' }]);
  });

  it('does not modify non-COO columns', () => {
    const data = makeDataSheet([['MAT001', '1004', '101', 500]]);
    const map = new Map([['MAT001|1004', 'FR']]);
    fillCOO(data, map);
    expect(data[1][0]).toBe('MAT001');
    expect(data[1][1]).toBe('1004');
    expect(data[1][2]).toBe('FR');
    expect(data[1][3]).toBe('101');
    expect(data[1][4]).toBe(500);
  });

  it('deduplicates unmatched keys', () => {
    const data = makeDataSheet([
      ['MAT999', '5555'],
      ['MAT999', '5555'],
      ['MAT999', '5555'],
    ]);
    const map = new Map();
    const result = fillCOO(data, map);
    expect(result.notFound).toBe(3);
    expect(result.unmatchedKeys.length).toBe(1);
  });

  it('handles mixed matched and unmatched rows', () => {
    const data = makeDataSheet([
      ['MAT001', '1004'],
      ['MAT002', '7000'],
      ['MAT003', '9999'],
      ['MAT001', '1004'],
    ]);
    const map = new Map([
      ['MAT001|1004', 'DE'],
      ['MAT002|7000', 'CZ'],
    ]);
    const result = fillCOO(data, map);
    expect(result.filled).toBe(3);
    expect(result.notFound).toBe(1);
    expect(data[1][2]).toBe('DE');
    expect(data[4][2]).toBe('DE'); // same material+plant matched again
  });

  it('fills empty string COO when reference has empty COO', () => {
    const data = makeDataSheet([['MAT001', '3151']]);
    const map = new Map([['MAT001|3151', '']]);
    const result = fillCOO(data, map);
    expect(result.filled).toBe(1);
    expect(data[1][2]).toBe('');
  });

  it('handles empty data (header only)', () => {
    const data = [['Material', 'Plant', 'COO']];
    const map = new Map([['MAT001|1004', 'DE']]);
    const result = fillCOO(data, map);
    expect(result.filled).toBe(0);
    expect(result.notFound).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  processCrossReference (integration)                               */
/* ═══════════════════════════════════════════════════════════════════ */
describe('processCrossReference', () => {
  it('end-to-end: fills COO from reference sheet', () => {
    const dataRows = makeDataSheet([
      ['71475605', '7000'],
      ['001149011', '1004'],
      ['001149011', '1011'],
      ['UNKNOWN', '9999'],
    ]);
    const refRows = makeRefSheet([
      ['71475605', '7000', 'DE'],
      ['001149011', '1004', 'CZ'],
      ['001149011', '1011', 'CZ'],
      ['001149011', '1017', 'CZ'],
    ]);

    const result = processCrossReference(dataRows, refRows);

    expect(result.total).toBe(4);
    expect(result.filled).toBe(3);
    expect(result.notFound).toBe(1);
    expect(result.unmatchedKeys).toEqual([{ material: 'UNKNOWN', plant: '9999' }]);

    // Verify actual data modification
    expect(result.dataRows[1][2]).toBe('DE');
    expect(result.dataRows[2][2]).toBe('CZ');
    expect(result.dataRows[3][2]).toBe('CZ');
    expect(result.dataRows[4][2]).toBe('');
  });

  it('same material, different plants get different COO', () => {
    const dataRows = makeDataSheet([
      ['MAT001', '1004'],
      ['MAT001', '7000'],
      ['MAT001', '2352'],
    ]);
    const refRows = makeRefSheet([
      ['MAT001', '1004', 'CZ'],
      ['MAT001', '7000', 'DE'],
      ['MAT001', '2352', 'FR'],
    ]);

    const result = processCrossReference(dataRows, refRows);

    expect(result.filled).toBe(3);
    expect(result.dataRows[1][2]).toBe('CZ');
    expect(result.dataRows[2][2]).toBe('DE');
    expect(result.dataRows[3][2]).toBe('FR');
  });

  it('handles numeric values from Excel parsing', () => {
    const dataRows = [
      ['Material', 'Plant', 'COO', 'Movement Type'],
      [71475605, 7000, '', 101],
      [71640303, 7000, '', 101],
    ];
    const refRows = [
      ['Product', 'Plant', 'COO'],
      [71475605, 7000, 'DE'],
      [71640303, 7000, 'CZ'],
    ];

    const result = processCrossReference(dataRows, refRows);
    expect(result.filled).toBe(2);
    expect(result.dataRows[1][2]).toBe('DE');
    expect(result.dataRows[2][2]).toBe('CZ');
  });

  it('handles large dataset correctly', () => {
    // Simulate 1000 data rows with 500 reference entries
    const refEntries = [];
    for (let i = 0; i < 500; i++) {
      refEntries.push(['MAT' + String(i).padStart(5, '0'), '1004', i % 2 === 0 ? 'DE' : 'CZ']);
    }
    const refRows = makeRefSheet(refEntries);

    const dataEntries = [];
    for (let i = 0; i < 1000; i++) {
      dataEntries.push(['MAT' + String(i).padStart(5, '0'), '1004']);
    }
    const dataRows = makeDataSheet(dataEntries);

    const result = processCrossReference(dataRows, refRows);

    expect(result.total).toBe(1000);
    expect(result.filled).toBe(500);
    expect(result.notFound).toBe(500);
    // Verify some specific fills
    expect(result.dataRows[1][2]).toBe('DE');   // MAT00000 → even → DE
    expect(result.dataRows[2][2]).toBe('CZ');   // MAT00001 → odd → CZ
  });

  it('plant matching is exact (no partial match)', () => {
    const dataRows = makeDataSheet([
      ['MAT001', '100'],   // should NOT match plant 1004
      ['MAT001', '1004'],  // should match
    ]);
    const refRows = makeRefSheet([
      ['MAT001', '1004', 'DE'],
    ]);

    const result = processCrossReference(dataRows, refRows);
    expect(result.filled).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.dataRows[1][2]).toBe('');   // '100' not matched
    expect(result.dataRows[2][2]).toBe('DE'); // '1004' matched
  });

  it('preserves all original columns in output', () => {
    const dataRows = [
      ['Material', 'Plant', 'COO', 'Movement Type', 'Qty', 'Unit', 'Date', 'Amount', 'HS'],
      ['MAT001', '1004', '', '101', 10000, 'PC', 45281, 54.73, '85411000'],
    ];
    const refRows = makeRefSheet([['MAT001', '1004', 'DE']]);

    const result = processCrossReference(dataRows, refRows);
    expect(result.dataRows[1].length).toBe(9);  // all columns preserved
    expect(result.dataRows[1][2]).toBe('DE');
    expect(result.dataRows[1][3]).toBe('101');
    expect(result.dataRows[1][4]).toBe(10000);
    expect(result.dataRows[1][8]).toBe('85411000');
  });

  it('returns correct total excluding header', () => {
    const dataRows = makeDataSheet([['A', '1'], ['B', '2'], ['C', '3']]);
    const refRows = makeRefSheet([]);

    const result = processCrossReference(dataRows, refRows);
    expect(result.total).toBe(3);
  });

  it('handles reference with zero-length COO vs missing entry differently', () => {
    const dataRows = makeDataSheet([
      ['MAT001', '3151'],  // empty COO in reference
      ['MAT002', '9999'],  // not in reference at all
    ]);
    const refRows = makeRefSheet([
      ['MAT001', '3151', ''],  // known but empty COO
    ]);

    const result = processCrossReference(dataRows, refRows);
    // MAT001|3151 is found (even though COO is empty string) → counts as filled
    expect(result.filled).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.dataRows[1][2]).toBe('');   // filled with empty
    expect(result.dataRows[2][2]).toBe('');   // not found, stays empty
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Real-world scenario simulation                                    */
/* ═══════════════════════════════════════════════════════════════════ */
describe('Real-world scenario: MB51 + Reference data', () => {
  const refRows = makeRefSheet([
    ['001149011', '1004', 'CZ'],
    ['001149011', '1011', 'CZ'],
    ['001149011', '1017', 'CZ'],
    ['001149011', '2352', 'CZ'],
    ['001149011', '2353', 'CZ'],
    ['001149011', '3151', ''],
    ['001149011', '3153', ''],
    ['001149331', '1004', 'CZ'],
    ['71475605',  '7000', 'DE'],
    ['71640303',  '7000', 'DE'],
  ]);

  it('matches materials across multiple plants', () => {
    const dataRows = makeDataSheet([
      ['001149011', '1004'],
      ['001149011', '1011'],
      ['001149011', '2352'],
      ['001149011', '3151'],
    ]);

    const result = processCrossReference(dataRows, refRows);
    expect(result.filled).toBe(4);
    expect(result.dataRows[1][2]).toBe('CZ');
    expect(result.dataRows[2][2]).toBe('CZ');
    expect(result.dataRows[3][2]).toBe('CZ');
    expect(result.dataRows[4][2]).toBe('');   // 3151 has empty COO but is matched
  });

  it('distinguishes between similar materials', () => {
    const dataRows = makeDataSheet([
      ['001149011', '1004'],
      ['001149331', '1004'],
    ]);

    const result = processCrossReference(dataRows, refRows);
    expect(result.filled).toBe(2);
    expect(result.dataRows[1][2]).toBe('CZ');
    expect(result.dataRows[2][2]).toBe('CZ');
  });

  it('handles high-volume repeated lookups efficiently', () => {
    // Simulate 10000 rows with same few materials
    const entries = [];
    for (let i = 0; i < 10000; i++) {
      const mat = i % 2 === 0 ? '71475605' : '71640303';
      entries.push([mat, '7000']);
    }
    const dataRows = makeDataSheet(entries);

    const result = processCrossReference(dataRows, refRows);
    expect(result.filled).toBe(10000);
    expect(result.notFound).toBe(0);
  });
});
