// compute.worker.js - heavy computations off main thread

self.onmessage = (ev) => {
  try{
    const { type, payload } = ev.data || {};
    if (type === 'compute'){
      const res = computeAll(payload.rows || [], payload.filters || {});
      postMessage({ type:'done', payload: res });
    } else if (type === 'counts'){
      const rows = payload.rows || [];
      const column = payload.column;
      const map = new Map();
      for (const r of rows){
        const key = String(r?.[column] ?? '').trim() || '(empty)';
        map.set(key, (map.get(key)||0)+1);
      }
      const labels = Array.from(map.keys());
      const data = Array.from(map.values());
      postMessage({ type:'counts-done', payload: { labels, data } });
    }
  }catch(err){
    postMessage({ type:'error', error: err?.message || String(err) });
  }
};

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function computeAll(rows, filters){
  const cwMin = clamp(parseInt(filters.cwMin||1,10), 1, 53);
  const cwMax = clamp(parseInt(filters.cwMax||53,10), 1, 53);
  const vendorSet = new Set((filters.vendors||[]));
  const activeOnly = !!filters.activeOnly;
  const useDistinctWeeksDenominator = !!filters.useDistinctWeeksDenominator;

  // Filter rows
  let data = rows.filter(r => r.cw>=cwMin && r.cw<=cwMax && (vendorSet.size===0 || vendorSet.has(r.vendor)));
  if (activeOnly) data = data.filter(r => r.count>0);

  // Aggregations
  const totalsByWeek = aggregate(data, ['cw'], 'count'); // [{cw, total}]
  const totalsByVendor = aggregate(data, ['vendor'], 'count'); // [{vendor, total}]
  const vendorWeek = aggregate(data, ['vendor','cw'], 'count'); // [{vendor,cw,total}]

  // Series per vendor for small multiples and boxplot
  const vendorWeekSeries = vendorWeek; // alias

  // Indexing for performance
  const cwValues = [...new Set(vendorWeek.map(r=>r.cw))].sort((a,b)=>a-b);
  const byVendor = new Map(); // vendor -> [{cw,total}] sorted by cw
  const byCW = new Map();     // cw -> [{vendor,total}]
  const vendorCW = new Map(); // vendor -> Map(cw -> total)
  for (const r of vendorWeek){
    if (!byVendor.has(r.vendor)) byVendor.set(r.vendor, []);
    byVendor.get(r.vendor).push({ cw: r.cw, total: r.total });
    if (!byCW.has(r.cw)) byCW.set(r.cw, []);
    byCW.get(r.cw).push({ vendor: r.vendor, total: r.total });
    if (!vendorCW.has(r.vendor)) vendorCW.set(r.vendor, new Map());
    vendorCW.get(r.vendor).set(r.cw, r.total);
  }
  for (const arr of byVendor.values()) arr.sort((a,b)=>a.cw-b.cw);

  // Denominator for ratios
  const weeksAnalyzedRange = Math.max(1, cwMax - cwMin + 1);
  const weeksDistinct = new Set(data.map(r=>r.cw)).size || 1;
  const weeksAnalyzed = useDistinctWeeksDenominator ? weeksDistinct : weeksAnalyzedRange;

  // Weeks active per vendor
  const weeksActiveByVendor = totalsByVendor.map(v => {
    const arr = byVendor.get(v.vendor) || [];
    const weeksActive = arr.reduce((acc, it)=> acc + (it.total>0?1:0), 0);
    const activeWeekRatio = weeksActive / weeksAnalyzed;
    const avgActive = weeksActive > 0 ? v.total / weeksActive : 0;
    const avgPerYearWeek = v.total / weeksAnalyzed;
    return { vendor: v.vendor, weeksActive, activeWeekRatio, avgCountPerActiveWeek: avgActive, avgCountPerYearWeek: avgPerYearWeek };
  });

  // Dense rank per CW (using index)
  const ranksByWeek = cwValues.map(cw => {
    const inWeek = (byCW.get(cw) || []).slice().sort((a,b)=>b.total-a.total);
    const ranks = [];
    let lastVal = null, rank=0;
    for (let i=0;i<inWeek.length;i++){
      const val = inWeek[i].total;
      if (val !== lastVal){ rank++; lastVal = val; }
      ranks.push({ vendor: inWeek[i].vendor, rank });
    }
    return { cw, ranks };
  });

  // CV per vendor (using weekly totals)
  const cvByVendor = totalsByVendor.map(v => {
    const map = vendorCW.get(v.vendor) || new Map();
    const series = cwValues.map(cw => map.get(cw) || 0);
    const mu = series.reduce((a,b)=>a+b,0) / (series.length||1);
    const s2 = series.reduce((a,b)=>a+(b-mu)*(b-mu),0) / (series.length||1);
    const sigma = Math.sqrt(s2);
    const cv = mu>0 ? sigma/mu : 0;
    return { vendor: v.vendor, cv };
  });

  // Zero weeks per vendor
  const zeroWeeks = totalsByVendor.map(v => {
    const weeksActive = weeksActiveByVendor.find(x=>x.vendor===v.vendor)?.weeksActive || 0;
    return { vendor: v.vendor, zeroWeeks: weeksAnalyzed - weeksActive };
  });

  // Longest consecutive streaks per vendor
  const streaks = totalsByVendor.map(v => computeStreaksIndexed(v.vendor, byVendor.get(v.vendor) || []));

  // WoW deltas vendor and total
  const wowTotal = totalsByWeek.map((d,i,arr)=>{
    const prev = arr[i-1]?.total || 0; const delta = d.total - prev; const pct = prev>0 ? delta/prev : 0; return { cw:d.cw, wowDelta: delta, wowPct: pct };
  });
  const wowByVendor = totalsByVendor.map(v => {
    const map = vendorCW.get(v.vendor) || new Map();
    const series = cwValues.map(cw => map.get(cw) || 0);
    return series.map((val,i,arr)=>{ const prev=arr[i-1]||0; const delta=val-prev; const pct=prev>0?delta/prev:0; return { cw:cwValues[i], vendor:v.vendor, wowDelta:delta, wowPct:pct }; });
  }).flat();

  // SPC on weekly totals
  const mu = totalsByWeek.reduce((a,b)=>a+b.total,0) / (totalsByWeek.length||1);
  const s2 = totalsByWeek.reduce((a,b)=>a+(b.total-mu)*(b.total-mu),0) / (totalsByWeek.length||1);
  const sigma = Math.sqrt(s2);
  const outliers = totalsByWeek.filter(d => d.total > mu + 3*sigma || d.total < mu - 3*sigma);

  // Global active ratio (for KPIs)
  const globalActiveWeeks = new Set(data.map(r=>r.cw)).size;
  const globalActiveRatio = globalActiveWeeks / weeksAnalyzed;

  // Pareto
  const sortedV = [...totalsByVendor].sort((a,b)=>b.total-a.total);
  const sum = sortedV.reduce((a,b)=>a+b.total,0) || 1;
  let running=0; const cumPct = []; for (const v of sortedV){ running+=v.total; cumPct.push(running/sum); }
  const thresholdIndex = cumPct.findIndex(p=>p>=0.8);
  const topVendors = sortedV.slice(0, thresholdIndex+1).map(v=>v.vendor);

  // Inter-delivery gaps per vendor (in weeks)
  const gapsByVendor = totalsByVendor.map(v => computeGapsIndexed(v.vendor, byVendor.get(v.vendor) || []));
  const gapsMetrics = gapsByVendor.map(g => ({
    vendor: g.vendor,
    deliveries: g.weeks.length,
    gapsCount: g.gaps.length,
    meanGap: statMean(g.gaps),
    medianGap: statMedian(g.gaps),
    modeGap: statMode(g.gaps),
    cadenceScore: cadenceScore(g.gaps),
    minGap: g.gaps.length ? Math.min(...g.gaps) : null,
    maxGap: g.gaps.length ? Math.max(...g.gaps) : null,
    lastGap: g.gaps.length ? g.gaps[g.gaps.length-1] : null,
  }));
  // Ranking: primary by medianGap ASC; tie-breakers for ordering only:
  // higher cadenceScore first, then meanGap ASC, then maxGap ASC, then vendor name ASC
  const rankOrder = (a,b)=>{
    const ag = a.medianGap ?? Infinity, bg = b.medianGap ?? Infinity;
    if (ag !== bg) return ag - bg;
    const ac = a.cadenceScore ?? -1, bc = b.cadenceScore ?? -1; if (ac !== bc) return bc - ac;
    const am = a.meanGap ?? Infinity, bm = b.meanGap ?? Infinity; if (am !== bm) return am - bm;
    const ax = a.maxGap ?? Infinity, bx = b.maxGap ?? Infinity; if (ax !== bx) return ax - bx;
    const av = String(a.vendor||''), bv = String(b.vendor||''); return av.localeCompare(bv, 'ro');
  };
  const gapsRanks = [...gapsMetrics].sort(rankOrder).map((d,i)=>({ vendor:d.vendor, medianGap:d.medianGap, rank:i+1 }));

  return {
    totalsByWeek,
    totalsByVendor,
    vendorWeek,
    vendorWeekSeries,
    weeksActiveByVendor,
    ranksByWeek,
    spc: { mean: mu, sigma, outliers },
    wow: { total: wowTotal, byVendor: wowByVendor },
    boxData: vendorWeekSeries, // alias
    streaks,
    pareto: { order: sortedV.map(d=>d.vendor), cumPct, thresholdIndex, topVendors },
    globalActiveRatio,
    gaps: { byVendor: gapsByVendor, metrics: gapsMetrics, ranks: gapsRanks },
    cvByVendor,
    weeksAnalyzed,
  };
}

function aggregate(rows, keys, valueField){
  const m = new Map();
  for (const r of rows){
    const k = keys.map(k=>r[k]).join('\u0001');
    const prev = m.get(k) || { total:0 };
    prev.total += (r[valueField]||0);
    m.set(k, prev);
  }
  const out = [];
  for (const [k, obj] of m){
    const parts = k.split('\u0001');
    const rec = {}; keys.forEach((key, i)=> rec[key] = typeof parts[i]==='string' && /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i]);
    rec.total = obj.total; out.push(rec);
  }
  return out;
}

function computeStreaksIndexed(vendor, vRows){
  let best = []; let current = [];
  for (const r of vRows){
    if (r.total>0){
      if (!current.length || r.cw === current[current.length-1].cw + 1){ current.push(r); } else { if (current.length>best.length) best=current; current=[r]; }
    } else {
      if (current.length>best.length) best=current; current=[];
    }
  }
  if (current.length>best.length) best=current;
  return { vendor, longest: best };
}

function computeGapsIndexed(vendor, vRows){
  // Get sorted unique weeks with total>0 for this vendor
  const weeks = vRows.filter(r=>r.total>0).map(r=>r.cw); // already sorted by caller
  const uniqWeeks = Array.from(new Set(weeks));
  const gaps = [];
  for (let i=1;i<uniqWeeks.length;i++){ gaps.push(uniqWeeks[i]-uniqWeeks[i-1]); }
  return { vendor, weeks: uniqWeeks, gaps };
}

function statMean(arr){ if (!arr?.length) return null; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function statMedian(arr){ if (!arr?.length) return null; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function statMode(arr){ if (!arr?.length) return null; const m=new Map(); for(const x of arr){ m.set(x,(m.get(x)||0)+1);} let best=null,bf=-1; for(const [k,v] of m){ if(v>bf){bf=v; best=k;} } return best; }
function cadenceScore(arr){ if (!arr?.length) return null; const mode = statMode(arr); const cnt = arr.filter(x=>x===mode).length; return cnt/arr.length; }
