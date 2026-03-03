(function(){
  const form = document.getElementById('ihk-form');
  const errorBox = document.getElementById('form-errors');
  const declarationRadios = Array.from(document.querySelectorAll('input[name="declarationType"]'));
  const shipmentGroup = document.getElementById('shipment-group');
  const dateRangeGroup = document.getElementById('date-range-group');
  const generateBtn = document.getElementById('generateCertificateBtn');
  const luInput = document.getElementById('lu2');
  const placeInput = document.getElementById('place1');
  const langSelect = document.getElementById('langSelect');
  const signatureInput = document.getElementById('signatureImage');
  const logoPreview = document.getElementById('logoPreview');
  const stampPreview = document.getElementById('stampPreview');
  const signaturePreview = document.getElementById('signaturePreview');

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

  function autoFillPlace(){
    const luVal = luInput.value.trim();
    if(placeAutoMap[luVal]) {
      placeInput.value = placeAutoMap[luVal];
    }
    updateStampPreview();
  }
  luInput.addEventListener('change', autoFillPlace);
  luInput.addEventListener('blur', autoFillPlace);
  luInput.addEventListener('input', autoFillPlace);

  function updateStampPreview(){
    if(typeof resolveStampFilename === 'function'){
      const path = resolveStampFilename(luInput.value.trim());
      if(path){
        fetch(path).then(r => r.ok ? r.blob() : null).then(blob => {
          if(!blob) { stampPreview.src=''; return; }
          const reader = new FileReader();
          reader.onload = () => { stampPreview.src = reader.result; };
          reader.readAsDataURL(blob);
        }).catch(()=> stampPreview.src='');
      } else {
        stampPreview.src='';
      }
    }
  }

  function loadLogoPreview(){
    fetch('./STAMPS/LOGO.png').then(r => r.ok ? r.blob() : null).then(blob => {
      if(!blob) return;
      const reader = new FileReader();
      reader.onload = () => { logoPreview.src = reader.result; };
      reader.readAsDataURL(blob);
    }).catch(()=>{});
  }
  loadLogoPreview();

  signatureInput.addEventListener('change', () => {
    const file = signatureInput.files[0];
    if(!file) { signaturePreview.src=''; saveState(); return; }
    const reader = new FileReader();
    reader.onload = () => { signaturePreview.src = reader.result; saveState(); };
    reader.readAsDataURL(file);
  });

  function getSignatureData(){ return signaturePreview.src || null; }

  function currentMaterials(){
    return window.IHK_MATERIALS_API ? window.IHK_MATERIALS_API.getData() : [];
  }

  function collectFormState(){
    return {
      timestamp: Date.now(),
      form: {
        legalUnit: luInput.value.trim(),
        person: document.getElementById('person1').value.trim(),
        place: placeInput.value.trim(),
        customer: document.getElementById('denumire').value.trim(),
        docNumber: document.getElementById('numar_doc').value.trim(),
        declarationType: declarationRadios.find(r=>r.checked)?.value || 'single',
        shipmentRef: document.getElementById('eu_ursprung').value.trim(),
        validFrom: document.getElementById('langzeit_von').value,
        validTo: document.getElementById('langzeit_bis').value,
        language: langSelect.value,
        signatureImage: getSignatureData()
      },
      materials: currentMaterials()
    };
  }

  function saveState(){
    try {
      const state = collectFormState();
      localStorage.setItem('IHK_STATE_V1', JSON.stringify(state));
    } catch(e){ /* ignore */ }
  }

  function restoreState(){
    try {
      const raw = localStorage.getItem('IHK_STATE_V1');
      if(!raw) return;
      const state = JSON.parse(raw);
      if(state.form){
        luInput.value = state.form.legalUnit || '';
        document.getElementById('person1').value = state.form.person || '';
        placeInput.value = state.form.place || '';
        document.getElementById('denumire').value = state.form.customer || '';
        document.getElementById('numar_doc').value = state.form.docNumber || '';
        (document.getElementById('eu_ursprung').value = state.form.shipmentRef || '');
        document.getElementById('langzeit_von').value = state.form.validFrom || '';
        document.getElementById('langzeit_bis').value = state.form.validTo || '';
        langSelect.value = state.form.language || 'DE';
        if(state.form.signatureImage){ signaturePreview.src = state.form.signatureImage; }
        declarationRadios.forEach(r => r.checked = (r.value === state.form.declarationType));
        toggleDeclarationType();
      }
      if(Array.isArray(state.materials) && window.IHK_MATERIALS_API){
        const api = window.IHK_MATERIALS_API;
        const data = state.materials;
        const tbody = document.getElementById('materialsBody');
        while(tbody.rows.length) tbody.deleteRow(0);
        data.forEach(row => api.addRow(row));
        api.updateMetrics();
      }
      autoFillPlace();
    } catch(e){ /* ignore */ }
  }

  // Snapshot & export functionality removed per user request
  langSelect.addEventListener('change', saveState);

  // Save on form interactions
  form.addEventListener('input', saveState);
  form.addEventListener('change', saveState);

  document.addEventListener('DOMContentLoaded', restoreState);

  function toggleDeclarationType(){
    const selected = declarationRadios.find(r=>r.checked)?.value || 'single';
    if(selected === 'single') {
      shipmentGroup.hidden = false;
      dateRangeGroup.hidden = true;
    } else {
      shipmentGroup.hidden = true;
      dateRangeGroup.hidden = false;
      // Auto-populate full current year if fields are empty
      const fromEl = document.getElementById('langzeit_von');
      const toEl = document.getElementById('langzeit_bis');
      const now = new Date();
      const year = now.getFullYear();
      const fullYearStart = `${year}-01-01`;
      const fullYearEnd = `${year}-12-31`;
      if(!fromEl.value) fromEl.value = fullYearStart;
      if(!toEl.value) toEl.value = fullYearEnd;
    }
  }
  declarationRadios.forEach(r => r.addEventListener('change', toggleDeclarationType));
  toggleDeclarationType();

  function monthDiff(start, end){
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if(e.getDate() < s.getDate()) months -= 1;
    return months;
  }

  function validateForm(){
    const errors = [];
    const requiredIds = ['lu2','person1','place1','denumire','numar_doc'];
    requiredIds.forEach(id => {
      const el = document.getElementById(id);
      if(!el.value.trim()) errors.push(`${id} is required.`);
    });
    const declType = declarationRadios.find(r=>r.checked)?.value || 'single';
    if(declType === 'single') {
      const shipRef = document.getElementById('eu_ursprung').value.trim();
      if(!shipRef) errors.push('Shipment reference is required for single shipment declaration.');
    } else {
      const from = document.getElementById('langzeit_von').value;
      const to = document.getElementById('langzeit_bis').value;
      if(!from || !to) {
        errors.push('Both Valid From and Valid To dates are required for long-term declaration.');
      } else {
        const dFrom = new Date(from);
        const dTo = new Date(to);
        if(dTo < dFrom) errors.push('Valid To date must be after Valid From date.');
        const months = monthDiff(dFrom, dTo);
        if(months > 24) errors.push(`Date range exceeds 24 months (${months} months).`);
      }
    }
    // Table at least one non-empty row
    const tableBody = document.querySelector('#data-table tbody');
    const hasDataRow = tableBody && Array.from(tableBody.rows).some(row => Array.from(row.cells).slice(0,5).some(cell => cell.textContent.trim()));
    if(!hasDataRow) errors.push('At least one material row must contain data.');

    if(errors.length){
      errorBox.innerHTML = '<strong>Fix the following before generating PDF:</strong><ul>' + errors.map(e=>`<li>${e}</li>`).join('') + '</ul>';
      errorBox.style.display = 'block';
      return false;
    } else {
      errorBox.style.display = 'none';
      errorBox.innerHTML = '';
      return true;
    }
  }

  generateBtn.addEventListener('click', ()=>{
    if(!validateForm()) return;
    generatePDF();
  });

  window.IHK_TEST_API = {
    monthDiff,
    validateDateRange: function(fromStr, toStr){
      if(!fromStr || !toStr) return { ok:false, reason:'Missing date(s)' };
      const from = new Date(fromStr);
      const to = new Date(toStr);
      if(to < from) return { ok:false, reason:'End before start' };
      const months = monthDiff(from, to);
      if(months > 24) return { ok:false, reason:`Exceeds 24 months (${months})` };
      return { ok:true, months };
    }
  };
  window.IHK_STATE_API = { saveState, restoreState };
})();
