(() => {
  'use strict';
  const bills=[['2021-03-26',377.75],['2021-06-24',241.89],['2021-09-20',291.62],['2021-12-31',326.55],['2022-03-28',336.22],['2022-07-01',235.51],['2022-09-26',291.97],['2022-12-23',266.18],['2023-03-24',343.17],['2023-06-28',267.44],['2023-09-25',240.61],['2023-12-22',283.98],['2024-03-26',343.18],['2024-06-21',316.60],['2024-09-17',271.84],['2024-12-18',375.50],['2025-03-25',464.50],['2025-06-23',346.36],['2025-09-16',304.67],['2025-12-19',348.73],['2026-03-24',489.25],['2026-06-22',299.45]];
  const dayMs=86400000,key=d=>d.toISOString().slice(0,10);
  function apply(start,end,total,extend=false){const a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z'),days=Math.max(1,Math.round((b-a)/dayMs)),daily=total/days,last=extend?new Date(key(new Date())+'T12:00:00Z'):b;for(let d=new Date(a.getTime()+dayMs);d<=last;d=new Date(d.getTime()+dayMs))window.HomeInsights.upsertDaily({date:key(d),waterTotal:daily,waterBillTotal:total,waterBillingStart:start,waterBillingEnd:end,waterSource:extend?'Latest bill daily average':'Actual bill interval'});}
  for(let i=1;i<bills.length;i++)apply(bills[i-1][0],bills[i][0],bills[i][1]);
  const previous=bills.at(-2),latest=bills.at(-1);apply(previous[0],latest[0],latest[1],true);
  window.HOME_INSIGHTS_WATER_BILLS=bills.map(([date,total])=>({date,total}));
})();
