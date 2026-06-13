/**
 * CONTROLADOS v4.0 — R S O MANIPULAÇÃO ANIMAL
 * Movimentos como fonte única de verdade
 * Conformidade IN 35/2017 MAPA
 */

// ═══ CONSTANTES ═══
const SUB=[
  {n:'Gabapentina',l:'C1',d:'04369'},{n:'Fluoxetina',l:'C1',d:'03094'},
  {n:'Amitriptilina',l:'C1',d:'00423'},{n:'Selegilina',l:'C1',d:'07929'},
  {n:'Tramadol',l:'A2',d:'08806'},{n:'Codeína',l:'A2',d:'01706'},
  {n:'Ribavirina',l:'C1',d:'07168'},
];
const MES=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const K={h:'controlados_fa_v2',c:'controlados_cpfs',e:'controlados_enderecos',
  p:'controlados_prescritores',m:'controlados_movimentos',b:'controlados_ultimo_backup'};

// ═══ ESTADO TRANSITÓRIO (só durante importação) ═══
let rawMov=null,rawCE=null,dadosRev=[];

// ═══ HELPERS ═══
const ar=n=>Math.round((n||0)*10000)/10000;
const up=s=>String(s||'').toUpperCase().replace(/\s+/g,' ').trim();
const nn=s=>up(s);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function fmtD(d){if(!d)return'';if(typeof d==='string'){const x=new Date(d);if(!isNaN(x))d=x;else return d;}return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function fmtDiso(d){if(!d)return'';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseBR(s){if(!s)return null;const p=String(s).split('/');if(p.length!==3)return null;const y=parseInt(p[2])<100?2000+parseInt(p[2]):parseInt(p[2]);return new Date(y,parseInt(p[1])-1,parseInt(p[0]));}
function fmtCPF(v){const d=v.replace(/\D/g,'').slice(0,11);if(d.length<=3)return d;if(d.length<=6)return d.slice(0,3)+'.'+d.slice(3);if(d.length<=9)return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6);return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);}
function autoPer(datas){if(!datas.length)return'';const mn=new Date(Math.min(...datas)),mx=new Date(Math.max(...datas));const a=MES[mn.getMonth()],b=MES[mx.getMonth()];return a===b?a+'/'+mx.getFullYear():a+'-'+b+'/'+mx.getFullYear();}
function idSub(nome){if(!nome)return null;const u=nome.toUpperCase();for(const s of SUB)if(u.includes(s.n.toUpperCase())||nome.includes(s.d))return s.n;return null;}
function setP(p,t){document.getElementById('pw').classList.add('v');document.getElementById('pb').style.width=p+'%';document.getElementById('ptx').textContent=t;}
function lg(m,t){const b=document.getElementById('lb');b.classList.add('v');const l=document.createElement('div');if(t)l.className='l'+t[0];l.textContent=m;b.appendChild(l);b.scrollTop=b.scrollHeight;}
function chkRdy(){document.getElementById('btn-proc').disabled=!(rawMov&&rawCE);}

// ═══ LOCALSTORAGE ═══
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}};
const sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

// Histórico
const ldH=()=>ls(K.h,[]);const svH=h=>sv(K.h,h);
// CPF
const ldC=()=>ls(K.c,{});const svC=c=>sv(K.c,c);
const getC=n=>ldC()[nn(n)]||'';
function setC(n,v){if(!n)return;const c=ldC();if(v&&v.trim())c[nn(n)]=v.trim();else delete c[nn(n)];svC(c);}
// Endereço
const ldE=()=>ls(K.e,{});const svE=e=>sv(K.e,e);
const getE=n=>ldE()[nn(n)]||'';
function setE(n,v){if(!n)return;const e=ldE();if(v&&v.trim())e[nn(n)]=up(v);else delete e[nn(n)];svE(e);}
// Prescritor {crmv,uf}
const ldP=()=>ls(K.p,{});const svP=p=>sv(K.p,p);
const getP=n=>ldP()[nn(n)]||{};
function setP2(n,crmv,uf){if(!n)return;const p=ldP();p[nn(n)]={crmv:String(crmv||'').trim(),uf:up(uf)||'GO'};svP(p);}
// Movimentos
const ldM=()=>ls(K.m,{});const svM=m=>sv(K.m,m);
function getSM(n){const a=ldM();if(!a[n])a[n]={estoqueInicial:0,lancamentos:[]};return a[n];}
function recalc(n){const a=ldM();const s=a[n];if(!s)return 0;s.lancamentos.sort((x,y)=>(x.data||'').localeCompare(y.data||''));let sd=s.estoqueInicial||0;for(const l of s.lancamentos){if(l.tipo==='entrada')sd=ar(sd+l.qtd);else sd=ar(sd-l.qtd);l.saldoApos=sd;}svM(a);return sd;}
function addLanc(n,l){const a=ldM();if(!a[n])a[n]={estoqueInicial:0,lancamentos:[]};a[n].lancamentos.push(l);svM(a);recalc(n);}
function rmLanc(n,id){const a=ldM();if(!a[n])return;a[n].lancamentos=a[n].lancamentos.filter(l=>l.id!==id);svM(a);recalc(n);}
function setEI(n,v){const a=ldM();if(!a[n])a[n]={estoqueInicial:0,lancamentos:[]};a[n].estoqueInicial=v;svM(a);recalc(n);}
function saldoFinal(n){const s=getSM(n);if(!s.lancamentos.length)return s.estoqueInicial;return s.lancamentos[s.lancamentos.length-1].saldoApos||s.estoqueInicial;}
// Backup
function markBkp(){localStorage.setItem(K.b,new Date().toISOString());}
function chkBkp(){const l=localStorage.getItem(K.b);if(!l||Date.now()-new Date(l).getTime()>7*864e5)document.getElementById('bkp-rem').classList.add('v');}

// ═══ TABS ═══
function swTab(id,btn){
  document.querySelectorAll('.tp').forEach(p=>p.classList.remove('a'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('a'));
  document.getElementById('tp-'+id).classList.add('a');
  if(btn)btn.classList.add('a');
  if(id==='mov')renderMov();
  if(id==='hist')renderHist();
}

// ═══ UPLOAD ═══
function setupDZ(zid,fid,fnid,tipo){
  const z=document.getElementById(zid),inp=document.getElementById(fid),fn=document.getElementById(fnid);
  inp.addEventListener('change',e=>{if(e.target.files[0])readXLS(e.target.files[0],tipo,fn,z);});
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dov');});
  z.addEventListener('dragleave',()=>z.classList.remove('dov'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('dov');if(e.dataTransfer.files[0])readXLS(e.dataTransfer.files[0],tipo,fn,z);});
}
function readXLS(file,tipo,fn,z){
  const r=new FileReader();
  r.onload=e=>{try{
    const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',codepage:1252});
    const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    if(tipo==='m'){rawMov=raw;fn.textContent='✓ '+file.name;z.classList.add('rdy');lg('MOVIMENTO: '+raw.length+' linhas','ok');}
    else{rawCE=raw;fn.textContent='✓ '+file.name;z.classList.add('rdy');lg('CLIENTE_END: '+raw.length+' linhas','ok');}
    chkRdy();
  }catch(err){lg('Erro: '+err.message,'err');}};
  r.readAsArrayBuffer(file);
}

// ═══ EXTRAÇÃO ═══
function extrMov(raw){
  const recs=[];let sub='',lista='';
  const c=(row,i)=>{if(!row)return'';const v=row[i];return(v!==undefined&&v!==null)?String(v).trim():'';};
  const ln=v=>{const n=parseFloat(String(v));return(!isNaN(n)&&String(v).trim()===String(n))?String(Math.round(n)):String(v).trim();};
  for(let r=0;r<raw.length;r++){
    const row=raw[r];
    if(String(row[6]||'').includes('Produto:')){sub=c(row,8);lista=c(row,3);continue;}
    if(c(row,4)==='O.M.'){
      let dt=parseBR(c(row,0));let qtdG=null;
      try{qtdG=parseFloat(String(row[17]).replace(',','.'));}catch(e){}
      const crmvRaw=c(row,20),crmvNr=crmvRaw.replace(/CRMV\s+\w+:\s*/i,'').trim();
      recs.push({substancia:sub,lista,data:dt,dataStr:c(row,0),tutor:c(row,7),
        nrOm:ln(row[11]),nrDoc:ln(row[12]),calculo:c(row,15),qtdG,crmvRaw,crmvNr,nrReceita:ln(row[25])});
    }
  }
  return recs;
}
function extrCE(raw){
  const dados={};
  const c=(r,i)=>{if(r<0||r>=raw.length)return'';const v=raw[r][i];return(v!==undefined&&v!==null)?String(v).trim():'';};
  for(let r=0;r<raw.length;r++){
    const st=c(r,12);if(st!=='Ativa'&&st!=='Cancelada')continue;
    const nrRaw=c(r,36);let nr=nrRaw;const nrF=parseFloat(nrRaw);if(!isNaN(nrF))nr=String(Math.round(nrF));
    const cliente=(c(r,37)+' '+c(r+1,37)).trim();
    const endereco=(c(r,52)+' '+c(r+1,52)).trim().replace(/(\d+)\.0\b/g,'$1');
    let prescritor='',crmvNr='',qtdeTexto='',formula='',doseMg='';
    for(let off=3;off<10;off++){
      if(r+off>=raw.length)break;
      if(c(r+off,0)==='Prescritor:'){
        const pr=r+off;
        prescritor=(c(pr,11)+' '+((c(pr+1,0)==='')?c(pr+1,11):'')).trim();
        const cv=c(pr,43),cvF=parseFloat(cv);crmvNr=!isNaN(cvF)?String(Math.round(cvF)):cv;
        qtdeTexto=c(pr,59);
        if(pr+2<raw.length){formula=c(pr+2,43);const dr=c(pr+2,64);const drF=parseFloat(dr);doseMg=!isNaN(drF)?drF:dr;}
        break;
      }
    }
    dados[nr]={status:st,cliente,endereco,prescritor,crmvNr,qtdeTexto,formula,doseMg};
  }
  return dados;
}

// ═══ CRUZAMENTO ═══
function cruzar(movs,ced){
  return movs.map(m=>{
    const ce=ced[m.nrOm]||{};
    const tutor=up(ce.cliente||m.tutor);
    const prescritor=up(ce.prescritor||'');
    const crmvNr=String(ce.crmvNr||m.crmvNr||'').trim();
    const cpf=getC(tutor);
    const endereco=up(ce.endereco)||getE(tutor)||'';
    const pCad=getP(prescritor);
    const crmvFinal=crmvNr||pCad.crmv||'';
    const uf=pCad.uf||'GO';
    return{...m,substancia:up(m.substancia),lista:up(m.lista),clienteFull:tutor,endereco,cpf,
      prescritor,crmvNr:crmvFinal,crmvUf:uf,calculo:up(m.calculo),
      qtdeTexto:ce.qtdeTexto||'',doseMg:ce.doseMg||'',
      status:up(ce.status||'ATIVA'),_sel:false,_issues:[]};
  });
}

// ═══ VALIDAÇÃO ═══
function validar(dados){
  let tot=0;const oms={};
  dados.forEach(d=>{
    d._issues=[];if(d.status!=='ATIVA')return;
    if(!d.cpf)d._issues.push('CPF');
    if(!d.endereco)d._issues.push('End');
    if(!d.prescritor)d._issues.push('Presc');
    if(!d.crmvNr)d._issues.push('CRMV');
    if(!d.nrReceita)d._issues.push('Rec');
    if(!d.qtdG)d._issues.push('Qtd');
    const k=d.nrOm+'_'+d.substancia;
    if(d.nrOm&&oms[k])d._issues.push('OM dup');
    oms[k]=true;
    if(d._issues.length)tot++;
  });return tot;
}

// ═══ BTN PROCESSAR ═══
document.getElementById('btn-proc').addEventListener('click',async()=>{
  document.getElementById('lb').innerHTML='';
  document.getElementById('rev-wr').classList.remove('v');
  const btn=document.getElementById('btn-proc');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Processando...';
  await new Promise(r=>setTimeout(r,50));
  try{
    setP(10,'Lendo MOVIMENTO...');
    const movs=extrMov(rawMov);lg('Movimento: '+movs.length+' dispensações','ok');
    setP(40,'Lendo CLIENTE_END...');
    const ced=extrCE(rawCE);lg('Receituário: '+Object.keys(ced).length+' registros','ok');
    setP(60,'Cruzando...');
    dadosRev=cruzar(movs,ced);
    const datas=dadosRev.filter(d=>d.data).map(d=>d.data);
    const perAuto=autoPer(datas);
    if(perAuto)document.getElementById('inp-per').value=perAuto;
    setP(75,'Validando...');
    const nI=validar(dadosRev);
    if(nI>0)lg('⚠ '+nI+' registros incompletos','warn');
    // Alertas
    const alV=document.getElementById('al-val');
    if(nI>0){alV.innerHTML='⚠ <strong>'+nI+'</strong> registro(s) com campos incompletos (amarelo).';alV.style.display='block';}else alV.style.display='none';
    // Filtro substâncias
    const subs=[...new Set(dadosRev.map(d=>d.substancia))];
    document.getElementById('flt-sub').innerHTML='<option value="">Todas</option>'+subs.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
    setP(100,'Pronto para revisão');
    renderRev();
    document.getElementById('rev-wr').classList.add('v');
    document.getElementById('rev-wr').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){lg('ERRO: '+err.message,'err');console.error(err);}
  finally{btn.disabled=false;btn.textContent='Processar Dados';chkRdy();}
});

// ═══ TABELA REVISÃO ═══
function renderRev(){
  const tbl=document.getElementById('rev-tbl');
  const ft=document.getElementById('flt-txt').value.toUpperCase();
  const fs=document.getElementById('flt-sub').value;
  // CPF alert
  const semCPF=dadosRev.filter(d=>d.status==='ATIVA'&&!d.cpf);
  const alC=document.getElementById('al-cpf');
  if(semCPF.length>0){alC.innerHTML='⚠ '+[...new Set(semCPF.map(d=>d.clienteFull))].length+' tutor(es) sem CPF.';alC.style.display='block';}else alC.style.display='none';

  let h='<thead><tr><th style="width:28px"><input type="checkbox" onchange="selAll(this.checked)"/></th><th>#</th><th>Substância</th><th>Data</th><th>OM</th><th>Doc</th><th style="min-width:120px">Tutor</th><th style="min-width:100px">CPF</th><th style="min-width:140px">Endereço</th><th style="min-width:110px">Prescritor</th><th>CRMV</th><th>UF</th><th style="min-width:90px">Concentração</th><th>Qtd(g)</th><th>Receita</th><th>St</th><th></th></tr></thead><tbody>';
  let vis=0;
  dadosRev.forEach((d,i)=>{
    if(fs&&d.substancia!==fs)return;
    if(ft&&!d.clienteFull.includes(ft)&&!d.prescritor.includes(ft)&&!d.nrOm.includes(ft)&&!d.substancia.includes(ft))return;
    vis++;
    const warn=d._issues&&d._issues.length&&d.status==='ATIVA';
    const cls=d.status==='CANCELADA'?' class="rw-c"':(warn?' class="rw-w"':'');
    const chk=d._sel?' checked':'';
    h+='<tr'+cls+'><td><input type="checkbox" data-i="'+i+'"'+chk+' onchange="tglSel(this)"/></td><td>'+(i+1)+'</td><td>'+d.substancia+'</td><td>'+(d.data?fmtD(d.data):d.dataStr)+'</td><td>'+d.nrOm+'</td><td>'+d.nrDoc+'</td>';
    h+='<td><input value="'+esc(d.clienteFull)+'" data-i="'+i+'" data-f="clienteFull" onchange="rEd(this)"/></td>';
    h+='<td><input value="'+esc(d.cpf)+'" data-i="'+i+'" data-f="cpf" oninput="this.value=fmtCPF(this.value)" onchange="rEdCPF(this)" placeholder="000.000.000-00"/></td>';
    h+='<td><input value="'+esc(d.endereco)+'" data-i="'+i+'" data-f="endereco" onchange="rEdEnd(this)"/></td>';
    h+='<td><input value="'+esc(d.prescritor)+'" data-i="'+i+'" data-f="prescritor" onchange="rEdPresc(this)"/></td>';
    h+='<td><input value="'+esc(d.crmvNr)+'" data-i="'+i+'" data-f="crmvNr" onchange="rEdCRMV(this)" style="width:60px"/></td>';
    h+='<td><input value="'+esc(d.crmvUf)+'" data-i="'+i+'" data-f="crmvUf" onchange="rEd(this)" style="width:35px" maxlength="2"/></td>';
    h+='<td><input value="'+esc(d.calculo)+'" data-i="'+i+'" data-f="calculo" onchange="rEd(this)"/></td>';
    h+='<td><input type="number" value="'+(d.qtdG||'')+'" data-i="'+i+'" data-f="qtdG" onchange="rEd(this)" step="0.0001" style="width:65px"/></td>';
    h+='<td><input value="'+esc(d.nrReceita)+'" data-i="'+i+'" data-f="nrReceita" onchange="rEd(this)" style="width:70px"/></td>';
    h+='<td><select data-i="'+i+'" data-f="status" onchange="rEd(this)"><option value="ATIVA"'+(d.status==='ATIVA'?' selected':'')+'>A</option><option value="CANCELADA"'+(d.status==='CANCELADA'?' selected':'')+'>C</option></select></td>';
    h+='<td>'+(warn?'<div class="ri">⚠ '+d._issues.join(',')+'</div>':'')+'</td></tr>';
  });
  h+='</tbody>';tbl.innerHTML=h;
  updSelCnt();
  document.getElementById('rev-cnt').textContent=vis+' visíveis · '+dadosRev.filter(d=>d.status==='ATIVA').length+' ativos';
}

function rEd(el){const i=+el.dataset.i,f=el.dataset.f;if(f==='qtdG')dadosRev[i][f]=parseFloat(el.value)||0;else dadosRev[i][f]=up(el.value);}
function rEdCPF(el){const i=+el.dataset.i,v=el.value;dadosRev[i].cpf=v;setC(dadosRev[i].clienteFull,v);const k=nn(dadosRev[i].clienteFull);dadosRev.forEach((d,j)=>{if(j!==i&&nn(d.clienteFull)===k)d.cpf=v;});renderRev();}
function rEdEnd(el){const i=+el.dataset.i,v=up(el.value);dadosRev[i].endereco=v;setE(dadosRev[i].clienteFull,v);const k=nn(dadosRev[i].clienteFull);dadosRev.forEach((d,j)=>{if(j!==i&&nn(d.clienteFull)===k)d.endereco=v;});}
function rEdPresc(el){const i=+el.dataset.i,v=up(el.value);dadosRev[i].prescritor=v;const c=getP(v);if(c.crmv){dadosRev[i].crmvNr=c.crmv;dadosRev[i].crmvUf=c.uf||'GO';renderRev();}}
function rEdCRMV(el){const i=+el.dataset.i,v=el.value.trim();dadosRev[i].crmvNr=v;if(dadosRev[i].prescritor&&v)setP2(dadosRev[i].prescritor,v,dadosRev[i].crmvUf);}
function tglSel(el){dadosRev[+el.dataset.i]._sel=el.checked;updSelCnt();}
function selAll(c){dadosRev.forEach(d=>{d._sel=c;});document.querySelectorAll('#rev-tbl input[type="checkbox"]').forEach(cb=>{cb.checked=c;});updSelCnt();}
function updSelCnt(){const n=dadosRev.filter(d=>d._sel).length;const el=document.getElementById('sel-cnt');if(el)el.textContent=n?n+' selecionado(s)':'';}

// ═══ CONFIRMAR IMPORTAÇÃO → MOVIMENTOS ═══
document.getElementById('btn-confirm').addEventListener('click',async()=>{
  if(!dadosRev.length)return;
  const btn=document.getElementById('btn-confirm');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Salvando...';
  await new Promise(r=>setTimeout(r,50));
  try{
    // Salvar cadastros
    dadosRev.forEach(d=>{
      if(d.status==='ATIVA'){
        if(d.cpf)setC(d.clienteFull,d.cpf);
        if(d.endereco)setE(d.clienteFull,d.endereco);
        if(d.prescritor&&d.crmvNr)setP2(d.prescritor,d.crmvNr,d.crmvUf);
      }
    });
    // Inserir saídas nos movimentos (deduplicar por nrOm+substância)
    const all=ldM();
    for(const d of dadosRev){
      if(d.status!=='ATIVA')continue;
      const sn=idSub(d.substancia);if(!sn)continue;
      if(!all[sn])all[sn]={estoqueInicial:saldoFinal(sn),lancamentos:[]};
      const ex=all[sn].lancamentos.find(l=>l.nrOm===d.nrOm&&l.tipo==='saida');
      const rec={
        tutor:d.clienteFull,cpf:d.cpf,endereco:d.endereco,
        prescritor:d.prescritor,crmvNr:d.crmvNr,crmvUf:d.crmvUf,
        calculo:d.calculo,doseMg:d.doseMg,nrReceita:d.nrReceita,
        substancia:d.substancia,lista:d.lista,
      };
      if(ex){ex.qtd=d.qtdG||0;ex.data=d.data?fmtDiso(d.data):'';ex.descricao='OM '+d.nrOm+' / DOC '+d.nrDoc;Object.assign(ex,rec);}
      else{all[sn].lancamentos.push({id:'imp_'+uid(),tipo:'saida',data:d.data?fmtDiso(d.data):'',qtd:d.qtdG||0,descricao:'OM '+d.nrOm+' / DOC '+d.nrDoc,nrOm:d.nrOm,nrDoc:d.nrDoc,origem:'importado',...rec});}
    }
    svM(all);
    for(const n of Object.keys(all))recalc(n);
    // Salvar no histórico
    const per=document.getElementById('inp-per').value.trim();
    const estab=up(document.getElementById('inp-estab').value)||'R S O MANIPULAÇÃO ANIMAL';
    const datas=dadosRev.filter(d=>d.data).map(d=>d.data);
    const hist=ldH();
    const estFinal={};SUB.forEach(s=>{estFinal[s.n]=saldoFinal(s.n);});
    const estIni={};SUB.forEach(s=>{estIni[s.n]=getSM(s.n).estoqueInicial;});
    hist.push({id:Date.now(),geradoEm:new Date().toISOString(),periodoLabel:per,estabelecimento:estab,
      dataInicio:datas.length?new Date(Math.min(...datas)).toISOString():null,
      dataFim:datas.length?new Date(Math.max(...datas)).toISOString():null,
      totalRegistros:dadosRev.length,
      substanciasAtivas:[...new Set(dadosRev.filter(d=>d.status==='ATIVA').map(d=>d.substancia))],
      estoquesInicial:estIni,estoquesFinal:estFinal});
    svH(hist);
    lg('✓ '+dadosRev.filter(d=>d.status==='ATIVA').length+' dispensações importadas para Movimentos!','ok');
    dadosRev=[];
    document.getElementById('rev-wr').classList.remove('v');
    // Ir para aba Movimentos
    swTab('mov',document.querySelectorAll('.tab')[1]);
  }catch(err){lg('ERRO: '+err.message,'err');console.error(err);}
  finally{btn.disabled=false;btn.textContent='✓ Confirmar Importação → Movimentos';}
});

// ═══ MODAIS CPF / PRESCRITOR ═══
function openModal(tipo){
  if(tipo==='cpf'){
    const entries=Object.entries(ldC()).sort((a,b)=>a[0].localeCompare(b[0]));
    const el=document.getElementById('cpf-list');
    if(!entries.length){el.innerHTML='<p style="color:var(--mt);font-family:var(--mono);font-size:.72rem">Nenhum CPF.</p>';}
    else{let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.7rem">';
      entries.forEach(([n,c])=>{const sn=n.replace(/'/g,"\\'");h+='<tr><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(n)+'</td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(c)+'" oninput="this.value=fmtCPF(this.value)" onchange="setC(\''+sn+'\',this.value)" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:120px"/></td><td><button class="bd" style="font-size:.58rem;padding:2px 5px" onclick="setC(\''+sn+'\',\'\');this.closest(\'tr\').remove()">✕</button></td></tr>';});
      h+='</table>';el.innerHTML=h;}
    document.getElementById('mo-cpf').classList.add('a');
  } else {
    const entries=Object.entries(ldP()).sort((a,b)=>a[0].localeCompare(b[0]));
    const el=document.getElementById('presc-list');
    if(!entries.length){el.innerHTML='<p style="color:var(--mt);font-family:var(--mono);font-size:.72rem">Nenhum prescritor.</p>';}
    else{let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.7rem"><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">PRESCRITOR</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">CRMV</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">UF</th><th></th></tr>';
      entries.forEach(([n,v])=>{const sn=n.replace(/'/g,"\\'");h+='<tr><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(n)+'</td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(v.crmv||'')+'" onchange="setP2(\''+sn+'\',this.value,this.parentElement.nextElementSibling.querySelector(\'input\').value)" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:80px"/></td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(v.uf||'GO')+'" maxlength="2" onchange="setP2(\''+sn+'\',this.parentElement.previousElementSibling.querySelector(\'input\').value,this.value)" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:35px"/></td><td><button class="bd" style="font-size:.58rem;padding:2px 5px" onclick="const p=ldP();delete p[\''+sn+'\'];svP(p);this.closest(\'tr\').remove()">✕</button></td></tr>';});
      h+='</table>';el.innerHTML=h;}
    document.getElementById('mo-presc').classList.add('a');
  }
}
function closeModal(t){document.getElementById('mo-'+(t==='cpf'?'cpf':'presc')).classList.remove('a');}
function clearCad(t){if(!confirm('Limpar todos?'))return;if(t==='cpf'){svC({});openModal('cpf');}else{svP({});openModal('presc');}}
document.getElementById('mo-cpf').addEventListener('click',function(e){if(e.target===this)closeModal('cpf');});
document.getElementById('mo-presc').addEventListener('click',function(e){if(e.target===this)closeModal('presc');});

// ═══ ABA MOVIMENTOS ═══
let mvSel={};// {lancId:true}
function renderMov(){
  const sel=document.getElementById('mv-sub');
  const cur=sel.value;
  sel.innerHTML=SUB.map(s=>'<option value="'+s.n+'"'+(s.n===cur?' selected':'')+'>'+s.n+' ('+s.l+')</option>').join('');
  renderMovList();
}
function renderMovList(){
  const nm=document.getElementById('mv-sub').value;
  recalc(nm);
  const s=getSM(nm);
  const te=s.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0);
  const ts=s.lancamentos.filter(l=>l.tipo==='saida').reduce((a,l)=>a+l.qtd,0);
  const tp=s.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0);
  const sf=saldoFinal(nm);
  document.getElementById('mv-res').innerHTML=[
    {n:ar(s.estoqueInicial)+' g',l:'Est. Inicial',c:''},
    {n:ar(te)+' g',l:'Entradas',c:'var(--gn)'},
    {n:ar(ts)+' g',l:'Saídas',c:'var(--ac)'},
    {n:ar(tp)+' g',l:'Perdas',c:'var(--rd)'},
    {n:ar(sf)+' g',l:'Saldo Final',c:sf<0?'var(--rd)':'var(--gn)'},
  ].map(x=>'<div class="sbox"><div class="snum" style="font-size:1rem;'+(x.c?'color:'+x.c:'')+'">'+x.n+'</div><div class="slbl">'+x.l+'</div></div>').join('');

  const tbl=document.getElementById('mv-tbl');
  let h='<thead><tr><th style="width:28px"><input type="checkbox" onchange="mvSelAll(this.checked)"/></th><th>Data</th><th>Tipo</th><th>Qtd(g)</th><th>Saldo(g)</th><th>OM</th><th>Tutor</th><th>Descrição</th><th>Origem</th><th></th></tr></thead><tbody>';
  if(!s.lancamentos.length)h+='<tr><td colspan="10" style="text-align:center;color:var(--mt);padding:20px">Nenhum lançamento</td></tr>';
  else s.lancamentos.forEach(l=>{
    const tag=l.tipo==='entrada'?'me':l.tipo==='saida'?'ms':'mp';
    const tl=l.tipo==='entrada'?'Entrada':l.tipo==='saida'?'Saída':'Perda';
    const chk=mvSel[l.id]?' checked':'';
    h+='<tr><td><input type="checkbox" data-id="'+l.id+'"'+chk+' onchange="mvTglSel(this)"/></td>';
    h+='<td>'+(l.data||'')+'</td><td><span class="mtag '+tag+'">'+tl+'</span></td>';
    h+='<td>'+(l.qtd?l.qtd.toFixed(4):'0')+'</td>';
    h+='<td'+(l.saldoApos<0?' class="msneg"':'')+'>'+(l.saldoApos!==undefined?l.saldoApos.toFixed(4):'')+'</td>';
    h+='<td>'+(l.nrOm||'')+'</td><td>'+(l.tutor||'')+'</td>';
    h+='<td style="max-width:180px;word-break:break-word">'+(l.descricao||'')+'</td>';
    h+='<td style="font-size:.58rem;color:var(--mt)">'+(l.origem==='importado'?'Imp':'Man')+'</td>';
    h+='<td>'+(l.origem!=='importado'?'<button class="bd" style="font-size:.56rem;padding:2px 5px" onclick="rmMov(\''+nm+'\',\''+l.id+'\')">✕</button>':'')+'</td></tr>';
  });
  h+='</tbody>';tbl.innerHTML=h;
  updMvSelCnt();
}
document.getElementById('mv-sub').addEventListener('change',()=>{mvSel={};renderMovList();});
function mvTglSel(el){if(el.checked)mvSel[el.dataset.id]=true;else delete mvSel[el.dataset.id];updMvSelCnt();}
function mvSelAll(c){const nm=document.getElementById('mv-sub').value;const s=getSM(nm);mvSel={};if(c)s.lancamentos.forEach(l=>{mvSel[l.id]=true;});document.querySelectorAll('#mv-tbl input[type="checkbox"]').forEach(cb=>{if(cb.dataset.id)cb.checked=c;});updMvSelCnt();}
function updMvSelCnt(){const n=Object.keys(mvSel).length;document.getElementById('mv-sel-cnt').textContent=n?n+' selecionado(s)':'';}
function getSelLancs(nm){const s=getSM(nm);const ids=Object.keys(mvSel);if(ids.length)return s.lancamentos.filter(l=>mvSel[l.id]);return s.lancamentos;}
function addMov(){
  const nm=document.getElementById('mv-sub').value;
  const tipo=document.getElementById('mv-tipo').value;
  const desc=document.getElementById('mv-desc').value.trim();
  const qtd=parseFloat(document.getElementById('mv-qtd').value);
  const data=document.getElementById('mv-data').value;
  const nf=document.getElementById('mv-nf').value.trim();
  const cnpj=document.getElementById('mv-cnpj').value.trim();
  if(!qtd||qtd<=0){alert('Informe a quantidade.');return;}
  if(!data){alert('Informe a data.');return;}
  addLanc(nm,{id:uid(),tipo,data,qtd,descricao:up(desc),nrOm:null,nrDoc:null,origem:'manual',
    nfNumero:nf,cnpjFornecedor:cnpj,fornecedor:up(desc)});
  document.getElementById('mv-desc').value='';document.getElementById('mv-qtd').value='';
  document.getElementById('mv-nf').value='';document.getElementById('mv-cnpj').value='';
  renderMovList();
}
function rmMov(n,id){if(!confirm('Remover?'))return;rmLanc(n,id);delete mvSel[id];renderMovList();}

// ═══ IMPRESSÃO — CORPO (LIVRO DE REGISTRO) ═══
function printCorpo(){
  const nm=document.getElementById('mv-sub').value;
  const s=SUB.find(x=>x.n===nm);if(!s)return;
  const sm=getSM(nm);
  const lancs=getSelLancs(nm);
  if(!lancs.length){alert('Nenhum lançamento para imprimir.');return;}
  const estab=up(document.getElementById('inp-estab').value)||'R S O MANIPULAÇÃO ANIMAL';
  const per=document.getElementById('inp-per').value.trim()||'';
  const dtFmt=document.getElementById('mv-dtfmt').value;
  const ei=sm.estoqueInicial;
  // Recalculate saldo for selected range
  let saldo=ei;
  const allLancs=sm.lancamentos;
  // We need to show all movements up to the selected ones to keep saldo correct
  // If specific items selected, just show those but calculate from beginning
  const useAll=Object.keys(mvSel).length===0;

  let thDate='',fnDate;
  if(dtFmt==='sep'){thDate='<th style="width:7mm">DIA</th><th style="width:7mm">MÊS</th><th style="width:9mm">ANO</th>';
    fnDate=(dt)=>{if(!dt)return '<td></td><td></td><td></td>';return '<td>'+dt.getDate()+'</td><td>'+(dt.getMonth()+1)+'</td><td>'+dt.getFullYear()+'</td>';};
  } else {thDate='<th style="width:18mm">DATA</th>';
    fnDate=(dt)=>'<td class="cd">'+(dt?fmtD(dt):'')+'</td>';}

  let html='<div class="pr-corpo"><h2>LIVRO DE REGISTRO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL DE USO VETERINÁRIO</h2>'+
    '<h3>SUBSTÂNCIA (DCB): '+s.n+' ('+s.d+') | Lista: '+s.l+' | '+estab+'<br>Período: '+per+'</h3>'+
    '<table><tr>'+thDate+'<th>EST.INICIAL(g)</th><th>ENTRADA(g)</th><th>SAÍDA(g)</th><th>PERDAS(g)</th><th>EST.FINAL(g)</th><th style="width:18mm">REG/DOC</th><th class="ci">OUTRAS INFORMAÇÕES</th><th class="crt">ASSINATURA RT</th></tr>';

  // Estoque inicial row
  const eiCols=dtFmt==='sep'?'<td></td><td></td><td>EST.INI</td>':'<td>EST.INICIAL</td>';
  html+='<tr class="re">'+eiCols+'<td>'+ei.toFixed(4)+'</td><td></td><td></td><td></td><td>'+ei.toFixed(4)+'</td><td></td><td class="ci">Estoque inicial — '+per+'</td><td></td></tr>';

  saldo=ei;
  const rows=useAll?allLancs:lancs;
  // If using selected, still need correct saldo — recalculate from all
  if(!useAll){
    // recalc all to get correct saldo before each selected item
    let s2=ei;
    for(const l of allLancs){
      if(l.tipo==='entrada')s2=ar(s2+l.qtd);else s2=ar(s2-l.qtd);
      l.saldoApos=s2;
    }
  }

  for(const l of rows){
    const dt=l.data?new Date(l.data+'T12:00:00'):null;
    const ent=l.tipo==='entrada'?l.qtd:0;
    const sai=l.tipo==='saida'?l.qtd:0;
    const per2=l.tipo==='perda'?l.qtd:0;
    const sBefore=ar((l.saldoApos||0)+(sai+per2)-ent);
    const sAfter=l.saldoApos;

    // Outras informações conforme Art 11 §4
    let info='';
    if(l.tipo==='saida'){
      info=[l.tutor,l.cpf?'CPF: '+l.cpf:'',l.nrReceita?'Rec: '+l.nrReceita:'',l.prescritor?'CRMV-'+(l.crmvUf||'GO')+' '+l.crmvNr:''].filter(Boolean).join(' | ');
    } else if(l.tipo==='entrada'){
      info=['ENTRADA',l.nfNumero?'NF: '+l.nfNumero:'',l.cnpjFornecedor?'CNPJ: '+l.cnpjFornecedor:'',l.fornecedor||l.descricao].filter(Boolean).join(' | ');
    } else {
      info='PERDA: '+(l.descricao||'');
    }

    html+='<tr>'+fnDate(dt)+'<td>'+ar(sBefore).toFixed(4)+'</td><td>'+(ent?ent.toFixed(4):'')+'</td><td>'+(sai?sai.toFixed(4):'')+'</td><td>'+(per2?per2.toFixed(4):'')+'</td><td>'+ar(sAfter).toFixed(4)+'</td><td>'+(l.nrOm?l.nrOm+'/'+l.nrDoc:(l.tipo==='entrada'?'ENT':'PER'))+'</td><td class="ci">'+info+'</td><td></td></tr>';
  }

  const finalSaldo=rows.length?rows[rows.length-1].saldoApos:ei;
  const efCols=dtFmt==='sep'?'<td></td><td></td><td>EST.FIN</td>':'<td>EST.FINAL</td>';
  html+='<tr class="re">'+efCols+'<td></td><td></td><td></td><td></td><td>'+ar(finalSaldo).toFixed(4)+'</td><td></td><td class="ci">Estoque final do período</td><td></td></tr></table></div>';

  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ IMPRESSÃO — ETIQUETAS ═══
function etqDt(l){if(!l.data)return'';const dt=new Date(l.data+'T12:00:00');return isNaN(dt)?l.data:fmtD(dt);}
function printEtq(modo){
  const nm=document.getElementById('mv-sub').value;
  const lancs=getSelLancs(nm).filter(l=>l.tipo==='saida');
  if(!lancs.length){alert('Nenhuma saída para etiquetas.');return;}
  let html='';
  if(modo==='linear'){
    html='<div class="pr-etql">';
    for(const l of lancs){
      html+='<div class="eql"><div class="eql-t"><strong>'+l.substancia+'</strong><span>OM: '+l.nrOm+'</span><span>DOC: '+(l.nrDoc||'')+'</span><span>Data: '+etqDt(l)+'</span><span>Qtd: '+(l.qtd?l.qtd.toFixed(4)+' g':'')+'</span></div>'+
      '<div class="eql-b"><span><strong>Tutor:</strong> '+(l.tutor||'')+'</span><span><strong>CPF:</strong> '+(l.cpf||'___________')+'</span><span><strong>End.:</strong> '+(l.endereco||'')+'</span></div>'+
      '<div class="eql-b"><span><strong>Prescritor:</strong> '+(l.prescritor||'')+'</span><span><strong>CRMV-'+(l.crmvUf||'GO')+':</strong> '+(l.crmvNr||'')+'</span><span><strong>Conc.:</strong> '+(l.calculo||'')+'</span></div>'+
      '<div class="eql-r">RT: <span class="eql-rl"></span></div></div>';
    }
    html+='</div>';
  } else {
    const pags=[];for(let i=0;i<lancs.length;i+=15)pags.push(lancs.slice(i,i+15));
    html='<div class="pr-etq">';
    for(const p of pags){
      html+='<div class="eq-page">';
      for(const l of p){
        html+='<div class="eq"><div class="eq-s">'+(l.substancia||'')+'</div>'+
        '<div class="eq-f"><strong>OM:</strong> '+l.nrOm+' <strong>DOC:</strong> '+(l.nrDoc||'')+' <strong>Data:</strong> '+etqDt(l)+'</div>'+
        '<div class="eq-f"><strong>Tutor:</strong> '+(l.tutor||'')+'</div>'+
        '<div class="eq-f"><strong>CPF:</strong> '+(l.cpf||'_________')+'</div>'+
        '<div class="eq-f"><strong>End.:</strong> '+(l.endereco||'')+'</div>'+
        '<div class="eq-f"><strong>Presc.:</strong> '+(l.prescritor||'')+' <strong>CRMV-'+(l.crmvUf||'GO')+':</strong> '+(l.crmvNr||'')+'</div>'+
        '<div class="eq-f"><strong>Conc.:</strong> '+(l.calculo||'')+' <strong>Qtd:</strong> '+(l.qtd?l.qtd.toFixed(4)+' g':'')+'</div>'+
        '<div class="eq-rt"><span>RT:</span> <span class="eq-rl"></span></div></div>';
      }
      for(let i=p.length;i<15;i++)html+='<div class="eq" style="border-color:transparent"></div>';
      html+='</div>';
    }
    html+='</div>';
  }
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ IMPRESSÃO — ANEXO VII (ESTOQUE SUBSTÂNCIAS) ═══
function printAnexoVII(){
  const estab=up(document.getElementById('inp-estab').value)||'R S O MANIPULAÇÃO ANIMAL';
  const per=document.getElementById('inp-per').value.trim()||'';
  let html='<div class="pr-anx"><h2>ANEXO VII — RELATÓRIO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h2>'+
    '<h3>'+estab+' · CNPJ: _____________ · Licença MAPA: _____________<br>Ano de referência: '+new Date().getFullYear()+' · Período: '+per+'</h3>'+
    '<table><tr><th>SUBSTÂNCIA (DCB)</th><th>LISTA</th><th>ESTOQUE INICIAL(g)</th><th>IMPORTAÇÃO(g)</th><th>PRODUÇÃO(g)</th><th>AQUISIÇÃO(g)</th><th>PERDAS(g)</th><th>VENDAS(g)</th><th>FABRICAÇÃO PROD. USO VET.(g)</th><th>ESTOQUE FINAL(g)</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    const te=ar(sm.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0));
    const ts=ar(sm.lancamentos.filter(l=>l.tipo==='saida').reduce((a,l)=>a+l.qtd,0));
    const tp=ar(sm.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0));
    const sf=saldoFinal(s.n);
    html+='<tr><td>'+s.n+' ('+s.d+')</td><td style="text-align:center">'+s.l+'</td><td style="text-align:right">'+ar(sm.estoqueInicial).toFixed(4)+'</td><td></td><td></td><td style="text-align:right">'+(te?te.toFixed(4):'—')+'</td><td style="text-align:right">'+(tp?tp.toFixed(4):'—')+'</td><td></td><td style="text-align:right">'+(ts?ts.toFixed(4):'—')+'</td><td style="text-align:right">'+ar(sf).toFixed(4)+'</td></tr>';
  }
  html+='</table>';
  // Sub-table: aquisições
  html+='<h4>RELATÓRIO DE AQUISIÇÕES DE SUBSTÂNCIAS</h4><table><tr><th>SUBSTÂNCIA (DCB)</th><th>LISTA</th><th>QUANTIDADE(g)</th><th>CNPJ FORNECEDOR</th><th>NOME FORNECEDOR/UF</th><th>Nº NF</th><th>DATA NF</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    sm.lancamentos.filter(l=>l.tipo==='entrada').forEach(l=>{
      html+='<tr><td>'+s.n+'</td><td>'+s.l+'</td><td>'+l.qtd.toFixed(4)+'</td><td>'+(l.cnpjFornecedor||'')+'</td><td>'+(l.fornecedor||l.descricao||'')+'</td><td>'+(l.nfNumero||'')+'</td><td>'+(l.data||'')+'</td></tr>';
    });
  }
  html+='</table>';
  html+='<div class="sig"><hr><strong>Paulo Edson Fernandes</strong><br>Farmacêutico RT — CRF-GO 9303</div></div>';
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ IMPRESSÃO — ANEXO VIII (MOVIMENTAÇÃO PRODUTOS) ═══
function printAnexoVIII(){
  const estab=up(document.getElementById('inp-estab').value)||'R S O MANIPULAÇÃO ANIMAL';
  const per=document.getElementById('inp-per').value.trim()||'';
  let html='<div class="pr-anx"><h2>ANEXO VIII — RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE DE PRODUTOS DE USO VETERINÁRIO QUE CONTENHAM SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h2>'+
    '<h3>'+estab+' · CNPJ: _____________ · Licença MAPA: _____________<br>Ano de referência: '+new Date().getFullYear()+' · Período: '+per+'</h3>'+
    '<table><tr><th>SUBSTÂNCIA (DCB)</th><th>LISTA</th><th>NOME PRODUTO</th><th>Nº LICENÇA</th><th>APRESENTAÇÃO</th><th>ESTOQUE INICIAL</th><th>ENTRADAS (AQUISIÇÃO)</th><th>SAÍDAS (VENDAS)</th><th>PERDAS</th><th>ESTOQUE FINAL</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    const te=ar(sm.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0));
    const ts=ar(sm.lancamentos.filter(l=>l.tipo==='saida').reduce((a,l)=>a+l.qtd,0));
    const tp=ar(sm.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0));
    html+='<tr><td>'+s.n+' ('+s.d+')</td><td>'+s.l+'</td><td>Manipulado</td><td></td><td>Cápsulas/sachê</td><td style="text-align:right">'+ar(sm.estoqueInicial).toFixed(4)+'</td><td style="text-align:right">'+(te?te.toFixed(4):'—')+'</td><td style="text-align:right">'+(ts?ts.toFixed(4):'—')+'</td><td style="text-align:right">'+(tp?tp.toFixed(4):'—')+'</td><td style="text-align:right">'+ar(saldoFinal(s.n)).toFixed(4)+'</td></tr>';
  }
  html+='</table>';
  // Vendas detail
  html+='<h4>RELATÓRIO DE VENDAS DE PRODUTOS QUE CONTENHAM SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h4><table><tr><th>SUBSTÂNCIA</th><th>LISTA</th><th>QUANTIDADE(g)</th><th>CPF/CNPJ ADQUIRENTE</th><th>NOME ADQUIRENTE</th><th>Nº CADASTRO MED VET</th><th>Nº RECEITA</th><th>DATA</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    sm.lancamentos.filter(l=>l.tipo==='saida').forEach(l=>{
      html+='<tr><td>'+s.n+'</td><td>'+s.l+'</td><td>'+l.qtd.toFixed(4)+'</td><td>'+(l.cpf||'')+'</td><td>'+(l.tutor||'')+'</td><td>'+(l.crmvNr?'CRMV-'+(l.crmvUf||'GO')+' '+l.crmvNr:'')+'</td><td>'+(l.nrReceita||'')+'</td><td>'+(l.data||'')+'</td></tr>';
    });
  }
  html+='</table>';
  html+='<div class="sig"><hr><strong>Paulo Edson Fernandes</strong><br>Farmacêutico RT — CRF-GO 9303</div></div>';
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ HISTÓRICO ═══
function renderHist(){
  const hist=ldH(),el=document.getElementById('hist-list');
  if(!hist.length){el.innerHTML='<div class="he">Nenhum registro.</div>';return;}
  el.innerHTML='';
  [...hist].reverse().forEach(reg=>{
    const dt=new Date(reg.geradoEm);
    const dtStr=dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const div=document.createElement('div');div.className='hi';
    const pills=SUB.map(s=>{const f=reg.estoquesFinal?.[s.n];if(f===undefined)return'';return'<span class="hpl">'+s.n+' <span>'+f.toFixed(4)+'g</span></span>';}).join('');
    div.innerHTML='<div class="hh"><div class="hp">'+(reg.periodoLabel||'Período')+'</div><div class="hd">'+dtStr+'</div></div>'+
      '<div style="font-family:var(--mono);font-size:.7rem;color:var(--mt);margin-bottom:6px">'+reg.totalRegistros+' dispensações · '+reg.estabelecimento+'</div>'+
      '<div class="hs">'+pills+'</div>'+
      '<div class="ha"><button class="bs" style="font-size:.7rem;padding:4px 10px" onclick="useAsEI('+reg.id+')">↑ Est. inicial</button>'+
      '<button class="bd" onclick="delHist('+reg.id+')">Excluir</button></div>';
    el.appendChild(div);
  });
}
function useAsEI(id){const reg=ldH().find(r=>r.id===id);if(!reg||!reg.estoquesFinal)return;SUB.forEach(s=>{if(reg.estoquesFinal[s.n]!==undefined)setEI(s.n,reg.estoquesFinal[s.n]);});swTab('mov',document.querySelectorAll('.tab')[1]);alert('Estoques iniciais atualizados.');}
function delHist(id){if(!confirm('Excluir?'))return;svH(ldH().filter(r=>r.id!==id));renderHist();}

// ═══ BACKUP ═══
function exportarBackup(){
  const data={versao:4,exportadoEm:new Date().toISOString(),historico:ldH(),cpfs:ldC(),enderecos:ldE(),prescritores:ldP(),movimentos:ldM()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='backup_controlados_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  URL.revokeObjectURL(a.href);markBkp();document.getElementById('bkp-rem').classList.remove('v');
}
function importarBackup(inp){
  const file=inp.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{try{
    const data=JSON.parse(e.target.result);
    const hist=data.historico||(Array.isArray(data)?data:null);
    if(!hist||!Array.isArray(hist))throw new Error('Formato inválido');
    let msg='Importar '+hist.length+' registros?';
    if(data.cpfs)msg+='\n+ '+Object.keys(data.cpfs).length+' CPFs';
    if(data.enderecos)msg+='\n+ '+Object.keys(data.enderecos).length+' endereços';
    if(data.prescritores)msg+='\n+ '+Object.keys(data.prescritores).length+' prescritores';
    if(data.movimentos)msg+='\n+ '+Object.keys(data.movimentos).length+' substâncias';
    msg+='\n\nDados atuais serão substituídos.';
    if(!confirm(msg))return;
    svH(hist);
    if(data.cpfs)svC(data.cpfs);
    if(data.enderecos)svE(data.enderecos);
    if(data.prescritores)svP(data.prescritores);
    if(data.movimentos)svM(data.movimentos);
    renderHist();alert('Backup importado!');
  }catch(err){alert('Erro: '+err.message);}};
  r.readAsText(file);inp.value='';
}

// ═══ INIT ═══
setupDZ('z-m','f-m','fn-m','m');
setupDZ('z-c','f-c','fn-c','c');
document.getElementById('mv-sub').innerHTML=SUB.map(s=>'<option value="'+s.n+'">'+s.n+' ('+s.l+')</option>').join('');
chkBkp();
