// src/pages/anketa/parts/utils.jsx
export const cx = (...a)=>a.filter(Boolean).join(' ');
export const H = (s) => { let h=2166136261>>>0; const x=String(s||''); for(let i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
export const clamp = (n,min=0,max=100)=>Math.max(min,Math.min(max,n));
export const pct = (a,b)=> b<=0?0:Math.round((a/b)*100);
export const todayISO = ()=>new Date().toISOString().slice(0,10);
export const nowISO = ()=>new Date().toISOString();

export const formatRelativeTime = (iso, fallback = '—') => {
    if (!iso) return fallback;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return fallback;
    const diffMs = Date.now() - date.getTime();
    const absMs = Math.abs(diffMs);
    const units = [
        { unit: 'minute', ms: 60 * 1000 },
        { unit: 'hour', ms: 60 * 60 * 1000 },
        { unit: 'day', ms: 24 * 60 * 60 * 1000 },
        { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
        { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
        { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    ];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    for (const { unit, ms } of units) {
        if (absMs < ms * (unit === 'minute' ? 1.5 : 1.0)) {
            const value = Math.round(diffMs / ms);
            if (value === 0 && unit === 'minute') {
                return rtf.format(0, 'minute');
            }
            return rtf.format(value * -1, unit);
        }
    }
    const years = Math.round(diffMs / units[units.length - 1].ms);
    return rtf.format(years * -1, 'year');
};

export const parseLocalDate = (s) => {
    if (!s) return null;
    // Handle both YYYY-MM-DD and ISO datetime formats
    const dateStr = String(s).split('T')[0]; // Extract date part from ISO format
    const [y,m,d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m-1, d, 0, 0, 0, 0);
};
export const endOfDayLocal = (s) => {
    const d = parseLocalDate(s);
    if (!d) return null;
    d.setHours(23,59,59,999);
    return d;
};
export const isWindowOpen = (openAt, closeAt, now = new Date()) => {
    const start = parseLocalDate(openAt);
    const end = endOfDayLocal(closeAt);
    if (!start || !end) return false;
    return start.getTime() <= now.getTime() && now.getTime() <= end.getTime();
};

export const toSlug = (s='chart') => String(s).toLowerCase().replace(/[^\w-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'chart';

export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 300);
};

export const dataToCSV = (rows=[]) => {
    if (!rows || rows.length===0) return 'date,attendanceRate\n';
    const heads = [];
    const seen = new Set();
    rows.forEach(r=>Object.keys(r||{}).forEach(k=>{ if(!seen.has(k)){ seen.add(k); heads.push(k); } }));
    const esc = (v)=> {
        if (v===null || v===undefined) return '';
        const s = String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
        return s;
    };
    const lines = [heads.join(',')];
    rows.forEach(r => lines.push(heads.map(h=>esc(r[h])).join(',')));
    return lines.join('\n');
};

export const getSvgDims = (svg) => {
    const wAttr = svg.getAttribute('width');
    const hAttr = svg.getAttribute('height');
    const vb = svg.getAttribute('viewBox');
    if (wAttr && hAttr) {
        const w = parseFloat(wAttr); const h = parseFloat(hAttr);
        if (Number.isFinite(w) && Number.isFinite(h)) return { width: w, height: h };
    }
    if (vb) {
        const p = vb.split(/\s+/).map(Number);
        if (p.length===4 && p.every(Number.isFinite)) return { width: p[2], height: p[3] };
    }
    const bb = svg.getBoundingClientRect();
    return { width: Math.max(1, Math.round(bb.width||800)), height: Math.max(1, Math.round(bb.height||400)) };
};
export const inlineComputed = (root) => {
    const props = ['fill','stroke','color','opacity','stroke-width','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','fill-opacity','stroke-opacity','font-family','font-size','font-weight','font-style','letter-spacing','text-anchor','shape-rendering','dominant-baseline'];
    const tree = root.querySelectorAll('*');
    tree.forEach(el=>{
        const cs = window.getComputedStyle(el);
        props.forEach(p=>{
            let v = cs.getPropertyValue(p);
            if (!v) return;
            v = v.trim();
            if (!v || v.startsWith('var(')) return;
            const attr = p.replace(/-([a-z])/g, (_,c)=>c.toUpperCase());
            if (p.startsWith('font')) el.style[attr] = v;
            else if (p==='color') el.setAttribute('color', v);
            else el.setAttribute(p, v);
        });
        if (el.tagName.toLowerCase()==='stop') {
            const sc = cs.getPropertyValue('stop-color');
            if (sc && !sc.startsWith('var(')) el.setAttribute('stop-color', sc.trim());
            const so = cs.getPropertyValue('stop-opacity');
            if (so) el.setAttribute('stop-opacity', so.trim());
        }
    });
    return root;
};
export const cloneSvgWithInlineSize = (svg) => {
    const clone = svg.cloneNode(true);
    const { width, height } = getSvgDims(svg);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    inlineComputed(clone);
    return { clone, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
};
export const svgToPngBlob = async (svg, bg='#ffffff') => {
    const { clone, width, height } = cloneSvgWithInlineSize(svg);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    const ctx = canvas.getContext('2d');
    return new Promise((resolve, reject)=>{
        img.onload = () => {
            ctx.setTransform(dpr,0,0,dpr,0,0);
            if (bg) { ctx.fillStyle = bg; ctx.fillRect(0,0,width,height); }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob)=> blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png', 1.0);
        };
        img.onerror = reject;
        img.src = url;
    });
};
export const getBestGraphicNode = (container) => {
    if (!container) return null;
    const nodes = Array.from(container.querySelectorAll('svg,canvas'));
    if (!nodes.length) return null;
    let best = null;
    let bestArea = 0;
    nodes.forEach(n=>{
        const r = n.getBoundingClientRect();
        const area = Math.max(1, Math.round((r.width||0)*(r.height||0)));
        if (area > bestArea) { best = n; bestArea = area; }
    });
    return best;
};
export const exportNodeAsPNG = async (container, filename) => {
    if (!container) return;
    const node = getBestGraphicNode(container);
    if (!node) return;
    if (node.tagName.toLowerCase() === 'canvas') {
        const canvas = node;
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        const bb = canvas.getBoundingClientRect();
        const w = Math.round((bb.width || canvas.width || 800) * dpr);
        const h = Math.round((bb.height || canvas.height || 400) * dpr);
        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const tctx = tmp.getContext('2d');
        tctx.setTransform(dpr,0,0,dpr,0,0);
        tctx.drawImage(canvas, 0, 0, bb.width || canvas.width, bb.height || canvas.height);
        tmp.toBlob((blob)=> blob && downloadBlob(blob, `${toSlug(filename)}.png`), 'image/png', 1.0);
        return;
    }
    if (node.tagName.toLowerCase() === 'svg') {
        const blob = await svgToPngBlob(node, '#ffffff');
        downloadBlob(blob, `${toSlug(filename)}.png`);
    }
};
export const exportNodeAsSVG = (container, filename) => {
    if (!container) return;
    const node = getBestGraphicNode(container);
    if (!node) return;
    if (node.tagName.toLowerCase() !== 'svg') { exportNodeAsPNG(container, filename); return; }
    const { clone } = cloneSvgWithInlineSize(node);
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type:'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `${toSlug(filename)}.svg`);
};
export const copyNodeAsPNG = async (container) => {
    try{
        const node = getBestGraphicNode(container);
        if (!node) return { ok:false, reason:'no-node' };
        let blob = null;
        if (node.tagName.toLowerCase()==='canvas') {
            const canvas = node;
            blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
        } else if (node.tagName.toLowerCase()==='svg') {
            blob = await svgToPngBlob(node, '#ffffff');
        }
        if (blob && navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
            return { ok:true };
        } else {
            return { ok:false, reason:'clipboard-unsupported' };
        }
    }catch(e){
        return { ok:false, reason:'error' };
    }
};

export const median = (arr=[]) => {
    const a = arr.slice().sort((x,y)=>x-y);
    if (a.length===0) return 0;
    const mid = Math.floor(a.length/2);
    return a.length%2 ? a[mid] : (a[mid-1]+a[mid])/2;
};
export const stddev = (arr=[]) => {
    if (!arr.length) return 0;
    const m = arr.reduce((s,x)=>s+x,0)/arr.length;
    const v = arr.reduce((s,x)=>(x-m)*(x-m)+s,0)/arr.length;
    return Math.sqrt(v);
};
export const movingAvg = (data=[], key='attendanceRate', w=3) => {
    const k = Math.max(1, Math.floor(w));
    const out = [];
    for (let i=0;i<data.length;i++){
        const s = Math.max(0, i-k+1);
        const slice = data.slice(s, i+1);
        const avg = Math.round(slice.reduce((a,b)=>a+(Number(b[key])||0),0)/slice.length);
        out.push({ ...data[i], [key]: avg });
    }
    return out;
};