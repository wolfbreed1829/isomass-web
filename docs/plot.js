const c = { bg:'#10171c', ink:'#e3e2d6', muted:'#8fa0a2', line:'#2b3a40', gold:'#e2b873', teal:'#68b1ae' };
const polar = (r,a) => [400+r*Math.cos(a),325+r*Math.sin(a)];
const point = p => p.map(v=>v.toFixed(3)).join(',');
const text = (x,y,v,size=12,color=c.muted,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-family="Segoe UI,Arial,sans-serif">${v}</text>`;
const line = (x,y,x2,y2,color=c.line) => `<path d="M${x},${y}L${x2},${y2}" stroke="${color}" fill="none"/>`;
function arc(r,start,width) {
  const a=start/64*Math.PI*2-Math.PI/2+.012,sweep=width/64*Math.PI*2-.024;
  return `M${point(polar(r,a))}A${r},${r} 0 ${sweep>Math.PI?1:0} 1 ${point(polar(r,a+sweep))}`;
}
export function renderPlot(s, {id="plot", interactive=true}={}) {
  const p=[];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 820" role="group" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">Isomass: ${s.regions.length} regions, total capacity ${s.mass}</title><desc id="${id}-desc">Select an arc to focus it. Arrow up and down select other regions. Enter or Space selects a focused arc. Use Divide to split the selected region.</desc><rect width="800" height="820" fill="${c.bg}"/>`);
  for(let i=0;i<64;i++){const a=i*2*Math.PI/64-Math.PI/2;p.push(line(...polar(299,a),...polar(i%8===0?309:303,a),i%8===0?'#64777d':c.line));}
  for(const r of [76,134,192,291])p.push(`<circle cx="400" cy="325" r="${r}" fill="none" stroke="${c.line}"/>`);
  p.push(line(89,325,711,325,'#1d2a30'),line(400,14,400,636,'#1d2a30'));
  for(let layer=0;layer<13;layer++) {
    let d='';for(let i=0;i<=256;i++){const j=i%256,r=68+layer*8+s.samples[j]/8192*(21+layer*2);d+=(i?'L':'M')+point(polar(r,j*2*Math.PI/256-Math.PI/2));}
    p.push(`<path d="${d}Z" fill="none" stroke="${layer===12?c.gold:`rgb(${55+layer*5},${87+layer*5},${88+layer*3})`}" stroke-width="${layer===12?1.8:.8}"/>`);
  }
  p.push(`<circle cx="400" cy="325" r="52" fill="${c.bg}"/>`,text(400,339,s.mass,50,c.ink),text(400,361,'CONSERVED',9,c.gold));
  for(const r of s.regions){const focused=r.id===s.focus,active=s.active.includes(r.id),radius=250+r.depth*4,d=arc(radius,r.start,r.width),a=(r.start+r.width/2)*2*Math.PI/64-Math.PI/2,n=polar(radius,a),label=polar(285,a);
    p.push(`<g class="region" role="button" tabindex="${focused?0:-1}" data-region="${r.id}" aria-label="Region ${s.regions.indexOf(r)+1} of ${s.regions.length}, capacity ${r.width}, depth ${r.depth}" aria-pressed="${focused}"><title>Region ${s.regions.indexOf(r)+1}: ${r.width} of 64. Select to edit.</title><path d="${d}" fill="none" stroke="transparent" stroke-width="52"/><path class="region-band" d="${d}" fill="none" stroke="${focused?c.gold:active?c.teal:'#60777c'}" stroke-width="${focused?12:active?9:5}"/><circle cx="${n[0]}" cy="${n[1]}" r="${focused?4.5:2.5}" fill="${c.bg}"/></g>`);
    if(s.regions.length<=32)p.push(text(label[0],label[1]+4,r.width,11,focused?c.gold:c.muted));
    if(s.mirror.includes(r.id)&&!focused){const m=polar(radius-18,a);p.push(`<circle cx="${m[0]}" cy="${m[1]}" r="3" fill="${c.gold}"/>`);}
  }
  const x=40,y=686,w=720,h=91;p.push(text(x,662,'INTERFERENCE / 256 SAMPLES',9,c.muted,'start'));
  for(let i=0;i<=8;i++)p.push(line(x+w*i/8,y,x+w*i/8,y+h));p.push(line(x,y,x+w,y),line(x,y+h,x+w,y+h));
  const d=s.samples.map((v,i)=>(i?'L':'M')+(x+w*i/255).toFixed(3)+','+(y+h-v*h/8192).toFixed(3)).join('');
  p.push(`<path d="${d}" stroke="${c.teal}" stroke-width="1.5" fill="none"/>`,text(x,797,'0',9,c.muted,'start'),text(x+w,797,'256',9,c.muted,'end'),'</svg>');
  const svg=p.join('');
  return interactive ? svg : svg.replace(/<g class="region"[^>]*>/g, '<g>').replace('role="group"','role="img"').replace(/<desc[^>]*>.*?<\/desc>/, `<desc id="${id}-desc">Reference partition, conserved total, and its interference field. This view stays fixed while you edit the current form.</desc>`);
}
