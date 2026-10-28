'use strict';
/* Componentes de tela usados pelas três frentes. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (nome, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

const UI = {
  toast(msg, tipo = 'ok') {
    let caixa = $('#toasts');
    if (!caixa) { caixa = document.createElement('div'); caixa.id = 'toasts'; caixa.setAttribute('role', 'status'); document.body.appendChild(caixa); }
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.innerHTML = `${ic(tipo === 'erro' ? 'alerta' : tipo === 'info' ? 'info' : 'check')}<span>${esc(msg)}</span>`;
    caixa.appendChild(el);
    setTimeout(() => el.classList.add('sai'), tipo === 'erro' ? 5000 : 3400);
    setTimeout(() => el.remove(), tipo === 'erro' ? 5400 : 3800);
  },
  erro(e) { console.warn(e); UI.toast(e?.message || String(e), 'erro'); },

  /* Janela sobreposta. corpo/rodape são HTML já escapado. */
  modal({ titulo, corpo, rodape = '', classe = '', fixo = false, aoFechar = null }) {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="modal-cab"><h3>${esc(titulo)}</h3><button type="button" class="btn-icone" data-fechar aria-label="Fechar">${ic('x')}</button></div>
      <div class="modal-corpo">${corpo}</div>${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}</div>`;
    document.body.appendChild(fundo);
    document.body.classList.add('com-modal');
    requestAnimationFrame(() => fundo.classList.add('aberto'));
    let fechado = false;
    const fechar = () => {
      if (fechado) return;
      fechado = true;
      fundo.classList.remove('aberto');
      document.removeEventListener('keydown', tecla);
      setTimeout(() => { fundo.remove(); if (!$('.modal-fundo')) document.body.classList.remove('com-modal'); }, 160);
      if (aoFechar) aoFechar();
    };
    const tecla = e => { if (e.key === 'Escape' && fundo === $$('.modal-fundo').pop()) fechar(); };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('mousedown', e => { if (e.target === fundo && !fixo) fechar(); });
    fundo.addEventListener('click', e => { if (e.target.closest('[data-fechar]')) fechar(); });
    const el = fundo.querySelector('.modal');
    setTimeout(() => { const f = el.querySelector('[autofocus]'); if (f) f.focus(); }, 60);
    return { el, fechar, corpo: el.querySelector('.modal-corpo') };
  },
  confirmar(texto, { titulo = 'Confirmar', ok = 'Confirmar', perigo = false } = {}) {
    return new Promise(res => {
      const m = UI.modal({
        titulo, classe: 'pequeno', corpo: `<p class="texto-modal">${texto}</p>`,
        rodape: `<button type="button" class="btn" data-fechar>Voltar</button><button type="button" class="btn ${perigo ? 'perigo' : 'pri'}" data-ok>${esc(ok)}</button>`,
        aoFechar: () => res(false)
      });
      m.el.querySelector('[data-ok]').onclick = () => { res(true); m.fechar(); };
    });
  },

  lerFoto(arquivo, { max = 640, formato = 'image/jpeg', qualidade = 0.8 } = {}) {
    return new Promise((ok, falha) => {
      if (!arquivo || !/^image\//.test(arquivo.type)) return falha(new Error('Escolha um arquivo de imagem (JPG ou PNG).'));
      const leitor = new FileReader();
      leitor.onerror = () => falha(new Error('Não consegui ler a imagem.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => falha(new Error('Formato de imagem não suportado.'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d');
          if (formato === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL(formato, qualidade));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  },

  iniciais(n) {
    const p = String(n || '?').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  },
  // iniciais do nome do estabelecimento sem as palavras genéricas ("Barbearia Navalha de Ouro" → NO)
  iniciaisMarca(n) {
    const p = String(n || '').split(/\s+/).filter(w => w && !/^(barbearia|barber|barbershop|shop|studio|est[uú]dio|sal[aã]o|de|do|da|dos|das|the|e)$/i.test(w));
    return UI.iniciais(p.length ? p.join(' ') : n);
  },
  avatar(nome, foto, cor, cls = '') {
    if (foto) return `<span class="avatar ${cls}"><img src="${esc(foto)}" alt=""></span>`;
    return `<span class="avatar ${cls}" style="--av:${esc(cor || 'var(--accent)')}">${esc(UI.iniciais(nome))}</span>`;
  },
  // imagem de serviço/produto, ou um ícone quando não tem foto
  capa(item, tipo = 'servico') {
    if (item.foto) return `<img src="${esc(item.foto)}" alt="">`;
    const icone = tipo === 'produto' ? 'sacola' : ({ Barba: 'navalha', Combo: 'estrela', 'Estética': 'brilho', 'Química': 'gota', Unhas: 'unha', Sobrancelha: 'olho', Maquiagem: 'pincel' }[item.categoria] || 'tesoura');
    return `<span class="capa-vazia">${ic(icone)}</span>`;
  },
  badge(texto, tom = 'neutro', icone = '') { return `<span class="badge ${tom}">${icone ? ic(icone) : ''}${esc(texto)}</span>`; },
  vazio(icone, titulo, texto = '', acao = '') {
    return `<div class="vazio">${ic(icone)}<b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${acao}</div>`;
  },
  copiar(texto) {
    const ok = () => UI.toast('Copiado!');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).then(ok, () => UI._copiarAntigo(texto, ok));
    else UI._copiarAntigo(texto, ok);
  },
  _copiarAntigo(texto, ok) {
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); ok(); } catch (e) { UI.toast('Não consegui copiar. Selecione e copie à mão.', 'erro'); }
    t.remove();
  },
  baixar(nome, conteudo, tipo = 'text/plain') {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  form(el) {
    const o = {};
    for (const [k, v] of new FormData(el).entries()) o[k] = typeof v === 'string' ? v.trim() : v;
    return o;
  },

  // texto legível em cima da cor de destaque
  corTexto(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
    if (!m) return '#fff';
    const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? '#16120c' : '#ffffff';
  },
  aplicarCor(hex) {
    const raiz = document.documentElement.style;
    if (!hex) { raiz.removeProperty('--accent'); raiz.removeProperty('--accent-ink'); return; }
    raiz.setProperty('--accent', hex);
    raiz.setProperty('--accent-ink', UI.corTexto(hex));
  },

  /* Editor de horário semanal: um dia por linha, com pausa opcional. */
  horarioEditor(h, pfx = 'h') {
    return `<div class="hor-ed">${[1, 2, 3, 4, 5, 6, 0].map(d => {
      const iv = h?.[d] || [];
      const aberto = iv.length > 0;
      const ini = iv[0]?.[0] || '09:00', fim = iv[iv.length - 1]?.[1] || '19:00';
      const pausa = iv.length > 1 ? [iv[0][1], iv[1][0]] : ['', ''];
      return `<div class="hor-linha ${aberto ? '' : 'fechado'}">
        <label class="hor-dia"><input type="checkbox" name="${pfx}_on_${d}" ${aberto ? 'checked' : ''}><span>${DIAS_CURTOS[d]}</span></label>
        <div class="hor-campos">
          <input type="time" name="${pfx}_ini_${d}" value="${ini}" aria-label="Abre ${DIAS[d]}"><span class="hor-sep">às</span><input type="time" name="${pfx}_fim_${d}" value="${fim}" aria-label="Fecha ${DIAS[d]}">
          <span class="hor-pausa"><span class="hor-sep">pausa</span><input type="time" name="${pfx}_pi_${d}" value="${pausa[0]}" aria-label="Início da pausa"><span class="hor-sep">–</span><input type="time" name="${pfx}_pf_${d}" value="${pausa[1]}" aria-label="Fim da pausa"></span>
        </div>
        <span class="hor-fechado-txt">Fechado</span>
      </div>`;
    }).join('')}</div>`;
  },
  lerHorario(form, pfx = 'h') {
    const h = {};
    const v = n => form.querySelector(`[name="${n}"]`)?.value || '';
    for (let d = 0; d < 7; d++) {
      if (!form.querySelector(`[name="${pfx}_on_${d}"]`)?.checked) { h[d] = []; continue; }
      const ini = v(`${pfx}_ini_${d}`), fim = v(`${pfx}_fim_${d}`), pi = v(`${pfx}_pi_${d}`), pf = v(`${pfx}_pf_${d}`);
      if (!ini || !fim || ini >= fim) throw new Error(`Confira o horário de ${DIAS[d]}: o fim precisa ser depois do início.`);
      if (pi && pf) {
        if (!(pi > ini && pf < fim && pi < pf)) throw new Error(`Confira a pausa de ${DIAS[d]}: precisa ficar dentro do horário.`);
        h[d] = [[ini, pi], [pf, fim]];
      } else h[d] = [[ini, fim]];
    }
    return h;
  },
  resumoHorario(h) {
    if (!h) return 'Mesmo horário do estabelecimento';
    const dias = [1, 2, 3, 4, 5, 6, 0].filter(d => h[d]?.length);
    if (!dias.length) return 'Sem dias de trabalho';
    return dias.map(d => DIAS_CURTOS[d]).join(', ');
  },

  /* Gráfico de barras de uma série. dados: [{rot, valor, dica}] */
  barras(dados, { fmt = dinheiro, cada = 1 } = {}) {
    if (!dados.length) return '';
    const max = Math.max(...dados.map(d => d.valor), 0) || 1;
    const topo = UI._escala(max);
    return `<div class="grafico" role="img" aria-label="Gráfico de barras">
      <div class="graf-grade"><span data-v="${esc(fmt(topo))}"></span><span data-v="${esc(fmt(topo / 2))}"></span><span data-v="${esc(fmt(0))}"></span></div>
      <div class="graf-barras" style="--n:${dados.length}">${dados.map((d, i) => `
        <div class="gb" tabindex="0" aria-label="${esc(d.rot)}: ${esc(fmt(d.valor))}">
          <div class="gb-barra" style="height:${(d.valor / topo * 100).toFixed(2)}%"></div>
          <div class="gb-dica"><b>${esc(fmt(d.valor))}</b>${esc(d.dica || d.rot)}</div>
          <span class="gb-rot">${i % cada === 0 ? esc(d.rot) : ''}</span>
        </div>`).join('')}</div></div>`;
  },
  _escala(max) {
    const p = 10 ** Math.floor(Math.log10(max));
    for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= max) return k * p;
    return 10 * p;
  },
  // barras horizontais (participação de cada item)
  partes(itens, { fmt = dinheiro } = {}) {
    const tot = soma(itens, i => i.valor) || 1;
    return `<div class="partes">${itens.map(i => `<div class="parte"><div class="parte-l"><span>${esc(i.rot)}</span><b>${esc(fmt(i.valor))}</b></div><div class="parte-trilho"><div style="width:${(i.valor / tot * 100).toFixed(1)}%"></div></div><small>${Math.round(i.valor / tot * 100)}%${i.extra ? ' · ' + esc(i.extra) : ''}</small></div>`).join('')}</div>`;
  },

  // estrutura das telas de gestão: menu lateral (computador) e barra inferior (celular)
  casca({ marca, itens, ativo, conteudo, rodapeLateral = '' }) {
    const item = (i, cls) => `<a href="${i.href}" class="${cls} ${i.id === ativo ? 'on' : ''} ${i.bloq ? 'bloq' : ''}" ${i.id === ativo ? 'aria-current="page"' : ''} ${i.bloq ? 'title="Não está no seu plano"' : ''}>${ic(i.icone)}<span>${esc(i.rotulo)}</span>${i.bloq ? `<i class="nav-cad">${ic('cadeado')}</i>` : ''}</a>`;
    return `<div class="casca">
      <aside class="lateral"><div class="lateral-marca">${marca}</div>
        <nav class="lateral-nav">${itens.filter(i => !i.soCelular).map(i => item(i, 'nav-item')).join('')}</nav>
        <div class="lateral-rodape">${rodapeLateral}</div></aside>
      <main class="principal" id="principal">${conteudo}</main>
      <nav class="nav-baixo">${itens.filter(i => !i.soComputador).map(i => item(i, 'nb-item')).join('')}</nav>
    </div>`;
  },

  ics(ag, b, barbeiro) {
    const dt = (data, min) => data.replace(/-/g, '') + 'T' + Datas.hhmm(min).replace(':', '') + '00';
    const limpa = s => String(s || '').replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP.nome}//PT-BR`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${ag.id}@${APP.nome.toLowerCase()}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${dt(ag.data, ag.ini)}`, `DTEND:${dt(ag.data, ag.fim)}`,
      `SUMMARY:${limpa(ag.servicos.map(s => s.nome).join(' + ') + ' — ' + b.nome)}`,
      `LOCATION:${limpa(b.endereco)}`, `DESCRIPTION:${limpa('Com ' + (barbeiro?.nome || '') + '. Total ' + dinheiro(ag.total))}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Seu horário agendado', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  },
  mapa(b) { return b.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.endereco || b.nome)}`; },
  linkCliente(b) { return location.href.split('#')[0] + '#/' + b.slug; },
  linkPainel(b) { return location.href.split('#')[0] + '#/' + b.slug + '/painel'; }
};

/* Comportamentos globais de formulário */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches?.('[data-tel]')) {
    const d = soDigitos(t.value).slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) { const k = d.length === 11 ? 7 : 6; v = `(${d.slice(0, 2)}) ${d.slice(2, k)}-${d.slice(k)}`; }
    t.value = v;
  }
  if (t.matches?.('[data-pin]')) t.value = soDigitos(t.value).slice(0, 4);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches?.('.hor-dia input')) t.closest('.hor-linha').classList.toggle('fechado', !t.checked);
});
