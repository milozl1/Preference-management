// Simple console-based assertions for IHK helpers
(function(){
  if(!window.IHK_TEST_API){
    console.warn('[IHK TEST] API not found – ensure ihk.js loaded before tests.');
    return;
  }
  const { monthDiff, validateDateRange } = window.IHK_TEST_API;
  function assert(name, condition){
    if(condition){
      console.log('%cPASS','color:green', name);
    } else {
      console.error('%cFAIL','color:red', name);
    }
  }

  // Month diff cases
  assert('monthDiff same month', monthDiff(new Date('2025-01-01'), new Date('2025-01-20')) === 0);
  assert('monthDiff one month', monthDiff(new Date('2025-01-01'), new Date('2025-02-01')) === 1);
  assert('monthDiff end earlier day adjusts', monthDiff(new Date('2025-01-31'), new Date('2025-02-01')) === 0);

  // Range validation
  const okRange = validateDateRange('2025-01-01','2026-01-01');
  assert('validateDateRange within 12 months', okRange.ok && okRange.months === 12);

  const longRange = validateDateRange('2025-01-01','2027-02-01');
  assert('validateDateRange exceeding 24 months flagged', !longRange.ok && /Exceeds/.test(longRange.reason));

  const badOrder = validateDateRange('2025-05-01','2025-04-30');
  assert('validateDateRange end before start', !badOrder.ok && badOrder.reason === 'End before start');

  console.log('[IHK TEST] Finished basic assertions.');
})();
