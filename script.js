(() => {
'use strict';
const KEY = 'helix_state_v1', SKEY = 'helix_sound';
const CODE = '242101', TOTAL = 45 * 60 * 1000;
const $ = s => document.querySelector(s);

/* ---------- ESTADO ---------- */
const fresh = () => ({
  screen: 'start', endAt: null, doneAt: null, current: 0, unlocked: 1, forceFinal: false,
  solved: [false, false, false, false, false, false], hints: [0, 0, 0, 0, 0, 0],
  m2: { cells: ['', '', '', ''], ok: false },
  m6: { choice: '', text: '', pr: [], sent: false, valid: false }
});
let S;
try { S = JSON.parse(sessionStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
let sound = sessionStorage.getItem(SKEY) !== 'off';
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- SOM ---------- */
let actx;
function beep(f, d, type = 'sine', v = .06, t0 = 0) {
  if (!sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0;
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
const sfx = {
  ok: () => { beep(660, .14); beep(880, .22, 'sine', .06, .13); },
  err: () => { beep(150, .35, 'sawtooth', .05); },
  click: () => beep(520, .05, 'square', .02),
  win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, .25, 'sine', .06, i * .14))
};

/* ---------- TELAS ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
  S.screen = id; save();
  if (id === 'game') renderGame();
}

/* ---------- INICIALIZAÇÃO (TERMINAL) ---------- */
const BOOT = [
  '> Inicializando sistema HELIX...',
  '> Carregando arquivos científicos...',
  '> Verificando integridade genética...',
  '> ALERTA: PROTOCOLO DE SEGURANÇA COMPROMETIDO.',
  '> AGUARDANDO EQUIPE DE INVESTIGAÇÃO.'
];
let bootRun = 0;
function runBoot() {
  show('boot');
  const term = $('#term'), id = ++bootRun;
  term.textContent = '';
  let l = 0, c = 0;
  (function type() {
    if (id !== bootRun) return;
    if (l >= BOOT.length) { setTimeout(() => id === bootRun && show('story'), 1000); return; }
    const line = BOOT[l];
    term.textContent += line[c++];
    if (c % 3 === 0) beep(900, .02, 'square', .015);
    if (c >= line.length) { term.textContent += '\n'; l++; c = 0; setTimeout(type, 350); }
    else setTimeout(type, 22);
  })();
}

function startGame() {
  S.endAt = Date.now() + TOTAL; S.doneAt = null; S.current = 0;
  show('game');
}

/* ---------- CRONÔMETRO ---------- */
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function tick() {
  if (S.screen !== 'game' || !S.endAt) return;
  const rem = S.endAt - Date.now(), t = $('#timer');
  t.textContent = fmt(rem);
  t.classList.toggle('low', rem < 5 * 60 * 1000);
  if (rem <= 0) { sfx.err(); show('timeout'); }
}
setInterval(tick, 250);

/* ---------- CONTEÚDO DOS MÓDULOS ---------- */
const MODS = [
  { t: 'A MENSAGEM NA DUPLA HÉLICE', c: 'DNA e genética molecular', d: 2,
    hints: ['Observe o pareamento das bases.', 'A complementar de cada base deve ser escrita na orientação oposta.'],
    ex: "A pareia com T e C pareia com G. A fita complementar, alinhada à original, é TACGGTAA (3'→5'). Lida no sentido 5'→3' fica AATGGCAT. Nas duas leituras há 2 bases G. Dígito liberado: 2.",
    body: () => `<div class="strand">3' — A T G C C A T T — 5'</div>
      <p>Descubra a sequência complementar (sentido 5' → 3' ou alinhada à fita, ambas as leituras serão aceitas) e conte as bases G dela.</p>
      <div class="row"><label class="f">Sequência complementar<input type="text" id="m1s" autocomplete="off" placeholder="ex.: ATCG..."></label>
      <label class="f">Quantidade de bases G<input type="number" id="m1g" min="0"></label></div>
      <button class="btn" id="m1b">[ VERIFICAR ]</button>`,
    bind(p) {
      p.querySelector('#m1b').onclick = () => {
        const s = p.querySelector('#m1s').value.toUpperCase().replace(/[^ATGC]/g, ''), g = p.querySelector('#m1g').value.trim();
        const sOk = s === 'TACGGTAA' || s === 'AATGGCAT', gOk = g === '2';
        if (sOk && gOk) complete(0);
        else if (!sOk) fb('Sequência incorreta. Revise o pareamento das bases.', false);
        else fb('Sequência correta, mas a contagem de bases G está errada.', false);
      };
    } },
  { t: 'O HERDEIRO DESCONHECIDO', c: 'Hereditariedade', d: 4,
    hints: ['Cada progenitor pode fornecer A ou a.', 'Apenas aa apresenta a característica recessiva.'],
    ex: 'O quadro de Punnett de Aa × Aa gera AA, Aa, Aa e aa. Só aa mostra a característica recessiva: 1 em 4, ou 25%. O denominador da fração 1/4 é o dígito: 4.',
    body: () => {
      const c = S.m2.cells, dis = S.m2.ok ? 'disabled' : '';
      let h = `<p>Cruzamento: <b class="tag" style="font-size:1.1rem">Aa × Aa</b>. Clique nas casas para alternar o genótipo (AA, Aa, aa) e monte o quadro.</p>
      <div class="punnett"><div></div><div class="hd">A</div><div class="hd">a</div>
      <div class="hd">A</div><button ${dis} data-i="0">${c[0] || '?'}</button><button ${dis} data-i="1">${c[1] || '?'}</button>
      <div class="hd">a</div><button ${dis} data-i="2">${c[2] || '?'}</button><button ${dis} data-i="3">${c[3] || '?'}</button></div>`;
      if (!S.m2.ok) h += '<button class="btn" id="m2c">[ VERIFICAR QUADRO ]</button>';
      else h += `<p><b>Qual a probabilidade de aparecer a característica recessiva?</b></p>
        <div class="opts">${['10%', '25%', '50%', '75%'].map(o => `<button class="btn m2o">${o}</button>`).join('')}</div>`;
      return h;
    },
    bind(p) {
      p.querySelectorAll('.punnett button').forEach(b => b.onclick = () => {
        const i = +b.dataset.i, order = ['', 'AA', 'Aa', 'aa'];
        S.m2.cells[i] = order[(order.indexOf(S.m2.cells[i]) + 1) % 4]; b.textContent = S.m2.cells[i] || '?'; sfx.click(); save();
      });
      const c = p.querySelector('#m2c');
      if (c) c.onclick = () => {
        const x = S.m2.cells;
        if (x[0] === 'AA' && x[1] === 'Aa' && x[2] === 'Aa' && x[3] === 'aa') { S.m2.ok = true; save(); sfx.ok(); renderPanel(); fb('Quadro correto! Agora responda à pergunta.', true); }
        else fb('Quadro incorreto. Lembre-se: a linha e a coluna indicam os gametas de cada progenitor.', false);
      };
      p.querySelectorAll('.m2o').forEach(b => b.onclick = () => b.textContent === '25%' ? complete(1) : fb('Probabilidade incorreta. Conte quantas casas são aa.', false));
    } },
  { t: 'A SALA DE TRANSFUSÃO', c: 'Tipos sanguíneos e compatibilidade', d: 2,
    hints: ['O receptor B pode receber B ou O.', 'Considere também o fator Rh negativo.'],
    ex: 'Um paciente B− só recebe hemácias B− ou O− (sem antígeno A e sem Rh). Os compatíveis são A (O−) e C (B−). São 2 doadores: dígito 2.',
    body: () => `<p>Paciente que precisa de concentrado de hemácias: <span class="blood">B−</span></p>
      <p>Selecione todos os doadores compatíveis.</p>
      <div class="cards">${[['A', 'O−'], ['B', 'AB−'], ['C', 'B−'], ['D', 'O+']].map(d => `<button class="card" data-d="${d[0]}"><span class="k">Doador ${d[0]}</span><small>Tipo ${d[1]}</small></button>`).join('')}</div>
      <button class="btn" id="m3b">[ CONFIRMAR DOADORES ]</button>`,
    bind(p) {
      p.querySelectorAll('.card').forEach(c => c.onclick = () => { c.classList.toggle('sel'); sfx.click(); });
      p.querySelector('#m3b').onclick = () => {
        const sel = [...p.querySelectorAll('.card.sel')].map(c => c.dataset.d).sort().join('');
        if (sel === 'AC') complete(2);
        else if (!sel) fb('Selecione ao menos um doador.', false);
        else fb('Seleção incorreta. Há doadores a mais ou a menos.', false);
      };
    } },
  { t: 'A CAIXA DE FERRAMENTAS BIOTECNOLÓGICAS', c: 'Biotecnologia', d: 1,
    hints: ['O pesquisador precisa aumentar a quantidade de DNA.', 'A técnica procurada amplifica o DNA.'],
    ex: 'A PCR amplifica regiões específicas do DNA, gerando milhões de cópias. Conversão A=1, B=2, C=3, D=4: a resposta é A, dígito 1.',
    body: () => `<div class="cards">${[['A', 'PCR', 'amplifica regiões específicas do DNA.'], ['B', 'Eletroforese', 'separa fragmentos de DNA por tamanho.'], ['C', 'Transgenia', 'introduz material genético externo em um organismo.'], ['D', 'Sequenciamento', 'determina a ordem das bases do DNA.']].map(d => `<button class="card" data-d="${d[0]}"><span class="k">${d[0]} — ${d[1]}</span><small>${d[2]}</small></button>`).join('')}</div>
      <p><b>Qual técnica permite produzir milhões de cópias de uma região específica de DNA?</b></p>
      <p style="color:var(--mut);font-size:.88rem">Clique na técnica escolhida. Conversão: A = 1, B = 2, C = 3, D = 4.</p>`,
    bind(p) {
      p.querySelectorAll('.card').forEach(c => c.onclick = () => c.dataset.d === 'A' ? complete(3) : fb('Técnica incorreta. Essa não gera cópias do DNA.', false));
    } },
  { t: 'A POPULAÇÃO DA ESTAÇÃO', c: 'Demografia', d: 0,
    hints: ['Divida a população pela área.', 'Nascimentos e imigração aumentam a população; óbitos e emigração diminuem.'],
    ex: 'Densidade = 2.400 ÷ 12 = 200 hab/km². População final = 2.400 + 36 − 12 + 18 − 6 = 2.436. O dígito é o algarismo das unidades da densidade (200): 0.',
    body: () => `<div class="data"><div>População inicial<b>2.400</b></div><div>Área<b>12 km²</b></div><div>Nascimentos<b>36</b></div><div>Óbitos<b>12</b></div><div>Imigrantes<b>18</b></div><div>Emigrantes<b>6</b></div></div>
      <div class="row"><label class="f">1. Densidade populacional (hab/km²)<input type="text" inputmode="numeric" id="m5a"></label>
      <label class="f">2. População final (habitantes)<input type="text" inputmode="numeric" id="m5b"></label></div>
      <p style="color:var(--mut);font-size:.88rem">O dígito liberado será o algarismo das unidades da densidade.</p>
      <button class="btn" id="m5c">[ VERIFICAR ]</button>`,
    bind(p) {
      const n = v => parseFloat(v.replace(/\./g, '').replace(',', '.'));
      p.querySelector('#m5c').onclick = () => {
        const a = n(p.querySelector('#m5a').value), b = n(p.querySelector('#m5b').value);
        if (a === 200 && b === 2436) complete(4);
        else if (a !== 200) fb('Densidade incorreta. Revise o cálculo.', false);
        else fb('Densidade correta, mas a população final está errada.', false);
      };
    } },
  { t: 'A DECISÃO FINAL', c: 'Bioética', d: 1,
    hints: ['Verifiquem se houve consentimento específico.', 'Considerem privacidade, proteção dos dados e supervisão ética.'],
    ex: 'A resposta foi validada pelo organizador. A alternativa C costuma ser a mais defensável: respeita a autonomia e a privacidade, evita danos e mantém a transparência, sem abandonar o benefício científico da pesquisa. Dígito liberado: 1.',
    body: () => {
      const m = S.m6;
      let h = `<p>Uma empresa quer receber <b>dados genéticos identificáveis</b> de voluntários da pesquisa. Esses voluntários <b>não autorizaram especificamente</b> esse compartilhamento. O que a equipe deve fazer?</p>`;
      const opts = [['A', 'Enviar imediatamente todos os dados.'], ['B', 'Destruir todos os dados e interromper a pesquisa.'], ['C', 'Suspender o compartilhamento, revisar os consentimentos e avaliar a utilização de dados anonimizados sob supervisão ética.']];
      const PR = ['Autonomia', 'Privacidade e confidencialidade', 'Beneficência', 'Não maleficência', 'Justiça', 'Transparência'];
      const dis = m.sent ? 'disabled' : '';
      h += opts.map(o => `<label class="choice"><input type="radio" name="m6" value="${o[0]}" ${m.choice === o[0] ? 'checked' : ''} ${dis}><b>${o[0]}</b> — ${o[1]}</label>`).join('');
      h += `<p><b>Justifiquem a escolha usando pelo menos três princípios bioéticos:</b></p><div class="pr">${PR.map(x => `<label><input type="checkbox" value="${x}" ${m.pr.includes(x) ? 'checked' : ''} ${dis}> ${x}</label>`).join('')}</div>
      <label class="f" style="margin-top:12px">Justificativa da equipe<textarea id="m6t" ${dis} placeholder="Escrevam aqui a justificativa (mínimo 40 caracteres)...">${m.text.replace(/</g, '&lt;')}</textarea></label>`;
      h += m.sent ? '<div class="pend" style="margin-top:12px">⏳ RESPOSTA ENVIADA. AGUARDANDO VALIDAÇÃO DO ORGANIZADOR.</div>' : '<div class="row"><button class="btn" id="m6b">[ ENVIAR PARA VALIDAÇÃO ]</button></div>';
      return h;
    },
    bind(p) {
      if (S.m6.sent) return;
      p.querySelectorAll('input[name=m6]').forEach(r => r.onchange = () => { S.m6.choice = r.value; save(); });
      p.querySelectorAll('.pr input').forEach(c => c.onchange = () => { S.m6.pr = [...p.querySelectorAll('.pr input:checked')].map(x => x.value); save(); });
      p.querySelector('#m6t').oninput = e => { S.m6.text = e.target.value; save(); };
      p.querySelector('#m6b').onclick = () => {
        if (!S.m6.choice) return fb('Escolham uma alternativa (A, B ou C).', false);
        if (S.m6.pr.length < 3) return fb('Selecionem pelo menos três princípios bioéticos.', false);
        if (S.m6.text.trim().length < 40) return fb('A justificativa está curta. Escrevam pelo menos 40 caracteres.', false);
        S.m6.sent = true; save(); sfx.ok(); renderPanel();
        fb('Resposta enviada. O organizador fará a validação manual.', true);
      };
    } }
];

/* ---------- RENDERIZAÇÃO DO JOGO ---------- */
const canAccess = i => i < 6 ? i < S.unlocked : (S.solved.every(Boolean) || S.forceFinal);

function renderGame() { renderNav(); renderDigits(); renderStatus(); renderPanel(); tick(); }

function renderNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const b = document.createElement('button');
    const ok = canAccess(i);
    b.className = 'nv' + (i === S.current ? ' cur' : '') + (S.solved[i] ? ' done' : '');
    b.disabled = !ok;
    b.innerHTML = `<b>${i < 6 ? i + 1 : '★'}</b><span>${i < 6 ? MODS[i].t : 'PROTOCOLO FINAL'}${!ok ? ' 🔒' : ''}${S.solved[i] ? ' ✔' : ''}</span>`;
    b.onclick = () => { S.current = i; save(); sfx.click(); renderGame(); };
    nav.appendChild(b);
  }
  const n = S.solved.filter(Boolean).length;
  $('#bar').style.width = (n / 6 * 100) + '%';
}

function renderDigits() {
  $('#digits').innerHTML = MODS.map((m, i) => `<div class="dg ${S.solved[i] ? 'on' : ''}">${S.solved[i] ? m.d : '?'}</div>`).join('');
}

function renderStatus() {
  const n = S.solved.filter(Boolean).length, pct = Math.round(n / 6 * 100);
  const [txt, col] = n === 6 ? ['PROTOCOLO PRONTO PARA DESBLOQUEIO', 'var(--grn)'] : n >= 3 ? ['PARCIALMENTE RESTAURADO', 'var(--amb)'] : ['SISTEMA COMPROMETIDO', 'var(--red)'];
  $('#status').innerHTML = `<div style="color:${col}">${txt}</div><div class="bar"><i style="width:${pct}%;background:${col}"></i></div>Integridade: ${pct}%<br>Módulos: ${n}/6`;
}

function renderPanel() {
  const p = $('#panel'), i = S.current;
  p.classList.remove('fade'); void p.offsetWidth; p.classList.add('fade');
  if (i === 6) return renderFinal(p);
  const m = MODS[i];
  p.innerHTML = `<div class="mod-h"><span class="tag">MÓDULO ${i + 1} DE 6</span><span class="topic">Conteúdo: ${m.c}</span><h2>${m.t}</h2></div>
    <div id="mbody"></div>
    ${S.solved[i] ? '' : '<div class="row"><button class="btn sm" id="hintBtn">[ SOLICITAR PISTA ]</button></div>'}
    <div class="hintbox" id="hintbox"></div><div id="fb" class="fb"></div>`;
  const body = $('#mbody');
  if (S.solved[i]) {
    body.innerHTML = `<div class="ok-box"><h3>✔ MÓDULO CONCLUÍDO</h3><p>${m.ex}</p><div class="reveal">DÍGITO LIBERADO: ${m.d}</div></div>
      <div class="row"><button class="btn" id="nextBtn">${S.solved.every(Boolean) ? '[ IR AO PROTOCOLO FINAL ]' : i < 5 ? '[ PRÓXIMO MÓDULO ]' : '[ VOLTAR AOS MÓDULOS ]'}</button></div>`;
    $('#nextBtn').onclick = () => {
      if (S.solved.every(Boolean)) S.current = 6;
      else { const nx = S.solved.findIndex((v, k) => !v && canAccess(k)); S.current = nx >= 0 ? nx : S.current; }
      save(); renderGame();
    };
  } else { body.innerHTML = m.body(); m.bind(body); }
  const hb = $('#hintBtn'); if (hb) hb.onclick = () => hint(i);
  showHints(i);
}

function showHints(i) {
  const box = $('#hintbox'); if (!box) return;
  box.innerHTML = MODS[i].hints.slice(0, S.hints[i]).map((h, k) => `<p><b>Pista ${k + 1}:</b> ${h}</p>`).join('');
  const hb = $('#hintBtn'); if (hb && S.hints[i] >= 2) { hb.disabled = true; hb.textContent = '[ SEM MAIS PISTAS ]'; }
}
function hint(i) {
  if (i > 5 || S.solved[i] || S.hints[i] >= 2) return;
  S.hints[i]++; save(); sfx.click(); showHints(i);
}

function fb(msg, ok) {
  const f = $('#fb'); if (!f) return;
  f.textContent = (ok ? '✔ ' : '✖ ') + msg; f.className = 'fb ' + (ok ? 'ok' : 'err');
  const p = $('#panel'); p.classList.remove('shake', 'pulse', 'fade'); void p.offsetWidth;
  p.classList.add(ok ? 'pulse' : 'shake'); ok ? sfx.ok() : sfx.err();
}

function complete(i) {
  if (S.solved[i]) return;
  S.solved[i] = true; S.unlocked = Math.max(S.unlocked, Math.min(6, i + 2));
  save(); sfx.ok();
  if (S.screen === 'game') { renderGame(); const p = $('#panel'); p.classList.remove('fade'); p.classList.add('pulse'); }
}

/* ---------- PROTOCOLO FINAL ---------- */
function renderFinal(p) {
  p.innerHTML = `<div class="final" id="finalBox"><div class="lock" id="lock">🔒</div><h2>PROTOCOLO FINAL DE DESBLOQUEIO</h2>
    <p style="color:var(--mut)">Insira os seis dígitos conquistados, na ordem dos módulos.</p>
    <div class="codes">${[0, 1, 2, 3, 4, 5].map(i => `<input type="text" inputmode="numeric" maxlength="1" data-i="${i}" aria-label="Dígito ${i + 1}" autocomplete="off">`).join('')}</div>
    <button class="btn big" id="unlockBtn">[ DESBLOQUEAR ]</button><div id="fb" class="fb"></div></div>`;
  const ins = [...p.querySelectorAll('.codes input')];
  ins.forEach((el, k) => {
    el.oninput = () => { el.value = el.value.replace(/\D/g, ''); if (el.value && ins[k + 1]) ins[k + 1].focus(); };
    el.onkeydown = e => { if (e.key === 'Backspace' && !el.value && ins[k - 1]) ins[k - 1].focus(); if (e.key === 'Enter') $('#unlockBtn').click(); };
  });
  ins[0].focus();
  $('#unlockBtn').onclick = () => {
    const v = ins.map(x => x.value).join('');
    if (v === CODE) {
      S.doneAt = Date.now(); save(); sfx.win();
      $('#finalBox').classList.add('opening'); $('#lock').textContent = '🔓';
      fb('Código aceito. Desbloqueando arquivo Aurora...', true);
      setTimeout(() => { $('#winTime').textContent = 'Tempo restante: ' + fmt(S.endAt - S.doneAt); show('victory'); }, 2000);
    } else {
      fb('ACESSO NEGADO. VERIFIQUE OS DÍGITOS E TENTE NOVAMENTE.', false);
    }
  };
}

/* ---------- MODAIS ---------- */
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modalClose').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openHelp() {
  openModal(`<h3>Instruções</h3><ul>
    <li>Resolvam os seis módulos em ordem. Cada um libera um dígito.</li>
    <li>Reúnam os seis dígitos e digitem-nos no Protocolo Final antes de o tempo acabar (45 minutos).</li>
    <li>Cada módulo tem até duas pistas, no botão SOLICITAR PISTA.</li>
    <li>No Módulo 6, o organizador lê a justificativa e valida manualmente.</li>
    <li>O progresso é salvo na sessão: atualizar a página não apaga a partida.</li></ul>`);
}

function openOrg() {
  const m = S.m6;
  openModal(`<h3>Painel do organizador</h3>
    <div class="org-actions">
      <button class="btn sm" data-a="new">NOVA PARTIDA</button>
      <button class="btn sm" data-a="timer">REINICIAR CRONÔMETRO</button>
      <button class="btn sm" data-a="unlock1">DESBLOQUEAR PRÓXIMO MÓDULO</button>
      <button class="btn sm" data-a="unlockAll">DESBLOQUEAR TODOS</button>
    </div>
    <h3>Validação do Módulo 6</h3>
    ${S.solved[5] ? '<p class="okc">✔ Já validado.</p>' : m.sent
      ? `<p>Alternativa escolhida: <b>${m.choice}</b><br>Princípios citados: ${m.pr.join(', ')}</p><div class="just" id="justTxt"></div>
         <button class="btn sm" data-a="validate">VALIDAR RESPOSTA</button>
         <button class="btn sm danger" data-a="reject">DEVOLVER PARA REVISÃO</button>`
      : '<p style="color:var(--mut)">Nenhuma justificativa enviada ainda.</p>'}
    <h3 style="margin-top:18px">Gabarito</h3>
    <button class="btn sm" data-a="gab">MOSTRAR / OCULTAR GABARITO</button>
    <div class="gab" id="gab" style="display:none;margin-top:10px">
      <p><b>Dígitos:</b> 2 · 4 · 2 · 1 · 0 · 1 — Código: <b>242101</b></p>
      <p><b>M1:</b> TACGGTAA (ou AATGGCAT em 5'→3') · 2 bases G · dígito 2</p>
      <p><b>M2:</b> AA, Aa, Aa, aa · 25% · dígito 4</p>
      <p><b>M3:</b> doadores A (O−) e C (B−) · dígito 2</p>
      <p><b>M4:</b> PCR (alternativa A) · dígito 1</p>
      <p><b>M5:</b> 200 hab/km² · 2.436 habitantes · dígito 0</p>
      <p><b>M6:</b> validação manual (C é a mais defensável) · dígito 1</p></div>`);
  if (m.sent && $('#justTxt')) $('#justTxt').textContent = m.text;
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => orgAction(b.dataset.a));
}

function orgAction(a) {
  if (a === 'gab') { const g = $('#gab'); g.style.display = g.style.display === 'none' ? 'block' : 'none'; return; }
  if (a === 'new') { if (!confirm('Iniciar uma nova partida? O progresso atual será apagado.')) return; S = fresh(); save(); closeModal(); show('start'); return; }
  if (a === 'timer') { S.endAt = Date.now() + TOTAL; S.doneAt = null; save(); closeModal(); if (S.screen === 'timeout') show('game'); else tick(); return; }
  if (a === 'unlock1') S.unlocked = Math.min(6, S.unlocked + 1);
  if (a === 'unlockAll') { S.unlocked = 6; S.forceFinal = true; }
  if (a === 'validate') { complete(5); closeModal(); return; }
  if (a === 'reject') { S.m6.sent = false; save(); closeModal(); if (S.screen === 'game') renderPanel(); return; }
  save(); if (S.screen === 'game') renderGame(); closeModal();
}

/* ---------- BOTÕES GERAIS ---------- */
$('#btnStart').onclick = () => { sfx.click(); runBoot(); };
$('#btnAccept').onclick = () => { sfx.ok(); startGame(); };
$('#btnHelp').onclick = openHelp;
$('#btnHint').onclick = () => hint(S.current);
$('#orgBtn').onclick = openOrg;
$('#btnSound').onclick = () => { sound = !sound; sessionStorage.setItem(SKEY, sound ? 'on' : 'off'); $('#btnSound').textContent = 'SOM: ' + (sound ? 'ON' : 'OFF'); sfx.click(); };
$('#btnFull').onclick = () => {
  if (!document.fullscreenElement) (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
  else document.exitFullscreen();
};
const restart = () => { S = fresh(); save(); show('start'); };
$('#btnReset').onclick = () => { if (confirm('Reiniciar a partida? Todo o progresso será perdido.')) restart(); };
$('#btnAgain').onclick = restart;
$('#btnRetry').onclick = restart;
$('#btnSound').textContent = 'SOM: ' + (sound ? 'ON' : 'OFF');

/* ---------- FUNDO: PARTÍCULAS + HÉLICE ---------- */
const cv = $('#bg'), cx = cv.getContext('2d');
let W, H, P = [];
function resize() {
  W = cv.width = innerWidth; H = cv.height = innerHeight;
  P = Array.from({ length: Math.min(80, Math.floor(W * H / 18000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35 }));
}
function draw(t) {
  cx.clearRect(0, 0, W, H);
  P.forEach(p => { p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H; cx.fillStyle = 'rgba(25,227,255,.55)'; cx.fillRect(p.x, p.y, 2, 2); });
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y);
    if (d < 110) { cx.strokeStyle = `rgba(25,227,255,${.14 * (1 - d / 110)})`; cx.beginPath(); cx.moveTo(P[i].x, P[i].y); cx.lineTo(P[j].x, P[j].y); cx.stroke(); }
  }
  const xs = W > 900 ? [W * .035, W * .965] : [W * .5];
  xs.forEach(x0 => {
    for (let y = 0; y < H; y += 16) {
      const a = y / 55 + t / 1100, x1 = x0 + Math.sin(a) * 26, x2 = x0 - Math.sin(a) * 26;
      cx.strokeStyle = 'rgba(25,227,255,.09)'; cx.beginPath(); cx.moveTo(x1, y); cx.lineTo(x2, y); cx.stroke();
      cx.fillStyle = 'rgba(25,227,255,.35)'; cx.beginPath(); cx.arc(x1, y, 2.2, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(45,255,143,.25)'; cx.beginPath(); cx.arc(x2, y, 2.2, 0, 7); cx.fill();
    }
  });
  requestAnimationFrame(draw);
}
addEventListener('resize', resize); resize(); requestAnimationFrame(draw);

/* ---------- INÍCIO ---------- */
if (S.screen === 'boot') S.screen = 'story';
if (S.screen === 'game' && S.endAt && S.endAt - Date.now() <= 0) S.screen = 'timeout';
if (S.screen === 'victory') $('#winTime').textContent = S.doneAt ? 'Tempo restante: ' + fmt(S.endAt - S.doneAt) : '';
show(S.screen);
})();
