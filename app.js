/**
 * CONTROLADOS v3.0 — R S O MANIPULAÇÃO ANIMAL
 * ─────────────────────────────────────────────────────
 * Novidades v3:
 *  [1] Impressão direta: Corpo (livro de registro) + Etiquetas (3×5/A4)
 *  [2] Cadastro de CPF por tutor (localStorage)
 *  [3] Tabela de revisão editável antes da geração
 *  [4] Movimentos manuais + recálculo em cascata
 */

// ══════════════════════════════════════════════════════════════
// ── CONSTANTES E SUBSTÂNCIAS ─────────────────────────────────
// ══════════════════════════════════════════════════════════════

const SUBSTANCIAS = [
  { nome: 'Gabapentina',   lista: 'C1', dcb: '04369' },
  { nome: 'Fluoxetina',    lista: 'C1', dcb: '03094' },
  { nome: 'Amitriptilina', lista: 'C1', dcb: '00423' },
  { nome: 'Selegilina',    lista: 'C1', dcb: '07929' },
  { nome: 'Tramadol',      lista: 'A2', dcb: '08806' },
  { nome: 'Codeína',       lista: 'A2', dcb: '01706' },
  { nome: 'Ribavirina',    lista: 'C1', dcb: '07168' },
];

const LS_HIST_KEY = 'controlados_fa_v2';     // histórico (compatível v2)
const LS_CPF_KEY  = 'controlados_cpfs';      // cadastro CPF
const LS_MOV_KEY  = 'controlados_movimentos'; // movimentos manuais

// ══════════════════════════════════════════════════════════════
// ── ESTADO GLOBAL ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

let dadosMov     = null;   // linhas brutas do MOVIMENTO.XLS
let dadosCE      = null;   // linhas brutas do CLIENTE_END.XLS
let dadosCruzados = [];    // array após cruzamento (editável)
let xlsxBlob     = null;   // blob do Excel gerado
let ultimoEstoquesFinal = {}; // para impressão

// ══════════════════════════════════════════════════════════════
// ── HELPERS GENÉRICOS ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function arred(n) { return Math.round((n || 0) * 10000) / 10000; }

function fmtData(d) {
  if (!d) return '';
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' +
         d.getFullYear();
}

function fmtDataISO(d) {
  if (!d) return '';
  return d.getFullYear() + '-' +
         String(d.getMonth()+1).padStart(2,'0') + '-' +
         String(d.getDate()).padStart(2,'0');
}

function parseDataBR(s) {
  if (!s) return null;
  const p = String(s).split('/');
  if (p.length !== 3) return null;
  const y = parseInt(p[2]) < 100 ? 2000 + parseInt(p[2]) : parseInt(p[2]);
  return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
}

function setProgress(pct, txt) {
  document.getElementById('progress-wrap').classList.add('visible');
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = txt;
}

function log(msg, tipo) {
  const box = document.getElementById('log-box');
  box.classList.add('visible');
  const line = document.createElement('div');
  if (tipo) line.className = 'log-' + tipo;
  line.textContent = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function checkReady() {
  document.getElementById('btn-processar').disabled = !(dadosMov && dadosCE);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ══════════════════════════════════════════════════════════════
// ── LOCALSTORAGE — HISTÓRICO ─────────────────────────────────
// ══════════════════════════════════════════════════════════════

function loadHistorico() {
  try { return JSON.parse(localStorage.getItem(LS_HIST_KEY) || '[]'); }
  catch(e) { return []; }
}
function saveHistorico(h) { localStorage.setItem(LS_HIST_KEY, JSON.stringify(h)); }

function ultimoEstoqueFinal(nomeSubst) {
  const hist = loadHistorico();
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].estoquesFinal && hist[i].estoquesFinal[nomeSubst] !== undefined)
      return hist[i].estoquesFinal[nomeSubst];
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════
// ── LOCALSTORAGE — CPF [FASE 1] ─────────────────────────────
// ══════════════════════════════════════════════════════════════

function normalizarNome(nome) {
  return String(nome || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function loadCPFs() {
  try { return JSON.parse(localStorage.getItem(LS_CPF_KEY) || '{}'); }
  catch(e) { return {}; }
}
function saveCPFs(c) { localStorage.setItem(LS_CPF_KEY, JSON.stringify(c)); }

function getCPF(nome) {
  return loadCPFs()[normalizarNome(nome)] || '';
}
function setCPF(nome, cpf) {
  if (!nome) return;
  const c = loadCPFs();
  const key = normalizarNome(nome);
  if (cpf && cpf.trim()) { c[key] = cpf.trim(); }
  else { delete c[key]; }
  saveCPFs(c);
}

function formatCPF(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
  return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
}

// ══════════════════════════════════════════════════════════════
// ── LOCALSTORAGE — MOVIMENTOS [FASE 4] ──────────────────────
// ══════════════════════════════════════════════════════════════

function loadMovimentos() {
  try { return JSON.parse(localStorage.getItem(LS_MOV_KEY) || '{}'); }
  catch(e) { return {}; }
}
function saveMovimentos(m) { localStorage.setItem(LS_MOV_KEY, JSON.stringify(m)); }

function getSubstMovimentos(nomeSubst) {
  const all = loadMovimentos();
  if (!all[nomeSubst]) all[nomeSubst] = { estoqueInicial: 0, lancamentos: [] };
  return all[nomeSubst];
}

function recalcularSaldos(nomeSubst) {
  const all = loadMovimentos();
  const s = all[nomeSubst];
  if (!s) return 0;
  s.lancamentos.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  let saldo = s.estoqueInicial || 0;
  for (const l of s.lancamentos) {
    if (l.tipo === 'entrada') saldo = arred(saldo + l.qtd);
    else if (l.tipo === 'saida') saldo = arred(saldo - l.qtd);
    else if (l.tipo === 'perda') saldo = arred(saldo - l.qtd);
    l.saldoApos = saldo;
  }
  saveMovimentos(all);
  return saldo;
}

function adicionarLancamento(nomeSubst, lanc) {
  const all = loadMovimentos();
  if (!all[nomeSubst]) all[nomeSubst] = { estoqueInicial: 0, lancamentos: [] };
  all[nomeSubst].lancamentos.push(lanc);
  saveMovimentos(all);
  recalcularSaldos(nomeSubst);
}

function removerLancamento(nomeSubst, lancId) {
  const all = loadMovimentos();
  if (!all[nomeSubst]) return;
  all[nomeSubst].lancamentos = all[nomeSubst].lancamentos.filter(l => l.id !== lancId);
  saveMovimentos(all);
  recalcularSaldos(nomeSubst);
}

function atualizarLancamento(nomeSubst, lancId, updates) {
  const all = loadMovimentos();
  if (!all[nomeSubst]) return;
  const l = all[nomeSubst].lancamentos.find(x => x.id === lancId);
  if (l) Object.assign(l, updates);
  saveMovimentos(all);
  recalcularSaldos(nomeSubst);
}

function setEstoqueInicialMov(nomeSubst, valor) {
  const all = loadMovimentos();
  if (!all[nomeSubst]) all[nomeSubst] = { estoqueInicial: 0, lancamentos: [] };
  all[nomeSubst].estoqueInicial = valor;
  saveMovimentos(all);
  recalcularSaldos(nomeSubst);
}

/** Importa saídas do cruzamento para o store de movimentos (deduplica por nrOm+substância) */
function importarSaidasParaMovimentos(dados) {
  const all = loadMovimentos();
  for (const d of dados) {
    if (d.status !== 'Ativa') continue;
    const nomeSubst = identificarSubstancia(d.substancia);
    if (!nomeSubst) continue;
    if (!all[nomeSubst]) all[nomeSubst] = { estoqueInicial: 0, lancamentos: [] };
    // deduplica por nrOm
    const existe = all[nomeSubst].lancamentos.find(
      l => l.nrOm === d.nrOm && l.tipo === 'saida'
    );
    if (existe) {
      // atualiza dados
      existe.qtd = d.qtdG || 0;
      existe.data = d.data ? fmtDataISO(d.data) : '';
      existe.descricao = `OM ${d.nrOm} / Doc ${d.nrDoc}`;
    } else {
      all[nomeSubst].lancamentos.push({
        id: 'imp_' + uid(),
        tipo: 'saida',
        data: d.data ? fmtDataISO(d.data) : '',
        qtd: d.qtdG || 0,
        descricao: `OM ${d.nrOm} / Doc ${d.nrDoc}`,
        nrOm: d.nrOm,
        nrDoc: d.nrDoc,
        origem: 'importado',
      });
    }
  }
  saveMovimentos(all);
  // recalcula todas as substâncias afetadas
  for (const nome of Object.keys(all)) recalcularSaldos(nome);
}

/** Encontra qual substância cadastrada corresponde ao nome vindo do Farma Fácil */
function identificarSubstancia(nomeFF) {
  if (!nomeFF) return null;
  const upper = nomeFF.toUpperCase();
  for (const s of SUBSTANCIAS) {
    if (upper.includes(s.nome.toUpperCase()) || nomeFF.includes(s.dcb)) return s.nome;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// ── TABS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'historico') renderHistorico();
  if (id === 'movimentos') renderMovimentos();
}

// ══════════════════════════════════════════════════════════════
// ── ESTOQUE INICIAL GRID ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function montarEstGrid() {
  const grid = document.getElementById('est-grid');
  grid.innerHTML = '';
  SUBSTANCIAS.forEach(s => {
    const ultimo = ultimoEstoqueFinal(s.nome);
    const div = document.createElement('div');
    div.className = 'est-field';
    div.innerHTML = `
      <div class="subst-name">${s.nome}</div>
      <label>Lista ${s.lista} · DCB ${s.dcb}</label>
      <input type="number" id="est-${s.nome}" value="${ultimo}" step="0.0001" min="0" />
      <div class="last-val">${ultimo > 0 ? '↑ período anterior: ' + ultimo.toFixed(4) + ' g' : 'Sem histórico'}</div>`;
    grid.appendChild(div);
  });
}

function getEstoqueInicial() {
  const est = {};
  SUBSTANCIAS.forEach(s => {
    const input = document.getElementById('est-' + s.nome);
    est[s.nome] = input ? (parseFloat(input.value) || 0) : 0;
  });
  return est;
}

// ══════════════════════════════════════════════════════════════
// ── UPLOAD ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function setupDrop(zoneId, inputId, fnameId, tipo) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const fnEl  = document.getElementById(fnameId);

  input.addEventListener('change', e => {
    if (e.target.files[0]) readXLS(e.target.files[0], tipo, fnEl, zone);
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) readXLS(e.dataTransfer.files[0], tipo, fnEl, zone);
  });
}

function readXLS(file, tipo, fnEl, zone) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array', codepage: 1252 });
      const sh  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
      if (tipo === 'mov') {
        dadosMov = raw;
        fnEl.textContent = '✓ ' + file.name;
        zone.classList.add('ready');
        log(`MOVIMENTO carregado — ${raw.length} linhas`, 'ok');
      } else {
        dadosCE = raw;
        fnEl.textContent = '✓ ' + file.name;
        zone.classList.add('ready');
        log(`CLIENTE_END carregado — ${raw.length} linhas`, 'ok');
      }
      checkReady();
    } catch(err) { log('Erro ao ler arquivo: ' + err.message, 'err'); }
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════
// ── EXTRAÇÃO MOVIMENTO ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function extrairMovimento(raw) {
  const recs = [];
  let subst = '', lista = '';
  function cell(row, c) {
    if (!row) return '';
    const v = row[c];
    return (v !== undefined && v !== null) ? String(v).trim() : '';
  }
  function limpaNr(v) {
    const n = parseFloat(String(v));
    return (!isNaN(n) && String(v).trim() === String(n)) ? String(Math.round(n)) : String(v).trim();
  }
  for (let r = 0; r < raw.length; r++) {
    const row = raw[r];
    if (String(row[6] || '').includes('Produto:')) {
      subst = cell(row, 8);
      lista = cell(row, 3);
      continue;
    }
    if (cell(row, 4) === 'O.M.') {
      const dataStr = cell(row, 0);
      let dt = parseDataBR(dataStr);
      let qtdG = null;
      try { qtdG = parseFloat(String(row[17]).replace(',', '.')); } catch(e) {}
      const crmvRaw = cell(row, 20);
      const crmvNr  = crmvRaw.replace(/CRMV\s+\w+:\s*/i, '').trim();
      recs.push({
        substancia: subst, lista, data: dt, dataStr,
        tutor: cell(row, 7),
        nrOm: limpaNr(row[11]), nrDoc: limpaNr(row[12]),
        calculo: cell(row, 15), qtdG, crmvRaw, crmvNr,
        nrReceita: limpaNr(row[25]),
      });
    }
  }
  return recs;
}

// ══════════════════════════════════════════════════════════════
// ── EXTRAÇÃO CLIENTE_END ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function extrairClienteEnd(raw) {
  const dados = {};
  function cell(r, c) {
    if (r < 0 || r >= raw.length) return '';
    const v = raw[r][c];
    return (v !== undefined && v !== null) ? String(v).trim() : '';
  }
  for (let r = 0; r < raw.length; r++) {
    const status = cell(r, 12);
    if (status !== 'Ativa' && status !== 'Cancelada') continue;
    const nrRaw = cell(r, 36);
    let nr = nrRaw;
    const nrF = parseFloat(nrRaw);
    if (!isNaN(nrF)) nr = String(Math.round(nrF));
    const cliente  = (cell(r, 37) + ' ' + cell(r+1, 37)).trim();
    const end_l1   = cell(r, 52);
    const end_l2   = cell(r+1, 52);
    const endereco = (end_l1 + ' ' + end_l2).trim().replace(/(\d+)\.0\b/g, '$1');
    let prescritor = '', crmvNr = '', qtdeTexto = '', formula = '', doseMg = '';
    for (let off = 3; off < 10; off++) {
      if (r + off >= raw.length) break;
      if (cell(r + off, 0) === 'Prescritor:') {
        const pr = r + off;
        const p1 = cell(pr, 11);
        const p2 = (cell(pr+1, 0) === '') ? cell(pr+1, 11) : '';
        prescritor = (p1 + ' ' + p2).trim();
        const cv = cell(pr, 43);
        const cvF = parseFloat(cv);
        crmvNr = !isNaN(cvF) ? String(Math.round(cvF)) : cv;
        qtdeTexto = cell(pr, 59);
        const fr = pr + 2;
        if (fr < raw.length) {
          formula = cell(fr, 43);
          const dr = cell(fr, 64);
          const drF = parseFloat(dr);
          doseMg = !isNaN(drF) ? drF : dr;
        }
        break;
      }
    }
    dados[nr] = { status, cliente, endereco, prescritor, crmvNr, qtdeTexto, formula, doseMg };
  }
  return dados;
}

// ══════════════════════════════════════════════════════════════
// ── CRUZAMENTO ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function cruzar(movs, ced) {
  return movs.map(m => {
    const ce = ced[m.nrOm] || {};
    return { ...m,
      clienteFull: ce.cliente    || m.tutor,
      endereco:    ce.endereco   || '',
      cpf:         getCPF(ce.cliente || m.tutor),   // CPF do cadastro
      prescritor:  ce.prescritor || '',
      crmvNrCE:    ce.crmvNr     || m.crmvNr,
      qtdeTexto:   ce.qtdeTexto  || '',
      doseMg:      ce.doseMg     || '',
      status:      ce.status     || 'Ativa',
    };
  });
}

// ══════════════════════════════════════════════════════════════
// ── BOTÃO PROCESSAR (extrai + cruza + mostra revisão) ────────
// ══════════════════════════════════════════════════════════════

document.getElementById('btn-processar').addEventListener('click', async () => {
  document.getElementById('log-box').innerHTML = '';
  document.getElementById('result-card').classList.remove('visible');
  document.getElementById('rev-wrap').classList.remove('visible');
  xlsxBlob = null;

  const btn = document.getElementById('btn-processar');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Processando...';

  await new Promise(r => setTimeout(r, 50));

  try {
    setProgress(10, 'Lendo MOVIMENTO.XLS...');
    const movs = extrairMovimento(dadosMov);
    log(`Movimento: ${movs.length} dispensações encontradas`, 'ok');

    setProgress(40, 'Lendo CLIENTE_END.XLS...');
    const ced = extrairClienteEnd(dadosCE);
    log(`Receituário: ${Object.keys(ced).length} registros encontrados`, 'ok');

    setProgress(70, 'Cruzando dados...');
    dadosCruzados = cruzar(movs, ced);

    const semMatch = dadosCruzados.filter(d => !d.prescritor).length;
    if (semMatch > 0) log(`⚠ ${semMatch} registros sem correspondência no Receituário`, 'warn');

    setProgress(100, 'Dados prontos para revisão');
    log('Revise os dados na tabela abaixo e clique em Gerar Planilha Final.', 'ok');

    renderRevisao();
    document.getElementById('rev-wrap').classList.add('visible');
    document.getElementById('rev-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch(err) {
    log('ERRO: ' + err.message, 'err');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
      Processar Dados`;
    checkReady();
  }
});

// ══════════════════════════════════════════════════════════════
// ── TABELA DE REVISÃO [FASE 2 + FASE 3 CPF] ─────────────────
// ══════════════════════════════════════════════════════════════

function renderRevisao() {
  const table = document.getElementById('rev-table');
  const semCPF = dadosCruzados.filter(d => d.status === 'Ativa' && !d.cpf);

  // Alerta de CPFs faltantes
  const alertEl = document.getElementById('cpf-alert');
  if (semCPF.length > 0) {
    const nomes = [...new Set(semCPF.map(d => d.clienteFull))];
    alertEl.innerHTML = `⚠ <strong>${nomes.length} tutor(es)</strong> sem CPF cadastrado (${semCPF.length} dispensações). ` +
      `Preencha na coluna CPF da tabela ou no <a href="#" onclick="abrirCPFModal();return false" style="color:var(--yellow)">Cadastro de CPFs</a>.`;
    alertEl.style.display = 'block';
  } else {
    alertEl.style.display = 'none';
  }

  // Cabeçalho
  let html = `<thead><tr>
    <th>#</th><th>Substância</th><th>Data</th><th>Nº OM</th><th>Nº Doc</th>
    <th style="min-width:140px">Tutor</th><th style="min-width:110px">CPF</th>
    <th style="min-width:180px">Endereço</th><th style="min-width:130px">Prescritor</th>
    <th>CRMV</th><th style="min-width:100px">Cálculo</th><th>Qtd (g)</th>
    <th>Nº Receita</th><th>Status</th>
  </tr></thead><tbody>`;

  dadosCruzados.forEach((d, i) => {
    const cls = d.status === 'Cancelada' ? ' class="row-cancelada"' : '';
    const cpfCls = (d.status === 'Ativa' && !d.cpf) ? 'cpf-missing' : (d.cpf ? 'cpf-ok' : '');
    html += `<tr${cls}>
      <td>${i + 1}</td>
      <td>${d.substancia}</td>
      <td>${d.data ? fmtData(d.data) : d.dataStr}</td>
      <td>${d.nrOm}</td>
      <td>${d.nrDoc}</td>
      <td><input value="${esc(d.clienteFull)}" data-i="${i}" data-f="clienteFull" onchange="revEdit(this)" /></td>
      <td><input value="${esc(d.cpf)}" data-i="${i}" data-f="cpf" class="${cpfCls}"
            oninput="this.value=formatCPF(this.value)" onchange="revEditCPF(this)" placeholder="000.000.000-00" /></td>
      <td><input value="${esc(d.endereco)}" data-i="${i}" data-f="endereco" onchange="revEdit(this)" /></td>
      <td><input value="${esc(d.prescritor)}" data-i="${i}" data-f="prescritor" onchange="revEdit(this)" /></td>
      <td><input value="${esc(d.crmvNrCE || d.crmvNr)}" data-i="${i}" data-f="crmvNrCE" onchange="revEdit(this)" style="width:70px" /></td>
      <td><input value="${esc(d.calculo)}" data-i="${i}" data-f="calculo" onchange="revEdit(this)" /></td>
      <td><input type="number" value="${d.qtdG || ''}" data-i="${i}" data-f="qtdG" onchange="revEdit(this)" step="0.0001" style="width:70px" /></td>
      <td><input value="${esc(d.nrReceita)}" data-i="${i}" data-f="nrReceita" onchange="revEdit(this)" style="width:80px" /></td>
      <td><select data-i="${i}" data-f="status" onchange="revEdit(this)">
            <option value="Ativa"${d.status==='Ativa'?' selected':''}>Ativa</option>
            <option value="Cancelada"${d.status==='Cancelada'?' selected':''}>Cancelada</option>
          </select></td>
    </tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;
  document.getElementById('rev-count').textContent =
    `${dadosCruzados.length} registros · ${dadosCruzados.filter(d=>d.status==='Ativa').length} ativos`;
}

function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function revEdit(el) {
  const i = parseInt(el.dataset.i);
  const f = el.dataset.f;
  if (f === 'qtdG') {
    dadosCruzados[i][f] = parseFloat(el.value) || 0;
  } else {
    dadosCruzados[i][f] = el.value;
  }
  // atualizar contagem
  document.getElementById('rev-count').textContent =
    `${dadosCruzados.length} registros · ${dadosCruzados.filter(d=>d.status==='Ativa').length} ativos`;
}

function revEditCPF(el) {
  const i = parseInt(el.dataset.i);
  const cpf = el.value;
  dadosCruzados[i].cpf = cpf;
  // Salvar no cadastro
  const nome = dadosCruzados[i].clienteFull;
  setCPF(nome, cpf);
  // Atualizar todas as linhas do mesmo tutor
  const nomeNorm = normalizarNome(nome);
  dadosCruzados.forEach((d, j) => {
    if (j !== i && normalizarNome(d.clienteFull) === nomeNorm) {
      d.cpf = cpf;
    }
  });
  // Re-render para atualizar classes visuais
  renderRevisao();
  // Restaurar foco
  const inputs = document.querySelectorAll(`#rev-table input[data-f="cpf"][data-i="${i}"]`);
  if (inputs.length) inputs[0].focus();
}

// ══════════════════════════════════════════════════════════════
// ── MODAL DE CPFs ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function abrirCPFModal() {
  const cpfs = loadCPFs();
  const lista = document.getElementById('cpf-lista');
  const entries = Object.entries(cpfs).sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) {
    lista.innerHTML = '<p style="color:var(--muted);font-family:var(--mono);font-size:.75rem">Nenhum CPF cadastrado ainda.</p>';
  } else {
    let html = '<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.72rem">';
    html += '<tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">TUTOR</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);color:var(--accent);font-size:.62rem">CPF</th>' +
            '<th style="width:40px"></th></tr>';
    entries.forEach(([nome, cpf]) => {
      const safeNome = nome.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      html += `<tr>
        <td style="padding:4px 6px;border-bottom:1px solid var(--border);color:var(--text)">${esc(nome)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid var(--border)">
          <input value="${esc(cpf)}" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;
            color:var(--text);font-family:var(--mono);font-size:.72rem;padding:2px 6px;width:130px"
            oninput="this.value=formatCPF(this.value)"
            onchange="setCPF('${safeNome}',this.value)" /></td>
        <td><button class="btn-danger" style="font-size:.6rem;padding:2px 6px"
          onclick="setCPF('${safeNome}','');this.closest('tr').remove()">✕</button></td>
      </tr>`;
    });
    html += '</table>';
    lista.innerHTML = html;
  }

  document.getElementById('cpf-modal').classList.add('active');
}

function fecharCPFModal() {
  document.getElementById('cpf-modal').classList.remove('active');
  // Re-render revisão se visível
  if (document.getElementById('rev-wrap').classList.contains('visible')) {
    // Atualizar CPFs na tabela
    const cpfs = loadCPFs();
    dadosCruzados.forEach(d => {
      d.cpf = cpfs[normalizarNome(d.clienteFull)] || d.cpf || '';
    });
    renderRevisao();
  }
}

function limparCPFs() {
  if (!confirm('Limpar todos os CPFs cadastrados?')) return;
  saveCPFs({});
  abrirCPFModal(); // re-render
}

// Fechar modal ao clicar fora
document.getElementById('cpf-modal').addEventListener('click', function(e) {
  if (e.target === this) fecharCPFModal();
});

// ══════════════════════════════════════════════════════════════
// ── BOTÃO GERAR PLANILHA FINAL ───────────────────────────────
// ══════════════════════════════════════════════════════════════

document.getElementById('btn-gerar').addEventListener('click', async () => {
  if (!dadosCruzados.length) return;

  const nomeEstab    = document.getElementById('estabelecimento').value.trim() || 'R S O Manipulação Animal';
  const periodoLabel = document.getElementById('periodo-label').value.trim();
  const estInicial   = getEstoqueInicial();

  const btn = document.getElementById('btn-gerar');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Gerando...';

  await new Promise(r => setTimeout(r, 50));

  try {
    setProgress(30, 'Gerando Excel...');
    const { blob, estoquesFinal } = gerarExcel(dadosCruzados, estInicial, nomeEstab, periodoLabel);
    xlsxBlob = blob;
    ultimoEstoquesFinal = estoquesFinal;

    setProgress(60, 'Salvando no histórico...');
    salvarNoHistorico(dadosCruzados, estInicial, estoquesFinal, periodoLabel, nomeEstab);

    setProgress(80, 'Registrando movimentos...');
    // Atualizar estoques iniciais no store de movimentos
    SUBSTANCIAS.forEach(s => setEstoqueInicialMov(s.nome, estInicial[s.nome] || 0));
    // Importar saídas para o store de movimentos
    importarSaidasParaMovimentos(dadosCruzados);

    montarEstGrid();

    setProgress(100, 'Concluído!');
    log('Planilha gerada, histórico e movimentos atualizados!', 'ok');

    // Estatísticas
    const ativas = dadosCruzados.filter(d => d.status === 'Ativa');
    const substs = [...new Set(dadosCruzados.map(d => d.substancia))];
    const totalG = ativas.reduce((a, d) => a + (d.qtdG || 0), 0);
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = '';
    [
      { num: dadosCruzados.length,  lbl: 'Dispensações' },
      { num: ativas.length,         lbl: 'Ativas' },
      { num: substs.length,         lbl: 'Substâncias' },
      { num: arred(totalG) + ' g',  lbl: 'Total saída' },
    ].forEach(s => {
      statsGrid.innerHTML += `<div class="stat-box"><div class="stat-num">${s.num}</div><div class="stat-lbl">${s.lbl}</div></div>`;
    });

    // Popular select de substância para impressão
    const sel = document.getElementById('print-subst-select');
    sel.innerHTML = SUBSTANCIAS.map(s => `<option value="${s.nome}">${s.nome} (${s.lista})</option>`).join('');

    log('── Estoques finais ──', 'ok');
    SUBSTANCIAS.forEach(s => {
      if (estoquesFinal[s.nome] !== undefined) log(`  ${s.nome}: ${estoquesFinal[s.nome].toFixed(4)} g`, 'ok');
    });

    document.getElementById('result-card').classList.add('visible');

  } catch(err) {
    log('ERRO: ' + err.message, 'err');
    console.error(err);
    setProgress(0, 'Erro.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M9 12l2 2 4-4"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
      </svg>
      Gerar Planilha Final`;
  }
});

// ══════════════════════════════════════════════════════════════
// ── GERAÇÃO EXCEL ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function gerarExcel(dados, estInicial, nomeEstab, periodoLabel) {
  const wb = XLSX.utils.book_new();

  const datas   = dados.filter(d => d.data).map(d => d.data);
  const periodo = datas.length
    ? `${fmtData(new Date(Math.min(...datas)))} a ${fmtData(new Date(Math.max(...datas)))}`
    : '';
  const titulo  = periodoLabel || periodo;

  const estoquesFinal = {};

  // ── RESUMO ──
  const resumoRows = [
    [`RELATÓRIO DE MOVIMENTAÇÃO — CONTROLADOS VETERINÁRIOS — ${nomeEstab}`],
    [`Período: ${titulo}`],
    [],
    ['Substância','Lista','DCB','Est. Inicial (g)','Dispensações','Total Saída (g)','Est. Final (g)'],
  ];
  for (const s of SUBSTANCIAS) {
    const ds = dados.filter(d =>
      d.substancia.toUpperCase().includes(s.nome.toUpperCase()) ||
      d.substancia.includes(s.dcb)
    );
    const ativas = ds.filter(d => d.status === 'Ativa');
    const totalSaida = arred(ativas.reduce((a, d) => a + (d.qtdG || 0), 0));
    const estIni  = estInicial[s.nome] || 0;
    const estFin  = arred(estIni - totalSaida);
    estoquesFinal[s.nome] = estFin;
    resumoRows.push([s.nome, s.lista, s.dcb, estIni, ativas.length, totalSaida, estFin]);
  }
  const wsRes = XLSX.utils.aoa_to_sheet(resumoRows);
  wsRes['!cols'] = [{wch:20},{wch:7},{wch:8},{wch:15},{wch:14},{wch:16},{wch:14}];
  XLSX.utils.book_append_sheet(wb, wsRes, 'RESUMO');

  // ── CONTROLE ──
  const ctrlRows = [
    [`BASE DE DADOS — ${nomeEstab.toUpperCase()} — ${titulo}`],
    [],
    ['Nº OM','Nº DOC','Data','Tutor/Cliente','CPF','Endereço','CRMV nº',
     'Veterinário','Substância','Lista','Fórmula','Dose (mg)',
     'Qtde Texto','Qtd (g)','Nº Receita','Status'],
    ...dados.map(d => [
      d.nrOm, d.nrDoc,
      d.data ? fmtData(d.data) : d.dataStr,
      d.clienteFull, d.cpf || '', d.endereco,
      d.crmvNrCE || d.crmvNr, d.prescritor,
      d.substancia, d.lista, d.calculo,
      d.doseMg, d.qtdeTexto, d.qtdG,
      d.nrReceita, d.status,
    ])
  ];
  const wsCtrl = XLSX.utils.aoa_to_sheet(ctrlRows);
  wsCtrl['!cols'] = [{wch:9},{wch:9},{wch:12},{wch:30},{wch:15},{wch:40},{wch:10},{wch:24},
                     {wch:20},{wch:6},{wch:18},{wch:10},{wch:16},{wch:9},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsCtrl, 'CONTROLE');

  // ── CORPO por substância ──
  for (const s of SUBSTANCIAS) {
    const ds = dados.filter(d =>
      (d.substancia.toUpperCase().includes(s.nome.toUpperCase()) ||
       d.substancia.includes(s.dcb)) && d.status === 'Ativa'
    );
    const safe = s.nome.replace(/[^\w]/g, '_');
    const estIni = estInicial[s.nome] || 0;

    const rows = [
      ['LIVRO DE REGISTRO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL DE USO VETERINÁRIO'],
      [`SUBSTÂNCIA (DCB): ${s.nome}   |   Lista: ${s.lista}   |   ${nomeEstab}`],
      [`Período: ${titulo}`],
      [],
      ['DATA','EST. INICIAL (g)','ENTRADA (g)','SAÍDA (g)',
       'PERDAS (g)','EST. FINAL (g)','REG / NR DOC','OUTRAS INFORMAÇÕES'],
      ['ESTOQUE INICIAL', estIni, '', '', '', estIni,
       '', `Estoque inicial do período — ${titulo}`],
    ];

    // Incluir entradas e perdas do store de movimentos
    const movStore = getSubstMovimentos(s.nome);
    const entradas = movStore.lancamentos.filter(l => l.tipo === 'entrada');
    const perdas   = movStore.lancamentos.filter(l => l.tipo === 'perda');

    // Mesclar dispensações com entradas e perdas, ordenar por data
    const todosLanc = [];

    // Adicionar dispensações como saídas
    ds.forEach(d => {
      todosLanc.push({
        tipo: 'saida', data: d.data, qtd: d.qtdG || 0,
        nrOm: d.nrOm, nrDoc: d.nrDoc, crmvRaw: d.crmvRaw,
        prescritor: d.prescritor, calculo: d.calculo, nrReceita: d.nrReceita,
      });
    });

    // Adicionar entradas manuais
    entradas.forEach(l => {
      todosLanc.push({
        tipo: 'entrada', data: l.data ? new Date(l.data + 'T12:00:00') : null,
        qtd: l.qtd, descricao: l.descricao,
      });
    });

    // Adicionar perdas
    perdas.forEach(l => {
      todosLanc.push({
        tipo: 'perda', data: l.data ? new Date(l.data + 'T12:00:00') : null,
        qtd: l.qtd, descricao: l.descricao,
      });
    });

    // Ordenar por data
    todosLanc.sort((a, b) => {
      const da = a.data ? (a.data instanceof Date ? a.data.getTime() : new Date(a.data).getTime()) : 0;
      const db = b.data ? (b.data instanceof Date ? b.data.getTime() : new Date(b.data).getTime()) : 0;
      return da - db;
    });

    let saldo = estIni;
    for (const l of todosLanc) {
      const dt = l.data instanceof Date ? l.data : (l.data ? new Date(l.data) : null);
      const entrada = l.tipo === 'entrada' ? l.qtd : 0;
      const saida   = l.tipo === 'saida'   ? l.qtd : 0;
      const perda   = l.tipo === 'perda'   ? l.qtd : 0;
      const novoSaldo = arred(saldo + entrada - saida - perda);

      let info = '';
      if (l.tipo === 'saida') {
        info = [`Receita: ${l.nrReceita}`, l.crmvRaw, l.prescritor, l.calculo].filter(Boolean).join(' | ');
      } else if (l.tipo === 'entrada') {
        info = `ENTRADA: ${l.descricao || ''}`;
      } else {
        info = `PERDA: ${l.descricao || ''}`;
      }

      rows.push([
        dt ? fmtData(dt) : '',
        arred(saldo),
        entrada || '',
        saida   || '',
        perda   || '',
        novoSaldo,
        l.nrOm ? `${l.nrOm} / ${l.nrDoc}` : (l.tipo === 'entrada' ? 'ENTRADA' : 'PERDA'),
        info,
      ]);
      saldo = novoSaldo;
    }

    rows.push(['ESTOQUE FINAL', '', '', '', '', arred(saldo),
               '', 'Estoque final do período — transferir para próximo período']);

    const ws2 = XLSX.utils.aoa_to_sheet(rows);
    ws2['!cols'] = [{wch:14},{wch:14},{wch:11},{wch:11},
                    {wch:9},{wch:14},{wch:20},{wch:55}];
    XLSX.utils.book_append_sheet(wb, ws2, `CORPO_${safe}`);
  }

  // ── FICHAS ──
  const fichasRows = [
    [`FICHAS DE DISPENSAÇÃO — ${nomeEstab} — ${titulo}`],
    ['Nº OM','Nº DOC','Data','Tutor','CPF','Endereço','Veterinário',
     'CRMV','Substância','Fórmula','Qtd (g)','Nº Receita','Status'],
    ...dados.map(d => [
      d.nrOm, d.nrDoc,
      d.data ? fmtData(d.data) : d.dataStr,
      d.clienteFull, d.cpf || '', d.endereco, d.prescritor,
      d.crmvNrCE || d.crmvNr,
      d.substancia, d.calculo, d.qtdG, d.nrReceita, d.status,
    ])
  ];
  const wsFichas = XLSX.utils.aoa_to_sheet(fichasRows);
  wsFichas['!cols'] = [{wch:9},{wch:9},{wch:12},{wch:28},{wch:15},{wch:38},
                       {wch:22},{wch:10},{wch:20},{wch:16},{wch:9},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsFichas, 'FICHAS_IMPRIMIR');

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return {
    blob: new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    estoquesFinal,
  };
}

// ══════════════════════════════════════════════════════════════
// ── SALVAR NO HISTÓRICO ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function salvarNoHistorico(dados, estInicial, estoquesFinal, periodoLabel, nomeEstab) {
  const hist = loadHistorico();
  const datas = dados.filter(d => d.data).map(d => d.data);
  hist.push({
    id:              Date.now(),
    geradoEm:        new Date().toISOString(),
    periodoLabel,
    estabelecimento: nomeEstab,
    dataInicio:      datas.length ? new Date(Math.min(...datas)).toISOString() : null,
    dataFim:         datas.length ? new Date(Math.max(...datas)).toISOString() : null,
    totalRegistros:  dados.length,
    substanciasAtivas: [...new Set(dados.filter(d => d.status === 'Ativa').map(d => d.substancia))],
    estoquesInicial: estInicial,
    estoquesFinal,
  });
  saveHistorico(hist);
}

// ══════════════════════════════════════════════════════════════
// ── RENDERIZAR HISTÓRICO ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function renderHistorico() {
  const hist  = loadHistorico();
  const lista = document.getElementById('hist-lista');
  if (!hist.length) {
    lista.innerHTML = '<div class="hist-empty">Nenhum registro gerado ainda.</div>';
    return;
  }
  lista.innerHTML = '';
  [...hist].reverse().forEach(reg => {
    const dt    = new Date(reg.geradoEm);
    const dtStr = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const div   = document.createElement('div');
    div.className = 'hist-entry';
    const pillsHtml = SUBSTANCIAS.map(s => {
      const fin = reg.estoquesFinal?.[s.nome];
      if (fin === undefined && !reg.estoquesInicial?.[s.nome]) return '';
      return `<span class="hist-pill">${s.nome} <span>${fin !== undefined ? fin.toFixed(4) + 'g' : '—'}</span></span>`;
    }).join('');

    div.innerHTML = `
      <div class="hist-header">
        <div class="hist-periodo">${reg.periodoLabel || 'Período ' + (reg.dataInicio ? fmtData(new Date(reg.dataInicio)) : '?')}</div>
        <div class="hist-date">${dtStr}</div>
      </div>
      <div style="font-family:var(--mono);font-size:.72rem;color:var(--muted);margin-bottom:8px">
        ${reg.totalRegistros} dispensações · ${reg.estabelecimento}
      </div>
      <div style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:8px">Estoques finais:</div>
      <div class="hist-substs">${pillsHtml}</div>
      <div class="hist-actions">
        <button class="btn-secondary" style="font-size:.75rem;padding:7px 14px"
          onclick="usarComoInicial(${reg.id})">↑ Usar como est. inicial</button>
        <button class="btn-danger" onclick="excluirRegistro(${reg.id})">Excluir</button>
      </div>`;
    lista.appendChild(div);
  });
}

function usarComoInicial(id) {
  const hist = loadHistorico();
  const reg  = hist.find(r => r.id === id);
  if (!reg || !reg.estoquesFinal) return;
  SUBSTANCIAS.forEach(s => {
    const input = document.getElementById('est-' + s.nome);
    if (input && reg.estoquesFinal[s.nome] !== undefined) {
      input.value = reg.estoquesFinal[s.nome];
    }
  });
  switchTab('gerar', document.querySelectorAll('.tab')[0]);
  log('Estoques iniciais carregados do registro selecionado.', 'ok');
}

function excluirRegistro(id) {
  if (!confirm('Excluir este registro do histórico?')) return;
  saveHistorico(loadHistorico().filter(r => r.id !== id));
  renderHistorico();
}

// ══════════════════════════════════════════════════════════════
// ── BACKUP / RESTAURAÇÃO ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function exportarBackup() {
  const data = {
    versao: 3,
    exportadoEm: new Date().toISOString(),
    historico:   loadHistorico(),
    cpfs:        loadCPFs(),
    movimentos:  loadMovimentos(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `backup_controlados_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Compatibilidade v2
      const hist = data.historico || (Array.isArray(data) ? data : null);
      if (!hist || !Array.isArray(hist)) throw new Error('Formato inválido');
      let msg = `Importar ${hist.length} registros de histórico?`;
      if (data.cpfs) msg += `\n+ ${Object.keys(data.cpfs).length} CPFs cadastrados`;
      if (data.movimentos) msg += `\n+ Movimentos de ${Object.keys(data.movimentos).length} substâncias`;
      msg += '\n\nOs dados atuais serão substituídos.';
      if (!confirm(msg)) return;
      saveHistorico(hist);
      if (data.cpfs) saveCPFs(data.cpfs);
      if (data.movimentos) saveMovimentos(data.movimentos);
      renderHistorico();
      montarEstGrid();
      alert('Backup importado com sucesso!');
    } catch(err) { alert('Erro ao importar: ' + err.message); }
  };
  reader.readAsText(file);
  input.value = '';
}

// ══════════════════════════════════════════════════════════════
// ── IMPRESSÃO — CORPO [FASE 1a] ─────────────────────────────
// ══════════════════════════════════════════════════════════════

function imprimirCorpo() {
  const nomeSubst = document.getElementById('print-subst-select').value;
  const s = SUBSTANCIAS.find(x => x.nome === nomeSubst);
  if (!s) return;

  const nomeEstab    = document.getElementById('estabelecimento').value.trim() || 'R S O Manipulação Animal';
  const periodoLabel = document.getElementById('periodo-label').value.trim();
  const estInicial   = getEstoqueInicial();
  const estIni       = estInicial[s.nome] || 0;

  // Filtrar dados da substância
  const ds = dadosCruzados.filter(d =>
    (d.substancia.toUpperCase().includes(s.nome.toUpperCase()) ||
     d.substancia.includes(s.dcb)) && d.status === 'Ativa'
  );

  // Montar movimentos (mesmo merge do gerarExcel)
  const movStore = getSubstMovimentos(s.nome);
  const todosLanc = [];

  ds.forEach(d => {
    todosLanc.push({
      tipo: 'saida', data: d.data, qtd: d.qtdG || 0,
      nrOm: d.nrOm, nrDoc: d.nrDoc, crmvRaw: d.crmvRaw,
      prescritor: d.prescritor, calculo: d.calculo, nrReceita: d.nrReceita,
    });
  });
  movStore.lancamentos.filter(l => l.tipo === 'entrada').forEach(l => {
    todosLanc.push({ tipo: 'entrada', data: l.data ? new Date(l.data + 'T12:00:00') : null, qtd: l.qtd, descricao: l.descricao });
  });
  movStore.lancamentos.filter(l => l.tipo === 'perda').forEach(l => {
    todosLanc.push({ tipo: 'perda', data: l.data ? new Date(l.data + 'T12:00:00') : null, qtd: l.qtd, descricao: l.descricao });
  });

  todosLanc.sort((a, b) => {
    const da = a.data ? (a.data instanceof Date ? a.data.getTime() : new Date(a.data).getTime()) : 0;
    const db = b.data ? (b.data instanceof Date ? b.data.getTime() : new Date(b.data).getTime()) : 0;
    return da - db;
  });

  let html = `<div class="print-corpo">
    <h2>LIVRO DE REGISTRO DE ESTOQUE DE SUBSTÂNCIAS SUJEITAS A CONTROLE ESPECIAL DE USO VETERINÁRIO</h2>
    <h3>SUBSTÂNCIA (DCB): ${s.nome} (${s.dcb}) &nbsp;|&nbsp; Lista: ${s.lista} &nbsp;|&nbsp; ${nomeEstab}<br>
    Período: ${periodoLabel}</h3>
    <table>
      <tr>
        <th style="width:18mm">DATA</th>
        <th>EST. INICIAL (g)</th><th>ENTRADA (g)</th><th>SAÍDA (g)</th>
        <th>PERDAS (g)</th><th>EST. FINAL (g)</th><th style="width:22mm">REG / NR DOC</th>
        <th class="col-info">OUTRAS INFORMAÇÕES</th>
      </tr>
      <tr class="row-est">
        <td>EST. INICIAL</td><td>${estIni.toFixed(4)}</td>
        <td></td><td></td><td></td><td>${estIni.toFixed(4)}</td>
        <td></td><td class="col-info">Estoque inicial — ${periodoLabel}</td>
      </tr>`;

  let saldo = estIni;
  for (const l of todosLanc) {
    const dt = l.data instanceof Date ? l.data : (l.data ? new Date(l.data) : null);
    const entrada = l.tipo === 'entrada' ? l.qtd : 0;
    const saida   = l.tipo === 'saida'   ? l.qtd : 0;
    const perda   = l.tipo === 'perda'   ? l.qtd : 0;
    const novoSaldo = arred(saldo + entrada - saida - perda);

    let info = '';
    if (l.tipo === 'saida') {
      info = [`Rec: ${l.nrReceita}`, l.prescritor, l.calculo].filter(Boolean).join(' | ');
    } else if (l.tipo === 'entrada') {
      info = `ENTRADA: ${l.descricao || ''}`;
    } else {
      info = `PERDA: ${l.descricao || ''}`;
    }

    html += `<tr>
      <td class="col-data">${dt ? fmtData(dt) : ''}</td>
      <td>${arred(saldo).toFixed(4)}</td>
      <td>${entrada ? entrada.toFixed(4) : ''}</td>
      <td>${saida ? saida.toFixed(4) : ''}</td>
      <td>${perda ? perda.toFixed(4) : ''}</td>
      <td>${novoSaldo.toFixed(4)}</td>
      <td>${l.nrOm ? l.nrOm + '/' + l.nrDoc : (l.tipo === 'entrada' ? 'ENT' : 'PER')}</td>
      <td class="col-info">${info}</td>
    </tr>`;
    saldo = novoSaldo;
  }

  html += `<tr class="row-est">
      <td>EST. FINAL</td><td></td><td></td><td></td><td></td>
      <td>${arred(saldo).toFixed(4)}</td><td></td>
      <td class="col-info">Estoque final do período</td>
    </tr></table></div>`;

  document.getElementById('print-area').innerHTML = html;
  window.print();
}

// ══════════════════════════════════════════════════════════════
// ── IMPRESSÃO — ETIQUETAS [FASE 1b] ─────────────────────────
// ══════════════════════════════════════════════════════════════

function imprimirEtiquetas(modo) {
  if (!dadosCruzados.length) return;
  const ativos = dadosCruzados.filter(d => d.status === 'Ativa');
  if (!ativos.length) { alert('Nenhuma dispensação ativa para etiquetas.'); return; }

  let html = '';

  if (modo === 'linear') {
    // ── Layout linear: 1 etiqueta por linha, largura A4, para colar no livro ──
    html = '<div class="print-etiquetas-linear">';
    for (const d of ativos) {
      html += `<div class="etq-linear">
        <div class="etq-l-subst">${identificarSubstancia(d.substancia) || d.substancia}</div>
        <div class="etq-l-row">
          <span><strong>Tutor:</strong> ${d.clienteFull}</span>
          <span><strong>Vet.:</strong> ${d.prescritor} — CRMV ${d.crmvNrCE || d.crmvNr}</span>
        </div>
        <div class="etq-l-row">
          <span><strong>Cálculo:</strong> ${d.calculo}${d.doseMg ? ' (' + d.doseMg + ' mg)' : ''}</span>
          <span><strong>Data:</strong> ${d.data ? fmtData(d.data) : d.dataStr}</span>
          <span><strong>Qtd:</strong> ${d.qtdG ? d.qtdG.toFixed(4) + ' g' : ''}</span>
        </div>
        <div class="etq-l-om">OM ${d.nrOm}<br>Rec ${d.nrReceita}</div>
      </div>`;
    }
    html += '</div>';

  } else {
    // ── Layout grade: 3×5 = 15 etiquetas por folha A4, para colar nas receitas ──
    const paginas = [];
    for (let i = 0; i < ativos.length; i += 15) {
      paginas.push(ativos.slice(i, i + 15));
    }
    html = '<div class="print-etiquetas">';
    for (const pag of paginas) {
      html += '<div class="etq-page">';
      for (const d of pag) {
        html += `<div class="etq">
          <div class="etq-subst">${d.substancia}</div>
          <div class="etq-field"><strong>Tutor:</strong> ${d.clienteFull}</div>
          <div class="etq-field"><strong>Vet.:</strong> ${d.prescritor} — CRMV ${d.crmvNrCE || d.crmvNr}</div>
          <div class="etq-field"><strong>Cálculo:</strong> ${d.calculo}${d.doseMg ? ' ('+d.doseMg+' mg)' : ''}</div>
          <div class="etq-field"><strong>Data:</strong> ${d.data ? fmtData(d.data) : d.dataStr} &nbsp; <strong>Qtd:</strong> ${d.qtdG ? d.qtdG.toFixed(4) + ' g' : ''}</div>
          <div class="etq-field"><strong>OM:</strong> ${d.nrOm} &nbsp; <strong>Receita:</strong> ${d.nrReceita}</div>
        </div>`;
      }
      for (let i = pag.length; i < 15; i++) {
        html += '<div class="etq" style="border-color:transparent"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  document.getElementById('print-area').innerHTML = html;
  window.print();
}

// ══════════════════════════════════════════════════════════════
// ── ABA MOVIMENTOS [FASE 4] ─────────────────────────────────
// ══════════════════════════════════════════════════════════════

function renderMovimentos() {
  // Popular select
  const sel = document.getElementById('mov-subst');
  const current = sel.value;
  sel.innerHTML = SUBSTANCIAS.map(s => `<option value="${s.nome}"${s.nome===current?' selected':''}>${s.nome} (${s.lista})</option>`).join('');

  renderMovimentosLista();
}

function renderMovimentosLista() {
  const nome = document.getElementById('mov-subst').value;
  const subst = getSubstMovimentos(nome);
  recalcularSaldos(nome);
  // Re-load após recálculo
  const substAtual = getSubstMovimentos(nome);

  // Resumo
  const resumo = document.getElementById('mov-resumo');
  const totalEntradas = substAtual.lancamentos.filter(l => l.tipo === 'entrada').reduce((a, l) => a + l.qtd, 0);
  const totalSaidas   = substAtual.lancamentos.filter(l => l.tipo === 'saida').reduce((a, l) => a + l.qtd, 0);
  const totalPerdas   = substAtual.lancamentos.filter(l => l.tipo === 'perda').reduce((a, l) => a + l.qtd, 0);
  const saldoFinal    = substAtual.lancamentos.length
    ? substAtual.lancamentos[substAtual.lancamentos.length - 1].saldoApos
    : substAtual.estoqueInicial;

  resumo.innerHTML = [
    { num: arred(substAtual.estoqueInicial) + ' g', lbl: 'Est. Inicial', color: '' },
    { num: arred(totalEntradas) + ' g',  lbl: 'Entradas',   color: 'var(--green)' },
    { num: arred(totalSaidas) + ' g',    lbl: 'Saídas',     color: 'var(--accent)' },
    { num: arred(totalPerdas) + ' g',    lbl: 'Perdas',     color: 'var(--red)' },
    { num: arred(saldoFinal) + ' g',     lbl: 'Saldo Final', color: saldoFinal < 0 ? 'var(--red)' : 'var(--green)' },
  ].map(s => `<div class="stat-box">
    <div class="stat-num" style="font-size:1rem;${s.color ? 'color:'+s.color : ''}">${s.num}</div>
    <div class="stat-lbl">${s.lbl}</div>
  </div>`).join('');

  // Tabela
  const table = document.getElementById('mov-table');
  let html = `<thead><tr>
    <th>Data</th><th>Tipo</th><th>Qtd (g)</th><th>Saldo (g)</th><th>Descrição</th><th>Origem</th><th></th>
  </tr></thead><tbody>`;

  if (!substAtual.lancamentos.length) {
    html += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Nenhum lançamento registrado</td></tr>';
  } else {
    substAtual.lancamentos.forEach(l => {
      const tagCls = `mov-tag mov-tag-${l.tipo}`;
      const tipoLabel = l.tipo === 'entrada' ? 'Entrada' : l.tipo === 'saida' ? 'Saída' : 'Perda';
      const saldoCls = l.saldoApos < 0 ? ' mov-saldo-neg' : '';
      html += `<tr>
        <td>${l.data || ''}</td>
        <td><span class="${tagCls}">${tipoLabel}</span></td>
        <td>${l.qtd ? l.qtd.toFixed(4) : '0'}</td>
        <td class="${saldoCls}">${l.saldoApos !== undefined ? l.saldoApos.toFixed(4) : ''}</td>
        <td style="max-width:200px;word-break:break-word">${l.descricao || ''}</td>
        <td style="font-size:.6rem;color:var(--muted)">${l.origem === 'importado' ? 'Importado' : 'Manual'}</td>
        <td>
          ${l.origem !== 'importado' ? `<button class="btn-danger" style="font-size:.58rem;padding:2px 6px" onclick="removerMov('${nome}','${l.id}')">✕</button>` : ''}
        </td>
      </tr>`;
    });
  }
  html += '</tbody>';
  table.innerHTML = html;
}

document.getElementById('mov-subst').addEventListener('change', renderMovimentosLista);

function adicionarMovimento() {
  const nome = document.getElementById('mov-subst').value;
  const tipo = document.getElementById('mov-tipo').value;
  const desc = document.getElementById('mov-descricao').value.trim();
  const qtd  = parseFloat(document.getElementById('mov-qtd').value);
  const data = document.getElementById('mov-data').value;

  if (!qtd || qtd <= 0) { alert('Informe a quantidade.'); return; }
  if (!data) { alert('Informe a data.'); return; }

  adicionarLancamento(nome, {
    id: uid(),
    tipo,
    data,
    qtd,
    descricao: desc,
    nrOm: null,
    nrDoc: null,
    origem: 'manual',
  });

  // Limpar form
  document.getElementById('mov-descricao').value = '';
  document.getElementById('mov-qtd').value = '';

  renderMovimentosLista();
}

function removerMov(nome, id) {
  if (!confirm('Remover este lançamento?')) return;
  removerLancamento(nome, id);
  renderMovimentosLista();
}

// ══════════════════════════════════════════════════════════════
// ── DOWNLOAD ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

document.getElementById('btn-download').addEventListener('click', () => {
  if (!xlsxBlob) return;
  const url = URL.createObjectURL(xlsxBlob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = 'Controlados_RSO.xlsx';
  a.click();
  URL.revokeObjectURL(url);
});

// ══════════════════════════════════════════════════════════════
// ── INIT ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

setupDrop('zone-mov', 'file-mov', 'fname-mov', 'mov');
setupDrop('zone-ce',  'file-ce',  'fname-ce',  'ce');
montarEstGrid();

// Popular select de movimentos
const movSel = document.getElementById('mov-subst');
movSel.innerHTML = SUBSTANCIAS.map(s => `<option value="${s.nome}">${s.nome} (${s.lista})</option>`).join('');
