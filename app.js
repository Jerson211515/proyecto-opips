// ============ CONFIGURACIÓN ============
// Cambia esta clave por la que tú quieras usar para desbloquear el modo edición.
// No es seguridad real (cualquiera con el código fuente podría verla) — es solo
// un candado casero para evitar que un dato se mueva por accidente.
const EDIT_PASSWORD = "opips2026";

const CONFIG = {
  owner: "Jerson211515",
  repo: "proyecto-opips",
  branch: "main",
  dataPath: "data.json"
};

// ============ ETAPAS Y COLORES ============
const ETAPAS = [
  "0. En trámite de priorización","1. Inversión priorizada con acuerdo de consejo","2. Solicitud de informe Previo a CGR",
  "3. Informe Previo emitido","4. Aprobación de bases","5. Convocatoria","6. Buena Pro","7. Elaboración de ET","8. Ejecución Física"
];
function etapaIndex(e){ const i = ETAPAS.findIndex(x=>x===e); return i===-1?0:i; }
function etapaShort(e){ return e.replace(/^\d+\.\s*/,''); }
function etapaColor(e){
  const i = etapaIndex(e);
  if (i<=1) return {bg:'#fdeceb',text:'#c0392b'};
  if (i<=4) return {bg:'#fdf3e2',text:'#b8860b'};
  if (i<=7) return {bg:'#e7f0fd',text:'#1d4ed8'};
  return {bg:'#e6f6ee',text:'#0f9d58'};
}
function groupLabel(e){
  const i = etapaIndex(e);
  if (i<=1) return 'Priorización';
  if (i<=4) return 'Aprobación';
  if (i===5) return 'Convocatoria';
  if (i===6) return 'Buena Pro';
  if (i===7) return 'Elaboración ET';
  return 'Ejecución';
}
const GROUP_COLORS = {'Priorización':'#e24b4a','Aprobación':'#e0a626','Convocatoria':'#7f77dd','Buena Pro':'#378add','Elaboración ET':'#d85a30','Ejecución':'#1d9e75'};

function fmtMoney(n){ if (!n) return 'S/ 0'; return 'S/ ' + Number(n).toLocaleString('es-PE',{maximumFractionDigits:0}); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){ if (!iso) return ''; const [y,m,d] = iso.split('-'); return d+'/'+m+'/'+y; }
function escapeHtml(s){ if (s===undefined||s===null) return ''; return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ============ ESTADO ============
let STATE = {
  projects: [], view: 'home', currentCui: null, activeTab: 'resumen',
  search: '', filterEtapa: '', loaded: false,
  editMode: false, dirty: false, saving: false, saveMsg: ''
};

// ============ CARGA DE DATOS (lectura pública, sin token) ============
async function loadData(){
  try {
    const res = await fetch('data.json?t=' + Date.now());
    if (!res.ok) throw new Error('No se pudo leer data.json');
    STATE.projects = await res.json();
  } catch(e){
    console.error(e);
    STATE.loadError = true;
  }
  STATE.loaded = true;
  render();
}

function getProject(cui){ return STATE.projects.find(p => p.cui === cui); }
function markDirty(){ STATE.dirty = true; }

// ============ MODO EDICIÓN ============
function toggleEditMode(){
  if (STATE.editMode){
    if (STATE.dirty && !confirm('Tienes cambios sin guardar en GitHub. ¿Salir de todos modos? (los cambios se mantienen en pantalla hasta que recargues la página)')) return;
    STATE.editMode = false;
    render();
    return;
  }
  const pwd = prompt('Ingresa la contraseña de edición:');
  if (pwd === null) return;
  if (pwd === EDIT_PASSWORD){ STATE.editMode = true; render(); }
  else alert('Contraseña incorrecta.');
}

// ============ TOKEN DE GITHUB ============
function getToken(){
  let t = localStorage.getItem('gh_token');
  if (!t){
    t = prompt('Pega tu GitHub Personal Access Token (permiso de escritura sobre este repositorio).\nSolo se guarda en este navegador, nunca se sube a GitHub.');
    if (t) localStorage.setItem('gh_token', t.trim());
  }
  return t ? t.trim() : null;
}
function clearToken(){
  if (confirm('¿Olvidar el token guardado en este navegador?')){
    localStorage.removeItem('gh_token');
    alert('Token olvidado. Se te pedirá de nuevo la próxima vez que guardes.');
  }
}

// ============ GUARDADO EN GITHUB ============
async function saveToGitHub(){
  const token = getToken();
  if (!token){ return; }
  STATE.saving = true; render();
  try {
    const { owner, repo, branch, dataPath } = CONFIG;
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}?ref=${branch}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!getRes.ok){
      if (getRes.status === 401) throw new Error('Token inválido o sin permisos. Usa "Cambiar token" e intenta de nuevo.');
      throw new Error('No se pudo leer el archivo actual en GitHub (revisa el nombre del repositorio).');
    }
    const getData = await getRes.json();
    const sha = getData.sha;
    const jsonStr = JSON.stringify(STATE.projects, null, 2);
    const content = btoa(unescape(encodeURIComponent(jsonStr)));
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Actualiza data.json desde el expediente digital', content, sha, branch })
    });
    if (!putRes.ok){
      const err = await putRes.json().catch(()=>({}));
      throw new Error(err.message || 'Error al guardar en GitHub.');
    }
    STATE.dirty = false;
    STATE.saveMsg = 'Guardado en GitHub · ' + new Date().toLocaleTimeString('es-PE');
  } catch(e){
    console.error(e);
    alert('No se pudo guardar: ' + e.message);
  }
  STATE.saving = false;
  render();
}

// ============ RENDER PRINCIPAL ============
function render(){
  const sidebar = document.getElementById('exd-sidebar');
  const main = document.getElementById('exd-main');
  const editBtn = document.getElementById('exd-edit-toggle');
  const saveIndicator = document.getElementById('exd-save-indicator');

  editBtn.classList.toggle('on', STATE.editMode);
  editBtn.innerHTML = STATE.editMode
    ? '<i class="ti ti-lock-open" aria-hidden="true"></i> Edición activa'
    : '<i class="ti ti-lock" aria-hidden="true"></i> Modo edición';
  saveIndicator.textContent = STATE.saveMsg || '';

  if (!STATE.loaded){ main.innerHTML = '<p style="color:#6b7280;font-size:14px">Cargando expedientes...</p>'; sidebar.innerHTML=''; return; }
  if (STATE.loadError){
    main.innerHTML = '<div class="exd-card" style="border-color:#f0997b"><p style="margin:0;font-weight:700;color:#c0392b"><i class="ti ti-alert-triangle" aria-hidden="true"></i> No se pudo cargar data.json. Verifica que el archivo exista en el repositorio y que la página se esté sirviendo desde GitHub Pages (no abierta como archivo local).</p></div>';
    sidebar.innerHTML=''; return;
  }

  sidebar.innerHTML = renderSidebar(); wireSidebar();
  if (STATE.view === 'home'){ main.innerHTML = renderHome(); wireHome(); }
  else if (STATE.view === 'detail'){ main.innerHTML = renderDetail(STATE.currentCui); wireDetail(); }
  else if (STATE.view === 'documentos'){ main.innerHTML = renderDocumentos(STATE.currentCui); wireDocumentos(); }
}

function saveBarHtml(){
  if (!STATE.editMode) return '';
  return `<div class="exd-savebar">
    <span style="font-size:13px;color:#6b7280">
      ${STATE.dirty ? '<i class="ti ti-pencil" style="color:#b8860b"></i> Tienes cambios sin guardar en GitHub.' : '<i class="ti ti-circle-check" style="color:#0f9d58"></i> Sin cambios pendientes.'}
      <a href="#" id="exd-clear-token" style="margin-left:14px;font-size:12px;color:#9ca3af">Cambiar token</a>
    </span>
    <button id="exd-save-github" class="exd-btn" ${STATE.saving ? 'disabled' : ''}>${STATE.saving ? 'Guardando...' : 'Guardar cambios en GitHub'}</button>
  </div>`;
}
function wireSaveBar(){
  const btn = document.getElementById('exd-save-github');
  if (btn) btn.addEventListener('click', saveToGitHub);
  const ct = document.getElementById('exd-clear-token');
  if (ct) ct.addEventListener('click', e => { e.preventDefault(); clearToken(); });
}

// ============ SIDEBAR ============
function renderSidebar(){
  const groups = {};
  STATE.projects.forEach(p => { const g = groupLabel(p.situacion.etapa); groups[g]=(groups[g]||0)+1; });
  const total = STATE.projects.length;
  const enEjecucion = STATE.projects.filter(p=>etapaIndex(p.situacion.etapa)===8).length;
  const enRiesgo = STATE.projects.filter(p=>etapaIndex(p.situacion.etapa)<=1).length;
  let acc=0; const R=40,C=2*Math.PI*R;
  const arcs = Object.keys(GROUP_COLORS).filter(g=>groups[g]).map(g=>{
    const frac=groups[g]/total, dash=frac*C, offset=acc*C; acc+=frac;
    return `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${GROUP_COLORS[g]}" stroke-width="13" stroke-dasharray="${dash} ${C-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
  }).join('');
  const legend = Object.keys(GROUP_COLORS).filter(g=>groups[g]).map(g=>
    `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#4b5563;padding:1px 0"><span style="width:8px;height:8px;border-radius:50%;background:${GROUP_COLORS[g]};flex-shrink:0"></span>${g} (${groups[g]})</div>`
  ).join('');
  return `
    <div class="exd-nav ${STATE.view==='home'&&!STATE.filterEtapa?'active':''}" data-nav="dashboard"><i class="ti ti-layout-dashboard"></i>Dashboard</div>
    <div class="exd-nav" data-nav="cartera"><i class="ti ti-folders"></i>Cartera de proyectos</div>
    <p style="font-size:10.5px;color:#9ca3af;font-weight:700;letter-spacing:.04em;margin:16px 4px 4px">ACCESOS RÁPIDOS</p>
    <div class="exd-quick" data-nav="ejecucion"><i class="ti ti-player-play" style="color:#0f9d58"></i>Proyectos en ejecución</div>
    <div class="exd-quick" data-nav="riesgo"><i class="ti ti-alert-triangle" style="color:#c0392b"></i>Proyectos en riesgo</div>
    <p style="font-size:10.5px;color:#9ca3af;font-weight:700;letter-spacing:.04em;margin:16px 4px 8px">RESUMEN GENERAL (${total})</p>
    <div style="padding:0 4px 10px">
      <svg viewBox="0 0 100 100" style="width:92px;height:92px;display:block;margin:0 auto 10px">
        ${arcs}
        <text x="50" y="47" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937">${total}</text>
        <text x="50" y="61" text-anchor="middle" font-size="8" fill="#6b7280">proyectos</text>
      </svg>
      <div>${legend}</div>
    </div>
    <div style="border-top:1px solid #e5e9e7;padding-top:10px;font-size:11px;color:#9ca3af">
      ${enEjecucion} en ejecución · ${enRiesgo} en riesgo
    </div>
  `;
}
function wireSidebar(){
  const d=document.querySelector('[data-nav="dashboard"]'), c=document.querySelector('[data-nav="cartera"]');
  const ej=document.querySelector('[data-nav="ejecucion"]'), rg=document.querySelector('[data-nav="riesgo"]');
  if(d) d.addEventListener('click',()=>{STATE.view='home';STATE.filterEtapa='';render();});
  if(c) c.addEventListener('click',()=>{STATE.view='home';render();});
  if(ej) ej.addEventListener('click',()=>{STATE.view='home';STATE.filterEtapa='8. Ejecución Física';render();});
  if(rg) rg.addEventListener('click',()=>{STATE.view='home';STATE.filterEtapa='0. En trámite de priorización';render();});
}

// ============ HOME ============
function renderHome(){
  const total=STATE.projects.length;
  const montoTotal=STATE.projects.reduce((a,p)=>a+(p.info.monto||0),0);
  const enEjecucion=STATE.projects.filter(p=>etapaIndex(p.situacion.etapa)===8).length;
  const enConvocatoria=STATE.projects.filter(p=>etapaIndex(p.situacion.etapa)===5).length;
  let filtered=STATE.projects.filter(p=>{
    const ms=!STATE.search||(p.info.nombre+p.cui).toLowerCase().includes(STATE.search.toLowerCase());
    const me=!STATE.filterEtapa||p.situacion.etapa===STATE.filterEtapa;
    return ms&&me;
  });
  const cards=filtered.map(p=>{
    const col=etapaColor(p.situacion.etapa);
    return `<div class="exd-project-card" data-cui="${p.cui}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <span style="font-size:12px;color:#9ca3af">CUI ${p.cui}</span>
        <span class="exd-badge" style="background:${col.bg};color:${col.text}">${escapeHtml(p.situacion.etapa)}</span>
      </div>
      <p style="font-size:14px;font-weight:600;margin:0 0 8px;line-height:1.4;color:#1f2937">${escapeHtml(p.info.nombre.length>105?p.info.nombre.slice(0,105)+'…':p.info.nombre)}</p>
      <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#6b7280">
        <span><i class="ti ti-map-pin"></i> ${escapeHtml(p.info.ubicacion)}</span>
        <span style="font-weight:600;color:#1f2937">${fmtMoney(p.info.monto)}</span>
      </div>
    </div>`;
  }).join('');
  const etapaOptions=ETAPAS.map(e=>`<option value="${escapeHtml(e)}" ${STATE.filterEtapa===e?'selected':''}>${escapeHtml(e)}</option>`).join('');
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:1.25rem">
      <div class="exd-card"><p class="exd-label">Proyectos</p><p style="font-size:22px;font-weight:700;margin:0">${total}</p></div>
      <div class="exd-card"><p class="exd-label">Monto total</p><p style="font-size:22px;font-weight:700;margin:0">${fmtMoney(montoTotal)}</p></div>
      <div class="exd-card"><p class="exd-label">En ejecución física</p><p style="font-size:22px;font-weight:700;margin:0;color:#0f9d58">${enEjecucion}</p></div>
      <div class="exd-card"><p class="exd-label">En convocatoria</p><p style="font-size:22px;font-weight:700;margin:0;color:#1d4ed8">${enConvocatoria}</p></div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:1rem">
      <input id="exd-search" class="exd-input" placeholder="Buscar por nombre o CUI" value="${escapeHtml(STATE.search)}" style="flex:2;background:#fff">
      <select id="exd-filter-etapa" class="exd-select" style="flex:1;background:#fff"><option value="">Todas las etapas</option>${etapaOptions}</select>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px">
      ${cards || '<p style="color:#6b7280;font-size:14px">No hay proyectos que coincidan con la búsqueda.</p>'}
    </div>
  `;
}
function wireHome(){
  document.getElementById('exd-search').addEventListener('input', e=>{
    const pos=e.target.selectionStart; STATE.search=e.target.value; render();
    const el=document.getElementById('exd-search'); el.focus(); el.setSelectionRange(pos,pos);
  });
  document.getElementById('exd-filter-etapa').addEventListener('change', e=>{ STATE.filterEtapa=e.target.value; render(); });
  document.querySelectorAll('.exd-project-card').forEach(c=>c.addEventListener('click',()=>{
    STATE.currentCui=Number(c.dataset.cui); STATE.view='detail'; STATE.activeTab='resumen'; render();
  }));
}

// ============ ANILLOS Y LÍNEA DE TIEMPO ============
function ring(pct,color){
  const R=27,C=2*Math.PI*R,dash=(pct/100)*C;
  return `<svg viewBox="0 0 64 64" style="width:58px;height:58px;flex-shrink:0">
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="6"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${C-dash}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2937">${Math.round(pct)}%</text>
  </svg>`;
}
function renderTimeline(p){
  const idx=etapaIndex(p.situacion.etapa);
  const fechas=p.etapaFechas||{};
  const steps=ETAPAS.map((e,i)=>{
    const label=etapaShort(e);
    let icon,bg,border,iconColor;
    if(i<idx){icon='ti-check';bg='#0f9d58';border='#0f9d58';iconColor='#fff';}
    else if(i===idx){icon='ti-point-filled';bg='#fff';border='#1d4ed8';iconColor='#1d4ed8';}
    else{icon='ti-clock';bg='#f3f4f6';border='#d1d5db';iconColor='#9ca3af';}
    const fecha = fechas[i] ? fmtDate(fechas[i]) : (i<=idx ? '' : 'Pendiente');
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:78px;position:relative">
      ${i<ETAPAS.length-1?`<div style="position:absolute;top:15px;left:50%;width:100%;height:2.5px;background:${i<idx?'#0f9d58':'#e5e7eb'};z-index:0"></div>`:''}
      <div style="width:30px;height:30px;border-radius:50%;background:${bg};border:2.5px solid ${border};display:flex;align-items:center;justify-content:center;z-index:1"><i class="ti ${icon}" style="font-size:15px;color:${iconColor}"></i></div>
      <p style="font-size:10.5px;text-align:center;margin:6px 0 0;color:${i===idx?'#1f2937':'#9ca3af'};font-weight:${i===idx?'700':'500'};max-width:78px;line-height:1.3">${escapeHtml(label)}</p>
      <p style="font-size:10px;text-align:center;margin:2px 0 0;color:#9ca3af">${escapeHtml(fecha)}</p>
    </div>`;
  }).join('');
  return `<div style="display:flex;align-items:flex-start;overflow-x:auto;padding:0.5rem 0.25rem 0.75rem">${steps}</div>
    <div style="display:flex;gap:18px;font-size:12px;color:#6b7280;padding-top:8px;border-top:1px solid #f0f0f0">
      <span><i class="ti ti-circle-filled" style="font-size:10px;color:#0f9d58"></i> Completado</span>
      <span><i class="ti ti-circle-filled" style="font-size:10px;color:#1d4ed8"></i> En curso</span>
      <span><i class="ti ti-circle-filled" style="font-size:10px;color:#d1d5db"></i> Pendiente</span>
    </div>`;
}

// ============ DETALLE DE PROYECTO ============
function renderDetail(cui){
  const p=getProject(cui);
  if(!p) return '<p>Proyecto no encontrado.</p>';
  const col=etapaColor(p.situacion.etapa);
  const lastLog=p.seguimientoLog[p.seguimientoLog.length-1];
  const nextAccion=p.proximasAcciones.find(a=>!a.hecho);
  const ro = !STATE.editMode; // read-only cuando no está en modo edición

  const tabs=[['resumen','ti-layout-grid','Resumen'],['seguimiento','ti-clock','Seguimiento'],['responsables','ti-users','Responsables']];
  const tabsHtml=tabs.map(([k,ic,l])=>`<div class="exd-tab ${STATE.activeTab===k?'active':''}" data-tab="${k}"><i class="ti ${ic}"></i>${l}</div>`).join('');

  let body='';
  if(STATE.activeTab==='resumen'){
    body=`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:1rem">
        <div class="exd-card">
          <p class="exd-label">Etapa actual</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <div style="width:34px;height:34px;border-radius:50%;background:#e7f0fd;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-flag" style="font-size:16px;color:#1d4ed8"></i></div>
            <p style="font-size:13.5px;font-weight:700;margin:0;line-height:1.3">${escapeHtml(etapaShort(p.situacion.etapa))}</p>
          </div>
        </div>
        <div class="exd-card">
          <p class="exd-label">Estado situacional</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <div style="width:34px;height:34px;border-radius:50%;background:#e6f6ee;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-circle-check" style="font-size:16px;color:#0f9d58"></i></div>
            <p style="font-size:13.5px;font-weight:700;margin:0">${escapeHtml(p.situacion.estado)}</p>
          </div>
        </div>
        <div class="exd-card" style="display:flex;align-items:center;gap:10px">${ring(p.situacion.avanceFisico,'#1d4ed8')}<p class="exd-label" style="margin:0">Avance físico</p></div>
        <div class="exd-card" style="display:flex;align-items:center;gap:10px">${ring(p.situacion.avanceFinanciero,'#0f9d58')}<p class="exd-label" style="margin:0">Avance financiero</p></div>
        <div class="exd-card">
          <p class="exd-label">Último seguimiento</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <div style="width:34px;height:34px;border-radius:50%;background:#f1ecfd;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-calendar-event" style="font-size:16px;color:#7c3aed"></i></div>
            <p style="font-size:13.5px;font-weight:700;margin:0">${lastLog?escapeHtml(fmtDate(lastLog.fecha)):'Sin registros'}</p>
          </div>
        </div>
      </div>
      <div class="exd-card" style="margin-bottom:14px">
        <h3 style="margin:0 0 4px;font-size:15px">Línea de tiempo del proyecto</h3>
        ${renderTimeline(p)}
      </div>
      <div class="exd-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px 20px">
        <div><p class="exd-label"><i class="ti ti-users-group" style="color:#0f9d58"></i> Unidad Formuladora</p><p class="exd-value">${escapeHtml(p.info.unidadFormuladora)}</p></div>
        <div><p class="exd-label"><i class="ti ti-building" style="color:#1d4ed8"></i> Unidad Ejecutora</p><p class="exd-value">${escapeHtml(p.info.unidadEjecutora)}</p></div>
        <div><p class="exd-label"><i class="ti ti-calendar" style="color:#e0a626"></i> Fecha de registro</p><p class="exd-value">${p.info.fechaRegistro?fmtDate(p.info.fechaRegistro):'Sin registrar'}</p></div>
        <div><p class="exd-label"><i class="ti ti-user" style="color:#7c3aed"></i> Responsable</p><p class="exd-value">${escapeHtml(p.info.responsable)}</p></div>
        <div><p class="exd-label"><i class="ti ti-flag-3" style="color:#c0392b"></i> Próximo hito</p><p class="exd-value">${nextAccion?escapeHtml(nextAccion.que)+(nextAccion.fechaLimite?' · '+fmtDate(nextAccion.fechaLimite):''):'Sin definir'}</p></div>
      </div>
    `;
  } else if(STATE.activeTab==='seguimiento'){
    const logItems=[...p.seguimientoLog].reverse().map(l=>`<div class="exd-logitem">
      <p style="font-size:12px;color:#9ca3af;margin:0 0 2px">${escapeHtml(fmtDate(l.fecha))}</p>
      <p style="font-size:13.5px;margin:0 0 2px"><b>Situación:</b> ${escapeHtml(l.situacionEncontrada)}</p>
      ${l.observacion?`<p style="font-size:12.5px;color:#6b7280;margin:0 0 2px">Observación: ${escapeHtml(l.observacion)}</p>`:''}
      ${l.accionRealizada?`<p style="font-size:12.5px;color:#6b7280;margin:0 0 2px">Acción: ${escapeHtml(l.accionRealizada)}</p>`:''}
      <p style="font-size:12px;color:#9ca3af;margin:0">Responsable: ${escapeHtml(l.responsable||'—')}</p>
    </div>`).join('') || '<p style="font-size:13px;color:#6b7280">Sin registros de seguimiento aún.</p>';
    body=`
      <div class="exd-card" style="margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
        <div><p class="exd-label">Etapa</p><select id="exd-etapa-select" class="exd-select" ${ro?'disabled':''}>${ETAPAS.map(e=>`<option value="${escapeHtml(e)}" ${p.situacion.etapa===e?'selected':''}>${escapeHtml(e)}</option>`).join('')}</select></div>
        <div><p class="exd-label">Avance físico (%)</p><input id="exd-avance-fisico" class="exd-input" type="number" min="0" max="100" value="${p.situacion.avanceFisico}" ${ro?'disabled':''}></div>
        <div><p class="exd-label">Avance financiero (%)</p><input id="exd-avance-financiero" class="exd-input" type="number" min="0" max="100" value="${p.situacion.avanceFinanciero}" ${ro?'disabled':''}></div>
      </div>
      <div class="exd-card">
        <h3 style="margin:0 0 12px;font-size:15px">Bitácora de seguimiento</h3>
        <div class="exd-loglist" style="margin-bottom:14px">${logItems}</div>
        ${STATE.editMode ? `
        <details>
          <summary style="cursor:pointer;font-size:13px;color:#1d4ed8;font-weight:600">+ Agregar registro de seguimiento</summary>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
            <textarea id="exd-log-situacion" class="exd-textarea" placeholder="Situación encontrada"></textarea>
            <textarea id="exd-log-obs" class="exd-textarea" placeholder="Observación"></textarea>
            <textarea id="exd-log-accion" class="exd-textarea" placeholder="Acción realizada"></textarea>
            <input id="exd-log-resp" class="exd-input" placeholder="Responsable">
            <button id="exd-log-save" class="exd-btn" style="align-self:flex-start">Agregar registro</button>
          </div>
        </details>` : `<p class="exd-lock-note"><i class="ti ti-lock"></i> Activa el modo edición para agregar registros.</p>`}
      </div>
    `;
  } else if(STATE.activeTab==='responsables'){
    const accionesItems=p.proximasAcciones.map((a,i)=>`
      <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0">
        <input type="checkbox" data-idx="${i}" class="exd-accion-check" ${a.hecho?'checked':''} ${ro?'disabled':''} style="margin-top:3px">
        <div style="flex:1">
          <p style="font-size:13.5px;margin:0;text-decoration:${a.hecho?'line-through':'none'};color:${a.hecho?'#9ca3af':'#1f2937'}">${escapeHtml(a.que)}</p>
          <p style="font-size:12px;color:#9ca3af;margin:2px 0 0">${escapeHtml(a.responsable||'Sin asignar')} ${a.fechaLimite?'· vence '+fmtDate(a.fechaLimite):''}</p>
        </div>
      </div>`).join('') || '<p style="font-size:13px;color:#6b7280">Sin próximas acciones registradas.</p>';
    body=`
      <div class="exd-card" style="margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div><p class="exd-label">Responsable OPIPS</p><input id="exd-resp-input" class="exd-input" value="${escapeHtml(p.info.responsable)}" ${ro?'disabled':''}></div>
        <div><p class="exd-label">Financista</p><input id="exd-fin-input" class="exd-input" value="${escapeHtml(p.info.financista)}" ${ro?'disabled':''}></div>
        <div><p class="exd-label">Unidad Formuladora</p><input id="exd-uf-input" class="exd-input" value="${escapeHtml(p.info.unidadFormuladora)}" ${ro?'disabled':''}></div>
        <div><p class="exd-label">Unidad Ejecutora</p><input id="exd-ue-input" class="exd-input" value="${escapeHtml(p.info.unidadEjecutora)}" ${ro?'disabled':''}></div>
      </div>
      <div class="exd-card">
        <h3 style="margin:0 0 12px;font-size:15px">Próximas acciones</h3>
        <div style="margin-bottom:14px">${accionesItems}</div>
        ${STATE.editMode ? `
        <details>
          <summary style="cursor:pointer;font-size:13px;color:#1d4ed8;font-weight:600">+ Agregar próxima acción</summary>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
            <input id="exd-accion-que" class="exd-input" placeholder="Qué se debe hacer">
            <input id="exd-accion-resp" class="exd-input" placeholder="Responsable">
            <input id="exd-accion-fecha" class="exd-input" type="date">
            <button id="exd-accion-save" class="exd-btn" style="align-self:flex-start">Agregar acción</button>
          </div>
        </details>` : `<p class="exd-lock-note"><i class="ti ti-lock"></i> Activa el modo edición para agregar acciones.</p>`}
      </div>
    `;
  }

  return `
    <button id="exd-back" style="background:transparent;border:none;color:#1d4ed8;font-size:13.5px;font-weight:600;cursor:pointer;padding:0;margin-bottom:14px">
      <i class="ti ti-arrow-left"></i> Volver a la cartera
    </button>
    <div class="exd-card" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <div style="display:flex;gap:12px;flex:1;min-width:260px">
        <div style="width:52px;height:52px;border-radius:50%;background:${col.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-building-community" style="font-size:24px;color:${col.text}"></i>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-size:16px;font-weight:700">CUI ${p.cui}</span>
            <span class="exd-badge" style="background:${col.bg};color:${col.text}">${escapeHtml(p.situacion.estado)}</span>
          </div>
          <p style="font-size:13.5px;margin:0 0 6px;line-height:1.4;font-weight:600">${escapeHtml(p.info.nombre)}</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#6b7280">
            <span><i class="ti ti-map-pin"></i> Provincia: ${escapeHtml(p.info.provincia)}</span>
            <span><i class="ti ti-map-2"></i> Distrito: ${escapeHtml(p.info.distrito)}</span>
            <span><i class="ti ti-category"></i> Función: ${escapeHtml(p.info.funcion)}</span>
          </div>
        </div>
      </div>
      <div style="background:#f7faf9;border-radius:10px;padding:0.85rem 1.1rem;min-width:190px">
        <p class="exd-label">Monto de inversión (S/)</p>
        <p style="font-size:17px;font-weight:700;margin:0 0 8px">${fmtMoney(p.info.monto)}</p>
        <p class="exd-label">Financista</p>
        <p style="font-size:13px;margin:0;font-weight:600">${escapeHtml(p.info.financista)}</p>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e9e7;margin-bottom:1rem">
      <div style="display:flex;gap:22px">${tabsHtml}</div>
      <button id="exd-go-docs" class="exd-btn-outline" style="margin-bottom:8px"><i class="ti ti-folder"></i> Documentos</button>
    </div>
    ${body}
    ${saveBarHtml()}
  `;
}

function wireDetail(){
  const cui=STATE.currentCui;
  document.getElementById('exd-back').addEventListener('click',()=>{STATE.view='home';render();});
  document.getElementById('exd-go-docs').addEventListener('click',()=>{STATE.view='documentos';render();});
  document.querySelectorAll('.exd-tab').forEach(t=>t.addEventListener('click',()=>{STATE.activeTab=t.dataset.tab;render();}));
  wireSaveBar();

  const etapaSel=document.getElementById('exd-etapa-select');
  if(etapaSel) etapaSel.addEventListener('change', e=>{
    const p=getProject(cui); p.situacion.etapa=e.target.value; p.situacion.ultimaActualizacion=todayISO();
    markDirty(); render();
  });
  const afInput=document.getElementById('exd-avance-fisico');
  if(afInput) afInput.addEventListener('change', e=>{
    const p=getProject(cui); let v=Number(e.target.value); if(isNaN(v)) v=0; v=Math.max(0,Math.min(100,v));
    p.situacion.avanceFisico=v; markDirty(); render();
  });
  const afinInput=document.getElementById('exd-avance-financiero');
  if(afinInput) afinInput.addEventListener('change', e=>{
    const p=getProject(cui); let v=Number(e.target.value); if(isNaN(v)) v=0; v=Math.max(0,Math.min(100,v));
    p.situacion.avanceFinanciero=v; markDirty(); render();
  });
  const logSave=document.getElementById('exd-log-save');
  if(logSave) logSave.addEventListener('click', ()=>{
    const situ=document.getElementById('exd-log-situacion').value.trim();
    if(!situ){ alert('Escribe la situación encontrada antes de guardar.'); return; }
    const p=getProject(cui);
    p.seguimientoLog.push({ fecha:todayISO(), situacionEncontrada:situ,
      observacion:document.getElementById('exd-log-obs').value.trim(),
      accionRealizada:document.getElementById('exd-log-accion').value.trim(),
      responsable:document.getElementById('exd-log-resp').value.trim() });
    p.situacion.ultimaActualizacion=todayISO();
    markDirty(); render();
  });
  const respInput=document.getElementById('exd-resp-input');
  if(respInput) respInput.addEventListener('change', e=>{ getProject(cui).info.responsable=e.target.value; markDirty(); });
  const finInput=document.getElementById('exd-fin-input');
  if(finInput) finInput.addEventListener('change', e=>{ getProject(cui).info.financista=e.target.value; markDirty(); render(); });
  const ufInput=document.getElementById('exd-uf-input');
  if(ufInput) ufInput.addEventListener('change', e=>{ getProject(cui).info.unidadFormuladora=e.target.value; markDirty(); });
  const ueInput=document.getElementById('exd-ue-input');
  if(ueInput) ueInput.addEventListener('change', e=>{ getProject(cui).info.unidadEjecutora=e.target.value; markDirty(); });
  const accionSave=document.getElementById('exd-accion-save');
  if(accionSave) accionSave.addEventListener('click', ()=>{
    const que=document.getElementById('exd-accion-que').value.trim();
    if(!que){ alert('Escribe qué se debe hacer antes de guardar.'); return; }
    const p=getProject(cui);
    p.proximasAcciones.push({ que, responsable:document.getElementById('exd-accion-resp').value.trim(),
      fechaLimite:document.getElementById('exd-accion-fecha').value, hecho:false });
    markDirty(); render();
  });
  document.querySelectorAll('.exd-accion-check').forEach(chk=>chk.addEventListener('change', e=>{
    getProject(cui).proximasAcciones[Number(e.target.dataset.idx)].hecho=e.target.checked;
    markDirty(); render();
  }));
}

// ============ DOCUMENTOS ============
function renderDocumentos(cui){
  const p=getProject(cui);
  if(!p) return '<p>Proyecto no encontrado.</p>';
  const byFase={}; ETAPAS.forEach(e=>byFase[e]=[]);
  p.documentos.forEach(d=>{ if(!byFase[d.fase]) byFase[d.fase]=[]; byFase[d.fase].push(d); });
  const groups=ETAPAS.map(fase=>{
    const docs=byFase[fase]||[];
    if(docs.length===0) return '';
    const items=docs.map(d=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f0f0f0">
        <div><p style="font-size:13.5px;margin:0;font-weight:600">${escapeHtml(d.nombre)}</p><p style="font-size:12px;color:#9ca3af;margin:2px 0 0">${escapeHtml(d.tipo||'Documento')} ${d.fecha?'· '+fmtDate(d.fecha):''}</p></div>
        ${d.link?`<a href="${escapeHtml(d.link)}" target="_blank" rel="noopener" style="font-size:12.5px;color:#1d4ed8;font-weight:600"><i class="ti ti-external-link"></i> Abrir</a>`:'<span style="font-size:12px;color:#9ca3af">Sin link</span>'}
      </div>`).join('');
    return `<div style="margin-bottom:16px"><p style="font-size:12.5px;font-weight:700;color:#4b5563;margin:0 0 6px">${escapeHtml(fase)}</p>${items}</div>`;
  }).join('');
  const faseOptions=ETAPAS.map(e=>`<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  return `
    <button id="exd-back-docs" style="background:transparent;border:none;color:#1d4ed8;font-size:13.5px;font-weight:600;cursor:pointer;padding:0;margin-bottom:14px">
      <i class="ti ti-arrow-left"></i> Volver al expediente
    </button>
    <p style="font-size:12px;color:#9ca3af;margin:0 0 2px">CUI ${p.cui}</p>
    <h2 style="margin:0 0 4px;font-size:18px">Documentos por fase</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 1.25rem">${escapeHtml(p.info.nombre.length>90?p.info.nombre.slice(0,90)+'…':p.info.nombre)}</p>
    <div class="exd-card" style="margin-bottom:14px">${groups || '<p style="font-size:13px;color:#6b7280">Aún no hay documentos registrados para este proyecto.</p>'}</div>
    ${STATE.editMode ? `
    <div class="exd-card">
      <h3 style="margin:0 0 12px;font-size:15px">Agregar documento</h3>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:420px">
        <input id="exd-doc-nombre" class="exd-input" placeholder="Nombre del documento">
        <select id="exd-doc-fase" class="exd-select">${faseOptions}</select>
        <input id="exd-doc-tipo" class="exd-input" placeholder="Tipo (informe, resolución, acta...)">
        <input id="exd-doc-fecha" class="exd-input" type="date">
        <input id="exd-doc-link" class="exd-input" placeholder="Link de Drive (https://...)">
        <button id="exd-doc-save" class="exd-btn" style="align-self:flex-start">Agregar documento</button>
      </div>
    </div>` : `<p class="exd-lock-note"><i class="ti ti-lock"></i> Activa el modo edición para agregar documentos.</p>`}
    ${saveBarHtml()}
  `;
}
function wireDocumentos(){
  const cui=STATE.currentCui;
  document.getElementById('exd-back-docs').addEventListener('click',()=>{STATE.view='detail';render();});
  wireSaveBar();
  const docSave=document.getElementById('exd-doc-save');
  if(docSave) docSave.addEventListener('click', ()=>{
    const nombre=document.getElementById('exd-doc-nombre').value.trim();
    if(!nombre){ alert('Escribe el nombre del documento antes de guardar.'); return; }
    const p=getProject(cui);
    p.documentos.push({ nombre, fase:document.getElementById('exd-doc-fase').value,
      tipo:document.getElementById('exd-doc-tipo').value.trim(), fecha:document.getElementById('exd-doc-fecha').value,
      link:document.getElementById('exd-doc-link').value.trim() });
    markDirty(); render();
  });
}

// ============ ARRANQUE ============
document.getElementById('exd-edit-toggle').addEventListener('click', toggleEditMode);
window.addEventListener('beforeunload', e => { if (STATE.dirty){ e.preventDefault(); e.returnValue=''; } });
loadData();
