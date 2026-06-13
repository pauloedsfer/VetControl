/**
 * CONTROLADOS v3.2 — R S O MANIPULAÇÃO ANIMAL
 * Novidades v3.2:
 *  - Tudo em MAIÚSCULAS ao processar
 *  - Cadastro de endereço vinculado ao tutor
 *  - Período automático (datas min/max)
 *  - Cadastro de Prescritor + CRMV
 *  - Validação automática (campos faltantes)
 *  - Filtro na tabela de revisão
 *  - Alerta de estoque negativo
 *  - Lembrete de backup (7 dias)
 *  - Resumo para fiscalização MAPA
 */

// ══════════ CONSTANTES ══════════

const SUBSTANCIAS = [
  { nome: 'Gabapentina',   lista: 'C1', dcb: '04369' },
  { nome: 'Fluoxetina',    lista: 'C1', dcb: '03094' },
  { nome: 'Amitriptilina', lista: 'C1', dcb: '00423' },
  { nome: 'Selegilina',    lista: 'C1', dcb: '07929' },
  { nome: 'Tramadol',      lista: 'A2', dcb: '08806' },
  { nome: 'Codeína',       lista: 'A2', dcb: '01706' },
  { nome: 'Ribavirina',    lista: 'C1', dcb: '07168' },
];
const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const LS_HIST    = 'controlados_fa_v2';
const LS_CPF     = 'controlados_cpfs';
const LS_ENDER   = 'controlados_enderecos';
const LS_PRESC   = 'controlados_prescritores';
const LS_MOV     = 'controlados_movimentos';
const LS_BACKUP  = 'controlados_ultimo_backup';

// ══════════ ESTADO ══════════

let dadosMov = null, dadosCE = null, dadosCruzados = [], xlsxBlob = null, ultimoEstoquesFinal = {};

// ══════════ HELPERS ══════════

function arred(n){ return Math.round((n||0)*10000)/10000; }
function fmtData(d){
  if(!d) return '';
  if(typeof d==='string'){ const dt=new Date(d); if(!isNaN(dt)) d=dt; else return d; }
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function fmtDataISO(d){ if(!d) return ''; return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseDataBR(s){
  if(!s) return null;
  const p=String(s).split('/'); if(p.length!==3) return null;
  const y=parseInt(p[2])<100?2000+parseInt(p[2]):parseInt(p[2]);
  return new Date(y, parseInt(p[1])-1, parseInt(p[0]));
}
function upper(s){ return String(s||'').toUpperCase().replace(/\s+/g,' ').trim(); }
function normNome(s){ return upper(s); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function esc(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function setProgress(p,t){ document.getElementById('progress-wrap').classList.add('visible'); document.getElementById('progress-bar').style.width=p+'%'; document.getElementById('progress-text').textContent=t; }
function log(m,t){ const b=document.getElementById('log-box'); b.classList.add('visible'); const l=document.createElement('div'); if(t)l.className='log-'+t; l.textContent=m; b.appendChild(l); b.scrollTop=b.scrollHeight; }
function checkReady(){ document.getElementById('btn-processar').disabled=!(dadosMov&&dadosCE); }
function formatCPF(v){ const d=v.replace(/\D/g,'').slice(0,11); if(d.length<=3)return d; if(d.length<=6)return d.slice(0,3)+'.'+d.slice(3); if(d.length<=9)return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6); return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9); }

function gerarPeriodoLabel(datas){
  if(!datas.length) return '';
  const min=new Date(Math.min(...datas)), max=new Date(Math.max(...datas));
  const mi=MESES[min.getMonth()], mf=MESES[max.getMonth()], a=max.getFullYear();
  return mi===mf ? mi+'/'+a : mi+'-'+mf+'/'+a;
}

function identificarSubstancia(nomeFF){
  if(!nomeFF) return null;
  const u=nomeFF.toUpperCase();
  for(const s of SUBSTANCIAS){ if(u.includes(s.nome.toUpperCase())||nomeFF.includes(s.dcb)) return s.nome; }
  return null;
}

// ══════════ LOCALSTORAGE — GENÉRICO ══════════

function lsLoad(k,def){ try{ return JSON.parse(localStorage.getItem(k))||def; }catch(e){ return def; } }
function lsSave(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

// Histórico
function loadHistorico(){ return lsLoad(LS_HIST,[]); }
function saveHistorico(h){ lsSave(LS_HIST,h); }
function ultimoEstoqueFinal(n){ const h=loadHistorico(); for(let i=h.length-1;i>=0;i--){ if(h[i].estoquesFinal&&h[i].estoquesFinal[n]!==undefined) return h[i].estoquesFinal[n]; } return 0; }

// CPF
function loadCPFs(){ return lsLoad(LS_CPF,{}); }
function saveCPFs(c){ lsSave(LS_CPF,c); }
function getCPF(nome){ return loadCPFs()[normNome(nome)]||''; }
function setCPF(nome,cpf){ if(!nome) return; const c=loadCPFs(); const k=normNome(nome); if(cpf&&cpf.trim()) c[k]=cpf.trim(); else delete c[k]; saveCPFs(c); }

// Endereço
function loadEnderecos(){ return lsLoad(LS_ENDER,{}); }
function saveEnderecos(e){ lsSave(LS_ENDER,e); }
function getEndereco(nome){ return loadEnderecos()[normNome(nome)]||''; }
function setEndereco(nome,end){ if(!nome) return; const e=loadEnderecos(); const k=normNome(nome); if(end&&end.trim()) e[k]=upper(end); else delete e[k]; saveEnderecos(e); }

// Prescritor
function loadPrescritores(){ return lsLoad(LS_PRESC,{}); }
function savePrescritores(p){ lsSave(LS_PRESC,p); }
function getPrescritor(nome){ return loadPrescritores()[normNome(nome)]||{}; }
function setPrescritor(nome,crmv){ if(!nome) return; const p=loadPrescritores(); p[normNome(nome)]={crmv:String(crmv||'').trim()}; savePrescritores(p); }

// Movimentos
function loadMovimentos(){ return lsLoad(LS_MOV,{}); }
function saveMovimentos(m){ lsSave(LS_MOV,m); }
function getSubstMovimentos(n){ const a=loadMovimentos(); if(!a[n]) a[n]={estoqueInicial:0,lancamentos:[]}; return a[n]; }
function recalcularSaldos(n){ const a=loadMovimentos(); const s=a[n]; if(!s) return 0; s.lancamentos.sort((x,y)=>(x.data||'').localeCompare(y.data||'')); let saldo=s.estoqueInicial||0; for(const l of s.lancamentos){ if(l.tipo==='entrada') saldo=arred(saldo+l.qtd); else saldo=arred(saldo-l.qtd); l.saldoApos=saldo; } saveMovimentos(a); return saldo; }
function adicionarLancamento(n,l){ const a=loadMovimentos(); if(!a[n]) a[n]={estoqueInicial:0,lancamentos:[]}; a[n].lancamentos.push(l); saveMovimentos(a); recalcularSaldos(n); }
function removerLancamento(n,id){ const a=loadMovimentos(); if(!a[n]) return; a[n].lancamentos=a[n].lancamentos.filter(l=>l.id!==id); saveMovimentos(a); recalcularSaldos(n); }
function setEstoqueInicialMov(n,v){ const a=loadMovimentos(); if(!a[n]) a[n]={estoqueInicial:0,lancamentos:[]}; a[n].estoqueInicial=v; saveMovimentos(a); recalcularSaldos(n); }

function importarSaidasParaMovimentos(dados){
  const a=loadMovimentos();
  for(const d of dados){
    if(d.status!=='ATIVA') continue;
    const n=identificarSubstancia(d.substancia); if(!n) continue;
    if(!a[n]) a[n]={estoqueInicial:0,lancamentos:[]};
    const ex=a[n].lancamentos.find(l=>l.nrOm===d.nrOm&&l.tipo==='saida');
    if(ex){ ex.qtd=d.qtdG||0; ex.data=d.data?fmtDataISO(d.data):''; ex.descricao='OM '+d.nrOm+' / DOC '+d.nrDoc; }
    else{ a[n].lancamentos.push({id:'imp_'+uid(),tipo:'saida',data:d.data?fmtDataISO(d.data):'',qtd:d.qtdG||0,descricao:'OM '+d.nrOm+' / DOC '+d.nrDoc,nrOm:d.nrOm,nrDoc:d.nrDoc,origem:'importado'}); }
  }
  saveMovimentos(a);
  for(const n of Object.keys(a)) recalcularSaldos(n);
}

// Backup tracking
function markBackup(){ localStorage.setItem(LS_BACKUP,new Date().toISOString()); }
function checkBackupReminder(){
  const last=localStorage.getItem(LS_BACKUP);
  if(!last||Date.now()-new Date(last).getTime()>7*86400000) document.getElementById('backup-reminder').classList.add('visible');
}
function dismissReminder(){ document.getElementById('backup-reminder').classList.remove('visible'); }

// ══════════ TABS ══════════

function switchTab(id,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='historico') renderHistorico();
  if(id==='movimentos') renderMovimentos();
}

// ══════════ ESTOQUE GRID ══════════

function montarEstGrid(){
  const g=document.getElementById('est-grid'); g.innerHTML='';
  SUBSTANCIAS.forEach(s=>{
    const u=ultimoEstoqueFinal(s.nome);
    const d=document.createElement('div'); d.className='est-field';
    d.innerHTML=`<div class="subst-name">${s.nome}</div><label>Lista ${s.lista} · DCB ${s.dcb}</label>
      <input type="number" id="est-${s.nome}" value="${u}" step="0.0001" min="0" />
      <div class="last-val">${u>0?'↑ anterior: '+u.toFixed(4)+' g':'Sem histórico'}</div>`;
    g.appendChild(d);
  });
}
function getEstoqueInicial(){ const e={}; SUBSTANCIAS.forEach(s=>{ const i=document.getElementById('est-'+s.nome); e[s.nome]=i?(parseFloat(i.value)||0):0; }); return e; }

// ══════════ UPLOAD ══════════

function setupDrop(zId,iId,fId,tipo){
  const z=document.getElementById(zId),inp=document.getElementById(iId),fn=document.getElementById(fId);
  inp.addEventListener('change',e=>{ if(e.target.files[0]) readXLS(e.target.files[0],tipo,fn,z); });
  z.addEventListener('dragover',e=>{ e.preventDefault(); z.classList.add('drag-over'); });
  z.addEventListener('dragleave',()=>z.classList.remove('drag-over'));
  z.addEventListener('drop',e=>{ e.preventDefault(); z.classList.remove('drag-over'); if(e.dataTransfer.files[0]) readXLS(e.dataTransfer.files[0],tipo,fn,z); });
}
function readXLS(file,tipo,fn,z){
  const r=new FileReader();
  r.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',codepage:1252});
      const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
      if(tipo==='mov'){ dadosMov=raw; fn.textContent='✓ '+file.name; z.classList.add('ready'); log('MOVIMENTO: '+raw.length+' linhas','ok'); }
      else{ dadosCE=raw; fn.textContent='✓ '+file.name; z.classList.add('ready'); log('CLIENTE_END: '+raw.length+' linhas','ok'); }
      checkReady();
    }catch(err){ log('Erro: '+err.message,'err'); }
  };
  r.readAsArrayBuffer(file);
}

// ══════════ EXTRAÇÃO ══════════

function extrairMovimento(raw){
  const recs=[]; let subst='',lista='';
  function c(row,i){ if(!row) return ''; const v=row[i]; return(v!==undefined&&v!==null)?String(v).trim():''; }
  function ln(v){ const n=parseFloat(String(v)); return(!isNaN(n)&&String(v).trim()===String(n))?String(Math.round(n)):String(v).trim(); }
  for(let r=0;r<raw.length;r++){
    const row=raw[r];
    if(String(row[6]||'').includes('Produto:')){ subst=c(row,8); lista=c(row,3); continue; }
    if(c(row,4)==='O.M.'){
      let dt=parseDataBR(c(row,0)); let qtdG=null;
      try{ qtdG=parseFloat(String(row[17]).replace(',','.')); }catch(e){}
      const crmvRaw=c(row,20), crmvNr=crmvRaw.replace(/CRMV\s+\w+:\s*/i,'').trim();
      recs.push({substancia:subst,lista,data:dt,dataStr:c(row,0),tutor:c(row,7),
        nrOm:ln(row[11]),nrDoc:ln(row[12]),calculo:c(row,15),qtdG,crmvRaw,crmvNr,nrReceita:ln(row[25])});
    }
  }
  return recs;
}

function extrairClienteEnd(raw){
  const dados={};
  function c(r,i){ if(r<0||r>=raw.length) return ''; const v=raw[r][i]; return(v!==undefined&&v!==null)?String(v).trim():''; }
  for(let r=0;r<raw.length;r++){
    const st=c(r,12); if(st!=='Ativa'&&st!=='Cancelada') continue;
    const nrRaw=c(r,36); let nr=nrRaw; const nrF=parseFloat(nrRaw); if(!isNaN(nrF)) nr=String(Math.round(nrF));
    const cliente=(c(r,37)+' '+c(r+1,37)).trim();
    const end1=c(r,52),end2=c(r+1,52);
    const endereco=(end1+' '+end2).trim().replace(/(\d+)\.0\b/g,'$1');
    let prescritor='',crmvNr='',qtdeTexto='',formula='',doseMg='';
    for(let off=3;off<10;off++){
      if(r+off>=raw.length) break;
      if(c(r+off,0)==='Prescritor:'){
        const pr=r+off;
        const p1=c(pr,11),p2=(c(pr+1,0)==='')?c(pr+1,11):'';
        prescritor=(p1+' '+p2).trim();
        const cv=c(pr,43),cvF=parseFloat(cv); crmvNr=!isNaN(cvF)?String(Math.round(cvF)):cv;
        qtdeTexto=c(pr,59);
        const fr=pr+2;
        if(fr<raw.length){ formula=c(fr,43); const dr=c(fr,64); const drF=parseFloat(dr); doseMg=!isNaN(drF)?drF:dr; }
        break;
      }
    }
    dados[nr]={status:st,cliente,endereco,prescritor,crmvNr,qtdeTexto,formula,doseMg};
  }
  return dados;
}

// ══════════ CRUZAMENTO (MAIÚSCULAS + CADASTROS) ══════════

function cruzar(movs,ced){
  return movs.map(m=>{
    const ce=ced[m.nrOm]||{};
    const tutor=upper(ce.cliente||m.tutor);
    const prescritor=upper(ce.prescritor||'');
    const crmv=String(ce.crmvNr||m.crmvNr||'').trim();
    // Lookup cadastros
    const cpf=getCPF(tutor);
    const endCad=getEndereco(tutor);
    const endereco=upper(ce.endereco)||endCad||'';
    const prescCad=getPrescritor(prescritor);
    const crmvFinal=crmv||prescCad.crmv||'';
    return { ...m,
      substancia:upper(m.substancia), lista:upper(m.lista),
      clienteFull:tutor, endereco, cpf,
      prescritor, crmvNrCE:crmvFinal, crmvNr:crmvFinal,
      calculo:upper(m.calculo),
      qtdeTexto:ce.qtdeTexto||'', doseMg:ce.doseMg||'',
      status:upper(ce.status||'ATIVA'),
      nrReceita:m.nrReceita, nrOm:m.nrOm, nrDoc:m.nrDoc,
      _selected:false, _issues:[],
    };
  });
}

// ══════════ VALIDAÇÃO ══════════

function validarRegistros(dados){
  let total=0;
  const oms={};
  dados.forEach(d=>{
    d._issues=[];
    if(d.status!=='ATIVA') return;
    if(!d.cpf) d._issues.push('CPF');
    if(!d.endereco) d._issues.push('Endereço');
    if(!d.prescritor) d._issues.push('Prescritor');
    if(!d.crmvNrCE) d._issues.push('CRMV');
    if(!d.nrReceita) d._issues.push('Nº Receita');
    if(!d.qtdG||d.qtdG===0) d._issues.push('Qtd zero');
    const omKey=d.nrOm+'_'+d.substancia;
    if(d.nrOm&&oms[omKey]) d._issues.push('OM duplicado');
    oms[omKey]=true;
    if(d._issues.length) total++;
  });
  return total;
}

function verificarEstoqueNegativo(estInicial,dados){
  const alertas=[];
  for(const s of SUBSTANCIAS){
    const ds=dados.filter(d=>identificarSubstancia(d.substancia)===s.nome&&d.status==='ATIVA');
    const totalSaida=arred(ds.reduce((a,d)=>a+(d.qtdG||0),0));
    const fin=arred((estInicial[s.nome]||0)-totalSaida);
    if(fin<0) alertas.push(`${s.nome}: saldo negativo (${fin.toFixed(4)} g). Verifique estoque inicial ou entradas faltantes.`);
  }
  return alertas;
}

// ══════════ PROCESSAR ══════════

document.getElementById('btn-processar').addEventListener('click',async()=>{
  document.getElementById('log-box').innerHTML='';
  document.getElementById('result-card').classList.remove('visible');
  document.getElementById('rev-wrap').classList.remove('visible');
  xlsxBlob=null;

  const btn=document.getElementById('btn-processar');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Processando...';
  await new Promise(r=>setTimeout(r,50));

  try{
    setProgress(10,'Lendo MOVIMENTO.XLS...');
    const movs=extrairMovimento(dadosMov);
    log('Movimento: '+movs.length+' dispensações','ok');

    setProgress(40,'Lendo CLIENTE_END.XLS...');
    const ced=extrairClienteEnd(dadosCE);
    log('Receituário: '+Object.keys(ced).length+' registros','ok');

    setProgress(60,'Cruzando e padronizando...');
    dadosCruzados=cruzar(movs,ced);

    // Período automático
    const datas=dadosCruzados.filter(d=>d.data).map(d=>d.data);
    const periodoAuto=gerarPeriodoLabel(datas);
    if(periodoAuto) document.getElementById('periodo-label').value=periodoAuto;

    setProgress(75,'Validando...');
    const nIssues=validarRegistros(dadosCruzados);
    if(nIssues>0) log('⚠ '+nIssues+' registros com campos incompletos','warn');

    // Verificar estoque negativo
    const estInicial=getEstoqueInicial();
    const estAlerts=verificarEstoqueNegativo(estInicial,dadosCruzados);
    const stockEl=document.getElementById('stock-alert');
    if(estAlerts.length){ stockEl.innerHTML='⚠ <strong>Estoque negativo detectado:</strong><br>'+estAlerts.join('<br>'); stockEl.style.display='block'; }
    else stockEl.style.display='none';

    // Validação alert
    const valEl=document.getElementById('validation-alert');
    if(nIssues>0){ valEl.innerHTML='⚠ <strong>'+nIssues+' registro(s)</strong> com campos incompletos (marcados em amarelo). Corrija antes de gerar.'; valEl.style.display='block'; }
    else valEl.style.display='none';

    // Popular filtro de substância
    const substSet=[...new Set(dadosCruzados.map(d=>d.substancia))];
    document.getElementById('filter-subst').innerHTML='<option value="">Todas substâncias</option>'+substSet.map(s=>'<option value="'+s+'">'+s+'</option>').join('');

    setProgress(100,'Dados prontos para revisão');
    log('Revise os dados abaixo e clique em Gerar Planilha Final.','ok');
    renderRevisao();
    document.getElementById('rev-wrap').classList.add('visible');
    document.getElementById('rev-wrap').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){ log('ERRO: '+err.message,'err'); console.error(err); }
  finally{
    btn.disabled=false;
    btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Processar Dados';
    checkReady();
  }
});

// ══════════ TABELA DE REVISÃO ══════════

function renderRevisao(){
  const table=document.getElementById('rev-table');
  const semCPF=dadosCruzados.filter(d=>d.status==='ATIVA'&&!d.cpf);
  const alertEl=document.getElementById('cpf-alert');
  if(semCPF.length>0){
    const nomes=[...new Set(semCPF.map(d=>d.clienteFull))];
    alertEl.innerHTML='⚠ <strong>'+nomes.length+' tutor(es)</strong> sem CPF ('+semCPF.length+' dispensações).';
    alertEl.style.display='block';
  } else alertEl.style.display='none';

  let html='<thead><tr>'+
    '<th style="width:30px"><input type="checkbox" id="rev-check-all" onchange="toggleSelectAll(this.checked)" /></th>'+
    '<th>#</th><th>Substância</th><th>Data</th><th>OM</th><th>Doc</th>'+
    '<th style="min-width:130px">Tutor</th><th style="min-width:110px">CPF</th>'+
    '<th style="min-width:160px">Endereço</th><th style="min-width:120px">Prescritor</th>'+
    '<th>CRMV</th><th style="min-width:100px">Concentração</th><th>Qtd(g)</th>'+
    '<th>Receita</th><th>Status</th><th style="width:20px"></th>'+
  '</tr></thead><tbody>';

  const ft=document.getElementById('filter-text').value.toUpperCase();
  const fs=document.getElementById('filter-subst').value;

  dadosCruzados.forEach((d,i)=>{
    // Filtro
    if(fs&&d.substancia!==fs) return;
    if(ft&&!d.clienteFull.includes(ft)&&!d.prescritor.includes(ft)&&!d.nrOm.includes(ft)&&!(d.substancia||'').includes(ft)) return;

    const hasIssue=d._issues&&d._issues.length>0&&d.status==='ATIVA';
    const cls=d.status==='CANCELADA'?' class="row-cancelada"':(hasIssue?' class="row-warn"':'');
    const cpfCls=(d.status==='ATIVA'&&!d.cpf)?'cpf-missing':(d.cpf?'cpf-ok':'');
    const chk=d._selected?' checked':'';
    const issueHtml=hasIssue?'<div class="rev-issues">⚠ '+d._issues.join(', ')+'</div>':'';
    html+='<tr'+cls+'>'+
      '<td><input type="checkbox" data-i="'+i+'" onchange="toggleSelect(this)"'+chk+' /></td>'+
      '<td>'+(i+1)+'</td>'+
      '<td>'+d.substancia+'</td>'+
      '<td>'+(d.data?fmtData(d.data):d.dataStr)+'</td>'+
      '<td>'+d.nrOm+'</td><td>'+d.nrDoc+'</td>'+
      '<td><input value="'+esc(d.clienteFull)+'" data-i="'+i+'" data-f="clienteFull" onchange="revEdit(this)" /></td>'+
      '<td><input value="'+esc(d.cpf)+'" data-i="'+i+'" data-f="cpf" class="'+cpfCls+'" oninput="this.value=formatCPF(this.value)" onchange="revEditCPF(this)" placeholder="000.000.000-00" /></td>'+
      '<td><input value="'+esc(d.endereco)+'" data-i="'+i+'" data-f="endereco" onchange="revEditEndereco(this)" /></td>'+
      '<td><input value="'+esc(d.prescritor)+'" data-i="'+i+'" data-f="prescritor" onchange="revEditPrescritor(this)" /></td>'+
      '<td><input value="'+esc(d.crmvNrCE)+'" data-i="'+i+'" data-f="crmvNrCE" onchange="revEditCRMV(this)" style="width:70px" /></td>'+
      '<td><input value="'+esc(d.calculo)+'" data-i="'+i+'" data-f="calculo" onchange="revEdit(this)" /></td>'+
      '<td><input type="number" value="'+(d.qtdG||'')+'" data-i="'+i+'" data-f="qtdG" onchange="revEdit(this)" step="0.0001" style="width:70px" /></td>'+
      '<td><input value="'+esc(d.nrReceita)+'" data-i="'+i+'" data-f="nrReceita" onchange="revEdit(this)" style="width:80px" /></td>'+
      '<td><select data-i="'+i+'" data-f="status" onchange="revEdit(this)"><option value="ATIVA"'+(d.status==='ATIVA'?' selected':'')+'>Ativa</option><option value="CANCELADA"'+(d.status==='CANCELADA'?' selected':'')+'>Cancelada</option></select></td>'+
      '<td>'+issueHtml+'</td>'+
    '</tr>';
  });
  html+='</tbody>';
  table.innerHTML=html;
  updateSelCount();
  const vis=dadosCruzados.filter(d=>{ if(fs&&d.substancia!==fs) return false; if(ft&&!d.clienteFull.includes(ft)&&!d.prescritor.includes(ft)&&!d.nrOm.includes(ft)&&!(d.substancia||'').includes(ft)) return false; return true; });
  document.getElementById('rev-count').textContent=vis.length+' visíveis · '+dadosCruzados.filter(d=>d.status==='ATIVA').length+' ativos de '+dadosCruzados.length;
}

function filtrarRevisao(){ renderRevisao(); }

function revEdit(el){ const i=+el.dataset.i,f=el.dataset.f; if(f==='qtdG') dadosCruzados[i][f]=parseFloat(el.value)||0; else dadosCruzados[i][f]=upper(el.value); }

function revEditCPF(el){
  const i=+el.dataset.i, cpf=el.value; dadosCruzados[i].cpf=cpf;
  setCPF(dadosCruzados[i].clienteFull,cpf);
  const k=normNome(dadosCruzados[i].clienteFull);
  dadosCruzados.forEach((d,j)=>{ if(j!==i&&normNome(d.clienteFull)===k) d.cpf=cpf; });
  renderRevisao();
}

function revEditEndereco(el){
  const i=+el.dataset.i, end=upper(el.value); dadosCruzados[i].endereco=end;
  setEndereco(dadosCruzados[i].clienteFull,end);
  const k=normNome(dadosCruzados[i].clienteFull);
  dadosCruzados.forEach((d,j)=>{ if(j!==i&&normNome(d.clienteFull)===k) d.endereco=end; });
}

function revEditPrescritor(el){
  const i=+el.dataset.i, nome=upper(el.value); dadosCruzados[i].prescritor=nome;
  // Se já temos CRMV cadastrado para esse prescritor, preencher
  const cad=getPrescritor(nome);
  if(cad.crmv){ dadosCruzados[i].crmvNrCE=cad.crmv; renderRevisao(); }
}

function revEditCRMV(el){
  const i=+el.dataset.i, crmv=el.value.trim(); dadosCruzados[i].crmvNrCE=crmv;
  if(dadosCruzados[i].prescritor&&crmv) setPrescritor(dadosCruzados[i].prescritor,crmv);
}

// Seleção
function toggleSelect(el){ dadosCruzados[+el.dataset.i]._selected=el.checked; updateSelCount(); }
function toggleSelectAll(chk){ dadosCruzados.forEach(d=>{d._selected=chk;}); document.querySelectorAll('#rev-table input[type="checkbox"]').forEach(cb=>{cb.checked=chk;}); updateSelCount(); }
function updateSelCount(){ const n=dadosCruzados.filter(d=>d._selected).length; const el=document.getElementById('sel-count'); if(el) el.textContent=n>0?n+' selecionado(s)':''; }
function getSelectedDados(src){
  const d=src||dadosCruzados;
  const sel=d.filter(x=>x._selected&&x.status==='ATIVA');
  return sel.length>0?sel:d.filter(x=>x.status==='ATIVA');
}

// ══════════ MODAIS ══════════

function abrirCPFModal(){
  const cpfs=loadCPFs(); const entries=Object.entries(cpfs).sort((a,b)=>a[0].localeCompare(b[0]));
  const el=document.getElementById('cpf-lista');
  if(!entries.length){ el.innerHTML='<p style="color:var(--muted);font-family:var(--mono);font-size:.75rem">Nenhum CPF cadastrado.</p>'; }
  else{
    let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.72rem"><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">TUTOR</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">CPF</th><th style="width:30px"></th></tr>';
    entries.forEach(([n,c])=>{
      const sn=n.replace(/'/g,"\\'"); h+='<tr><td style="padding:4px 6px;border-bottom:1px solid var(--border)">'+esc(n)+'</td><td style="padding:4px 6px;border-bottom:1px solid var(--border)"><input value="'+esc(c)+'" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:.72rem;padding:2px 6px;width:130px" oninput="this.value=formatCPF(this.value)" onchange="setCPF(\''+sn+'\',this.value)" /></td><td><button class="btn-danger" style="font-size:.6rem;padding:2px 6px" onclick="setCPF(\''+sn+'\',\'\');this.closest(\'tr\').remove()">✕</button></td></tr>';
    });
    h+='</table>'; el.innerHTML=h;
  }
  document.getElementById('cpf-modal').classList.add('active');
}
function fecharCPFModal(){ document.getElementById('cpf-modal').classList.remove('active'); if(document.getElementById('rev-wrap').classList.contains('visible')){ const c=loadCPFs(); dadosCruzados.forEach(d=>{d.cpf=c[normNome(d.clienteFull)]||d.cpf||'';}); renderRevisao(); } }

function abrirPrescritorModal(){
  const presc=loadPrescritores(); const entries=Object.entries(presc).sort((a,b)=>a[0].localeCompare(b[0]));
  const el=document.getElementById('prescritor-lista');
  if(!entries.length){ el.innerHTML='<p style="color:var(--muted);font-family:var(--mono);font-size:.75rem">Nenhum prescritor cadastrado.</p>'; }
  else{
    let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.72rem"><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">PRESCRITOR</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">CRMV</th><th style="width:30px"></th></tr>';
    entries.forEach(([n,v])=>{
      const sn=n.replace(/'/g,"\\'"); h+='<tr><td style="padding:4px 6px;border-bottom:1px solid var(--border)">'+esc(n)+'</td><td style="padding:4px 6px;border-bottom:1px solid var(--border)"><input value="'+esc(v.crmv||'')+'" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:.72rem;padding:2px 6px;width:100px" onchange="setPrescritor(\''+sn+'\',this.value)" /></td><td><button class="btn-danger" style="font-size:.6rem;padding:2px 6px" onclick="const p=loadPrescritores();delete p[\''+sn+'\'];savePrescritores(p);this.closest(\'tr\').remove()">✕</button></td></tr>';
    });
    h+='</table>'; el.innerHTML=h;
  }
  document.getElementById('prescritor-modal').classList.add('active');
}
function fecharPrescritorModal(){ document.getElementById('prescritor-modal').classList.remove('active'); }

function limparCadastro(tipo){
  if(!confirm('Limpar todo o cadastro de '+(tipo==='cpf'?'CPFs':'Prescritores')+'?')) return;
  if(tipo==='cpf'){ saveCPFs({}); abrirCPFModal(); }
  else{ savePrescritores({}); abrirPrescritorModal(); }
}

document.getElementById('cpf-modal').addEventListener('click',function(e){ if(e.target===this) fecharCPFModal(); });
document.getElementById('prescritor-modal').addEventListener('click',function(e){ if(e.target===this) fecharPrescritorModal(); });

// ══════════ GERAR PLANILHA ══════════

document.getElementById('btn-gerar').addEventListener('click',async()=>{
  if(!dadosCruzados.length) return;
  const nomeEstab=upper(document.getElementById('estabelecimento').value)||'R S O MANIPULAÇÃO ANIMAL';
  const periodoLabel=document.getElementById('periodo-label').value.trim();
  const estInicial=getEstoqueInicial();

  // Salvar endereços e prescritores dos dados editados
  dadosCruzados.forEach(d=>{
    if(d.status==='ATIVA'){
      if(d.endereco) setEndereco(d.clienteFull,d.endereco);
      if(d.prescritor&&d.crmvNrCE) setPrescritor(d.prescritor,d.crmvNrCE);
    }
  });

  const btn=document.getElementById('btn-gerar');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Gerando...';
  await new Promise(r=>setTimeout(r,50));

  try{
    setProgress(30,'Gerando Excel...');
    const{blob,estoquesFinal}=gerarExcel(dadosCruzados,estInicial,nomeEstab,periodoLabel);
    xlsxBlob=blob; ultimoEstoquesFinal=estoquesFinal;

    setProgress(60,'Salvando histórico...');
    salvarNoHistorico(dadosCruzados,estInicial,estoquesFinal,periodoLabel,nomeEstab);

    setProgress(80,'Registrando movimentos...');
    SUBSTANCIAS.forEach(s=>setEstoqueInicialMov(s.nome,estInicial[s.nome]||0));
    importarSaidasParaMovimentos(dadosCruzados);
    montarEstGrid();
    setProgress(100,'Concluído!');

    const ativas=dadosCruzados.filter(d=>d.status==='ATIVA');
    const totalG=ativas.reduce((a,d)=>a+(d.qtdG||0),0);
    document.getElementById('stats-grid').innerHTML=
      [{n:dadosCruzados.length,l:'Dispensações'},{n:ativas.length,l:'Ativas'},{n:[...new Set(dadosCruzados.map(d=>d.substancia))].length,l:'Substâncias'},{n:arred(totalG)+' g',l:'Total saída'}]
      .map(s=>'<div class="stat-box"><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div>').join('');

    document.getElementById('print-subst-select').innerHTML=SUBSTANCIAS.map(s=>'<option value="'+s.nome+'">'+s.nome+' ('+s.lista+')</option>').join('');
    document.getElementById('result-card').classList.add('visible');
    log('Planilha gerada, histórico e movimentos atualizados!','ok');
    SUBSTANCIAS.forEach(s=>{ if(estoquesFinal[s.nome]!==undefined) log('  '+s.nome+': '+estoquesFinal[s.nome].toFixed(4)+' g','ok'); });
  }catch(err){ log('ERRO: '+err.message,'err'); console.error(err); }
  finally{ btn.disabled=false; btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 12l2 2 4-4"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg> Gerar Planilha Final'; }
});

// ══════════ GERAÇÃO EXCEL ══════════

function gerarExcel(dados,estInicial,nomeEstab,periodoLabel){
  const wb=XLSX.utils.book_new();
  const titulo=periodoLabel;
  const estoquesFinal={};

  // RESUMO
  const rr=[
    ['RELATÓRIO DE MOVIMENTAÇÃO — CONTROLADOS VETERINÁRIOS — '+nomeEstab],
    ['Período: '+titulo],[],
    ['Substância','Lista','DCB','Est. Inicial (g)','Dispensações','Total Saída (g)','Est. Final (g)'],
  ];
  for(const s of SUBSTANCIAS){
    const ds=dados.filter(d=>identificarSubstancia(d.substancia)===s.nome&&d.status==='ATIVA');
    const ts=arred(ds.reduce((a,d)=>a+(d.qtdG||0),0));
    const ei=estInicial[s.nome]||0, ef=arred(ei-ts); estoquesFinal[s.nome]=ef;
    rr.push([s.nome,s.lista,s.dcb,ei,ds.length,ts,ef]);
  }
  const wR=XLSX.utils.aoa_to_sheet(rr); wR['!cols']=[{wch:20},{wch:7},{wch:8},{wch:15},{wch:14},{wch:16},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wR,'RESUMO');

  // CONTROLE
  const cr=[['BASE DE DADOS — '+nomeEstab+' — '+titulo],[],
    ['Nº OM','Nº DOC','Data','Tutor','CPF','Endereço','CRMV','Veterinário','Substância','Lista','Concentração','Dose','Qtde Texto','Qtd (g)','Nº Receita','Status'],
    ...dados.map(d=>[d.nrOm,d.nrDoc,d.data?fmtData(d.data):d.dataStr,d.clienteFull,d.cpf||'',d.endereco,d.crmvNrCE,d.prescritor,d.substancia,d.lista,d.calculo,d.doseMg,d.qtdeTexto,d.qtdG,d.nrReceita,d.status])];
  const wC=XLSX.utils.aoa_to_sheet(cr); wC['!cols']=[{wch:9},{wch:9},{wch:12},{wch:30},{wch:15},{wch:40},{wch:10},{wch:24},{wch:20},{wch:6},{wch:18},{wch:10},{wch:16},{wch:9},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb,wC,'CONTROLE');

  // CORPO por substância
  for(const s of SUBSTANCIAS){
    const ds=dados.filter(d=>identificarSubstancia(d.substancia)===s.nome&&d.status==='ATIVA');
    const ei=estInicial[s.nome]||0;
    const movStore=getSubstMovimentos(s.nome);
    const lancs=[];
    ds.forEach(d=>lancs.push({tipo:'saida',data:d.data,qtd:d.qtdG||0,nrOm:d.nrOm,nrDoc:d.nrDoc,crmvRaw:d.crmvRaw,prescritor:d.prescritor,calculo:d.calculo,nrReceita:d.nrReceita}));
    movStore.lancamentos.filter(l=>l.tipo==='entrada').forEach(l=>lancs.push({tipo:'entrada',data:l.data?new Date(l.data+'T12:00:00'):null,qtd:l.qtd,descricao:l.descricao}));
    movStore.lancamentos.filter(l=>l.tipo==='perda').forEach(l=>lancs.push({tipo:'perda',data:l.data?new Date(l.data+'T12:00:00'):null,qtd:l.qtd,descricao:l.descricao}));
    lancs.sort((a,b)=>{const da=a.data?(a.data instanceof Date?a.data.getTime():new Date(a.data).getTime()):0;const db=b.data?(b.data instanceof Date?b.data.getTime():new Date(b.data).getTime()):0;return da-db;});
    const rows=[['LIVRO DE REGISTRO — SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL DE USO VETERINÁRIO'],['SUBSTÂNCIA (DCB): '+s.nome+' | Lista: '+s.lista+' | '+nomeEstab],['Período: '+titulo],[],
      ['DATA','EST. INICIAL (g)','ENTRADA (g)','SAÍDA (g)','PERDAS (g)','EST. FINAL (g)','REG / NR DOC','OUTRAS INFORMAÇÕES'],
      ['ESTOQUE INICIAL',ei,'','','',ei,'','Estoque inicial — '+titulo]];
    let saldo=ei;
    for(const l of lancs){
      const dt=l.data instanceof Date?l.data:(l.data?new Date(l.data):null);
      const ent=l.tipo==='entrada'?l.qtd:0,sai=l.tipo==='saida'?l.qtd:0,per=l.tipo==='perda'?l.qtd:0;
      const ns=arred(saldo+ent-sai-per);
      let info='';if(l.tipo==='saida') info=['Rec: '+l.nrReceita,l.prescritor,l.calculo].filter(Boolean).join(' | ');else if(l.tipo==='entrada') info='ENTRADA: '+(l.descricao||'');else info='PERDA: '+(l.descricao||'');
      rows.push([dt?fmtData(dt):'',arred(saldo),ent||'',sai||'',per||'',ns,l.nrOm?l.nrOm+'/'+l.nrDoc:(l.tipo==='entrada'?'ENTRADA':'PERDA'),info]);
      saldo=ns;
    }
    rows.push(['ESTOQUE FINAL','','','','',arred(saldo),'','Estoque final — transferir para próximo período']);
    const w=XLSX.utils.aoa_to_sheet(rows);w['!cols']=[{wch:14},{wch:14},{wch:11},{wch:11},{wch:9},{wch:14},{wch:20},{wch:55}];
    XLSX.utils.book_append_sheet(wb,w,'CORPO_'+s.nome.replace(/[^\w]/g,'_'));
  }

  // FICHAS
  const fr=[['FICHAS DE DISPENSAÇÃO — '+nomeEstab+' — '+titulo],
    ['Nº OM','Nº DOC','Data','Tutor','CPF','Endereço','Veterinário','CRMV','Substância','Concentração','Qtd (g)','Nº Receita','Status'],
    ...dados.map(d=>[d.nrOm,d.nrDoc,d.data?fmtData(d.data):d.dataStr,d.clienteFull,d.cpf||'',d.endereco,d.prescritor,d.crmvNrCE,d.substancia,d.calculo,d.qtdG,d.nrReceita,d.status])];
  const wF=XLSX.utils.aoa_to_sheet(fr);wF['!cols']=[{wch:9},{wch:9},{wch:12},{wch:28},{wch:15},{wch:38},{wch:22},{wch:10},{wch:20},{wch:16},{wch:9},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb,wF,'FICHAS_IMPRIMIR');

  const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  return{blob:new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),estoquesFinal};
}

// ══════════ HISTÓRICO ══════════

function salvarNoHistorico(dados,estInicial,estoquesFinal,periodoLabel,nomeEstab){
  const h=loadHistorico();
  const datas=dados.filter(d=>d.data).map(d=>d.data);
  const registros=dados.map(d=>({...d,data:d.data instanceof Date?d.data.toISOString():d.data,_selected:undefined,_issues:undefined}));
  h.push({id:Date.now(),geradoEm:new Date().toISOString(),periodoLabel,estabelecimento:nomeEstab,
    dataInicio:datas.length?new Date(Math.min(...datas)).toISOString():null,
    dataFim:datas.length?new Date(Math.max(...datas)).toISOString():null,
    totalRegistros:dados.length,
    substanciasAtivas:[...new Set(dados.filter(d=>d.status==='ATIVA').map(d=>d.substancia))],
    estoquesInicial:estInicial,estoquesFinal,registros});
  saveHistorico(h);
}

function renderHistorico(){
  const hist=loadHistorico(),lista=document.getElementById('hist-lista');
  if(!hist.length){ lista.innerHTML='<div class="hist-empty">Nenhum registro gerado ainda.</div>'; return; }
  lista.innerHTML='';
  [...hist].reverse().forEach(reg=>{
    const dt=new Date(reg.geradoEm);
    const dtStr=dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const div=document.createElement('div'); div.className='hist-entry';
    const pills=SUBSTANCIAS.map(s=>{const f=reg.estoquesFinal?.[s.nome];if(f===undefined&&!reg.estoquesInicial?.[s.nome])return'';return '<span class="hist-pill">'+s.nome+' <span>'+(f!==undefined?f.toFixed(4)+'g':'—')+'</span></span>';}).join('');
    const temReg=reg.registros&&reg.registros.length>0;
    const substOpts=temReg?[...new Set(reg.registros.filter(r=>r.status==='ATIVA').map(r=>identificarSubstancia(r.substancia)).filter(Boolean))].map(n=>'<option value="'+n+'">'+n+'</option>').join(''):'';
    div.innerHTML='<div class="hist-header"><div class="hist-periodo">'+(reg.periodoLabel||'Período')+'</div><div class="hist-date">'+dtStr+'</div></div>'+
      '<div style="font-family:var(--mono);font-size:.72rem;color:var(--muted);margin-bottom:8px">'+reg.totalRegistros+' dispensações · '+reg.estabelecimento+'</div>'+
      '<div style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:8px">Estoques finais:</div>'+
      '<div class="hist-substs">'+pills+'</div>'+
      '<div class="hist-actions">'+
        '<button class="btn-secondary" style="font-size:.72rem;padding:5px 12px" onclick="usarComoInicial('+reg.id+')">↑ Est. inicial</button>'+
        (temReg?'<select id="hist-subst-'+reg.id+'" style="font-family:var(--mono);font-size:.72rem;padding:5px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)">'+substOpts+'</select>'+
        '<button class="btn-secondary" style="font-size:.72rem;padding:5px 10px" onclick="reimprimirCorpo('+reg.id+')">🖨 Corpo</button>'+
        '<button class="btn-secondary" style="font-size:.72rem;padding:5px 10px" onclick="reimprimirEtiquetas('+reg.id+',\'grade\')">🏷 3×5</button>'+
        '<button class="btn-secondary" style="font-size:.72rem;padding:5px 10px" onclick="reimprimirEtiquetas('+reg.id+',\'linear\')">🏷 Livro</button>':'<span style="font-size:.65rem;color:var(--muted);font-family:var(--mono)">Sem dados p/ reimprimir</span>')+
        '<button class="btn-danger" onclick="excluirRegistro('+reg.id+')">Excluir</button></div>';
    lista.appendChild(div);
  });
}

function usarComoInicial(id){ const reg=loadHistorico().find(r=>r.id===id); if(!reg||!reg.estoquesFinal) return; SUBSTANCIAS.forEach(s=>{const i=document.getElementById('est-'+s.nome);if(i&&reg.estoquesFinal[s.nome]!==undefined)i.value=reg.estoquesFinal[s.nome];}); switchTab('gerar',document.querySelectorAll('.tab')[0]); }
function excluirRegistro(id){ if(!confirm('Excluir este registro?')) return; saveHistorico(loadHistorico().filter(r=>r.id!==id)); renderHistorico(); }

function getHistRegistros(id){ const reg=loadHistorico().find(r=>r.id===id); if(!reg||!reg.registros) return null; return{...reg,registros:reg.registros.map(d=>({...d,data:d.data?new Date(d.data):null}))}; }

function reimprimirCorpo(id){
  const reg=getHistRegistros(id); if(!reg){ alert('Dados não disponíveis.'); return; }
  const sel=document.getElementById('hist-subst-'+id);
  const n=sel?sel.value:null; const s=SUBSTANCIAS.find(x=>x.nome===n); if(!s) return;
  imprimirCorpoComDados(reg.registros,reg.estoquesInicial,s,reg.estabelecimento,reg.periodoLabel);
}
function reimprimirEtiquetas(id,modo){ const reg=getHistRegistros(id); if(!reg){ alert('Dados não disponíveis.'); return; } imprimirEtiquetas(modo,reg.registros); }

// ══════════ BACKUP ══════════

function exportarBackup(){
  const data={versao:3,exportadoEm:new Date().toISOString(),historico:loadHistorico(),cpfs:loadCPFs(),enderecos:loadEnderecos(),prescritores:loadPrescritores(),movimentos:loadMovimentos()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='backup_controlados_'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  URL.revokeObjectURL(a.href);
  markBackup(); dismissReminder();
}

function importarBackup(input){
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      const hist=data.historico||(Array.isArray(data)?data:null);
      if(!hist||!Array.isArray(hist)) throw new Error('Formato inválido');
      let msg='Importar '+hist.length+' registros de histórico?';
      if(data.cpfs) msg+='\n+ '+Object.keys(data.cpfs).length+' CPFs';
      if(data.enderecos) msg+='\n+ '+Object.keys(data.enderecos).length+' endereços';
      if(data.prescritores) msg+='\n+ '+Object.keys(data.prescritores).length+' prescritores';
      if(data.movimentos) msg+='\n+ '+Object.keys(data.movimentos).length+' substâncias com movimentos';
      msg+='\n\nOs dados atuais serão substituídos.';
      if(!confirm(msg)) return;
      saveHistorico(hist);
      if(data.cpfs) saveCPFs(data.cpfs);
      if(data.enderecos) saveEnderecos(data.enderecos);
      if(data.prescritores) savePrescritores(data.prescritores);
      if(data.movimentos) saveMovimentos(data.movimentos);
      renderHistorico(); montarEstGrid();
      alert('Backup importado!');
    }catch(err){ alert('Erro: '+err.message); }
  };
  r.readAsText(file); input.value='';
}

// ══════════ IMPRESSÃO — CORPO ══════════

function imprimirCorpo(){
  const n=document.getElementById('print-subst-select').value;
  const s=SUBSTANCIAS.find(x=>x.nome===n); if(!s) return;
  const estab=upper(document.getElementById('estabelecimento').value)||'R S O MANIPULAÇÃO ANIMAL';
  const periodo=document.getElementById('periodo-label').value.trim();
  const estInicial=getEstoqueInicial();
  const base=getSelectedDados();
  imprimirCorpoComDados(dadosCruzados,{[s.nome]:estInicial[s.nome]||0},s,estab,periodo,base);
}

function imprimirCorpoComDados(todosDados,estInicialObj,s,estab,periodo,filtrados){
  const estIni=estInicialObj[s.nome]||0;
  const base=filtrados||todosDados.filter(d=>d.status==='ATIVA');
  const ds=base.filter(d=>identificarSubstancia(d.substancia)===s.nome);
  const movStore=getSubstMovimentos(s.nome);
  const lancs=[];
  ds.forEach(d=>lancs.push({tipo:'saida',data:d.data,qtd:d.qtdG||0,nrOm:d.nrOm,nrDoc:d.nrDoc,prescritor:d.prescritor,calculo:d.calculo,nrReceita:d.nrReceita}));
  movStore.lancamentos.filter(l=>l.tipo==='entrada').forEach(l=>lancs.push({tipo:'entrada',data:l.data?new Date(l.data+'T12:00:00'):null,qtd:l.qtd,descricao:l.descricao}));
  movStore.lancamentos.filter(l=>l.tipo==='perda').forEach(l=>lancs.push({tipo:'perda',data:l.data?new Date(l.data+'T12:00:00'):null,qtd:l.qtd,descricao:l.descricao}));
  lancs.sort((a,b)=>{const da=a.data?(a.data instanceof Date?a.data.getTime():new Date(a.data).getTime()):0;const db=b.data?(b.data instanceof Date?b.data.getTime():new Date(b.data).getTime()):0;return da-db;});

  let html='<div class="print-corpo"><h2>LIVRO DE REGISTRO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL DE USO VETERINÁRIO</h2>'+
    '<h3>SUBSTÂNCIA (DCB): '+s.nome+' ('+s.dcb+') | Lista: '+s.lista+' | '+estab+'<br>Período: '+periodo+'</h3>'+
    '<table><tr><th style="width:18mm">DATA</th><th>EST. INICIAL (g)</th><th>ENTRADA (g)</th><th>SAÍDA (g)</th><th>PERDAS (g)</th><th>EST. FINAL (g)</th><th style="width:22mm">REG/NR DOC</th><th class="col-info">OUTRAS INFORMAÇÕES</th></tr>'+
    '<tr class="row-est"><td>EST. INICIAL</td><td>'+estIni.toFixed(4)+'</td><td></td><td></td><td></td><td>'+estIni.toFixed(4)+'</td><td></td><td class="col-info">Estoque inicial — '+periodo+'</td></tr>';

  let saldo=estIni;
  for(const l of lancs){
    const dt=l.data instanceof Date?l.data:(l.data?new Date(l.data):null);
    const ent=l.tipo==='entrada'?l.qtd:0,sai=l.tipo==='saida'?l.qtd:0,per=l.tipo==='perda'?l.qtd:0;
    const ns=arred(saldo+ent-sai-per);
    let info='';if(l.tipo==='saida') info=['Rec: '+l.nrReceita,l.prescritor,l.calculo].filter(Boolean).join(' | ');else if(l.tipo==='entrada') info='ENTRADA: '+(l.descricao||'');else info='PERDA: '+(l.descricao||'');
    html+='<tr><td class="col-data">'+(dt?fmtData(dt):'')+'</td><td>'+arred(saldo).toFixed(4)+'</td><td>'+(ent?ent.toFixed(4):'')+'</td><td>'+(sai?sai.toFixed(4):'')+'</td><td>'+(per?per.toFixed(4):'')+'</td><td>'+ns.toFixed(4)+'</td><td>'+(l.nrOm?l.nrOm+'/'+l.nrDoc:(l.tipo==='entrada'?'ENT':'PER'))+'</td><td class="col-info">'+info+'</td></tr>';
    saldo=ns;
  }
  html+='<tr class="row-est"><td>EST. FINAL</td><td></td><td></td><td></td><td></td><td>'+arred(saldo).toFixed(4)+'</td><td></td><td class="col-info">Estoque final do período</td></tr></table></div>';
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ══════════ IMPRESSÃO — ETIQUETAS ══════════

function etqDataStr(d){
  if(d.data instanceof Date) return fmtData(d.data);
  if(d.data&&typeof d.data==='string'){const dt=new Date(d.data);return isNaN(dt)?d.dataStr||d.data:fmtData(dt);}
  return d.dataStr||'';
}

function imprimirEtiquetas(modo,dadosExt){
  const src=dadosExt||dadosCruzados;
  if(!src.length) return;
  const lista=dadosExt?src.filter(d=>d.status==='ATIVA'):getSelectedDados(src);
  if(!lista.length){alert('Nenhuma dispensação ativa.');return;}
  let html='';
  if(modo==='linear'){
    html='<div class="print-etiquetas-linear">';
    for(const d of lista){
      html+='<div class="etq-linear"><div class="etq-l-top"><strong>'+d.substancia+'</strong><span>OM: '+d.nrOm+'</span><span>DOC: '+d.nrDoc+'</span><span>Data: '+etqDataStr(d)+'</span><span>Qtd: '+(d.qtdG?d.qtdG.toFixed(4)+' g':'')+'</span></div>'+
        '<div class="etq-l-body"><span><strong>Tutor:</strong> '+d.clienteFull+'</span><span><strong>CPF:</strong> '+(d.cpf||'_______________')+'</span><span><strong>End.:</strong> '+(d.endereco||'')+'</span></div>'+
        '<div class="etq-l-body"><span><strong>Prescritor:</strong> '+d.prescritor+'</span><span><strong>CRMV:</strong> '+(d.crmvNrCE||d.crmvNr||'')+'</span><span><strong>Conc.:</strong> '+(d.calculo||'')+((d.doseMg)?(' ('+d.doseMg+' mg)'):'')+'</span></div>'+
        '<div class="etq-l-rt">RT: <span class="etq-l-rt-line"></span></div></div>';
    }
    html+='</div>';
  } else {
    const pags=[];for(let i=0;i<lista.length;i+=15) pags.push(lista.slice(i,i+15));
    html='<div class="print-etiquetas">';
    for(const p of pags){
      html+='<div class="etq-page">';
      for(const d of p){
        html+='<div class="etq"><div class="etq-subst">'+d.substancia+'</div>'+
          '<div class="etq-field"><strong>OM:</strong> '+d.nrOm+' <strong>DOC:</strong> '+d.nrDoc+' <strong>Data:</strong> '+etqDataStr(d)+'</div>'+
          '<div class="etq-field"><strong>Tutor:</strong> '+d.clienteFull+'</div>'+
          '<div class="etq-field"><strong>CPF:</strong> '+(d.cpf||'___________')+' </div>'+
          '<div class="etq-field"><strong>End.:</strong> '+(d.endereco||'')+'</div>'+
          '<div class="etq-field"><strong>Prescritor:</strong> '+d.prescritor+' <strong>CRMV:</strong> '+(d.crmvNrCE||'')+'</div>'+
          '<div class="etq-field"><strong>Conc.:</strong> '+(d.calculo||'')+((d.doseMg)?(' ('+d.doseMg+' mg)'):'')+' <strong>Qtd:</strong> '+(d.qtdG?d.qtdG.toFixed(4)+' g':'')+'</div>'+
          '<div class="etq-rt"><span>RT:</span> <span class="etq-rt-line"></span></div></div>';
      }
      for(let i=p.length;i<15;i++) html+='<div class="etq" style="border-color:transparent"></div>';
      html+='</div>';
    }
    html+='</div>';
  }
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ══════════ IMPRESSÃO — RESUMO FISCALIZAÇÃO MAPA ══════════

function imprimirResumoFiscalizacao(){
  const estab=upper(document.getElementById('estabelecimento').value)||'R S O MANIPULAÇÃO ANIMAL';
  const periodo=document.getElementById('periodo-label').value.trim();
  const est=getEstoqueInicial();
  const ativas=dadosCruzados.filter(d=>d.status==='ATIVA');

  let html='<div class="print-resumo">'+
    '<h2>RESUMO PARA FISCALIZAÇÃO — MAPA</h2>'+
    '<h3>'+estab+' · GO 0198-8<br>RT: Paulo Edson Fernandes — CRF-GO 9303<br>Período: '+periodo+'</h3>'+
    '<table><tr><th>Substância</th><th>Lista</th><th>DCB</th><th>Est. Inicial (g)</th><th>Entradas (g)</th><th>Saídas (g)</th><th>Perdas (g)</th><th>Est. Final (g)</th><th>Nº Dispensações</th></tr>';

  for(const s of SUBSTANCIAS){
    const ds=ativas.filter(d=>identificarSubstancia(d.substancia)===s.nome);
    const totalSaida=arred(ds.reduce((a,d)=>a+(d.qtdG||0),0));
    const movs=getSubstMovimentos(s.nome);
    const totalEntrada=arred(movs.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0));
    const totalPerda=arred(movs.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0));
    const ei=est[s.nome]||0;
    const ef=arred(ei+totalEntrada-totalSaida-totalPerda);
    html+='<tr><td>'+s.nome+'</td><td style="text-align:center">'+s.lista+'</td><td style="text-align:center">'+s.dcb+'</td>'+
      '<td style="text-align:right">'+ei.toFixed(4)+'</td><td style="text-align:right">'+(totalEntrada?totalEntrada.toFixed(4):'—')+'</td>'+
      '<td style="text-align:right">'+(totalSaida?totalSaida.toFixed(4):'—')+'</td><td style="text-align:right">'+(totalPerda?totalPerda.toFixed(4):'—')+'</td>'+
      '<td style="text-align:right">'+ef.toFixed(4)+'</td><td style="text-align:center">'+(ds.length||'—')+'</td></tr>';
  }
  html+='</table>'+
    '<p style="font-size:8pt;margin-top:4mm"><strong>Total de dispensações ativas:</strong> '+ativas.length+'</p>'+
    '<p style="font-size:8pt"><strong>Período abrangido:</strong> '+periodo+'</p>'+
    '<p style="font-size:8pt"><strong>Sistema:</strong> Farma Fácil · Processado em '+new Date().toLocaleDateString('pt-BR')+'</p>'+
    '<div class="sig-area"><div class="sig-line"><hr><strong>Paulo Edson Fernandes</strong><br>Farmacêutico RT — CRF-GO 9303</div><div class="sig-line"><hr><strong>Fiscal MAPA</strong><br>Matrícula / Carimbo</div></div></div>';

  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ══════════ ABA MOVIMENTOS ══════════

function renderMovimentos(){
  const sel=document.getElementById('mov-subst');
  const cur=sel.value;
  sel.innerHTML=SUBSTANCIAS.map(s=>'<option value="'+s.nome+'"'+(s.nome===cur?' selected':'')+'>'+s.nome+' ('+s.lista+')</option>').join('');
  renderMovimentosLista();
}

function renderMovimentosLista(){
  const nome=document.getElementById('mov-subst').value;
  recalcularSaldos(nome);
  const s=getSubstMovimentos(nome);
  const te=s.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0);
  const ts=s.lancamentos.filter(l=>l.tipo==='saida').reduce((a,l)=>a+l.qtd,0);
  const tp=s.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0);
  const sf=s.lancamentos.length?s.lancamentos[s.lancamentos.length-1].saldoApos:s.estoqueInicial;
  document.getElementById('mov-resumo').innerHTML=[
    {n:arred(s.estoqueInicial)+' g',l:'Est. Inicial',c:''},
    {n:arred(te)+' g',l:'Entradas',c:'var(--green)'},
    {n:arred(ts)+' g',l:'Saídas',c:'var(--accent)'},
    {n:arred(tp)+' g',l:'Perdas',c:'var(--red)'},
    {n:arred(sf)+' g',l:'Saldo Final',c:sf<0?'var(--red)':'var(--green)'},
  ].map(x=>'<div class="stat-box"><div class="stat-num" style="font-size:1rem;'+(x.c?'color:'+x.c:'')+'">'+x.n+'</div><div class="stat-lbl">'+x.l+'</div></div>').join('');

  const table=document.getElementById('mov-table');
  let html='<thead><tr><th>Data</th><th>Tipo</th><th>Qtd (g)</th><th>Saldo (g)</th><th>Descrição</th><th>Origem</th><th></th></tr></thead><tbody>';
  if(!s.lancamentos.length) html+='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Nenhum lançamento</td></tr>';
  else s.lancamentos.forEach(l=>{
    const tag='mov-tag mov-tag-'+l.tipo;
    const tl=l.tipo==='entrada'?'Entrada':l.tipo==='saida'?'Saída':'Perda';
    html+='<tr><td>'+( l.data||'')+'</td><td><span class="'+tag+'">'+tl+'</span></td><td>'+(l.qtd?l.qtd.toFixed(4):'0')+'</td>'+
      '<td'+(l.saldoApos<0?' class="mov-saldo-neg"':'')+'>'+(l.saldoApos!==undefined?l.saldoApos.toFixed(4):'')+'</td>'+
      '<td style="max-width:200px;word-break:break-word">'+(l.descricao||'')+'</td>'+
      '<td style="font-size:.6rem;color:var(--muted)">'+(l.origem==='importado'?'Importado':'Manual')+'</td>'+
      '<td>'+(l.origem!=='importado'?'<button class="btn-danger" style="font-size:.58rem;padding:2px 6px" onclick="removerMov(\''+nome+'\',\''+l.id+'\')">✕</button>':'')+'</td></tr>';
  });
  html+='</tbody>';table.innerHTML=html;
}

document.getElementById('mov-subst').addEventListener('change',renderMovimentosLista);

function adicionarMovimento(){
  const nome=document.getElementById('mov-subst').value;
  const tipo=document.getElementById('mov-tipo').value;
  const desc=document.getElementById('mov-descricao').value.trim();
  const qtd=parseFloat(document.getElementById('mov-qtd').value);
  const data=document.getElementById('mov-data').value;
  if(!qtd||qtd<=0){alert('Informe a quantidade.');return;}
  if(!data){alert('Informe a data.');return;}
  adicionarLancamento(nome,{id:uid(),tipo,data,qtd,descricao:upper(desc),nrOm:null,nrDoc:null,origem:'manual'});
  document.getElementById('mov-descricao').value='';document.getElementById('mov-qtd').value='';
  renderMovimentosLista();
}
function removerMov(n,id){if(!confirm('Remover lançamento?'))return;removerLancamento(n,id);renderMovimentosLista();}

// ══════════ DOWNLOAD ══════════

document.getElementById('btn-download').addEventListener('click',()=>{
  if(!xlsxBlob) return;
  const a=document.createElement('a');a.href=URL.createObjectURL(xlsxBlob);a.download='Controlados_RSO.xlsx';a.click();URL.revokeObjectURL(a.href);
});

// ══════════ INIT ══════════

setupDrop('zone-mov','file-mov','fname-mov','mov');
setupDrop('zone-ce','file-ce','fname-ce','ce');
montarEstGrid();
document.getElementById('mov-subst').innerHTML=SUBSTANCIAS.map(s=>'<option value="'+s.nome+'">'+s.nome+' ('+s.lista+')</option>').join('');
checkBackupReminder();
