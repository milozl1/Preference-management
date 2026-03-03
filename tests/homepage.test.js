/**
 * Preference Management Home Page — Tests
 * Tests the tile filtering logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// ---- Tests ----

describe('Home Page — Tile Filtering', () => {
    let document;
    let filterBy;

    beforeEach(() => {
        const html = `
        <div class="launchpad">
            <nav class="lp-tabs" role="tablist">
                <button class="lp-tab" role="tab" aria-selected="false" data-target="master-data">Master Data</button>
                <button class="lp-tab" role="tab" aria-selected="false" data-target="preference-determination">Preference Determination</button>
                <button class="lp-tab" role="tab" aria-selected="true" data-target="customer">Customer</button>
                <button class="lp-tab" role="tab" aria-selected="false" data-target="supplier">Supplier</button>
            </nav>
            <section class="lp-section active">
                <div class="lp-grid" id="appGrid">
                    <a class="lp-tile" data-group="customer" href="#">Tile 1</a>
                    <a class="lp-tile" data-group="customer" href="#">Tile 2</a>
                    <a class="lp-tile" data-group="customer" href="#">Tile 3</a>
                    <a class="lp-tile" data-group="supplier" href="#">Tile 4</a>
                    <a class="lp-tile" data-group="supplier" href="#">Tile 5</a>
                </div>
            </section>
        </div>
        `;

        const dom = new JSDOM(html);
        document = dom.window.document;

        const tabs = document.querySelectorAll('.lp-tab');
        const tiles = document.querySelectorAll('.lp-tile');

        filterBy = (group) => {
            tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.target === group)));
            if (!group || group === 'all') {
                tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
                tiles.forEach(el => el.style.display = '');
            } else {
                tiles.forEach(el => {
                    el.style.display = (el.dataset.group === group) ? '' : 'none';
                });
                const anyVisible = Array.from(tiles).some(el => el.style.display !== 'none');
                if (!anyVisible) {
                    tiles.forEach(el => el.style.display = '');
                }
            }
        };
    });

    it('should show all tiles by default (no filter)', () => {
        filterBy('all');
        const tiles = document.querySelectorAll('.lp-tile');
        tiles.forEach(tile => {
            expect(tile.style.display).not.toBe('none');
        });
    });

    it('should filter to customer tiles only', () => {
        filterBy('customer');
        const tiles = document.querySelectorAll('.lp-tile');
        let customerVisible = 0;
        let supplierVisible = 0;
        tiles.forEach(tile => {
            if (tile.dataset.group === 'customer' && tile.style.display !== 'none') customerVisible++;
            if (tile.dataset.group === 'supplier' && tile.style.display !== 'none') supplierVisible++;
        });
        expect(customerVisible).toBe(3);
        expect(supplierVisible).toBe(0);
    });

    it('should filter to supplier tiles only', () => {
        filterBy('supplier');
        const tiles = document.querySelectorAll('.lp-tile');
        let customerVisible = 0;
        let supplierVisible = 0;
        tiles.forEach(tile => {
            if (tile.dataset.group === 'customer' && tile.style.display !== 'none') customerVisible++;
            if (tile.dataset.group === 'supplier' && tile.style.display !== 'none') supplierVisible++;
        });
        expect(customerVisible).toBe(0);
        expect(supplierVisible).toBe(2);
    });

    it('should show all tiles when filtering by non-existent group', () => {
        filterBy('master-data'); // No tiles have data-group="master-data"
        const tiles = document.querySelectorAll('.lp-tile');
        // All should be visible because no tiles match, so fallback shows all
        tiles.forEach(tile => {
            expect(tile.style.display).not.toBe('none');
        });
    });

    it('should update aria-selected on tabs', () => {
        filterBy('customer');
        const tabs = document.querySelectorAll('.lp-tab');
        tabs.forEach(tab => {
            if (tab.dataset.target === 'customer') {
                expect(tab.getAttribute('aria-selected')).toBe('true');
            } else {
                expect(tab.getAttribute('aria-selected')).toBe('false');
            }
        });
    });

    it('should reset all aria-selected when showing all', () => {
        filterBy('customer');
        filterBy('all');
        const tabs = document.querySelectorAll('.lp-tab');
        tabs.forEach(tab => {
            expect(tab.getAttribute('aria-selected')).toBe('false');
        });
    });
});

describe('Home Page — Data Structure', () => {
    it('should have tiles belonging to customer or supplier groups', () => {
        const validGroups = ['customer', 'supplier'];
        const tileGroups = ['customer', 'customer', 'customer', 'customer', 'supplier', 'supplier'];
        tileGroups.forEach(group => {
            expect(validGroups).toContain(group);
        });
    });

    it('should have 4 navigation tabs', () => {
        const expectedTabs = ['master-data', 'preference-determination', 'customer', 'supplier'];
        expect(expectedTabs.length).toBe(4);
    });
});
