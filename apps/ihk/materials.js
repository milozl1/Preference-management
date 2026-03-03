(function(){
  const template = document.getElementById('material-row-template');
  const tbody = document.getElementById('materialsBody');
  const addBtn = document.getElementById('matAddBtn');
  const clearBtn = document.getElementById('matClearEmptyBtn');
  const exportBtn = document.getElementById('matExportBtn');
  const filterInput = document.getElementById('matFilter');
  const metricsEl = document.getElementById('matMetrics');

  function cloneRow(){
    return template.content.firstElementChild.cloneNode(true);
  }

  function addRow(data){
    const row = cloneRow();
    if(Array.isArray(data)){
      const cells = Array.from(row.cells).slice(0,5);
      data.slice(0,5).forEach((val,i)=>{ if(val) cells[i].textContent = val; });
    }
    tbody.appendChild(row);
    updateMetrics();
    persistMaterials();
  }

  function updateMetrics(){
    const rows = Array.from(tbody.rows);
    const filled = rows.filter(r => Array.from(r.cells).slice(0,5).some(c => c.textContent.trim())).length;
    metricsEl.textContent = `${rows.length} row${rows.length===1?'':'s'} (${filled} filled)`;
  }

  function clearEmpty(){
    Array.from(tbody.rows).forEach(r => {
      const empty = Array.from(r.cells).slice(0,5).every(c => !c.textContent.trim());
      if(empty && tbody.rows.length > 1){ r.remove(); }
    });
    updateMetrics();
    persistMaterials();
  }

  function maybeAutoAdd(e){
    const lastRow = tbody.rows[tbody.rows.length -1];
    if(!lastRow) return;
    const originCell = lastRow.cells[4];
    if(e.target === originCell && originCell.textContent.trim()){
      addRow();
    }
    updateMetrics();
  }

  function handleRemove(e){
    if(e.target.classList.contains('mat-remove')){
      const row = e.target.closest('tr');
      if(row && tbody.rows.length > 1){ row.remove(); updateMetrics(); }
      persistMaterials();
      return;
    }
    if(e.target.classList.contains('mat-up')){
      const row = e.target.closest('tr');
      if(row && row.previousElementSibling){ tbody.insertBefore(row, row.previousElementSibling); updateMetrics(); persistMaterials(); }
      return;
    }
    if(e.target.classList.contains('mat-down')){
      const row = e.target.closest('tr');
      if(row && row.nextElementSibling){ tbody.insertBefore(row.nextElementSibling, row); updateMetrics(); persistMaterials(); }
      return;
    }
  }

  function applyFilter(){
    const term = filterInput.value.trim().toLowerCase();
    Array.from(tbody.rows).forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = term && !text.includes(term) ? 'none' : '';
    });
  }

  let sortState = { index:null, asc:true };
  function sortByColumn(idx){
    const rows = Array.from(tbody.rows);
    const dataRows = rows.map(r => ({ r, cells: Array.from(r.cells).slice(0,5).map(c => c.textContent.trim()) }));
    if(sortState.index === idx){ sortState.asc = !sortState.asc; } else { sortState.index = idx; sortState.asc = true; }
    dataRows.sort((a,b) => {
      const va = a.cells[idx] || '';
      const vb = b.cells[idx] || '';
      if(!isNaN(va) && !isNaN(vb)){ return (Number(va) - Number(vb)) * (sortState.asc?1:-1); }
      return va.localeCompare(vb) * (sortState.asc?1:-1);
    });
    dataRows.forEach(d => tbody.appendChild(d.r));
    updateMetrics();
    persistMaterials();
  }

  function attachSorting(){
    const thead = document.querySelector('#data-table thead');
    if(!thead) return;
    Array.from(thead.querySelectorAll('th')).forEach((th,i) => {
      if(i === 5) return; // skip Actions
      th.style.cursor = 'pointer';
      th.title = 'Click to sort';
      th.addEventListener('click', () => sortByColumn(i));
    });
  }

  function exportCSV(){
    const rows = [['Material Number','Customer Material Number','Description','Commodity Code','Country of Origin']];
    Array.from(tbody.rows).forEach(r => {
      const cells = Array.from(r.cells).slice(0,5).map(c => c.textContent.trim());
      if(cells.some(v => v)) rows.push(cells);
    });
    if(rows.length === 1) return; // no data
    const csv = rows.map(arr => arr.map(v => '"' + v.replace(/"/g,'""') + '"').join(',')).join('\r\n');
    triggerDownload(csv,'materials.csv','text/csv');
  }

  function triggerDownload(content, filename, mime){
    const blob = new Blob([content], { type:mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function downloadTemplate(){
    if(window.XLSX){
      const header = ['Material Number','Customer Material Number','Description','Commodity Code','Country of Origin'];
      const sample = [
        header,
        ['123456','CUST-001','LED Module','85399090','DE'],
        ['789012','CUST-002','Wiring Harness','85444290','RO']
      ];
      const ws = XLSX.utils.aoa_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Materials');
      const out = XLSX.write(wb,{bookType:'xlsx', type:'array'});
      const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'materials_template.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
    } else {
      // Fallback CSV
      const csvHeader = '"Material Number","Customer Material Number","Description","Commodity Code","Country of Origin"\r\n';
      triggerDownload(csvHeader,'materials_template.csv','text/csv');
    }
  }

  function importFile(file){
    if(!file) return;
    const ext = file.name.toLowerCase().split('.').pop();
    const reader = new FileReader();
    reader.onload = function(e){
      try {
        let rows = [];
        if(ext === 'csv'){
          const text = e.target.result; 
          rows = text.split(/\r?\n/).map(line => line.split(',').map(v => v.replace(/^"|"$/g,'').trim()));
        } else {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type:'array' });
          const first = wb.SheetNames[0];
          const sheet = wb.Sheets[first];
          rows = XLSX.utils.sheet_to_json(sheet,{header:1, blankrows:false});
        }
        if(!rows.length) return;
        // Clear existing rows
        while(tbody.rows.length) tbody.deleteRow(0);
        const header = rows[0].map(String);
        const expected = ['Material Number','Customer Material Number','Description','Commodity Code','Country of Origin'];
        const headerOk = expected.every((h,i)=> (header[i]||'').toLowerCase() === h.toLowerCase());
        const startIdx = headerOk ? 1 : 0; // allow import without header
        const errors = [];
        for(let i=startIdx;i<rows.length;i++){
          const rowData = rows[i];
          if(!rowData || rowData.every(v => !v)) continue;
          const hs = (rowData[3]||'').trim();
          if(hs && !/^\d{6,10}$/.test(hs)) errors.push(`Row ${i+1}: invalid HS code '${hs}'`);
          addRow(rowData);
        }
        if(tbody.rows.length === 0) addRow();
        updateMetrics();
        if(errors.length){ alert('Import completed with warnings:\n' + errors.join('\n')); }
        persistMaterials();
      } catch(err){
        alert('Import failed: ' + err.message);
      }
    };
    if(ext === 'csv') reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }

  function persistMaterials(){
    try {
      const data = Array.from(tbody.rows).map(r => Array.from(r.cells).slice(0,5).map(c => c.textContent.trim()));
      const raw = localStorage.getItem('IHK_STATE_V1');
      if(raw){
        const state = JSON.parse(raw);
        state.materials = data;
        localStorage.setItem('IHK_STATE_V1', JSON.stringify(state));
      }
    } catch(e){ }
  }

  function init(){
    addRow(); // initial row
    addBtn.addEventListener('click', ()=>addRow());
    clearBtn.addEventListener('click', clearEmpty);
    exportBtn.addEventListener('click', exportCSV);
    document.getElementById('matTemplateBtn')?.addEventListener('click', downloadTemplate);
    const importInput = document.getElementById('matImportInput');
    document.getElementById('matImportBtn')?.addEventListener('click', ()=> importInput && importInput.click());
    importInput?.addEventListener('change', ()=> importFile(importInput.files[0]));
    tbody.addEventListener('input', maybeAutoAdd);
    tbody.addEventListener('click', handleRemove);
    filterInput.addEventListener('input', applyFilter);
    document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Insert'){ addRow(); } });
    attachSorting();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.IHK_MATERIALS_API = {
    addRow, clearEmpty, exportCSV, updateMetrics, downloadTemplate, importFile,
    getData: () => Array.from(tbody.rows).map(r => Array.from(r.cells).slice(0,5).map(c => c.textContent.trim()))
  };
})();
