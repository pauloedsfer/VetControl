/**
 * CONTROLE ESPECIAL v5.0 — Fórmula Animal
 * Escrituração digital de substâncias controladas veterinárias
 * Conformidade Portaria MAPA nº 837/2025
 */

// ═══ STORAGE HELPERS (must be first — used by CONSTANTES) ═══
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}};
const sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

// ═══ CONSTANTES ═══
const SUB_DEFAULT=[
  {n:'Gabapentina',l:'C1',d:'04369'},{n:'Fluoxetina',l:'C1',d:'03094'},
  {n:'Amitriptilina',l:'C1',d:'00423'},{n:'Selegilina',l:'C1',d:'07929'},
  {n:'Tramadol',l:'A2',d:'08806'},{n:'Codeína',l:'A2',d:'01706'},
  {n:'Ribavirina',l:'C1',d:'07168'},
];
function ldSubs(){const saved=ls('controlados_substancias',null);return saved||SUB_DEFAULT.slice();}
function svSubs(s){sv('controlados_substancias',s);}
let SUB=ldSubs();
const MES=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const K={h:'controlados_fa_v2',c:'controlados_cpfs',e:'controlados_enderecos',
  p:'controlados_prescritores',m:'controlados_movimentos',b:'controlados_ultimo_backup',cfg:'controlados_config'};

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
// Always normalize CPF to XXX.XXX.XXX-XX format for storage
function normCPF(v){if(!v)return'';const d=String(v).replace(/\D/g,'').slice(0,11);if(d.length!==11)return d;return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);}
function autoPer(datas){if(!datas.length)return'';const mn=new Date(Math.min(...datas)),mx=new Date(Math.max(...datas));const a=MES[mn.getMonth()],b=MES[mx.getMonth()];return a===b?a+'/'+mx.getFullYear():a+'-'+b+'/'+mx.getFullYear();}
function idSub(nome){if(!nome)return null;const u=nome.toUpperCase();for(const s of ldSubs())if(u.includes(s.n.toUpperCase())||nome.includes(s.d))return s.n;return null;}
function setP(p,t){document.getElementById('pw').classList.add('v');document.getElementById('pb').style.width=p+'%';document.getElementById('ptx').textContent=t;}
function lg(m,t){const b=document.getElementById('lb');b.classList.add('v');const l=document.createElement('div');if(t)l.className='l'+t[0];l.textContent=m;b.appendChild(l);b.scrollTop=b.scrollHeight;}
function chkRdy(){document.getElementById('btn-proc').disabled=!(rawMov&&rawCE);}

// Histórico
const ldH=()=>ls(K.h,[]);const svH=h=>sv(K.h,h);
// CPF
const ldC=()=>ls(K.c,{});const svC=c=>sv(K.c,c);
const getC=n=>ldC()[nn(n)]||'';
function setC(n,v){if(!n)return;const c=ldC();if(v&&v.trim()){const d=v.replace(/\D/g,'');c[nn(n)]=d.length===11?normCPF(d):v.trim();}else delete c[nn(n)];svC(c);}
// Endereço
const ldE=()=>ls(K.e,{});const svE=e=>sv(K.e,e);
const getE=n=>ldE()[nn(n)]||'';
function setE(n,v){if(!n)return;const e=ldE();if(v&&v.trim())e[nn(n)]=up(v);else delete e[nn(n)];svE(e);}
// Prescritor {crmv,uf,cadMapa}
const ldP=()=>ls(K.p,{});const svP=p=>sv(K.p,p);
const getP=n=>ldP()[nn(n)]||{};
function setP2(n,crmv,uf,cadMapa){if(!n)return;const p=ldP();p[nn(n)]={crmv:String(crmv||'').trim(),uf:up(uf)||'GO',cadMapa:String(cadMapa||'').trim()};svP(p);}
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
const defCfg={fantasia:'',razao:'',cnpj:'',mapa:'',endereco:'',rtNome:'',rtCrf:''};
function ldCfg(){return{...defCfg,...ls(K.cfg,{})};}function svCfg(c){sv(K.cfg,c);}
function cfgHeader(){const c=ldCfg();return(c.razao||c.fantasia)+' CNPJ: '+(c.cnpj||'_____')+' Licenca MAPA: '+(c.mapa||'_____')+(c.endereco?'<br>'+c.endereco:'');}
function cfgSig(){const c=ldCfg();return'<strong>'+(c.rtNome||'RT')+'</strong><br>Farmaceutico RT - '+(c.rtCrf||'CRF');}
function getSemDates(){const a=parseInt(document.getElementById('mv-ano').value)||new Date().getFullYear();const s=document.getElementById('mv-sem').value;if(s==='1')return{ini:a+'-01-01',fim:a+'-06-30',label:'1o Semestre '+a+' (01/01-30/06)',ano:a};return{ini:a+'-07-01',fim:a+'-12-31',label:'2o Semestre '+a+' (01/07-31/12)',ano:a};}
function filterBySem(lancs){const{ini,fim}=getSemDates();return lancs.filter(l=>l.data&&l.data>=ini&&l.data<=fim);}
function getLancCadMapa(l){if(l.cadMapa)return l.cadMapa;if(l.prescritor){var p=getP(l.prescritor);return p.cadMapa||'';}return '';}
function openConfigModal(){var c=ldCfg();document.getElementById('cfg-fantasia').value=c.fantasia||'';document.getElementById('cfg-razao').value=c.razao||'';document.getElementById('cfg-cnpj').value=c.cnpj||'';document.getElementById('cfg-mapa').value=c.mapa||'';document.getElementById('cfg-endereco').value=c.endereco||'';document.getElementById('cfg-rt-nome').value=c.rtNome||'';document.getElementById('cfg-rt-crf').value=c.rtCrf||'';document.getElementById('mo-config').classList.add('a');}
function saveConfig(){svCfg({fantasia:document.getElementById('cfg-fantasia').value.trim(),razao:document.getElementById('cfg-razao').value.trim(),cnpj:document.getElementById('cfg-cnpj').value.trim(),mapa:document.getElementById('cfg-mapa').value.trim(),endereco:document.getElementById('cfg-endereco').value.trim(),rtNome:document.getElementById('cfg-rt-nome').value.trim(),rtCrf:document.getElementById('cfg-rt-crf').value.trim()});closeModal('config');const _nm=ldCfg().fantasia||'';document.getElementById('inp-estab').value=_nm;document.getElementById('hdr-estab').textContent=_nm||'Fórmula Animal · Escrituração Digital';}

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
  fn.textContent='📎 '+file.name;
  const r=new FileReader();
  r.onload=e=>{try{
    const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',codepage:1252});
    const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    if(tipo==='m'){rawMov=raw;fn.textContent='✓ '+file.name;z.classList.add('rdy');lg('MOVIMENTO: '+raw.length+' linhas','ok');}
    else{rawCE=raw;fn.textContent='✓ '+file.name;z.classList.add('rdy');lg('REGISTRO: '+raw.length+' linhas','ok');}
    chkRdy();
  }catch(err){fn.textContent='✗ '+file.name;lg('Erro ao ler '+file.name+': '+err.message,'err');console.error('readXLS error:',err);}};
  r.onerror=()=>{fn.textContent='✗ Erro leitura';lg('Erro ao ler arquivo','err');};
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
    const tipo=c(row,4);
    if(tipo==='O.M.'){
      let dt=parseBR(c(row,0));let qtdG=null;
      try{qtdG=parseFloat(String(row[17]).replace(',','.'));}catch(e){}
      const crmvRaw=c(row,20),crmvNr=crmvRaw.replace(/CRMV?\s+\w+:\s*/i,'').replace(/CRM\s+\w+:\s*/i,'').trim();
      recs.push({tipo:'saida',substancia:sub,lista,data:dt,dataStr:c(row,0),tutor:c(row,7),
        nrOm:ln(row[11]),nrDoc:ln(row[12]),calculo:c(row,15),qtdG,crmvRaw,crmvNr,nrReceita:ln(row[25])});
    } else if(tipo==='N.E.'){
      // Nota de Entrada (aquisição)
      let dt=parseBR(c(row,0));let qtdG=null;
      try{qtdG=parseFloat(String(row[17]).replace(',','.'));}catch(e){}
      recs.push({tipo:'entrada',substancia:sub,lista,data:dt,dataStr:c(row,0),
        fornecedor:c(row,7),nfNumero:ln(row[12]),qtdG});
    } else if(tipo==='A.E.'){
      // Ajuste de Estoque (perda/vencimento)
      let dt=parseBR(c(row,0));let qtdG=null;
      try{qtdG=parseFloat(String(row[17]).replace(',','.'));}catch(e){}
      recs.push({tipo:'perda',substancia:sub,lista,data:dt,dataStr:c(row,0),
        descricao:c(row,7),nrDoc:ln(row[12]),qtdG});
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
    if(m.tipo==='entrada'){
      return{...m,substancia:up(m.substancia),lista:up(m.lista),_sel:false,_issues:[],
        status:'ATIVA',clienteFull:'',cpf:'',endereco:'',prescritor:'',crmvNr:'',crmvUf:'',cadMapa:'',
        calculo:'',qtdeTexto:'',doseMg:'',nrOm:'',nrReceita:''};
    }
    if(m.tipo==='perda'){
      return{...m,substancia:up(m.substancia),lista:up(m.lista),_sel:false,_issues:[],
        status:'ATIVA',clienteFull:'',cpf:'',endereco:'',prescritor:'',crmvNr:'',crmvUf:'',cadMapa:'',
        calculo:'',qtdeTexto:'',doseMg:'',nrOm:'',nrReceita:''};
    }
    // Saída — merge with CLIENTE_END
    const ce=ced[m.nrOm]||{};
    const tutor=up(ce.cliente||m.tutor);
    const prescritor=up(ce.prescritor||'');
    const crmvNr=String(ce.crmvNr||m.crmvNr||'').trim();
    const cpf=getC(tutor);
    const endereco=up(ce.endereco)||getE(tutor)||'';
    const pCad=getP(prescritor);
    const crmvFinal=crmvNr||pCad.crmv||'';
    const uf=pCad.uf||'GO';
    const cadMapa=pCad.cadMapa||'';
    return{...m,substancia:up(m.substancia),lista:up(m.lista),clienteFull:tutor,endereco,cpf,
      prescritor,crmvNr:crmvFinal,crmvUf:uf,cadMapa,calculo:up(m.calculo),
      qtdeTexto:ce.qtdeTexto||'',doseMg:ce.doseMg||'',
      status:up(ce.status||'ATIVA'),_sel:false,_issues:[]};
  });
}

// ═══ VALIDAÇÃO ═══
function validar(dados){
  let tot=0;const oms={};
  dados.forEach(d=>{
    d._issues=[];
    if(d.tipo==='entrada'||d.tipo==='perda')return;// skip validation for entries/losses
    if(d.status!=='ATIVA')return;
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
document.getElementById('btn-proc')?.addEventListener('click',async()=>{
  document.getElementById('lb').innerHTML='';
  document.getElementById('rev-wr').classList.remove('v');
  const btn=document.getElementById('btn-proc');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Processando...';
  await new Promise(r=>setTimeout(r,50));
  try{
    setP(10,'Lendo MOVIMENTO...');
    const movs=extrMov(rawMov);
    const saidas=movs.filter(m=>m.tipo==='saida');
    const entradas=movs.filter(m=>m.tipo==='entrada');
    const perdas=movs.filter(m=>m.tipo==='perda');
    lg('Movimento: '+saidas.length+' dispensações, '+entradas.length+' entradas (N.E.), '+perdas.length+' perdas (A.E.)','ok');
    setP(40,'Lendo REGISTRO...');
    const ced=extrCE(rawCE);lg('Receituário: '+Object.keys(ced).length+' registros','ok');
    setP(60,'Cruzando...');
    dadosRev=cruzar(movs,ced);
    
    // ═══ CROSS-REFERENCE: PDF MAPA → XLS (CRMV↔SIPEAGRO por nrOm) ═══
    if(pdfParsedVendas.length>0){
      setP(68,'Cruzando com PDF MAPA...');
      const pdfByOM={};
      for(const v of pdfParsedVendas){if(v.nrOm)pdfByOM[v.nrOm]=v;}
      let linked=0;
      for(const d of dadosRev){
        if(d.tipo!=='saida'||!d.nrOm)continue;
        const pv=pdfByOM[d.nrOm];
        if(!pv)continue;
        // Enrich CPF from PDF if missing
        if(!d.cpf&&pv.cpf)d.cpf=normCPF(pv.cpf);
        // Enrich Cadastro MAPA from PDF
        if(!d.cadMapa&&pv.cadSipeagro){d.cadMapa=pv.cadSipeagro;linked++;}
        // Build CRMV↔SIPEAGRO mapping for the prescritor cadastro
        if(d.crmvNr&&pv.cadSipeagro&&pv.prescritor){
          const pKey=nn(pv.prescritor);
          const existing=getP(pv.prescritor);
          if(!existing.cadMapa){
            setP2(pv.prescritor,d.crmvNr,d.crmvUf||'GO',pv.cadSipeagro);
          }
          // Also try to match abbreviated XLS prescritor with full PDF prescritor
          if(d.prescritor&&d.prescritor!==pv.prescritor){
            const dKey=nn(d.prescritor);
            const eD=getP(d.prescritor);
            if(!eD.cadMapa)setP2(d.prescritor,d.crmvNr,d.crmvUf||'GO',pv.cadSipeagro);
          }
        }
      }
      if(linked>0)lg('✓ Cruzamento PDF↔XLS: '+linked+' cadastros MAPA vinculados por OM','ok');
    }
    
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
  // CPF alert (only for saídas)
  const semCPF=dadosRev.filter(d=>d.tipo==='saida'&&d.status==='ATIVA'&&!d.cpf);
  const alC=document.getElementById('al-cpf');
  if(semCPF.length>0){alC.innerHTML='⚠ '+[...new Set(semCPF.map(d=>d.clienteFull))].length+' tutor(es) sem CPF.';alC.style.display='block';}else alC.style.display='none';

  let h='<thead><tr><th style="width:28px"><input type="checkbox" onchange="selAll(this.checked)"/></th><th>#</th><th>Tipo</th><th>Substância</th><th>Data</th><th>OM</th><th>Doc</th><th style="min-width:120px">Tutor / Descrição</th><th style="min-width:100px">CPF</th><th style="min-width:140px">Endereço</th><th style="min-width:110px">Prescritor</th><th>CRMV</th><th>UF</th><th>Cad.MAPA</th><th style="min-width:90px">Concentração</th><th>Qtd(g)</th><th>Receita</th><th>St</th><th></th></tr></thead><tbody>';
  let vis=0;
  dadosRev.forEach((d,i)=>{
    if(fs&&d.substancia!==fs)return;
    const searchText=(d.clienteFull||'')+(d.prescritor||'')+(d.nrOm||'')+(d.substancia||'')+(d.fornecedor||'')+(d.descricao||'');
    if(ft&&!searchText.toUpperCase().includes(ft))return;
    vis++;
    const warn=d._issues&&d._issues.length&&d.status==='ATIVA';
    const cls=d.status==='CANCELADA'?' class="rw-c"':(d.tipo==='entrada'?' style="background:rgba(74,154,126,.06)"':(d.tipo==='perda'?' style="background:rgba(196,64,64,.06)"':(warn?' class="rw-w"':'')));
    const chk=d._sel?' checked':'';
    const tipoTag=d.tipo==='entrada'?'<span class="mtag me">Ent</span>':d.tipo==='perda'?'<span class="mtag mp">Per</span>':'<span class="mtag ms">Saída</span>';
    h+='<tr'+cls+'><td><input type="checkbox" data-i="'+i+'"'+chk+' onchange="tglSel(this)"/></td><td>'+(i+1)+'</td><td>'+tipoTag+'</td><td>'+d.substancia+'</td><td>'+(d.data?fmtD(d.data):d.dataStr||'')+'</td><td>'+(d.nrOm||'')+'</td><td>'+(d.nrDoc||d.nfNumero||'')+'</td>';
    if(d.tipo==='entrada'){
      h+='<td colspan="8"><input value="'+esc(d.fornecedor||'')+'" data-i="'+i+'" data-f="fornecedor" onchange="rEd(this)" placeholder="Fornecedor" style="width:100%"/></td>';
    } else if(d.tipo==='perda'){
      h+='<td colspan="8"><input value="'+esc(d.descricao||'')+'" data-i="'+i+'" data-f="descricao" onchange="rEd(this)" placeholder="Motivo da perda" style="width:100%"/></td>';
    } else {
      h+='<td><input value="'+esc(d.clienteFull)+'" data-i="'+i+'" data-f="clienteFull" onchange="rEd(this)"/></td>';
      h+='<td><input value="'+esc(d.cpf)+'" data-i="'+i+'" data-f="cpf" oninput="this.value=fmtCPF(this.value)" onchange="rEdCPF(this)" placeholder="000.000.000-00"/></td>';
      h+='<td><input value="'+esc(d.endereco)+'" data-i="'+i+'" data-f="endereco" onchange="rEdEnd(this)"/></td>';
      h+='<td><input value="'+esc(d.prescritor)+'" data-i="'+i+'" data-f="prescritor" onchange="rEdPresc(this)"/></td>';
      h+='<td><input value="'+esc(d.crmvNr)+'" data-i="'+i+'" data-f="crmvNr" onchange="rEdCRMV(this)" style="width:60px"/></td>';
      h+='<td><input value="'+esc(d.crmvUf)+'" data-i="'+i+'" data-f="crmvUf" onchange="rEd(this)" style="width:35px" maxlength="2"/></td>';
      h+='<td><input value="'+esc(d.cadMapa||'')+'" data-i="'+i+'" data-f="cadMapa" onchange="rEdCadMapa(this)" style="width:70px" placeholder="MAPA"/></td>';
      h+='<td><input value="'+esc(d.calculo)+'" data-i="'+i+'" data-f="calculo" onchange="rEd(this)"/></td>';
    }
    h+='<td><input type="number" value="'+(d.qtdG||'')+'" data-i="'+i+'" data-f="qtdG" onchange="rEd(this)" step="0.0001" style="width:65px"/></td>';
    h+='<td>'+(d.tipo==='saida'?'<input value="'+esc(d.nrReceita||'')+'" data-i="'+i+'" data-f="nrReceita" onchange="rEd(this)" style="width:70px"/>':'')+'</td>';
    h+='<td><select data-i="'+i+'" data-f="status" onchange="rEd(this)"><option value="ATIVA"'+(d.status==='ATIVA'?' selected':'')+'>A</option><option value="CANCELADA"'+(d.status==='CANCELADA'?' selected':'')+'>C</option></select></td>';
    h+='<td>'+(warn?'<div class="ri">⚠ '+d._issues.join(',')+'</div>':'')+'</td></tr>';
  });
  h+='</tbody>';tbl.innerHTML=h;
  updSelCnt();
  document.getElementById('rev-cnt').textContent=vis+' visíveis · '+dadosRev.filter(d=>d.status==='ATIVA').length+' ativos';
}

function rEd(el){const i=+el.dataset.i,f=el.dataset.f;if(f==='qtdG')dadosRev[i][f]=parseFloat(el.value)||0;else dadosRev[i][f]=el.value?up(el.value):el.value;}
function rEdCPF(el){const i=+el.dataset.i,v=el.value;dadosRev[i].cpf=v;setC(dadosRev[i].clienteFull,v);const k=nn(dadosRev[i].clienteFull);dadosRev.forEach((d,j)=>{if(j!==i&&nn(d.clienteFull)===k)d.cpf=v;});renderRev();}
function rEdEnd(el){const i=+el.dataset.i,v=up(el.value);dadosRev[i].endereco=v;setE(dadosRev[i].clienteFull,v);const k=nn(dadosRev[i].clienteFull);dadosRev.forEach((d,j)=>{if(j!==i&&nn(d.clienteFull)===k)d.endereco=v;});}
function rEdPresc(el){const i=+el.dataset.i,v=up(el.value);dadosRev[i].prescritor=v;const c=getP(v);if(c.crmv){dadosRev[i].crmvNr=c.crmv;dadosRev[i].crmvUf=c.uf||'GO';renderRev();}}
function rEdCRMV(el){const i=+el.dataset.i,v=el.value.trim();dadosRev[i].crmvNr=v;if(dadosRev[i].prescritor&&v)setP2(dadosRev[i].prescritor,v,dadosRev[i].crmvUf,dadosRev[i].cadMapa);}
function rEdCadMapa(el){const i=+el.dataset.i,v=el.value.trim();dadosRev[i].cadMapa=v;if(dadosRev[i].prescritor)setP2(dadosRev[i].prescritor,dadosRev[i].crmvNr,dadosRev[i].crmvUf,v);}
function tglSel(el){dadosRev[+el.dataset.i]._sel=el.checked;updSelCnt();}
function selAll(c){dadosRev.forEach(d=>{d._sel=c;});document.querySelectorAll('#rev-tbl input[type="checkbox"]').forEach(cb=>{cb.checked=c;});updSelCnt();}
function updSelCnt(){const n=dadosRev.filter(d=>d._sel).length;const el=document.getElementById('sel-cnt');if(el)el.textContent=n?n+' selecionado(s)':'';}

// ═══ CONFIRMAR IMPORTAÇÃO → MOVIMENTOS ═══
document.getElementById('btn-confirm')?.addEventListener('click',async()=>{
  if(!dadosRev.length)return;
  const btn=document.getElementById('btn-confirm');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Salvando...';
  await new Promise(r=>setTimeout(r,50));
  try{
    // Salvar cadastros (only for saídas)
    dadosRev.forEach(d=>{
      if(d.status==='ATIVA'&&d.tipo==='saida'){
        if(d.cpf)setC(d.clienteFull,d.cpf);
        if(d.endereco)setE(d.clienteFull,d.endereco);
        if(d.prescritor&&d.crmvNr)setP2(d.prescritor,d.crmvNr,d.crmvUf,d.cadMapa);
      }
    });
    // Inserir movimentos (saídas, entradas N.E., perdas A.E.)
    const all=ldM();
    let cntSaida=0,cntEntrada=0,cntPerda=0;
    for(const d of dadosRev){
      if(d.status!=='ATIVA')continue;
      const sn=idSub(d.substancia);if(!sn)continue;
      if(!all[sn])all[sn]={estoqueInicial:saldoFinal(sn),lancamentos:[]};
      
      if(d.tipo==='saida'){
        const ex=all[sn].lancamentos.find(l=>l.nrOm===d.nrOm&&l.tipo==='saida');
        const rec={tutor:d.clienteFull,cpf:d.cpf,endereco:d.endereco,
          prescritor:d.prescritor,crmvNr:d.crmvNr,crmvUf:d.crmvUf,cadMapa:d.cadMapa||'',
          calculo:d.calculo,doseMg:d.doseMg,nrReceita:d.nrReceita,substancia:d.substancia,lista:d.lista};
        if(ex){ex.qtd=d.qtdG||0;ex.data=d.data?fmtDiso(d.data):'';ex.descricao='OM '+d.nrOm+' / DOC '+d.nrDoc;Object.assign(ex,rec);}
        else{all[sn].lancamentos.push({id:'imp_'+uid(),tipo:'saida',data:d.data?fmtDiso(d.data):'',qtd:d.qtdG||0,descricao:'OM '+d.nrOm+' / DOC '+d.nrDoc,nrOm:d.nrOm,nrDoc:d.nrDoc,origem:'importado',...rec});}
        cntSaida++;
      } else if(d.tipo==='entrada'){
        // Deduplicate by NF number + substance
        const exNF=all[sn].lancamentos.find(l=>l.tipo==='entrada'&&l.nfNumero===d.nfNumero&&d.nfNumero);
        if(!exNF){
          all[sn].lancamentos.push({id:'imp_'+uid(),tipo:'entrada',data:d.data?fmtDiso(d.data):'',qtd:d.qtdG||0,
            descricao:up(d.fornecedor||''),fornecedor:up(d.fornecedor||''),nfNumero:d.nfNumero||'',cnpjFornecedor:'',nrPartida:'',
            origem:'importado'});
          cntEntrada++;
        }
      } else if(d.tipo==='perda'){
        all[sn].lancamentos.push({id:'imp_'+uid(),tipo:'perda',data:d.data?fmtDiso(d.data):'',qtd:d.qtdG||0,
          descricao:up(d.descricao||''),nrDoc:d.nrDoc||'',origem:'importado'});
        cntPerda++;
      }
    }
    svM(all);
    for(const n of Object.keys(all))recalc(n);
    // Salvar no histórico
    const per=document.getElementById('inp-per').value.trim();
    const estab=up(document.getElementById('inp-estab').value)||'';
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
    lg('✓ '+cntSaida+' dispensações, '+cntEntrada+' entradas, '+cntPerda+' perdas importadas para Movimentos!','ok');
    dadosRev=[];
    document.getElementById('rev-wr').classList.remove('v');
    // Ir para aba Movimentos
    swTab('mov',document.querySelectorAll('.tab')[0]);
  }catch(err){lg('ERRO: '+err.message,'err');console.error(err);}
  finally{btn.disabled=false;btn.textContent='✓ Confirmar Importação → Movimentos';}
});

// ═══ MODAIS CPF / PRESCRITOR ═══
function openModal(tipo){
  if(tipo==="config"){openConfigModal();return;}
  if(tipo==='subsModal'){
    SUB=ldSubs();
    const el=document.getElementById('subs-list');
    let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.7rem"><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">SUBSTÂNCIA</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">LISTA</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">DCB</th><th></th></tr>';
    SUB.forEach(s=>{
      const isDef=SUB_DEFAULT.find(d=>d.n===s.n);
      h+='<tr><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(s.n)+'</td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(s.l)+'</td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(s.d)+'</td><td>'+(isDef?'':'<button class="bd" style="font-size:.58rem;padding:2px 5px" onclick="rmSub(\''+s.n.replace(/'/g,"\\'")+'\')">✕</button>')+'</td></tr>';
    });
    h+='</table>';el.innerHTML=h;
    document.getElementById('mo-subs').classList.add('a');return;
  }
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
    else{let h='<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.7rem"><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">PRESCRITOR</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">CRMV</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">UF</th><th style="padding:4px;border-bottom:1px solid var(--bd);color:var(--ac);font-size:.6rem">CAD.MAPA</th><th></th></tr>';
      entries.forEach(([n,v])=>{const sn=n.replace(/'/g,"\\'");h+='<tr><td style="padding:3px 5px;border-bottom:1px solid var(--bd)">'+esc(n)+'</td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(v.crmv||'')+'" onchange="updPresc(\''+sn+'\',this)" data-f="crmv" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:70px"/></td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(v.uf||'GO')+'" maxlength="2" onchange="updPresc(\''+sn+'\',this)" data-f="uf" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:32px"/></td><td style="padding:3px 5px;border-bottom:1px solid var(--bd)"><input value="'+esc(v.cadMapa||'')+'" onchange="updPresc(\''+sn+'\',this)" data-f="cadMapa" style="background:var(--bg);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:2px 5px;width:70px"/></td><td><button class="bd" style="font-size:.58rem;padding:2px 5px" onclick="const p=ldP();delete p[\''+sn+'\'];svP(p);this.closest(\'tr\').remove()">✕</button></td></tr>';});
      h+='</table>';el.innerHTML=h;}
    document.getElementById('mo-presc').classList.add('a');
  }
}
function closeModal(t){var id=t==='cpf'?'mo-cpf':t==='presc'?'mo-presc':t==='subsModal'?'mo-subs':t==='editLanc'?'mo-edit':'mo-config';document.getElementById(id).classList.remove('a');}
function updPresc(nome,el){const p=ldP();const cur=p[nome]||{};cur[el.dataset.f]=el.value.trim();p[nome]=cur;svP(p);}
function addPrescManual(){
  const nome=up(document.getElementById('add-p-nome').value);
  const crmv=document.getElementById('add-p-crmv').value.trim();
  const uf=up(document.getElementById('add-p-uf').value)||'GO';
  const mapa=document.getElementById('add-p-mapa').value.trim();
  if(!nome){alert('Informe o nome do prescritor.');return;}
  setP2(nome,crmv,uf,mapa);
  document.getElementById('add-p-nome').value='';
  document.getElementById('add-p-crmv').value='';
  document.getElementById('add-p-mapa').value='';
  openModal('presc');
}
function clearCad(t){if(!confirm('Limpar todos?'))return;if(t==='cpf'){svC({});openModal('cpf');}else{svP({});openModal('presc');}}
document.getElementById('mo-cpf')?.addEventListener('click',function(e){if(e.target===this)closeModal('cpf');});
document.getElementById('mo-presc')?.addEventListener('click',function(e){if(e.target===this)closeModal('presc');});
document.getElementById('mo-config')?.addEventListener('click',function(e){if(e.target===this)closeModal('config');});
document.getElementById('mo-subs')?.addEventListener('click',function(e){if(e.target===this)closeModal('subsModal');});
document.getElementById('mo-edit')?.addEventListener('click',function(e){if(e.target===this)closeModal('editLanc');});

// ═══ ABA MOVIMENTOS ═══
let mvSel={};// {lancId:true}
function renderMov(){
  const sel=document.getElementById('mv-sub');
  const cur=sel.value;
  SUB=ldSubs();// refresh
  sel.innerHTML=SUB.map(s=>'<option value="'+s.n+'"'+(s.n===cur?' selected':'')+'>'+s.n+' ('+s.l+')</option>').join('');
  renderMovList();
}
function renderMovList(){
  const nm=document.getElementById('mv-sub').value;
  recalc(nm);
  const s=getSM(nm);
  // Populate estoque inicial input
  document.getElementById('mv-ei').value=s.estoqueInicial||0;
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
    h+='<td style="white-space:nowrap"><button class="bs" style="font-size:.56rem;padding:2px 5px;min-width:0" onclick="editLanc(\''+nm.replace(/'/g,"\\'")+'\',\''+l.id+'\')">✏</button> <button class="bd" style="font-size:.56rem;padding:2px 5px" onclick="rmMov(\''+nm.replace(/'/g,"\\'")+'\',\''+l.id+'\')">✕</button></td></tr>';
  });
  h+='</tbody>';tbl.innerHTML=h;
  updMvSelCnt();
}
document.getElementById('mv-sub')?.addEventListener('change',()=>{mvSel={};renderMovList();});
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
    nfNumero:nf,cnpjFornecedor:cnpj,fornecedor:up(desc),nrPartida:document.getElementById('mv-partida').value.trim()});
  document.getElementById('mv-desc').value='';document.getElementById('mv-qtd').value='';
  document.getElementById('mv-nf').value='';document.getElementById('mv-cnpj').value='';document.getElementById('mv-partida').value='';
  renderMovList();
}
function rmMov(n,id){if(!confirm('Remover este lançamento?'))return;rmLanc(n,id);delete mvSel[id];renderMovList();}

// ═══ EDITAR LANÇAMENTO ═══
let editingLanc=null;// {substancia, id}
function editLanc(subNm, lancId){
  const s=getSM(subNm);
  const l=s.lancamentos.find(x=>x.id===lancId);
  if(!l){alert('Lançamento não encontrado.');return;}
  editingLanc={substancia:subNm,id:lancId};
  document.getElementById('ed-title').textContent='Editar Lançamento — '+subNm+' ('+lancId.slice(0,8)+'…)';
  document.getElementById('ed-tipo').value=l.tipo;
  document.getElementById('ed-qtd').value=l.qtd||0;
  document.getElementById('ed-data').value=l.data||'';
  document.getElementById('ed-desc').value=l.descricao||'';
  // Saída fields
  document.getElementById('ed-tutor').value=l.tutor||'';
  document.getElementById('ed-cpf').value=normCPF(l.cpf||getC(l.tutor)||'');
  document.getElementById('ed-endereco').value=l.endereco||getE(l.tutor)||'';
  document.getElementById('ed-prescritor').value=l.prescritor||'';
  document.getElementById('ed-crmv').value=l.crmvNr||'';
  document.getElementById('ed-uf').value=l.crmvUf||'GO';
  document.getElementById('ed-cadmapa').value=l.cadMapa||getLancCadMapa(l)||'';
  document.getElementById('ed-om').value=l.nrOm||'';
  document.getElementById('ed-doc').value=l.nrDoc||'';
  document.getElementById('ed-receita').value=l.nrReceita||'';
  document.getElementById('ed-calculo').value=l.calculo||'';
  // Entrada fields
  document.getElementById('ed-nf').value=l.nfNumero||'';
  document.getElementById('ed-cnpjf').value=l.cnpjFornecedor||'';
  document.getElementById('ed-partida').value=l.nrPartida||'';
  toggleEditFields(l.tipo);
  document.getElementById('mo-edit').classList.add('a');
}
function toggleEditFields(tipo){
  const sf=document.getElementById('ed-saida-fields');
  const ef=document.getElementById('ed-entrada-fields');
  sf.style.display=tipo==='saida'?'grid':'none';sf.style.gap='8px';
  ef.style.display=tipo==='entrada'?'grid':'none';ef.style.gap='8px';
}
document.getElementById('ed-tipo')?.addEventListener('change',function(){toggleEditFields(this.value);});

function saveEditLanc(){
  if(!editingLanc)return;
  const all=ldM();
  const sn=editingLanc.substancia;
  if(!all[sn])return;
  const l=all[sn].lancamentos.find(x=>x.id===editingLanc.id);
  if(!l){alert('Lançamento não encontrado.');return;}
  
  l.tipo=document.getElementById('ed-tipo').value;
  l.qtd=parseFloat(document.getElementById('ed-qtd').value)||0;
  l.data=document.getElementById('ed-data').value;
  l.descricao=up(document.getElementById('ed-desc').value);
  
  if(l.tipo==='saida'){
    l.tutor=up(document.getElementById('ed-tutor').value);
    l.cpf=normCPF(document.getElementById('ed-cpf').value);
    l.endereco=up(document.getElementById('ed-endereco').value);
    l.prescritor=up(document.getElementById('ed-prescritor').value);
    l.crmvNr=document.getElementById('ed-crmv').value.trim();
    l.crmvUf=up(document.getElementById('ed-uf').value)||'GO';
    l.cadMapa=document.getElementById('ed-cadmapa').value.trim();
    l.nrOm=document.getElementById('ed-om').value.trim();
    l.nrDoc=document.getElementById('ed-doc').value.trim();
    l.nrReceita=document.getElementById('ed-receita').value.trim();
    l.calculo=up(document.getElementById('ed-calculo').value);
    // Sync to cadastros
    if(l.tutor&&l.cpf)setC(l.tutor,l.cpf);
    if(l.tutor&&l.endereco)setE(l.tutor,l.endereco);
    if(l.prescritor&&l.crmvNr)setP2(l.prescritor,l.crmvNr,l.crmvUf,l.cadMapa);
  } else if(l.tipo==='entrada'){
    l.nfNumero=document.getElementById('ed-nf').value.trim();
    l.cnpjFornecedor=document.getElementById('ed-cnpjf').value.trim();
    l.nrPartida=document.getElementById('ed-partida').value.trim();
    l.fornecedor=l.descricao;
  }
  
  svM(all);
  recalc(sn);
  closeModal('editLanc');
  editingLanc=null;
  renderMovList();
}

// ═══ ESTOQUE INICIAL ═══
function editEI(){
  const nm=document.getElementById('mv-sub').value;
  const v=parseFloat(document.getElementById('mv-ei').value)||0;
  setEI(nm,v);renderMovList();
}

// ═══ SUBSTÂNCIAS DINÂMICAS ═══
function addSubManual(){
  const nome=document.getElementById('add-s-nome').value.trim();
  const lista=document.getElementById('add-s-lista').value;
  const dcb=document.getElementById('add-s-dcb').value.trim();
  if(!nome){alert('Informe o nome da substância.');return;}
  SUB=ldSubs();
  if(SUB.find(s=>s.n.toUpperCase()===nome.toUpperCase())){alert('Substância já existe.');return;}
  // Capitalize first letter
  const nCap=nome.charAt(0).toUpperCase()+nome.slice(1).toLowerCase();
  SUB.push({n:nCap,l:lista,d:dcb||'00000'});
  svSubs(SUB);
  document.getElementById('add-s-nome').value='';document.getElementById('add-s-dcb').value='';
  openModal('subsModal');
  renderMov();
}
function rmSub(nome){
  if(!confirm('Remover substância "'+nome+'"? Os dados de movimentos serão mantidos.'))return;
  SUB=ldSubs().filter(s=>s.n!==nome);svSubs(SUB);openModal('subsModal');renderMov();
}

// ═══ IMPRESSÃO — CORPO (LIVRO DE REGISTRO) ═══
function printCorpo(){
  const nm=document.getElementById('mv-sub').value;
  const s=SUB.find(x=>x.n===nm);if(!s)return;
  const sm=getSM(nm);
  const lancs=getSelLancs(nm);
  if(!lancs.length){alert('Nenhum lançamento para imprimir.');return;}
  const _cfg=ldCfg();const _sem=getSemDates();
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

  let html='<div class="pr-corpo"><h2>LIVRO DE REGISTRO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS AO CONTROLE ESPECIAL E PRODUTOS DE USO VETERINÁRIO QUE AS CONTENHAM</h2>'+
    '<h3>Substância (DCB): '+s.n+' ('+s.d+') | Lista: '+s.l+'<br>Nome do produto: Manipulado | Concentração: conforme prescrição<br>'+(_cfg.razao||_cfg.fantasia)+' · CNPJ: '+(_cfg.cnpj||'')+' · MAPA: '+(_cfg.mapa||'')+'<br>Período: '+_sem.label+'<br><small>Portaria MAPA nº 837/2025</small></h3>'+
    '<table><tr>'+thDate+'<th>EST.INICIAL(g)</th><th>ENTRADA(g)</th><th>SAÍDA(g)</th><th>PERDAS(g)</th><th>EST.FINAL(g)</th><th style="width:18mm">REG/DOC</th><th class="ci">OUTRAS INFORMAÇÕES</th><th class="crt">ASSINATURA RT</th></tr>';

  // Estoque inicial row
  const eiCols=dtFmt==='sep'?'<td></td><td></td><td>EST.INI</td>':'<td>EST.INICIAL</td>';
  html+='<tr class="re">'+eiCols+'<td>'+ei.toFixed(4)+'</td><td></td><td></td><td></td><td>'+ei.toFixed(4)+'</td><td></td><td class="ci">Estoque inicial — '+_sem.label+'</td><td></td></tr>';

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
      const _cpf=l.cpf||getC(l.tutor)||'';
      info=[l.tutor,_cpf?'CPF:'+normCPF(_cpf):'',l.nrReceita?'Rec:'+l.nrReceita:'',l.prescritor?'CRMV-'+(l.crmvUf||'GO')+' '+l.crmvNr:'',getLancCadMapa(l)?'MAPA:'+getLancCadMapa(l):''].filter(Boolean).join(' | ');
    } else if(l.tipo==='entrada'){
      info=['ENTRADA',l.nrPartida?'Partida:'+l.nrPartida:'',l.nfNumero?'NF:'+l.nfNumero:'',l.cnpjFornecedor?'CNPJ:'+l.cnpjFornecedor:'',l.fornecedor||l.descricao].filter(Boolean).join(' | ');
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
  const subInfo=ldSubs().find(s=>s.n===nm)||{l:''};
  const lancs=getSelLancs(nm).filter(l=>l.tipo==='saida');
  if(!lancs.length){alert('Nenhuma saída para etiquetas.');return;}
  // Ensure lista is populated
  lancs.forEach(l=>{if(!l.lista)l.lista=subInfo.l;if(!l.substancia)l.substancia=nm;});
  let html='';
  if(modo==='linear'){
    html='<div class="pr-etql">';
    for(const l of lancs){
      const _c=normCPF(l.cpf||getC(l.tutor)||'');
      const _e=l.endereco||getE(l.tutor)||'';
      const _cm=getLancCadMapa(l);
      html+='<div class="eql">'+
        '<div class="eql-h">'+
          '<span class="eql-sub">'+l.substancia+' ('+l.lista+')</span>'+
          '<span class="eql-sep"></span><span>'+etqDt(l)+'</span>'+
          '<span class="eql-sep"></span><span>OM: '+(l.nrOm||'')+'</span>'+
          '<span class="eql-sep"></span><span>Doc: '+(l.nrDoc||'')+'</span>'+
          '<span class="eql-sep"></span><span>Qtd: '+(l.qtd?l.qtd.toFixed(4)+'g':'')+'</span>'+
          '<span class="eql-sep"></span><span>Rec: '+(l.nrReceita||'')+'</span>'+
        '</div>'+
        '<div class="eql-row">'+
          '<div class="eql-c eql-grow"><b>Tutor</b>'+(l.tutor||'')+'</div>'+
          '<div class="eql-c"><b>CPF</b>'+(_c||'___.___.___-__')+'</div>'+
          '<div class="eql-c eql-grow"><b>End</b>'+_e+'</div>'+
        '</div>'+
        '<div class="eql-row">'+
          '<div class="eql-c eql-grow"><b>Presc</b>'+(l.prescritor||'')+'</div>'+
          '<div class="eql-c"><b>CRMV-'+(l.crmvUf||'GO')+'</b>'+(l.crmvNr||'')+'</div>'+
          (_cm?'<div class="eql-c"><b>MAPA</b>'+_cm+'</div>':'')+
          '<div class="eql-c"><b>Conc</b>'+(l.calculo||'')+'</div>'+
          '<div class="eql-c"><b>RT</b><span class="eql-rl"></span></div>'+
        '</div>'+
      '</div>';
    }
    html+='</div>';
  } else {
    const pags=[];for(let i=0;i<lancs.length;i+=15)pags.push(lancs.slice(i,i+15));
    html='<div class="pr-etq">';
    for(const p of pags){
      html+='<div class="eq-page">';
      for(const l of p){
        const _c2=normCPF(l.cpf||getC(l.tutor)||'');
        const _cm2=getLancCadMapa(l);
        const _e2=l.endereco||getE(l.tutor)||'';
        html+='<div class="eq">'+
        '<div class="eq-s">'+(l.substancia||'')+'</div>'+
        '<div class="eq-l"><span>OM: '+(l.nrOm||'—')+'</span><span>Doc: '+(l.nrDoc||'—')+'</span><span>'+etqDt(l)+'</span></div>'+
        '<div class="eq-f"><strong>Tutor: </strong>'+(l.tutor||'')+'</div>'+
        '<div class="eq-f2"><span><strong>CPF: </strong>'+(_c2||'___.___.___-__')+'</span><span><strong>Qtd: </strong>'+(l.qtd?l.qtd.toFixed(4)+' g':'')+'</span></div>'+
        '<div class="eq-f"><strong>End.: </strong>'+_e2+'</div>'+
        '<div class="eq-f"><strong>Presc.: </strong>'+(l.prescritor||'')+'</div>'+
        '<div class="eq-f2"><span><strong>CRMV-'+(l.crmvUf||'GO')+': </strong>'+(l.crmvNr||'')+'</span>'+(_cm2?'<span><strong>MAPA: </strong>'+_cm2+'</span>':'')+'</div>'+
        '<div class="eq-f"><strong>Conc.: </strong>'+(l.calculo||'')+'</div>'+
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

// ═══ IMPRESSÃO — ANEXO IX (MANIPULADORES — PORTARIA 837/2025 Art.15) ═══
function printAnexoIX(){
  const _cfg=ldCfg();const _sem=getSemDates();
  let html='<div class="pr-anx"><h2>ANEXO IX — RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS AO CONTROLE ESPECIAL PARA ESTABELECIMENTOS MANIPULADORES</h2>'+
    '<h3>'+(_cfg.razao||_cfg.fantasia)+' · CNPJ: '+(_cfg.cnpj||'_____')+' · Nº de Licença MAPA: '+(_cfg.mapa||'_____')+'<br>'+(_cfg.endereco||'')+'<br>Ano de referência: '+_sem.ano+' · '+_sem.label+'<br><small>Portaria MAPA nº 837/2025</small></h3>'+
    '<h4>RELATÓRIO COMPLETO:</h4>'+
    '<table><tr><th>Substância (DCB)</th><th>Lista</th><th>Estoque inicial (g)</th><th>Importação (g)</th><th>Aquisição (g)</th><th>Perdas (g)</th><th>Manipulação de produtos (g)</th><th>Estoque final</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    const te=ar(sm.lancamentos.filter(l=>l.tipo==='entrada').reduce((a,l)=>a+l.qtd,0));
    const ts=ar(sm.lancamentos.filter(l=>l.tipo==='saida').reduce((a,l)=>a+l.qtd,0));
    const tp=ar(sm.lancamentos.filter(l=>l.tipo==='perda').reduce((a,l)=>a+l.qtd,0));
    html+='<tr><td>'+s.n+' ('+s.d+')</td><td style="text-align:center">'+s.l+'</td><td style="text-align:right">'+ar(sm.estoqueInicial).toFixed(4)+'</td><td></td><td style="text-align:right">'+(te?te.toFixed(4):'—')+'</td><td style="text-align:right">'+(tp?tp.toFixed(4):'—')+'</td><td style="text-align:right">'+(ts?ts.toFixed(4):'—')+'</td><td style="text-align:right">'+ar(saldoFinal(s.n)).toFixed(4)+'</td></tr>';
  }
  html+='</table>';
  // Aquisições
  html+='<h4>RELATÓRIO DE AQUISIÇÕES DE SUBSTÂNCIAS SUJEITAS AO CONTROLE ESPECIAL:</h4><table><tr><th>Substância (DCB)</th><th>Lista</th><th>Quantidade</th><th>CNPJ do estabelecimento fornecedor</th><th>Razão social do estabelecimento fornecedor</th><th>Nº da nota fiscal</th><th>Data da nota fiscal</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    sm.lancamentos.filter(l=>l.tipo==='entrada').forEach(l=>{
      html+='<tr><td>'+s.n+'</td><td>'+s.l+'</td><td>'+l.qtd.toFixed(4)+'</td><td>'+(l.cnpjFornecedor||'')+'</td><td>'+(l.fornecedor||l.descricao||'')+'</td><td>'+(l.nfNumero||'')+'</td><td>'+(l.data||'')+'</td></tr>';
    });
  }
  html+='</table>';
  // Vendas (dispensações)
  html+='<h4>RELATÓRIO DE VENDAS DE PRODUTOS VETERINÁRIOS QUE CONTENHAM SUBSTÂNCIAS SUJEITAS AO CONTROLE ESPECIAL:</h4><table><tr><th>Substância (DCB)</th><th>Lista</th><th>Quantidade (g)</th><th>CPF do adquirente</th><th>Nome do adquirente</th><th>Prescritor</th><th>Cadastro do prescritor no MAPA</th><th>Nº da ordem de manipulação</th><th>Nº da nota fiscal</th><th>Data da nota fiscal</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    sm.lancamentos.filter(l=>l.tipo==='saida').forEach(l=>{
      const cpf=l.cpf||getC(l.tutor)||'';
      const cadM=getLancCadMapa(l);
      html+='<tr><td>'+s.n+'</td><td>'+s.l+'</td><td>'+l.qtd.toFixed(4)+'</td><td>'+normCPF(cpf)+'</td><td>'+(l.tutor||'')+'</td><td>'+(l.prescritor||'')+'</td><td>'+cadM+'</td><td>'+(l.nrOm||'')+'</td><td>'+(l.nrDoc||'')+'</td><td>'+(l.data||'')+'</td></tr>';
    });
  }
  html+='</table>';
  html+='<div class="sig"><hr>'+cfgSig()+'<br>Portaria MAPA nº 837/2025 · Art. 15</div></div>';
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ IMPRESSÃO — ANEXO VII (FORMATO ANTIGO — mantido para compatibilidade) ═══
function printAnexoVII(){
  const _cfg=ldCfg();const _sem=getSemDates();
  let html='<div class="pr-anx"><h2>ANEXO VII — RELATÓRIO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h2>'+
    '<h3>'+(_cfg.razao||_cfg.fantasia)+' · CNPJ: '+(_cfg.cnpj||'_____')+' · Licença MAPA: '+(_cfg.mapa||'_____')+'<br>'+(_cfg.endereco||'')+'<br>Ano de referência: '+_sem.ano+' · '+_sem.label+'</h3>'+
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
  html+='<div class="sig"><hr><strong>'+cfgSig()+'</div></div>';
  document.getElementById('print-area').innerHTML=html;
  window.print();
}

// ═══ IMPRESSÃO — ANEXO VIII (MOVIMENTAÇÃO PRODUTOS) ═══
function printAnexoVIII(){
  const _cfg=ldCfg();const _sem=getSemDates();
  let html='<div class="pr-anx"><h2>ANEXO VIII — RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE DE PRODUTOS DE USO VETERINÁRIO QUE CONTENHAM SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h2>'+
    '<h3>'+(_cfg.razao||_cfg.fantasia)+' · CNPJ: '+(_cfg.cnpj||'_____')+' · Licença MAPA: '+(_cfg.mapa||'_____')+'<br>'+(_cfg.endereco||'')+'<br>Ano de referência: '+_sem.ano+' · '+_sem.label+'</h3>'+
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
  html+='<h4>RELATÓRIO DE VENDAS DE PRODUTOS QUE CONTENHAM SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL</h4><table><tr><th>SUBSTÂNCIA</th><th>LISTA</th><th>QUANTIDADE(g)</th><th>CPF/CNPJ ADQUIRENTE</th><th>NOME ADQUIRENTE</th><th>Nº CADASTRO MED VET MAPA</th><th>CRMV</th><th>Nº RECEITA</th><th>Nº OM</th><th>DATA</th></tr>';
  for(const s of SUB){
    const sm=getSM(s.n);
    sm.lancamentos.filter(l=>l.tipo==='saida').forEach(l=>{
      const _cpf8=normCPF(l.cpf||getC(l.tutor)||'');
      html+='<tr><td>'+s.n+'</td><td>'+s.l+'</td><td>'+l.qtd.toFixed(4)+'</td><td>'+_cpf8+'</td><td>'+(l.tutor||'')+'</td><td>'+getLancCadMapa(l)+'</td><td>'+(l.crmvNr?'CRMV-'+(l.crmvUf||'GO')+' '+l.crmvNr:'')+'</td><td>'+(l.nrReceita||'')+'</td><td>'+(l.nrOm||'')+'</td><td>'+(l.data||'')+'</td></tr>';
    });
  }
  html+='</table>';
  html+='<div class="sig"><hr><strong>'+cfgSig()+'</div></div>';
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
function useAsEI(id){const reg=ldH().find(r=>r.id===id);if(!reg||!reg.estoquesFinal)return;SUB.forEach(s=>{if(reg.estoquesFinal[s.n]!==undefined)setEI(s.n,reg.estoquesFinal[s.n]);});swTab('mov',document.querySelectorAll('.tab')[0]);alert('Estoques iniciais atualizados.');}
function delHist(id){if(!confirm('Excluir?'))return;svH(ldH().filter(r=>r.id!==id));renderHist();}

// ═══ BACKUP ═══
function exportarBackup(){
  const data={versao:5,exportadoEm:new Date().toISOString(),historico:ldH(),cpfs:ldC(),enderecos:ldE(),prescritores:ldP(),movimentos:ldM()};
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
    // ── Migração v3→v4: enriquecer movimentos com dados de tutor/prescritor ──
    migrateV3toV4(hist, data.cpfs||{}, data.enderecos||{}, data.prescritores||{});
    renderHist();alert('Backup importado!');
  }catch(err){alert('Erro: '+err.message);}};
  r.readAsText(file);inp.value='';
}

/** Migração: preenche tutor/cpf/prescritor nas saídas que não têm (backups v3 e anteriores) */
function migrateV3toV4(hist, cpfs, enderecos, prescritores){
  const movs=ldM();
  let migrated=0;
  // Construir mapa nrOm → dados de registros do histórico
  const omMap={};
  for(const reg of hist){
    if(!reg.registros)continue;
    for(const r of reg.registros){
      if(r.nrOm&&r.status!=='CANCELADA'){
        omMap[r.nrOm]={
          tutor:up(r.clienteFull||r.tutor||''),
          cpf:r.cpf||'',
          endereco:up(r.endereco||''),
          prescritor:up(r.prescritor||''),
          crmvNr:r.crmvNrCE||r.crmvNr||'',
          crmvUf:r.crmvUf||'GO',
          calculo:up(r.calculo||''),
          doseMg:r.doseMg||'',
          nrReceita:r.nrReceita||'',
          substancia:up(r.substancia||''),
          lista:up(r.lista||''),
        };
      }
    }
  }
  // Enriquecer cada saída sem tutor
  for(const sn of Object.keys(movs)){
    const s=movs[sn];if(!s||!s.lancamentos)continue;
    for(const l of s.lancamentos){
      if(l.tipo!=='saida')continue;
      if(l.tutor&&l.tutor.length>1)continue;// já tem dados
      // Tentar pelo nrOm nos registros do histórico
      const om=omMap[l.nrOm];
      if(om){
        l.tutor=om.tutor;l.cpf=om.cpf;l.endereco=om.endereco;
        l.prescritor=om.prescritor;l.crmvNr=om.crmvNr;l.crmvUf=om.crmvUf;
        l.calculo=om.calculo;l.doseMg=om.doseMg;l.nrReceita=om.nrReceita;
        l.substancia=om.substancia;l.lista=om.lista;
        migrated++;
      } else {
        // Sem registros — tentar preencher CPF/endereço pelo cadastro se tutor existir parcialmente
        if(l.tutor){
          const k=nn(l.tutor);
          if(!l.cpf&&cpfs[k])l.cpf=cpfs[k];
          if(!l.endereco&&enderecos[k])l.endereco=enderecos[k];
        }
      }
    }
  }
  if(migrated>0){
    svM(movs);
    console.log('Migração v3→v4: '+migrated+' saídas enriquecidas com dados de tutor/prescritor');
  }
}

// ═══ IMPORTAR BASE SIPEAGRO ═══
const SIPEAGRO_NOVO_URL='https://raw.githubusercontent.com/pauloedsfer/sipeagro/main';
const SIPEAGRO_ANTIGO_URL='https://raw.githubusercontent.com/pauloedsfer/sipeagro-antigo/main';
let sipFileData=null;

function fetchSipeagroOnline(formato){
  const uf=document.getElementById('sip-uf').value;
  const isNovo=formato==='novo';
  const baseUrl=isNovo?SIPEAGRO_NOVO_URL:SIPEAGRO_ANTIGO_URL;
  const label=isNovo?'Novo (MV…)':'Antigo (…/YYYY)';
  const url=baseUrl+'/'+uf+'.json';
  document.getElementById('lb-sip').innerHTML='';document.getElementById('lb-sip').style.display='none';
  sipLog('Buscando SIPEAGRO '+label+' para '+uf+'...','ok');
  
  fetch(url).then(r=>{
    if(!r.ok)throw new Error('HTTP '+r.status+' — base '+label+' não encontrada para '+uf);
    return r.json();
  }).then(data=>{
    // data = {crmv: [cadastroNumber, nome], ...} or {crmv: "mvNumber"}
    const entries=Object.entries(data);
    sipLog('Base '+label+' '+uf+': '+entries.length+' veterinários carregados','ok');
    
    // Cross-reference with prescribers
    const prescs=ldP();let matched=0,updated=0,already=0;
    const renames=[];// [{oldName, newName}]
    for(const[nome,p]of Object.entries(prescs)){
      if(!p.crmv)continue;
      const ck=p.crmv.replace(/\D/g,'').replace(/^0+/,'')||'0';
      const match=data[ck];
      if(match){
        const mvNum=Array.isArray(match)?match[0]:match;
        const mvNome=Array.isArray(match)?match[1]:'';
        matched++;
        if(p.cadMapa&&p.cadMapa===mvNum){already++;}
        else if(p.cadMapa&&p.cadMapa!==mvNum){
          p.cadMapaAntigo=p.cadMapa;p.cadMapa=mvNum;updated++;
          sipLog('  ↑ '+nome+': '+p.cadMapaAntigo+' → '+mvNum+(mvNome?' ('+mvNome+')':''),'ok');
        } else if(!p.cadMapa){
          p.cadMapa=mvNum;updated++;
          sipLog('  ✓ '+nome+' → '+mvNum+(mvNome?' ('+mvNome+')':''),'ok');
        }
        // Check name mismatch
        if(mvNome){
          const nomeNorm=nome.trim().toUpperCase().replace(/\s+/g,' ');
          const sipNorm=mvNome.trim().toUpperCase().replace(/\s+/g,' ');
          if(nomeNorm!==sipNorm && sipNorm.length>3){
            renames.push({oldName:nome, newName:mvNome.toUpperCase().trim(), data:p});
          }
        }
      }
    }
    
    // Apply name renames
    let renamed=0;
    for(const r of renames){
      if(r.oldName===r.newName)continue;
      if(prescs[r.newName]){
        // Merge: the full name already exists — transfer cadMapa from truncated to full, delete truncated
        const dst=prescs[r.newName];
        const src=prescs[r.oldName];
        if(src.cadMapa&&!dst.cadMapa) dst.cadMapa=src.cadMapa;
        if(src.cadMapaAntigo&&!dst.cadMapaAntigo) dst.cadMapaAntigo=src.cadMapaAntigo;
        if(src.crmv&&!dst.crmv) dst.crmv=src.crmv;
        delete prescs[r.oldName];
        renamed++;
        sipLog('  📝 '+r.oldName+' → mesclado com '+r.newName,'ok');
      } else {
        prescs[r.newName]=prescs[r.oldName];
        delete prescs[r.oldName];
        renamed++;
        sipLog('  📝 '+r.oldName+' → '+r.newName,'ok');
      }
    }
    svP(prescs);
    
    // Enrich movements (cadMapa + name updates)
    const allMov=ldM();let me=0;let mr=0;
    const renameMap=new Map(renames.filter(r=>r.oldName!==r.newName&&!ldP()[r.oldName]).map(r=>[r.oldName,r.newName]));
    for(const sn of Object.keys(allMov)){const sm=allMov[sn];if(!sm)continue;
      for(const l of(sm.lancamentos||[])){
        if(l.tipo!=='saida')continue;
        // Update cadMapa
        const ck=(l.crmvNr||'').replace(/\D/g,'').replace(/^0+/,'')||'0';
        const match=data[ck];
        if(match){
          const mvNum=Array.isArray(match)?match[0]:match;
          if(!l.cadMapa||l.cadMapa!==mvNum){
            if(l.cadMapa)l.cadMapaAntigo=l.cadMapa;
            l.cadMapa=mvNum;me++;
          }
        }
        // Update prescriber name in movements
        if(l.prescritor&&renameMap.has(l.prescritor)){
          l.prescritor=renameMap.get(l.prescritor);mr++;
        }
      }
    }
    if(me>0||mr>0)svM(allMov);
    
    sipLog('','ok');
    let res='Resultado: '+matched+' encontrados, '+updated+' atualizados, '+already+' já OK';
    if(renamed)res+=' | '+renamed+' nomes corrigidos';
    if(me)res+=' | '+me+' movimentos';
    sipLog(res,'ok');
    
    // Show unmatched
    for(const[nome,p]of Object.entries(prescs)){
      if(!p.crmv)continue;const ck=p.crmv.replace(/\D/g,'').replace(/^0+/,'')||'0';
      if(!data[ck])sipLog('  ✗ '+nome+' (CRMV '+p.crmv+') — não encontrado em '+uf,'warn');
    }
    
    // Save last update date
    const cfg=ldCfg();cfg.sipeagroLastUpdate=new Date().toISOString().slice(0,10);cfg.sipeagroUF=uf;cfg.sipeagroFormato=formato;svCfg(cfg);
    sipLog('Atualizado em: '+cfg.sipeagroLastUpdate+' (formato '+label+')','ok');
    renderMov();
  }).catch(err=>{
    sipLog('✗ Erro ao buscar: '+err.message,'warn');
    if(!isNovo) sipLog('Para o formato antigo, crie o repositório pauloedsfer/sipeagro-antigo no GitHub com os JSONs.','warn');
    sipLog('Ou importe manualmente via planilha abaixo.','warn');
  });
}
function setupSipDZ(){
  const z=document.getElementById('z-sip'),inp=document.getElementById('f-sip'),fn=document.getElementById('fn-sip');
  if(!z||!inp)return;
  inp.addEventListener('change',e=>{if(e.target.files[0])readSipFile(e.target.files[0],fn,z);});
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dov');});
  z.addEventListener('dragleave',()=>z.classList.remove('dov'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('dov');if(e.dataTransfer.files[0])readSipFile(e.dataTransfer.files[0],fn,z);});
}
function readSipFile(file,fn,z){
  fn.textContent='📎 '+file.name;
  const r=new FileReader();
  r.onload=e=>{try{
    if(file.name.toLowerCase().endsWith('.csv')){
      // Parse CSV
      const text=new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
      const lines=text.split('\n').filter(l=>l.trim());
      const headers=lines[0].replace(/^\ufeff/,'').split(',').map(h=>h.replace(/"/g,'').trim());
      sipFileData=lines.slice(1).map(line=>{
        const vals=line.match(/(".*?"|[^,]+)/g)||[];
        const obj={};headers.forEach((h,i)=>{obj[h]=vals[i]?vals[i].replace(/"/g,'').trim():'';});
        return obj;
      });
    } else {
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      sipFileData=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    }
    fn.textContent='✓ '+file.name+' ('+sipFileData.length+' registros)';
    z.classList.add('rdy');
    document.getElementById('btn-sip').disabled=false;
  }catch(err){fn.textContent='✗ Erro: '+err.message;}};
  r.readAsArrayBuffer(file);
}
function sipLog(m,t){const b=document.getElementById('lb-sip');b.style.display='block';const l=document.createElement('div');if(t)l.className='l'+t[0];l.textContent=m;b.appendChild(l);b.scrollTop=b.scrollHeight;}

function processSipeagro(){
  if(!sipFileData||!sipFileData.length){alert('Carregue o arquivo SIPEAGRO primeiro.');return;}
  document.getElementById('lb-sip').innerHTML='';document.getElementById('lb-sip').style.display='none';
  
  // Auto-detect table format by column names
  const cols=Object.keys(sipFileData[0]);
  const colStr=cols.join('|').toUpperCase();
  
  // Old table: "Nº CADASTRO MV", "ANO", "NOME DO MÉDICO VETERINÁRIO", "Nº CRMV", "UF"
  // New table: detect by different column patterns
  const isOldFormat=colStr.includes('CADASTRO MV')&&colStr.includes('ANO');
  const isNewFormat=!isOldFormat;// treat anything else as new format
  
  sipLog('Formato detectado: '+(isOldFormat?'Tabela antiga (CADASTRO MV/ANO)':'Tabela nova'),'ok');
  sipLog('Colunas: '+cols.join(', '),'ok');
  
  // Build CRMV→SIPEAGRO map
  const sipMap={};let parsed=0;
  for(const row of sipFileData){
    let cadastro='',ano='',nome='',crmv='',uf='';
    
    if(isOldFormat){
      cadastro=String(row['Nº CADASTRO MV']||row['N° CADASTRO MV']||'').trim();
      ano=String(row['ANO']||'').trim();
      nome=String(row['NOME DO MÉDICO VETERINÁRIO']||row['NOME']||'').trim();
      crmv=String(row['Nº CRMV']||row['N° CRMV']||row['CRMV']||'').trim();
      uf=String(row['UF']||'').trim().toUpperCase();
    } else {
      // New format: try to find columns by partial match
      for(const c of cols){
        const cu=c.toUpperCase();
        if(cu.includes('CADASTRO')&&!cu.includes('ANO')&&!cadastro)cadastro=String(row[c]||'').trim();
        else if(cu.includes('ANO')&&!ano)ano=String(row[c]||'').trim();
        else if((cu.includes('NOME')||cu.includes('VETERINÁR'))&&!nome)nome=String(row[c]||'').trim();
        else if(cu.includes('CRMV')&&!crmv)crmv=String(row[c]||'').trim();
        else if(cu==='UF'&&!uf)uf=String(row[c]||'').trim().toUpperCase();
      }
      // If cadastro already contains slash (NNNNN/YYYY), split it
      if(cadastro.includes('/')){const parts=cadastro.split('/');cadastro=parts[0];if(!ano)ano=parts[1];}
    }
    
    if(!cadastro||!crmv)continue;
    const cadSipeagro=ano?cadastro+'/'+ano:cadastro;
    const crmvClean=crmv.replace(/\D/g,'');
    if(crmvClean){
      sipMap[crmvClean]={nome:nome.toUpperCase(),cadSipeagro,uf,crmvFull:crmv,isNew:isNewFormat};
      sipMap[(uf||'GO')+'_'+crmvClean]={nome:nome.toUpperCase(),cadSipeagro,uf,crmvFull:crmv,isNew:isNewFormat};
    }
    parsed++;
  }
  sipLog('Base carregada: '+parsed+' veterinários','ok');
  
  // Cross-reference with existing prescribers
  const prescs=ldP();
  let matched=0,updated=0,already=0;
  const prescEntries=Object.entries(prescs);
  
  for(const[nome,p]of prescEntries){
    if(!p.crmv)continue;
    const crmvClean=p.crmv.replace(/\D/g,'');
    if(!crmvClean)continue;
    const uf=(p.uf||'GO').toUpperCase();
    const match=sipMap[uf+'_'+crmvClean]||sipMap[crmvClean];
    if(match){
      matched++;
      if(isNewFormat){
        // New table: store as new number, keep old as backup
        if(p.cadMapa&&p.cadMapa!==match.cadSipeagro){
          p.cadMapaAntigo=p.cadMapa;// backup old
          p.cadMapa=match.cadSipeagro;// replace with new
          updated++;
          sipLog('  ↑ '+nome+' (CRMV '+crmvClean+'): '+p.cadMapaAntigo+' → '+match.cadSipeagro+' ('+match.nome+')','ok');
        } else if(!p.cadMapa){
          p.cadMapa=match.cadSipeagro;
          updated++;
          sipLog('  ✓ '+nome+' (CRMV '+crmvClean+') → '+match.cadSipeagro+' ('+match.nome+')','ok');
        } else {already++;}
      } else {
        // Old table: only fill if empty
        if(!p.cadMapa){
          p.cadMapa=match.cadSipeagro;updated++;
          sipLog('  ✓ '+nome+' (CRMV '+crmvClean+') → '+match.cadSipeagro+' ('+match.nome+')','ok');
        } else {already++;}
      }
    }
  }
  svP(prescs);
  
  // Enrich movements
  const allMov=ldM();let me=0;
  for(const sn of Object.keys(allMov)){const sm=allMov[sn];if(!sm)continue;
    for(const l of(sm.lancamentos||[])){
      if(l.tipo!=='saida')continue;
      const ck=(l.crmvNr||'').replace(/\D/g,'');if(!ck)continue;
      const uf=(l.crmvUf||'GO').toUpperCase();
      const m=sipMap[uf+'_'+ck]||sipMap[ck];
      if(m){
        if(!l.cadMapa||isNewFormat){
          if(l.cadMapa&&l.cadMapa!==m.cadSipeagro)l.cadMapaAntigo=l.cadMapa;
          l.cadMapa=m.cadSipeagro;me++;
        }
      }
    }
  }
  if(me>0)svM(allMov);
  
  sipLog('','ok');
  sipLog('Resultado: '+matched+' encontrados, '+updated+' atualizados, '+already+' já OK'+(me?' | '+me+' movimentos atualizados':''),'ok');
  if(isNewFormat&&updated>0)sipLog('💡 Números antigos salvos em "cadMapaAntigo". Use ⚙ Config → "Reverter SIPEAGRO" se precisar voltar.','ok');
  
  // Show unmatched
  for(const[nome,p]of prescEntries){
    if(!p.crmv)continue;const ck=p.crmv.replace(/\D/g,'');const uf=(p.uf||'GO').toUpperCase();
    if(!sipMap[uf+'_'+ck]&&!sipMap[ck])sipLog('  ✗ '+nome+' (CRMV-'+uf+' '+ck+') — não encontrado','warn');
  }
  renderMov();
}

function revertSipeagro(){
  const prescs=ldP();let rev=0;
  for(const p of Object.values(prescs)){if(p.cadMapaAntigo){const t=p.cadMapa;p.cadMapa=p.cadMapaAntigo;p.cadMapaAntigo=t;rev++;}}
  if(!rev){alert('Nenhum prescritor tem número antigo salvo.');return;}
  svP(prescs);
  const allMov=ldM();let me=0;
  for(const sn of Object.keys(allMov)){const sm=allMov[sn];if(!sm)continue;
    for(const l of(sm.lancamentos||[])){if(l.cadMapaAntigo){const t=l.cadMapa;l.cadMapa=l.cadMapaAntigo;l.cadMapaAntigo=t;me++;}}}
  if(me>0)svM(allMov);
  alert('Revertidos '+rev+' prescritores'+(me?' e '+me+' movimentos':'')+' para o número antigo.');renderMov();
}
function showSipeagroStatus(){
  document.getElementById('lb-sip').innerHTML='';document.getElementById('lb-sip').style.display='block';
  const prescs=ldP();let tot=0,com=0,ant=0,sem=0;
  for(const[n,p]of Object.entries(prescs)){
    if(!p.crmv)continue;tot++;
    if(p.cadMapa){com++;sipLog('  ✓ '+n+' — CRMV '+p.crmv+' → '+p.cadMapa+(p.cadMapaAntigo?' (anterior: '+p.cadMapaAntigo+')':''),'ok');}
    else{sem++;sipLog('  ✗ '+n+' — CRMV '+p.crmv+' → sem MAPA','warn');}
    if(p.cadMapaAntigo)ant++;
  }
  sipLog(tot+' prescritores | '+com+' com MAPA | '+sem+' sem | '+ant+' com nº anterior salvo','ok');
}

// ═══ EXPORTAR XLSX PARA MAPA (gov.br) ═══
function mapaLog(m,t){const b=document.getElementById('lb-mapa');b.style.display='block';const l=document.createElement('div');if(t)l.className='l'+t[0];l.textContent=m;b.appendChild(l);b.scrollTop=b.scrollHeight;}

function exportMapa(){
  const ano=parseInt(document.getElementById('mapa-ano').value)||new Date().getFullYear();
  const sem=parseInt(document.getElementById('mapa-sem').value)||1;
  const dtIni=new Date(ano,sem===1?0:6,1);
  const dtFim=new Date(ano,sem===1?6:12,0);
  document.getElementById('lb-mapa').innerHTML='';document.getElementById('lb-mapa').style.display='none';
  
  const allMov=ldM();
  const subs=ldSubs();
  
  // Helper: format date as dd/mm/yyyy
  function fmtDtBR(isoDate){
    if(!isoDate)return '';
    const p=isoDate.split('-');
    if(p.length===3)return p[2]+'/'+p[1]+'/'+p[0];
    return isoDate;
  }
  // Helper: pad NF to 9 digits with leading zeros (apostrophe prefix for Excel text)
  function fmtNF(nf){
    if(!nf)return '';
    const digits=(nf+'').replace(/\D/g,'');
    if(!digits)return nf;
    return digits.padStart(9,'0');
  }
  
  // Collect data across all substances
  const estoqueInicial=[];
  const entradas=[];
  const saidas=[];
  let warnings=0;
  
  for(const s of subs){
    const sm=allMov[s.n];
    if(!sm)continue;
    
    // Estoque Inicial (in grams)
    const ei=sm.estoqueInicial||0;
    if(ei>0||sm.lancamentos.length>0){
      estoqueInicial.push({substancia:s.n,qtd:ei});
    }
    
    // Filter lançamentos by semester period
    for(const l of(sm.lancamentos||[])){
      const ld=l.data?new Date(l.data):null;
      if(!ld)continue;
      if(ld<dtIni||ld>dtFim)continue;
      
      if(l.tipo==='entrada'){
        const cnpj=l.cnpjFornecedor||'';
        const fornNome=l.fornecedor||l.descricao||'';
        const nf=l.nfNumero||'';
        if(!cnpj&&!fornNome)warnings++;
        entradas.push({
          substancia:s.n,
          tipoEntrada:'Aquisição',
          qtd:l.qtd,
          identificacao:cnpj,
          nome:fornNome,
          nf:fmtNF(nf),
          data:fmtDtBR(l.data||'')
        });
      } else if(l.tipo==='saida'){
        const cpf=l.cpf||getC(l.tutor)||'';
        const tutor=l.tutor||'';
        const prescritor=l.prescritor||'';
        const cadMapa=l.cadMapa||getLancCadMapa(l)||'';
        const om=l.nrOm||'';
        const nfDoc=l.nrDoc||'';
        if(!cpf){warnings++;mapaLog('⚠ Saída sem CPF: '+tutor+' (OM:'+om+') — '+s.n,'warn');}
        if(!cadMapa){warnings++;mapaLog('⚠ Saída sem Cadastro MAPA: prescritor '+prescritor+' (OM:'+om+') — '+s.n,'warn');}
        saidas.push({
          substancia:s.n,
          tipoSaida:'Venda',
          qtd:l.qtd,
          identificacao:normCPF(cpf),
          nome:tutor,
          prescritor:prescritor,
          cadMapa:cadMapa,
          nrOM:om,
          nf:fmtNF(nfDoc),
          data:fmtDtBR(l.data||'')
        });
      } else if(l.tipo==='perda'){
        saidas.push({
          substancia:s.n,
          tipoSaida:'Perda',
          qtd:l.qtd,
          identificacao:'',
          nome:'',
          prescritor:'',
          cadMapa:'',
          nrOM:'',
          nf:'',
          data:fmtDtBR(l.data||'')
        });
      }
    }
  }
  
  if(!estoqueInicial.length&&!entradas.length&&!saidas.length){
    alert('Nenhum dado encontrado para o período selecionado.');return;
  }
  
  // Build XLSX workbook
  const wb=XLSX.utils.book_new();
  
  // Helper: force cells in a column to text format (for NFs, zeros, etc.)
  function forceTextCol(ws,col,startRow){
    const range=XLSX.utils.decode_range(ws['!ref']);
    for(let r=startRow;r<=range.e.r;r++){
      const addr=XLSX.utils.encode_cell({r:r,c:col});
      if(ws[addr]){ws[addr].t='s';ws[addr].z='@';ws[addr].v=String(ws[addr].v||'');}
    }
  }
  
  // Sheet 1: Estoque inicial
  const eiData=[['Substância','Quantidade']];
  estoqueInicial.forEach(e=>eiData.push([e.substancia,e.qtd]));
  const ws1=XLSX.utils.aoa_to_sheet(eiData);
  ws1['!cols']=[{wch:22},{wch:14}];
  // Force Quantidade column as text (for zeros to show properly)
  forceTextCol(ws1,1,1);
  XLSX.utils.book_append_sheet(wb,ws1,'Estoque inicial');
  
  // Sheet 2: Entradas
  const enData=[['Substância','Tipo de entrada','Quantidade','Identificação','Nome','Número da nota fiscal','Data da nota fiscal']];
  entradas.forEach(e=>enData.push([e.substancia,e.tipoEntrada,e.qtd,e.identificacao,e.nome,e.nf,e.data]));
  const ws2=XLSX.utils.aoa_to_sheet(enData);
  ws2['!cols']=[{wch:18},{wch:16},{wch:12},{wch:22},{wch:30},{wch:20},{wch:16}];
  // Force NF column (5) as text
  forceTextCol(ws2,5,1);
  XLSX.utils.book_append_sheet(wb,ws2,'Entradas');
  
  // Sheet 3: Saídas
  const saData=[['Substância','Tipo de saída','Quantidade','Identificação','Nome','Prescritor','Cadastro do prescritor no MAPA','Número da ordem de manipulação','Número da nota fiscal','Data da nota fiscal']];
  saidas.forEach(s=>saData.push([s.substancia,s.tipoSaida,s.qtd,s.identificacao,s.nome,s.prescritor,s.cadMapa,s.nrOM,s.nf,s.data]));
  const ws3=XLSX.utils.aoa_to_sheet(saData);
  ws3['!cols']=[{wch:18},{wch:18},{wch:12},{wch:18},{wch:28},{wch:28},{wch:24},{wch:18},{wch:20},{wch:16}];
  // Force NF column (8) as text
  forceTextCol(ws3,8,1);
  XLSX.utils.book_append_sheet(wb,ws3,'Saídas');
  
  // Download
  const cfg=ldCfg();
  const nomeArq='Relatorio_MAPA_'+ano+'_'+sem+'sem'+(cfg.fantasia?'_'+cfg.fantasia.replace(/\s+/g,'_').slice(0,20):'')+'.xlsx';
  XLSX.writeFile(wb,nomeArq);
  
  mapaLog('✓ Arquivo gerado: '+nomeArq,'ok');
  mapaLog('  Estoque inicial: '+estoqueInicial.length+' substâncias','ok');
  mapaLog('  Entradas: '+entradas.length+' registros','ok');
  mapaLog('  Saídas: '+saidas.length+' registros ('+saidas.filter(s=>s.tipoSaida==='Venda').length+' vendas, '+saidas.filter(s=>s.tipoSaida==='Perda').length+' perdas)','ok');
  if(warnings>0)mapaLog('⚠ '+warnings+' alertas — revise os campos em branco antes de enviar ao sistema MAPA','warn');
  else mapaLog('✓ Nenhum alerta. Arquivo pronto para upload no sistema gov.br','ok');
}

// ═══ PDF PARSER — RELATÓRIO MAPA (v5.0) ═══
let pdfFileData=null;
let pdfParsedVendas=[];
let pdfParsedCpfs={};
let pdfParsedPrescs={};

function setupPdfDZ(){
  const z=document.getElementById('z-pdf'),inp=document.getElementById('f-pdf'),fn=document.getElementById('fn-pdf');
  inp.addEventListener('change',e=>{if(e.target.files[0])readPdfFile(e.target.files[0],fn,z);});
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dov');});
  z.addEventListener('dragleave',()=>z.classList.remove('dov'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('dov');if(e.dataTransfer.files[0])readPdfFile(e.dataTransfer.files[0],fn,z);});
}
function readPdfFile(file,fn,z){
  const r=new FileReader();
  r.onload=e=>{pdfFileData=new Uint8Array(e.target.result);fn.textContent='✓ '+file.name;z.classList.add('rdy');document.getElementById('btn-pdf').disabled=false;pdfLog('PDF carregado: '+file.name,'ok');};
  r.readAsArrayBuffer(file);
}
function pdfSetP(p,t){const el=document.getElementById('pw-pdf');el.style.display='block';document.getElementById('pb-pdf').style.width=p+'%';document.getElementById('ptx-pdf').textContent=t;}
function pdfLog(m,t){const b=document.getElementById('lb-pdf');b.style.display='block';const l=document.createElement('div');if(t)l.className='l'+t[0];l.textContent=m;b.appendChild(l);b.scrollTop=b.scrollHeight;}

document.getElementById('btn-pdf')?.addEventListener('click',async()=>{
  if(!pdfFileData)return;
  // Check if PDF.js is loaded
  if(typeof pdfjsLib==='undefined'){
    alert('Biblioteca PDF.js ainda não carregou. Aguarde alguns segundos e tente novamente.');return;
  }
  if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const btn=document.getElementById('btn-pdf');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Processando PDF...';
  document.getElementById('lb-pdf').innerHTML='';
  document.getElementById('pdf-rev-wr').style.display='none';
  await new Promise(r=>setTimeout(r,50));
  try{
    pdfSetP(10,'Carregando PDF...');
    const pdf=await pdfjsLib.getDocument({data:pdfFileData}).promise;
    pdfLog('PDF: '+pdf.numPages+' páginas','ok');
    pdfSetP(20,'Extraindo texto...');
    
    const allPages=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const tc=await page.getTextContent();
      const vp=page.getViewport({scale:1});
      const items=tc.items.map(it=>({
        str:it.str,x:Math.round(it.transform[4]),y:Math.round(vp.height-it.transform[5]),w:it.width,h:it.height
      }));
      allPages.push({pageNum:i,items,width:vp.width,height:vp.height});
      pdfSetP(20+Math.round(40*i/pdf.numPages),'Página '+i+'/'+pdf.numPages);
    }
    
    pdfSetP(65,'Identificando páginas de VENDAS...');
    const vendasPages=[];
    for(const pg of allPages){
      const fullText=pg.items.map(it=>it.str).join(' ');
      if(fullText.includes('VENDAS DE PRODUTOS')&&fullText.includes('SUBSTÂNCIA'))vendasPages.push(pg);
    }
    pdfLog('Páginas de VENDAS: '+vendasPages.length,'ok');
    
    pdfSetP(70,'Parseando tabelas de VENDAS...');
    const vendas=[];
    for(const pg of vendasPages){
      const rows=pdfGroupRows(pg.items);
      const colBounds=pdfDetectColumns(rows,pg.width);
      if(!colBounds){pdfLog('Pág '+pg.pageNum+': cabeçalho não encontrado','warn');continue;}
      const dataRows=pdfExtractDataRows(rows,colBounds);
      vendas.push(...dataRows);
      pdfLog('Pág '+pg.pageNum+': '+dataRows.length+' registros','ok');
    }
    
    pdfSetP(85,'Construindo cadastros...');
    pdfParsedVendas=vendas;
    pdfParsedCpfs={};
    pdfParsedPrescs={};
    let newCpf=0,newPresc=0;
    const existCpfs=ldC();
    const existPrescs=ldP();
    for(const v of vendas){
      if(v.cpf&&v.tutor){
        const k=nn(v.tutor);
        const formatted=normCPF(v.cpf);
        const existVal=existCpfs[k]||'';
        const isNew=!existVal||normCPF(existVal)!==formatted;
        pdfParsedCpfs[k]={cpf:formatted,isNew};
        if(!existVal)newCpf++;
      }
      if(v.prescritor&&v.cadSipeagro){
        const k=nn(v.prescritor);
        const cur=existPrescs[k]||{};
        const isNew=!cur.cadMapa;
        pdfParsedPrescs[k]={cadSipeagro:v.cadSipeagro,isNew};
        if(isNew)newPresc++;
      }
    }
    
    pdfSetP(95,'Renderizando...');
    pdfLog('CPFs extraídos: '+Object.keys(pdfParsedCpfs).length+' ('+newCpf+' novos)','ok');
    pdfLog('Prescritores com SIPEAGRO: '+Object.keys(pdfParsedPrescs).length+' ('+newPresc+' novos)','ok');
    pdfLog('Total vendas: '+vendas.length,'ok');
    
    renderPdfReview();
    pdfSetP(100,'Pronto!');
  }catch(err){pdfLog('ERRO: '+err.message,'err');console.error(err);}
  finally{btn.disabled=false;btn.textContent='Processar PDF';}
});

function pdfGroupRows(items){
  // Group items by Y coordinate with tolerance
  const rows={};const tol=4;
  for(const it of items){
    if(!it.str.trim())continue;
    let found=false;
    for(const yk of Object.keys(rows)){
      if(Math.abs(it.y-parseFloat(yk))<=tol){rows[yk].push(it);found=true;break;}
    }
    if(!found)rows[it.y]=[it];
  }
  // Sort rows top→bottom, items left→right
  return Object.entries(rows).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([y,its])=>({y:parseFloat(y),items:its.sort((a,b)=>a.x-b.x)}));
}

function pdfDetectColumns(rows,pgWidth){
  // The MAPA PDF has multi-row headers. Scan the first ~15 rows for column header keywords.
  const cols={};
  const hdrLimit=Math.min(rows.length,15);
  for(let ri=0;ri<hdrLimit;ri++){
    for(const it of rows[ri].items){
      const s=it.str.trim();
      if(s.includes('SUBSTÂNCIA'))cols.substancia=it.x;
      if(s==='Lista')cols.lista=it.x;
      if(s.includes('Quantidade'))cols.qtd=it.x;
      if(s.includes('CNPJ/CPF'))cols.cpf=it.x;
      if(s.includes('Nome do Adquirente')||s==='Nome do Adquirente')cols.tutor=it.x;
      // "Prescritor" appears standalone (not inside other text)
      if(s==='Prescritor')cols.prescritor=it.x;
      if(s.includes('Cadastro do')||s.includes('SIPEAGRO'))cols.cadSipeagro=Math.min(cols.cadSipeagro||9999,it.x);
      if(s.includes('Número da')||s.includes('Ordem de'))cols.nrOM=Math.min(cols.nrOM||9999,it.x);
      if(s==='Nota Fiscal')cols.nf=it.x;
      if(s==='Data'&&it.x>pgWidth*0.7)cols.data=it.x;// "Data" near right edge
    }
  }
  // Infer missing tutor column from cpf position + offset
  if(!cols.tutor&&cols.cpf)cols.tutor=cols.cpf+80;
  // Infer prescritor from midpoint if not found
  if(!cols.prescritor&&cols.tutor&&(cols.cadSipeagro||cols.nrOM||cols.nf)){
    const rightBound=cols.cadSipeagro||cols.nrOM||cols.nf||cols.data;
    cols.prescritor=Math.round((cols.tutor+rightBound)/2);
  }
  if(cols.cpf!==undefined)return cols;
  // Last resort: try to detect from data patterns
  return pdfDetectColumnsFromData(rows);
}

function pdfDetectColumnsFromData(rows){
  // Try to infer columns from data patterns
  const subNames=['GABAPENTINA','FLUOXETINA','AMITRIPTILINA','SELEGILINA','TRAMADOL','CODEÍNA','CODEINA','RIBAVIRINA'];
  for(const row of rows){
    const text=row.items.map(it=>it.str).join('');
    const hasSub=subNames.some(s=>text.includes(s));
    const hasDate=/\d{2}\/\d{2}\/\d{4}/.test(text);
    const hasCpf=/\d{11}/.test(text.replace(/[.,\s]/g,''));
    if(hasSub&&hasDate&&hasCpf){
      const cols={};
      for(const it of row.items){
        const s=it.str.trim();
        if(subNames.includes(s.toUpperCase()))cols.substancia=it.x;
        if(s==='C1'||s==='A2')cols.lista=it.x;
        if(/^\d{11}$/.test(s.replace(/\D/g,'')))cols.cpf=it.x;
        if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))cols.data=it.x;
      }
      if(cols.cpf!==undefined&&cols.data!==undefined)return cols;
    }
  }
  return null;
}

function pdfExtractDataRows(rows,colBounds){
  const subNames=['GABAPENTINA','FLUOXETINA','AMITRIPTILINA','SELEGILINA','TRAMADOL','CODEÍNA','CODEINA','RIBAVIRINA'];
  const results=[];
  let pendingRow=null;
  // Get RT name from config for footer filtering
  const rtName=up(ldCfg().rtNome||'');
  const rtParts=rtName.split(/\s+/).filter(p=>p.length>2);// significant name parts
  
  for(const row of rows){
    const allText=row.items.map(it=>it.str).join(' ').toUpperCase();
    // Skip header/footer/structural rows
    if(allText.includes('SUBSTÂNCIA')||allText.includes('PÁGINA')||allText.includes('ASSINATURA')||allText.includes('RELATÓRIO')||allText.includes('RAZÃO SOCIAL')||allText.includes('ENDEREÇO')||allText.includes('EXERCÍCIO')||allText.includes('PERIODICIDADE')||allText.includes('CNPJ:'))continue;
    if(allText.includes('LISTA')&&allText.includes('QUANTIDADE'))continue;
    if(allText.includes('PRESCRITOR')&&allText.includes('CADASTRO'))continue;
    if(allText.includes('NOTA FISCAL')&&allText.includes('DATA'))continue;
    // Skip RT signature line — check if row contains RT name
    if(pdfRowIsRT(allText,rtName,rtParts))continue;
    // Skip CRF line
    if(/CRF[\s:]*\d+/.test(allText))continue;
    
    const firstWord=row.items.length>0?row.items[0].str.trim().toUpperCase():'';
    const hasSub=subNames.includes(firstWord)||(firstWord==='CODEINA');
    
    if(hasSub){
      if(pendingRow)results.push(pendingRow);
      pendingRow=pdfParseVendaRow(row,colBounds);
    } else if(pendingRow){
      // Check if this continuation row is actually a footer area
      if(pdfRowIsRT(allText,rtName,rtParts)){
        // Don't merge footer into data
      } else {
        pdfMergeContinuation(pendingRow,row,colBounds);
      }
    }
  }
  if(pendingRow)results.push(pendingRow);
  return results;
}

// Detect if a row text is the RT signature line
function pdfRowIsRT(text,rtName,rtParts){
  if(!text)return false;
  // Direct match
  if(text.includes(rtName))return true;
  // Check if row contains most parts of the RT name (handles slight variations)
  if(rtParts.length>=2){
    const matches=rtParts.filter(p=>text.includes(p));
    if(matches.length>=rtParts.length-1&&matches.length>=2)return true;
  }
  return false;
}

function pdfParseVendaRow(row,cols){
  const rec={substancia:'',lista:'',qtd:0,cpf:'',tutor:'',prescritor:'',cadSipeagro:'',num1:'',num2:'',data:'',dataObj:null};
  
  // Sort all text items and assign to columns based on X position
  // Build column boundaries (midpoints between known column X positions)
  const cKeys=Object.keys(cols).filter(k=>cols[k]!==undefined).sort((a,b)=>cols[a]-cols[b]);
  
  // Simple approach: assign each text item to nearest column
  for(const it of row.items){
    const s=it.str.trim();
    if(!s)continue;
    const x=it.x;
    
    // Use pattern matching to assign
    const subNames=['GABAPENTINA','FLUOXETINA','AMITRIPTILINA','SELEGILINA','TRAMADOL','CODEÍNA','CODEINA','RIBAVIRINA'];
    if(subNames.includes(s.toUpperCase())){rec.substancia=s.toUpperCase().replace('CODEINA','CODEÍNA');continue;}
    if(s==='C1'||s==='A2'){rec.lista=s;continue;}
    
    // Date pattern
    const dm=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if(dm){rec.data=s;rec.dataObj=new Date(parseInt(dm[3]),parseInt(dm[2])-1,parseInt(dm[1]));continue;}
    
    // SIPEAGRO pattern: NNNNN/YYYY or NNNNNN/YYYY
    if(/^\d{3,6}\/\d{4}$/.test(s)){rec.cadSipeagro=s;continue;}
    
    // Quantity pattern (comma decimal)
    if(/^\d+,\d{4}$/.test(s)){rec.qtd=parseFloat(s.replace(',','.'));continue;}
    
    // CPF (11 digits, possibly with dots/dash)
    const cpfClean=s.replace(/\D/g,'');
    if(cpfClean.length===11&&/^\d{11}$/.test(cpfClean)){rec.cpf=cpfClean;continue;}
    
    // 5-digit numbers (NF or OM)
    if(/^\d{4,6}$/.test(s)){
      if(!rec.num1)rec.num1=s;
      else rec.num2=s;
      continue;
    }
    
    // Remaining text: assign to tutor or prescritor based on X position
    if(cols.prescritor!==undefined&&x>=cols.prescritor-15&&cols.cadSipeagro!==undefined&&x<cols.cadSipeagro-15){
      rec.prescritor=(rec.prescritor?rec.prescritor+' ':'')+s;
    } else if(cols.tutor!==undefined&&x>=cols.tutor-15&&cols.prescritor!==undefined&&x<cols.prescritor-15){
      rec.tutor=(rec.tutor?rec.tutor+' ':'')+s;
    } else if(cols.cpf!==undefined&&x<(cols.tutor||cols.prescritor||9999)-15){
      // Might be part of CPF column area but not matching CPF format — could be continuation
    } else if(x>(cols.cpf||0)&&x<(cols.data||9999)){
      // Generic text in the name area — try to classify by position
      const midPresc=cols.prescritor||((cols.tutor||0)+(cols.cadSipeagro||cols.nrOM||cols.data||999))/2;
      if(x>=midPresc-15)rec.prescritor=(rec.prescritor?rec.prescritor+' ':'')+s;
      else rec.tutor=(rec.tutor?rec.tutor+' ':'')+s;
    }
  }
  
  // Normalize
  rec.substancia=up(rec.substancia);
  rec.tutor=up(rec.tutor);
  rec.prescritor=up(rec.prescritor);
  
  // Determine which num is OM (smaller ~32xxx) and which is NF (larger ~36xxx)
  // The OM numbers in the existing system are the smaller ones
  const n1=parseInt(rec.num1),n2=parseInt(rec.num2);
  if(!isNaN(n1)&&!isNaN(n2)){
    // In the PDF column order: NrOM comes before NF
    // But the actual values: NrOM matches existing nrOm from XLS import
    // From the data, OM numbers are like 32xxx-33xxx and NF/Doc are like 36xxx-38xxx
    if(n1>n2){rec.nrDoc=rec.num1;rec.nrOm=rec.num2;}
    else{rec.nrDoc=rec.num2;rec.nrOm=rec.num1;}
  } else {
    rec.nrOm=rec.num1||'';rec.nrDoc=rec.num2||'';
  }
  
  return rec;
}

function pdfMergeContinuation(rec,row,cols){
  const allText=row.items.map(it=>it.str).join(' ').toUpperCase();
  // Skip footer-like rows entirely
  if(allText.includes('PÁGINA')||allText.includes('ASSINATURA')||/CRF[\s:]*\d+/.test(allText))return;
  const rtName=up(ldCfg().rtNome||'');
  const rtParts=rtName.split(/\s+/).filter(p=>p.length>2);
  if(pdfRowIsRT(allText,rtName,rtParts))return;
  
  for(const it of row.items){
    const s=it.str.trim();if(!s)continue;
    const x=it.x;
    
    const midPresc=cols.prescritor||0;
    if(cols.prescritor!==undefined&&x>=cols.prescritor-15&&cols.cadSipeagro!==undefined&&x<cols.cadSipeagro-15){
      rec.prescritor=(rec.prescritor?rec.prescritor+' ':'')+s;
    } else if(cols.tutor!==undefined&&x>=cols.tutor-15&&x<midPresc-15){
      rec.tutor=(rec.tutor?rec.tutor+' ':'')+s;
    } else if(x>(cols.cpf||0)&&x<(cols.data||9999)){
      if(x>=midPresc-15)rec.prescritor=(rec.prescritor?rec.prescritor+' ':'')+s;
      else rec.tutor=(rec.tutor?rec.tutor+' ':'')+s;
    }
  }
  rec.tutor=up(rec.tutor);
  rec.prescritor=up(rec.prescritor);
}

// Prescriber merge mapping: pdfName → existingName (or null for new)
let pdfPrescMerge={};

function renderPdfReview(){
  document.getElementById('pdf-rev-wr').style.display='block';
  pdfPrescMerge={};// reset merge mapping
  
  // CPFs table
  const cpfEntries=Object.entries(pdfParsedCpfs).sort((a,b)=>a[0].localeCompare(b[0]));
  let newC=cpfEntries.filter(([,v])=>v.isNew).length;
  document.getElementById('pdf-cpf-cnt').textContent=cpfEntries.length+' tutores com CPF ('+newC+' novos, não cadastrados)';
  let h='<thead><tr><th></th><th>Tutor</th><th>CPF</th><th>Status</th></tr></thead><tbody>';
  cpfEntries.forEach(([nome,v],i)=>{
    const cls=v.isNew?' class="rw-w"':'';
    h+='<tr'+cls+'><td>'+(i+1)+'</td><td>'+esc(nome)+'</td><td>'+esc(normCPF(v.cpf))+'</td><td>'+(v.isNew?'<span style="color:var(--gn);font-weight:700">NOVO</span>':'Existente')+'</td></tr>';
  });
  h+='</tbody>';
  document.getElementById('pdf-cpf-tbl').innerHTML=h;
  
  // Prescritores table — with merge dropdown
  const prescEntries=Object.entries(pdfParsedPrescs).sort((a,b)=>a[0].localeCompare(b[0]));
  let newP=prescEntries.filter(([,v])=>v.isNew).length;
  document.getElementById('pdf-presc-cnt').textContent=prescEntries.length+' prescritores com SIPEAGRO ('+newP+' novos)';
  // Build existing prescriber options
  const existPrescs=Object.entries(ldP()).sort((a,b)=>a[0].localeCompare(b[0]));
  h='<thead><tr><th></th><th>Nome no PDF</th><th>SIPEAGRO</th><th>Status</th><th style="min-width:180px">Vincular a (prescritor existente)</th></tr></thead><tbody>';
  prescEntries.forEach(([nome,v],i)=>{
    const cls=v.isNew?' class="rw-w"':'';
    const eNome=nome.replace(/'/g,"\\'");
    // Build dropdown options
    let opts='<option value="">'+(v.isNew?'(Criar novo)':'(Manter atual)')+'</option>';
    existPrescs.forEach(([en,ev])=>{
      const label=en+(ev.crmv?' — CRMV-'+(ev.uf||'GO')+' '+ev.crmv:'')+(ev.cadMapa?' ['+ev.cadMapa+']':'');
      opts+='<option value="'+esc(en)+'"'+(en===nome?' selected':'')+'>'+esc(label)+'</option>';
    });
    h+='<tr'+cls+'><td>'+(i+1)+'</td><td>'+esc(nome)+'</td><td>'+esc(v.cadSipeagro)+'</td><td>'+(v.isNew?'<span style="color:var(--gn);font-weight:700">NOVO</span>':'Existente')+'</td>';
    h+='<td><select style="width:100%;background:var(--sf2);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-family:var(--sans);font-size:.68rem;padding:3px 4px" onchange="pdfPrescMerge[\''+eNome+'\']=this.value||null">'+opts+'</select></td></tr>';
  });
  h+='</tbody>';
  document.getElementById('pdf-presc-tbl').innerHTML=h;
  
  // Vendas table
  document.getElementById('pdf-vendas-cnt').textContent=pdfParsedVendas.length+' dispensações extraídas';
  h='<thead><tr><th>#</th><th>Substância</th><th>Qtd(g)</th><th>CPF</th><th>Tutor</th><th>Prescritor</th><th>SIPEAGRO</th><th>OM</th><th>Doc</th><th>Data</th></tr></thead><tbody>';
  pdfParsedVendas.forEach((v,i)=>{
    const warn=!v.cpf||!v.prescritor?'rw-w':'';
    h+='<tr class="'+warn+'"><td>'+(i+1)+'</td><td>'+esc(v.substancia)+'</td><td>'+(v.qtd?v.qtd.toFixed(4):'')+'</td><td>'+esc(normCPF(v.cpf))+'</td><td>'+esc(v.tutor)+'</td><td>'+esc(v.prescritor)+'</td><td>'+esc(v.cadSipeagro)+'</td><td>'+esc(v.nrOm)+'</td><td>'+esc(v.nrDoc)+'</td><td>'+esc(v.data)+'</td></tr>';
  });
  h+='</tbody>';
  document.getElementById('pdf-vendas-tbl').innerHTML=h;
  
  document.getElementById('pdf-rev-wr').scrollIntoView({behavior:'smooth',block:'start'});
}

function importPdfData(){
  if(!pdfParsedVendas.length){alert('Nenhum dado extraído. Processe o PDF primeiro.');return;}
  
  let addedCpf=0,updCpf=0;
  const cpfs=ldC();
  for(const[nome,v]of Object.entries(pdfParsedCpfs)){
    if(v.cpf){
      const formatted=normCPF(v.cpf);
      if(!cpfs[nome]){addedCpf++;}else if(cpfs[nome]!==formatted){updCpf++;}
      cpfs[nome]=formatted;
    }
  }
  svC(cpfs);
  
  let addedPresc=0,updPresc=0,mergedPresc=0;
  const prescs=ldP();
  for(const[nome,v]of Object.entries(pdfParsedPrescs)){
    if(v.cadSipeagro){
      // Check if user selected a merge target
      const mergeTarget=pdfPrescMerge[nome];
      const targetName=mergeTarget||nome;// use merge target if set, otherwise original name
      
      if(!prescs[targetName]){
        prescs[targetName]={crmv:'',uf:'GO',cadMapa:v.cadSipeagro};
        addedPresc++;
      } else if(!prescs[targetName].cadMapa||prescs[targetName].cadMapa!==v.cadSipeagro){
        if(!prescs[targetName].cadMapa)addedPresc++;else updPresc++;
        prescs[targetName].cadMapa=v.cadSipeagro;
      }
      if(mergeTarget&&mergeTarget!==nome)mergedPresc++;
    }
  }
  svP(prescs);
  
  pdfLog('✓ CPFs importados: '+addedCpf+' novos, '+updCpf+' atualizados','ok');
  pdfLog('✓ Prescritores SIPEAGRO: '+addedPresc+' novos, '+updPresc+' atualizados'+(mergedPresc?' ('+mergedPresc+' vinculados)':''),'ok');
  alert('Cadastros atualizados!\n'+addedCpf+' CPFs novos\n'+addedPresc+' cadastros SIPEAGRO novos'+(mergedPresc?'\n'+mergedPresc+' prescritores vinculados':''));
}

function enrichMovFromPdf(){
  if(!pdfParsedVendas.length){alert('Nenhum dado extraído. Processe o PDF primeiro.');return;}
  
  // Build maps for quick lookup
  const vendaByOM={};
  for(const v of pdfParsedVendas){
    if(v.nrOm)vendaByOM[v.nrOm]=v;
  }
  
  const movs=ldM();
  let enriched=0;
  for(const sn of Object.keys(movs)){
    const s=movs[sn];if(!s||!s.lancamentos)continue;
    for(const l of s.lancamentos){
      if(l.tipo!=='saida')continue;
      const om=l.nrOm;if(!om)continue;
      const v=vendaByOM[om];if(!v)continue;
      
      // Enrich CPF
      if(!l.cpf&&v.cpf){l.cpf=normCPF(v.cpf);enriched++;}
      else if(l.cpf&&l.cpf.replace(/\D/g,'').length===11){l.cpf=normCPF(l.cpf);}// normalize existing
      // Enrich Cadastro MAPA
      if(!l.cadMapa&&v.cadSipeagro){l.cadMapa=v.cadSipeagro;enriched++;}
      // Enrich tutor if empty
      if(!l.tutor&&v.tutor)l.tutor=v.tutor;
      // Enrich prescritor if empty  
      if(!l.prescritor&&v.prescritor)l.prescritor=v.prescritor;
    }
  }
  svM(movs);
  
  pdfLog('✓ '+enriched+' campos enriquecidos nos movimentos existentes','ok');
  alert(enriched+' campos enriquecidos nos movimentos existentes!');
  renderMov();
}

// ═══ INIT ═══
try{
setupDZ('z-m','f-m','fn-m','m');
setupDZ('z-c','f-c','fn-c','c');
setupPdfDZ();
setupSipDZ();
document.getElementById('mv-sub').innerHTML=SUB.map(s=>'<option value="'+s.n+'">'+s.n+' ('+s.l+')</option>').join('');
var ySel=document.getElementById('mv-ano');var cY=new Date().getFullYear();for(var y=cY-2;y<=cY+1;y++){var o=document.createElement('option');o.value=y;o.textContent=y;if(y===cY)o.selected=true;ySel.appendChild(o);}
document.getElementById('mv-sem').value=new Date().getMonth()<6?'1':'2';
// MAPA export defaults
document.getElementById('mapa-ano').value=new Date().getFullYear();
document.getElementById('mapa-sem').value=new Date().getMonth()<6?'1':'2';
document.getElementById('inp-estab').value=ldCfg().fantasia||'';
chkBkp();
// Update header with establishment name
const _cfg=ldCfg();
const _hdrE=document.getElementById('hdr-estab');
if(_cfg.fantasia)_hdrE.textContent=_cfg.fantasia;
else _hdrE.textContent='Fórmula Animal · Escrituração Digital';
setTimeout(function(){try{renderMov();}catch(e){console.error('renderMov init:',e);}},100);
console.log('Controle Especial v5.0 inicializado com '+SUB.length+' substâncias');
}catch(e){console.error('INIT ERROR:',e);}
// Auto-migrar dados v3 se necessário
try{(function(){
  const movs=ldM();let needMigrate=false;
  for(const sn of Object.keys(movs)){
    const s=movs[sn];if(!s||!s.lancamentos)continue;
    for(const l of s.lancamentos){if(l.tipo==='saida'&&l.nrOm&&(!l.tutor||l.tutor.length<2)){needMigrate=true;break;}}
    if(needMigrate)break;
  }
  if(needMigrate){console.log('Detectados movimentos v3 sem dados de tutor. Executando migração...');migrateV3toV4(ldH(),ldC(),ldE(),ldP());}
  // Extrair prescritores de movimentos existentes para o cadastro
  const prescs=ldP();let added=0;
  for(const sn of Object.keys(movs)){
    const s=movs[sn];if(!s||!s.lancamentos)continue;
    for(const l of s.lancamentos){
      if(l.tipo==='saida'&&l.prescritor&&l.prescritor.length>2&&l.crmvNr){
        const k=nn(l.prescritor);
        if(!prescs[k]||!prescs[k].crmv){
          prescs[k]={crmv:l.crmvNr,uf:l.crmvUf||'GO',cadMapa:l.cadMapa||''};
          added++;
        }
      }
    }
  }
  if(added>0){svP(prescs);console.log('Extraídos '+added+' prescritores dos movimentos existentes.');}
  // Normalizar CPFs existentes para formato XXX.XXX.XXX-XX
  const cpfCad=ldC();let cpfNorm=0;
  for(const k of Object.keys(cpfCad)){
    const raw=cpfCad[k];const d=raw.replace(/\D/g,'');
    if(d.length===11){const f=normCPF(d);if(f!==raw){cpfCad[k]=f;cpfNorm++;}}
  }
  if(cpfNorm>0){svC(cpfCad);console.log('Normalizados '+cpfNorm+' CPFs para XXX.XXX.XXX-XX.');}
})();}catch(e){console.error('Migration error:',e);}
