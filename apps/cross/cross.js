/**
 * COO Cross-Reference Tool
 *
 * Reads an Excel workbook with two sheets:
 *   Sheet1 (MB51 data): col A = Material, col B = Plant, col C = COO (empty)
 *   Sheet2 (Reference):  col A = Product,  col B = Plant, col C = COO
 *
 * Fills Sheet1 col C by looking up Material+Plant in Sheet2.
 */

/* ── Module-level API (exported for tests, used by UI) ────────────── */

/**
 * Build a lookup map from reference data.
 * Key = "material|plant" (both trimmed strings), value = COO string.
 * @param {Array<Array>} refRows - 2-D array *including* header row
 * @returns {Map<string, string>}
 */
function buildLookupMap(refRows) {
  const map = new Map();
  for (let i = 1; i < refRows.length; i++) {
    const row = refRows[i];
    if (!row || row.length < 3) continue;
    const product = String(row[0] ?? '').trim();
    const plant   = String(row[1] ?? '').trim();
    const coo     = String(row[2] ?? '').trim();
    if (product && plant) {
      map.set(product + '|' + plant, coo);
    }
  }
  return map;
}

/**
 * Fill COO column (index 2) in data rows using the lookup map.
 * @param {Array<Array>} dataRows - 2-D array *including* header row
 * @param {Map<string, string>} lookupMap
 * @returns {{ filled: number, notFound: number, unmatchedKeys: Array<{material:string, plant:string}> }}
 */
function fillCOO(dataRows, lookupMap) {
  let filled = 0;
  let notFound = 0;
  const unmatchedKeys = [];
  const seenUnmatched = new Set();

  for (let i = 1; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;

    const material = String(row[0] ?? '').trim();
    const plant    = String(row[1] ?? '').trim();
    const key      = material + '|' + plant;
    const coo      = lookupMap.get(key);

    if (coo !== undefined) {
      row[2] = coo;
      filled++;
    } else {
      notFound++;
      if (!seenUnmatched.has(key) && material) {
        seenUnmatched.add(key);
        unmatchedKeys.push({ material, plant });
      }
    }
  }
  return { filled, notFound, unmatchedKeys };
}

/**
 * Full processing pipeline: takes two 2-D arrays, returns enriched data + stats.
 * @param {Array<Array>} dataRows  - Sheet1 data (with header)
 * @param {Array<Array>} refRows   - Sheet2 reference (with header)
 * @returns {{ dataRows: Array<Array>, filled: number, notFound: number, total: number, unmatchedKeys: Array }}
 */
function processCrossReference(dataRows, refRows) {
  const lookupMap = buildLookupMap(refRows);
  const result = fillCOO(dataRows, lookupMap);
  return {
    dataRows,
    filled: result.filled,
    notFound: result.notFound,
    total: dataRows.length - 1,
    unmatchedKeys: result.unmatchedKeys,
  };
}

/* ── Export for tests (Node / CommonJS) ─────────────────────────────  */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildLookupMap, fillCOO, processCrossReference };
}

/* ── UI Logic (browser only) ───────────────────────────────────────── */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput      = document.getElementById('fileInput');
    const fileNameEl     = document.getElementById('fileName');
    const configPanel    = document.getElementById('configPanel');
    const sheet1Select   = document.getElementById('sheet1Select');
    const sheet2Select   = document.getElementById('sheet2Select');
    const processBtn     = document.getElementById('processBtn');
    const resultPanel    = document.getElementById('resultPanel');
    const totalRowsEl    = document.getElementById('totalRows');
    const matchedRowsEl  = document.getElementById('matchedRows');
    const unmatchedRowsEl= document.getElementById('unmatchedRows');
    const coveragePctEl  = document.getElementById('coveragePct');
    const previewHead    = document.getElementById('previewHead');
    const previewBody    = document.getElementById('previewBody');
    const unmatchedSection = document.getElementById('unmatchedSection');
    const unmatchedBadge  = document.getElementById('unmatchedBadge');
    const unmatchedBody   = document.getElementById('unmatchedBody');
    const downloadBtn    = document.getElementById('downloadBtn');
    const spinner        = document.getElementById('spinner');

    let workbook = null;
    let processedData = null;

    /* ── File load ──────────────────────────────────────────────── */
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileNameEl.textContent = file.name;
      resultPanel.hidden = true;
      spinner.hidden = false;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        workbook = XLSX.read(data, { type: 'array' });

        // Populate sheet selectors
        sheet1Select.innerHTML = '';
        sheet2Select.innerHTML = '';
        workbook.SheetNames.forEach((name, idx) => {
          const opt1 = new Option(name, name, idx === 0, idx === 0);
          const opt2 = new Option(name, name, idx === 1, idx === 1);
          sheet1Select.appendChild(opt1);
          sheet2Select.appendChild(opt2);
        });

        configPanel.hidden = false;
        spinner.hidden = true;
      };
      reader.readAsArrayBuffer(file);
    });

    /* ── Process ────────────────────────────────────────────────── */
    processBtn.addEventListener('click', () => {
      if (!workbook) return;
      spinner.hidden = false;

      // Use setTimeout to let the spinner render before heavy processing
      setTimeout(() => {
        const sheet1Name = sheet1Select.value;
        const sheet2Name = sheet2Select.value;

        if (sheet1Name === sheet2Name) {
          spinner.hidden = true;
          alert('Data sheet and reference sheet must be different.');
          return;
        }

        const dataRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet1Name], { header: 1, defval: '' });
        const refRows  = XLSX.utils.sheet_to_json(workbook.Sheets[sheet2Name], { header: 1, defval: '' });

        if (dataRows.length < 2 || refRows.length < 2) {
          spinner.hidden = true;
          alert('Sheets must contain at least a header row and one data row.');
          return;
        }

        processedData = processCrossReference(dataRows, refRows);
        processedData.sheet1Name = sheet1Name;

        renderResults(processedData);
        spinner.hidden = true;
      }, 50);
    });

    /* ── Render results ─────────────────────────────────────────── */
    function renderResults(result) {
      totalRowsEl.textContent   = result.total.toLocaleString();
      matchedRowsEl.textContent = result.filled.toLocaleString();
      unmatchedRowsEl.textContent = result.notFound.toLocaleString();
      const pct = result.total > 0 ? ((result.filled / result.total) * 100).toFixed(1) : '0';
      coveragePctEl.textContent = pct + '%';

      // Preview table (first 50 rows)
      const headers = result.dataRows[0] || [];
      const displayCols = Math.min(headers.length, 10); // show first 10 columns
      previewHead.innerHTML = '<tr>' + headers.slice(0, displayCols).map(h => '<th>' + escapeHtml(String(h)) + '</th>').join('') + '</tr>';

      let bodyHtml = '';
      const previewCount = Math.min(50, result.dataRows.length - 1);
      for (let i = 1; i <= previewCount; i++) {
        const row = result.dataRows[i] || [];
        bodyHtml += '<tr>';
        for (let c = 0; c < displayCols; c++) {
          const val = row[c] != null ? String(row[c]) : '';
          let cls = '';
          if (c === 2) cls = val ? ' class="coo-filled"' : ' class="coo-missing"';
          bodyHtml += '<td' + cls + '>' + escapeHtml(val) + '</td>';
        }
        bodyHtml += '</tr>';
      }
      previewBody.innerHTML = bodyHtml;

      // Unmatched list
      if (result.unmatchedKeys.length > 0) {
        unmatchedSection.hidden = false;
        unmatchedBadge.textContent = result.unmatchedKeys.length;
        unmatchedBody.innerHTML = result.unmatchedKeys
          .map(k => '<tr><td>' + escapeHtml(k.material) + '</td><td>' + escapeHtml(k.plant) + '</td></tr>')
          .join('');
      } else {
        unmatchedSection.hidden = true;
      }

      resultPanel.hidden = false;
    }

    /* ── Download ───────────────────────────────────────────────── */
    downloadBtn.addEventListener('click', () => {
      if (!processedData || !workbook) return;

      // Build a new worksheet from the processed data
      const newWs = XLSX.utils.aoa_to_sheet(processedData.dataRows);
      workbook.Sheets[processedData.sheet1Name] = newWs;

      const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'COO_Completed.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });

    /* ── Util ───────────────────────────────────────────────────── */
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }
  });
}
