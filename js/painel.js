'use strict';
/* ============================================================
   Frente 2 — Painel do estabelecimento (barbearia ou salão)
   O dono vê tudo; o profissional vê a própria agenda, clientes e ganhos.
   ============================================================ */
const Painel = {
  app: null, b: null, sessao: null, aba: 'agenda', sub: [],
  dia: null, filtroBarbeiro: 'todos', modo: null, rolarAgora: true,
  catAba: 'servicos', periodo: 'mes', de: null, ate: null, fBarbeiro: '',
  cliBusca: '', cliFiltro: 'todos', vistos: null, novosIds: new Set(),

  /* ---------- sessão (quem está usando o painel neste aparelho) ---------- */
  chave(b) { return 'bsflow:sessao:' + b.id; },
  lerSessao(b) { try { return JSON.parse(localStorage.getItem(this.chave(b)) || 'null'); } catch (e) { return null; } },
  gravarSessao(b, s) { try { s ? localStorage.setItem(this.chave(b), JSON.stringify(s)) : localStorage.removeItem(this.chave(b)); } catch (e) { /* sem armazenamento */ } },
  eDono() { return this.sessao?.tipo === 'dono'; },
  eu() { return this.sessao?.tipo === 'barbeiro' ? Store.get('barbeiros', this.sessao.id) : null; },
  h(aba) { return `#/${this.b.slug}/painel/${aba}`; },

  render(app, slug, sub = []) {
    this.app = app;
    document.body.className = 'tela-painel';
    const b = Store.t('barbearias').find(x => x.slug === slug);
    if (!b) return this.telaMsg('busca', 'Página não encontrada', 'Confira o endereço do link.', '<a class="btn" href="#/">Voltar ao início</a>');
    if (this.b?.id !== b.id) Object.assign(this, { dia: Datas.hoje(), vistos: null, filtroBarbeiro: 'todos', fBarbeiro: '', modo: null, rolarAgora: true, cliBusca: '', cliFiltro: 'todos' });
    this.b = b;
    this.dia ||= Datas.hoje();
    UI.aplicarCor(b.cor);
    document.title = `${b.nome} · Painel`;
    const s = Cobranca.situacao(b);
    if (!s.acesso) return this.suspenso(s);
    this.sessao = this.lerSessao(b);
    if (this.sessao?.tipo === 'barbeiro') { const x = this.eu(); if (!x || x.ativo === false) this.sessao = null; }
    if (!this.sessao) return this.login();
    const permitidas = this.eDono()
      ? ['agenda', 'clientes', 'mensalistas', 'promocoes', 'catalogo', 'equipe', 'faturamento', 'mensagens', 'ajustes', 'mais']
      : ['agenda', 'clientes', 'faturamento', 'mais'];
    this.aba = permitidas.includes(sub[0]) ? sub[0] : 'agenda';
    this.sub = sub;
    if (this.aba === 'catalogo' && ['servicos', 'produtos'].includes(sub[1])) this.catAba = sub[1];
    this.cliAba = this.aba === 'clientes' && sub[1] === 'fidelidade' && this.eDono() ? 'fidelidade' : 'lista';
    PWA.configurar({ nome: `${b.nome} · Gestão`, curto: 'Gestão', cor: b.cor, logo: b.logo, texto: UI.iniciaisMarca(b.nome), inicio: UI.linkPainel(b) });
    if (this.eDono() && this._lembretesMensal !== b.id) { this._lembretesMensal = b.id; Mensagens.mensalidades(b).catch(e => console.warn(e)); }
    Store.ouvinte = () => this.mudouFora();
    this.pintar();
    app.onclick = e => this.clique(e);
    app.onchange = e => this.mudanca(e);
    app.oninput = e => this.digitou(e);
    app.onsubmit = e => {
      if (e.target.id === 'f-aj') { e.preventDefault(); this.salvarAjustes(e.target).catch(UI.erro); }
      if (e.target.id === 'f-msg') { e.preventDefault(); this.salvarMensagens(e.target).catch(UI.erro); }
    };
  },

  // outra aba (ex.: o cliente no chat) mudou os dados
  mudouFora() {
    const b = Store.get('barbearias', this.b.id);
    if (!b || !Cobranca.situacao(b).acesso) return Rotas.render();
    this.b = b;
    UI.aplicarCor(b.cor);
    const avisos = this.novidades();
    this.pintar();
    avisos.forEach(t => { UI.toast(t, 'info'); PWA.notificar(b.nome, t, UI.linkPainel(b)); });
  },
  meusAgendamentos() { const eu = this.eu(); return Store.de('agendamentos', this.b.id).filter(a => !eu || a.barbeiro_id === eu.id); },
  marcarVistos() { this.vistos = new Map(this.meusAgendamentos().map(a => [a.id, `${a.status}|${a.data}|${a.ini}`])); },
  novidades() {
    const antes = this.vistos || new Map(), msgs = [], novos = new Set();
    for (const a of this.meusAgendamentos()) {
      const v = antes.get(a.id), quando = `${Datas.relativa(a.data)} às ${Datas.hhmm(a.ini)}`;
      if (v === undefined) {
        if (a.status === 'confirmado') { msgs.push(`Novo agendamento: ${primeiroNome(a.cliente_nome)} · ${quando}`); novos.add(a.id); }
        continue;
      }
      const [st, data, ini] = v.split('|');
      if (st === 'confirmado' && a.status === 'cancelado' && a.cancelado_por === 'cliente') msgs.push(`${primeiroNome(a.cliente_nome)} cancelou o horário de ${Datas.relativa(data)} às ${Datas.hhmm(+ini)}`);
      else if (a.status === 'confirmado' && (data !== a.data || +ini !== a.ini)) { msgs.push(`${primeiroNome(a.cliente_nome)} remarcou para ${quando}`); novos.add(a.id); }
    }
    // o destaque do horário novo fica uns segundos, mesmo que outra gravação redesenhe a agenda
    if (novos.size) {
      this.novosIds = new Set([...this.novosIds, ...novos]);
      clearTimeout(this._novosTimer);
      this._novosTimer = setTimeout(() => { this.novosIds = new Set(); }, 8000);
    }
    return msgs.slice(0, 3);
  },

  pintar() {
    const b = this.b, eu = this.eu();
    const itens = this.eDono() ? [
      { id: 'agenda', rotulo: 'Agenda', icone: 'calendario', href: this.h('agenda') },
      { id: 'clientes', rotulo: 'Clientes', icone: 'usuarios', href: this.h('clientes') },
      { id: 'mensalistas', rotulo: 'Mensalistas', icone: 'coroa', href: this.h('mensalistas') },
      { id: 'promocoes', rotulo: 'Promoções', icone: 'brilho', href: this.h('promocoes'), soComputador: true },
      { id: 'catalogo', rotulo: 'Catálogo', icone: 'tesoura', href: this.h('catalogo'), soComputador: true },
      { id: 'equipe', rotulo: 'Equipe', icone: 'usuario', href: this.h('equipe'), soComputador: true },
      { id: 'faturamento', rotulo: 'Faturamento', icone: 'carteira', href: this.h('faturamento') },
      { id: 'mensagens', rotulo: 'Mensagens', icone: 'mensagem', href: this.h('mensagens'), soComputador: true },
      { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes', href: this.h('ajustes'), soComputador: true },
      { id: 'mais', rotulo: 'Mais', icone: 'menu', href: this.h('mais'), soCelular: true }
    ] : [
      { id: 'agenda', rotulo: 'Minha agenda', icone: 'calendario', href: this.h('agenda') },
      { id: 'clientes', rotulo: 'Meus clientes', icone: 'usuarios', href: this.h('clientes') },
      { id: 'faturamento', rotulo: 'Meus ganhos', icone: 'carteira', href: this.h('faturamento') },
      { id: 'mais', rotulo: 'Mais', icone: 'menu', href: this.h('mais'), soCelular: true }
    ];
    const logo = b.logo ? `<img src="${esc(b.logo)}" alt="">` : ic('tesoura');
    const marca = `<a class="marca" href="${this.h('agenda')}"><span class="marca-icone">${logo}</span><span class="marca-txt"><b>${esc(b.nome)}</b><small>${eu ? 'Painel do profissional' : 'Painel de gestão'}</small></span></a>`;
    const quem = eu ? { nome: eu.nome, foto: eu.foto, cor: eu.cor, papel: 'Profissional' } : { nome: b.responsavel || 'Dono', foto: null, cor: '#3a3229', papel: 'Dono / gerência' };
    const rodape = `<a class="nav-item" href="#/${esc(b.slug)}" target="_blank">${ic('externo')}<span>Página de agendamento</span></a>
      <div class="lateral-usuario">${UI.avatar(quem.nome, quem.foto, quem.cor, 'p')}<div><b>${esc(quem.nome)}</b><small>${quem.papel}</small></div><button class="btn-icone" data-a="sair" title="Sair" aria-label="Sair">${ic('sair')}</button></div>`;
    // guarda a rolagem para a tela não pular quando chega um agendamento novo
    const cal = $('#cal-wrap'), rol = { y: window.scrollY, top: cal?.scrollTop, left: cal?.scrollLeft, aba: this._abaPintada, dia: this._diaPintado };
    const conteudo = `<div class="barra-celular">${marca}<a class="btn-icone" href="${this.h('mais')}" aria-label="Mais opções">${UI.avatar(quem.nome, quem.foto, quem.cor, 'p')}</a></div>
      ${this.avisoSituacao()}${this['v_' + this.aba]()}`;
    this.app.innerHTML = UI.casca({ marca, itens, ativo: this.aba, conteudo, rodapeLateral: rodape });
    const mesmaTela = rol.aba === this.aba && rol.dia === this.dia;
    if (mesmaTela) window.scrollTo(0, rol.y);
    const novo = $('#cal-wrap');
    if (novo) {
      if (mesmaTela && rol.top != null && !this.rolarAgora) { novo.scrollTop = rol.top; novo.scrollLeft = rol.left; }
      else if (this.rolarAgora || !mesmaTela) {
        const alvo = $('.cal-agora', novo) || $('.cal-ag', novo);
        if (alvo) novo.scrollTop = Math.max(0, parseFloat(alvo.style.top) - 90);
      }
    }
    this.rolarAgora = false;
    this._abaPintada = this.aba; this._diaPintado = this.dia;
    this.marcarVistos();
  },

  avisoSituacao() {
    if (!this.eDono()) return '';
    const s = Cobranca.situacao(this.b), cfg = Store.db.config;
    const suporte = `<a class="btn peq" href="${linkWhats(cfg.suporte_whatsapp, `Olá! Sou responsável por ${this.b.nome} e queria falar sobre a assinatura do ${APP.nome}.`)}" target="_blank" rel="noopener">${ic('mensagem')} Falar com o suporte</a>`;
    const pix = `<button class="btn peq" data-a="copiar" data-v="${esc(cfg.chave_pix)}">${ic('copiar')} Copiar PIX</button>`;
    if (s.cod === 'teste') return `<div class="aviso-faixa info">${ic('info')}<span>Você está no período de teste grátis: ${s.resta === 0 ? '<b>termina hoje</b>' : `faltam <b>${s.resta} dia${s.resta > 1 ? 's' : ''}</b>`} (até ${Datas.br(this.b.teste_ate)}).</span>${suporte}</div>`;
    if (s.cod === 'atrasada') {
      const corte = Datas.soma(s.vencidas[0].vencimento, cfg.tolerancia_dias + 1);
      const quando = cfg.bloqueio_auto && !s.liberada ? ` Para a agenda não ser pausada, pague até <b>${Datas.br(Datas.soma(corte, -1))}</b>.` : '';
      return `<div class="aviso-faixa ruim">${ic('alerta')}<span>Mensalidade de <b>${dinheiro(s.emAtraso)}</b> em atraso há ${s.atraso} dia${s.atraso > 1 ? 's' : ''}.${quando} PIX: <b>${esc(cfg.chave_pix)}</b></span>${pix}${suporte}</div>`;
    }
    if (s.cod === 'vence_logo') return `<div class="aviso-faixa">${ic('relogio')}<span>Sua mensalidade de <b>${dinheiro(s.proxima.valor)}</b> vence <b>${Datas.relativa(s.proxima.vencimento)}</b> (${Datas.br(s.proxima.vencimento)}). PIX: <b>${esc(cfg.chave_pix)}</b></span>${pix}</div>`;
    return '';
  },

  telaMsg(icone, titulo, texto, acoes = '') {
    this.app.innerHTML = `<div class="tela-msg"><div><span class="grande-icone">${ic(icone)}</span><h1>${esc(titulo)}</h1><p>${texto}</p><div class="acoes" style="justify-content:center">${acoes}</div></div></div>`;
  },
  suspenso(s) {
    const cfg = Store.db.config, b = this.b;
    const titulo = { teste_fim: 'Seu período de teste terminou', inativa: 'Esta conta está inativa' }[s.cod] || 'Acesso suspenso';
    let texto = s.cod === 'teste_fim' ? 'Gostou do sistema? Fale com a gente para ativar a assinatura e voltar a receber agendamentos.' : esc(s.motivo);
    if (s.auto) texto += ` O valor em aberto é <b style="color:#fff">${dinheiro(s.emAtraso)}</b>. Pague pelo PIX <b style="color:#fff">${esc(cfg.chave_pix)}</b> e o acesso volta assim que o pagamento for confirmado.`;
    texto += '<br><br>Enquanto isso, a página de agendamento dos seus clientes fica pausada.';
    this.telaMsg('cadeado', titulo, texto,
      `<a class="btn pri" href="${linkWhats(cfg.suporte_whatsapp, `Olá! Sou responsável por ${b.nome} e preciso regularizar o acesso ao ${APP.nome}.`)}" target="_blank" rel="noopener">${ic('mensagem')} Falar com o suporte</a>${s.auto ? `<button class="btn" data-a="copiar" data-v="${esc(cfg.chave_pix)}">${ic('copiar')} Copiar PIX</button>` : ''}<a class="btn fantasma" style="color:#fff" href="#/">Início</a>`);
    this.app.onclick = e => { const el = e.target.closest('[data-a="copiar"]'); if (el) UI.copiar(el.dataset.v); };
  },

  login() {
    const b = this.b, barbs = Agenda.barbeiros(b);
    this.app.innerHTML = `<div class="login"><div class="login-card">
      <span class="marca" style="justify-content:center"><span class="marca-icone" style="width:56px;height:56px;border-radius:16px">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ic('tesoura')}</span></span>
      <h1>${esc(b.nome)}</h1><p id="login-txt">Quem está entrando?</p>
      <div class="quem" id="quem">
        <button class="quem-dono" data-quem="dono"><span class="avatar">${ic('coroa')}</span>Dono / gerência</button>
        ${barbs.map(x => `<button data-quem="${x.id}">${UI.avatar(x.nome, x.foto, x.cor)}${esc(primeiroNome(x.nome))}</button>`).join('')}
      </div>
      <div id="pin-area" hidden>
        <div class="pin-pontos" id="pin-pontos"><i></i><i></i><i></i><i></i></div>
        <div class="pin-teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-tecla="${n}">${n}</button>`).join('')}<button class="vazio-btn" tabindex="-1"></button><button data-tecla="0">0</button><button data-tecla="apagar" aria-label="Apagar">${ic('voltar')}</button></div>
        <button class="btn fantasma cheio" id="pin-voltar" style="margin-top:12px">Trocar pessoa</button>
      </div>
      <div class="login-voltar"><a class="btn fantasma" href="#/">${ic('voltar')} Início</a></div>
    </div></div>`;
    let quem = null, pin = '';
    const pontos = () => $$('#pin-pontos i').forEach((p, i) => p.classList.toggle('on', i < pin.length));
    const tentar = () => {
      const certo = quem === 'dono' ? b.pin_dono : Store.get('barbeiros', quem)?.pin;
      if (pin === String(certo)) {
        this.gravarSessao(b, quem === 'dono' ? { tipo: 'dono' } : { tipo: 'barbeiro', id: quem });
        window.onkeydown = null;
        Rotas.render();
      } else {
        const el = $('#pin-pontos');
        el.classList.remove('erro'); void el.offsetWidth; el.classList.add('erro');
        pin = ''; setTimeout(pontos, 250);
        UI.toast('PIN incorreto.', 'erro');
      }
    };
    const tecla = t => {
      if (!quem) return;
      if (t === 'apagar') pin = pin.slice(0, -1);
      else if (pin.length < 4) pin += t;
      pontos();
      if (pin.length === 4) setTimeout(tentar, 120);
    };
    this.app.onclick = e => {
      const q = e.target.closest('[data-quem]');
      if (q) {
        quem = q.dataset.quem; pin = '';
        const x = quem === 'dono' ? null : Store.get('barbeiros', quem);
        $('#login-txt').innerHTML = `Digite o PIN de <b>${esc(x ? primeiroNome(x.nome) : 'dono / gerência')}</b>`;
        $('#quem').hidden = true; $('#pin-area').hidden = false; pontos();
        return;
      }
      const t = e.target.closest('[data-tecla]');
      if (t) return tecla(t.dataset.tecla);
      if (e.target.closest('#pin-voltar')) { quem = null; $('#quem').hidden = false; $('#pin-area').hidden = true; $('#login-txt').textContent = 'Quem está entrando?'; }
    };
    window.onkeydown = e => {
      const area = $('#pin-area');
      if (!area || area.hidden) return;
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === 'Backspace') tecla('apagar');
    };
  },

  /* ============================ AGENDA ============================ */
  v_agenda() {
    const b = this.b, dia = this.dia, eu = this.eu(), hoje = Datas.hoje();
    const todos = Agenda.barbeiros(b);
    let cols = eu ? [eu] : this.filtroBarbeiro === 'todos' ? todos : todos.filter(x => x.id === this.filtroBarbeiro);
    if (!cols.length) cols = todos;
    const ids = new Set(cols.map(x => x.id));
    const todosAg = Store.de('agendamentos', b.id).filter(a => ids.has(a.barbeiro_id));
    const ags = todosAg.filter(a => a.data === dia).sort((p, q) => p.ini - q.ini || p.barbeiro_id.localeCompare(q.barbeiro_id));
    const validos = ags.filter(a => a.status !== 'cancelado' && a.status !== 'faltou');
    const valor = soma(validos, a => a.status === 'concluido' ? (a.total_pago ?? a.total) : a.total);
    const concl = validos.filter(a => a.status === 'concluido').length;
    const ini = Datas.inicioSemana(dia);
    const semana = [...Array(7)].map((_, i) => Datas.soma(ini, i));
    const agora = Datas.agoraAbs();
    const pend = todosAg.filter(a => a.status === 'confirmado' && Datas.abs(a.data, a.fim) < agora - 60).sort((p, q) => p.data.localeCompare(q.data) || p.ini - q.ini);
    const modo = this.modo || (window.innerWidth < 700 && cols.length > 1 ? 'lista' : 'grade');
    const livres = cols.reduce((n, x) => n + Agenda.horarios(b, x, dia, b.regras.intervalo || 30, { cliente: false }).filter(t => dia > hoje || t > Datas.agoraMin()).length, 0);
    return `<div class="topo"><div><h1>${eu ? 'Minha agenda' : 'Agenda'}</h1><p class="sub">${cap(Datas.longa(dia))}${dia === hoje ? ' · hoje' : ''}</p></div>
        <div class="topo-acoes"><button class="btn" data-a="bloquear">${ic('cadeado')} Bloquear</button><button class="btn" data-a="avulso">${ic('tesoura')} Sem agendamento</button><button class="btn pri" data-a="novo-ag">${ic('mais')} Agendar</button></div></div>
      ${this.avisoMensalistas()}
      ${pend.length ? `<div class="aviso-faixa">${ic('alerta')}<span>${pend.length} atendimento${pend.length > 1 ? 's' : ''} que já passou ainda não ${pend.length > 1 ? 'tiveram' : 'teve'} baixa. Feche o dia para o faturamento ficar certo.</span><button class="btn peq" data-a="fechar-dia" data-d="${pend[0].data}">${ic('check')} Fechar ${Datas.brCurta(pend[0].data)}</button></div>` : ''}
      <div class="agenda-barra">
        <div class="nav-dia"><button class="btn-icone" data-a="dia" data-d="-1" aria-label="Dia anterior">${ic('esquerda')}</button><button class="btn peq" data-a="ir-dia" data-d="${hoje}">Hoje</button><button class="btn-icone" data-a="dia" data-d="1" aria-label="Próximo dia">${ic('direita')}</button></div>
        <input type="date" id="escolher-dia" value="${dia}" aria-label="Escolher dia">
        ${!eu && todos.length > 1 ? `<div class="fichas">${[['todos', 'Todos']].concat(todos.map(x => [x.id, primeiroNome(x.nome)])).map(([id, n]) => `<button class="ficha ${this.filtroBarbeiro === id ? 'on' : ''}" data-a="filtro-barb" data-v="${id}">${esc(n)}</button>`).join('')}</div>` : ''}
        <span class="esp"></span>
        <div class="seg" role="group" aria-label="Visualização"><button class="${modo === 'grade' ? 'on' : ''}" data-a="modo" data-v="grade">${ic('grade')} Grade</button><button class="${modo === 'lista' ? 'on' : ''}" data-a="modo" data-v="lista">${ic('lista')} Lista</button></div>
      </div>
      <div class="semana">${semana.map(d => {
        const n = todosAg.filter(a => a.data === d && a.status !== 'cancelado').length;
        const fechado = cols.every(x => !Agenda.expediente(b, x, d).length);
        return `<button class="dia-btn ${d === dia ? 'on' : ''} ${d === hoje ? 'hoje' : ''} ${fechado ? 'fechado' : ''}" data-a="ir-dia" data-d="${d}"><small>${DIAS_CURTOS[Datas.dow(d)]}</small><b>${+d.slice(8)}</b><em>${n ? n : fechado ? '—' : '0'}</em></button>`;
      }).join('')}</div>
      <div class="resumo-dia"><span>${ic('calendario')}<b>${validos.length}</b> agendamento${validos.length === 1 ? '' : 's'}</span><span>${ic('check')}<b>${concl}</b> concluído${concl === 1 ? '' : 's'}</span><span>${ic('carteira')}<b>${dinheiro(valor)}</b> ${dia < hoje ? 'no dia' : 'previsto'}</span>${dia >= hoje ? `<span>${ic('relogio')}<b>${livres}</b> horários livres</span>` : ''}${dia <= hoje ? `<span class="esp"></span>${Store.de('fechamentos', b.id).some(f => f.data === dia && (f.barbeiro_id || null) === (eu?.id || null)) ? UI.badge('Dia fechado', 'ok', 'check') : ''}<button class="btn peq pri" data-a="fechar-dia" data-d="${dia}">${ic('check')} Fechar o dia</button>` : ''}</div>
      ${modo === 'grade' ? this.grade(cols, ags, dia) : this.lista(ags)}`;
  },

  grade(cols, ags, dia) {
    const b = this.b, PX = 1.6;
    let ini = 24 * 60, fim = 0;
    for (const x of cols) for (const [p, q] of Agenda.expediente(b, x, dia)) { ini = Math.min(ini, p); fim = Math.max(fim, q); }
    for (const a of ags) if (a.status !== 'cancelado') { ini = Math.min(ini, a.ini); fim = Math.max(fim, a.fim); }
    if (ini >= fim) { ini = 8 * 60; fim = 19 * 60; }
    ini = Math.floor(ini / 60) * 60; fim = Math.ceil(fim / 60) * 60;
    const alt = (fim - ini) * PX, y = t => ((t - ini) * PX).toFixed(1), alto = (p, q) => ((q - p) * PX).toFixed(1);
    const linhas = [], horas = [];
    for (let t = ini; t <= fim; t += 30) linhas.push(`<div class="cal-linha ${t % 60 ? 'meia' : ''}" style="top:${y(t)}px"></div>`);
    for (let t = ini; t < fim; t += 60) horas.push(`<span style="top:${y(t)}px">${Datas.hhmm(t)}</span>`);
    const agora = dia === Datas.hoje() ? Datas.agoraMin() : null;
    const bloqs = Store.de('bloqueios', b.id).filter(k => k.data === dia);
    const colunas = cols.map(x => {
      const fechadas = [];
      let c = ini;
      for (const [p, q] of Agenda.expediente(b, x, dia).sort((m, n) => m[0] - n[0])) { if (p > c) fechadas.push([c, p]); c = Math.max(c, q); }
      if (c < fim) fechadas.push([c, fim]);
      const meus = ags.filter(a => a.barbeiro_id === x.id && a.status !== 'cancelado');
      return `<div class="cal-col">
        <div class="cal-cab">${UI.avatar(x.nome, x.foto, x.cor, 'p')}<span>${esc(primeiroNome(x.nome))}</span><small>${meus.length}</small></div>
        <div class="cal-corpo" style="height:${alt}px" data-a="slot" data-barbeiro="${x.id}" data-ini="${ini}" data-px="${PX}" title="Clique num espaço livre para agendar">
          ${linhas.join('')}
          ${fechadas.map(([p, q]) => `<div class="cal-fechado" style="top:${y(p)}px;height:${alto(p, q)}px"></div>`).join('')}
          ${bloqs.filter(k => !k.barbeiro_id || k.barbeiro_id === x.id).map(k => `<div class="cal-bloq" data-a="ver-bloq" data-id="${k.id}" style="top:${y(Math.max(k.ini, ini))}px;height:${Math.max(18, (Math.min(k.fim, fim) - Math.max(k.ini, ini)) * PX - 2).toFixed(1)}px">${ic('cadeado')}<span>${esc(k.motivo || 'Bloqueado')}</span></div>`).join('')}
          ${meus.map(a => {
            const h = (a.fim - a.ini) * PX - 2;
            const marca = a.status === 'concluido' ? ic('check') : a.status === 'faltou' ? ic('usuario-x') : a.reservas?.length ? ic('sacola') : '';
            return `<div class="cal-ag st-${a.status} ${h < 36 ? 'curto' : ''} ${this.novosIds.has(a.id) ? 'novo' : ''}" data-a="ver-ag" data-id="${a.id}" style="--c:${esc(x.cor || '#c9a227')};top:${y(a.ini)}px;height:${h.toFixed(1)}px" title="${esc(`${Datas.hhmm(a.ini)}–${Datas.hhmm(a.fim)} · ${a.cliente_nome} · ${a.servicos.map(s => s.nome).join(' + ')}`)}">
              <b>${marca}${Datas.hhmm(a.ini)} ${esc(a.cliente_nome)}</b><span>${esc(a.servicos.map(s => s.nome).join(' + '))}</span></div>`;
          }).join('')}
          ${agora !== null && agora > ini && agora < fim ? `<div class="cal-agora" style="top:${y(agora)}px"></div>` : ''}
        </div></div>`;
    });
    return `<div class="cal-wrap" id="cal-wrap"><div class="cal ${cols.length === 1 ? 'um' : ''}" style="--cols:${cols.length}">
      <div class="cal-horas"><div class="cal-cab"></div><div class="cal-horas-corpo" style="height:${alt}px">${horas.join('')}</div></div>
      ${colunas.join('')}</div></div>`;
  },

  badgeAg(a) {
    if (a.status === 'confirmado' && Datas.abs(a.data, a.fim) < Datas.agoraAbs()) return UI.badge('Sem baixa', 'aviso');
    const t = { confirmado: ['Confirmado', 'info'], concluido: ['Concluído', 'ok'], faltou: ['Faltou', 'ruim'], cancelado: ['Cancelado', 'neutro'] }[a.status];
    return UI.badge(t[0], t[1]);
  },
  lista(ags) {
    if (!ags.length) return `<div class="card">${UI.vazio('calendario', 'Nenhum agendamento neste dia', 'Use o botão "Agendar" para lançar um atendimento.')}</div>`;
    const eu = this.eu();
    return `<div class="ag-lista">${ags.map(a => {
      const x = Store.get('barbeiros', a.barbeiro_id);
      return `<button class="ag-item st-${a.status}" data-a="ver-ag" data-id="${a.id}" style="--c:${esc(x?.cor || '#c9a227')}">
        <div class="ag-hora"><b>${Datas.hhmm(a.ini)}</b><small>até ${Datas.hhmm(a.fim)}</small></div>
        <div class="ag-txt"><b>${esc(a.cliente_nome)}</b><small>${esc(a.servicos.map(s => s.nome).join(' + '))}${eu ? '' : ' · ' + esc(primeiroNome(x?.nome))}</small></div>
        <div class="ag-fim">${this.badgeAg(a)}<b>${dinheiro(a.status === 'concluido' ? a.total_pago ?? a.total : a.total)}</b></div></button>`;
    }).join('')}</div>`;
  },

  verAg(id) {
    const a = Store.get('agendamentos', id);
    if (!a) return;
    const b = this.b, x = Store.get('barbeiros', a.barbeiro_id);
    const hist = a.cliente_tel ? Store.de('agendamentos', b.id).filter(o => o.cliente_tel === a.cliente_tel && o.status === 'concluido' && o.id !== a.id).sort((p, q) => q.data.localeCompare(p.data)) : [];
    const passou = Datas.abs(a.data, a.ini) <= Datas.agoraAbs();
    const lembrete = `Olá, ${primeiroNome(a.cliente_nome)}! Passando para lembrar do seu horário: ${Datas.relativa(a.data)} (${Datas.brCurta(a.data)}) às ${Datas.hhmm(a.ini)}, com ${primeiroNome(x?.nome)}. ${b.nome} te espera!`;
    const origem = { cliente: 'Agendado pelo cliente (chat)', balcao: 'Lançado no balcão' }[a.origem] || a.origem;
    const corpo = `
      <div class="det-topo">${UI.avatar(a.cliente_nome, null, '#57514a', 'g')}<div><h4>${esc(a.cliente_nome)}</h4>
        ${a.cliente_tel ? `<a href="${linkWhats(a.cliente_tel, a.status === 'confirmado' ? lembrete : '')}" target="_blank" rel="noopener">${ic('mensagem')} ${esc(fmtTel(a.cliente_tel))}</a>` : '<span class="muted" style="font-size:13px">Sem telefone</span>'}</div>${this.badgeAg(a)}</div>
      <dl class="info-lista">
        <dt>Quando</dt><dd><b>${cap(Datas.longa(a.data))}</b> · ${Datas.hhmm(a.ini)} às ${Datas.hhmm(a.fim)}</dd>
        <dt>Profissional</dt><dd>${esc(x?.nome || '—')}</dd>
        <dt>Serviços</dt><dd><div class="det-servicos">${a.servicos.map(s => `<div><span>${esc(s.nome)}</span><span class="num">${dinheiro(s.preco)}</span></div>`).join('')}</div></dd>
        <dt>Origem</dt><dd>${esc(origem)}${a.remarcado_em ? ' · remarcado' : ''}</dd>
        ${a.obs ? `<dt>Observação</dt><dd>${esc(a.obs)}</dd>` : ''}
        ${a.status === 'cancelado' ? `<dt>Cancelado por</dt><dd>${a.cancelado_por === 'cliente' ? 'Cliente' : 'Estabelecimento'}</dd>` : ''}
        ${a.status === 'concluido' ? `<dt>Pagamento</dt><dd>${esc(FORMAS_PAGAMENTO[a.forma_pagamento] || '—')}${a.desconto ? ` · desconto de ${dinheiro(a.desconto)}` : ''}</dd>
          ${a.produtos?.length ? `<dt>Produtos</dt><dd>${a.produtos.map(p => `${p.qtd}× ${esc(p.nome)} (${dinheiro(p.preco * p.qtd)})`).join('<br>')}</dd>` : ''}` : ''}
        ${this.infoExtraAg(a)}
        <dt>Histórico</dt><dd>${hist.length ? `${hist.length} visita${hist.length > 1 ? 's' : ''} antes · última em ${Datas.br(hist[0].data)} (${esc(hist[0].servicos.map(s => s.nome).join(' + '))})` : 'Primeira visita'}</dd>
      </dl>
      ${a.reservas?.length && a.status === 'confirmado' ? `<div class="det-nota">${ic('sacola')}<span>Pediu para separar: <b>${a.reservas.map(p => `${p.qtd}× ${esc(p.nome)}`).join(', ')}</b></span></div>` : ''}
      <div class="det-total"><span>${a.status === 'concluido' ? 'Total pago' : 'Total previsto'}</span><b>${dinheiro(a.status === 'concluido' ? a.total_pago ?? a.total : a.total)}</b></div>`;
    const bt = (acao, rot, cls = '', icone = '') => `<button class="btn ${cls}" data-a="${acao}" data-id="${a.id}">${icone ? ic(icone) : ''}${rot}</button>`;
    let rodape = '';
    if (a.status === 'confirmado') rodape = bt('cancelar-ag', 'Cancelar', 'perigo-txt esq', 'x') + (passou ? bt('faltou', 'Faltou', '', 'usuario-x') : '') + bt('remarcar', 'Remarcar', '', 'calendario') + bt('concluir', 'Concluir', 'ok', 'check');
    else rodape = bt('reabrir', a.status === 'concluido' ? 'Desfazer conclusão' : 'Voltar a confirmado', 'esq', 'atualizar');
    const m = UI.modal({ titulo: 'Agendamento', corpo, rodape });
    m.el.onclick = e => { const el = e.target.closest('[data-a]'); if (el) { m.fechar(); this.clique(e); } };
  },

  concluir(id) {
    const a = Store.get('agendamentos', id), b = this.b;
    const st = { servicos: copia(a.servicos), produtos: copia(a.produtos?.length ? a.produtos : (a.reservas || [])), desconto: a.desconto || 0, forma: a.forma_pagamento || 'pix' };
    const total = () => Math.max(0, soma(st.servicos, s => s.preco) + soma(st.produtos, p => p.preco * p.qtd) - st.desconto);
    const m = UI.modal({ titulo: 'Concluir atendimento', fixo: true, corpo: '<div id="conc"></div>', rodape: `<button class="btn" data-fechar>Voltar</button><button class="btn ok" id="conf-conc">${ic('check')} Concluir e registrar</button>` });
    const desenhar = () => {
      $('#conc', m.el).innerHTML = `
        <p class="texto-modal" style="margin-bottom:14px"><b>${esc(a.cliente_nome)}</b> · ${Datas.curta(a.data)} às ${Datas.hhmm(a.ini)}</p>
        <div class="secao-modal"><h4>Serviços feitos</h4><div class="itens-conta">${st.servicos.map((s, i) => `<div class="item-conta"><span>${esc(s.nome)}</span><b>${dinheiro(s.preco)}</b><button type="button" class="btn-icone" data-rm-sv="${i}" aria-label="Tirar ${esc(s.nome)}">${ic('x')}</button></div>`).join('') || '<p class="muted">Nenhum serviço.</p>'}</div>
          <select class="entrada" id="add-sv" style="margin-top:8px"><option value="">+ Adicionar serviço</option>${Agenda.servicos(b).map(s => `<option value="${s.id}">${esc(s.nome)} — ${dinheiro(s.preco)}</option>`).join('')}</select></div>
        <div class="secao-modal"><h4>Produtos vendidos</h4><div class="itens-conta">${st.produtos.map((p, i) => `<div class="item-conta"><span>${esc(p.nome)}</span><span class="qtd"><button type="button" data-qtd="${i}" data-d="-1" aria-label="Menos">${ic('menos')}</button><span>${p.qtd}</span><button type="button" data-qtd="${i}" data-d="1" aria-label="Mais">${ic('mais')}</button></span><b>${dinheiro(p.preco * p.qtd)}</b></div>`).join('') || '<p class="muted" style="font-size:14px">Nenhum produto.</p>'}</div>
          <select class="entrada" id="add-pd" style="margin-top:8px"><option value="">+ Adicionar produto</option>${Agenda.produtos(b).map(p => `<option value="${p.id}">${esc(p.nome)} — ${dinheiro(p.preco)}${p.estoque != null ? ` · ${p.estoque} em estoque` : ''}</option>`).join('')}</select></div>
        <div class="secao-modal"><h4>Pagamento</h4>
          <div class="opcoes-grade" style="margin-bottom:12px">${Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => `<button type="button" class="op-btn ${st.forma === k ? 'on' : ''}" data-forma="${k}">${v}</button>`).join('')}</div>
          <label class="campo"><span>Desconto (R$)</span><input id="desc" inputmode="decimal" value="${st.desconto ? numBR(st.desconto) : ''}" placeholder="0,00"></label>
          <div class="total-grande"><span>Total a receber</span><b id="tot-conc">${dinheiro(total())}</b></div></div>`;
    };
    desenhar();
    m.el.onclick = e => {
      const rm = e.target.closest('[data-rm-sv]'), q = e.target.closest('[data-qtd]'), f = e.target.closest('[data-forma]');
      if (rm) { st.servicos.splice(+rm.dataset.rmSv, 1); desenhar(); }
      else if (q) { const p = st.produtos[+q.dataset.qtd]; p.qtd += +q.dataset.d; if (p.qtd <= 0) st.produtos.splice(+q.dataset.qtd, 1); desenhar(); }
      else if (f) { st.forma = f.dataset.forma; desenhar(); }
    };
    m.el.onchange = e => {
      if (e.target.id === 'add-sv' && e.target.value) { const s = Store.get('servicos', e.target.value); st.servicos.push({ id: s.id, nome: s.nome, preco: s.preco, duracao: s.duracao }); desenhar(); }
      if (e.target.id === 'add-pd' && e.target.value) {
        const p = Store.get('produtos', e.target.value), ja = st.produtos.find(x => x.id === p.id);
        if (ja) ja.qtd++; else st.produtos.push({ id: p.id, nome: p.nome, preco: p.preco, qtd: 1 });
        desenhar();
      }
    };
    m.el.oninput = e => { if (e.target.id === 'desc') { st.desconto = lerDinheiro(e.target.value); $('#tot-conc', m.el).textContent = dinheiro(total()); } };
    $('#conf-conc', m.el).onclick = async () => {
      try {
        if (!st.servicos.length && !st.produtos.length) throw new Error('Inclua pelo menos um serviço ou produto.');
        const vs = soma(st.servicos, s => s.preco), vp = soma(st.produtos, p => p.preco * p.qtd);
        if (st.desconto > vs + vp) throw new Error('O desconto é maior que o total.');
        await Store.salvar('agendamentos', {
          id, status: 'concluido', servicos: st.servicos, total: vs, valor_servicos: vs, produtos: st.produtos, valor_produtos: vp,
          desconto: st.desconto, total_pago: vs + vp - st.desconto, forma_pagamento: st.forma, concluido_em: new Date().toISOString()
        });
        for (const p of st.produtos) this.mexerEstoque(p.id, -p.qtd);
        UI.toast(`Atendimento concluído · ${dinheiro(vs + vp - st.desconto)}`);
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  // preço mostrado no agendamento do balcão (plano mensal, promoção e fidelidade já aplicados)
  precoBalcao(sel, st, rem, f) {
    if (rem) return dinheiro(rem.total);
    const tel = soDigitos(f?.tel?.value || '');
    const orc = Orcamento.calcular(this.b, sel, { data: st.data, ini: st.ini ?? 0, tel, online: false, usarCredito: false });
    const extra = Orcamento.linhas(orc).map(l => l.rot.split(':')[0].replace(/ \(.*/, '')).join(', ');
    return orc.total !== orc.tabela ? `<s>${dinheiro(orc.tabela)}</s> <b>${dinheiro(orc.total)}</b> (${esc(extra)})` : dinheiro(orc.total);
  },
  mexerEstoque(produtoId, delta) {
    const p = Store.get('produtos', produtoId);
    if (p && p.estoque != null && p.estoque !== '') Store.salvar('produtos', { id: p.id, estoque: Math.max(0, Number(p.estoque) + delta) });
  },

  /* agendar no balcão ou remarcar */
  formAg(op = {}) {
    const b = this.b, eu = this.eu(), rem = op.remarcar || null;
    const svs = Agenda.servicos(b);
    const st = {
      servicos: rem ? rem.servicos.map(s => s.id) : (op.servicos || []),
      barbeiro: rem ? rem.barbeiro_id : (eu ? eu.id : op.barbeiroId || ''),
      data: rem ? rem.data : (op.data || this.dia),
      ini: rem ? rem.ini : (op.ini ?? null), encaixe: false, inicial: op.ini ?? null
    };
    const clientes = Store.de('clientes', b.id);
    const corpo = `<form id="f-ag" autocomplete="off">
      ${rem ? `<div class="det-nota" style="margin:0 0 16px">${ic('usuario')}<span><b>${esc(rem.cliente_nome)}</b> · ${esc(rem.servicos.map(s => s.nome).join(' + '))}<br><span class="muted">Hoje marcado: ${Datas.curta(rem.data)} às ${Datas.hhmm(rem.ini)}</span></span></div>` : `
      <div class="grade-form">
        <label class="campo"><span>Cliente</span><input name="nome" list="lista-cli" value="${esc(op.cliente?.nome || '')}" placeholder="Nome do cliente" autofocus></label>
        <label class="campo"><span>WhatsApp <small>(opcional)</small></span><input name="tel" data-tel inputmode="tel" value="${esc(fmtTel(op.cliente?.telefone || ''))}" placeholder="(21) 99999-9999"></label>
      </div>
      <datalist id="lista-cli">${clientes.slice(0, 400).map(c => `<option value="${esc(c.nome)}">${esc(fmtTel(c.telefone))}</option>`).join('')}</datalist>
      <div class="campo" style="margin-top:14px"><span>Serviços</span><div class="opcoes-grade" id="ag-svs">${svs.map(s => `<button type="button" class="op-btn ${st.servicos.includes(s.id) ? 'on' : ''}" data-sv="${s.id}">${esc(s.nome)} <small>${dinheiro(s.preco)} · ${duracaoTxt(s.duracao)}</small></button>`).join('')}</div></div>`}
      <div class="grade-form" style="margin-top:14px">
        <label class="campo"><span>Profissional</span><select name="barbeiro" ${eu ? 'disabled' : ''}></select></label>
        <label class="campo"><span>Dia</span><input type="date" name="data" value="${st.data}"></label>
      </div>
      <div class="campo" style="margin-top:14px"><span>Horário</span><div id="ag-horas"></div></div>
      ${rem ? '' : `<label class="campo" style="margin-top:14px"><span>Observação</span><input name="obs" placeholder="Ex.: prefere máquina 2 nas laterais"></label>`}
    </form>`;
    const m = UI.modal({ titulo: rem ? 'Remarcar horário' : 'Novo agendamento', corpo, fixo: true,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-ag">${ic('check')} ${rem ? 'Remarcar' : 'Agendar'}</button>` });
    const f = $('#f-ag', m.el);
    const escolhidos = () => st.servicos.map(id => svs.find(s => s.id === id) || Store.get('servicos', id)).filter(Boolean);
    const desenhar = () => {
      const sel = escolhidos(), dur = Agenda.duracao(sel);
      const aptos = eu ? [eu] : Agenda.barbeiros(b, st.servicos);
      if (!aptos.some(x => x.id === st.barbeiro)) st.barbeiro = aptos[0]?.id || '';
      f.barbeiro.innerHTML = aptos.length ? aptos.map(x => `<option value="${x.id}" ${x.id === st.barbeiro ? 'selected' : ''}>${esc(x.nome)}</option>`).join('') : '<option value="">Ninguém faz essa combinação</option>';
      const x = Store.get('barbeiros', st.barbeiro);
      const caixa = $('#ag-horas', m.el);
      if (!dur) { caixa.innerHTML = '<p class="ajuda">Escolha pelo menos um serviço.</p>'; return; }
      if (!x) { caixa.innerHTML = '<p class="ajuda">Nenhum profissional ativo faz todos esses serviços.</p>'; return; }
      const slots = Agenda.horarios(b, x, st.data, dur, { ignorar: rem?.id, cliente: false });
      if (st.inicial != null) { if (!slots.includes(st.inicial)) st.encaixe = true; st.ini = st.inicial; st.inicial = null; }
      if (!st.encaixe && !slots.includes(st.ini)) st.ini = null;
      caixa.innerHTML = `${slots.length ? `<div class="horas-grade">${slots.map(t => `<button type="button" class="op-btn ${st.ini === t && !st.encaixe ? 'on' : ''}" data-hora="${t}">${Datas.hhmm(t)}</button>`).join('')}</div>` : `<p class="ajuda">${Agenda.expediente(b, x, st.data).length ? 'Sem horários livres nesse dia para essa duração.' : `${esc(primeiroNome(x.nome))} não trabalha nesse dia.`}</p>`}
        <p class="ajuda" style="margin-top:8px">Duração: ${duracaoTxt(dur)} · ${this.precoBalcao(sel, st, rem, f)}</p>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="encaixe" ${st.encaixe ? 'checked' : ''}> Encaixe em outro horário</label>
        ${st.encaixe ? `<input type="time" id="hora-encaixe" class="entrada" style="max-width:170px;margin-top:8px" value="${st.ini != null ? Datas.hhmm(st.ini) : ''}">` : ''}`;
    };
    desenhar();
    m.el.onclick = e => {
      const sv = e.target.closest('[data-sv]'), hr = e.target.closest('[data-hora]');
      if (sv) { const i = st.servicos.indexOf(sv.dataset.sv); i >= 0 ? st.servicos.splice(i, 1) : st.servicos.push(sv.dataset.sv); sv.classList.toggle('on'); desenhar(); }
      if (hr) { st.ini = +hr.dataset.hora; st.encaixe = false; desenhar(); }
    };
    m.el.onchange = e => {
      const t = e.target;
      if (t.name === 'barbeiro') { st.barbeiro = t.value; desenhar(); }
      if (t.name === 'data' && t.value) { st.data = t.value; desenhar(); }
      if (t.id === 'encaixe') { st.encaixe = t.checked; if (!t.checked) st.ini = null; desenhar(); }
      if (t.id === 'hora-encaixe' && t.value) st.ini = Datas.min(t.value);
    };
    m.el.oninput = e => {
      if (e.target.name === 'nome' && f.tel && !soDigitos(f.tel.value)) {
        const c = clientes.find(x => x.nome.toLowerCase() === e.target.value.trim().toLowerCase());
        if (c) { f.tel.value = fmtTel(c.telefone); desenhar(); }
      }
      if (e.target.name === 'tel' && [10, 11].includes(soDigitos(e.target.value).length)) desenhar();
    };
    $('#salvar-ag', m.el).onclick = async () => {
      try {
        const hEnc = $('#hora-encaixe', m.el);
        if (st.encaixe && hEnc?.value) st.ini = Datas.min(hEnc.value);
        const sel = escolhidos(), dur = Agenda.duracao(sel);
        if (!rem && !f.nome.value.trim()) throw new Error('Informe o nome do cliente.');
        if (!sel.length) throw new Error('Escolha pelo menos um serviço.');
        if (!st.barbeiro) throw new Error('Escolha o profissional.');
        if (st.ini == null) throw new Error('Escolha o horário.');
        const tel = rem ? rem.cliente_tel : soDigitos(f.tel.value);
        if (tel && ![10, 11].includes(tel.length)) throw new Error('Confira o WhatsApp: DDD + número.');
        if (st.encaixe) {
          const conf = Agenda.conflitos(b, st.barbeiro, st.data, st.ini, st.ini + dur, rem?.id);
          if (conf.length && !await UI.confirmar(`Esse horário bate com ${conf.map(c => c.cliente_nome ? `<b>${esc(c.cliente_nome)}</b> (${Datas.hhmm(c.ini)})` : `um bloqueio (${esc(c.motivo || '')})`).join(', ')}. Encaixar mesmo assim?`, { titulo: 'Horário ocupado', ok: 'Encaixar' })) return;
        }
        if (rem) {
          await Store.salvar('agendamentos', { id: rem.id, barbeiro_id: st.barbeiro, data: st.data, ini: st.ini, fim: st.ini + dur, remarcado_em: new Date().toISOString() });
          UI.toast(`Remarcado para ${Datas.curta(st.data)} às ${Datas.hhmm(st.ini)}.`);
        } else {
          const orc = Orcamento.calcular(b, sel, { data: st.data, ini: st.ini, tel, online: false, usarCredito: false });
          await Agenda.agendar({ b, barbeiroId: st.barbeiro, data: st.data, ini: st.ini, servicos: sel, nome: f.nome.value, telefone: tel, origem: 'balcao', obs: f.obs.value.trim(), encaixe: true, extras: Orcamento.campos(orc) });
          UI.toast(`Agendado: ${Datas.curta(st.data)} às ${Datas.hhmm(st.ini)}.`);
        }
        m.fechar();
        if (st.data !== this.dia) { this.dia = st.data; this.rolarAgora = true; }
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },

  formBloqueio() {
    const b = this.b, eu = this.eu();
    const motivos = ['Almoço', 'Folga', 'Compromisso', 'Feriado', 'Curso'];
    const m = UI.modal({
      titulo: 'Bloquear horário', classe: 'pequeno',
      corpo: `<form id="f-bl" class="pilha">
        <p class="ajuda">O horário bloqueado não aparece para o cliente agendar.</p>
        <label class="campo"><span>Quem</span><select name="barbeiro" ${eu ? 'disabled' : ''}>${eu ? `<option value="${eu.id}">${esc(eu.nome)}</option>` : `<option value="">Todos (o estabelecimento inteiro)</option>${Agenda.barbeiros(b).map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}`}</select></label>
        <div class="grade-form"><label class="campo"><span>De</span><input type="date" name="de" value="${this.dia}"></label><label class="campo"><span>Até <small>(vários dias)</small></span><input type="date" name="ate" value="${this.dia}"></label></div>
        <label class="check"><input type="checkbox" name="inteiro"> Dia inteiro</label>
        <div class="grade-form" id="bl-horas"><label class="campo"><span>Das</span><input type="time" name="ini" value="12:00"></label><label class="campo"><span>Às</span><input type="time" name="fim" value="13:00"></label></div>
        <div class="campo"><span>Motivo</span><div class="opcoes-grade">${motivos.map((t, i) => `<button type="button" class="op-btn ${i === 0 ? 'on' : ''}" data-motivo="${t}">${t}</button>`).join('')}</div>
          <input name="motivo" class="entrada" value="Almoço" style="margin-top:8px"></div>
      </form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-bl">${ic('cadeado')} Bloquear</button>`
    });
    const f = $('#f-bl', m.el);
    m.el.onclick = e => { const mt = e.target.closest('[data-motivo]'); if (mt) { $$('[data-motivo]', m.el).forEach(x => x.classList.toggle('on', x === mt)); f.motivo.value = mt.dataset.motivo; if (['Folga', 'Feriado'].includes(mt.dataset.motivo)) { f.inteiro.checked = true; $('#bl-horas', m.el).hidden = true; } } };
    f.inteiro.onchange = () => { $('#bl-horas', m.el).hidden = f.inteiro.checked; };
    $('#salvar-bl', m.el).onclick = async () => {
      try {
        const d = UI.form(f);
        const barbeiro = eu ? eu.id : f.barbeiro.value || null;
        const de = d.de, ate = d.ate && d.ate >= de ? d.ate : de;
        const n = Datas.diff(ate, de) + 1;
        if (n > 62) throw new Error('Bloqueie no máximo dois meses de uma vez.');
        const ini = f.inteiro.checked ? 0 : Datas.min(d.ini), fim = f.inteiro.checked ? 24 * 60 : Datas.min(d.fim);
        if (!(fim > ini)) throw new Error('O fim precisa ser depois do início.');
        let conflitos = 0;
        for (let i = 0; i < n; i++) {
          const data = Datas.soma(de, i);
          await Store.salvar('bloqueios', { barbearia_id: b.id, barbeiro_id: barbeiro, data, ini, fim, motivo: d.motivo || 'Bloqueado' });
          conflitos += Store.de('agendamentos', b.id).filter(a => a.data === data && a.status === 'confirmado' && (!barbeiro || a.barbeiro_id === barbeiro) && a.ini < fim && a.fim > ini).length;
        }
        UI.toast(conflitos ? `Bloqueado. Atenção: ${conflitos} agendamento${conflitos > 1 ? 's continuam marcados' : ' continua marcado'} nesse período.` : 'Horário bloqueado.', conflitos ? 'info' : 'ok');
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  async verBloqueio(id) {
    const k = Store.get('bloqueios', id);
    if (!k) return;
    const x = k.barbeiro_id ? Store.get('barbeiros', k.barbeiro_id) : null;
    const periodo = k.ini === 0 && k.fim >= 1440 ? 'dia inteiro' : `${Datas.hhmm(k.ini)} às ${Datas.hhmm(Math.min(k.fim, 1439))}`;
    if (!await UI.confirmar(`<b>${esc(k.motivo || 'Bloqueio')}</b> · ${esc(x ? x.nome : 'todo o estabelecimento')}<br>${cap(Datas.longa(k.data))}, ${periodo}.<br><br>Liberar esse horário para agendamentos?`, { titulo: 'Horário bloqueado', ok: 'Liberar horário' })) return;
    await Store.remover('bloqueios', id);
    UI.toast('Horário liberado.');
    this.pintar();
  },

  /* ============================ CLIENTES ============================ */
  dadosClientes() {
    const b = this.b, eu = this.eu(), hoje = Datas.hoje(), mes = Datas.mes(hoje);
    const mapa = new Map();
    const novo = (nome, tel) => ({ nome, tel, visitas: 0, gasto: 0, ultima: null, primeira: null, proxima: null, faltas: 0 });
    for (const a of Store.de('agendamentos', b.id)) {
      if (eu && a.barbeiro_id !== eu.id) continue;
      const k = a.cliente_tel || 'n:' + a.cliente_nome;
      const c = mapa.get(k) || novo(a.cliente_nome, a.cliente_tel);
      if (a.status === 'concluido') {
        c.visitas++; c.gasto += a.total_pago ?? a.total;
        if (!c.ultima || a.data > c.ultima) c.ultima = a.data;
        if (!c.primeira || a.data < c.primeira) c.primeira = a.data;
      }
      if (a.status === 'faltou') c.faltas++;
      if (a.status === 'confirmado' && a.data >= hoje && (!c.proxima || a.data < c.proxima)) c.proxima = a.data;
      mapa.set(k, c);
    }
    if (!eu) for (const cl of Store.de('clientes', b.id)) if (!mapa.has(cl.telefone)) mapa.set(cl.telefone, novo(cl.nome, cl.telefone));
    const lista = [...mapa.entries()].map(([k, c]) => ({ k, ...c, sumido: c.ultima && !c.proxima && Datas.diff(hoje, c.ultima) >= 30, novo: c.primeira && c.primeira.startsWith(mes) }));
    return lista.sort((p, q) => (q.proxima || q.ultima || '').localeCompare(p.proxima || p.ultima || '') || p.nome.localeCompare(q.nome));
  },
  v_clientes() {
    if (this.cliAba === 'fidelidade') return this.v_fidelidade();
    const lista = this.dadosClientes();
    const filtros = { todos: ['Todos', () => true], marcados: ['Com horário marcado', c => c.proxima], sumidos: ['Sumidos (30+ dias)', c => c.sumido], novos: ['Novos no mês', c => c.novo] };
    return `<div class="topo"><div><h1>${this.eu() ? 'Meus clientes' : 'Clientes'}</h1><p class="sub">${lista.length} clientes · toque em um para ver o histórico</p></div></div>
      ${this.abasClientes()}
      <div class="barra-filtros">
        <label class="busca campo"><span class="sr">Buscar</span>${ic('busca')}<input id="busca-cli" type="search" placeholder="Buscar por nome ou telefone" value="${esc(this.cliBusca)}"></label>
        <div class="fichas">${Object.entries(filtros).map(([k, [rot, f]]) => `<button class="ficha ${this.cliFiltro === k ? 'on' : ''}" data-a="filtro-cli" data-v="${k}">${rot} <span class="cont">${lista.filter(f).length}</span></button>`).join('')}</div>
      </div>
      ${this.cliFiltro === 'sumidos' ? `<div class="aviso-faixa info">${ic('info')}<span>Clientes que não voltam há mais de 30 dias e não têm horário marcado. Mande uma mensagem chamando de volta.</span></div>` : ''}
      <div class="card" style="padding:6px 14px"><div class="linhas" id="lista-cli">${this.linhasClientes(lista, filtros)}</div></div>`;
  },
  linhasClientes(lista, filtros) {
    const f = filtros[this.cliFiltro]?.[1] || (() => true), busca = semAcento(this.cliBusca), dig = soDigitos(this.cliBusca), hoje = Datas.hoje();
    const res = lista.filter(c => f(c) && (!busca || semAcento(c.nome).includes(busca) || (dig.length >= 3 && (c.tel || '').includes(dig))));
    if (!res.length) return UI.vazio('usuarios', 'Nenhum cliente encontrado');
    const mostra = res.slice(0, 150);
    const progs = Fidelidade.programas(this.b);
    return mostra.map(c => {
      const info = c.proxima ? `Próximo: ${Datas.relativa(c.proxima)}` : c.ultima ? `Última visita há ${Datas.diff(hoje, c.ultima)} dia${Datas.diff(hoje, c.ultima) === 1 ? '' : 's'}` : 'Ainda não veio';
      const mens = c.tel && Mensal.doTelefone(this.b, c.tel);
      const fid = c.tel && c.visitas ? progs.map(p => ({ p, pos: Fidelidade.posicao(this.b, p, c.tel, hoje, Datas.agoraMin()) })).find(x => x.pos.feitas) : null;
      const selos = `${mens ? UI.badge('Mensalista', 'destaque', 'coroa') : ''}${fid ? UI.badge(fid.pos.ganhaAgora ? 'Prêmio no próximo' : `${fid.pos.noCiclo}/${fid.p.a_cada}`, fid.pos.ganhaAgora ? 'ok' : 'neutro', 'estrela') : ''}`;
      return `<div class="linha clicavel" data-a="ver-cli" data-k="${esc(c.k)}">${UI.avatar(c.nome, null, '#57514a')}
        <div class="linha-txt"><b>${esc(c.nome)} ${selos}</b><small>${esc(fmtTel(c.tel) || 'sem telefone')} · ${c.visitas} visita${c.visitas === 1 ? '' : 's'}${c.faltas ? ` · ${c.faltas} falta${c.faltas > 1 ? 's' : ''}` : ''}</small></div>
        <div class="linha-fim"><b>${dinheiro(c.gasto)}</b><small class="muted" style="font-size:12.5px">${esc(info)}</small></div></div>`;
    }).join('') + (res.length > mostra.length ? `<p class="ajuda" style="padding:12px 4px">Mostrando ${mostra.length} de ${res.length}. Use a busca para achar os outros.</p>` : '');
  },
  verCliente(k) {
    const b = this.b, eu = this.eu();
    const c = this.dadosClientes().find(x => x.k === k);
    if (!c) return;
    const ags = Store.de('agendamentos', b.id).filter(a => (c.tel ? a.cliente_tel === c.tel : a.cliente_nome === c.nome) && (!eu || a.barbeiro_id === eu.id)).sort((p, q) => q.data.localeCompare(p.data) || q.ini - p.ini);
    const volta = `Oi, ${primeiroNome(c.nome)}! Tudo certo? Aqui é da equipe ${b.nome}. Faz um tempinho que você não vem nos ver. Que tal marcar um horário? É rapidinho pelo link: ${UI.linkCliente(b)}`;
    const m = UI.modal({
      titulo: c.nome,
      corpo: `<div class="metricas-mini" style="margin-bottom:16px"><div><small>Visitas</small><b>${c.visitas}</b></div><div><small>Gasto total</small><b>${dinheiro(c.gasto)}</b></div><div><small>Ticket médio</small><b>${dinheiro(c.visitas ? c.gasto / c.visitas : 0)}</b></div><div><small>Faltas</small><b>${c.faltas}</b></div></div>
        <div class="linhas">${ags.slice(0, 40).map(a => `<div class="linha"><div class="linha-txt"><b>${Datas.br(a.data)} · ${Datas.hhmm(a.ini)}</b><small>${esc(a.servicos.map(s => s.nome).join(' + '))} · ${esc(primeiroNome(Store.get('barbeiros', a.barbeiro_id)?.nome))}</small></div><div class="linha-fim">${this.badgeAg(a)}<b>${dinheiro(a.status === 'concluido' ? a.total_pago ?? a.total : a.total)}</b></div></div>`).join('') || '<p class="muted">Sem atendimentos ainda.</p>'}</div>`,
      rodape: `${c.tel ? `<a class="btn esq" href="${linkWhats(c.tel, c.sumido ? volta : '')}" target="_blank" rel="noopener">${ic('mensagem')} ${c.sumido ? 'Chamar de volta' : 'WhatsApp'}</a>` : ''}<button class="btn pri" id="agendar-cli">${ic('calendario-mais')} Agendar</button>`
    });
    $('#agendar-cli', m.el).onclick = () => { m.fechar(); this.formAg({ cliente: { nome: c.nome, telefone: c.tel } }); };
  },

  /* ============================ CATÁLOGO ============================ */
  v_catalogo() {
    const b = this.b, tipo = this.catAba;
    const itens = (tipo === 'servicos' ? Store.de('servicos', b.id) : Store.de('produtos', b.id)).sort((p, q) => (p.ordem ?? 0) - (q.ordem ?? 0) || p.nome.localeCompare(q.nome));
    return `<div class="topo"><div><h1>Catálogo</h1><p class="sub">O que aparece para o cliente no agendamento</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="novo-item">${ic('mais')} ${tipo === 'servicos' ? 'Novo serviço' : 'Novo produto'}</button></div></div>
      <div class="barra-filtros"><div class="seg"><a class="btn fantasma peq ${tipo === 'servicos' ? 'on' : ''}" href="${this.h('catalogo/servicos')}" style="${tipo === 'servicos' ? 'background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.1)' : ''}">${ic('tesoura')} Serviços</a><a class="btn fantasma peq ${tipo === 'produtos' ? 'on' : ''}" href="${this.h('catalogo/produtos')}" style="${tipo === 'produtos' ? 'background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.1)' : ''}">${ic('sacola')} Produtos</a></div></div>
      ${itens.length ? `<div class="cat-grade">${itens.map(it => `
        <button class="cat-card ${it.ativo === false ? 'inativo' : ''}" data-a="editar-item" data-id="${it.id}">
          <div class="cat-foto">${UI.capa(it, tipo === 'servicos' ? 'servico' : 'produto')}${it.ativo === false ? UI.badge('Inativo', 'neutro') : tipo === 'servicos' && it.online === false ? UI.badge('Só no balcão', 'neutro') : tipo === 'produtos' && it.estoque != null && it.estoque <= 3 ? UI.badge(it.estoque ? `Restam ${it.estoque}` : 'Sem estoque', 'alerta') : ''}</div>
          <div class="cat-txt"><b>${esc(it.nome)}</b><p>${esc(it.descricao || '')}</p>
            <div class="cat-rodape"><b>${dinheiro(it.preco)}</b><small>${tipo === 'servicos' ? `${ic('relogio')} ${duracaoTxt(it.duracao)}` : it.estoque != null ? `${it.estoque} em estoque` : ''}</small></div></div>
        </button>`).join('')}</div>`
        : `<div class="card">${UI.vazio(tipo === 'servicos' ? 'tesoura' : 'sacola', tipo === 'servicos' ? 'Nenhum serviço ainda' : 'Nenhum produto ainda', 'Cadastre com foto, descrição e preço.', `<button class="btn pri" data-a="novo-item">${ic('mais')} Cadastrar</button>`)}</div>`}`;
  },
  formItem(id) {
    const b = this.b, tipo = this.catAba, tabela = tipo === 'servicos' ? 'servicos' : 'produtos', ehSv = tipo === 'servicos';
    const it = id ? Store.get(tabela, id) : null;
    let foto = it?.foto || null;
    const duracoes = [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240];
    const m = UI.modal({
      titulo: it ? `Editar ${ehSv ? 'serviço' : 'produto'}` : ehSv ? 'Novo serviço' : 'Novo produto', fixo: true,
      corpo: `<form id="f-item" class="pilha">
        <div class="campo"><span>Foto</span><div class="foto-campo"><div class="foto-prev" id="foto-prev">${UI.capa({ foto, categoria: it?.categoria }, ehSv ? 'servico' : 'produto')}</div>
          <div class="acoes"><button type="button" class="btn peq" data-a2="foto">${ic('imagem')} Escolher foto</button><button type="button" class="btn peq fantasma" data-a2="sem-foto">Remover</button><input type="file" accept="image/*" id="arq-foto"></div></div></div>
        <label class="campo"><span>Nome</span><input name="nome" value="${esc(it?.nome || '')}" placeholder="${ehSv ? 'Ex.: Corte degradê' : 'Ex.: Pomada modeladora'}" autofocus></label>
        <label class="campo"><span>Descrição</span><textarea name="descricao" rows="2" placeholder="O que está incluso, tamanho, detalhes…">${esc(it?.descricao || '')}</textarea></label>
        <div class="grade-form">
          <label class="campo"><span>Preço (R$)</span><input name="preco" inputmode="decimal" value="${it ? numBR(it.preco) : ''}" placeholder="0,00"></label>
          ${ehSv ? `<label class="campo"><span>Duração</span><select name="duracao">${duracoes.map(d => `<option value="${d}" ${(it?.duracao || 30) === d ? 'selected' : ''}>${duracaoTxt(d)}</option>`).join('')}</select></label>
            <label class="campo"><span>Categoria</span><select name="categoria">${CATEGORIAS.map(c => `<option ${(it?.categoria || 'Cabelo') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <div class="campo" style="justify-content:flex-end"><label class="chave"><input type="checkbox" name="online" ${it?.online !== false ? 'checked' : ''}><i></i>Cliente pode agendar online</label></div>`
          : `<label class="campo"><span>Estoque <small>(opcional)</small></span><input name="estoque" type="number" min="0" value="${it?.estoque ?? ''}" placeholder="Não controlar"></label>`}
        </div>
        <label class="chave"><input type="checkbox" name="ativo" ${it?.ativo !== false ? 'checked' : ''}><i></i>Ativo (aparece no catálogo)</label>
      </form>`,
      rodape: `${it ? `<button class="btn perigo-txt esq" id="del-item">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-item">${ic('check')} Salvar</button>`
    });
    const f = $('#f-item', m.el), arq = $('#arq-foto', m.el);
    const prev = () => { $('#foto-prev', m.el).innerHTML = UI.capa({ foto, categoria: f.categoria?.value }, ehSv ? 'servico' : 'produto'); };
    m.el.onclick = e => {
      const a = e.target.closest('[data-a2]')?.dataset.a2;
      if (a === 'foto') arq.click();
      if (a === 'sem-foto') { foto = null; prev(); }
    };
    arq.onchange = async () => { try { foto = await UI.lerFoto(arq.files[0]); prev(); } catch (err) { UI.erro(err); } arq.value = ''; };
    if (f.categoria) f.categoria.onchange = prev;
    $('#salvar-item', m.el).onclick = async () => {
      try {
        const d = UI.form(f);
        if (!d.nome) throw new Error('Dê um nome.');
        const preco = lerDinheiro(d.preco);
        if (!(preco >= 0)) throw new Error('Confira o preço.');
        const reg = { ...(it ? { id } : { barbearia_id: b.id, ordem: Store.de(tabela, b.id).length }), nome: d.nome, descricao: d.descricao, preco, foto, ativo: f.ativo.checked };
        if (ehSv) Object.assign(reg, { duracao: Number(d.duracao), categoria: d.categoria, online: f.online.checked });
        else reg.estoque = d.estoque === '' ? null : Math.max(0, Number(d.estoque));
        await Store.salvar(tabela, reg);
        UI.toast('Salvo.');
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
    const del = $('#del-item', m.el);
    if (del) del.onclick = async () => {
      if (!await UI.confirmar(`Excluir <b>${esc(it.nome)}</b>? Os agendamentos já feitos continuam com o registro. Se for só por um tempo, prefira desativar.`, { titulo: 'Excluir', ok: 'Excluir', perigo: true })) return;
      await Store.remover(tabela, id);
      m.fechar();
      this.pintar();
    };
  },

  /* ============================ EQUIPE ============================ */
  v_equipe() {
    const b = this.b, plano = Store.get('planos', b.plano_id);
    const todos = Store.de('barbeiros', b.id).sort((p, q) => (p.ativo === false) - (q.ativo === false) || (p.ordem ?? 0) - (q.ordem ?? 0));
    const ativos = todos.filter(x => x.ativo !== false).length;
    const hoje = Datas.hoje(), mes = Datas.mes(hoje);
    const nSv = Agenda.servicos(b).length;
    return `<div class="topo"><div><h1>Equipe</h1><p class="sub">${ativos} profissiona${ativos === 1 ? 'l' : 'is'} ativo${ativos === 1 ? '' : 's'}${plano?.max_barbeiros ? ` · seu plano ${esc(plano.nome)} permite até ${plano.max_barbeiros}` : ''}</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="novo-barb">${ic('mais')} Novo profissional</button></div></div>
      <div class="equipe-grade">${todos.map(x => {
        const hojeN = Store.de('agendamentos', b.id).filter(a => a.barbeiro_id === x.id && a.data === hoje && a.status !== 'cancelado').length;
        const fat = Financeiro.resumo(b, mes + '-01', hoje, x.id);
        return `<button class="membro ${x.ativo === false ? 'inativo' : ''}" data-a="editar-barb" data-id="${x.id}">
          <div class="membro-topo">${UI.avatar(x.nome, x.foto, x.cor, 'g')}<div><b>${esc(x.nome)}</b><small>${esc(fmtTel(x.telefone) || 'sem telefone')}</small></div>${x.ativo === false ? UI.badge('Inativo', 'neutro') : ''}</div>
          <div class="membro-dados">
            <span>Hoje<b>${hojeN} agendamento${hojeN === 1 ? '' : 's'}</b></span>
            <span>No mês<b>${dinheiro(fat.total)}</b></span>
            <span>Comissão<b>${x.comissao || 0}% · ${dinheiro(fat.comissao)}</b></span>
            <span>Serviços<b>${!x.servicos?.length ? 'Todos' : `${x.servicos.length} de ${nSv}`}</b></span>
            <span style="grid-column:1/-1">Dias<b>${esc(UI.resumoHorario(x.horario))}</b></span>
          </div></button>`;
      }).join('')}</div>`;
  },
  formBarbeiro(id) {
    const b = this.b, x = id ? Store.get('barbeiros', id) : null, plano = Store.get('planos', b.plano_id);
    const svs = Agenda.servicos(b);
    const ativos = Store.de('barbeiros', b.id).filter(o => o.ativo !== false && o.id !== id).length;
    if (!x && plano?.max_barbeiros && ativos >= plano.max_barbeiros) {
      return UI.toast(`Seu plano ${plano.nome} permite até ${plano.max_barbeiros} profissiona${plano.max_barbeiros > 1 ? 'is' : 'l'}. Fale com o suporte para mudar de plano.`, 'erro');
    }
    let foto = x?.foto || null;
    const cores = ['#c9a227', '#0e9f8e', '#6d5bd0', '#d9480f', '#2563eb', '#db2777', '#16a34a', '#57534e'];
    const cor = x?.cor || cores[Store.de('barbeiros', b.id).length % cores.length];
    const m = UI.modal({
      titulo: x ? 'Editar profissional' : 'Novo profissional', classe: 'largo', fixo: true,
      corpo: `<form id="f-barb">
        <div class="foto-campo" style="margin-bottom:16px"><div class="foto-prev redonda" id="foto-prev">${UI.avatar(x?.nome || '?', foto, cor, 'gg')}</div>
          <div class="acoes"><button type="button" class="btn peq" data-a2="foto">${ic('imagem')} Escolher foto</button><button type="button" class="btn peq fantasma" data-a2="sem-foto">Remover</button><input type="file" accept="image/*" id="arq-foto"></div></div>
        <div class="grade-form">
          <label class="campo"><span>Nome</span><input name="nome" value="${esc(x?.nome || '')}" autofocus></label>
          <label class="campo"><span>WhatsApp</span><input name="telefone" data-tel inputmode="tel" value="${esc(fmtTel(x?.telefone || ''))}"></label>
          <label class="campo"><span>PIN de acesso (4 números)</span><input name="pin" data-pin inputmode="numeric" value="${esc(x?.pin || pinAleatorio())}"><small>Ele entra no painel e vê só a agenda dele.</small></label>
          <label class="campo"><span>Comissão sobre serviços (%)</span><input name="comissao" type="number" min="0" max="100" value="${x?.comissao ?? 50}"></label>
          <div class="campo inteiro"><span>Cor na agenda</span><div class="cores">${cores.map(c => `<button type="button" class="cor-op ${c === cor ? 'on' : ''}" style="background:${c}" data-cor="${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="hidden" name="cor" value="${cor}"></div></div>
          <div class="campo inteiro"><span>Serviços que faz</span><div class="opcoes-grade">${svs.map(s => `<label class="op-btn" style="cursor:pointer"><input type="checkbox" name="sv" value="${s.id}" ${!x?.servicos?.length || x.servicos.includes(s.id) ? 'checked' : ''} style="accent-color:var(--accent)"> ${esc(s.nome)}</label>`).join('')}</div></div>
          <div class="campo inteiro"><label class="chave"><input type="checkbox" name="proprio" ${x?.horario ? 'checked' : ''}><i></i>Tem horário próprio (diferente do horário do estabelecimento)</label>
            <div id="hor-barb" ${x?.horario ? '' : 'hidden'} style="margin-top:10px">${UI.horarioEditor(x?.horario || b.horario, 'hb')}</div></div>
          <div class="campo inteiro"><label class="chave"><input type="checkbox" name="ativo" ${x?.ativo !== false ? 'checked' : ''}><i></i>Ativo (aparece na agenda e no agendamento)</label></div>
        </div></form>`,
      rodape: `${x ? `<button class="btn perigo-txt esq" id="del-barb">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-barb">${ic('check')} Salvar</button>`
    });
    const f = $('#f-barb', m.el), arq = $('#arq-foto', m.el);
    const prev = () => { $('#foto-prev', m.el).innerHTML = UI.avatar(f.nome.value || '?', foto, f.cor.value, 'gg'); };
    m.el.onclick = e => {
      const a = e.target.closest('[data-a2]')?.dataset.a2, c = e.target.closest('[data-cor]');
      if (a === 'foto') arq.click();
      if (a === 'sem-foto') { foto = null; prev(); }
      if (c) { f.cor.value = c.dataset.cor; $$('.cor-op', m.el).forEach(o => o.classList.toggle('on', o === c)); prev(); }
    };
    f.nome.oninput = prev;
    f.proprio.onchange = () => { $('#hor-barb', m.el).hidden = !f.proprio.checked; };
    arq.onchange = async () => { try { foto = await UI.lerFoto(arq.files[0], { max: 320 }); prev(); } catch (err) { UI.erro(err); } arq.value = ''; };
    $('#salvar-barb', m.el).onclick = async () => {
      try {
        const nome = f.nome.value.trim();
        if (!nome) throw new Error('Informe o nome.');
        if (!/^\d{4}$/.test(f.pin.value)) throw new Error('O PIN precisa ter 4 números.');
        const marcados = $$('[name=sv]:checked', m.el).map(i => i.value);
        if (!marcados.length) throw new Error('Marque pelo menos um serviço.');
        if (f.ativo.checked && x?.ativo === false && plano?.max_barbeiros && ativos >= plano.max_barbeiros) throw new Error(`Seu plano permite até ${plano.max_barbeiros} profissionais ativos.`);
        const horario = f.proprio.checked ? UI.lerHorario(f, 'hb') : null;
        await Store.salvar('barbeiros', {
          ...(x ? { id } : { barbearia_id: b.id, ordem: Store.de('barbeiros', b.id).length }),
          nome, telefone: soDigitos(f.telefone.value), pin: f.pin.value, comissao: Math.min(100, Math.max(0, Number(f.comissao.value) || 0)),
          cor: f.cor.value, foto, servicos: marcados.length === svs.length ? [] : marcados, horario, ativo: f.ativo.checked
        });
        UI.toast('Profissional salvo.');
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
    const del = $('#del-barb', m.el);
    if (del) del.onclick = async () => {
      const futuros = Store.de('agendamentos', b.id).filter(a => a.barbeiro_id === id && a.status === 'confirmado' && a.data >= Datas.hoje()).length;
      if (futuros) return UI.toast(`${x.nome} tem ${futuros} agendamento${futuros > 1 ? 's' : ''} marcado${futuros > 1 ? 's' : ''}. Remarque ou desative em vez de excluir.`, 'erro');
      if (!await UI.confirmar(`Excluir <b>${esc(x.nome)}</b>? O histórico de atendimentos continua no faturamento.`, { titulo: 'Excluir profissional', ok: 'Excluir', perigo: true })) return;
      await Store.remover('barbeiros', id);
      m.fechar();
      this.pintar();
    };
  },

  /* ============================ FATURAMENTO ============================ */
  intervalo() {
    const hoje = Datas.hoje(), mes = Datas.mes(hoje);
    switch (this.periodo) {
      case 'hoje': return [hoje, hoje];
      case '7d': return [Datas.soma(hoje, -6), hoje];
      case 'mesant': { const m = Datas.somaMes(mes, -1); return [m + '-01', `${m}-${pad(Datas.diasNoMes(m))}`]; }
      case 'custom': return [this.de || mes + '-01', this.ate || hoje];
      default: return [mes + '-01', hoje];
    }
  },
  v_faturamento() {
    const b = this.b, eu = this.eu();
    const [de, ate] = this.intervalo();
    const barbId = eu ? eu.id : this.fBarbeiro || null;
    const r = Financeiro.resumo(b, de, ate, barbId);
    const barbs = Store.de('barbeiros', b.id);
    const nome = id => primeiroNome(barbs.find(x => x.id === id)?.nome) || 'Balcão';
    const periodos = { hoje: 'Hoje', '7d': '7 dias', mes: 'Este mês', mesant: 'Mês passado', custom: 'Escolher datas' };
    // gráfico: por hora (um dia), por dia (até 62 dias) ou por mês
    const dias = Datas.diff(ate, de) + 1;
    let graf, tituloGraf;
    if (dias === 1) {
      const porHora = {};
      for (const m of r.movs) { const h = Math.floor(m.hora / 60); porHora[h] = (porHora[h] || 0) + m.total; }
      graf = [...Array(14)].map((_, i) => i + 8).map(h => ({ rot: `${h}h`, valor: porHora[h] || 0, dica: `${h}h às ${h + 1}h` }));
      tituloGraf = 'Faturamento por hora';
    } else if (dias <= 62) {
      graf = [...Array(dias)].map((_, i) => Datas.soma(de, i)).map(d => ({ rot: Datas.brCurta(d), valor: r.porDia[d] || 0, dica: cap(Datas.curta(d)) }));
      tituloGraf = 'Faturamento por dia';
    } else {
      const porMes = {};
      for (const [d, v] of Object.entries(r.porDia)) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + v;
      const meses = []; for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = Datas.somaMes(m, 1)) meses.push(m);
      graf = meses.map(m => ({ rot: Datas.mesCurto(m), valor: porMes[m] || 0, dica: cap(Datas.nomeMes(m)) }));
      tituloGraf = 'Faturamento por mês';
    }
    const cada = graf.length > 16 ? Math.ceil(graf.length / 10) : 1;
    const kpi = (rot, val, sub = '', icone = '', cls = '') => `<div class="kpi ${cls}"><small>${icone ? ic(icone) : ''}${rot}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
    const porBarb = Object.entries(r.porBarbeiro).sort((p, q) => q[1].total - p[1].total);
    const topSv = Object.entries(r.porServico).sort((p, q) => q[1].valor - p[1].valor).slice(0, 6);
    const topPd = Object.entries(r.porProduto).sort((p, q) => q[1].valor - p[1].valor).slice(0, 6);
    return `<div class="topo"><div><h1>${eu ? 'Meus ganhos' : 'Faturamento'}</h1><p class="sub">${de === ate ? cap(Datas.longa(de)) : `${Datas.br(de)} a ${Datas.br(ate)}`}</p></div>
        <div class="topo-acoes"><button class="btn" data-a="exportar-fat">${ic('baixar')} Planilha</button><button class="btn pri" data-a="venda">${ic('sacola')} Registrar venda</button></div></div>
      <div class="barra-filtros">
        <div class="fichas">${Object.entries(periodos).map(([k, v]) => `<button class="ficha ${this.periodo === k ? 'on' : ''}" data-a="periodo" data-v="${k}">${v}</button>`).join('')}</div>
        ${this.periodo === 'custom' ? `<input type="date" class="entrada" style="width:auto" id="fat-de" value="${de}"><span class="muted">até</span><input type="date" class="entrada" style="width:auto" id="fat-ate" value="${ate}">` : ''}
        ${!eu && barbs.length > 1 ? `<select class="entrada" style="width:auto" id="fat-barb"><option value="">Toda a equipe</option>${barbs.map(x => `<option value="${x.id}" ${this.fBarbeiro === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>` : ''}
      </div>
      ${r.semBaixa ? `<div class="aviso-faixa">${ic('alerta')}<span>${r.semBaixa} atendimento${r.semBaixa > 1 ? 's' : ''} do período ainda sem baixa não ${r.semBaixa > 1 ? 'entram' : 'entra'} na conta. Feche o dia na agenda.</span></div>` : ''}
      <p class="ajuda" style="margin:-4px 0 12px">Conta só o que foi realizado: atendimentos concluídos, vendas, mensalidades pagas e faltas em que o valor pago antecipado ficou com o estabelecimento.</p>
      <div class="kpis">
        ${eu ? kpi('Sua comissão', dinheiro(r.comissao), `${eu.comissao || 0}% sobre os serviços`, 'carteira', 'destaque') + kpi('Faturado por você', dinheiro(r.total), '', 'subindo')
             : kpi('Faturamento', dinheiro(r.total), `${r.atendimentos} atendimento${r.atendimentos === 1 ? '' : 's'}${r.vendas ? ` + ${r.vendas} venda${r.vendas > 1 ? 's' : ''}` : ''}`, 'subindo', 'destaque') + kpi('Comissões da equipe', dinheiro(r.comissao), `sobra ${dinheiro(r.total - r.comissao)}`, 'usuarios')}
        ${kpi('Serviços', dinheiro(r.servicos), '', 'tesoura')}
        ${kpi('Produtos', dinheiro(r.produtos), '', 'sacola')}
        ${kpi('Ticket médio', dinheiro(r.ticket), 'por atendimento', 'recibo')}
        ${kpi('Agendado a receber', dinheiro(r.previsto), 'horários futuros no período', 'calendario')}
        ${kpi('Faltas', String(r.faltas), `${r.cancelados} cancelamento${r.cancelados === 1 ? '' : 's'}${r.faltasPagas ? ` · ${dinheiro(r.faltasPagas)} retidos` : ''}`, 'usuario-x')}
        ${r.mensalidades ? kpi('Mensalidades recebidas', dinheiro(r.mensalidades), 'dos planos mensais', 'coroa') : ''}
        ${r.app ? kpi('Recebido pelo app', dinheiro(r.app), 'PIX e cartão antecipados', 'cartao') : ''}
      </div>
      <div class="card"><div class="card-cab"><div><h3>${tituloGraf}</h3><p>Passe o dedo ou o mouse nas barras para ver o valor</p></div></div>${r.total ? UI.barras(graf, { cada }) : UI.vazio('grafico', 'Nada faturado nesse período')}</div>
      <div class="duas-col" style="margin-top:14px">
        ${!eu && !this.fBarbeiro ? `<div class="card"><div class="card-cab"><h3>Por profissional</h3></div>${porBarb.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Profissional</th><th class="num">Atend.</th><th class="num">Serviços</th><th class="num">Produtos</th><th class="num">Total</th><th class="num">Comissão</th></tr></thead><tbody>
          ${porBarb.map(([id, v]) => `<tr><td>${esc(nome(id === '-' ? null : id))}</td><td class="num">${v.atendimentos}</td><td class="num">${dinheiro(v.servicos)}</td><td class="num">${dinheiro(v.produtos)}</td><td class="num"><b>${dinheiro(v.total)}</b></td><td class="num">${dinheiro(v.comissao)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">Sem dados.</p>'}</div>` : `<div class="card"><div class="card-cab"><h3>Serviços que mais renderam</h3></div>${topSv.length ? UI.partes(topSv.map(([n, v]) => ({ rot: n, valor: v.valor, extra: `${v.qtd}×` }))) : '<p class="muted">Sem dados.</p>'}</div>`}
        <div class="card"><div class="card-cab"><h3>Formas de pagamento</h3></div>${Object.keys(r.porForma).length ? UI.partes(Object.entries(r.porForma).sort((p, q) => q[1] - p[1]).map(([k, v]) => ({ rot: FORMAS_PAGAMENTO[k] || k, valor: v }))) : '<p class="muted">Sem dados.</p>'}</div>
      </div>
      <div class="duas-col" style="margin-top:14px">
        ${!eu && !this.fBarbeiro ? `<div class="card"><div class="card-cab"><h3>Serviços que mais renderam</h3></div>${topSv.length ? UI.partes(topSv.map(([n, v]) => ({ rot: n, valor: v.valor, extra: `${v.qtd}×` }))) : '<p class="muted">Sem dados.</p>'}</div>` : ''}
        <div class="card"><div class="card-cab"><h3>Produtos vendidos</h3></div>${topPd.length ? UI.partes(topPd.map(([n, v]) => ({ rot: n, valor: v.valor, extra: `${v.qtd} un.` }))) : '<p class="muted">Nenhum produto vendido no período.</p>'}</div>
      </div>
      <div class="card" style="margin-top:14px"><div class="card-cab"><div><h3>Movimentações</h3><p>${r.movs.length} lançamento${r.movs.length === 1 ? '' : 's'} no período${r.movs.length > 60 ? ' · mostrando os 60 mais recentes' : ''}</p></div></div>
        ${r.movs.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Cliente</th><th>O que foi feito</th>${eu ? '' : '<th>Profissional</th>'}<th>Pagamento</th><th class="num">Valor</th></tr></thead><tbody>
        ${r.movs.slice(0, 60).map(mv => `<tr><td>${Datas.brCurta(mv.data)} <small>${Datas.hhmm(mv.hora)}</small></td><td>${esc(mv.cliente)}</td><td>${esc(mv.descricao)}${mv.prods.length && mv.tipo === 'atendimento' ? `<small>+ ${esc(mv.prods.map(p => p.nome).join(', '))}</small>` : ''}</td>${eu ? '' : `<td>${esc(nome(mv.barbeiro_id))}</td>`}<td>${esc(FORMAS_PAGAMENTO[mv.forma] || mv.forma)}</td><td class="num"><b>${dinheiro(mv.total)}</b></td></tr>`).join('')}
        </tbody></table></div>` : UI.vazio('recibo', 'Nenhuma movimentação')}</div>`;
  },
  formVenda() {
    const b = this.b, eu = this.eu();
    const prods = Agenda.produtos(b).map(p => { const pr = Promocoes.precoProduto(b, p); return { ...p, preco: pr.preco, original: pr.original, promo: pr.promo }; });
    if (!prods.length) return UI.toast('Cadastre produtos no Catálogo primeiro.', 'erro');
    const qtd = {};
    let forma = 'pix';
    const m = UI.modal({
      titulo: 'Registrar venda', fixo: true, corpo: '<div id="venda"></div>',
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ok" id="salvar-venda">${ic('check')} Registrar</button>`
    });
    const total = () => soma(prods, p => (qtd[p.id] || 0) * p.preco);
    const desenhar = () => {
      $('#venda', m.el).innerHTML = `<div class="itens-conta">${prods.map(p => `<div class="item-conta"><span>${esc(p.nome)}<small class="muted" style="display:block;font-size:12px">${p.promo ? `<s>${dinheiro(p.original)}</s> ${dinheiro(p.preco)} (${esc(p.promo.nome)})` : dinheiro(p.preco)}${p.estoque != null ? ` · ${p.estoque} em estoque` : ''}</small></span>
          <span class="qtd"><button type="button" data-q="${p.id}" data-d="-1" aria-label="Menos">${ic('menos')}</button><span>${qtd[p.id] || 0}</span><button type="button" data-q="${p.id}" data-d="1" aria-label="Mais">${ic('mais')}</button></span></div>`).join('')}</div>
        <div class="grade-form" style="margin-top:14px"><label class="campo"><span>Cliente <small>(opcional)</small></span><input id="venda-cli" placeholder="Venda no balcão"></label>
          <label class="campo"><span>Vendido por</span><select id="venda-barb" ${eu ? 'disabled' : ''}>${eu ? `<option value="${eu.id}">${esc(eu.nome)}</option>` : `<option value="">Balcão</option>${Agenda.barbeiros(b).map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}`}</select></label></div>
        <div class="opcoes-grade" style="margin-top:14px">${Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => `<button type="button" class="op-btn ${forma === k ? 'on' : ''}" data-forma="${k}">${v}</button>`).join('')}</div>
        <div class="total-grande"><span>Total</span><b>${dinheiro(total())}</b></div>`;
    };
    desenhar();
    m.el.onclick = e => {
      const q = e.target.closest('[data-q]'), fm = e.target.closest('[data-forma]');
      const cli = $('#venda-cli', m.el)?.value, bb = $('#venda-barb', m.el)?.value;
      if (q) qtd[q.dataset.q] = Math.max(0, (qtd[q.dataset.q] || 0) + Number(q.dataset.d));
      if (fm) forma = fm.dataset.forma;
      if (q || fm) { desenhar(); $('#venda-cli', m.el).value = cli || ''; $('#venda-barb', m.el).value = bb || ''; }
    };
    $('#salvar-venda', m.el).onclick = async () => {
      try {
        const itens = prods.filter(p => qtd[p.id] > 0).map(p => ({ id: p.id, nome: p.nome, preco: p.preco, qtd: qtd[p.id] }));
        if (!itens.length) throw new Error('Escolha pelo menos um produto.');
        const agora = new Date();
        await Store.salvar('vendas', {
          barbearia_id: b.id, barbeiro_id: eu ? eu.id : $('#venda-barb', m.el).value || null, data: Datas.hoje(), hora: agora.getHours() * 60 + agora.getMinutes(),
          cliente: $('#venda-cli', m.el).value.trim() || 'Venda no balcão', itens, total: total(), forma
        });
        for (const i of itens) this.mexerEstoque(i.id, -i.qtd);
        UI.toast(`Venda registrada · ${dinheiro(total())}`);
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  exportarFat() {
    const [de, ate] = this.intervalo(), eu = this.eu();
    const r = Financeiro.resumo(this.b, de, ate, eu ? eu.id : this.fBarbeiro || null);
    const barbs = Store.de('barbeiros', this.b.id);
    const cel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [['Data', 'Hora', 'Tipo', 'Cliente', 'Descrição', 'Profissional', 'Pagamento', 'Serviços', 'Produtos', 'Total']]
      .concat(r.movs.map(m => [Datas.br(m.data), Datas.hhmm(m.hora), m.tipo === 'venda' ? 'Venda' : 'Atendimento', m.cliente, m.descricao, barbs.find(x => x.id === m.barbeiro_id)?.nome || '', FORMAS_PAGAMENTO[m.forma] || m.forma, numBR(m.servicos), numBR(m.produtos), numBR(m.total)]));
    UI.baixar(`faturamento-${this.b.slug}-${de}-a-${ate}.csv`, '﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  },

  /* ============================ AJUSTES ============================ */
  v_ajustes() {
    const b = this.b, s = Cobranca.situacao(b), plano = Store.get('planos', b.plano_id), cfg = Store.db.config;
    const link = UI.linkCliente(b);
    const cores = ['#c9a227', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#2563eb', '#0e9f8e', '#16a34a', '#78716c'];
    const sel = (nome, atual, ops) => `<select name="${nome}">${ops.map(([v, t]) => `<option value="${v}" ${String(atual) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const cobs = Store.de('cobrancas', b.id).sort((p, q) => q.vencimento.localeCompare(p.vencimento)).slice(0, 6);
    this._logo = b.logo;
    return `<div class="topo"><div><h1>Ajustes</h1><p class="sub">Como o seu estabelecimento aparece e funciona</p></div></div>
      <form id="f-aj" class="pilha" style="max-width:860px">
        <div class="card"><div class="card-cab"><div><h3>Seu link de agendamento</h3><p>Coloque na bio do Instagram, no status do WhatsApp e no Google</p></div></div>
          <div class="link-caixa"><code>${esc(link)}</code><button type="button" class="btn peq" data-a="copiar" data-v="${esc(link)}">${ic('copiar')} Copiar</button></div>
          <div class="acoes" style="margin-top:10px"><a class="btn peq" href="#/${esc(b.slug)}" target="_blank">${ic('externo')} Abrir</a><a class="btn peq" href="https://wa.me/?text=${encodeURIComponent(`Agende seu horário em ${b.nome} pelo link: ${link}`)}" target="_blank" rel="noopener">${ic('compartilhar')} Enviar no WhatsApp</a></div></div>
        <div class="card"><div class="card-cab"><h3>Dados do estabelecimento</h3></div><div class="grade-form">
          <div class="campo inteiro"><span>Logo</span><div class="foto-campo"><div class="foto-prev redonda" id="logo-prev">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : UI.capa({}, 'servico')}</div>
            <div class="acoes"><button type="button" class="btn peq" data-a="logo">${ic('imagem')} Escolher logo</button><button type="button" class="btn peq fantasma" data-a="sem-logo">Remover</button><input type="file" accept="image/*" id="arq-logo"></div></div></div>
          <label class="campo"><span>Nome</span><input name="nome" value="${esc(b.nome)}"></label>
          <label class="campo"><span>WhatsApp do estabelecimento</span><input name="whatsapp" data-tel inputmode="tel" value="${esc(fmtTel(b.whatsapp))}"></label>
          <label class="campo inteiro"><span>Endereço</span><input name="endereco" value="${esc(b.endereco)}"></label>
          <label class="campo"><span>Link do Google Maps <small>(opcional)</small></span><input name="maps_url" value="${esc(b.maps_url)}" placeholder="https://maps.app.goo.gl/…"></label>
          <label class="campo"><span>Instagram</span><input name="instagram" value="${esc(b.instagram)}" placeholder="seuperfil"></label>
          <label class="campo inteiro"><span>Mensagem de boas-vindas no chat</span><textarea name="boas_vindas" rows="2" maxlength="220">${esc(b.boas_vindas)}</textarea></label>
          <div class="campo inteiro"><span>Cor da marca</span><div class="cores">${cores.map(c => `<button type="button" class="cor-op ${c === b.cor ? 'on' : ''}" style="background:${c}" data-a="cor" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="color" name="cor" value="${esc(b.cor)}" aria-label="Outra cor"></div></div>
        </div></div>
        <div class="card"><div class="card-cab"><div><h3>Horário de funcionamento</h3><p>Profissionais sem horário próprio seguem este</p></div></div>${UI.horarioEditor(b.horario, 'hf')}</div>
        <div class="card"><div class="card-cab"><h3>Regras do agendamento online</h3></div><div class="grade-form">
          <label class="campo"><span>Horários de quanto em quanto tempo</span>${sel('intervalo', b.regras.intervalo, [[15, 'A cada 15 min'], [20, 'A cada 20 min'], [30, 'A cada 30 min'], [45, 'A cada 45 min'], [60, 'A cada 1 hora']])}</label>
          <label class="campo"><span>Antecedência mínima</span>${sel('antecedencia', b.regras.antecedencia, [[0, 'Sem antecedência'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'], [1440, '1 dia']])}</label>
          <label class="campo"><span>Cliente pode marcar até</span>${sel('dias_frente', b.regras.dias_frente, [[7, '7 dias à frente'], [15, '15 dias à frente'], [30, '30 dias à frente'], [45, '45 dias à frente'], [60, '60 dias à frente']])}</label>
          <label class="campo"><span>Cancelar ou remarcar pelo chat até</span>${sel('cancelar_ate', b.regras.cancelar_ate, [[0, 'A qualquer momento'], [1, '1 hora antes'], [2, '2 horas antes'], [3, '3 horas antes'], [6, '6 horas antes'], [12, '12 horas antes'], [24, '24 horas antes']])}</label>
        </div></div>
        ${this.secoesAjustesExtras()}
        <div class="card"><div class="card-cab"><h3>Acesso</h3></div><div class="grade-form">
          <label class="campo"><span>PIN do dono (4 números)</span><input name="pin_dono" data-pin inputmode="numeric" value="${esc(b.pin_dono)}"></label>
        </div></div>
        <div class="card" id="assinatura"><div class="card-cab"><div><h3>Assinatura ${APP.nome}</h3><p>Plano ${esc(plano?.nome || '—')} · ${dinheiro(b.valor_mensal)}/mês · vence todo dia ${b.dia_vencimento}</p></div>${UI.badge(s.texto, s.tom)}</div>
          ${cobs.length ? `<div class="linhas">${cobs.map(c => `<div class="linha"><div class="linha-txt"><b>${cap(Datas.nomeMes(c.referencia))}</b><small>vence ${Datas.br(c.vencimento)}${c.pago_em ? ` · pago em ${Datas.br(c.pago_em)}` : ''}</small></div><div class="linha-fim"><b>${dinheiro(c.valor)}</b>${c.status === 'paga' ? UI.badge('Paga', 'ok') : c.status === 'cancelada' ? UI.badge('Cancelada', 'neutro') : c.vencimento < Datas.hoje() ? UI.badge('Vencida', 'ruim') : UI.badge('A vencer', 'info')}</div></div>`).join('')}</div>` : '<p class="muted">Nenhuma mensalidade ainda.</p>'}
          <div class="acoes" style="margin-top:12px"><button type="button" class="btn peq" data-a="copiar" data-v="${esc(cfg.chave_pix)}">${ic('copiar')} Copiar chave PIX</button><a class="btn peq" href="${linkWhats(cfg.suporte_whatsapp, `Olá! Sou responsável por ${b.nome} e queria falar sobre a minha assinatura.`)}" target="_blank" rel="noopener">${ic('mensagem')} Falar com o suporte</a></div></div>
        <div class="salvar-barra"><button class="btn pri grande">${ic('check')} Salvar ajustes</button></div>
      </form>`;
  },
  async salvarAjustes(f) {
    const d = UI.form(f), b = this.b;
    if (!d.nome) throw new Error('Informe o nome do estabelecimento.');
    const tel = soDigitos(d.whatsapp);
    if (tel && ![10, 11].includes(tel.length)) throw new Error('Confira o WhatsApp: DDD + número.');
    if (!/^\d{4}$/.test(d.pin_dono)) throw new Error('O PIN do dono precisa ter 4 números.');
    const horario = UI.lerHorario(f, 'hf');
    await Store.salvar('barbearias', {
      id: b.id, nome: d.nome, whatsapp: tel, endereco: d.endereco, maps_url: d.maps_url, instagram: d.instagram.replace(/^@/, ''),
      boas_vindas: d.boas_vindas, cor: d.cor, logo: this._logo, horario, pin_dono: d.pin_dono,
      regras: { intervalo: +d.intervalo, antecedencia: +d.antecedencia, dias_frente: +d.dias_frente, cancelar_ate: +d.cancelar_ate },
      ...this.lerAjustesExtras(f)
    });
    this.b = Store.get('barbearias', b.id);
    UI.aplicarCor(this.b.cor);
    UI.toast('Ajustes salvos.');
    this.pintar();
  },

  v_mais() {
    const b = this.b, link = UI.linkCliente(b);
    const it = (href, icone, rot, extra = '') => `<a href="${href}" ${extra}>${ic(icone)}<span>${rot}</span>${ic('direita')}</a>`;
    return `<div class="topo"><div><h1>Mais</h1><p class="sub">${esc(b.nome)}</p></div></div>
      <div class="card" style="padding:4px 16px"><div class="mais-lista">
        ${this.eDono() ? it(this.h('promocoes'), 'brilho', 'Promoções') + it(this.h('clientes/fidelidade'), 'estrela', 'Fidelidade') + it(this.h('catalogo'), 'tesoura', 'Catálogo de serviços e produtos')
          + it(this.h('equipe'), 'usuario', 'Equipe') + it(this.h('mensagens'), 'mensagem', 'Mensagens automáticas (WhatsApp)') + it(this.h('ajustes'), 'ajustes', 'Ajustes e pagamento pelo app') + it(this.h('ajustes'), 'recibo', 'Assinatura e mensalidade') : ''}
        <button data-a="instalar-app">${ic('baixar')}<span>Instalar o app no celular</span>${ic('direita')}</button>
        <button data-a="ativar-notif">${ic('info')}<span>Ativar notificações</span>${ic('direita')}</button>
        ${it('#/' + b.slug, 'externo', 'Abrir minha página de agendamento', 'target="_blank"')}
        <button data-a="copiar" data-v="${esc(link)}">${ic('copiar')}<span>Copiar link de agendamento</span>${ic('direita')}</button>
        <button data-a="sair">${ic('sair')}<span>Sair / trocar de usuário</span>${ic('direita')}</button>
      </div></div>`;
  },

  /* ============================ eventos ============================ */
  async clique(e) {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a, id = el.dataset.id;
    try {
      switch (a) {
        case 'sair': this.gravarSessao(this.b, null); location.hash = `#/${this.b.slug}/painel`; return Rotas.render();
        case 'copiar': return UI.copiar(el.dataset.v);
        case 'dia': this.dia = Datas.soma(this.dia, Number(el.dataset.d)); this.rolarAgora = true; return this.pintar();
        case 'ir-dia': this.dia = el.dataset.d; this.rolarAgora = true; if (this.aba !== 'agenda') { location.hash = this.h('agenda'); return; } return this.pintar();
        case 'filtro-barb': this.filtroBarbeiro = el.dataset.v; return this.pintar();
        case 'modo': this.modo = el.dataset.v; this.rolarAgora = true; return this.pintar();
        case 'novo-ag': return this.formAg();
        case 'bloquear': return this.formBloqueio();
        case 'slot': {
          if (e.target !== el) return;
          const r = el.getBoundingClientRect(), passo = this.b.regras.intervalo || 30;
          const t = Number(el.dataset.ini) + (e.clientY - r.top) / Number(el.dataset.px);
          return this.formAg({ barbeiroId: el.dataset.barbeiro, data: this.dia, ini: Math.floor(t / passo) * passo });
        }
        case 'ver-ag': return this.verAg(id);
        case 'ver-bloq': return this.verBloqueio(id);
        case 'concluir': return this.concluir(id);
        case 'remarcar': return this.formAg({ remarcar: Store.get('agendamentos', id) });
        case 'faltou':
          await this.marcarFalta(Store.get('agendamentos', id));
          return this.pintar();
        case 'cancelar-ag': {
          const ag = Store.get('agendamentos', id);
          const pago = ag.pagamento?.status === 'pago', pol = Pagamentos.config(this.b).cancelamento;
          if (!await UI.confirmar(`Cancelar o horário de <b>${esc(ag.cliente_nome)}</b> (${Datas.curta(ag.data)} às ${Datas.hhmm(ag.ini)})? O horário fica livre para outro cliente.${pago ? `<br><br>O cliente pagou ${dinheiro(ag.pagamento.valor)} pelo app: ${pol === 'devolucao' ? 'o valor será devolvido' : 'o valor vira crédito para o próximo agendamento'}.` : ''}`, { titulo: 'Cancelar agendamento', ok: 'Cancelar horário', perigo: true })) return;
          const patch = { id, status: 'cancelado', cancelado_por: 'barbearia', cancelado_em: new Date().toISOString() };
          if (pago) {
            patch.pagamento = { ...ag.pagamento, status: pol === 'devolucao' ? 'devolvido' : 'credito' };
            if (pol !== 'devolucao') await Creditos.lancar(this.b, { tel: ag.cliente_tel, nome: ag.cliente_nome, valor: ag.pagamento.valor, origem: 'cancelamento', agendamento_id: ag.id });
          }
          await Creditos.desfazerUso(this.b, ag.id);
          await Store.salvar('agendamentos', patch);
          UI.toast('Agendamento cancelado.');
          this.pintar();
          if (ag.cliente_tel) {
            const msg = `Olá, ${primeiroNome(ag.cliente_nome)}! Precisamos cancelar seu horário de ${Datas.curta(ag.data)} às ${Datas.hhmm(ag.ini)} (${this.b.nome}). Desculpe o transtorno! Você pode marcar outro pelo link: ${UI.linkCliente(this.b)}`;
            UI.modal({ titulo: 'Avisar o cliente?', classe: 'pequeno', corpo: `<p class="texto-modal">Mande uma mensagem para ${esc(primeiroNome(ag.cliente_nome))} avisando do cancelamento.</p>`,
              rodape: `<button class="btn" data-fechar>Agora não</button><a class="btn pri" data-fechar href="${linkWhats(ag.cliente_tel, msg)}" target="_blank" rel="noopener">${ic('mensagem')} Avisar no WhatsApp</a>` });
          }
          return;
        }
        case 'reabrir':
          await this.reabrirAg(Store.get('agendamentos', id));
          UI.toast('Agendamento reaberto.');
          return this.pintar();
        case 'filtro-cli': this.cliFiltro = el.dataset.v; return this.pintar();
        case 'ver-cli': return this.verCliente(el.dataset.k);
        case 'novo-item': return this.formItem();
        case 'editar-item': return this.formItem(id);
        case 'novo-barb': return this.formBarbeiro();
        case 'editar-barb': return this.formBarbeiro(id);
        case 'periodo': this.periodo = el.dataset.v; return this.pintar();
        case 'venda': return this.formVenda();
        case 'exportar-fat': return this.exportarFat();
        case 'cor': {
          const f = $('#f-aj');
          f.cor.value = el.dataset.v;
          $$('.cor-op', f).forEach(o => o.classList.toggle('on', o === el));
          return UI.aplicarCor(el.dataset.v);
        }
        case 'logo': return $('#arq-logo').click();
        case 'sem-logo': this._logo = null; $('#logo-prev').innerHTML = UI.capa({}, 'servico'); return;
        default: return this.cliqueExtra(a, el, e);
      }
    } catch (err) { UI.erro(err); }
  },
  async mudanca(e) {
    const t = e.target;
    try {
      if (t.id === 'escolher-dia' && t.value) { this.dia = t.value; this.rolarAgora = true; this.pintar(); }
      if (t.id === 'fat-barb') { this.fBarbeiro = t.value; this.pintar(); }
      if (t.id === 'fat-de' || t.id === 'fat-ate') { this.de = $('#fat-de').value; this.ate = $('#fat-ate').value; if (this.de && this.ate && this.de <= this.ate) this.pintar(); }
      if (t.id === 'arq-logo' && t.files[0]) {
        this._logo = await UI.lerFoto(t.files[0], { max: 256, formato: 'image/png' });
        $('#logo-prev').innerHTML = `<img src="${this._logo}" alt="">`;
      }
      if (t.name === 'cor' && t.type === 'color') { $$('.cor-op').forEach(o => o.classList.remove('on')); UI.aplicarCor(t.value); }
    } catch (err) { UI.erro(err); }
  },
  digitou(e) {
    if (e.target.id === 'busca-cli') {
      this.cliBusca = e.target.value;
      const filtros = { todos: [0, () => true], marcados: [0, c => c.proxima], sumidos: [0, c => c.sumido], novos: [0, c => c.novo] };
      $('#lista-cli').innerHTML = this.linhasClientes(this.dadosClientes(), filtros);
    }
  }
};
