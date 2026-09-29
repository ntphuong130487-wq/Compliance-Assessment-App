import { emptyState, MODEL_VERSION } from './domain.js';

const KEY='agris_compliance_prod_v1';
const VERSION_KEY=KEY+'_remote_version';
let remoteCallback=null;
let saveTimer=null;
let syncStatus={
  mode:'local',
  configured:false,
  version:Number(localStorage.getItem(VERSION_KEY)||0),
  updatedAt:null,
  conflict:false,
  error:null
};
const listeners=new Set();

function notify(){
  const snapshot={...syncStatus};
  for(const fn of listeners){try{fn(snapshot);}catch{}}
}
function setStatus(patch){syncStatus={...syncStatus,...patch};notify();}
function writeLocal(state){
  state.meta.updatedAt=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));
}

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
  writeLocal(state);
  scheduleRemoteSave(state);
}

export function resetState(){
  localStorage.removeItem(KEY);
  localStorage.removeItem(VERSION_KEY);
  syncStatus={...syncStatus,version:0,conflict:false,error:null};
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
    const r=await fetch('/api/health',{headers:{accept:'application/json'},cache:'no-store'});
    if(!r.ok) throw new Error(String(r.status));
    return await r.json();
  }catch{
    return {ok:false,persistence:'browser-local',databaseConfigured:false};
  }
}

export function getSyncStatus(){return {...syncStatus};}
export function onSyncStatus(fn){listeners.add(fn);return()=>listeners.delete(fn);}

async function getRemote(){
  const r=await fetch('/api/state',{headers:{accept:'application/json'},cache:'no-store'});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error||String(r.status));
  return data;
}

async function postRemote(state,version){
  const r=await fetch('/api/state',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({state,version})
  });
  const data=await r.json();
  return {r,data};
}

async function applyRemote(data){
  if(!data?.exists||!data?.state) return null;
  const remote=normalizeState(data.state);
  writeLocal(remote);
  syncStatus.version=Number(data.version||0);
  localStorage.setItem(VERSION_KEY,String(syncStatus.version));
  setStatus({
    mode:'cloud',
    configured:true,
    version:syncStatus.version,
    updatedAt:data.updatedAt||null,
    conflict:false,
    error:null
  });
  if(remoteCallback) remoteCallback(remote);
  return remote;
}

export async function initializeCloudSync(onRemote){
  remoteCallback=onRemote||null;
  try{
    const data=await getRemote();
    if(!data.configured){
      setStatus({mode:'local',configured:false,conflict:false,error:null});
      return getSyncStatus();
    }
    setStatus({mode:'cloud',configured:true,error:null});
    if(data.exists&&data.state){
      await applyRemote(data);
    }else{
      syncStatus.version=0;
      localStorage.setItem(VERSION_KEY,'0');
      await pushRemoteState(loadState(),true);
    }
  }catch(e){
    setStatus({mode:'offline',error:e.message||String(e)});
  }
  return getSyncStatus();
}

export async function pushRemoteState(state,allowInitialize=false){
  if(!syncStatus.configured&&!allowInitialize) return {ok:false,skipped:true};
  if(syncStatus.conflict) return {ok:false,conflict:true};
  try{
    const {r,data}=await postRemote(state,Number(syncStatus.version||0));
    if(r.status===409){
      setStatus({
        mode:'cloud',
        configured:true,
        conflict:true,
        error:'VERSION_CONFLICT'
      });
      return {ok:false,conflict:true,currentVersion:data.currentVersion};
    }
    if(!r.ok) throw new Error(data?.error||String(r.status));
    syncStatus.version=Number(data.version||syncStatus.version||0);
    localStorage.setItem(VERSION_KEY,String(syncStatus.version));
    setStatus({
      mode:'cloud',
      configured:true,
      version:syncStatus.version,
      updatedAt:data.updatedAt||new Date().toISOString(),
      conflict:false,
      error:null
    });
    return {ok:true,version:syncStatus.version};
  }catch(e){
    setStatus({mode:'offline',error:e.message||String(e)});
    return {ok:false,error:e.message||String(e)};
  }
}

function scheduleRemoteSave(state){
  if(!syncStatus.configured||syncStatus.conflict) return;
  clearTimeout(saveTimer);
  const snapshot=normalizeState(structuredClone(state));
  saveTimer=setTimeout(()=>pushRemoteState(snapshot),450);
}

export async function syncNow(state){
  clearTimeout(saveTimer);
  return pushRemoteState(normalizeState(structuredClone(state)));
}

export async function pullCloudState(){
  try{
    const data=await getRemote();
    if(!data.configured){
      setStatus({mode:'local',configured:false,conflict:false,error:null});
      return null;
    }
    return await applyRemote(data);
  }catch(e){
    setStatus({mode:'offline',error:e.message||String(e)});
    return null;
  }
}

export async function forcePushCloud(state){
  try{
    const current=await getRemote();
    if(!current.configured) return {ok:false,error:'DATABASE_NOT_CONFIGURED'};
    syncStatus.version=Number(current.version||0);
    localStorage.setItem(VERSION_KEY,String(syncStatus.version));
    syncStatus.conflict=false;
    return await pushRemoteState(normalizeState(structuredClone(state)),true);
  }catch(e){
    setStatus({mode:'offline',error:e.message||String(e)});
    return {ok:false,error:e.message||String(e)};
  }
}
