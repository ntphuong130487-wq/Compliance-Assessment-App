import { emptyState, MODEL_VERSION } from './domain.js';

const KEY='agris_compliance_prod_v1';

export function normalizeState(raw){
  const base=emptyState();
  if(!raw || typeof raw!=='object') return base;
  const out={...base,...raw,meta:{...base.meta,...(raw.meta||{})}};
  for(const k of Object.keys(base)){
    if(Array.isArray(base[k]) && !Array.isArray(out[k])) out[k]=[];
  }
  out.meta.modelVersion=MODEL_VERSION;
  return out;
}

export function loadState(){
  try{
    const raw=localStorage.getItem(KEY);
    return raw?normalizeState(JSON.parse(raw)):emptyState();
  }catch(e){
    console.warn('Không thể đọc local state',e);
    return emptyState();
  }
}

export function saveState(state){
  state.meta.updatedAt=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));
}

export function resetState(){
  localStorage.removeItem(KEY);
  return emptyState();
}

export function exportState(state){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`agris-compliance-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export async function importState(file){
  const text=await file.text();
  const parsed=JSON.parse(text);
  return normalizeState(parsed);
}

export async function sha256(file){
  const buf=await file.arrayBuffer();
  const hash=await crypto.subtle.digest('SHA-256',buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function backendHealth(){
  try{
    const r=await fetch('/api/health',{headers:{accept:'application/json'}});
    if(!r.ok) throw new Error(String(r.status));
    return await r.json();
  }catch{
    return {ok:false,persistence:'browser-local',databaseConfigured:false};
  }
}
