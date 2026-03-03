(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  let workbook, rows = [], headers = [], activeSheetName;
  let tabulatorTable;
  let computeWorker;

  const fileInput = $('#fileInput');
  const sheetSelect = $('#sheetSelect');
  const rowsLimit = $('#rowsLimit');
  const refreshPreview = $('#refreshPreview');
  const tableToggle = $('#tableToggle');
  const categorySelect = $('#categorySelect');
  const chartModeSel = $('#chartMode');
  const countsControls = $('#countsControls');
  const meta = $('#meta');
  const tableWrap = $('#tableWrap');
  const structureEl = $('#structure');
  const statusSpan = $('#loadStatus');

  function setStatus(msg){ statusSpan.textContent = msg || ''; }

  function getWorker(){
    try{
      if (typeof Worker === 'undefined') return null;
      if (!computeWorker){ computeWorker = new Worker('./workers/compute.worker.js'); }
      return computeWorker;
    }catch(e){ console.warn('Worker init failed', e); return null; }
  }

  function resetWorker(){
    try{
      if (computeWorker){ computeWorker.terminate(); }
    }catch(e){}
    computeWorker = null;
  }

  // Utilities for headers, sums and plotting
  // Brand palette for charts
  const PALETTE = {
    primary: '#0b4a84',
    success: '#2a7f62',
    danger: '#b33f62',
    accent: '#f59e0b',
    grayGrid: '#eef2f7',
    text: '#2b3a4a'
  };

  // Monthly color palette for date charts - neutral, darker colors
  const MONTH_COLORS = [
    '#4a5568', // January - Dark Gray
    '#4d5280', // February - Muted Indigo  
    '#2d3748', // March - Charcoal
    '#2f855a', // April - Dark Green
    '#744210', // May - Dark Amber
    '#5e1f08', // June - Dark Red
    '#775848', // July - Dark Orange
    '#e4e6dc', // August - Forest Green
    '#1a365d', // September - Dark Blue
    '#2b0398', // October - Dark Purple
    '#2c1f4a', // November - Deep Violet
    '#a0a6a1'  // December - Almost Black
  ];

  function getMonthFromLabel(label){
    // Try to extract month from various date formats
    const s = String(label).toLowerCase().trim();
    
    // Direct month names (full or abbreviated)
    const monthNames = {
      'january': 0, 'jan': 0, 'ianuarie': 0,
      'february': 1, 'feb': 1, 'februarie': 1,
      'march': 2, 'mar': 2, 'martie': 2,
      'april': 3, 'apr': 3, 'aprilie': 3,
      'may': 4, 'mai': 4,
      'june': 5, 'jun': 5, 'iunie': 5,
      'july': 6, 'jul': 6, 'iulie': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8, 'sept': 8, 'septembrie': 8,
      'october': 9, 'oct': 9, 'octombrie': 9,
      'november': 10, 'nov': 10, 'noiembrie': 10,
      'december': 11, 'dec': 11, 'decembrie': 11
    };
    
    // Check for month name in label
    for (const [name, monthIndex] of Object.entries(monthNames)){
      if (s.includes(name)) return monthIndex;
    }
    
    // Try parsing as date and extract month
    const parsed = parseDate(label);
    if (parsed && !isNaN(parsed.getTime())){
      return parsed.getMonth();
    }
    
    // Try MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY patterns
    const datePatterns = [
      /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/, // MM/DD/YYYY or DD/MM/YYYY
      /^(\d{1,2})[\/\-\.](\d{4})$/, // MM/YYYY
    ];
    
    for (const pattern of datePatterns){
      const match = s.match(pattern);
      if (match){
        const month = parseInt(match[1], 10);
        if (month >= 1 && month <= 12) return month - 1; // Convert to 0-based
      }
    }
    
    return null; // No month detected
  }

  function getColorForLabel(label, fallbackColor = PALETTE.primary){
    const month = getMonthFromLabel(label);
    if (month !== null && month >= 0 && month < 12){
      return MONTH_COLORS[month];
    }
    return fallbackColor;
  }

  function createMonthLegend(labels){
    const monthsUsed = new Set();
    const legendItems = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Collect unique months from the data
    labels.forEach(label => {
      const month = getMonthFromLabel(label);
      if (month !== null && month >= 0 && month < 12){
        monthsUsed.add(month);
      }
    });
    
    // Create legend items for used months
    Array.from(monthsUsed).sort((a, b) => a - b).forEach(month => {
      legendItems.push(`<span class="month-legend-item"><span class="month-color" style="background-color: ${MONTH_COLORS[month]}"></span>${monthNames[month]}</span>`);
    });
    
    return legendItems.length > 1 ? `<div class="month-legend">${legendItems.join('')}</div>` : '';
  }

  function getHeader(regex){
    return headers.find(h => regex.test(String(h))) || null;
  }

  // Download chart functionality
  function downloadChart(chartId, filename) {
    const el = document.getElementById(chartId);
    if (!el || !window.Plotly) {
      console.warn('Cannot download chart:', chartId);
      return;
    }
    
    // Use Plotly's built-in download function
    window.Plotly.downloadImage(el, {
      format: 'png',
      width: 1400,
      height: 700,
      filename: filename || chartId
    });
  }

  function addDownloadButton(chartId, chartTitle) {
    const el = document.getElementById(chartId);
    if (!el) return;
    
    // Check if button already exists
    let btnContainer = el.querySelector('.chart-download-btn-container');
    if (btnContainer) return; // Already exists
    
    btnContainer = document.createElement('div');
    btnContainer.className = 'chart-download-btn-container';
    btnContainer.innerHTML = `
      <button class="chart-download-btn" title="Download chart as PNG">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download
      </button>
    `;
    
    // Insert directly into the chart container
    el.appendChild(btnContainer);
    
    // Add click handler
    const btn = btnContainer.querySelector('.chart-download-btn');
    btn.onclick = () => {
      const filename = `${chartTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`;
      downloadChart(chartId, filename);
    };
  }

  function sumByHeader(regex){
    const col = getHeader(regex);
    if (!col) return { sum:null, found:false };
    let sum = 0; let found = false;
    for (const r of rows){
      const v = parseNumberEU(r[col]);
      if (!Number.isNaN(v)){ sum += v; found = true; }
    }
    return { sum: found ? Math.round(sum) : null, found };
  }

  function filterEmptyBuckets(labels, data){
    const fl = [], fd = [];
    for (let i=0;i<labels.length;i++){
      const lab = String(labels[i]||'').trim();
      if (!lab) continue;
      if (/^\(empty\)$/i.test(lab)) continue;
      fl.push(labels[i]);
      fd.push(data[i]);
    }
    return { labels: fl, data: fd };
  }

  function plotlyBars(el, traces, layout){
    if (window.Plotly){
      try { window.Plotly.purge(el); } catch(e){}
      const config = { responsive:true, displaylogo:false, modeBarButtonsToRemove:['toImage','zoom2d','autoScale2d','toggleSpikelines'] };
      const themedLayout = Object.assign({
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: { color: PALETTE.text },
        xaxis: { gridcolor: PALETTE.grayGrid, zerolinecolor: PALETTE.grayGrid },
        yaxis: { gridcolor: PALETTE.grayGrid, zerolinecolor: PALETTE.grayGrid },
        legend: { bgcolor:'#ffffff' },
        title: { font: { size: 18, color: PALETTE.text } },
        margin: { l:30, r:16, t:30, b:40 }
      }, layout||{});
      window.Plotly.newPlot(el, traces, themedLayout, config);
    } else {
      el.innerHTML = '<div class="muted">Plotly not loaded.</div>';
    }
  }

  function plotlyPie(el, trace, layout){
    if (window.Plotly){
      try { window.Plotly.purge(el); } catch(e){}
      const config = { responsive:true, displaylogo:false, modeBarButtonsToRemove:['toImage','zoom2d','autoScale2d','toggleSpikelines'] };
      const themedLayout = Object.assign({
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: { color: PALETTE.text },
        legend: { orientation:'h', x:0.5, xanchor:'center', bgcolor:'#ffffff' },
        title: { font: { size: 18, color: PALETTE.text } },
        margin: { l:16, r:16, t:28, b:28 }
      }, layout||{});
      window.Plotly.newPlot(el, [trace], themedLayout, config);
    } else {
      el.innerHTML = '<div class="muted">Plotly not loaded.</div>';
    }
  }

  async function readFileAsArrayBuffer(file){
    return new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsArrayBuffer(file);
    });
  }


  function ensureLibs(){
    if (typeof XLSX === 'undefined'){
      setStatus('Error: XLSX library not loaded');
      console.error('SheetJS (XLSX) not available');
      return false;
    }
    return true;
  }

  function loadWorkbook(ab){
    if(!ensureLibs()) return;
    resetWorker();
    workbook = XLSX.read(ab, { type:'array' });
    try { console.log('[raport] Workbook loaded. Sheets:', workbook.SheetNames.length); } catch(e) {}
    sheetSelect.innerHTML = '';
    workbook.SheetNames.forEach((name,i)=>{
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      if(i===0) opt.selected = true;
      sheetSelect.appendChild(opt);
    });
    activeSheetName = workbook.SheetNames[0];
    hydrateSheet();
  }

  function hydrateSheet(){
    activeSheetName = sheetSelect.value || workbook.SheetNames[0];
    const ws = workbook.Sheets[activeSheetName];
    rows = XLSX.utils.sheet_to_json(ws, { defval:'', raw:false });
    headers = rows.length ? Object.keys(rows[0]) : [];
    // Fallback: if no headers detected, try reading as rows and infer header from the first non-empty row
    if (!headers.length){
      try{
        const arr = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false });
        // Find header row: first array with at least one non-empty cell
        let headerRowIndex = -1;
        for(let i=0;i<arr.length;i++){
          const r = arr[i]||[];
          if (r.some(cell => String(cell||'').trim() !== '')){ headerRowIndex = i; break; }
        }
        if (headerRowIndex >= 0){
          const hdrs = (arr[headerRowIndex] || []).map((h,idx)=> String(h||`Column ${idx+1}`).trim());
          headers = hdrs;
          const dataRows = arr.slice(headerRowIndex+1);
          rows = dataRows.map(rArr => {
            const obj = {};
            headers.forEach((h,idx)=>{ obj[h] = rArr[idx] ?? ''; });
            return obj;
          });
        }
      }catch(e){ console.warn('Header fallback failed', e); }
    }
    try { console.log('[raport] Hydrate sheet:', activeSheetName, 'rows:', rows.length, 'headers:', headers.length); } catch(e) {}
    if (categorySelect){
      categorySelect.innerHTML = '';
      const allowedCategoryPatterns = [
        /^cluster$/i,
        /sent\s+out\s+from\s+annual\s+run\s*\/\s*worklist/i,
        /date\s+of\s+requesting/i,
        /date\s+of\s+uploading\s*\/\s*maintenance\s+of\s+ltsd/i,
        /format\s+of\s+ltsd\s+in\s+maintenance\s+process\s+in\s+s4hana\s*\(btp\/\s*supplier'?s\s+format\/\s+manual\s*\)\+\s*supplier'?s\s+refusal/i,
        /type\s+of\s+maintained\s+ltsd\s*\(partially\/?\s*fully\)/i,
      ];
      const allowedCategories = headers.filter(h => allowedCategoryPatterns.some(rx => rx.test(String(h))));
      allowedCategories.forEach(h=>{
        const o = document.createElement('option');
        o.value = h; o.textContent = h; categorySelect.appendChild(o);
      });
    }
    drawMeta();
    drawPreview();
    drawStructure();
    // Render stacked charts in requested order, including missing ones
    try { buildKPIReport(); } catch(e) { console.warn('KPI render failed', e); }
    try { buildKpiTimeline(); } catch(e) { console.warn('KPI Timeline render failed', e); }
    try { buildClusterChart(); } catch(e) { console.warn('Cluster chart failed', e); }
    try { buildPieFormatReport(); } catch(e) { console.warn('Pie format failed', e); }
    try { buildPieTotalReport(); } catch(e) { console.warn('Pie total failed', e); }
    // Additional counts charts
    try { buildCountsForHeader(/sent\s+out\s+from\s+annual\s+run\s*\/\s*worklist/i, 'chartARWL', 'AR vs WL'); } catch(e) { console.warn('AR/WL chart failed', e); }
    // Date charts with toggle support
    try { buildDateChart(/date\s+of\s+requesting/i, 'chartDateRequest', 'Date of Requesting'); } catch(e) { console.warn('Date requesting chart failed', e); }
    try { buildDateChart(/date\s+of\s+uploading\s*\/\s*maintenance\s+of\s+ltsd/i, 'chartDateUploadMaint', 'Date of Uploading/Maintenance'); } catch(e) { console.warn('Date upload/maint chart failed', e); }
    try { buildCountsForHeader(/type\s+of\s+maintained\s+ltsd/i, 'chartTypeMaintained', 'Type of Maintained LTSD', true); } catch(e) { console.warn('Type maintained chart failed', e); }
  }

  function drawMeta(){
    meta.innerHTML = `Sheets: <b>${workbook.SheetNames.length}</b> • Active: <b>${activeSheetName}</b> • Rows: <b>${rows.length}</b> • Columns: <b>${headers.length}</b>`;
  }

  function drawPreview(){
    const limit = Math.max(10, Math.min(1000, parseInt(rowsLimit.value||'100',10)));
    const sample = rows.slice(0, limit);
    if(!headers.length){ tableWrap.innerHTML = '<div class="muted">No data in sheet.</div>'; return; }
    if (window.Tabulator){
      // Destroy previous table instance if any
      if (tabulatorTable){ try{ tabulatorTable.destroy(); }catch(e){} }
      tableWrap.innerHTML = '';
      const el = document.createElement('div');
      tableWrap.appendChild(el);
      const columns = headers.map(h=>({ title: h, field: h, headerSort:true, widthGrow:1, headerFilter:"input", headerFilterPlaceholder:"filter" }));
      tabulatorTable = new Tabulator(el, {
        data: sample,
        columns,
        layout: 'fitDataStretch',
        height: 380,
        placeholder: 'No data',
        pagination: false,
        progressiveRender: true,
      });
    } else {
      const thead = `<thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${sample.map(r=>`<tr>${headers.map(h=>`<td>${escapeHtml(String(r[h]??''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
      tableWrap.innerHTML = `<table>${thead}${tbody}</table>`;
    }
  }

  function inferColumnStats(col){
    let nonEmpty=0, unique=new Set(), types={ number:0, integer:0, date:0, boolean:0, text:0 };
    const samples=[];
    for(const r of rows){
      const v = r[col];
      if(v!=='' && v!=null){
        nonEmpty++;
        unique.add(v);
        if(samples.length<3) samples.push(v);
        const num = Number(v);
        const d = Date.parse(v);
        if(v==='true' || v==='false' || typeof v==='boolean'){ types.boolean++; continue; }
        if(!Number.isNaN(num) && /^-?\d+(?:[.,]\d+)?$/.test(String(v).replace(',', '.'))){
          if(Number.isInteger(num)) types.integer++; else types.number++;
          continue;
        }
        if(!Number.isNaN(d) && /\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(String(v))){ types.date++; continue; }
        types.text++;
      }
    }
    const total = rows.length || 1;
    const missing = total - nonEmpty;
    const missingPct = ((missing/total)*100).toFixed(1)+'%';
    const typeLabel = pickDominantType(types);
    return { nonEmpty, missing, missingPct, unique: unique.size, typeLabel, samples };
  }

  function pickDominantType(t){
    const order=['integer','number','date','boolean','text'];
    let best='text', bestVal=-1;
    for(const k of order){ if(t[k]>bestVal){ best=k; bestVal=t[k]; } }
    return best;
  }

  function drawStructure(){
    if(!workbook){ structureEl.innerHTML=''; return; }
    const cards = [];
    let ltsdMaintainedCard = '';
    const allowedPatterns = [
      /cluster/i,
      /ltsd\s+proposal/i,
      /requested\s+materials\s+from\s+annual\s+run/i,
      /ltsd\s+maintained/i,
      /maintained\s+materials\s+from\s+annual\s+run/i,
      /requested\s+materials\s+from\s+normal\s+worklist/i,
      /maintained\s+materials\s+from\s+normal\s+worklist/i,
      /format\s+of\s+ltsd/i,
      /format\s+of\s+ltsd\s+in\s+maintenance\s+process/i,
      /supplier'?s\s+refusal/i,
      /type\s+of\s+maintained\s+ltsd/i,
    ];
    const showHeaders = headers.filter(h => allowedPatterns.some(rx => rx.test(String(h))));
    // Per-header rendering using small builders
    function buildClusterCard(h){
      // Use numeric columns for maintained calculation
      const maintainedNumericCol = headers.find(x => /maintained\s+materials\s+from\s+annual\s+run/i.test(String(x)));
      const requestedNumericCol = headers.find(x => /requested\s+materials\s+from\s+annual\s+run/i.test(String(x)));
      const maintainedFlagCol = findMaintainedFlagColumn();
      
      const by = new Map(); let totalNonEmpty = 0; let totalRequested = 0; let totalMaintained = 0;
      for (const r of rows){
        const rawKey = String(r[h] ?? '').trim();
        if(!rawKey) continue;
        const key = rawKey;
        const cur = by.get(key) || { count:0, maintained:0, requested:0, maintainedByFlag:0 };
        cur.count++;
        
        // Sum numeric maintained values
        if (maintainedNumericCol){
          const mVal = parseNumberEU(r[maintainedNumericCol]);
          if (!Number.isNaN(mVal)) cur.maintained += mVal;
        }
        // Sum numeric requested values
        if (requestedNumericCol){
          const reqVal = parseNumberEU(r[requestedNumericCol]);
          if (!Number.isNaN(reqVal)) cur.requested += reqVal;
        }
        // Also count flag-based maintained
        if (maintainedFlagCol && isMaintained(r[maintainedFlagCol])) cur.maintainedByFlag++;
        
        by.set(key, cur);
        totalNonEmpty++;
      }
      
      // Calculate total requested for percentage
      for (const [, info] of by){ totalRequested += info.requested; totalMaintained += info.maintained; }
      
      const denom = totalNonEmpty || 1;
      const items = Array.from(by.entries()).sort((a,b)=> b[1].count - a[1].count).map(([key,info])=>{
        const pct = Math.round(info.count * 10000 / denom) / 100;
        // Calculate maintained % based on requested for this cluster
        const mPct = info.requested > 0 ? Math.round(info.maintained * 10000 / info.requested) / 100 : 0;
        return `<div><b>${escapeHtml(key)}:</b> ${info.count} (${pct.toFixed(2)}%) • Maintained: ${Math.round(info.maintained)} (${mPct.toFixed(2)}%)</div>`;
      }).join('');
      return `<div class="struct-card"><h3>Cluster</h3><div class="struct-kv"></div><div class="struct-breakdown">${items}</div></div>`;
    }
    function buildFormatCard(h){
      const by = new Map(); let totalNonEmpty = 0;
      for (const r of rows){ const rawKey = String(r[h] ?? '').trim(); if(!rawKey) continue; const key = rawKey; by.set(key, (by.get(key)||0)+1); totalNonEmpty++; }
      const denom = totalNonEmpty || 1;
      const items = Array.from(by.entries()).sort((a,b)=> b[1] - a[1]).map(([key,count])=>{ const pct = Math.round(count * 10000 / denom) / 100; return `<div><b>${escapeHtml(key)}:</b> ${count} (${pct.toFixed(2)}%)</div>`; }).join('');
      return `<div class="struct-card"><h3>Format of LTSD</h3><div class="struct-kv"></div><div class="struct-breakdown">${items}</div></div>`;
    }
    function buildTypeMaintainedCard(h){
      let fully=0, partially=0, total=0; for(const r of rows){ const val = String(r[h] ?? '').trim().toLowerCase(); if(!val) continue; total++; if(/fully/i.test(val)) fully++; else if(/partial/i.test(val)) partially++; }
      const denom = total || 1; const fPct = Math.round(fully * 10000 / denom) / 100; const pPct = Math.round(partially * 10000 / denom) / 100;
      const items = `<div><b>Fully:</b> ${fully} (${fPct.toFixed(2)}%)</div><div><b>Partially:</b> ${partially} (${pPct.toFixed(2)}%)</div>`;
      return `<div class="struct-card"><h3>Type of maintained LTSD</h3><div class="struct-kv"></div><div class="struct-breakdown">${items}</div></div>`;
    }
    function buildTotalsCard(){
      const totalRequestedAll = (inferRequestedTotal()||0) + (inferRequestedNormalTotal()||0);
      const totalMaintainedAll = (inferMaintainedAnnualTotal()||0) + (inferMaintainedNormalTotal()||0);
      const totalPct = totalRequestedAll>0 ? ((totalMaintainedAll/totalRequestedAll)*100).toFixed(2) + '%' : '0%';
      return `<div class="struct-card"><h3>Total maintained vs requested (AR+WL)</h3><div class="struct-kv">`+
        `<div><b>Total requested:</b> ${totalRequestedAll}</div>`+
        `<div><b>Total maintained:</b> ${totalMaintainedAll}</div>`+
        `<div><b>Progress:</b> ${totalPct}</div>`+
      `</div></div>`;
    }

    showHeaders.forEach(h=>{
      const isCluster = /^cluster$/i.test(String(h));
      const isLTSDProposal = /ltsd\s+proposal/i.test(String(h));
      const isRequestedAnnual = /requested\s+materials\s+from\s+annual\s+run/i.test(String(h));
      const isRequestedNormal = /requested\s+materials\s+from\s+normal\s+worklist/i.test(String(h));
      const isMaintainedAnnual = /maintained\s+materials\s+from\s+annual\s+run/i.test(String(h));
      const isMaintainedNormal = /maintained\s+materials\s+from\s+normal\s+worklist/i.test(String(h));
      const isLtsdMaintained = /ltsd\s+maintained/i.test(String(h));
      const isFormat = /(format\s+of\s+ltsd|supplier'?s\s+refusal)/i.test(String(h));
      const isTypeMaintained = /type\s+of\s+maintained\s+ltsd/i.test(String(h));

      if (isCluster){ cards.push(buildClusterCard(h)); return; }
      if (isFormat){ cards.push(buildFormatCard(h)); return; }
      if (isTypeMaintained){ cards.push(buildTypeMaintainedCard(h)); return; }

      const s = inferColumnStats(h);
      let missingRow = '';
      if (!isRequestedAnnual && !isRequestedNormal && !isLtsdMaintained && !isMaintainedAnnual && !isMaintainedNormal){
        missingRow = `<div><b>Missing:</b> ${s.missing} (${s.missingPct})</div>`;
      }
      const uniqueLabel = isLTSDProposal ? 'Sent' : 'Unique';
      const uniqueRow = (!isRequestedAnnual && !isRequestedNormal && !isMaintainedAnnual && !isMaintainedNormal && !isLtsdMaintained) ? `<div><b>${uniqueLabel}:</b> ${s.unique}</div>` : '';

      if (isLtsdMaintained){
        const proposalCol = headers.find(x => /ltsd\s+proposal/i.test(String(x)));
        const maintainedCol = findMaintainedFlagColumn();
        let proposalCount = 0, maintainedCount = 0;
        if (proposalCol){ for (const r of rows){ const v = r[proposalCol]; if (v!=='' && v!=null) proposalCount++; } }
        if (maintainedCol){ for (const r of rows){ if (isMaintained(r[maintainedCol])) maintainedCount++; } }
        const totalMaintainedByFlag = maintainedCount;
        const extra = `<div class="struct-breakdown"><div><b>Total:</b> ${totalMaintainedByFlag}</div></div>`;
        const cardMarkup = `<div class="struct-card"><h3>LTSD maintained</h3><div class="struct-kv">${uniqueRow}${missingRow}</div>${extra}</div>`;
        ltsdMaintainedCard = cardMarkup; return;
      }

      let totalRequestedRow = '';
      if (isRequestedAnnual){ const totalReq = inferRequestedTotal(); totalRequestedRow = `<div><b>Total requested:</b> ${totalReq ?? 0}</div>`; }
      let totalRequestedNormalRow = '';
      if (isRequestedNormal){ const totalReqN = inferRequestedNormalTotal(); totalRequestedNormalRow = `<div><b>Total requested:</b> ${totalReqN ?? 0}</div>`; }
      let totalMaintainedAnnualRow = '';
      if (isMaintainedAnnual){ const totalMaint = inferMaintainedAnnualTotal(); const requestedTotal = inferRequestedTotal(); const mPct = (requestedTotal>0 && totalMaint!=null) ? ((totalMaint / requestedTotal) * 100).toFixed(1) + '%' : '0%'; totalMaintainedAnnualRow = `<div><b>Total maintained:</b> ${totalMaint ?? 0} (${mPct})</div>`; }
      let totalMaintainedNormalRow = '';
      if (isMaintainedNormal){ const totalMaintainedNormal = inferMaintainedNormalTotal(); totalMaintainedNormalRow = `<div><b>Total maintained:</b> ${totalMaintainedNormal ?? 0}</div>`; }

      const title = String(h);
      const cardMarkup = `<div class="struct-card"><h3>${escapeHtml(title)}</h3><div class="struct-kv">`+
        `${uniqueRow}`+
        `${missingRow}`+
        `${totalRequestedRow}`+
        `${totalRequestedNormalRow}`+
        `${totalMaintainedAnnualRow}`+
        `${totalMaintainedNormalRow}`+
      `</div></div>`;
      cards.push(cardMarkup);
    });

    const totalCard = buildTotalsCard();
    structureEl.innerHTML = cards.join('') + ltsdMaintainedCard + totalCard;
  }

  function escapeHtml(s){
    const str = String(s);
    return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
  }

  function computeCountsBySync(column){
    if (window.aq){
      try{
        const t = window.aq.from(rows);
        const g = t.groupby(column).count();
        const sorted = g.orderby(window.aq.desc('count')).objects();
        const labels = sorted.map(d=> String(d[column] ?? '').trim() || '(empty)');
        const data = sorted.map(d=> d.count);
        return { labels, data };
      }catch(err){ console.warn('Arquero counts failed, falling back', err); }
    }
    const map = new Map();
    rows.forEach(r=>{
      const key = String(r[column] ?? '').trim() || '(empty)';
      map.set(key, (map.get(key)||0)+1);
    });
    const labels = Array.from(map.keys());
    const data = Array.from(map.values());
    return { labels, data };
  }

  function computeCountsByAsync(column){
    return new Promise((resolve)=>{
      const w = getWorker();
      const useWorker = w && rows.length > 5000;
      if (!useWorker){ resolve(computeCountsBySync(column)); return; }
      const onMsg = (ev)=>{
        const { type, payload } = ev.data || {};
        if (type === 'counts-done'){ w.removeEventListener('message', onMsg); resolve(payload); }
        if (type === 'error'){ w.removeEventListener('message', onMsg); console.warn('Worker error:', payload); resolve(computeCountsBySync(column)); }
      };
      w.addEventListener('message', onMsg);
      try{ w.postMessage({ type:'counts', payload:{ rows, column } }); }catch(e){ w.removeEventListener('message', onMsg); console.warn('Worker post failed', e); resolve(computeCountsBySync(column)); }
    });
  }

  // exportCSV/exportXLSX removed

  // Store chart state for date charts (for toggle functionality)
  const dateChartState = {
    chartDateRequest: { sortMode: 'byValue', col: null, data: null },
    chartDateUploadMaint: { sortMode: 'byValue', col: null, data: null }
  };

  function sortDateData(rawData, mode){
    // rawData = array of { label, count, dateObj }
    console.log(`[sortDateData] Mode: ${mode}, data sample:`, rawData.slice(0, 3).map(d => ({ label: d.label, dateObj: d.dateObj ? d.dateObj.toISOString() : 'null' })));
    
    if (mode === 'chronological'){
      // Sort by date ascending
      const sorted = [...rawData].sort((a,b) => {
        if (!a.dateObj && !b.dateObj) return 0;
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return a.dateObj.getTime() - b.dateObj.getTime();
      });
      console.log(`[sortDateData] Chronological sort result sample:`, sorted.slice(0, 5).map(d => ({ label: d.label, date: d.dateObj ? d.dateObj.toISOString().split('T')[0] : 'null' })));
      return sorted;
    } else {
      // Sort by count descending (default)
      const sorted = [...rawData].sort((a,b) => b.count - a.count);
      console.log(`[sortDateData] By count sort result sample:`, sorted.slice(0, 5).map(d => ({ label: d.label, count: d.count })));
      return sorted;
    }
  }

  function renderDateChart(elId, title, sortedData, sortMode){
    const el = document.getElementById(elId);
    if (!el) {
      console.warn(`[renderDateChart] Element not found: ${elId}`);
      return;
    }
    
    console.log(`[renderDateChart] Rendering ${elId} with mode:`, sortMode, 'data points:', sortedData.length);
    
    // First, clean up any existing legends from previous renders
    document.querySelectorAll('.month-legend-container').forEach(legend => legend.remove());
    
    const labels = sortedData.map(d => d.label);
    const data = sortedData.map(d => d.count);
    
    // Generate colors based on month detection
    const colors = labels.map(label => getColorForLabel(label));
    
    const trace = { 
      type:'bar', 
      x: labels, 
      y: data, 
      marker:{ 
        color: colors,
        line: { color: '#ffffff', width: 1 }
      }, 
      text: data.map(v=> String(v)), 
      textposition:'outside', 
      cliponaxis:false 
    };
    const layout = { 
      title: { text: title, x: 0.5 }, 
      margin:{l:40,r:10,t:60,b:80}, 
      xaxis:{ type:'category', tickangle: -45 }, 
      yaxis:{ rangemode:'tozero' } 
    };
    plotlyBars(el, [trace], layout);
    
    // Add download button
    addDownloadButton(elId, title);
    
    // Add month legend only for Date of Uploading/Maintenance chart
    if (elId === 'chartDateUploadMaint') {
      const legend = createMonthLegend(labels);
      if (legend){
        const legendContainer = document.createElement('div');
        legendContainer.className = 'month-legend-container';
        legendContainer.innerHTML = legend;
        // Insert after the chart element
        el.parentNode.insertBefore(legendContainer, el.nextSibling);
      }
    }
    
    // Add or update toggle buttons
    let toggleContainer = el.parentNode.querySelector('.chart-toggle-container');
    if (!toggleContainer){
      toggleContainer = document.createElement('div');
      toggleContainer.className = 'chart-toggle-container';
      el.parentNode.insertBefore(toggleContainer, el);
      console.log(`[renderDateChart] Created toggle container for ${elId}`);
    } else {
      console.log(`[renderDateChart] Reusing toggle container for ${elId}`);
    }
    
    const isChronological = sortMode === 'chronological';
    toggleContainer.innerHTML = `
      <div class="chart-toggle-btns">
        <button class="chart-toggle-btn ${!isChronological ? 'active' : ''}" data-mode="byValue" data-chart="${elId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="7"/><rect x="12" y="9" width="3" height="11"/><rect x="17" y="5" width="3" height="15"/>
          </svg>
          By Count
        </button>
        <button class="chart-toggle-btn ${isChronological ? 'active' : ''}" data-mode="chronological" data-chart="${elId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Chronological
        </button>
      </div>
    `;
    
    console.log(`[renderDateChart] Toggle buttons added for ${elId}`);
    
    // Add event listeners to toggle buttons
    toggleContainer.querySelectorAll('.chart-toggle-btn').forEach(btn => {
      btn.onclick = () => {
        const newMode = btn.dataset.mode;
        const chartId = btn.dataset.chart;
        console.log(`[renderDateChart] Toggle clicked for ${chartId}, mode:`, newMode);
        console.log(`[renderDateChart] Current state for ${chartId}:`, dateChartState[chartId] ? 'exists' : 'missing');
        if (dateChartState[chartId]){
          console.log(`[renderDateChart] State data length:`, dateChartState[chartId].data.length);
          dateChartState[chartId].sortMode = newMode;
          const sorted = sortDateData(dateChartState[chartId].data, newMode);
          const chartTitle = chartId === 'chartDateRequest' ? 'Date of Requesting' : 'Date of Uploading/Maintenance';
          renderDateChart(chartId, chartTitle, sorted, newMode);
        } else {
          console.warn(`[renderDateChart] No state found for chart: ${chartId}`);
          console.log(`[renderDateChart] Available states:`, Object.keys(dateChartState));
        }
      };
    });
  }

  async function buildDateChart(headerRegex, elId, title){
    const el = document.getElementById(elId);
    if (!el) {
      console.warn(`[buildDateChart] Element not found: ${elId}`);
      return;
    }
    const col = headers.find(h => headerRegex.test(String(h)));
    if (!col){ 
      console.warn(`[buildDateChart] Column not found for ${elId}:`, headerRegex);
      el.innerHTML = `<div class="muted">Column not found for: ${escapeHtml(String(title))}</div>`; 
      return; 
    }
    
    console.log(`[buildDateChart] Building chart ${elId} with column:`, col);
    
    // Collect data with parsed dates for sorting
    const countMap = new Map();
    let sampleCount = 0;
    for (const r of rows){
      const rawVal = r[col];
      const label = String(rawVal ?? '').trim();
      if (!label || label === '(empty)') continue;
      
      const dateObj = parseDate(rawVal);
      if (sampleCount < 5) {
        console.log(`[buildDateChart] ${elId} parsing sample:`, { rawVal, label, dateObj: dateObj ? dateObj.toISOString() : 'null' });
        sampleCount++;
      }
      
      if (!countMap.has(label)){
        countMap.set(label, { label, count: 0, dateObj });
      }
      countMap.get(label).count++;
    }
    
    let rawData = Array.from(countMap.values());
    
    // Count how many entries have valid dates
    const validDates = rawData.filter(d => d.dateObj).length;
    const invalidDates = rawData.length - validDates;
    console.log(`[buildDateChart] Data for ${elId}:`, rawData.length, 'entries,', validDates, 'with valid dates,', invalidDates, 'without dates');
    
    // Store raw data for toggle
    dateChartState[elId] = { 
      sortMode: 'byValue', 
      col, 
      data: rawData 
    };
    
    // Initial render sorted by value
    const sorted = sortDateData(rawData, 'byValue');
    renderDateChart(elId, title, sorted, 'byValue');
  }

  async function buildCountsForHeader(headerRegex, elId, title, mergeTypeMaint=false){
    const el = document.getElementById(elId);
    if (!el) return;
    const col = headers.find(h => headerRegex.test(String(h)));
    if (!col){ el.innerHTML = `<div class="muted">Column not found for: ${escapeHtml(String(title))}</div>`; return; }
    let { labels, data } = await computeCountsByAsync(col);
    if (mergeTypeMaint){
      const merged = new Map();
      for (let i=0;i<labels.length;i++){
        const rawLab = String(labels[i]||'').trim().toLowerCase();
        let key = null;
        if (/fully/i.test(rawLab)) key = 'Fully';
        else if (/partial/i.test(rawLab)) key = 'Partially';
        if (!key) continue;
        merged.set(key, (merged.get(key)||0) + (data[i]||0));
      }
      labels = Array.from(merged.keys());
      data = Array.from(merged.values());
    }
    ({ labels, data } = filterEmptyBuckets(labels, data));
    const trace = { type:'bar', x: labels, y: data, marker:{ color:'#0b4a84' }, text: data.map(v=> String(v)), textposition:'outside', cliponaxis:false };
    const layout = { title, margin:{l:40,r:10,t:30,b:80}, xaxis:{ type:'category', tickangle: -30 }, yaxis:{ rangemode:'tozero' } };
    plotlyBars(el, [trace], layout);
    
    // Add download button
    addDownloadButton(elId, title);
  }

  async function buildClusterChart(){
    const el = document.getElementById('chartCluster');
    if (!el){ return; }
    const col = headers.find(h=> /^cluster$/i.test(String(h)));
    if(!col){ el.innerHTML = '<div class="muted">Cluster column not found.</div>'; return; }
    if (window.Plotly){
      try { window.Plotly.purge(el); } catch(e){}
      const clusterCol = headers.find(h=> /^cluster$/i.test(String(h))) || col;
      
      // Annual Run columns
      const requestedARCol = headers.find(h=> /requested\s+materials\s+from\s+annual\s+run/i.test(String(h)));
      const maintainedARCol = headers.find(h=> /maintained\s+materials\s+from\s+annual\s+run/i.test(String(h)));
      
      // Normal Worklist columns
      const requestedWLCol = headers.find(h=> /requested\s+materials\s+from\s+normal\s+worklist/i.test(String(h)));
      const maintainedWLCol = headers.find(h=> /maintained\s+materials\s+from\s+normal\s+worklist/i.test(String(h)));
      
      console.log('[buildClusterChart] Columns found:', {
        cluster: clusterCol,
        requestedAR: requestedARCol,
        maintainedAR: maintainedARCol,
        requestedWL: requestedWLCol,
        maintainedWL: maintainedWLCol
      });
      
      // Check if we have at least Annual Run columns
      if (!requestedARCol || !maintainedARCol){
        el.innerHTML = '<div class="muted">Required columns not found: "Requested materials from Annual Run" and "Maintained Materials From Annual Run".</div>';
      } else {
        const by = new Map();
        for (const r of rows){
          const keyRaw = String(r[clusterCol] ?? '').trim();
          if (!keyRaw) continue;
          const key = keyRaw;
          const cur = by.get(key) || { 
            count: 0, 
            requestedAR: 0, 
            maintainedAR: 0, 
            requestedWL: 0, 
            maintainedWL: 0 
          };
          cur.count++;
          
          // Annual Run
          const reqAR = parseNumberEU(r[requestedARCol]); 
          if (!Number.isNaN(reqAR)) cur.requestedAR += reqAR;
          const mAR = parseNumberEU(r[maintainedARCol]); 
          if (!Number.isNaN(mAR)) cur.maintainedAR += mAR;
          
          // Normal Worklist (if columns exist)
          if (requestedWLCol) {
            const reqWL = parseNumberEU(r[requestedWLCol]); 
            if (!Number.isNaN(reqWL)) cur.requestedWL += reqWL;
          }
          if (maintainedWLCol) {
            const mWL = parseNumberEU(r[maintainedWLCol]); 
            if (!Number.isNaN(mWL)) cur.maintainedWL += mWL;
          }
          
          by.set(key, cur);
        }
        
        // Sort clusters by total requested (AR + WL) descending
        const sortedKeys = Array.from(by.keys()).sort((a, b) => {
          const totalA = by.get(a).requestedAR + by.get(a).requestedWL;
          const totalB = by.get(b).requestedAR + by.get(b).requestedWL;
          return totalB - totalA;
        });
        
        const labels = sortedKeys.map(k => `Cluster ${k}`);
        const counts = sortedKeys.map(k => by.get(k).count);
        
        // Calculate totals (AR + WL)
        const totalRequested = sortedKeys.map(k => Math.round(by.get(k).requestedAR + by.get(k).requestedWL));
        const totalMaintained = sortedKeys.map(k => Math.round(by.get(k).maintainedAR + by.get(k).maintainedWL));
        
        // Individual breakdowns for detailed view
        const requestedAR = sortedKeys.map(k => Math.round(by.get(k).requestedAR));
        const maintainedAR = sortedKeys.map(k => Math.round(by.get(k).maintainedAR));
        const requestedWL = sortedKeys.map(k => Math.round(by.get(k).requestedWL));
        const maintainedWL = sortedKeys.map(k => Math.round(by.get(k).maintainedWL));
        
        // Calculate completion percentages
        const completionPct = sortedKeys.map(k => {
          const total = by.get(k).requestedAR + by.get(k).requestedWL;
          const maintained = by.get(k).maintainedAR + by.get(k).maintainedWL;
          return total > 0 ? Math.round((maintained / total) * 100) : 0;
        });
        
        // Build traces - show totals with breakdown in hover
        const traces = [
          { 
            type: 'bar', 
            name: 'LTSD Count', 
            x: labels, 
            y: counts, 
            marker: { color: PALETTE.primary }, 
            text: counts.map(v => String(v)), 
            textposition: 'outside', 
            cliponaxis: false,
            hovertemplate: '<b>%{x}</b><br>LTSD Count: %{y}<extra></extra>'
          },
          { 
            type: 'bar', 
            name: 'Total Requested (AR+WL)', 
            x: labels, 
            y: totalRequested, 
            marker: { color: PALETTE.success }, 
            text: totalRequested.map(v => String(v)), 
            textposition: 'outside', 
            cliponaxis: false,
            customdata: sortedKeys.map((k, i) => ({
              ar: requestedAR[i],
              wl: requestedWL[i]
            })),
            hovertemplate: '<b>%{x}</b><br>Total Requested: %{y}<br>Annual Run: %{customdata.ar}<br>Worklist: %{customdata.wl}<extra></extra>'
          },
          { 
            type: 'bar', 
            name: 'Total Maintained (AR+WL)', 
            x: labels, 
            y: totalMaintained, 
            marker: { color: PALETTE.danger }, 
            text: totalMaintained.map((v, i) => `${v} (${completionPct[i]}%)`), 
            textposition: 'outside', 
            cliponaxis: false,
            customdata: sortedKeys.map((k, i) => ({
              ar: maintainedAR[i],
              wl: maintainedWL[i],
              pct: completionPct[i]
            })),
            hovertemplate: '<b>%{x}</b><br>Total Maintained: %{y} (%{customdata.pct}%)<br>Annual Run: %{customdata.ar}<br>Worklist: %{customdata.wl}<extra></extra>'
          },
        ];
        
        const layout = { 
          title: 'Cluster Comparison (Annual Run + Worklist)', 
          barmode: 'group', 
          xaxis: { type: 'category', tickangle: -30 }, 
          yaxis: { rangemode: 'tozero' },
          legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
          height: 650,
          margin: { l: 60, r: 40, t: 80, b: 150 }
        };
        plotlyBars(el, traces, layout);
        
        // Add download button
        addDownloadButton('chartCluster', 'Cluster Comparison');
        
        // Log summary
        console.log('[buildClusterChart] Summary:', sortedKeys.map(k => ({
          cluster: k,
          count: by.get(k).count,
          requestedAR: Math.round(by.get(k).requestedAR),
          requestedWL: Math.round(by.get(k).requestedWL),
          maintainedAR: Math.round(by.get(k).maintainedAR),
          maintainedWL: Math.round(by.get(k).maintainedWL)
        })));
      }
    }
  }

  function parseDate(val){
    if (val instanceof Date){
      return Number.isNaN(val.getTime()) ? null : val;
    }
    // Handle Excel serial numbers (dates stored as numbers)
    if (typeof val === 'number' && !Number.isNaN(val)){
      // Excel serial date: days since 1899-12-30
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const ms = Math.round(val * 86400000);
      const dt = new Date(excelEpoch.getTime() + ms);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const s = String(val||'').trim();
    if(!s) return null;
    // Numeric string as Excel serial
    if (/^\d+(?:\.\d+)?$/.test(s)){
      const num = parseFloat(s);
      if (!Number.isNaN(num)){
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const ms = Math.round(num * 86400000);
        const dt = new Date(excelEpoch.getTime() + ms);
        return Number.isNaN(dt.getTime()) ? null : dt;
      }
    }
    // Try ISO first
    const iso = Date.parse(s);
    if(!Number.isNaN(iso)) return new Date(iso);
    // Try dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if(m){
      const d = parseInt(m[1],10), mo = parseInt(m[2],10)-1, y = parseInt(m[3],10);
      const fullY = y < 100 ? (2000 + y) : y;
      const dt = new Date(fullY, mo, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    // Try month-year formats (mm.yyyy / mm/yyyy / mm-yyyy)
    const my = s.match(/^(\d{1,2})[./-](\d{4})$/);
    if (my){
      const mo = parseInt(my[1],10)-1, y = parseInt(my[2],10);
      const dt = new Date(y, mo, 1);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    // Try textual month formats (e.g., 'December 2025', 'Dec 2025')
    const t = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i);
    if (t){
      const names = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11,
        january:0,february:1,march:2,april:3,may2:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
      const k = t[1].toLowerCase();
      const mo = (k in names) ? names[k] : null;
      const y = parseInt(t[2],10);
      if (mo!=null){
        const dt = new Date(y, mo, 1);
        return Number.isNaN(dt.getTime()) ? null : dt;
      }
    }
    return null;
  }

  function findDateColumn(){
    // Normalize header helper
    const norm = (s) => String(s||'').replace(/["']/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    // Prefer explicit name match
    const explicit = headers.find(h => {
      const n = norm(h);
      return /date of uploading \/ maintenance of ltsd/i.test(n)
        || /date of requesting/i.test(n)
        || /^date\b/.test(n)
        || /\bdate\b/.test(n);
    });
    if (explicit) return explicit;
    // Else, pick the column with the highest ratio of date-like values, requiring >=50%
    let best = null, bestCount = -1;
    for (const h of headers){
      let c=0; for(const r of rows){ if(parseDate(r[h])) c++; }
      if (c > bestCount){ best=h; bestCount=c; }
    }
    const total = rows.length || 1;
    const ratio = bestCount / total;
    // Relax threshold to 20% to accommodate sparse date columns
    return ratio >= 0.2 ? best : null;
  }

  function inferRequestedTotal(){
    const { sum } = sumByHeader(/requested\s+materials\s+from\s+annual\s+run/i);
    return sum;
  }
  function inferRequestedNormalTotal(){
    const { sum } = sumByHeader(/requested\s+materials\s+from\s+normal\s+worklist/i);
    return sum;
  }
  function inferMaintainedAnnualTotal(){
    const { sum } = sumByHeader(/maintained\s+materials\s+from\s+annual\s+run/i);
    return sum;
  }

  // Compute per-row deficit for Annual Run: sum(max(Requested - Maintained, 0))
  function inferAnnualMissingDeficit(){
    const reqCol = headers.find(h => /requested\s+materials\s+from\s+annual\s+run/i.test(String(h)));
    const maintCol = headers.find(h => /maintained\s+materials\s+from\s+annual\s+run/i.test(String(h)));
    if (!reqCol || !maintCol) return null;
    let deficitSum = 0; let any = false;
    for (const r of rows){
      const reqVal = parseNumberEU(r[reqCol]);
      if(Number.isNaN(reqVal)) continue;

      const mValParsed = parseNumberEU(r[maintCol]);
      const maintVal = Number.isNaN(mValParsed) ? 0 : mValParsed;

      const deficit = Math.max(reqVal - maintVal, 0);
      if(deficit > 0){ any = true; }
      deficitSum += deficit;
    }
    return any ? Math.round(deficitSum) : 0;
  }

  function inferMaintainedNormalTotal(){
    const { sum } = sumByHeader(/maintained\s+materials\s+from\s+normal\s+worklist/i);
    return sum;
  }

  function buildKPIReport(){
    // Strict column selection by header names
    const norm = (s) => String(s||'').replace(/["']/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const dateCol = headers.find(h => /^date of uploading \/ maintenance of ltsd$/i.test(norm(h))) || headers.find(h => /date of uploading \/ maintenance of ltsd/i.test(norm(h)));
    const requestedTotal = inferRequestedTotal();
    try { console.log('[raport] KPI: dateCol:', dateCol, 'requestedTotal:', requestedTotal); } catch(e) {}
    if(!dateCol){
      const elWarn = document.getElementById('chartKPI');
      if (elWarn) elWarn.innerHTML = '<div class="muted">Date column not found: "Date of uploading / maintenance of LTSD" (column M).</div>';
      return;
    }
    if(!requestedTotal){
      const elWarn = document.getElementById('chartKPI');
      if (elWarn) elWarn.innerHTML = '<div class="muted">Requested total not found. Ensure column "Requested Materials From Annual Run" exists.</div>';
      return;
    }
    const maintainedNumericCol = headers.find(h => /^maintained\s+materials\s+from\s+annual\s+run$/i.test(norm(h))) || headers.find(h => /maintained\s+materials\s+from\s+annual\s+run/i.test(norm(h)));
    const maintainedFlagCol = findMaintainedFlagColumn();
    try { console.log('[raport] KPI: maintainedNumericCol:', maintainedNumericCol, 'maintainedFlagCol:', maintainedFlagCol); } catch(e) {}
    if(!maintainedNumericCol){
      const elErr = document.getElementById('chartKPI');
      if (elErr) elErr.innerHTML = '<div class="muted">Maintained column ("Maintained Materials From Annual Run") not found.</div>';
      return;
    }

    // Months Nov–Apr with targets
    const months = [
      { key: 'November', m:10, target: 0.10 },
      { key: 'December', m:11, target: 0.25 },
      { key: 'January', m:0, target: 0.50 },
      { key: 'February', m:1, target: 0.60 },
      { key: 'March', m:2, target: 0.70 },
      { key: 'April', m:3, target: 0.80 },
    ];

    // Sum maintained per month by date: numeric if present, else count maintained flags
    const monthSum = new Map(); months.forEach(m=>monthSum.set(m.key, 0));
    let yearGuess = null;
    let debugSample = 0;
    for(const r of rows){
      const dt = parseDate(r[dateCol]);
      if(!dt) continue;
      yearGuess = yearGuess ?? dt.getFullYear();
      const monthIndex = dt.getMonth();
      const mObj = months.find(x=>x.m === monthIndex);
      if(!mObj) continue;
      const val = parseNumberEU(r[maintainedNumericCol]);
      if (!Number.isNaN(val)){
        const incVal = Math.round(val);
        monthSum.set(mObj.key, (monthSum.get(mObj.key)||0) + incVal);
      }
      if (debugSample < 5){
        try { console.log('[raport] KPI row:', { date:r[dateCol], month:monthIndex, maintainedVal: r[maintainedNumericCol], parsed: Math.round(parseNumberEU(r[maintainedNumericCol])) }); } catch(e) {}
        debugSample++;
      }
    }
    try { console.log('[raport] KPI month sums:', Object.fromEntries(monthSum.entries())); } catch(e) {}

    const labels = months.map(m=>m.key);
    const maintained = months.map(m=>monthSum.get(m.key)||0);
    // Cumulative progress: sum up to current month / total requested
    const cum = maintained.reduce((acc,v,i)=>{ acc[i] = (i===0? v : acc[i-1] + v); return acc; }, new Array(maintained.length).fill(0));
    const pctCum = cum.map(v=> requestedTotal>0 ? (v/requestedTotal) : 0);
    const pctMonth = maintained.map(v=> requestedTotal>0 ? (v/requestedTotal) : 0);
    const targets = months.map(m=>m.target);

    // Status rules:
    // - Achieved: KPI reached
    // - Not Achieved: month has passed and KPI not reached
    // - Pending: current month and future months (not decided yet)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const baseYear = yearGuess || now.getFullYear();
    const monthStartForCycle = (monthIndex)=>{
      // Cycle: Nov/Dec belong to previous year, Jan-Apr belong to baseYear
      const y = (monthIndex >= 10) ? (baseYear - 1) : baseYear;
      return new Date(y, monthIndex, 1);
    };
    const status = pctCum.map((p,i)=>{
      if (p >= targets[i]) return 'Achieved';
      const mStart = monthStartForCycle(months[i].m);
      // If the month start is before the current month start, it's a past month
      if (mStart < currentMonthStart) return 'Not Achieved';
      return 'Pending';
    });

    // Render KPI table via Plotly (table) or fallback HTML
    const el = document.getElementById('chartKPI');
    if (!el){ console.warn('KPI container not found: #chartKPI'); return; }
    if (window.Plotly){
      try { window.Plotly.purge(el); } catch(e){}
      const fmtPct = arr => arr.map(x=> (Math.round(x*10000)/100).toFixed(2) + ' %');
      const header = ['Month', 'Maintained (month)', 'Progress (month)', 'Progress (cumulative)', 'Target', 'Status'];
      const statusColors = status.map(s => {
        if (s === 'Achieved') return '#e8f5f1';
        if (s === 'Pending') return '#eef2f7';
        return '#fdeaf1'; // Not Achieved
      });
      const statusFontColors = status.map(s => {
        if (s === 'Achieved') return '#2a7f62';
        if (s === 'Pending') return '#0b4a84';
        return '#b33f62'; // Not Achieved
      });
      const table = {
        type: 'table',
        header: { values: header, align:'center', fill:{color:'#e6ebf2'}, font:{bold:true} },
        cells: {
          values: [
            labels,
            maintained,
            fmtPct(pctMonth),
            fmtPct(pctCum),
            fmtPct(targets),
            status,
          ],
          align: 'center',
          fill: { color: [ '#fff', '#fff', '#fff', '#fff', '#fff', statusColors ] },
          font: { color: [ '#2b3a4a', '#2b3a4a', '#2b3a4a', '#2b3a4a', '#2b3a4a', statusFontColors ] }
        }
      };
      const title = `KPI Overview (Monthly vs Total Requested) ${yearGuess||''}`.trim();
      window.Plotly.newPlot(el, [table], { title, margin:{l:10,r:10,t:30,b:10} }, {responsive:true, displaylogo:false});
      try {
        // Remove any previously inserted KPI progress bars to avoid duplicates on sheet switch
        if (el.parentNode){
          const siblings = el.parentNode.querySelectorAll('.kpi-progress');
          siblings.forEach(node => node.remove());
          const blocks = el.parentNode.querySelectorAll('.kpi-progress-block');
          blocks.forEach(node => node.remove());
        }
        const achievedPct = (pctCum[pctCum.length-1] || 0);
        const remainingPct = Math.max(0, 1 - achievedPct);
        const block = document.createElement('div');
        block.className = 'kpi-progress-block';
        const titleEl = document.createElement('div');
        titleEl.className = 'kpi-progress-title';
        titleEl.textContent = 'KPI Progress';
        const bar = document.createElement('div');
        bar.className = 'kpi-progress';
        const fill = document.createElement('div');
        fill.className = 'kpi-progress__fill';
        fill.style.width = Math.max(0, Math.min(100, Math.round(achievedPct*100))) + '%';
        const lblAch = document.createElement('div');
        lblAch.className = 'kpi-progress__label kpi-progress__label--achieved';
        lblAch.textContent = (Math.round(achievedPct*10000)/100).toFixed(2) + ' %';
        const lblRem = document.createElement('div');
        lblRem.className = 'kpi-progress__label kpi-progress__label--remaining';
        lblRem.textContent = (Math.round(remainingPct*10000)/100).toFixed(2) + ' %';
        bar.appendChild(fill);
        bar.appendChild(lblAch);
        bar.appendChild(lblRem);
        block.appendChild(titleEl);
        block.appendChild(bar);
        // Insert after KPI chart to avoid overlay on Plotly title
        if (el.parentNode){ el.parentNode.insertBefore(block, el.nextSibling); }
      } catch(e) { }
    } else {
      const rowsHtml = labels.map((lab,i)=>{
        const prog = (Math.round(pctMonth[i]*10000)/100).toFixed(2) + ' %';
        const targ = (Math.round(targets[i]*10000)/100).toFixed(2) + ' %';
        const st = status[i];
        const cls = st === 'Achieved' ? 'status-Achieved' : (st === 'Pending' ? 'status-Pending' : 'status-NotAchieved');
        return `<tr><td>${lab}</td><td>${maintained[i]}</td><td>${prog}</td><td>${targ}</td><td class="${cls}">${st}</td></tr>`;
      }).join('');
      const debug = `<div class="muted">Detected date column: ${escapeHtml(dateCol||'')}. Maintained col: ${escapeHtml(String(maintainedNumericCol||''))}. Month sums: ${escapeHtml(JSON.stringify(Object.fromEntries(monthSum.entries())))}</div>`;
      const achievedPct = (pctCum[pctCum.length-1] || 0);
      const remainingPct = Math.max(0, 1 - achievedPct);
      const barHtml = `<div class="kpi-progress-block"><div class="kpi-progress-title">KPI Progress</div><div class="kpi-progress"><div class="kpi-progress__fill" style="width:${Math.max(0, Math.min(100, Math.round(achievedPct*100)))}%"></div><div class="kpi-progress__label kpi-progress__label--achieved">${(Math.round(achievedPct*10000)/100).toFixed(2)} %</div><div class="kpi-progress__label kpi-progress__label--remaining">${(Math.round(remainingPct*10000)/100).toFixed(2)} %</div></div></div>`;
      el.innerHTML = `<table class="kpi"><thead><tr><th>Month</th><th>Maintained</th><th>Progress</th><th>Target</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>${debug}`;
      try {
        // Remove existing KPI progress bars next to the container
        if (el.parentNode){
          const siblings = el.parentNode.querySelectorAll('.kpi-progress');
          siblings.forEach(node => node.remove());
          const blocks = el.parentNode.querySelectorAll('.kpi-progress-block');
          blocks.forEach(node => node.remove());
        }
        el.insertAdjacentHTML('afterend', barHtml);
      } catch(e) {}
    }
  }

  // ============================================================
  // KPI TIMELINE DIAGRAM - Visual representation of KPI progress
  // OPTIMIZED VERSION - No overlapping, responsive, clean design
  // ============================================================
  function buildKpiTimeline(){
    console.log('[buildKpiTimeline] Starting...');
    
    // Month configuration - years will be calculated dynamically based on data
    // November is always previous year, Dec-Apr is current cycle year
    const months = [
      { key: 'November', m: 10, target: 0.10, isNovember: true },
      { key: 'December', m: 11, target: 0.25, isNovember: false },
      { key: 'January', m: 0, target: 0.50, isNovember: false },
      { key: 'February', m: 1, target: 0.60, isNovember: false },
      { key: 'March', m: 2, target: 0.70, isNovember: false },
      { key: 'April', m: 3, target: 0.80, isNovember: false }
    ];

    // Find columns - same logic as buildKPIReport
    const norm = (s) => String(s||'').replace(/["']/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const dateCol = headers.find(h => /^date of uploading \/ maintenance of ltsd$/i.test(norm(h))) || 
                    headers.find(h => /date of uploading \/ maintenance of ltsd/i.test(norm(h)));
    const maintainedNumericCol = headers.find(h => /^maintained\s+materials\s+from\s+annual\s+run$/i.test(norm(h))) || 
                                  headers.find(h => /maintained\s+materials\s+from\s+annual\s+run/i.test(norm(h)));
    const requestedTotal = inferRequestedTotal();

    console.log('[buildKpiTimeline] Columns:', { dateCol, maintainedNumericCol, requestedTotal });

    // Get or create container
    const containerId = 'chartKPITimeline';
    let container = document.getElementById(containerId);
    
    // Clean up existing container content
    if (container) {
      container.innerHTML = '';
    } else {
      const kpiChart = document.getElementById('chartKPI');
      if (!kpiChart || !kpiChart.parentNode) {
        console.warn('[buildKpiTimeline] #chartKPI not found');
        return;
      }
      const progressBlock = kpiChart.parentNode.querySelector('.kpi-progress-block');
      
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'kpi-timeline-container';
      
      if (progressBlock && progressBlock.nextSibling) {
        kpiChart.parentNode.insertBefore(container, progressBlock.nextSibling);
      } else if (progressBlock) {
        kpiChart.parentNode.appendChild(container);
      } else {
        kpiChart.parentNode.insertBefore(container, kpiChart.nextSibling);
      }
    }

    if (!dateCol || !maintainedNumericCol || !requestedTotal) {
      container.innerHTML = '<div class="muted">Timeline: Missing required columns.</div>';
      return;
    }

    // Aggregate data per month - IDENTICAL logic to buildKPIReport
    const monthSum = new Map();
    months.forEach(m => monthSum.set(m.key, 0));
    let yearGuess = null;

    for (const r of rows) {
      const dt = parseDate(r[dateCol]);
      if (!dt) continue;
      yearGuess = yearGuess ?? dt.getFullYear();
      const monthIndex = dt.getMonth();
      const mObj = months.find(x => x.m === monthIndex);
      if (!mObj) continue;
      const val = parseNumberEU(r[maintainedNumericCol]);
      if (!Number.isNaN(val)) {
        monthSum.set(mObj.key, (monthSum.get(mObj.key) || 0) + Math.round(val));
      }
    }

    // Calculate values
    const maintained = months.map(m => monthSum.get(m.key) || 0);
    const cumulative = [];
    let sum = 0;
    maintained.forEach(v => { sum += v; cumulative.push(sum); });
    const cumulativePercent = cumulative.map(v => requestedTotal > 0 ? (v / requestedTotal) * 100 : 0);

    console.log('[buildKpiTimeline] Data:', { maintained, cumulative, cumulativePercent });

    // ========== OPTIMIZED SVG DIMENSIONS ==========
    const width = 1400;      // Wider for better spacing
    const height = 580;      // Optimized height
    const marginLeft = 100;  // More left margin for "Start" text
    // Right margin: keep last month away from arrow head
    const marginRight = 190;
    const timelineY = 320;   // Timeline vertical position
    
    // Card dimensions - smaller for less overlap
    const cardWidth = 150;
    const cardHeight = 145;
    const cardGapFromLine = 25; // Gap between card and timeline
    
    // Calculate spacing
    const usableWidth = width - marginLeft - marginRight;
    const pointSpacing = usableWidth / (months.length - 1);

    // Build SVG
    let svg = `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"
           style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%;">
        <defs>
          <linearGradient id="tlBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="50%" stop-color="#e8eef5"/>
            <stop offset="100%" stop-color="#dce5f0"/>
          </linearGradient>
          <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#0b4a84" flood-opacity="0.1"/>
          </filter>
          <marker id="tlArrow" markerWidth="16" markerHeight="12" refX="14" refY="6" orient="auto">
            <polygon points="0,0 16,6 0,12" fill="#0b4a84"/>
          </marker>
        </defs>
        
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#tlBgGrad)" rx="12"/>
        
        <!-- Decorative waves -->
        <path d="M0,200 Q350,180 700,200 T1400,200" stroke="rgba(11,74,132,0.04)" stroke-width="60" fill="none"/>
        <path d="M0,350 Q350,330 700,350 T1400,350" stroke="rgba(11,74,132,0.03)" stroke-width="40" fill="none"/>
        
        <!-- Title -->
        <text x="${width/2}" y="40" font-size="28" font-weight="bold" fill="#0b4a84" text-anchor="middle" letter-spacing="2">
          SUPPLIER KPI OVERVIEW
        </text>
        <text x="${width/2}" y="68" font-size="16" fill="#0b4a84" text-anchor="middle">
          Monthly vs Total Maintained ${yearGuess || 2025}
        </text>
        
        <!-- Timeline axis -->
          <!-- Extend arrow further right so the last month label (April) remains visible -->
          <line x1="${marginLeft - 20}" y1="${timelineY}" x2="${width - 20}" y2="${timelineY}" 
              stroke="#0b4a84" stroke-width="5" stroke-linecap="round" marker-end="url(#tlArrow)"/>
    `;

    // Draw milestone points and cards
    months.forEach((month, i) => {
      const x = marginLeft + (i * pointSpacing);
      const percent = cumulativePercent[i].toFixed(2);
      const parts = cumulative[i].toLocaleString();
      const targetPct = Math.round(month.target * 100);
      
      // Alternate: even=top, odd=bottom
      const isTop = i % 2 === 0;
      
      // Card position
      const cardX = x - cardWidth / 2;
      const cardY = isTop ? (timelineY - cardGapFromLine - cardHeight) : (timelineY + cardGapFromLine);
      
      // Connector line position
      const lineY1 = isTop ? (cardY + cardHeight) : cardY;
      const lineY2 = timelineY;
      
      // Vertical connector
      svg += `<line x1="${x}" y1="${lineY1}" x2="${x}" y2="${lineY2}" stroke="#0b4a84" stroke-width="2" opacity="0.3"/>`;
      
      // Timeline point
      svg += `<circle cx="${x}" cy="${timelineY}" r="8" fill="#0b4a84" stroke="#fff" stroke-width="3"/>`;
      
      // Calculate year for this month: November = yearGuess-1, others = yearGuess
      const displayYear = month.isNovember ? (yearGuess - 1) : yearGuess;
      
      // Month label - positioned opposite to card
      const labelY = isTop ? (timelineY + 24) : (timelineY - 14);
      svg += `<text x="${x}" y="${labelY}" font-size="13" font-weight="bold" fill="#0b4a84" text-anchor="middle">
                ${month.key.substring(0,3)}. ${displayYear}
              </text>`;
      
      // Card
      svg += `
        <g filter="url(#cardShadow)">
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" 
                fill="#fff" rx="8" stroke="#e1e7ee" stroke-width="1"/>
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="3" fill="#0b4a84" rx="8"/>
          
          <text x="${x}" y="${cardY + 28}" font-size="12" font-weight="600" fill="#475569" text-anchor="middle">
            Maintained LTVD
          </text>
          <text x="${x}" y="${cardY + 62}" font-size="28" font-weight="bold" fill="#0b4a84" text-anchor="middle">
            ${percent}%
          </text>
          <text x="${x}" y="${cardY + 85}" font-size="12" fill="#64748b" text-anchor="middle">
            ${parts} Parts
          </text>
          <line x1="${cardX + 15}" y1="${cardY + 100}" x2="${cardX + cardWidth - 15}" y2="${cardY + 100}" 
                stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,2"/>
          <text x="${x}" y="${cardY + 125}" font-size="13" font-weight="600" fill="#0b4a84" text-anchor="middle">
            KPI ${targetPct}%
          </text>
        </g>
      `;
    });

    // "Start Annual Run" marker - positioned at bottom left, clear of cards
    const startLineY = timelineY + 70;
    const startLineEndX = marginLeft + pointSpacing * 0.4;
    svg += `
      <g>
        <line x1="${marginLeft - 30}" y1="${startLineY}" x2="${startLineEndX}" y2="${startLineY}" 
              stroke="#2a7f62" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${startLineEndX}" cy="${startLineY}" r="5" fill="#2a7f62"/>
        <text x="${marginLeft - 30}" y="${startLineY + 20}" font-size="11" font-weight="600" fill="#2a7f62" font-style="italic">
          Start Annual Run
        </text>
        <text x="${marginLeft - 30}" y="${startLineY + 34}" font-size="11" font-weight="600" fill="#2a7f62" font-style="italic">
          Solicitation Process
        </text>
        <text x="${startLineEndX + 8}" y="${startLineY + 4}" font-size="10" fill="#2a7f62" font-style="italic">
          End
        </text>
      </g>
    `;

    svg += `</svg>`;

    // Render
    container.innerHTML = `
      <div class="kpi-timeline-wrapper">
        <h3 class="timeline-section-title">Timeline Progress</h3>
        ${svg}
      </div>
    `;
    
    addDownloadButton(containerId, 'KPI_Timeline');
    console.log('[buildKpiTimeline] Complete');
  }

  function findFormatColumn(){
    // Column N: "Format of LTSD in maintenance process in S4Hana (BTP/ supplier's format/ manual )+ supplier's refusal)"
    const name = (h)=>String(h||'').toLowerCase();
    
    // Try exact/partial matches with various patterns
    const patterns = [
      /format\s+of\s+ltsd/i,
      /format.*ltsd/i,
      /ltsd.*format/i,
      /format.*maintenance/i,
      /format.*s4hana/i,
      /btp.*supplier/i,
      /supplier'?s?\s+(format|refusal)/i,
      /interactive\s+format/i,
      /scanned/i
    ];
    
    for (const pattern of patterns){
      const found = headers.find(h => pattern.test(name(h)));
      if (found){
        console.log('[raport] Format column found:', found, 'using pattern:', pattern);
        return found;
      }
    }
    
    // Broaden: any header mentioning 'format' (but not 'date format' etc)
    let explicit = headers.find(h => /\bformat\b/i.test(name(h)) && !/date/i.test(name(h)));
    if (explicit){
      console.log('[raport] Format column found (broad):', explicit);
      return explicit;
    }
    
    // Log available headers for debugging
    console.log('[raport] Format column NOT found. Available headers:', headers);
    
    // Fallback: choose a categorical-like column (low unique values) excluding known columns
    const excludePatterns = [/cluster/i, /date/i, /material/i, /requested/i, /maintained/i, /ltsd\s+proposal/i];
    let best = null; let bestUnique = Infinity;
    for (const h of headers){
      // Skip known non-format columns
      if (excludePatterns.some(p => p.test(h))) continue;
      
      const vals = new Set();
      for (let i=0;i<Math.min(rows.length, 2000);i++){
        const v = rows[i]?.[h];
        if (v !== undefined && v !== null && String(v).trim()) vals.add(String(v).trim());
        if (vals.size > 25) break;
      }
      // Look for columns with 2-10 unique values (typical for format categories)
      if (vals.size >= 2 && vals.size <= 10 && vals.size < bestUnique){
        best = h;
        bestUnique = vals.size;
      }
    }
    if (best) console.log('[raport] Format column fallback:', best, 'unique values:', bestUnique);
    return best;
  }

  // Robust numeric parser for mixed separators like "1.234,56" (EU format)
  function parseNumberEU(raw){
    if (raw == null) return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;
    s = s.replace(/\s+/g,'');
    const hasComma = /,/.test(s);
    const hasDot = /\./.test(s);
    if (hasComma && hasDot){
      // Assume dot is thousands, comma is decimal
      s = s.replace(/\./g,'');
      s = s.replace(/,/g,'.');
    } else if (hasComma && !hasDot){
      s = s.replace(/,/g,'.');
    }
    s = s.replace(/[^0-9.\-]/g,'');
    const v = parseFloat(s);
    return Number.isNaN(v) ? NaN : v;
  }

  function findMaintainedFlagColumn(){
    // Column H: "LTSD maintained"
    const explicit = headers.find(h => /ltsd\s+maintained/i.test(String(h)));
    return explicit || null;
  }

  function isMaintained(val){
    const s = String(val||'').trim().toLowerCase();
    if (!s) return false;
    // Consider truthy markers
    if (s === 'yes' || s === 'true' || s === '1' || s === 'y' || s === 'x' || s === 'maintained' || s === 'done') return true;
    // Also accept uppercase X and numeric > 0
    if (/^x$/i.test(s)) return true;
    const n = Number(s.replace(/[^0-9.-]/g,''));
    return !Number.isNaN(n) && n > 0;
  }

  function buildPieFormatReport(){
    const formatCol = findFormatColumn();
    const maintainedCol = findMaintainedFlagColumn();
    let el = document.getElementById('chartPieFormat');
    if (!el){ console.warn('Pie Format container not found: #chartPieFormat'); return; }
    
    console.log('[raport] PieFormat: formatCol=', formatCol, 'maintainedCol=', maintainedCol);
    
    if (!formatCol){
      el.innerHTML = '<div class="muted">Format column not found. Check column headers for "Format of LTSD" or similar.</div>';
      console.warn('[raport] PieFormat: Format column not found. Headers:', headers);
      return;
    }
    
    // If maintainedCol exists, filter to maintained rows; otherwise use all rows with format data
    let dataRows;
    if (maintainedCol){
      dataRows = rows.filter(r => isMaintained(r[maintainedCol]));
      console.log('[raport] PieFormat: Filtering by maintained flag. Rows:', dataRows.length);
    } else {
      // Fallback: use all rows that have a non-empty format value
      dataRows = rows.filter(r => String(r[formatCol] ?? '').trim());
      console.log('[raport] PieFormat: No maintained flag column, using all rows with format data. Rows:', dataRows.length);
    }
    
    // Group by format (column N), count occurrences
    const map = new Map();
    for (const r of dataRows){
      const key = String(r[formatCol] ?? '').trim();
      // Skip empty/blank format values to avoid an empty slice/bar
      if (!key) continue;
      map.set(key, (map.get(key)||0)+1);
    }
    const labels = Array.from(map.keys());
    const data = Array.from(map.values());
    const total = data.reduce((a,b)=>a+b,0);
    
    console.log('[raport] PieFormat: labels=', labels, 'data=', data, 'total=', total);
    
    if (!total){ 
      el.innerHTML = '<div class="muted">No format data found to build chart.</div>'; 
      return; 
    }
    const pct = data.map(v => Math.round(v*10000/total)/100);

    el = document.getElementById('chartPieFormat');
    const trace = {
      type:'pie',
      labels,
      values: data,
      text: pct.map(p=>p.toFixed(2)+' %'),
      textinfo:'label+percent',
      hoverinfo:'label+value+percent',
      textposition:'inside',
      insidetextorientation:'radial',
      automargin:true,
      marker:{ colors:[PALETTE.primary, PALETTE.accent, PALETTE.success, PALETTE.danger], line:{ color:'#fff', width:2 } }
    };
    const layout = {
      title: { text:'Format of LTSD', x:0.5 },
      legend:{ orientation:'h', x:0.5, xanchor:'center', y:-0.1 },
      uniformtext:{ mode:'hide', minsize:12 }
    };
    plotlyPie(el, trace, layout);
    
    // Add download button
    addDownloadButton('chartPieFormat', 'Format of LTSD');
  }

  function buildPieTotalReport(){
    const reqAnnual = inferRequestedTotal(); // column G
    const reqNormal = inferRequestedNormalTotal(); // column J
    const maintAnnual = inferMaintainedAnnualTotal(); // column I
    const maintNormal = inferMaintainedNormalTotal(); // column ? per header
    const totalRequested = (reqAnnual||0) + (reqNormal||0);
    const totalMaintained = (maintAnnual||0) + (maintNormal||0);
    if (!totalRequested){
      const elWarn = document.getElementById('chartPieTotal');
      if (elWarn) elWarn.innerHTML = '<div class="muted">Requested totals not found. Ensure columns for Annual Run (G) and Normal Worklist (J) exist.</div>';
      return;
    }
    const maintainedPct = Math.max(0, Math.min(1, totalMaintained / totalRequested));
    const data = [ totalMaintained, Math.max(0, totalRequested - totalMaintained) ];
    const labels = [ 'Maintained', 'Remaining' ];
    const el = document.getElementById('chartPieTotal');
    if (!el){ console.warn('Pie Total container not found: #chartPieTotal'); return; }
    const trace = {
      type:'pie',
      labels,
      values: data,
      text: data.map(v=> totalRequested ? (Math.round(v*10000/totalRequested)/100).toFixed(2)+' %' : ''),
      textinfo:'label+percent',
      hoverinfo:'label+value+percent',
      textposition:'inside',
      insidetextorientation:'radial',
      automargin:true,
      marker:{ colors:[PALETTE.accent, PALETTE.primary], line:{ color:'#fff', width:2 } }
    };
    const layout = {
      title: { text:`Maintained vs Requested (Total AR+WL)`, x:0.5 },
      legend:{ orientation:'h', x:0.5, xanchor:'center', y:-0.1 },
      uniformtext:{ mode:'hide', minsize:12 }
    };
    plotlyPie(el, trace, layout);
    
    // Add download button
    addDownloadButton('chartPieTotal', 'Maintained vs Requested');
  }

  fileInput.addEventListener('change', async (e)=>{
    if(!e.target.files?.length) return;
    setStatus('Loading file…');
    try{
      const ab = await readFileAsArrayBuffer(e.target.files[0]);
      loadWorkbook(ab);
      setStatus('Ready');
    }catch(err){ console.error(err); setStatus('Failed to load file'); }
  });


  sheetSelect.addEventListener('change', hydrateSheet);
  refreshPreview.addEventListener('click', drawPreview);
  tableToggle?.addEventListener('click', ()=>{
    const expanded = tableWrap.style.display !== 'none';
    if (expanded){
      tableWrap.style.display = 'none';
      tableToggle.textContent = 'Show Table';
      tableToggle.setAttribute('aria-expanded','false');
    } else {
      tableWrap.style.display = '';
      tableToggle.textContent = 'Hide Table';
      tableToggle.setAttribute('aria-expanded','true');
      // Render preview when expanding to ensure fresh content
      try { drawPreview(); } catch(e) {}
    }
  });
  // Initial render guarded by hydrateSheet; avoid premature chart rendering
  // export buttons removed
  try { window.addEventListener('beforeunload', resetWorker); } catch(e){}
})();
