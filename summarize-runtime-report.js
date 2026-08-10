// Run from the repo root:  node summarize-runtime-report.js
// Reads audit/runtime-report.json and prints the offenders compactly.
const r=require(process.cwd()+'/audit/runtime-report.json'),R=r.results;
const seen=new Set(),out=[];
const add=(s)=>{if(!seen.has(s)){seen.add(s);out.push(s);}};
console.log('=== OVERFLOW (worst per route) ===');
const byRoute={};
for(const c of R){for(const w of ['top','bottom']){const t=c[w];if(!t||!t.overflow)continue;
 const k=c.route+' ['+w+']';if(!byRoute[k]||t.overflow.excess>byRoute[k].e)byRoute[k]={e:t.overflow.excess,vp:c.viewport,off:t.offenders};}}
for(const [k,v] of Object.entries(byRoute)){console.log(`\n${k}  worst +${v.e}px @ ${v.vp}`);
 v.off.slice(0,6).forEach(o=>console.log(`   ${String(o.width).padStart(5)}px  L${o.left} R${o.right}  ${o.sel}`));}
console.log('\n=== iOS ZOOM (unique selectors) ===');
const z=new Set();R.forEach(c=>['top','bottom'].forEach(w=>c[w]&&c[w].iosZoom.forEach(i=>z.add(`${i.fontSize}px  ${i.sel}`))));
[...z].sort().forEach(s=>console.log('  '+s));
console.log('\n=== TAP TARGETS < 44px (unique, by frequency) ===');
const t={};R.forEach(c=>['top','bottom'].forEach(w=>c[w]&&c[w].tapSmall.forEach(x=>{const k=`${x.w}x${x.h}  ${x.sel}  "${(x.label||'').slice(0,28)}"`;t[k]=(t[k]||0)+1;})));
Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,40).forEach(([k,n])=>console.log(`  x${String(n).padStart(3)}  ${k}`));
console.log('\n=== FIXED LAYER COLLISIONS (unique) ===');
const f=new Set();R.forEach(c=>['top','bottom'].forEach(w=>c[w]&&c[w].fixedLayers.forEach(x=>f.add(`${x.a} (z${x.aZ})  X  ${x.b} (z${x.bZ})`))));
f.size?[...f].forEach(s=>console.log('  '+s)):console.log('  (none)');
console.log('\n=== CROWDED PAIRS (<8px apart, unique) ===');
const p=new Set();R.forEach(c=>['top','bottom'].forEach(w=>c[w]&&c[w].tapCrowded.forEach(x=>p.add(`${x.gap}px  ${x.a.sel} / ${x.b.sel}`))));
p.size?[...p].slice(0,20).forEach(s=>console.log('  '+s)):console.log('  (none)');
