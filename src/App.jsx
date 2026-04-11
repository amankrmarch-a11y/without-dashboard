import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

// ─── CDN libs ─────────────────────────────────────────────────────────────────
function useLibsReady() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Papa && !!window.XLSX);
  useEffect(() => {
    if (ready) return;
    let core = 0;
    const coreDone = () => { if (++core === 2) setReady(true); };
    const addCore = src => {
      if (document.querySelector(`script[src="${src}"]`)) { coreDone(); return; }
      const s = document.createElement("script"); s.src = src; s.onload = coreDone; s.onerror = coreDone;
      document.head.appendChild(s);
    };
    addCore("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js");
    addCore("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    // Bonus libs — load silently in background for PDF reading + export
    ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
     "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
     "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js",
    ].forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const s = document.createElement("script"); s.src = src; document.head.appendChild(s);
    });
  }, []);
  return ready;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// ─── Theme tokens (light & dark) ─────────────────────────────────────────────
const THEMES = {
  light: {
    bg:"#ecedf5",       card:"#ffffff",      cardAlt:"#f4f5fb",   border:"#dddee8",
    primary:"#2d2d4e",  primaryLt:"#3d3d6e", primaryText:"#fff",
    accent:"#7ab800",   accentLt:"#f0f7d4",  accentMid:"#5a8a00",
    text:"#1a1a2e",     sub:"#4a4a72",       muted:"#8888aa",
    meta:"#1877f2",     metaLt:"#e8f0fe",
    li:"#0a66c2",       liLt:"#e8f2fb",
    google:"#ea4335",   googleLt:"#fce8e6",
    navBg:"#ffffff",    navBorder:"#dddee8",
    up:"#16a34a",       upBg:"#f0fdf4",
    down:"#dc2626",     downBg:"#fef2f2",
    // keep sidebar aliases for any leftover refs
    sidebar:"#2d2d4e",  sidebarTx:"#c8d4c4",
  },
  dark: {
    bg:"#13132a",       card:"#1c1c3a",      cardAlt:"#22224a",   border:"#2e2e55",
    primary:"#5c5c9e",  primaryLt:"#7070b8", primaryText:"#fff",
    accent:"#7ab800",   accentLt:"#1e2d0a",  accentMid:"#5a8a00",
    text:"#e8e8ff",     sub:"#9898cc",       muted:"#5a5a88",
    meta:"#4a9eff",     metaLt:"#0d1f3c",
    li:"#3a8fd4",       liLt:"#0d1e30",
    google:"#ff6b5b",   googleLt:"#2a0f0d",
    navBg:"#1c1c3a",    navBorder:"#2e2e55",
    up:"#22c55e",       upBg:"#052e16",
    down:"#f87171",     downBg:"#2a0a0a",
    sidebar:"#13132a",  sidebarTx:"#9898cc",
  },
};
let C = THEMES.light;

const MONTHS_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const srcColor  = s => s==="Meta"?C.meta:s==="LinkedIn"?C.li:s==="Google"?C.google:C.accent;
const srcLight  = s => s==="Meta"?C.metaLt:s==="LinkedIn"?C.liLt:s==="Google"?C.googleLt:C.accentLt;

// ─── Number / date utils ──────────────────────────────────────────────────────
function toNum(v) {
  if (v===null||v===undefined) return 0;
  const s=String(v).trim().replace(/^["']+|["']+$/g,"");
  if(!s||/^(nan|none|n\/a|--|-)$/i.test(s)) return 0;
  const n=parseFloat(s.replace(/[₹$£€,%\s]/g,"").replace(/,/g,""));
  return isNaN(n)?0:n;
}
const ML={
  jan:"Jan",feb:"Feb",mar:"Mar",apr:"Apr",may:"May",jun:"Jun",
  jul:"Jul",aug:"Aug",sep:"Sep",oct:"Oct",nov:"Nov",dec:"Dec",
  january:"Jan",february:"Feb",march:"Mar",april:"Apr",june:"Jun",
  july:"Jul",august:"Aug",september:"Sep",october:"Oct",november:"Nov",december:"Dec",
  "1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun",
  "7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec",
  "01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun",
  "07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec",
};
function toMonth(raw) {
  if(!raw&&raw!==0) return null;
  const s=String(raw).trim().replace(/^["']+|["']+$/g,"");
  if(!s) return null;
  let m;
  m=s.match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+\d/); if(m) return ML[m[1].toLowerCase()]||null;
  m=s.match(/^(\d{2})-(\d{2})-(\d{4})$/);       if(m) return ML[m[1]]||null;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);        if(m) return ML[m[2]]||null;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);  if(m) return ML[m[1].padStart(2,"0")]||null;
  m=s.match(/^([A-Za-z]+)/);                     if(m) return ML[m[1].toLowerCase()]||null;
  m=s.match(/^(\d{1,2})$/);                      if(m) return ML[m[1]]||null;
  return null;
}
function toYearMonth(raw) {
  // Returns "YYYY-MM" or null
  if(!raw&&raw!==0) return null;
  const s=String(raw).trim().replace(/^["']+|["']+$/g,"");
  if(!s) return null;
  let m;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);        if(m) return `${m[1]}-${m[2]}`;
  m=s.match(/^(\d{2})-(\d{2})-(\d{4})$/);        if(m) return `${m[3]}-${m[1]}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);  if(m) return `${m[3]}-${m[1].padStart(2,"0")}`;
  m=s.match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+\d+,\s+(\d{4})/); if(m){ const mo=ML[m[1].toLowerCase()]; const idx=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(mo)+1; return mo?`${m[2]}-${String(idx).padStart(2,"0")}`:null; }
  return null;
}

const fmtINR = n => {
  if(!n&&n!==0) return "₹0";
  if(n>=100000) {
    const v = (n/100000).toFixed(2);
    return `₹${v.replace(/\.?0+$/,'')}L`;
  }
  if(n>=1000) return `₹${(n/1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
const fmtNum = n => {
  if(!n&&n!==0) return "0";
  if(n>=1000000) return `${(n/1000000).toFixed(1)}M`;
  if(n>=1000)    return `${(n/1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
};
const pct = (a,b) => b?((a/b)*100).toFixed(1):"0";
const delta = (curr,prev) => prev===0?null:((curr-prev)/prev*100).toFixed(1);

// ─── Header resolver ──────────────────────────────────────────────────────────
const FIELD_ALIASES = {
  month:       ["reporting starts","start date (in utc)","date","reporting start","start date","month","period","week","day","day_start","time"],
  spend:       ["amount spent (inr)","amount spent (usd)","amount spent","total spent","cost","spend","total spend","ad spend","total cost","budget spent"],
  impressions: ["impressions","impr.","impr","impression"],
  clicks:      ["clicks","link clicks","outbound clicks","total clicks","click"],
  leads:       ["results","leads","conversions","total leads","total results","purchases"],
  cpl:         ["cost per results","cost per lead","cost / conv.","cost per result","cost per conversion","cpl","cpr","cost per purchase","cost / conversion"],
  campaign:    ["campaign name","campaign","ad name","ad set name","ad group"],
  cpc:         ["avg. cpc","average cpc","cpc","cost per click"],
  ctr:         ["click through rate","ctr","click-through rate"],
  reach:       ["reach"],
  convValue:   ["total conversion value","conversion value","all conv. value","conv. value","purchase value","revenue","total revenue","purchase conversion value"],
  roas:        ["return on ad spend","roas","return on investment"],
};
const LEADS_BLOCK = ["indicator","form","work email","qualified","viral","post-click","view-through","opened","completion","rate"];

function resolveHeaders(headers) {
  const map={};
  const norm=headers.map(h=>({orig:h,low:h.toLowerCase().trim()}));
  for(const [field,aliases] of Object.entries(FIELD_ALIASES)){
    for(const alias of aliases){
      let hit=norm.find(h=>h.low===alias)||norm.find(h=>h.low.startsWith(alias))||norm.find(h=>h.low.includes(alias));
      if(hit&&!map[field]){
        if(field==="leads"&&LEADS_BLOCK.some(b=>hit.low.includes(b))) continue;
        map[field]=hit.orig; break;
      }
    }
  }
  return map;
}

// ─── Accumulate rows → monthly + campaign data ────────────────────────────────
function accumulate(rows, hmap, reportMonth, reportYear) {
  const byMonth={};
  const byCampaign={};

  // Pre-pass: detect LinkedIn-style aggregate exports where every row shares the
  // same date (the campaign START date, not the report period). If all rows parse
  // to the same month AND it differs from reportMonth, override all rows with reportMonth.
  let monthOverride = null;
  if(reportMonth){
    const parsed = rows.map(r=>toMonth(hmap.month?r[hmap.month]:null)).filter(Boolean);
    const unique = [...new Set(parsed)];
    if(unique.length<=1 && (unique.length===0||unique[0]!==reportMonth)){
      monthOverride = reportMonth;
    }
  }

  rows.forEach(row => {
    const month = monthOverride || toMonth(hmap.month?row[hmap.month]:null) || reportMonth;
    if(!month) return;
    // Derive yearMonth from row date, or from reportYear+reportMonth
    const rowDateRaw = hmap.month?row[hmap.month]:null;
    let yearMonth = toYearMonth(rowDateRaw||"");
    if(!yearMonth && reportYear && month) {
      const mi = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(month)+1;
      if(mi>0) yearMonth = `${reportYear}-${String(mi).padStart(2,"0")}`;
    }
    if(!yearMonth && month) yearMonth = month; // fallback: just month name (no year info)
    const ymKey = yearMonth || month;
    if(!byMonth[ymKey]) byMonth[ymKey]={month,yearMonth:ymKey,spend:0,impressions:0,clicks:0,leads:0,reach:0,convValue:0,_cpls:[],_roas:[]};
    const r=byMonth[ymKey];
    r.spend+=toNum(hmap.spend?row[hmap.spend]:0);
    r.impressions+=toNum(hmap.impressions?row[hmap.impressions]:0);
    r.clicks+=toNum(hmap.clicks?row[hmap.clicks]:0);
    r.leads+=toNum(hmap.leads?row[hmap.leads]:0);
    r.reach+=toNum(hmap.reach?row[hmap.reach]:0);
    r.convValue+=toNum(hmap.convValue?row[hmap.convValue]:0);
    if(hmap.cpl){const v=toNum(row[hmap.cpl]);if(v>0)r._cpls.push(v);}
    if(hmap.roas){const v=toNum(row[hmap.roas]);if(v>0)r._roas.push(v);}

    // Campaign level
    const cname = hmap.campaign?String(row[hmap.campaign]||"").trim():"";
    if(cname&&cname.length>1){
      if(!byCampaign[cname]) byCampaign[cname]={name:cname,spend:0,leads:0,impressions:0,clicks:0};
      byCampaign[cname].spend+=toNum(hmap.spend?row[hmap.spend]:0);
      byCampaign[cname].leads+=toNum(hmap.leads?row[hmap.leads]:0);
      byCampaign[cname].impressions+=toNum(hmap.impressions?row[hmap.impressions]:0);
      byCampaign[cname].clicks+=toNum(hmap.clicks?row[hmap.clicks]:0);
    }
  });

  const monthly = Object.keys(byMonth).sort().map(m=>{
    const r=byMonth[m];
    const cpl=r.leads>0?Math.round(r.spend/r.leads):r._cpls.length?Math.round(r._cpls.reduce((a,b)=>a+b,0)/r._cpls.length):0;
    const ctr=r.impressions>0?parseFloat(((r.clicks/r.impressions)*100).toFixed(2)):0;
    const cpc=r.clicks>0?Math.round(r.spend/r.clicks):0;
    // ROAS from file: use conv value if > 0, else average of roas column values
    const roasFromFile = r.convValue>0&&r.spend>0 ? parseFloat((r.convValue/r.spend).toFixed(2))
      : r._roas.length ? parseFloat((r._roas.reduce((a,b)=>a+b,0)/r._roas.length).toFixed(2)) : 0;
    return{month:m,spend:r.spend,impressions:r.impressions,clicks:r.clicks,leads:r.leads,reach:r.reach,convValue:r.convValue,cpl,ctr,cpc,roas:roasFromFile};
  });

  const campaigns = Object.values(byCampaign).map(c=>({
    ...c,
    cpl:c.leads>0?Math.round(c.spend/c.leads):0,
    ctr:c.impressions>0?parseFloat(((c.clicks/c.impressions)*100).toFixed(2)):0,
  })).sort((a,b)=>b.spend-a.spend);

  return{monthly,campaigns};
}

// ─── File reader ──────────────────────────────────────────────────────────────
async function extractTextFromPDF(arrayBuffer) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not ready — please retry in a moment");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageLines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group text items by Y-position to reconstruct logical rows
    const byY = {};
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x: item.transform[4], text: item.str });
    });
    Object.keys(byY).sort((a, b) => b - a).forEach(y => {
      const row = byY[y].sort((a, b) => a.x - b.x).map(i => i.text).join("\t");
      if (row.trim()) pageLines.push(row);
    });
  }
  return pageLines.join("\n");
}

function parseTextToRows(text, sourceHint) {
  const lines = text.split(/\r?\n/);
  let hIdx = 0, reportMonth = null;
  // Auto-detect delimiter
  const sample = lines.slice(0, 5).join("\n");
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']+|["']+$/g, ""));
    const real = parts.filter(p => p && !/^\d{4}$/.test(p) && !/^Report/i.test(p) && !/^Date Generated/i.test(p));
    const s = parts[0] || "";
    const mMatch = s.match(/Report Start[:\s]+([A-Za-z]+)\s+(\d+),?\s*(\d{4})/i);
    if(mMatch){ reportMonth=ML[mMatch[1].toLowerCase()]||null; reportYear=parseInt(mMatch[3])||null; }
    const mMatch2 = s.match(/Report Start[:\s]+([A-Za-z]+)/i);
    if(!reportMonth&&mMatch2) reportMonth=ML[mMatch2[1].toLowerCase()]||null;
    if (real.length >= 3 && !parts[0].match(/^\d{4}-\d{2}/) && !/^(Campaign Performance|Report|Date Generated)/i.test(s)) {
      hIdx = i; break;
    }
  }
  const result = window.Papa.parse(lines.slice(hIdx).join("\n"), {
    header: true, skipEmptyLines: true, dynamicTyping: false, delimiter, quoteChar: '"',
  });
  return { rows: result.data, encoding: sourceHint || "text", delimiter, reportMonth };
}

function readFileToRows(file) {
  return new Promise((resolve,reject)=>{
    const ext=file.name.split(".").pop().toLowerCase();
    const reader=new FileReader();

    // ── PDF ──────────────────────────────────────────────────────────────────
    if(ext==="pdf"){
      reader.onload=async e=>{
        try{
          const text=await extractTextFromPDF(e.target.result);
          resolve(parseTextToRows(text,"pdf-extracted"));
        }catch(err){reject(err);}
      };
      reader.onerror=reject;
      reader.readAsArrayBuffer(file);
      return;
    }

    // ── XLSX / XLS ───────────────────────────────────────────────────────────
    if(["xlsx","xls","xlsm","ods"].includes(ext)){
      reader.onload=e=>{
        try{
          const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const allRows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
          let hIdx=0, reportMonth=null, reportYear=null;
          for(let i=0;i<Math.min(allRows.length,15);i++){
            const row=allRows[i];
            const s=String(row[0]||"").trim();
            const mMatch=s.match(/Report Start[:\s]+([A-Za-z]+)/i);
            if(mMatch) reportMonth=ML[mMatch[1].toLowerCase()]||null;
            const nonEmpty=row.filter(c=>c!==null&&c!==undefined&&String(c).trim().length>0);
            const isMeta=/^(Campaign Performance|Report Start|Report End|Date Generated|Account Name)/i.test(s);
            if(nonEmpty.length>=3&&!isMeta){hIdx=i;break;}
          }
          const headers=allRows[hIdx];
          const rows=allRows.slice(hIdx+1)
            .filter(r=>r.some(c=>c!==null&&c!==undefined&&String(c).trim().length>0))
            .map(r=>{const obj={};headers.forEach((h,i)=>{if(h)obj[String(h).trim()]=r[i]??""});return obj;});
          resolve({rows,encoding:"xlsx",delimiter:"",reportMonth,reportYear});
        }catch(err){reject(err);}
      };
      reader.onerror=reject;
      reader.readAsArrayBuffer(file);
      return;
    }

    // ── CSV / TSV / TXT and everything else — decode text then parse ─────────
    reader.onload=e=>{
      try{
        const bytes=new Uint8Array(e.target.result);
        let text,encoding;
        if(bytes[0]===0xFF&&bytes[1]===0xFE){text=new TextDecoder("utf-16le").decode(e.target.result);encoding="utf-16le";}
        else if(bytes[0]===0xFE&&bytes[1]===0xFF){text=new TextDecoder("utf-16be").decode(e.target.result);encoding="utf-16be";}
        else if(bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF){text=new TextDecoder("utf-8").decode(e.target.result);encoding="utf-8-bom";}
        else{try{text=new TextDecoder("utf-8",{fatal:true}).decode(e.target.result);encoding="utf-8";}catch{text=new TextDecoder("latin-1").decode(e.target.result);encoding="latin-1";}}
        resolve(parseTextToRows(text, encoding));
      }catch(err){reject(err);}
    };
    reader.onerror=reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseFile(rows, reportMonth){
  if(!rows||!rows.length) return{monthly:[],campaigns:[],hmap:{},headers:[]};
  const rawH=Object.keys(rows[0]).map(h=>h.replace(/^\uFEFF/,"").replace(/^\uFFFE/,"").trim());
  const cleanRows=rows.map(row=>{const c={};Object.entries(row).forEach(([k,v])=>{c[k.replace(/^\uFEFF/,"").replace(/^\uFFFE/,"").trim()]=v;});return c;});
  const hmap=resolveHeaders(rawH);
  const{monthly,campaigns}=accumulate(cleanRows,hmap,reportMonth,reportYear);
  return{monthly,campaigns,hmap,headers:rawH};
}

function folderLabel(sources,dt){
  const pad=n=>String(n).padStart(2,"0");
  const tag=sources.length===3?"ALL":sources.length===2?sources.join("_"):sources[0].toUpperCase();
  return `Upload_${tag}_${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}_${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function UploadBox({source,color,logo,files,onAddFiles,onDeleteFile}){
  const[drag,setDrag]=useState(false);
  const ref=useRef();
  const hasFiles=files&&files.length>0;
  const addFiles=useCallback(newFiles=>{
    const arr=Array.from(newFiles).filter(f=>f);
    if(arr.length) onAddFiles(arr);
  },[onAddFiles]);
  const drop=useCallback(e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);},[addFiles]);
  return(
    <div style={{border:`2px dashed ${drag||hasFiles?color:C.border}`,borderRadius:14,background:hasFiles?`${color}06`:drag?`${color}04`:C.card,
        padding:"18px 16px",transition:"all .2s",
        display:"flex",flexDirection:"column",gap:8,
        boxShadow:hasFiles?`0 0 0 3px ${color}18,0 1px 4px rgba(0,0,0,0.05)`:"0 1px 4px rgba(0,0,0,0.05)"}}>
      <input ref={ref} type="file" accept="*/*" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
      {/* Header — click to add more */}
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={drop}
        onClick={()=>ref.current?.click()}
        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 0"}}>
        <div style={{width:40,height:40,borderRadius:11,background:`${color}14`,border:`1.5px solid ${color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color}}>{logo}</div>
        <div style={{fontWeight:700,fontSize:13,color:C.text}}>{source}</div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.5,textAlign:"center"}}>
          {hasFiles
            ?<span style={{color,fontWeight:600,fontSize:10}}>+ Add more files</span>
            :<>Drop or <span style={{color,fontWeight:600,textDecoration:"underline"}}>browse</span><br/><span style={{fontSize:10}}>CSV · XLSX · PDF · TXT · any format</span></>
          }
        </div>
      </div>
      {/* File list */}
      {hasFiles&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {files.map((f,i)=>(
            <div key={i} style={{background:`${color}10`,border:`1px solid ${color}22`,borderRadius:7,padding:"5px 9px",fontSize:11,color,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12}}>📄</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,fontSize:10.5}}>{f.name}</span>
              <button onClick={e=>{e.stopPropagation();onDeleteFile(i);}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,flexShrink:0}}>✕</button>
            </div>
          ))}
          <div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:2}}>{files.length} file{files.length!==1?"s":""} queued</div>
        </div>
      )}
    </div>
  );
}

// Delta badge — shows MoM change
function Delta({curr,prev,invert=false}){
  if(prev===null||prev===undefined||prev===0) return null;
  const d=parseFloat(delta(curr,prev));
  const up=invert?d<0:d>0;
  const color=up?C.up:C.down;
  const bg=up?C.upBg:C.downBg;
  return(
    <span style={{fontSize:10,fontWeight:700,color,background:bg,padding:"1px 6px",borderRadius:4,letterSpacing:0.2}}>
      {d>0?"+":""}{d}%
    </span>
  );
}

// KPI card with optional delta
function KPI({label,value,sub,color,icon,primary,green,curr,prev,invertDelta}){
  // primary = dark navy card (first card style), green = brand green, else white
  const bg  = primary?C.primary:green?C.accent:C.card;
  const lc  = primary||green?"rgba(255,255,255,0.6)":C.muted;
  const vc  = primary||green?"#fff":(color||C.text);
  const sc  = primary||green?"rgba(255,255,255,0.55)":C.muted;
  return(
    <div style={{background:bg,borderRadius:16,padding:"20px 22px",display:"flex",flexDirection:"column",gap:4,
      boxShadow:primary?"0 4px 20px rgba(45,45,78,0.18)":"0 2px 10px rgba(45,45,78,0.06)",
      border:primary||green?"none":`1px solid ${C.border}`}}>
      <div style={{fontSize:10,color:lc,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,marginBottom:2}}>{label}</div>
      <div style={{fontSize:28,fontWeight:800,color:vc,fontFamily:"'DM Mono',monospace",letterSpacing:-1,lineHeight:1.05}}>{value}</div>
      <div style={{display:"flex",alignItems:"center",gap:6,minHeight:16,marginTop:2}}>
        {sub&&<span style={{fontSize:11,color:sc}}>{sub}</span>}
        {curr!==undefined&&prev!==undefined&&<Delta curr={curr} prev={prev} invert={invertDelta}/>}
      </div>
    </div>
  );
}

// Section header
// ─── Shared DateFilter component ─────────────────────────────────────────────
function DateFilter({fromDate,setFromDate,toDate,setToDate,label="Period"}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}:</span>
      <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
        style={{border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,color:C.text,background:C.card,outline:"none",cursor:"pointer",boxShadow:"0 1px 4px rgba(45,45,78,0.06)"}}/>
      <span style={{fontSize:11,color:C.muted}}>to</span>
      <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
        style={{border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,color:C.text,background:C.card,outline:"none",cursor:"pointer",boxShadow:"0 1px 4px rgba(45,45,78,0.06)"}}/>
      {(fromDate||toDate)&&(
        <button onClick={()=>{setFromDate("");setToDate("");}}
          style={{fontSize:10,color:C.muted,background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontWeight:600}}>✕ Clear</button>
      )}
    </div>
  );
}

// ─── CRM B2B type filter ──────────────────────────────────────────────────────
// Include: all B2B types. Exclude: Waste/Raw Material, Grants, Marketing/Services, EPR, CSR, Retailers
// ─── CRM B2B type filter ──────────────────────────────────────────────────────
// Include: all deal types starting with "B2B" (LEFT(F,3)="B2B")
// No further exclusion needed — the B2B prefix already scopes correctly
const isCrmB2B = r => /^B2B/i.test(r.type);

function SectionHead({title,sub}){
  return(
    <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
      <div style={{fontSize:10.5,fontWeight:800,color:C.primary,textTransform:"uppercase",letterSpacing:2}}>{title}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,fontWeight:400}}>{sub}</div>}
    </div>
  );
}

// Consistent page header — used on ALL tabs
function PageHeader({supra,title,right}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:4}}>
      <div>
        <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>{supra||"Without® · Analytics"}</div>
        <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-0.5,color:C.text}}>{title}</h1>
      </div>
      {right&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{right}</div>}
    </div>
  );
}

// Consistent inline date filter pill — same on every page
function DatePill({from,setFrom,to,setTo}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"5px 12px",boxShadow:"0 1px 4px rgba(45,45,78,0.06)"}}>
      <span style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,whiteSpace:"nowrap"}}>Period</span>
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
        style={{border:"none",background:"transparent",fontSize:11,color:C.text,outline:"none",cursor:"pointer",fontFamily:"inherit"}}/>
      <span style={{fontSize:11,color:C.muted}}>–</span>
      <input type="date" value={to} onChange={e=>setTo(e.target.value)}
        style={{border:"none",background:"transparent",fontSize:11,color:C.text,outline:"none",cursor:"pointer",fontFamily:"inherit"}}/>
      {(from||to)&&(
        <button onClick={()=>{setFrom("");setTo("");}}
          style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"0 2px",fontWeight:700,lineHeight:1}}>✕</button>
      )}
    </div>
  );
}

// Custom tooltip
function TT({active,payload,label}){
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",boxShadow:"0 4px 16px rgba(0,0,0,0.09)"}}>
      <div style={{fontWeight:700,color:C.text,marginBottom:4,fontSize:11}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{fontSize:11,color:p.color,display:"flex",justifyContent:"space-between",gap:14}}><span>{p.name}</span><b>{typeof p.value==="number"&&p.value>1000?fmtINR(p.value):fmtNum(p.value)}</b></div>)}
    </div>
  );
}

// Folder row for history
function FolderRow({folder,onDelete}){
  const[open,setOpen]=useState(false);
  const fc=folder.sources.length===3?C.accent:srcColor(folder.sources[0]);
  return(
    <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",background:C.card,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div className="hr" onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer"}}>
        <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:`${fc}12`,border:`1px solid ${fc}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{open?"📂":"📁"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:12,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{folder.name}</div>
          <div style={{fontSize:10.5,color:C.muted,marginTop:1}}>{folder.datetime} · {folder.files.length} file{folder.files.length!==1?"s":""}</div>
        </div>
        <div style={{display:"flex",gap:3}}>{folder.sources.map(s=><span key={s} style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${srcColor(s)}10`,color:srcColor(s)}}>{s}</span>)}</div>
        <span style={{color:C.muted,fontSize:10,transition:"transform .2s",transform:open?"rotate(90deg)":"rotate(0)",display:"inline-block",flexShrink:0}}>▶</span>
        <button className="del" onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,paddingLeft:3}}>✕</button>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.border}`,background:C.cardAlt}}>
          {folder.files.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px 9px 26px",borderBottom:i<folder.files.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:srcColor(f.source),flexShrink:0}}/>
              <span style={{fontSize:12}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11.5,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:1}}>{f.source} · {f.size} · {f.rows} rows · {f.months} month{f.months!==1?"s":""} · {f.encoding}</div>
              </div>
              <span style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${srcColor(f.source)}10`,color:srcColor(f.source)}}>{f.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(data, filename) {
  if(!data.length) return;
  const keys=Object.keys(data[0]);
  const rows=[keys.join(","),...data.map(r=>keys.map(k=>`"${r[k]}"`).join(","))];
  const blob=new Blob([rows.join("\n")],{type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
}

// ─── XLSX export ──────────────────────────────────────────────────────────────
function exportToXLSX(params) {
  const { md, ld, gd, mAgg, lAgg, gAgg, tSpend, tLeads, tClicks, tImpr, bCPL, bCTR, bCPC,
          allM, allCampaigns, activeChan, dateLabel, fmtINR, fmtNum } = params;
  const wb = window.XLSX.utils.book_new();
  const chanLabel = activeChan === "all" ? "All Channels" : activeChan;

  // ── Sheet 1: Summary KPIs ──
  const summaryRows = [
    ["WITHOUT® — ADS SPEND REPORT"],
    ["Period", dateLabel], ["Channel Filter", chanLabel], ["Generated", new Date().toLocaleDateString("en-IN")],
    [],
    ["METRIC", "VALUE"],
    ["Total Spend (₹)", tSpend],
    ["Total Leads", tLeads],
    ["Total Clicks", tClicks],
    ["Total Impressions", tImpr],
    ["Blended CPL (₹)", bCPL],
    ["Blended CTR (%)", bCTR],
    ["Avg CPC (₹)", bCPC],
    [],
    ["CHANNEL BREAKDOWN", "Spend (₹)", "Leads", "Clicks", "Impressions", "CPL (₹)", "CTR (%)"],
    ...[
      activeChan==="all"||activeChan==="Meta"    ? ["Meta",     mAgg.spend, mAgg.leads, mAgg.clicks, mAgg.impressions, mAgg.leads?Math.round(mAgg.spend/mAgg.leads):0, mAgg.impressions?parseFloat(((mAgg.clicks/mAgg.impressions)*100).toFixed(2)):0] : null,
      activeChan==="all"||activeChan==="LinkedIn" ? ["LinkedIn", lAgg.spend, lAgg.leads, lAgg.clicks, lAgg.impressions, lAgg.leads?Math.round(lAgg.spend/lAgg.leads):0, lAgg.impressions?parseFloat(((lAgg.clicks/lAgg.impressions)*100).toFixed(2)):0] : null,
      activeChan==="all"||activeChan==="Google"   ? ["Google",   gAgg.spend, gAgg.leads, gAgg.clicks, gAgg.impressions, gAgg.leads?Math.round(gAgg.spend/gAgg.leads):0, gAgg.impressions?parseFloat(((gAgg.clicks/gAgg.impressions)*100).toFixed(2)):0] : null,
    ].filter(Boolean),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  // ── Sheet 2: Monthly Spend ──
  const monthlyHeaders = ["Month","Meta Spend","LinkedIn Spend","Google Spend","Total Spend","Meta Leads","LinkedIn Leads","Google Leads","Total Leads","CPL","CTR (%)","Avg CPC","Meta Clicks","LinkedIn Clicks","Google Clicks","Total Clicks","Meta Impr","LinkedIn Impr","Google Impr","Total Impr"];
  const monthlyData = allM.map(m=>{
    const mr=md.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0};
    const lr=ld.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0};
    const gr=gd.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0};
    const ts=mr.spend+lr.spend+gr.spend, tl=mr.leads+lr.leads+gr.leads;
    const tc=mr.clicks+lr.clicks+gr.clicks, ti=mr.impressions+lr.impressions+gr.impressions;
    return [m, mr.spend,lr.spend,gr.spend,ts, mr.leads,lr.leads,gr.leads,tl,
            tl?Math.round(ts/tl):0, ti?parseFloat(((tc/ti)*100).toFixed(2)):0, tc?Math.round(ts/tc):0,
            mr.clicks,lr.clicks,gr.clicks,tc, mr.impressions,lr.impressions,gr.impressions,ti];
  });
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([monthlyHeaders,...monthlyData]), "Monthly");

  // ── Sheet 3: Campaigns ──
  if(allCampaigns.length){
    const campHeaders=["Campaign","Source","Spend (₹)","Leads","CPL (₹)","CTR (%)","Clicks","Impressions"];
    const campData=allCampaigns.map(c=>[c.name,c.source,c.spend,c.leads,c.cpl,c.ctr,c.clicks,c.impressions]);
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([campHeaders,...campData]), "Campaigns");
  }

  window.XLSX.writeFile(wb, `without_ads_report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportToPDF(params) {
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF) { alert("PDF export is still loading — please try again in a moment"); return; }
  const { md, ld, gd, mAgg, lAgg, gAgg, tSpend, tLeads, tClicks, tImpr, bCPL, bCTR, bCPC,
          allM, allCampaigns, activeChan, dateLabel } = params;
  const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
  const chanLabel = activeChan === "all" ? "All Channels" : activeChan;
  const W = 297, accent = [90,138,0], dark = [26,31,24], lt = [245,246,244];

  // Header bar
  doc.setFillColor(...dark); doc.rect(0,0,W,18,"F");
  doc.setTextColor(...accent); doc.setFontSize(12); doc.setFont("helvetica","bold");
  doc.text("WITHOUT® — ADS SPEND REPORT", 10, 12);
  doc.setTextColor(200,212,196); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text(`Period: ${dateLabel}  |  Channel: ${chanLabel}  |  Generated: ${new Date().toLocaleDateString("en-IN")}`, 10, 17.5);

  // KPI summary boxes
  const kpis = [
    ["Total Spend", `₹${(tSpend/100000).toFixed(1)}L`],
    ["Total Leads", String(tLeads||"—")],
    ["Total Clicks", String(tClicks||"—")],
    ["Total Impr.", `${(tImpr/1000).toFixed(1)}K`],
    ["Blended CPL", bCPL?`₹${bCPL}`:"—"],
    ["CTR", bCTR?`${bCTR}%`:"—"],
    ["Avg CPC", bCPC?`₹${bCPC}`:"—"],
  ];
  const kpiW = (W-20)/kpis.length, kpiY = 22;
  kpis.forEach(([label,val],i)=>{
    const x = 10+i*kpiW;
    doc.setFillColor(...lt); doc.roundedRect(x, kpiY, kpiW-2, 16, 2, 2,"F");
    doc.setTextColor(...dark); doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text(label.toUpperCase(), x+3, kpiY+5);
    doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.setTextColor(...accent); doc.text(val, x+3, kpiY+13);
  });

  // Monthly table
  const monthHeaders = ["Month","Meta Spend","LinkedIn Spend","Google Spend","Total Spend","Leads","CPL","CTR %","CPC","Clicks","Impressions"];
  const monthRows = allM.map(m=>{
    const mr=md.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0,cpl:0,ctr:0,cpc:0};
    const lr=ld.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0};
    const gr=gd.find(d=>d.month===m)||{spend:0,leads:0,clicks:0,impressions:0};
    const ts=mr.spend+lr.spend+gr.spend, tl=mr.leads+lr.leads+gr.leads, tc=mr.clicks+lr.clicks+gr.clicks, ti=mr.impressions+lr.impressions+gr.impressions;
    return [m, mr.spend?`₹${Math.round(mr.spend).toLocaleString("en-IN")}`:"—", lr.spend?`₹${Math.round(lr.spend).toLocaleString("en-IN")}`:"—", gr.spend?`₹${Math.round(gr.spend).toLocaleString("en-IN")}`:"—",
            ts?`₹${Math.round(ts).toLocaleString("en-IN")}`:"—", tl||"—", tl&&ts?`₹${Math.round(ts/tl)}`:"—",
            ti?`${parseFloat(((tc/ti)*100).toFixed(2))}%`:"—", tc&&ts?`₹${Math.round(ts/tc)}`:"—",
            tc||"—", ti?`${(ti/1000).toFixed(1)}K`:"—"];
  });
  doc.autoTable({
    head:[monthHeaders], body:monthRows,
    startY:42, margin:{left:10,right:10},
    headStyles:{fillColor:dark, textColor:accent, fontStyle:"bold", fontSize:7},
    bodyStyles:{fontSize:7, textColor:dark},
    alternateRowStyles:{fillColor:lt},
    columnStyles:{0:{fontStyle:"bold"}},
  });

  // Campaigns table (if any)
  if(allCampaigns.length){
    const campY = doc.lastAutoTable.finalY + 8;
    doc.setTextColor(...dark); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("TOP CAMPAIGNS", 10, campY);
    doc.autoTable({
      head:[["Campaign","Source","Spend","Leads","CPL","CTR","Clicks"]],
      body:allCampaigns.slice(0,15).map(c=>[
        c.name.length>40?c.name.slice(0,40)+"…":c.name, c.source,
        c.spend?`₹${Math.round(c.spend).toLocaleString("en-IN")}`:"—",
        c.leads||"—", c.cpl?`₹${c.cpl}`:"—", c.ctr?`${c.ctr}%`:"—", c.clicks||"—"
      ]),
      startY:campY+4, margin:{left:10,right:10},
      headStyles:{fillColor:dark, textColor:accent, fontStyle:"bold", fontSize:7},
      bodyStyles:{fontSize:7, textColor:dark}, alternateRowStyles:{fillColor:lt},
    });
  }

  doc.save(`without_ads_report_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ─── In-memory storage (localStorage not available in artifact sandbox) ─────────
const EMPTY_LIVE = {meta:[],linkedin:[],google:[],metaCamp:[],liCamp:[],googleCamp:[]};
const EMPTY_INV = []; // flat array of deduplicated B2B invoices
const EMPTY_CRM = []; // flat array of CRM deals
// Safe localStorage wrapper — silently degrades if unavailable
const lsGet = (key, fallback) => {
  try { const v = typeof localStorage !== "undefined" && localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const lsSave = (key, value) => {
  try { if(typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// Merge monthly arrays: new months ADD to existing, same month UPDATES (new wins)
function mergeMonthly(existing, incoming) {
  const map = {};
  existing.forEach(r => { map[r.yearMonth||r.month] = r; });
  incoming.forEach(r => { map[r.yearMonth||r.month] = r; }); // incoming overwrites same period
  return MONTHS_ORDER.filter(m => map[m]).map(m => map[m]);
}

// Merge campaigns: combine and re-sort by spend
function mergeCampaigns(existing, incoming) {
  const map = {};
  existing.forEach(c => { map[c.name] = c; });
  incoming.forEach(c => {
    if(map[c.name]) {
      map[c.name] = {
        ...c,
        spend: map[c.name].spend + c.spend,
        leads: map[c.name].leads + c.leads,
        impressions: map[c.name].impressions + c.impressions,
        clicks: map[c.name].clicks + c.clicks,
      };
      const m = map[c.name];
      m.cpl = m.leads ? Math.round(m.spend/m.leads) : 0;
      m.ctr = m.impressions ? parseFloat(((m.clicks/m.impressions)*100).toFixed(2)) : 0;
    } else {
      map[c.name] = c;
    }
  });
  return Object.values(map).sort((a,b) => b.spend - a.spend);
}

// ─── Invoice parser (Zoho Books XLS/CSV export) ───────────────────────────────
function parseInvoiceFile(rows) {
  if(!rows||!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const findCol = (...names) => headers.find(h => names.some(n => h.toLowerCase().trim()===n.toLowerCase())) ||
                                headers.find(h => names.some(n => h.toLowerCase().trim().includes(n.toLowerCase()))) || null;

  const colNum      = findCol("Invoice Number","invoice number");
  const colDate     = findCol("Invoice Date","invoice date","date");
  const colStatus   = findCol("Invoice Status","invoice status","status");
  const colBizType  = findCol("CF.Business Type","business type","cf.business type");
  const colSubtotal = findCol("SubTotal","Subtotal","sub total","subtotal");
  const colCustomer = findCol("Customer Name","customer name","customer");
  const colBalance  = findCol("Balance","balance");

  if(!colNum||!colSubtotal) return [];

  const seen = new Set();
  const result = [];

  rows.forEach(row => {
    const invNum = String(row[colNum]||"").trim();
    if(!invNum||seen.has(invNum)) return; // deduplicate

    const status   = String(row[colStatus]||"").trim();
    if(!["Closed","Overdue"].includes(status)) return; // skip Draft etc.

    const bizType  = String(row[colBizType]||"").trim();
    // Include B2B, D2C, and B2C — exclude Grants and empty
    const bt = bizType.toUpperCase();
    if(!bizType || bt === "GRANTS" || /^GRANT/i.test(bizType)) return;
    // Skip completely unclassified or pure internal types
    if(bizType.length < 2) return;

    seen.add(invNum);
    const month     = toMonth(row[colDate]) || "—";
    const yearMonth = toYearMonth(row[colDate]) || month;
    const subtotal = toNum(row[colSubtotal]);
    const balance  = toNum(row[colBalance]);
    const customer = String(row[colCustomer]||"").trim();
    result.push({invoiceNumber:invNum, month, yearMonth, status, businessType:bizType, subtotal, balance, customer});
  });
  return result;
}

// Merge invoices: incoming invoices overwrite existing ones with same invoice number
function mergeInvoices(existing, incoming) {
  const map = {};
  existing.forEach(r => { map[r.invoiceNumber] = r; });
  incoming.forEach(r => { map[r.invoiceNumber] = r; });
  return Object.values(map);
}

// ─── CRM parser ──────────────────────────────────────────────────────────────
// Handles: CSV, XLS, XLSX, raw exports — any column order.
// Deduplicates by Record Id.
// B2B = deal type starts with "B2B".
// Others = everything else (Grants, Waste, CSR, Retailers, etc.)
// Stage mapping (exact Zoho strings):
//   "Closed Won"                       → closedWon
//   "Closed Lost (Internal Issues FA)" → lostFA
//   "Closed Lost"                      → closedLost
//   everything else                    → active

function smartFindCol(headers, rows) {
  const H = headers.map(h => ({ k: h, l: (h||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim() }));
  const exact   = term => H.find(h => h.l === term.toLowerCase())?.k;
  const partial = term => H.find(h => h.l.includes(term.toLowerCase()))?.k;
  // Position-based fallback using standard Zoho CRM column order
  const byPos   = idx  => headers[idx] || null;

  const C = {};
  C.id      = exact('record id')    || partial('record id')    || byPos(0);
  C.created = exact('created time') || partial('created time') || byPos(1);
  C.name    = exact('deal name')    || partial('deal name')    || byPos(2);
  // Account Name: must be exact to avoid matching "Account Name.id" (col D)
  C.account = exact('account name') || byPos(4);
  // Deal Type: header match only — DO NOT validate with data scan (file may start with non-B2B rows)
  C.type    = exact('deal type b2b b2c etc')
    || exact('deal type')
    || partial('deal type')
    || byPos(5); // col F in standard Zoho CRM export
  C.stage   = exact('stage')        || partial('stage')        || byPos(6);
  C.owner   = exact('deal owner')   || partial('deal owner')   || byPos(11);
  C.amount  = exact('amount')       || partial('amount')       || byPos(12);
  C.closing = exact('closing date') || partial('closing date') || byPos(13);

  return C;
}

function parseCrmFile(rows) {
  if(!rows||!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const C = smartFindCol(headers, rows);

  const seen = new Set();
  const result = [];

  rows.forEach(row => {
    // Get values
    const id      = String(row[C.id]    || '').trim();
    const name    = String(row[C.name]  || '').trim();
    const account = String(row[C.account]||'').trim();
    const type    = String(row[C.type]  || '').trim();
    const stage   = String(row[C.stage] || '').trim();
    const owner   = String(row[C.owner] || '').trim();
    const amount  = toNum(row[C.amount]);
    // Closing date — normalise to YYYY-MM-DD string
    let closing = String(row[C.closing]||'').trim();
    // Handle various date formats: DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
    if(closing){
      const dmY = closing.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
      const mDY = closing.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(dmY) closing = `${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`;
      else if(mDY) closing = `${mDY[3]}-${mDY[1].padStart(2,'0')}-${mDY[2].padStart(2,'0')}`;
      else closing = closing.slice(0,10); // assume YYYY-MM-DD or ISO
    }
    const created = String(row[C.created]||'').trim().slice(0,10);

    // Skip if no meaningful data
    if(!name && !account && !id) return;

    // Dedup by id (use name+account as fallback key if no id)
    const dedupKey = id || `${name}__${account}`;
    if(seen.has(dedupKey)) return;
    seen.add(dedupKey);

    // Month/year from closing string
    let closingMonth = null, closingYear = null;
    if(closing && closing.length >= 7) {
      const mi = parseInt(closing.slice(5,7),10) - 1;
      if(mi >= 0 && mi <= 11) {
        closingMonth = MONTHS_ORDER[mi];
        closingYear  = parseInt(closing.slice(0,4),10);
      }
    }

    // Is this a B2B deal?
    const isB2B = /^B2B/i.test(type);

    // Stage classification
    let stageClass;
    if     (stage === 'Closed Won')                        stageClass = 'closedWon';
    else if(stage === 'Closed Lost (Internal Issues FA)')  stageClass = 'lostFA';
    else if(stage === 'Closed Lost')                       stageClass = 'closedLost';
    else                                                   stageClass = 'active';

    result.push({ id: dedupKey, name, account, type, stage, stageClass,
      owner, amount, closing, created, closingMonth, closingYear, isB2B });
  });

  return result;
}

function mergeCrmDeals(existing, incoming) {
  const map = {};
  existing.forEach(r => { map[r.id] = r; });
  incoming.forEach(r => { map[r.id] = r; });
  return Object.values(map);
}
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const libsReady=useLibsReady();
  const[darkMode,setDarkMode]=useState(()=>lsGet("wo_dark",false));
  C=darkMode?THEMES.dark:THEMES.light;

  const[page,setPage]=useState("home");
  const[files,setFiles]=useState({meta:[],linkedin:[],google:[]});
  const[submitting,setSub]=useState(false);
  const[submitted,setDone]=useState(false);
  const[error,setError]=useState(null);
  const[debug,setDebug]=useState(null);
  const[clearConfirm,setClearConfirm]=useState(false);
  const[histClearConfirm,setHistClearConfirm]=useState(false);
  const[exportOpen,setExportOpen]=useState(false);

  // ── Live data (ad spend) ──────────────────────────────────────────────────
  const[liveData,setLive]=useState(()=>lsGet("wo_liveData",EMPTY_LIVE));
  const[folders,setFolders]=useState(()=>lsGet("wo_folders",[]));
  useEffect(()=>{ lsSave("wo_liveData",liveData); },[liveData]);
  useEffect(()=>{ lsSave("wo_folders",folders); },[folders]);

  // ── Ad spend UI state ─────────────────────────────────────────────────────
  const[activeChan,setActiveChan]=useState("all");
  const[budgetGoal,setBudgetGoal]=useState("");
  const[budgetUsed,setBudgetUsed]=useState(null);
  const[revPerLead,setRevPerLead]=useState("");

  // ── Estimate state ────────────────────────────────────────────────────────
  const[estBudget,setEstBudget]=useState("");
  const[estLeads,setEstLeads]=useState("");
  const[estResult,setEstResult]=useState(null);
  useEffect(()=>{ lsSave("wo_dark",darkMode); },[darkMode]);

  // ── Invoice state ────────────────────────────────────────────────────────────
  const[invoiceData,setInvoiceData]=useState(()=>lsGet("wo_invoices",EMPTY_INV));
  const[invoiceFiles,setInvoiceFiles]=useState([]);
  const[invSub,setInvSub]=useState(false);
  const[invDone,setInvDone]=useState(false);
  const[invError,setInvError]=useState(null);
  const[invDebug,setInvDebug]=useState(null);
  useEffect(()=>{ lsSave("wo_invoices",invoiceData); },[invoiceData]);

  // ── CRM state ────────────────────────────────────────────────────────────────
  const[crmData,setCrmData]=useState(()=>lsGet("wo_crm",EMPTY_CRM));
  const[crmFiles,setCrmFiles]=useState([]);
  const[crmSub,setCrmSub]=useState(false);
  const[crmDone,setCrmDone]=useState(false);
  const[crmError,setCrmError]=useState(null);
  const[crmDebug,setCrmDebug]=useState(null);
  const[selectedOwner,setSelectedOwner]=useState(null);
  useEffect(()=>{ lsSave("wo_crm",crmData); },[crmData]);

  // ── Date filter states ────────────────────────────────────────────────────────
  const[ovFrom,setOvFrom]=useState("");
  const[ovTo,setOvTo]=useState("");
  const[crmFromDate,setCrmFromDate]=useState("");
  const[crmToDate,setCrmToDate]=useState("");
  const[crmAppliedFrom,setCrmAppliedFrom]=useState("");
  const[crmAppliedTo,setCrmAppliedTo]=useState("");
  const[invFromDate,setInvFromDate]=useState("");
  const[invToDate,setInvToDate]=useState("");
  const[adsFromDate,setAdsFromDate]=useState("");
  const[adsToDate,setAdsToDate]=useState("");

  // ── Zoho Live Sync ─────────────────────────────────────────────────────────
  const[zohoSyncing,setZohoSyncing]=useState(false);
  const[zohoSyncStatus,setZohoSyncStatus]=useState(null); // null | 'success' | 'error'
  const[zohoLastSync,setZohoLastSync]=useState(()=>lsGet("wo_last_sync",null));
  useEffect(()=>{ lsSave("wo_last_sync",zohoLastSync); },[zohoLastSync]);

  // ── Auto-sync on page load ─────────────────────────────────────────────────
  useEffect(()=>{
    // Only auto-sync if we haven't synced in the last 30 minutes
    const lastSyncTime = lsGet("wo_last_sync_ts", 0);
    const twelveHours = 12 * 60 * 60 * 1000;
    if(Date.now() - lastSyncTime > twelveHours) {
      // Small delay so the page renders first before hitting the API
      setTimeout(() => syncZoho(), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const syncZoho = async () => {
    setZohoSyncing(true); setZohoSyncStatus(null);
    const results = [];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const parseDate = s => {
      if(!s) return '';
      const m1 = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if(m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
      const m2 = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(m2) return s.slice(0,10);
      return '';
    };
    const parseAmt = s => {
      if(!s) return 0;
      const clean = String(s).replace(/[$₹£€]|\bUSD\b|\bINR\b/gi,'').replace(/,/g,'').trim();
      return parseFloat(clean)||0;
    };
    const smartParseNum = v => {
      if(v===undefined||v===null||v==='') return 0;
      return parseFloat(String(v).replace(/[$₹£€]|\bUSD\b|\bINR\b/gi,'').replace(/,/g,'').trim())||0;
    };
    const findCol = (row, ...candidates) => {
      const keys = Object.keys(row).map(k=>k.toLowerCase().trim());
      for(const c of candidates){
        const idx = keys.indexOf(c.toLowerCase().trim());
        if(idx>=0) return Object.keys(row)[idx];
      }
      for(const c of candidates){
        const idx = keys.findIndex(k=>k.includes(c.toLowerCase().trim()));
        if(idx>=0) return Object.keys(row)[idx];
      }
      return null;
    };
    const parseAdsRows = (rows, spendCols, clickCols, impressionCols, leadCols, dateCols) => {
      if(!rows.length) return [];
      const sample = rows[0];
      const dateCol  = findCol(sample, ...dateCols);
      const spendCol = findCol(sample, ...spendCols);
      const clickCol = findCol(sample, ...clickCols);
      const imprCol  = findCol(sample, ...impressionCols);
      const leadCol  = findCol(sample, ...leadCols);

      // Strip ALL currency symbols — $, ₹, £, €, "INR ", "USD " — treat everything as INR
      const stripCurrency = v => {
        if(v===undefined||v===null||v==='') return 0;
        const clean = String(v)
          .replace(/\bINR\b|\bUSD\b|\bEUR\b/gi, '')  // word-level currency codes
          .replace(/[$₹£€]/g, '')                     // currency symbols
          .replace(/%/g, '')                           // percent signs
          .replace(/,/g, '')                           // commas
          .trim();
        return parseFloat(clean)||0;
      };

      const byMonth = {};
      rows.forEach(r => {
        const dateRaw  = dateCol ? r[dateCol] : '';
        const normDate = parseDate(String(dateRaw||''));
        const mi = normDate.length>=7 ? parseInt(normDate.slice(5,7),10)-1 : -1;
        if(mi<0||mi>11) return;
        const month = MONTHS[mi];
        const yearMonth = normDate.slice(0,7);
        if(!byMonth[yearMonth]) byMonth[yearMonth]={month,yearMonth,spend:0,impressions:0,clicks:0,leads:0,reach:0};
        // Spend: strip all currency symbols, treat as INR
        byMonth[yearMonth].spend       += spendCol ? stripCurrency(r[spendCol]) : 0;
        // Other metrics: plain numbers only
        byMonth[yearMonth].impressions += imprCol  ? (parseFloat(String(r[imprCol]||'').replace(/,/g,''))||0) : 0;
        byMonth[yearMonth].clicks      += clickCol ? (parseFloat(String(r[clickCol]||'').replace(/,/g,''))||0) : 0;
        byMonth[yearMonth].leads       += leadCol  ? (parseFloat(String(r[leadCol]||'').replace(/,/g,''))||0) : 0;
      });
      const result = Object.values(byMonth).sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth));
      // Compute derived metrics per month
      result.forEach(m => {
        m.cpl = m.leads>0 ? Math.round(m.spend/m.leads) : 0;
        m.ctr = m.impressions>0 ? parseFloat(((m.clicks/m.impressions)*100).toFixed(2)) : 0;
        m.cpc = m.clicks>0 ? Math.round(m.spend/m.clicks) : 0;
      });
      return result;
    };

    try {
      // ── ONE API call — ONE token refresh — all 5 sources ─────────────────
      const resp = await fetch('/api/zoho?source=all');
      const json = await resp.json();
      if(!json.success) throw new Error(json.error || 'Sync failed');

      // ── Parse CRM ──────────────────────────────────────────────────────────
      if(json.crm?.data?.length) {
        const rows = json.crm.data;
        const seen = new Set();
        const parsed = rows.map(d => {
          const id = d['Id'] || `crm_${Math.random()}`;
          if(seen.has(id)) return null; seen.add(id);
          const type    = d['Deal Type - B2B B2C etc'] || '';
          const stage   = d['Stage'] || '';
          const owner   = d['Deal Owner Name'] || '';
          const amount  = parseAmt(d['Amount'] || '0');
          const closing = parseDate(d['Closing Date'] || '');
          const created = parseDate(d['Created Time'] || '');
          const isB2B   = /^B2B/i.test(type);
          let stageClass;
          if(stage==='Closed Won') stageClass='closedWon';
          else if(stage==='Closed Lost (Internal Issues FA)') stageClass='lostFA';
          else if(stage==='Closed Lost') stageClass='closedLost';
          else stageClass='active';
          let closingMonth=null, closingYear=null;
          if(closing&&closing.length>=7){
            const mi=parseInt(closing.slice(5,7),10)-1;
            if(mi>=0&&mi<=11){closingMonth=MONTHS[mi]; closingYear=parseInt(closing.slice(0,4),10);}
          }
          return {id, name:d['Deal Name']||'', account:d['Account Name']||'', type, stage, stageClass, owner, amount, closing, created, closingMonth, closingYear, isB2B};
        }).filter(Boolean);
        setCrmData(parsed);
        results.push(`✅ CRM: ${parsed.length} deals`);
      } else results.push(`⚠️ CRM: ${json.crm?.count===0?'no data':'failed'}`);

      // ── Parse Invoices ─────────────────────────────────────────────────────
      if(json.invoices?.data?.length) {
        const rows = json.invoices.data;
        const seen2 = new Set();
        const parsed2 = rows.map(inv => {
          const invNum = inv['Invoice Number'] || '';
          if(!invNum||seen2.has(invNum)) return null; seen2.add(invNum);
          const statusRaw = (inv['Invoice Status']||inv['Status']||'').toLowerCase().trim();
          const status = statusRaw==='closed'?'Closed':statusRaw==='overdue'?'Overdue':null;
          if(!status) return null;
          const bizType = (inv['Business Type']||'').trim();
          if(/^grant/i.test(bizType)||bizType.length<2) return null;
          const subtotal = parseAmt(inv['Sub Total (BCY)']||inv['SubTotal']||'0');
          const balance  = parseAmt(inv['Balance (BCY)']||inv['Balance']||'0');
          const customer = inv['Customer ID']||'';
          const dateStr  = (inv['Invoice Date']||'').split(' ')[0];
          const normDate = parseDate(dateStr);
          const yearMonth = normDate.slice(0,7)||'—';
          let month='—';
          if(normDate.length>=7){const mi=parseInt(normDate.slice(5,7),10)-1; if(mi>=0&&mi<=11) month=MONTHS[mi];}
          return {invoiceNumber:invNum,month,yearMonth,status,businessType:bizType,subtotal,balance,customer};
        }).filter(Boolean);
        setInvoiceData(parsed2);
        results.push(`✅ Invoices: ${parsed2.length}`);
      } else results.push(`⚠️ Invoices: ${json.invoices?.count===0?'no data':'failed'}`);

      // ── Parse Meta ─────────────────────────────────────────────────────────
      // Exact columns: Reporting Starts, Amount Spent ($=INR), Clicks (All), Impressions, Leads (Form)/Leads
      if(json.meta?.data?.length) {
        const monthly = parseAdsRows(json.meta.data,
          ['Amount Spent'],                                    // spend: $45.66 = INR
          ['Clicks (All)', 'Link Clicks', 'Clicks'],           // clicks: plain number
          ['Impressions'],                                     // impressions: plain number
          ['Leads (Form)', 'Leads', 'Results'],                // leads: plain number
          ['Reporting Starts', 'Reporting Ends', 'Date']);
        if(monthly.length>0){ setLive(prev=>({...prev,meta:monthly})); results.push(`✅ Meta: ${monthly.length} months · ₹${monthly.reduce((s,r)=>s+r.spend,0).toLocaleString('en-IN')}`); }
        else results.push(`⚠️ Meta: 0 months — check columns`);
      } else results.push(`⚠️ Meta: no data`);

      // ── Parse LinkedIn ─────────────────────────────────────────────────────
      // Exact columns: Date, Cost In Local Currency (INR 1141.94), Clicks, Impressions, One Click Leads
      if(json.linkedin?.data?.length) {
        const monthly = parseAdsRows(json.linkedin.data,
          ['Cost In Local Currency', 'Cost In Usd', 'Total Spent'], // spend: "INR 1,141.94"
          ['Clicks', 'Card Clicks', 'Action Clicks'],                 // clicks: plain number
          ['Impressions', 'Card Impressions'],                        // impressions: plain number
          ['One Click Leads', 'Leads', 'External Website Conversions'],
          ['Date']);
        if(monthly.length>0){ setLive(prev=>({...prev,linkedin:monthly})); results.push(`✅ LinkedIn: ${monthly.length} months · ₹${monthly.reduce((s,r)=>s+r.spend,0).toLocaleString('en-IN')}`); }
        else results.push(`⚠️ LinkedIn: 0 months — check columns`);
      } else results.push(`⚠️ LinkedIn: no data`);

      // ── Parse Google ───────────────────────────────────────────────────────
      // Exact columns: Day (YYYY-MM-DD), Costs ($=INR), Clicks, Impressions, Conversions
      if(json.google?.data?.length) {
        const monthly = parseAdsRows(json.google.data,
          ['Costs'],                                           // spend: $225.49 = INR
          ['Clicks', 'Interactions'],                         // clicks: plain number
          ['Impressions'],                                     // impressions: plain number
          ['Conversions', 'All Conversions'],                  // leads: plain decimal
          ['Day']);
        if(monthly.length>0){ setLive(prev=>({...prev,google:monthly})); results.push(`✅ Google: ${monthly.length} months · ₹${monthly.reduce((s,r)=>s+r.spend,0).toLocaleString('en-IN')}`); }
        else results.push(`⚠️ Google: 0 months — check columns`);
      } else results.push(`⚠️ Google: no data`);

      setZohoLastSync(new Date().toLocaleString('en-IN'));
      lsSave("wo_last_sync_ts", Date.now());
      setZohoSyncStatus(results.join(' · '));
    } catch(err) {
      setZohoSyncStatus('❌ ' + err.message);
    } finally {
      setZohoSyncing(false);
    }
  };;

  const hasFiles=files.meta.length>0||files.linkedin.length>0||files.google.length>0; // legacy upload
  const fileCount=files.meta.length+files.linkedin.length+files.google.length;

  // ── Invoice submit ───────────────────────────────────────────────────────────
  const handleInvoiceSubmit = async () => {
    if(!invoiceFiles.length) return;
    setInvSub(true); setInvError(null); setInvDebug(null);
    try {
      let allParsed = [];
      const dbg = [];
      const errors = [];
      let totalRaw = 0; // rows across all files before dedup

      for(const file of invoiceFiles) {
        try {
          const {rows, encoding} = await readFileToRows(file);
          if(!rows||!rows.length){ errors.push(`⚠️ ${file.name} — no rows found`); continue; }
          const parsed = parseInvoiceFile(rows);
          if(!parsed.length){ errors.push(`⚠️ ${file.name} — no Closed/Overdue invoices found (check CF.Business Type + Invoice Status columns)`); continue; }
          totalRaw += parsed.length;
          allParsed = [...allParsed, ...parsed];
          const invB2B = parsed.filter(r=>/^B2B/i.test(r.businessType));
          const invD2C = parsed.filter(r=>/^(D2C|B2C)/i.test(r.businessType));
          const ymRange = [...new Set(parsed.map(r=>r.yearMonth).filter(Boolean))].sort();
          dbg.push(`✓ ${file.name} (${encoding})\n  ${parsed.length} invoices | B2B: ${invB2B.length} ₹${invB2B.reduce((s,r)=>s+r.subtotal,0).toLocaleString('en-IN')} | D2C: ${invD2C.length} ₹${invD2C.reduce((s,r)=>s+r.subtotal,0).toLocaleString('en-IN')}\n  Period: ${ymRange[0]||'?'} → ${ymRange[ymRange.length-1]||'?'}`);
        } catch(fileErr) {
          errors.push(`⚠️ ${file.name} — ${fileErr.message}`);
        }
      }

      if(!allParsed.length) throw new Error(`No valid invoices found across ${invoiceFiles.length} file(s).\n${errors.join('\n')}`);

      // Cross-file dedup by Invoice Number — mergeInvoices uses invoiceNumber as key
      const merged = mergeInvoices([], allParsed);
      const dupsRemoved = totalRaw - merged.length;

      // Merge with existing stored data
      const final = mergeInvoices(invoiceData, merged);
      const newAdded = final.length - invoiceData.length;

      const ymAll = [...new Set(final.map(r=>r.yearMonth).filter(Boolean))].sort();
      dbg.push(`\n📊 SUMMARY\n  Files processed: ${invoiceFiles.length - errors.length}/${invoiceFiles.length}\n  Raw rows across all files: ${totalRaw}\n  Duplicates removed: ${dupsRemoved}\n  New invoices added: ${newAdded > 0 ? newAdded : 0}\n  Total stored: ${final.length}\n  Full period: ${ymAll[0]||'?'} → ${ymAll[ymAll.length-1]||'?'}`);
      if(errors.length) dbg.push(`\n⚠️ ${errors.length} file(s) skipped:\n${errors.join('\n')}`);

      setInvoiceData(final);
      setInvDebug(dbg.join('\n'));
      setInvDone(true); setInvoiceFiles([]);
      setTimeout(()=>{ setInvDone(false); setPage("invoices"); }, 900);
    } catch(err) { setInvError(err.message); console.error(err); }
    finally { setInvSub(false); }
  };

  // ── CRM submit ──────────────────────────────────────────────────────────────
  const handleCrmSubmit = async () => {
    if(!crmFiles.length) return;
    setCrmSub(true); setCrmError(null); setCrmDebug(null);
    try {
      let allParsed = [];
      const dbg = [];
      const errors = [];
      let totalRaw = 0;
      for(const file of crmFiles) {
        try {
          const {rows, encoding} = await readFileToRows(file);
          if(!rows||!rows.length){ errors.push(`⚠️ ${file.name} — no rows`); continue; }
          const headers = Object.keys(rows[0]||{});
          const Cols = smartFindCol(headers, rows);
          const parsed = parseCrmFile(rows);
          if(!parsed.length){ errors.push(`⚠️ ${file.name} — no deals found (type col: ${Cols.type||'missing'})`); continue; }
          totalRaw += parsed.length;
          allParsed = [...allParsed, ...parsed];
          const b2b=parsed.filter(r=>r.isB2B).length;
          const won=parsed.filter(r=>r.stageClass==="closedWon").length;
          const fa=parsed.filter(r=>r.stageClass==="lostFA").length;
          const lost=parsed.filter(r=>r.stageClass==="closedLost").length;
          const act=parsed.filter(r=>r.stageClass==="active").length;
          const types=[...new Set(parsed.slice(0,15).map(r=>r.type).filter(Boolean))].slice(0,4).join(", ");
          dbg.push(`✓ ${file.name} (${encoding})\n  ${parsed.length} deals | B2B: ${b2b} | Won: ${won} | FA: ${fa} | Lost: ${lost} | Active: ${act}\n  type col: ${Cols.type||"⚠️ missing"} | Types: ${types||"⚠️ none"}`);
        } catch(e){ errors.push(`⚠️ ${file.name} — ${e.message}`); }
      }
      if(!allParsed.length) throw new Error(`No deals parsed from ${crmFiles.length} file(s).\n${errors.join("\n")}`);
      // Cross-file dedup by Record Id
      const seen=new Set();
      const deduped=allParsed.filter(r=>{ if(seen.has(r.id)) return false; seen.add(r.id); return true; });
      dbg.push(`\n📊 SUMMARY\n  Files: ${crmFiles.length-errors.length}/${crmFiles.length} | Raw rows: ${totalRaw} | Duplicates removed: ${totalRaw-deduped.length} | Unique deals: ${deduped.length}\n  B2B: ${deduped.filter(r=>r.isB2B).length} | Others: ${deduped.filter(r=>!r.isB2B).length}`);
      if(errors.length) dbg.push(`\n⚠️ Skipped:\n${errors.join("\n")}`);
      setCrmData(deduped);
      setCrmDebug(dbg.join("\n")); setCrmDone(true); setCrmFiles([]);
      setTimeout(()=>{ setCrmDone(false); setPage("crm"); }, 900);
    } catch(err){ setCrmError(err.message); console.error(err); }
    finally{ setCrmSub(false); }
  };

  // ── Estimate calculator (uses historical ads + CRM data) ─────────────────
  const runEstimate = () => {
    const budget = parseFloat(estBudget);
    const leadTarget = parseFloat(estLeads);
    if(!budget||!leadTarget) return;
    const allMonths = [...new Set([...liveData.meta,...liveData.linkedin,...liveData.google].map(d=>d.month))];
    const n = allMonths.length||1;
    // Historical averages per channel
    const metaAvg  = { spend: liveData.meta.reduce((s,r)=>s+r.spend,0)/n, leads: liveData.meta.reduce((s,r)=>s+r.leads,0)/n };
    const liAvg    = { spend: liveData.linkedin.reduce((s,r)=>s+r.spend,0)/n, leads: liveData.linkedin.reduce((s,r)=>s+r.leads,0)/n };
    const gAvg     = { spend: liveData.google.reduce((s,r)=>s+r.spend,0)/n, leads: liveData.google.reduce((s,r)=>s+r.leads,0)/n };
    const totalHistSpend = metaAvg.spend+liAvg.spend+gAvg.spend||1;
    // Historical spend ratios
    const metaRatio = metaAvg.spend/totalHistSpend||0.5;
    const liRatio   = liAvg.spend/totalHistSpend||0.3;
    const gRatio    = gAvg.spend/totalHistSpend||0.2;
    // CPL per channel (historical)
    const metaCPL  = metaAvg.leads>0?metaAvg.spend/metaAvg.leads:0;
    const liCPL    = liAvg.leads>0?liAvg.spend/liAvg.leads:0;
    const gCPL     = gAvg.leads>0?gAvg.spend/gAvg.leads:0;
    // CRM win rate
    const wonDeals = crmData.filter(r=>r.stageClass==="closedWon").length;
    const totalDeals = crmData.length||1;
    const winRate = wonDeals/totalDeals;
    // Budget split
    const metaBudget = Math.round(budget*metaRatio);
    const liBudget   = Math.round(budget*liRatio);
    const gBudget    = budget-metaBudget-liBudget;
    // Expected leads
    const metaLeads  = metaCPL>0?Math.round(metaBudget/metaCPL):Math.round(leadTarget*metaRatio);
    const liLeads    = liCPL>0?Math.round(liBudget/liCPL):Math.round(leadTarget*liRatio);
    const gLeads     = gCPL>0?Math.round(gBudget/gCPL):Math.round(leadTarget*gRatio);
    const totalLeads = metaLeads+liLeads+gLeads;
    setEstResult({
      budget, leadTarget, metaBudget, liBudget, gBudget,
      metaLeads, liLeads, gLeads, totalLeads,
      metaCPL:metaCPL?Math.round(metaCPL):null,
      liCPL:liCPL?Math.round(liCPL):null,
      gCPL:gCPL?Math.round(gCPL):null,
      winRate:parseFloat((winRate*100).toFixed(1)),
      expectedWins:Math.round(totalLeads*winRate),
      hasHistory: totalHistSpend>1,
    });
  };

  // ── Computed aggregates (ads) ─────────────────────────────────────────────
  const avail=[...new Set([...liveData.meta,...liveData.linkedin,...liveData.google].map(d=>d.yearMonth||d.month).filter(Boolean))].sort();
  const selMonths = useMemo(()=>{
    // Default: last 3 months when no filter set
    const now = new Date();
    const defTo   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const defFrom = `${now.getFullYear()}-${String(now.getMonth()-1).padStart(2,'0')}`;
    const from = adsFromDate ? adsFromDate.slice(0,7) : (avail.length ? avail.slice(-3)[0] : defFrom);
    const to   = adsToDate   ? adsToDate.slice(0,7)   : defTo;
    return avail.filter(m=>{
      if(m<from) return false;
      if(m>to) return false;
      return true;
    });
  },[adsFromDate,adsToDate,avail]);

  const inSel=m=>selMonths.length===0||selMonths.includes(m);
  const prevMonth=m=>{ if(!m) return null; const [y,mo]=m.split('-').map(Number); const pm=mo===1?12:mo-1; const py=mo===1?y-1:y; return `${py}-${String(pm).padStart(2,'0')}`; };

  const md=liveData.meta.filter(d=>inSel(d.yearMonth||d.month));
  const ld=liveData.linkedin.filter(d=>inSel(d.yearMonth||d.month));
  const gd=liveData.google.filter(d=>inSel(d.yearMonth||d.month));
  const agg=arr=>arr.reduce((a,r)=>({spend:a.spend+r.spend,leads:a.leads+r.leads,clicks:a.clicks+r.clicks,impressions:a.impressions+r.impressions,reach:a.reach+(r.reach||0)}),{spend:0,leads:0,clicks:0,impressions:0,reach:0});
  const mAgg=agg(md); const lAgg=agg(ld); const gAgg=agg(gd);
  const tSpend=mAgg.spend+lAgg.spend+gAgg.spend;
  const tLeads=mAgg.leads+lAgg.leads+gAgg.leads;
  const tClicks=mAgg.clicks+lAgg.clicks+gAgg.clicks;
  const tImpr=mAgg.impressions+lAgg.impressions+gAgg.impressions;
  const bCPL=tLeads>0?Math.round(tSpend/tLeads):0;
  const bCTR=tImpr>0?parseFloat(((tClicks/tImpr)*100).toFixed(2)):0;
  const bCPC=tClicks>0?Math.round(tSpend/tClicks):0;
  // Use yearMonth ("2026-01") as the canonical key — preserves year context
  const allM=[...new Set([...md,...ld,...gd].map(r=>r.yearMonth||r.month))].sort();
  const ymLabel = ym => { // "2026-01" → "Jan 2026"
    if(!ym||!ym.includes('-')) return ym;
    const [y,mo]=ym.split('-'); const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(mo,10)-1]} ${y}`;
  };
  const prevMonths=selMonths.length?selMonths.map(m=>prevMonth(m)).filter(Boolean):avail.slice(0,-1);
  const pInSel=m=>prevMonths.includes(m);
  const pmd=liveData.meta.filter(d=>pInSel(d.yearMonth||d.month));
  const pld=liveData.linkedin.filter(d=>pInSel(d.yearMonth||d.month));
  const pgd=liveData.google.filter(d=>pInSel(d.yearMonth||d.month));
  const pAgg=agg([...pmd,...pld,...pgd]);
  const prevSpend=pAgg.spend; const prevLeads=pAgg.leads; const prevCPL=pAgg.leads>0?Math.round(pAgg.spend/pAgg.leads):0;
  const hasLive=liveData.meta.length>0||liveData.linkedin.length>0||liveData.google.length>0;
  const pieData=[{name:"Meta",value:mAgg.spend,color:C.meta},{name:"LinkedIn",value:lAgg.spend,color:C.li},{name:"Google",value:gAgg.spend,color:C.google}].filter(p=>p.value>0);

  const findM = (arr,ym) => arr.find(d=>(d.yearMonth||d.month)===ym);
  const cplData=allM.map(m=>({month:ymLabel(m),Meta:findM(md,m)?.cpl||0,LinkedIn:findM(ld,m)?.cpl||0,Google:findM(gd,m)?.cpl||0}));
  const ctrData=allM.map(m=>({month:ymLabel(m),Meta:findM(md,m)?.ctr||0,LinkedIn:findM(ld,m)?.ctr||0,Google:findM(gd,m)?.ctr||0}));
  const barData=allM.map(m=>({month:ymLabel(m),Meta:findM(md,m)?.spend||0,LinkedIn:findM(ld,m)?.spend||0,Google:findM(gd,m)?.spend||0}));
  const roasLabel = activeChan==="all"?"Blended ROAS":`${activeChan} ROAS`;
  const allCampaigns = [...(liveData.metaCamp||[]).map(c=>({...c,source:"Meta"})),...(liveData.linkedinCamp||[]).map(c=>({...c,source:"LinkedIn"})),...(liveData.googleCamp||[]).map(c=>({...c,source:"Google"}))].filter(c=>activeChan==="all"||c.source===activeChan).sort((a,b)=>b.spend-a.spend).slice(0,10);
  const chanEfficiency=[
    (activeChan==="all"||activeChan==="Meta")     && liveData.meta.length>0     && {ch:"Meta",    color:C.meta,   spend:mAgg.spend, leads:mAgg.leads, cpl:mAgg.leads?Math.round(mAgg.spend/mAgg.leads):0,     ctr:mAgg.impressions?parseFloat(((mAgg.clicks/mAgg.impressions)*100).toFixed(2)):0, cpc:mAgg.clicks?Math.round(mAgg.spend/mAgg.clicks):0},
    (activeChan==="all"||activeChan==="LinkedIn") && liveData.linkedin.length>0 && {ch:"LinkedIn", color:C.li,     spend:lAgg.spend, leads:lAgg.leads, cpl:lAgg.leads?Math.round(lAgg.spend/lAgg.leads):0,     ctr:lAgg.impressions?parseFloat(((lAgg.clicks/lAgg.impressions)*100).toFixed(2)):0, cpc:lAgg.clicks?Math.round(lAgg.spend/lAgg.clicks):0},
    (activeChan==="all"||activeChan==="Google")   && liveData.google.length>0   && {ch:"Google",   color:C.google, spend:gAgg.spend, leads:gAgg.leads, cpl:gAgg.leads?Math.round(gAgg.spend/gAgg.leads):0,     ctr:gAgg.impressions?parseFloat(((gAgg.clicks/gAgg.impressions)*100).toFixed(2)):0, cpc:gAgg.clicks?Math.round(gAgg.spend/gAgg.clicks):0},
  ].filter(Boolean).sort((a,b)=>a.cpl&&b.cpl?a.cpl-b.cpl:a.cpl?-1:1);

  // ── Invoice aggregates ────────────────────────────────────────────────────
  const invInSel = invoiceData.filter(r=>selMonths.length===0||selMonths.includes(r.yearMonth||r.month));
  const totalB2BRevenue = invInSel.filter(r=>/^B2B/i.test(r.businessType||r.type||"")).reduce((s,r)=>s+r.subtotal,0);
  const revenueROAS = totalB2BRevenue>0&&tSpend>0 ? parseFloat((totalB2BRevenue/tSpend).toFixed(2)) : 0;
  const hasRevROAS = totalB2BRevenue>0&&tSpend>0;
  const allMonthsUnion=[...new Set([...allM,...invoiceData.map(r=>r.yearMonth).filter(m=>m&&m!=="—")])].filter(m=>inSel(m)).sort();
  const monthlyRevSpend=allMonthsUnion.map(ym=>({
    month:ymLabel(ym),
    yearMonth:ym,
    revenue:invoiceData.filter(r=>r.yearMonth===ym).reduce((s,r)=>s+r.subtotal,0),
    spend:(findM(md,ym)||{spend:0}).spend+(findM(ld,ym)||{spend:0}).spend+(findM(gd,ym)||{spend:0}).spend,
    roas:0,
  })).map(r=>({...r,roas:r.revenue>0&&r.spend>0?parseFloat((r.revenue/r.spend).toFixed(2)):0})).filter(r=>r.revenue>0||r.spend>0);

  const NAV=[
    {id:"home",    icon:"⬡",  label:"Overview"},
    {id:"ads",     icon:"📊", label:"Ad Spend"},
    {id:"crm",     icon:"◈",  label:"CRM"},
    {id:"invoices",icon:"₹",  label:"Invoices"},
    {id:"estimate",icon:"◎",  label:"Estimate"},
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter','Barlow','Helvetica Neue',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}
        .nb{transition:all .18s;border-radius:8px!important;}.nb:hover{background:${C.cardAlt}!important;}
        .nb.on{background:${C.primary}!important;color:${C.primaryText}!important;}
        .fb{transition:all .15s;cursor:pointer;}.fb:hover{border-color:${C.primary}!important;color:${C.primary}!important;}
        .fb.on{background:${C.primary}!important;border-color:${C.primary}!important;color:#fff!important;font-weight:700!important;}
        .cb{transition:all .12s;cursor:pointer;}.cb:hover{border-color:${C.primary}60!important;}
        .cb.on{background:${C.primary}!important;border-color:${C.primary}!important;color:#fff!important;font-weight:700!important;}
        .tr{transition:background .12s;}.tr:hover{background:${C.cardAlt};}
        .card-hover{transition:all .2s;}.card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(45,45,78,0.12)!important;}
        .sub-btn{transition:all .18s;}.sub-btn:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px);}.sub-btn:disabled{opacity:0.45;cursor:not-allowed;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .pill{border-radius:100px!important;}
        input[type=date]{color-scheme:${darkMode?'dark':'light'};}
        table thead tr{background:${C.cardAlt};}
        table thead th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};padding:8px 12px;border-bottom:1px solid ${C.border};}
        table tbody td{padding:9px 12px;font-size:11.5px;border-bottom:1px solid ${C.border};}
        table tbody tr:last-child td{border-bottom:none;}
        .section-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(45,45,78,0.06);}
      `}</style>

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(45,45,78,0.06)"}}>
        {/* Brand row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 28px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:7,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:8,color:"#b5e550",letterSpacing:0.5}}>W/O</div>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:C.text,letterSpacing:-0.3}}>Without Growth Dashboard</div>
              <div style={{fontSize:11,color:C.muted}}>Live · {timeStr}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {hasFiles&&<span style={{fontSize:11,color:C.muted,background:C.cardAlt,padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`}}>{fileCount} file{fileCount!==1?"s":""} loaded</span>}
            <button onClick={()=>setDarkMode(d=>!d)} style={{background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:600,color:C.sub,cursor:"pointer"}}>{darkMode?"☀️ Light":"🌙 Dark"}</button>
          </div>
        </div>
        {/* Tab nav row */}
        <div style={{display:"flex",gap:2,padding:"8px 24px 0",overflowX:"auto"}}>
          {NAV.map(n=>(
            <button key={n.id} className={`nb${page===n.id?" on":""}`} onClick={()=>setPage(n.id)}
              style={{border:"none",borderRadius:"10px 10px 0 0",padding:"8px 18px",fontSize:12.5,fontWeight:600,cursor:"pointer",
                background:page===n.id?C.primary:C.navBg,
                color:page===n.id?"#fff":C.muted,
                borderBottom:page===n.id?`2px solid ${C.primary}`:"2px solid transparent",
                whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,
                transition:"all .15s",position:"relative"}}>
              <span style={{fontSize:13}}>{n.icon}</span>
              <span>{n.label}</span>
              {n.id==="upload"&&hasFiles&&<span style={{width:16,height:16,borderRadius:"50%",background:C.accent,color:"#fff",fontSize:8,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{fileCount}</span>}
            </button>
          ))}
        </div>
      </header>

      <main style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"24px 28px 56px",minWidth:0,animation:"fadeIn .3s ease"}}>

        {/* ══ HOME ══════════════════════════════════════════════════════════ */}
        {page==="home"&&(()=>{
          // ── Overview date filter ─────────────────────────────────────────────
          // Default to last 3 months when no date filter set
          const now3 = new Date();
          const defTo   = now3.toISOString().slice(0,10);
          const defFrom3 = new Date(now3.getFullYear(), now3.getMonth()-2, 1).toISOString().slice(0,10);
          const activeFrom = ovFrom || defFrom3;
          const activeTo   = ovTo   || defTo;
          const inOvRange = dateStr => {
            if(!dateStr) return false;
            const d = dateStr.slice(0,10);
            if(d < activeFrom) return false;
            if(d > activeTo)   return false;
            return true;
          };

          // ── Invoice revenue filtered by overview date ─────────────────────────
          // B2B ROAS = B2B Invoice Revenue (Closed+Overdue, type starts "B2B") / Total Ad Spend
          const isB2BInv = bt => /^B2B/i.test(bt||"");
          const isD2CInv = bt => /^(D2C|B2C)/i.test(bt||"") && !/^B2B/i.test(bt||"");

          const b2bRevHome = invoiceData
            .filter(r => isB2BInv(r.businessType||r.type||""))
            .filter(r => ["Closed","Overdue"].includes(r.status))
            .filter(r => inOvRange(r.yearMonth ? r.yearMonth+"-01" : null))
            .reduce((s,r) => s+r.subtotal, 0);

          const d2cRevHome = invoiceData
            .filter(r => isD2CInv(r.businessType||r.type||""))
            .filter(r => ["Closed","Overdue"].includes(r.status))
            .filter(r => inOvRange(r.yearMonth ? r.yearMonth+"-01" : null))
            .reduce((s,r) => s+r.subtotal, 0);

          // ── CRM filtered by overview date (closing date) ──────────────────────
          const crmB2BWon  = crmData.filter(r => r.isB2B && r.stageClass==="closedWon"  && inOvRange(r.closing));
          const crmB2BFA   = crmData.filter(r => r.isB2B && r.stageClass==="lostFA"     && inOvRange(r.closing));
          const crmB2BLost = crmData.filter(r => r.isB2B && r.stageClass==="closedLost" && inOvRange(r.closing));

          // ── ROAS formulas ─────────────────────────────────────────────────────
          // B2B ROAS = B2B Invoice Revenue / Total Ad Spend
          // D2C ROAS = D2C Invoice Revenue / Total Ad Spend
          const trueROASHome = b2bRevHome>0&&tSpend>0 ? parseFloat((b2bRevHome/tSpend).toFixed(2)) : 0;
          const d2cROAS      = d2cRevHome>0&&tSpend>0 ? parseFloat((d2cRevHome/tSpend).toFixed(2)) : 0;

          const rc=r=>r>=4?"#15803d":r>=2?C.accent:r>=1?"#d97706":r>0?C.down:C.muted;
          const kpis=[
            {label:"B2B Revenue",      val:fmtINR(b2bRevHome), primary:true, click:()=>setPage("invoices")},
            {label:"D2C Revenue",      val:fmtINR(d2cRevHome), col:"#0a66c2",click:()=>setPage("invoices")},
            {label:"Total Ad Spend",   val:fmtINR(tSpend),     col:C.primary,click:()=>setPage("ads")},
            {label:"B2B ROAS",         val:trueROASHome>0?`${trueROASHome}x`:"—", sub:trueROASHome>=4?"Excellent":trueROASHome>=2?"Good":trueROASHome>=1?"Break-even":trueROASHome>0?"Below BE":"Need invoice+ad data", col:rc(trueROASHome)},
            {label:"D2C ROAS",         val:d2cROAS>0?`${d2cROAS}x`:"—",          sub:d2cROAS>=4?"Excellent":d2cROAS>=2?"Good":d2cROAS>=1?"Break-even":d2cROAS>0?"Below BE":"Need invoice+ad data", col:rc(d2cROAS)},
            {label:"Closed Won (CRM)", val:String(crmB2BWon.length), sub:crmB2BWon.reduce((s,r)=>s+r.amount,0)>0?fmtINR(crmB2BWon.reduce((s,r)=>s+r.amount,0))+" won":"B2B · by closing date", col:"#16a34a", click:()=>setPage("crm")},
          ];
          return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>Without® · Marketing Intelligence</div>
                <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-0.5}}>Overview</h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {/* Date filter */}
                <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"5px 12px",boxShadow:"0 1px 4px rgba(45,45,78,0.06)"}}>
                  <span style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Period</span>
                  <input type="date" value={ovFrom} onChange={e=>{
                    const v=e.target.value; setOvFrom(v);
                    setAdsFromDate(v); setCrmFromDate(v); setCrmAppliedFrom(v); setInvFromDate(v);
                  }} style={{border:"none",background:"transparent",fontSize:11,color:C.text,outline:"none",cursor:"pointer",fontFamily:"inherit"}}/>
                  <span style={{fontSize:11,color:C.muted}}>–</span>
                  <input type="date" value={ovTo} onChange={e=>{
                    const v=e.target.value; setOvTo(v);
                    setAdsToDate(v); setCrmToDate(v); setCrmAppliedTo(v); setInvToDate(v);
                  }} style={{border:"none",background:"transparent",fontSize:11,color:C.text,outline:"none",cursor:"pointer",fontFamily:"inherit"}}/>
                  {(ovFrom||ovTo)&&(
                    <button onClick={()=>{
                      setOvFrom(""); setOvTo("");
                      setAdsFromDate(""); setAdsToDate("");
                      setCrmFromDate(""); setCrmToDate(""); setCrmAppliedFrom(""); setCrmAppliedTo("");
                      setInvFromDate(""); setInvToDate("");
                    }} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"0 2px",fontWeight:700}}>✕</button>
                  )}
                </div>
                {/* Last sync timestamp only */}
                {zohoLastSync&&<span style={{fontSize:10,color:C.muted}}>Last sync: {zohoLastSync}</span>}
                {/* Status dot */}
                <div style={{width:6,height:6,borderRadius:"50%",background:hasLive||invoiceData.length||crmData.length?"#22c55e":"#f59e0b"}}/>
                {/* Sync button — pushed to far right */}
                <button onClick={syncZoho} disabled={zohoSyncing}
                  style={{background:zohoSyncing?"rgba(45,45,78,0.1)":C.primary,color:zohoSyncing?C.muted:"#fff",
                    border:"none",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:zohoSyncing?"not-allowed":"pointer",
                    display:"flex",alignItems:"center",gap:5,transition:"all .2s"}}>
                  {zohoSyncing
                    ? <><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span> Syncing...</>
                    : <><span>⚡</span> Sync Now</>}
                </button>
              </div>
            </div>

            {/* 6-metric KPI row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
              {kpis.map(k=>(
                <div key={k.label} onClick={k.click}
                  style={{background:k.primary?C.primary:k.green?C.accent:C.card,
                    border:k.primary||k.green?"none":`1px solid ${C.border}`,
                    borderRadius:16,padding:"20px 22px",
                    boxShadow:k.primary?"0 4px 20px rgba(45,45,78,0.18)":"0 2px 10px rgba(45,45,78,0.06)",
                    cursor:k.click?"pointer":"default",transition:"all .2s"}}
                  onMouseEnter={e=>{if(k.click){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=k.primary?"0 8px 28px rgba(45,45,78,0.25)":"0 6px 20px rgba(45,45,78,0.1)";}}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=k.primary?"0 4px 20px rgba(45,45,78,0.18)":"0 2px 10px rgba(45,45,78,0.06)";}}>
                  <div style={{fontSize:10,color:k.primary||k.green?"rgba(255,255,255,0.6)":C.muted,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,marginBottom:6}}>{k.label}</div>
                  <div style={{fontSize:28,fontWeight:800,color:k.primary||k.green?"#fff":k.col||C.text,fontFamily:"'DM Mono',monospace",letterSpacing:-1,lineHeight:1.05}}>{k.val}</div>
                  <div style={{fontSize:11,color:k.primary||k.green?"rgba(255,255,255,0.5)":C.muted,marginTop:6}}>{k.sub}</div>
                </div>
              ))}
            </div>





            {/* Revenue vs Spend mini chart if both data available */}
            {monthlyRevSpend.length>0&&tSpend>0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text}}>Revenue vs Ad Spend</div>
                  <button onClick={()=>setPage("ads")} style={{fontSize:10,color:C.accent,fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>Full analytics →</button>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={monthlyRevSpend} barSize={10} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                    <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>fmtINR(v)} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>fmtINR(v)} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:4}}/>
                    <Bar dataKey="revenue" name="B2B Revenue" fill={C.accent} radius={[3,3,0,0]}/>
                    <Bar dataKey="spend"   name="Ad Spend"   fill={C.meta}   radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ ADS ═══════════════════════════════════════════════════════════ */}
        {page==="ads"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:"100%"}}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>Without® · Paid Media</div>
                <h1 style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:-0.5}}>Ad Spend</h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <DatePill from={adsFromDate} setFrom={setAdsFromDate} to={adsToDate} setTo={setAdsToDate}/>
                {hasLive&&(
                  <div style={{position:"relative"}}>
                    <button onClick={()=>setExportOpen(o=>!o)}
                      style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      ↓ Export <span style={{fontSize:9,color:C.muted}}>▾</span>
                    </button>
                    {exportOpen&&(
                      <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,boxShadow:"0 6px 20px rgba(0,0,0,0.1)",zIndex:99,minWidth:140,overflow:"hidden"}}
                        onMouseLeave={()=>setExportOpen(false)}>
                        {[
                          {label:"📊 Excel (.xlsx)", action:()=>{ setExportOpen(false);
                            exportToXLSX({md,ld,gd,mAgg,lAgg,gAgg,tSpend,tLeads,tClicks,tImpr,bCPL,bCTR,bCPC,allM,allCampaigns,activeChan,
                              dateLabel:adsFromDate||adsToDate?`${adsFromDate||""}→${adsToDate||""}`:"All Time",fmtINR,fmtNum}); }},
                          {label:"📄 PDF Report",    action:()=>{ setExportOpen(false);
                            exportToPDF({md,ld,gd,mAgg,lAgg,gAgg,tSpend,tLeads,tClicks,tImpr,bCPL,bCTR,bCPC,allM,allCampaigns,activeChan,
                              dateLabel:adsFromDate||adsToDate?`${adsFromDate||""}→${adsToDate||""}`:"All Time"}); }},
                        ].map(({label,action})=>(
                          <button key={label} onClick={action}
                            style={{display:"block",width:"100%",textAlign:"left",padding:"9px 14px",background:"none",border:"none",fontSize:11,fontWeight:600,color:C.text,cursor:"pointer",borderBottom:`1px solid ${C.border}`}}
                            onMouseEnter={e=>e.target.style.background=C.accentLt}
                            onMouseLeave={e=>e.target.style.background="none"}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {hasLive&&(
                  <button onClick={()=>{if(clearConfirm){setLive(EMPTY_LIVE);setFolders([]);setClearConfirm(false);}else{setClearConfirm(true);setTimeout(()=>setClearConfirm(false),3000);}}}
                    style={{background:clearConfirm?"#fef2f2":C.card,border:`1px solid ${clearConfirm?"#fca5a5":C.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,color:clearConfirm?C.down:C.muted,cursor:"pointer",transition:"all .2s"}}>
                    {clearConfirm?"Tap again to confirm":"🗑 Clear"}
                  </button>
                )}
              </div>
            </div>

            {/* Empty state */}
            {!hasLive&&(
              <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:14,padding:"52px 24px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                <div style={{fontSize:32}}>📊</div>
                <div style={{fontWeight:700,fontSize:15,color:C.text}}>No ad spend data yet</div>
                <div style={{fontSize:12.5,color:C.muted,maxWidth:400,lineHeight:1.7}}>Click <b>⚡ Sync Now</b> on the Overview tab to pull live ad spend data from Meta, LinkedIn, and Google.</div>
              </div>
            )}

            {hasLive&&(<>

              {/* ── Filter bar ─────────────────────────────────────────────── */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Channel</span>
                  {["all","Meta","LinkedIn","Google"].map(ch=>{
                    const hasData = ch==="all" || liveData[ch.toLowerCase()]?.length>0;
                    return(
                      <button key={ch} className={`cb${activeChan===ch?" on":""}`}
                        onClick={()=>setActiveChan(ch)}
                        style={{background:"none",border:`1px solid ${hasData?C.border:C.border+'55'}`,borderRadius:6,
                          color:ch==="all"?C.sub:hasData?srcColor(ch):C.muted,
                          fontSize:11,fontWeight:600,padding:"3px 11px",display:"flex",alignItems:"center",gap:4,
                          opacity:hasData?1:0.45}}>
                        {ch!=="all"&&<div style={{width:6,height:6,borderRadius:"50%",background:hasData?srcColor(ch):C.muted}}/>}
                        {ch==="all"?"All":ch}
                        {!hasData&&ch!=="all"&&<span style={{fontSize:8,color:C.muted}}> —</span>}
                      </button>
                    );
                  })}

                </div>
              </div>

              {/* ── KPI Grid ───────────────────────────────────────────────── */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                <KPI label="Total Spend"  value={fmtINR(tSpend)} icon="💸" green curr={tSpend} prev={prevSpend}/>
                {(activeChan==="all"||activeChan==="Meta")&&liveData.meta.length>0&&
                  <KPI label="Meta" value={fmtINR(mAgg.spend)} icon="Ⓜ" color={C.meta} curr={mAgg.spend} prev={pmd.reduce((s,r)=>s+r.spend,0)}/>}
                {(activeChan==="all"||activeChan==="LinkedIn")&&liveData.linkedin.length>0&&
                  <KPI label="LinkedIn" value={fmtINR(lAgg.spend)} icon="🔗" color={C.li} curr={lAgg.spend} prev={pld.reduce((s,r)=>s+r.spend,0)}/>}
                {(activeChan==="all"||activeChan==="Google")&&liveData.google.length>0&&
                  <KPI label="Google" value={fmtINR(gAgg.spend)} icon="G" color={C.google} curr={gAgg.spend} prev={pgd.reduce((s,r)=>s+r.spend,0)}/>}
                <KPI label="Total Leads"  value={tLeads?fmtNum(tLeads):"—"} icon="🎯" curr={tLeads} prev={prevLeads}/>
                <KPI label={activeChan==="all"?"Blended CPL":"CPL"} value={bCPL?`₹${bCPL}`:"—"} icon="⚡" color={C.accent} curr={bCPL} prev={prevCPL} invertDelta/>
                <KPI label="CTR" value={bCTR?`${bCTR}%`:"—"} icon="👆" curr={bCTR} prev={pAgg.impressions?parseFloat(((pAgg.clicks/pAgg.impressions)*100).toFixed(2)):0}/>
                <KPI label="Avg CPC" value={bCPC?`₹${bCPC}`:"—"} icon="🖱" color={C.sub} curr={bCPC} prev={pAgg.clicks?Math.round(pAgg.spend/pAgg.clicks):0} invertDelta/>
                <KPI label="Impressions" value={fmtNum(tImpr)} icon="👁"/>
                
              </div>

              {/* Spend Distribution */}
              <div>
                <SectionHead title="Spend Distribution"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={32} paddingAngle={3}>
                          {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmtINR(v)} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                      {pieData.map(p=>(
                        <div key={p.name} style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:C.sub,flex:1}}>{p.name}</span>
                          <span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace",color:C.text}}>{fmtINR(p.value)}</span>
                          <span style={{fontSize:10,color:C.muted,width:28,textAlign:"right"}}>{tSpend?pct(p.value,tSpend):0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Monthly Spend by Channel</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={barData} barSize={9} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                        <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>fmtINR(v)} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                        <Tooltip content={<TT/>}/>
                        <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:6}}/>
                        {liveData.meta.length>0&&md.length>0&&<Bar dataKey="Meta" fill={C.meta} radius={[3,3,0,0]}/>}
                        {liveData.linkedin.length>0&&ld.length>0&&<Bar dataKey="LinkedIn" fill={C.li} radius={[3,3,0,0]}/>}
                        {liveData.google.length>0&&gd.length>0&&<Bar dataKey="Google" fill={C.google} radius={[3,3,0,0]}/>}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Revenue ROAS */}
              {hasRevROAS&&(
                <div>
                  <SectionHead title="True ROAS — Revenue / Ad Spend" sub="from B2B invoice data"/>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
                      <div style={{background:C.accent,borderRadius:12,padding:"16px 18px",boxShadow:"0 4px 14px rgba(90,138,0,0.18)"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>True ROAS</div>
                        <div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"'DM Mono',monospace"}}>{revenueROAS}x</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:4}}>{revenueROAS>=4?"Excellent":revenueROAS>=2?"Good":revenueROAS>=1?"Break-even":"Below BE"}</div>
                      </div>
                      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"}}>
                        <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>B2B Revenue</div>
                        <div style={{fontSize:22,fontWeight:800,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{fmtINR(totalB2BRevenue)}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:4}}>{invInSel.length} invoices</div>
                      </div>
                      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"}}>
                        <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>Ad Spend</div>
                        <div style={{fontSize:22,fontWeight:800,color:C.text,fontFamily:"'DM Mono',monospace"}}>{fmtINR(tSpend)}</div>
                      </div>
                    </div>
                    {monthlyRevSpend.length>1&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 16px 12px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Monthly Revenue vs Ad Spend</div>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={monthlyRevSpend} barSize={10} barGap={3}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                              <YAxis tickFormatter={v=>fmtINR(v)} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                              <Tooltip formatter={v=>fmtINR(v)} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                              <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:6}}/>
                              <Bar dataKey="revenue" name="B2B Revenue" fill={C.accent} radius={[3,3,0,0]}/>
                              <Bar dataKey="spend" name="Ad Spend" fill={C.meta} radius={[3,3,0,0]}/>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Monthly ROAS</div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead><tr style={{background:C.cardAlt}}>
                              {["Month","Revenue","Spend","ROAS"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.muted,fontWeight:700,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {monthlyRevSpend.map(r=>(
                                <tr key={r.month} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                                  <td style={{padding:"7px 8px",fontWeight:700}}>{r.month}</td>
                                  <td style={{padding:"7px 8px",fontFamily:"'DM Mono',monospace",color:C.accent,fontWeight:600}}>{r.revenue>0?fmtINR(r.revenue):"—"}</td>
                                  <td style={{padding:"7px 8px",fontFamily:"'DM Mono',monospace",color:C.sub}}>{r.spend>0?fmtINR(r.spend):"—"}</td>
                                  <td style={{padding:"7px 8px"}}>
                                    {r.roas>0?<span style={{fontWeight:800,color:r.roas>=4?"#15803d":r.roas>=2?C.accent:r.roas>=1?"#d97706":C.down,fontFamily:"'DM Mono',monospace"}}>{r.roas}x</span>:<span style={{color:C.muted,fontSize:10}}>—</span>}
                                  </td>
                                </tr>
                              ))}
                              <tr style={{borderTop:`2px solid ${C.border}`,background:C.cardAlt}}>
                                <td style={{padding:"8px 8px",fontWeight:800}}>Total</td>
                                <td style={{padding:"8px 8px",fontFamily:"'DM Mono',monospace",fontWeight:800,color:C.accent}}>{fmtINR(totalB2BRevenue)}</td>
                                <td style={{padding:"8px 8px",fontFamily:"'DM Mono',monospace",fontWeight:800,color:C.sub}}>{fmtINR(tSpend)}</td>
                                <td style={{padding:"8px 8px"}}><span style={{fontWeight:900,fontSize:13,color:revenueROAS>=4?"#15803d":revenueROAS>=2?C.accent:revenueROAS>=1?"#d97706":C.down,fontFamily:"'DM Mono',monospace"}}>{revenueROAS}x</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Efficiency Trends */}
              <div>
                <SectionHead title="Efficiency Trends"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                  {tLeads>0&&(
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 16px 12px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Cost Per Lead — ₹</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={cplData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                          <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                          <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:6}}/>
                          {md.some(r=>r.leads>0)&&<Line dataKey="Meta" stroke={C.meta} strokeWidth={2} dot={false}/>}
                          {ld.some(r=>r.leads>0)&&<Line dataKey="LinkedIn" stroke={C.li} strokeWidth={2} dot={false}/>}
                          {gd.some(r=>r.leads>0)&&<Line dataKey="Google" stroke={C.google} strokeWidth={2} dot={false}/>}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {bCTR>0&&(
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 16px 12px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Click-Through Rate — %</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={ctrData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                          <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} unit="%"/>
                          <Tooltip contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                          <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:6}}/>
                          {md.length>0&&<Line dataKey="Meta" stroke={C.meta} strokeWidth={2} dot={false}/>}
                          {ld.length>0&&<Line dataKey="LinkedIn" stroke={C.li} strokeWidth={2} dot={false}/>}
                          {gd.length>0&&<Line dataKey="Google" stroke={C.google} strokeWidth={2} dot={false}/>}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Funnel & Channel Efficiency */}
              <div>
                <SectionHead title="Funnel & Channel Efficiency"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                  {tImpr>0&&(
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 16px 12px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:12}}>Conversion Funnel</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {[
                          {label:"Impressions",value:tImpr,color:"#bfdbfe",pct:100},
                          {label:"Clicks",value:tClicks,color:"#60a5fa",pct:tImpr?parseFloat(((tClicks/tImpr)*100).toFixed(1)):0},
                          {label:"Leads",value:tLeads,color:C.meta,pct:tImpr?parseFloat(((tLeads/tImpr)*100).toFixed(2)):0},
                        ].map((f,i,arr)=>(
                          <div key={f.label}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontSize:11,color:C.sub,fontWeight:600}}>{f.label}</span>
                              <div style={{display:"flex",gap:8}}>
                                <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtNum(f.value)}</span>
                                {i>0&&<span style={{fontSize:10,color:C.muted}}>{f.pct}%</span>}
                              </div>
                            </div>
                            <div style={{background:C.border,borderRadius:3,height:7,overflow:"hidden"}}>
                              <div style={{height:"100%",background:f.color,borderRadius:3,width:`${f.pct}%`,transition:"width .4s"}}/>
                            </div>
                            {i<arr.length-1&&<div style={{fontSize:10,color:C.muted,textAlign:"right",marginTop:2}}>↓ {arr[i+1]?.value&&f.value?(((arr[i+1].value/f.value)*100).toFixed(1)):0}% conversion</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 14px 10px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Channel Efficiency Rank <span style={{fontSize:10,color:C.muted,fontWeight:400}}>by CPL</span></div>
                    <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:400}}>
                      <thead><tr style={{background:C.cardAlt}}>
                        {["#","Channel","Spend","Leads","CPL","CTR","CPC"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.muted,fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:0.7,whiteSpace:"nowrap"}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {chanEfficiency.map((ch,i)=>(
                          <tr key={ch.ch} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                            <td style={{padding:"7px 8px",fontWeight:800,color:i===0?C.accent:C.muted,fontSize:12}}>{i+1}</td>
                            <td style={{padding:"7px 8px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:ch.color}}/><span style={{fontWeight:700,color:ch.color}}>{ch.ch}</span></div></td>
                            <td style={{padding:"7px 8px",fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtINR(ch.spend)}</td>
                            <td style={{padding:"7px 8px",color:C.sub}}>{ch.leads||"—"}</td>
                            <td style={{padding:"7px 8px"}}><span style={{background:ch.cpl>0&&ch.cpl<1000?`${C.accent}12`:ch.cpl>0?"#fef2f2":C.cardAlt,color:ch.cpl>0&&ch.cpl<1000?C.accent:ch.cpl>0?C.down:C.muted,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:"2px 6px",borderRadius:4,fontSize:10.5}}>{ch.cpl?fmtINR(ch.cpl):"—"}</span></td>
                            <td style={{padding:"7px 8px",color:C.sub}}>{ch.ctr?`${ch.ctr}%`:"—"}</td>
                            <td style={{padding:"7px 8px",fontFamily:"'DM Mono',monospace",color:C.sub}}>{ch.cpc?fmtINR(ch.cpc):"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Campaigns */}
              {allCampaigns.length>0&&(
                <div>
                  <SectionHead title="Top Campaigns" sub="by spend · max 10"/>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                    <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:520}}>
                      <thead><tr style={{background:C.cardAlt}}>
                        {["Campaign","Source","Spend","Leads","CPL","CTR","Clicks"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.muted,fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:0.7}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {allCampaigns.map((c,i)=>(
                          <tr key={i} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                            <td style={{padding:"7px 10px",maxWidth:220}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,color:C.text}}>{c.name}</div></td>
                            <td style={{padding:"7px 10px"}}><span style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,background:srcLight(c.source),color:srcColor(c.source)}}>{c.source}</span></td>
                            <td style={{padding:"7px 10px",fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtINR(c.spend)}</td>
                            <td style={{padding:"7px 10px",color:C.sub}}>{c.leads||"—"}</td>
                            <td style={{padding:"7px 10px"}}><span style={{background:c.cpl>0&&c.cpl<1000?`${C.accent}12`:c.cpl>0?"#fef2f2":C.cardAlt,color:c.cpl>0&&c.cpl<1000?C.accent:c.cpl>0?C.down:C.muted,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:"2px 6px",borderRadius:4,fontSize:10}}>{c.cpl?`₹${c.cpl}`:"—"}</span></td>
                            <td style={{padding:"7px 10px",color:C.sub}}>{c.ctr?`${c.ctr}%`:"—"}</td>
                            <td style={{padding:"7px 10px",color:C.sub}}>{fmtNum(c.clicks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Channel Summary */}
              <div>
                <SectionHead title="Full Channel Summary"/>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,tableLayout:"fixed",minWidth:560}}>
                    <thead><tr style={{background:C.cardAlt}}>
                      {["Channel","Spend","Impressions","Clicks","CTR","CPC","Leads","CPL","Reach"].map(h=>(
                        <th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.muted,fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:0.7,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {name:"Meta",color:C.meta,a:mAgg,show:liveData.meta.length>0},
                        {name:"LinkedIn",color:C.li,a:lAgg,show:liveData.linkedin.length>0},
                        {name:"Google",color:C.google,a:gAgg,show:liveData.google.length>0},
                      ].filter(c=>c.show&&(activeChan==="all"||activeChan===c.name)).map(ch=>{
                        const cpl=ch.a.leads?Math.round(ch.a.spend/ch.a.leads):0;
                        const ctr=ch.a.impressions?parseFloat(((ch.a.clicks/ch.a.impressions)*100).toFixed(2)):0;
                        const cpc=ch.a.clicks?Math.round(ch.a.spend/ch.a.clicks):0;
                        return(
                          <tr key={ch.name} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                            <td style={{padding:"8px 10px"}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:7,height:7,borderRadius:"50%",background:ch.color}}/><span style={{fontWeight:700,color:ch.color}}>{ch.name}</span></div></td>
                            <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmtINR(ch.a.spend)}</td>
                            <td style={{padding:"8px 10px",color:C.sub}}>{fmtNum(ch.a.impressions)}</td>
                            <td style={{padding:"8px 10px",color:C.sub}}>{fmtNum(ch.a.clicks)}</td>
                            <td style={{padding:"8px 10px",color:C.sub}}>{ctr?`${ctr}%`:"—"}</td>
                            <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",color:C.sub}}>{cpc?`₹${cpc}`:"—"}</td>
                            <td style={{padding:"8px 10px",color:C.sub}}>{ch.a.leads||"—"}</td>
                            <td style={{padding:"8px 10px"}}><span style={{background:cpl>0&&cpl<1000?`${C.accent}12`:cpl>0?"#fef2f2":C.cardAlt,color:cpl>0&&cpl<1000?C.accent:cpl>0?C.down:C.muted,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:"2px 7px",borderRadius:4,fontSize:10}}>{cpl?`₹${cpl}`:"—"}</span></td>
                            <td style={{padding:"8px 10px",color:C.sub}}>{ch.a.reach?fmtNum(ch.a.reach):"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

            </>)}
          </div>
        )}

        {/* ══ HISTORY ═══════════════════════════════════════════════════════ */}
        {page==="history"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>Data Archive</div>
                <h1 style={{fontSize:22,fontWeight:800,letterSpacing:-0.5}}>Upload History</h1>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:C.muted}}>{folders.length} folder{folders.length!==1?"s":""}</span>
                {folders.length>0&&(
                  <button
                    onClick={()=>{
                      if(histClearConfirm){
                        setFolders([]); setLive(EMPTY_LIVE); setInvoiceData(EMPTY_INV); setCrmData(EMPTY_CRM);
                        setHistClearConfirm(false);
                      } else {
                        setHistClearConfirm(true);
                        setTimeout(()=>setHistClearConfirm(false), 3000);
                      }
                    }}
                    style={{fontSize:11,color:histClearConfirm?"#fff":C.down,background:histClearConfirm?C.down:"none",border:`1px solid ${histClearConfirm?C.down:C.down+"40"}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontWeight:700,transition:"all .2s"}}>
                    {histClearConfirm?"⚠️ Tap again — clears ALL data":"🗑 Clear all data"}
                  </button>
                )}
              </div>
            </div>
            {folders.length===0&&(
              <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:12,padding:"48px 24px",textAlign:"center",color:C.muted,fontSize:12.5}}>
                No uploads yet. <span style={{color:C.accent,cursor:"pointer",fontWeight:600}} onClick={()=>setPage("upload")}>Go to Upload →</span>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {folders.map(f=>(
                <div key={f.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                  {/* Folder header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:C.cardAlt,borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:18}}>📁</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:12,color:C.text,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>{f.datetime} · {f.files.length} file{f.files.length!==1?"s":""}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {f.sources.map(s=>(
                        <span key={s} style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:4,
                          background:s==="Meta"?C.metaLt:s==="LinkedIn"?C.liLt:s==="Google"?C.googleLt:s==="CRM"?"#f5f3ff":s==="Invoice"?C.accentLt:C.cardAlt,
                          color:s==="Meta"?C.meta:s==="LinkedIn"?C.li:s==="Google"?C.google:s==="CRM"?"#7c3aed":s==="Invoice"?C.accent:C.muted}}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <button onClick={()=>setFolders(p=>p.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
                  </div>
                  {/* Files inside folder */}
                  <div>
                    {f.files.map((file,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px 10px 26px",borderBottom:i<f.files.length-1?`1px solid ${C.border}`:"none"}}>
                        <span style={{fontSize:14}}>📄</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11.5,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</div>
                          <div style={{fontSize:10,color:C.muted,marginTop:2}}>{file.source} · {file.size} · {file.rows} rows{file.months?` · ${file.months} month${file.months!==1?"s":""}`:""}  · {file.encoding}</div>
                        </div>
                        <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:4,
                          background:file.source==="Meta"?C.metaLt:file.source==="LinkedIn"?C.liLt:file.source==="Google"?C.googleLt:file.source==="CRM"?"#f5f3ff":C.accentLt,
                          color:file.source==="Meta"?C.meta:file.source==="LinkedIn"?C.li:file.source==="Google"?C.google:file.source==="CRM"?"#7c3aed":C.accent}}>
                          {file.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ UPLOAD ════════════════════════════════════════════════════════ */}

        {page==="crm"&&(()=>{
          const hasCrm = crmData.length > 0;

          // ── Date filter logic ───────────────────────────────────────────────
          // Closed Won / Closed Lost / Lost FA:
          //   → filter by CLOSING DATE falling within the selected range
          // ── UNIFIED date filter — everything syncs ──────────────────────
          // Closed Won / Lost / Lost FA → filter by CLOSING DATE
          // Active deals               → filter by CREATION DATE
          // Others (non-B2B)           → filter by closing date if closed, else creation date
          // No filter = show all

          const hasFilter = !!(crmAppliedFrom || crmAppliedTo);

          const inRangeByDate = date => {
            if(!hasFilter) return true;
            if(!date) return false;
            if(crmAppliedFrom && date < crmAppliedFrom) return false;
            if(crmAppliedTo   && date > crmAppliedTo)   return false;
            return true;
          };

          const inRangeClosed = r => inRangeByDate(r.closing);
          const inRangeActive = r => inRangeByDate(r.created);
          const inRangeAny    = r => r.stageClass === 'active' ? inRangeActive(r) : inRangeClosed(r);

          const allB2B = crmData.filter(r => r.isB2B);

          // Each category filtered by its own rule
          const b2bWon    = allB2B.filter(r => r.stageClass === 'closedWon'   && inRangeClosed(r));
          const b2bLostFA = allB2B.filter(r => r.stageClass === 'lostFA'      && inRangeClosed(r));
          const b2bLost   = allB2B.filter(r => r.stageClass === 'closedLost'  && inRangeClosed(r));
          const b2bActive = allB2B.filter(r => r.stageClass === 'active'      && inRangeActive(r));
          const otherFiltered = crmData.filter(r => !r.isB2B && inRangeAny(r));

          // All visible deals in range (for table)
          const allFiltered = [...b2bWon, ...b2bLostFA, ...b2bLost, ...b2bActive, ...otherFiltered];

          // B2B in range (for type breakdown, totals, owners)
          const b2bFiltered = [...b2bWon, ...b2bLostFA, ...b2bLost, ...b2bActive];

          const wonValue      = b2bWon.reduce((s,r) => s + r.amount, 0);
          const pipelineValue = b2bActive.reduce((s,r) => s + r.amount, 0);
          const totalB2BValue = b2bFiltered.reduce((s,r) => s + r.amount, 0);
          const winRate       = b2bFiltered.length ? ((b2bWon.length/b2bFiltered.length)*100).toFixed(1) : 0;

          // ── By type breakdown ───────────────────────────────────────────────
          const typeMap = {};
          b2bFiltered.forEach(r => {
            const t = r.type || 'Unknown';
            if(!typeMap[t]) typeMap[t] = { type:t, total:0, won:0, lostFA:0, lost:0, active:0, value:0 };
            typeMap[t].total++;
            typeMap[t].value += r.amount;
            typeMap[t][r.stageClass==='closedWon'?'won':r.stageClass==='lostFA'?'lostFA':r.stageClass==='closedLost'?'lost':'active']++;
          });
          const typeArr = Object.values(typeMap).sort((a,b) => b.total - a.total);

          // ── Monthly trend ───────────────────────────────────────────────────
          const monthMap = {};
          b2bFiltered.forEach(r => {
            if(!r.closingMonth || !r.closingYear) return;
            const key = `${r.closingYear}-${String(MONTHS_ORDER.indexOf(r.closingMonth)+1).padStart(2,'0')}`;
            if(!monthMap[key]) monthMap[key] = { label:`${r.closingMonth} ${r.closingYear}`, won:0, lost:0, lostFA:0, active:0 };
            monthMap[key][r.stageClass==='closedWon'?'won':r.stageClass==='closedLost'?'lost':r.stageClass==='lostFA'?'lostFA':'active']++;
          });
          const monthArr = Object.keys(monthMap).sort().slice(-12).map(k => monthMap[k]);

          const STAGE_COLORS = { Won:'#16a34a', 'Lost (FA)':'#f59e0b', Lost:C.down, Active:'#7c3aed' };

          return (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:2,fontWeight:700,marginBottom:2}}>Without® · CRM</div>
                <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-.5}}>CRM</h1>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <DatePill from={crmFromDate} setFrom={v=>{setCrmFromDate(v);setCrmAppliedFrom(v);}} to={crmToDate} setTo={v=>{setCrmToDate(v);setCrmAppliedTo(v);}}/>
                {hasCrm&&<button onClick={()=>setCrmData(EMPTY_CRM)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:600,color:C.muted,cursor:'pointer'}}>🗑 Clear</button>}
              </div>
            </div>

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {!hasCrm&&(
              <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:14,padding:'52px 24px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                <div style={{fontSize:32}}>◈</div>
                <div style={{fontWeight:700,fontSize:15}}>No CRM data yet</div>
                <div style={{fontSize:12.5,color:C.muted,maxWidth:440,lineHeight:1.7}}>Click <b>⚡ Sync Now</b> on the Overview tab to pull live CRM data from Zoho.</div>
              </div>
            )}

            {hasCrm&&(<>

              {/* ── Main KPI row ──────────────────────────────────────────── */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
                {[
                  { label:'Closed Won',     value:b2bWon.length,    sub: wonValue>0?`${fmtINR(wonValue)} booked`:'B2B · by closing date',   bg:'#f0fdf4', col:'#16a34a' },
                  { label:'Lost (FA)',      value:b2bLostFA.length,  sub:'Internal Issues FA · by closing date',                             bg:'#fffbeb', col:'#f59e0b' },
                  { label:'Closed Lost',    value:b2bLost.length,    sub:`${winRate}% win rate · by closing date`,                           bg:'#fef2f2', col:C.down    },
                  { label:'Active Pipeline',value:b2bActive.length,  sub:`${fmtINR(pipelineValue)} total · not yet closed`,                  bg:'#f5f3ff', col:'#7c3aed' },
                  { label:'Others',         value:otherFiltered.length, sub:'Non-B2B · Grants, Waste, CSR etc',                              bg:C.cardAlt,  col:C.muted  },
                ].map(k=>(
                  <div key={k.label} style={{background:k.bg,border:`1px solid ${k.col}22`,borderRadius:12,padding:'16px'}}>
                    <div style={{fontSize:9,color:k.col,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:6}}>{k.label}</div>
                    <div style={{fontSize:28,fontWeight:900,color:k.col,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{k.value}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:6,lineHeight:1.4}}>{k.sub}</div>
                  </div>
                ))}
              </div>



              {/* ── Charts row ────────────────────────────────────────────── */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>

                {/* Monthly trend */}
                {monthArr.length>0&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:4}}>Monthly B2B Pipeline</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>by closing date · last 12 months</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthArr} barSize={7} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                      <XAxis dataKey="label" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                      <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,paddingTop:6}}/>
                      <Bar dataKey="active"  name="Active"       fill="#7c3aed" radius={[3,3,0,0]}/>
                      <Bar dataKey="won"     name="Won"          fill="#16a34a" radius={[3,3,0,0]}/>
                      <Bar dataKey="lostFA"  name="Lost (FA)"    fill="#f59e0b" radius={[3,3,0,0]}/>
                      <Bar dataKey="lost"    name="Closed Lost"  fill={C.down}  radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>)}

                {/* Active pipeline by type */}
                {b2bActive.length>0&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:4}}>Active Leads by Type</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:12}}>{b2bActive.length} B2B deals in pipeline</div>
                  {typeArr.filter(t=>t.active>0).map((t,i)=>(
                    <div key={t.type} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,color:C.text,fontWeight:600}}>{t.type.replace(/^B2B\s*/,'')}</span>
                        <span style={{fontSize:11,fontWeight:800,color:'#7c3aed',fontFamily:"'DM Mono',monospace"}}>{t.active}</span>
                      </div>
                      <div style={{background:C.border,borderRadius:3,height:6,overflow:'hidden'}}>
                        <div style={{height:'100%',background:'#7c3aed',borderRadius:3,
                          width:`${b2bActive.length?((t.active/b2bActive.length)*100):0}%`,transition:'width .4s'}}/>
                      </div>
                    </div>
                  ))}
                </div>)}
              </div>

              {/* ── B2B Type Breakdown table ──────────────────────────────── */}
              <div>
                <SectionHead title="B2B Deal Breakdown" sub="by type · deduplicated"/>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:560}}>
                    <thead>
                      <tr style={{background:C.cardAlt}}>
                        {['Deal Type','Total','Active','Won','Lost (FA)','Closed Lost','Win %','Value'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'7px 10px',color:C.muted,fontWeight:700,fontSize:9,textTransform:'uppercase',letterSpacing:0.6,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {typeArr.map((t,i)=>{
                        const wr = t.total>0?((t.won/t.total)*100).toFixed(0):0;
                        const wrc = parseInt(wr)>=30?'#16a34a':parseInt(wr)>=15?C.accent:'#d97706';
                        return(
                        <tr key={t.type} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                          <td style={{padding:'8px 10px',fontWeight:700,color:C.text}}>{t.type.replace(/^B2B\s*/,'')}</td>
                          <td style={{padding:'8px 10px',color:C.sub,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{t.total}</td>
                          <td style={{padding:'8px 10px'}}><span style={{background:'#f5f3ff',color:'#7c3aed',fontWeight:700,padding:'2px 8px',borderRadius:4,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{t.active}</span></td>
                          <td style={{padding:'8px 10px'}}><span style={{background:'#f0fdf4',color:'#16a34a',fontWeight:700,padding:'2px 8px',borderRadius:4,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{t.won}</span></td>
                          <td style={{padding:'8px 10px',color:'#f59e0b',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{t.lostFA}</td>
                          <td style={{padding:'8px 10px'}}><span style={{background:'#fef2f2',color:C.down,fontWeight:700,padding:'2px 8px',borderRadius:4,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{t.lost}</span></td>
                          <td style={{padding:'8px 10px'}}><span style={{fontWeight:700,color:wrc,fontFamily:"'DM Mono',monospace"}}>{wr}%</span></td>
                          <td style={{padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontWeight:600,color:t.value>0?C.accent:C.muted}}>{t.value>0?fmtINR(t.value):'—'}</td>
                        </tr>
                        );
                      })}
                      <tr style={{borderTop:`2px solid ${C.border}`,background:C.cardAlt}}>
                        <td style={{padding:'8px 10px',fontWeight:800,color:C.text}}>TOTAL B2B</td>
                        <td style={{padding:'8px 10px',fontWeight:800,fontFamily:"'DM Mono',monospace"}}>{b2bFiltered.length}</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:'#7c3aed',fontFamily:"'DM Mono',monospace"}}>{b2bActive.length}</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:'#16a34a',fontFamily:"'DM Mono',monospace"}}>{b2bWon.length}</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:'#f59e0b',fontFamily:"'DM Mono',monospace"}}>{b2bLostFA.length}</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:C.down,fontFamily:"'DM Mono',monospace"}}>{b2bLost.length}</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{winRate}%</td>
                        <td style={{padding:'8px 10px',fontWeight:800,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{totalB2BValue>0?fmtINR(totalB2BValue):'—'}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* ── Others box ────────────────────────────────────────────── */}
              {otherFiltered.length>0&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Others <span style={{fontSize:10,color:C.muted,fontWeight:400}}>· non-B2B deals · not included in B2B metrics</span></div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {(()=>{
                      const om={};
                      otherFiltered.forEach(r=>{ const t=r.type||'Unknown'; if(!om[t]) om[t]=0; om[t]++; });
                      return Object.entries(om).sort((a,b)=>b[1]-a[1]).map(([t,c])=>(
                        <div key={t} style={{background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',display:'flex',gap:6,alignItems:'center'}}>
                          <span style={{fontSize:11,color:C.sub}}>{t||'Unknown'}</span>
                          <span style={{fontSize:11,fontWeight:700,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{c}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* ── Deal Owners ────────────────────────────────────────────── */}
              {(()=>{
                // Build owner stats from b2bFiltered (date-filtered B2B deals)
                const ownerMap={};
                b2bFiltered.forEach(r=>{
                  const o=r.owner||'Unknown';
                  if(!ownerMap[o]) ownerMap[o]={owner:o,total:0,won:0,lostFA:0,lost:0,active:0,wonValue:0,
                    closeDays:[],// days from created to closing for won deals
                    biggestDeal:0,deals:[]};
                  ownerMap[o].total++;
                  ownerMap[o].deals.push(r);
                  ownerMap[o][r.stageClass==='closedWon'?'won':r.stageClass==='lostFA'?'lostFA':r.stageClass==='closedLost'?'lost':'active']++;
                  if(r.stageClass==='closedWon'){
                    ownerMap[o].wonValue+=r.amount;
                    if(r.amount>ownerMap[o].biggestDeal) ownerMap[o].biggestDeal=r.amount;
                    // Avg close time: days from created to closing
                    if(r.created&&r.closing){
                      const days=Math.round((new Date(r.closing)-new Date(r.created))/(1000*60*60*24));
                      if(days>=0) ownerMap[o].closeDays.push(days);
                    }
                  }
                });
                const ownerArr=Object.values(ownerMap).sort((a,b)=>b.total-a.total);
                if(!ownerArr.length) return null;

                return(
                <div>
                  <SectionHead title="Deal Owners" sub={`${ownerArr.length} owners · B2B deals in selected range`}/>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:8}}>
                    {ownerArr.map(ow=>{
                      const avgClose=ow.closeDays.length?Math.round(ow.closeDays.reduce((a,b)=>a+b,0)/ow.closeDays.length):null;
                      const avgDeal=ow.won>0?Math.round(ow.wonValue/ow.won):0;
                      return(
                      <div key={ow.owner} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)',cursor:'pointer',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform='translateY(-1px)'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform=''}}
                        onClick={()=>setSelectedOwner(ow.owner===selectedOwner?null:ow.owner)}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                          <div style={{fontWeight:800,fontSize:13,color:C.text}}>{ow.owner}</div>
                          <div style={{fontSize:12,fontWeight:800,fontFamily:"'DM Mono',monospace",color:'#7c3aed'}}>{ow.total}</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                          {[{l:'Won',v:ow.won,c:'#16a34a'},{l:'FA',v:ow.lostFA,c:'#f59e0b'},{l:'Lost',v:ow.lost,c:C.down},{l:'Active',v:ow.active,c:'#7c3aed'}].map(s=>(
                            <span key={s.l} style={{fontSize:9.5,fontWeight:700,padding:'2px 6px',borderRadius:4,background:`${s.c}15`,color:s.c}}>{s.l}: {s.v}</span>
                          ))}
                        </div>
                        {ow.won>0&&<div style={{fontSize:10,color:C.muted}}>
                          {avgClose!==null&&<span>⏱ {avgClose}d avg close · </span>}
                          <span>💰 {fmtINR(ow.wonValue)} won</span>
                        </div>}
                        <div style={{fontSize:10,color:C.accent,fontWeight:600,marginTop:4}}>{selectedOwner===ow.owner?'▲ Collapse':'▼ Expand'}</div>
                      </div>
                      );
                    })}
                  </div>

                  {/* Owner drilldown */}
                  {selectedOwner&&(()=>{
                    const ow=ownerMap[selectedOwner];
                    if(!ow) return null;
                    const avgClose=ow.closeDays.length?Math.round(ow.closeDays.reduce((a,b)=>a+b,0)/ow.closeDays.length):null;
                    const avgDeal=ow.won>0?Math.round(ow.wonValue/ow.won):0;
                    return(
                    <div style={{background:C.card,border:`2px solid ${C.accent}`,borderRadius:12,padding:'18px',marginTop:8,boxShadow:`0 4px 16px ${C.accent}20`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                        <div style={{fontSize:15,fontWeight:800,color:C.text}}>{selectedOwner} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>· deal breakdown</span></div>
                        <button onClick={()=>setSelectedOwner(null)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18}}>✕</button>
                      </div>
                      {/* 3 metric cards */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:14}}>
                        {[
                          {label:'Avg Close Time', value:avgClose!==null?`${avgClose} days`:'—', sub:'from creation to close',col:'#7c3aed'},
                          {label:'Biggest Deal',   value:ow.biggestDeal>0?fmtINR(ow.biggestDeal):'—', sub:'single Closed Won deal', col:'#16a34a'},
                          {label:'Avg Deal Value', value:avgDeal>0?fmtINR(avgDeal):'—', sub:'won deals average', col:C.accent},
                        ].map(k=>(
                          <div key={k.label} style={{background:C.cardAlt,borderRadius:10,padding:'12px 14px',border:`1px solid ${C.border}`}}>
                            <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>{k.label}</div>
                            <div style={{fontSize:18,fontWeight:800,color:k.col,fontFamily:"'DM Mono',monospace"}}>{k.value}</div>
                            <div style={{fontSize:10,color:C.muted,marginTop:3}}>{k.sub}</div>
                          </div>
                        ))}
                      </div>
                      {/* Stage breakdown */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:6,marginBottom:14}}>
                        {[{l:'Closed Won',v:ow.won,c:'#16a34a',bg:'#f0fdf4'},{l:'Lost (FA)',v:ow.lostFA,c:'#f59e0b',bg:'#fffbeb'},{l:'Closed Lost',v:ow.lost,c:C.down,bg:'#fef2f2'},{l:'Active',v:ow.active,c:'#7c3aed',bg:'#f5f3ff'}].map(s=>(
                          <div key={s.l} style={{background:s.bg,border:`1px solid ${s.c}22`,borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                            <div style={{fontSize:9,color:s.c,fontWeight:700,textTransform:'uppercase',marginBottom:4}}>{s.l}</div>
                            <div style={{fontSize:22,fontWeight:900,color:s.c,fontFamily:"'DM Mono',monospace"}}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      {/* Owner's deals table */}
                      <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:500}}>
                        <thead><tr style={{background:C.cardAlt}}>
                          {['Deal','Type','Stage','Closing','Amount'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.muted,fontWeight:700,fontSize:9,textTransform:'uppercase',letterSpacing:0.7,whiteSpace:'nowrap'}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {ow.deals.sort((a,b)=>(b.closing||'').localeCompare(a.closing||'')).map((d,i)=>{
                            const sc=d.stageClass;
                            const sc_col=sc==='closedWon'?'#16a34a':sc==='closedLost'?C.down:sc==='lostFA'?'#f59e0b':'#7c3aed';
                            const sc_bg=sc==='closedWon'?'#f0fdf4':sc==='closedLost'?'#fef2f2':sc==='lostFA'?'#fffbeb':'#f5f3ff';
                            const sc_lbl=sc==='closedWon'?'Won':sc==='closedLost'?'Lost':sc==='lostFA'?'Lost FA':'Active';
                            return(
                            <tr key={d.id} className="tr" style={{borderTop:`1px solid ${C.border}`}}>
                              <td style={{padding:'6px 8px',fontWeight:600,color:C.text,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name||'—'}</td>
                              <td style={{padding:'6px 8px'}}><span style={{fontSize:9.5,fontWeight:700,padding:'2px 6px',borderRadius:4,background:`${C.accent}12`,color:C.accent}}>{(d.type||'—').replace(/^B2B\s*/,'')}</span></td>
                              <td style={{padding:'6px 8px'}}><span style={{fontSize:9.5,fontWeight:700,padding:'2px 6px',borderRadius:4,background:sc_bg,color:sc_col}}>{sc_lbl}</span></td>
                              <td style={{padding:'6px 8px',color:C.muted,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{d.closing||'—'}</td>
                              <td style={{padding:'6px 8px',fontFamily:"'DM Mono',monospace",fontWeight:700,color:d.amount>0?C.accent:C.muted}}>{d.amount>0?fmtINR(d.amount):'—'}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                    );
                  })()}
                </div>
                );
              })()}

              {/* ── Won Revenue KPI cards + monthly bar ───────────────────── */}
              {(()=>{
                const wonByMonth = {};
                b2bWon.forEach(d => {
                  if(!d.closingMonth||!d.closingYear) return;
                  const key = `${d.closingYear}-${String(MONTHS_ORDER.indexOf(d.closingMonth)+1).padStart(2,'0')}`;
                  if(!wonByMonth[key]) wonByMonth[key] = {label:`${d.closingMonth} ${d.closingYear}`, amount:0, count:0};
                  wonByMonth[key].amount += d.amount||0;
                  wonByMonth[key].count++;
                });
                const wonMonthArr = Object.keys(wonByMonth).sort().slice(-6).map(k=>wonByMonth[k]);
                const totalWon = b2bWon.reduce((s,d)=>s+(d.amount||0),0);
                const avgDeal  = b2bWon.length ? Math.round(totalWon/b2bWon.length) : 0;
                const curMon   = wonMonthArr.length>=1 ? wonMonthArr[wonMonthArr.length-1] : null;
                const prevMon  = wonMonthArr.length>=2 ? wonMonthArr[wonMonthArr.length-2] : null;
                const momDelta = prevMon&&curMon&&prevMon.amount>0 ? parseFloat(((curMon.amount-prevMon.amount)/prevMon.amount*100).toFixed(1)) : null;
                return(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <SectionHead title="Won Revenue" sub="CRM Amount · Closed Won B2B · by closing month"/>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
                    {[
                      {label:"Total Won Revenue", val:fmtINR(totalWon), primary:true},
                      {label:"Closed Won Deals",  val:String(b2bWon.length), col:"#16a34a"},
                      {label:"Avg Deal Size",      val:avgDeal>0?fmtINR(avgDeal):"—", col:C.sub},
                      {label:curMon?curMon.label:"This Month", val:curMon?fmtINR(curMon.amount):"—",
                        sub:momDelta!==null?`${momDelta>=0?"+":""}${momDelta}% vs prev month`:undefined,
                        col:momDelta===null?C.muted:momDelta>=0?"#16a34a":C.down},
                    ].map(k=>(
                      <div key={k.label} style={{background:k.primary?C.accent:C.card,border:k.primary?"none":`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",boxShadow:k.primary?"0 4px 16px rgba(90,138,0,0.18)":"0 2px 8px rgba(45,45,78,0.06)"}}>
                        <div style={{fontSize:9,color:k.primary?"rgba(255,255,255,0.65)":C.muted,textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:6}}>{k.label}</div>
                        <div style={{fontSize:24,fontWeight:800,color:k.primary?"#fff":k.col||C.text,fontFamily:"'DM Mono',monospace",letterSpacing:-0.5}}>{k.val}</div>
                        {k.sub&&<div style={{fontSize:10,color:k.primary?"rgba(255,255,255,0.6)":k.col,marginTop:4,fontWeight:600}}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>
                  {wonMonthArr.length>0&&(
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 18px 12px",boxShadow:"0 2px 8px rgba(45,45,78,0.06)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:14}}>Monthly Won Revenue <span style={{fontSize:10,color:C.muted,fontWeight:400}}>last 6 months</span></div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={wonMonthArr} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="label" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>fmtINR(v)} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} width={52}/>
                        <Tooltip formatter={(v,n,p)=>[fmtINR(v),`${p.payload.count} deals won`]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}/>
                        <Bar dataKey="amount" fill={C.accent} radius={[5,5,0,0]} name="Won Revenue"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>
                );
              })()}

            </>)}
          </div>
          );
        })()}

        {/* ══ ESTIMATE ══════════════════════════════════════════════════════ */}
        {page==="estimate"&&(()=>{
          const hasHist = liveData.meta.length>0||liveData.linkedin.length>0||liveData.google.length>0;
          const barC=["#1877f2","#0a66c2","#ea4335"];
          return(
          <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:"100%"}}>
            <div>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>AI Budget Planner</div>
              <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-0.5}}>Estimate & Budget Breakdown</h1>
              <p style={{fontSize:12.5,color:C.muted,marginTop:4,lineHeight:1.7}}>Enter your monthly budget and lead target. The planner uses your historical channel performance to recommend the optimal split and forecast expected leads.</p>
            </div>
            {!hasHist&&(
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"12px 16px",fontSize:12,color:"#92400e"}}>
                ⚠️ Upload ad spend data first (Meta / LinkedIn / Google) to get a data-driven estimate. Without historical data, the planner will use default industry ratios.
              </div>
            )}
            {/* Input form */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                <div>
                  <label style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:700,display:"block",marginBottom:6}}>Monthly Budget (₹)</label>
                  <input value={estBudget} onChange={e=>setEstBudget(e.target.value)} placeholder="e.g. 300000"
                    style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,fontWeight:700,fontFamily:"'DM Mono',monospace",color:C.text,background:C.bg,outline:"none"}}/>
                  <div style={{fontSize:10,color:C.muted,marginTop:4}}>Total budget across all channels</div>
                </div>
                <div>
                  <label style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:700,display:"block",marginBottom:6}}>Lead Target</label>
                  <input value={estLeads} onChange={e=>setEstLeads(e.target.value)} placeholder="e.g. 100"
                    style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,fontWeight:700,fontFamily:"'DM Mono',monospace",color:C.text,background:C.bg,outline:"none"}}/>
                  <div style={{fontSize:10,color:C.muted,marginTop:4}}>Number of qualified leads in 1 month</div>
                </div>
              </div>
              <div style={{marginTop:16,display:"flex",gap:10,alignItems:"center"}}>
                <button onClick={runEstimate} disabled={!estBudget||!estLeads}
                  style={{background:estBudget&&estLeads?C.accent:"#ccc",color:"#fff",border:"none",borderRadius:9,padding:"11px 28px",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:estBudget&&estLeads?"0 4px 14px rgba(90,138,0,0.22)":"none"}}>
                  ◎ Generate Breakdown
                </button>
                {estResult&&<button onClick={()=>setEstResult(null)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 14px",fontSize:11,color:C.muted,cursor:"pointer"}}>✕ Reset</button>}
              </div>
            </div>
            {/* Results */}
            {estResult&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {!estResult.hasHistory&&(
                  <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:"10px 14px",fontSize:11,color:"#92400e"}}>
                    ⚠️ Using default industry ratios (Meta 50% / LinkedIn 30% / Google 20%) — upload historical data for a personalised breakdown.
                  </div>
                )}
                {/* Budget split cards */}
                <SectionHead title="Recommended Budget Split"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
                  {[
                    {name:"Meta",budget:estResult.metaBudget,leads:estResult.metaLeads,cpl:estResult.metaCPL,color:C.meta},
                    {name:"LinkedIn",budget:estResult.liBudget,leads:estResult.liLeads,cpl:estResult.liCPL,color:C.li},
                    {name:"Google",budget:estResult.gBudget,leads:estResult.gLeads,cpl:estResult.gCPL,color:C.google},
                  ].map(ch=>(
                    <div key={ch.name} style={{background:C.card,border:`2px solid ${ch.color}22`,borderRadius:12,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:ch.color}}/>
                        <span style={{fontWeight:800,fontSize:13,color:ch.color}}>{ch.name}</span>
                      </div>
                      <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:2}}>Budget</div>
                      <div style={{fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:C.text,marginBottom:8}}>₹{ch.budget.toLocaleString("en-IN")}</div>
                      <div style={{background:C.border,borderRadius:3,height:5,marginBottom:8,overflow:"hidden"}}>
                        <div style={{height:"100%",background:ch.color,borderRadius:3,width:`${((ch.budget/estResult.budget)*100).toFixed(0)}%`}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div><div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>Est. Leads</div><div style={{fontSize:14,fontWeight:800,color:ch.color}}>{ch.leads}</div></div>
                        {ch.cpl&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>CPL</div><div style={{fontSize:14,fontWeight:800,color:C.text,fontFamily:"'DM Mono',monospace"}}>₹{ch.cpl}</div></div>}
                      </div>
                      <div style={{fontSize:9,color:C.muted,marginTop:6}}>{((ch.budget/estResult.budget)*100).toFixed(0)}% of budget</div>
                    </div>
                  ))}
                </div>
                {/* Summary */}
                <div style={{background:C.accent,borderRadius:12,padding:"16px 20px",display:"flex",flexWrap:"wrap",gap:20}}>
                  {[
                    {label:"Total Budget",value:`₹${estResult.budget.toLocaleString("en-IN")}`},
                    {label:"Expected Leads",value:String(estResult.totalLeads)},
                    {label:"Blended CPL",value:`₹${Math.round(estResult.budget/estResult.totalLeads).toLocaleString("en-IN")}`},
                    {label:"Win Rate (CRM)",value:crmData.length>0?`${estResult.winRate}%`:"—"},
                    {label:"Expected Wins",value:crmData.length>0?String(estResult.expectedWins):"—"},
                    {label:"Lead Target",value:String(estResult.leadTarget)},
                  ].map(k=>(
                    <div key={k.label}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:3}}>{k.label}</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"'DM Mono',monospace"}}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {/* Recommendation text */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",fontSize:12,color:C.sub,lineHeight:1.8}}>
                  <b style={{color:C.text}}>Recommendation:</b> Based on your historical data, allocate <b style={{color:C.meta}}>₹{estResult.metaBudget.toLocaleString("en-IN")} to Meta</b> ({((estResult.metaBudget/estResult.budget)*100).toFixed(0)}%), <b style={{color:C.li}}>₹{estResult.liBudget.toLocaleString("en-IN")} to LinkedIn</b> ({((estResult.liBudget/estResult.budget)*100).toFixed(0)}%), and <b style={{color:C.google}}>₹{estResult.gBudget.toLocaleString("en-IN")} to Google</b> ({((estResult.gBudget/estResult.budget)*100).toFixed(0)}%). This is expected to generate <b style={{color:C.accent}}>{estResult.totalLeads} leads</b> at a blended CPL of <b>₹{Math.round(estResult.budget/estResult.totalLeads).toLocaleString("en-IN")}</b>.{estResult.leadTarget>estResult.totalLeads?` ⚠️ Your target of ${estResult.leadTarget} leads may need a higher budget — try ₹${Math.round(estResult.budget*(estResult.leadTarget/estResult.totalLeads)).toLocaleString("en-IN")}.`:` ✅ Your budget should comfortably meet the ${estResult.leadTarget}-lead target.`}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ INVOICES ══════════════════════════════════════════════════════ */}
        {page==="invoices"&&(()=>{
          const hasInv = invoiceData.length > 0;
          // Date filter
          // Year-aware invoice filter — compare YYYY-MM strings directly
          const allInv = invoiceData.filter(r=>{
            if(!invFromDate&&!invToDate) return true;
            const ym = r.yearMonth || r.month;
            if(!ym) return true;
            // Convert date inputs to YYYY-MM
            const from = invFromDate ? invFromDate.slice(0,7) : null;
            const to   = invToDate   ? invToDate.slice(0,7)   : null;
            if(from && ym < from) return false;
            if(to   && ym > to)   return false;
            return true;
          });
          const totalRev   = allInv.reduce((s,r)=>s+r.subtotal,0);
          const b2bInv     = allInv.filter(r=>/^B2B/i.test(r.businessType));
          const d2cInv     = allInv.filter(r=>/^(D2C|B2C)/i.test(r.businessType));
          const b2bRev     = b2bInv.reduce((s,r)=>s+r.subtotal,0);
          const d2cRev     = d2cInv.reduce((s,r)=>s+r.subtotal,0);
          const closedRev  = allInv.filter(r=>r.status==="Closed").reduce((s,r)=>s+r.subtotal,0);
          const overdueRev = allInv.filter(r=>r.status==="Overdue").reduce((s,r)=>s+r.subtotal,0);

          // By business type
          const byType = {};
          allInv.forEach(r=>{ if(!byType[r.businessType]) byType[r.businessType]={type:r.businessType,subtotal:0,count:0}; byType[r.businessType].subtotal+=r.subtotal; byType[r.businessType].count++; });
          const typeData = Object.values(byType).sort((a,b)=>b.subtotal-a.subtotal);
          const typeColors = ["#5a8a00","#0a66c2","#ea4335","#f59e0b","#8b5cf6","#06b6d4","#ec4899"];

          // By month
          const byMonth = {};
          allInv.forEach(r=>{
            const key=r.yearMonth||r.month;
            if(!key||key==="—") return;
            if(!byMonth[key]) byMonth[key]={month:r.month,yearMonth:key,subtotal:0,count:0};
            byMonth[key].subtotal+=r.subtotal; byMonth[key].count++;
          });
          const monthData = Object.keys(byMonth).sort().map(k=>byMonth[k]);

          // Top customers
          const byCust = {};
          allInv.forEach(r=>{ if(!byCust[r.customer]) byCust[r.customer]={customer:r.customer,subtotal:0,count:0,statuses:new Set()}; byCust[r.customer].subtotal+=r.subtotal; byCust[r.customer].count++; byCust[r.customer].statuses.add(r.status); });
          const topCust = Object.values(byCust).sort((a,b)=>b.subtotal-a.subtotal).slice(0,10).map(c=>({...c,statuses:[...c.statuses].join("/")}));

          return(
          <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:2}}>Without® · Finance</div>
                <h1 style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:-0.5}}>Invoices</h1>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <DatePill from={invFromDate} setFrom={setInvFromDate} to={invToDate} setTo={setInvToDate}/>
                {hasInv&&<button onClick={()=>setInvoiceData(EMPTY_INV)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:C.muted,cursor:"pointer"}}>🗑 Clear</button>}
              </div>
            </div>

            {!hasInv&&(
              <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:14,padding:"52px 24px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                <div style={{fontSize:32}}>📋</div>
                <div style={{fontWeight:700,fontSize:15,color:C.text}}>No invoice data yet</div>
                <div style={{fontSize:12.5,color:C.muted,maxWidth:420,lineHeight:1.7}}>Click <b>⚡ Sync Now</b> on the Overview tab to pull live invoice data from Zoho Books.</div>
              </div>
            )}

            {hasInv&&(<>
              {/* KPI row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
                <KPI label="Total Revenue"  value={fmtINR(totalRev)} icon="💰" primary/>
                <KPI label="B2B Revenue"    value={fmtINR(b2bRev)} color={C.accent} icon="🏢" sub={`${b2bInv.length} invoices`}/>
                <KPI label="D2C Revenue"    value={fmtINR(d2cRev)} color="#0a66c2" icon="🛒" sub={`${d2cInv.length} invoices`}/>
                <KPI label="Invoices"       value={String(allInv.length)} icon="📋" sub={`${allInv.filter(r=>r.status==="Closed").length} closed · ${allInv.filter(r=>r.status==="Overdue").length} overdue`}/>
              </div>

              {/* Charts row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>

                {/* Revenue by type — pie */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Revenue by Business Type</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={typeData} dataKey="subtotal" cx="50%" cy="50%" outerRadius={60} innerRadius={28} paddingAngle={3}>
                        {typeData.map((e,i)=><Cell key={i} fill={typeColors[i%typeColors.length]}/>)}
                      </Pie>
                      <Tooltip formatter={v=>fmtINR(v)} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
                    {typeData.map((t,i)=>(
                      <div key={t.type} style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:typeColors[i%typeColors.length],flexShrink:0}}/>
                        <span style={{fontSize:11,color:C.sub,flex:1}}>{t.type.replace("B2B ","")}</span>
                        <span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmtINR(t.subtotal)}</span>
                        <span style={{fontSize:10,color:C.muted,width:28,textAlign:"right"}}>{totalRev?((t.subtotal/totalRev)*100).toFixed(0):0}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue by month — bar */}
                {monthData.length>0&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",boxShadow:"0 2px 10px rgba(45,45,78,0.06)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:10}}>Monthly B2B Revenue</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={monthData} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#efefef" vertical={false}/>
                      <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v=>fmtINR(v)} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                      <Tooltip formatter={v=>fmtINR(v)} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:7,fontSize:11}}/>
                      <Bar dataKey="subtotal" fill={C.accent} radius={[4,4,0,0]} name="B2B Revenue"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                )}

              </div>



            </>)}
          </div>
          );
        })()}
      </main>
    </div>
  );
}
