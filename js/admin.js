'use strict';
/* ============================================================
   Frente 1 — Administração do dono do sistema
   Barbearias e salões clientes, planos, mensalidades, cobrança, bloqueio.
   ============================================================ */
const Admin = {
  app: null, aba: 'geral', aberto: null, // aberto = barbearia com a ficha aberta
  f: { busca: '', sit: 'todas', mes: null, cob: 'todas' },

  oficial() { return typeof Nuvem !== 'undefined' && Nuvem.ativo; },
  logado() {
    if (this.oficial()) return Nuvem.conta?.papel === 'admin';
    try { return localStorage.getItem('bsflow:admin') === '1'; } catch (e) { return false; }
  },
  entrar(sim) {
    if (this.oficial()) { if (!sim) Nuvem.sair(); return; }
    try { sim ? localStorage.setItem('bsflow:admin', '1') : localStorage.removeItem('bsflow:admin'); } catch (e) { /* sem armazenamento */ }
  },

  render(app, sub = []) {
    this.app = app;
    document.body.className = 'tela-admin';
    document.title = `Administração · ${APP.nome}`;
    if (!this.logado()) return this.login();
    const abas = ['geral', 'barbearias', 'cobrancas', 'planos', 'ajustes'];
    this.aba = abas.includes(sub[0]) ? sub[0] : 'geral';
    this.f.mes ||= Datas.mes(Datas.hoje());
    Store.ouvinte = () => this.depois();
    this.pintar();
    app.onclick = e => this.clique(e);
    app.oninput = e => { if (e.target.id === 'busca-bb') { this.f.busca = e.target.value; $('#lista-bb').innerHTML = this.linhasBB(); } };
    app.onsubmit = e => { if (e.target.id === 'f-ajustes') { e.preventDefault(); this.salvarAjustes(e.target).catch(UI.erro); } };
  },

  pintar() {
    const itens = [
      { id: 'geral', rotulo: 'Visão geral', icone: 'grafico', href: '#/admin' },
      { id: 'barbearias', rotulo: 'Clientes', icone: 'loja', href: '#/admin/barbearias' },
      { id: 'cobrancas', rotulo: 'Cobranças', icone: 'recibo', href: '#/admin/cobrancas' },
      { id: 'planos', rotulo: 'Planos', icone: 'coroa', href: '#/admin/planos' },
      { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes', href: '#/admin/ajustes' }
    ];
    const marca = `<a class="marca" href="#/admin"><span class="marca-icone">${ic('tesoura')}</span><span class="marca-txt"><b>${APP.nome}</b><small>Administração</small></span></a>`;
    const rolagem = window.scrollY;
    this.app.innerHTML = UI.casca({
      marca, itens, ativo: this.aba,
      conteudo: `<div class="barra-celular">${marca}<button class="btn-icone" data-a="sair" aria-label="Sair">${ic('sair')}</button></div>${this['v_' + this.aba]()}`,
      rodapeLateral: `<a class="nav-item" href="#/">${ic('casa')}<span>Página inicial</span></a>
        <a class="nav-item" href="#" data-a="sair">${ic('sair')}<span>Sair</span></a>`
    });
    window.scrollTo(0, rolagem);
  },
  // depois de qualquer mudança: redesenha a tela e a ficha aberta
  depois() {
    this.pintar();
    if (this.aberto && $('#ficha-bb')) this.preencherFicha();
  },

  login() {
    if (this.oficial()) return this.loginOficial();
    this.app.innerHTML = `<div class="login"><div class="login-card">
      <span class="marca"><span class="marca-icone">${ic('tesoura')}</span><span class="marca-txt"><b>${APP.nome}</b></span></span>
      <h1>Administração do sistema</h1><p>Área do dono da plataforma.</p>
      <form id="f-login">
        <label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password" autofocus></label>
        <button class="btn pri grande">Entrar</button>
      </form>
      <div class="login-voltar"><a class="btn fantasma" href="#/">${ic('voltar')} Voltar ao início</a></div>
    </div></div>`;
    const f = $('#f-login', this.app);
    setTimeout(() => f.senha.focus(), 50);
    f.onsubmit = e => {
      e.preventDefault();
      if (f.senha.value === Store.db.config.senha_admin) { this.entrar(true); Rotas.render(); }
      else { UI.toast('Senha incorreta.', 'erro'); f.senha.select(); }
    };
  },

  loginOficial() {
    this.app.innerHTML = `<div class="login"><div class="login-card">
      <span class="marca"><span class="marca-icone">${ic('tesoura')}</span><span class="marca-txt"><b>${APP.nome}</b></span></span>
      <h1>Administração do sistema</h1><p>Área do dono da plataforma.</p>
      <form id="f-login" class="pilha" style="text-align:left">
        <label class="campo"><span>E-mail</span><input type="email" name="email" autocomplete="email"></label>
        <label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password"></label>
        <button class="btn pri grande">Entrar</button>
      </form>
      <div class="login-voltar"><a class="btn fantasma" href="#/">${ic('voltar')} Voltar ao início</a></div>
    </div></div>`;
    const f = $('#f-login', this.app);
    setTimeout(() => f.email.focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault();
      try {
        const c = await Nuvem.entrar(f.email.value, f.senha.value);
        if (c.papel !== 'admin') { await Nuvem.sair(); throw new Error('Este login não é da administração.'); }
        Rotas.render();
      } catch (err) { UI.erro(err); }
    };
  },
  // ações do Asaas e do login do dono (servidor)
  async acaoServidor(corpo, ok) {
    try {
      const r = await Nuvem.funcao('bsflow-admin', corpo);
      UI.toast(ok(r), 'info');
      Nuvem.contexto = null;
      await Rotas.render();
      if (this.aberto) this.preencherFicha();
      return r;
    } catch (e) { UI.erro(e); }
  },

  /* ---------------- telas ---------------- */
  logo(b, cls = '') {
    return `<span class="bb-logo ${cls}" style="background:${esc(b.cor)};color:${UI.corTexto(b.cor)}">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : esc(UI.iniciaisMarca(b.nome))}</span>`;
  },
  kpi(rotulo, valor, sub = '', icone = '', cls = '', attrs = '') {
    const tag = attrs ? 'button' : 'div';
    return `<${tag} class="kpi ${cls}" ${attrs}><small>${icone ? ic(icone) : ''}${esc(rotulo)}</small><b>${valor}</b>${sub ? `<em>${sub}</em>` : ''}</${tag}>`;
  },
  grupos() {
    return {
      todas: { rot: 'Todas', f: () => true },
      em_dia: { rot: 'Em dia', f: s => s.cod === 'em_dia' || s.cod === 'vence_logo' },
      teste: { rot: 'Em teste', f: s => s.cod === 'teste' || s.cod === 'teste_fim' },
      atrasada: { rot: 'Atrasadas', f: s => s.cod === 'atrasada' },
      bloqueada: { rot: 'Bloqueadas', f: s => s.cod === 'bloqueada' },
      inativa: { rot: 'Inativas', f: s => s.cod === 'inativa' }
    };
  },

  v_geral() {
    const hoje = Datas.hoje(), mes = Datas.mes(hoje);
    const lista = Store.t('barbearias').map(b => ({ b, s: Cobranca.situacao(b) }));
    const g = this.grupos();
    const qtd = k => lista.filter(x => g[k].f(x.s)).length;
    const pagantes = lista.filter(x => x.b.status === 'ativa' && x.s.cod !== 'bloqueada');
    const cobs = Store.t('cobrancas');
    const pagoNo = m => soma(cobs.filter(c => c.status === 'paga' && (c.pago_em || '').startsWith(m)), c => c.valor);
    const aReceber = cobs.filter(c => c.status === 'pendente' && c.vencimento >= hoje);
    const atrasadas = cobs.filter(c => c.status === 'pendente' && c.vencimento < hoje);
    const meses = [...Array(6)].map((_, i) => Datas.somaMes(mes, i - 5));
    const graf = meses.map(m => ({ rot: Datas.mesCurto(m), valor: pagoNo(m), dica: cap(Datas.nomeMes(m)) }));
    const peso = { bloqueada: 0, teste_fim: 1, atrasada: 2, vence_logo: 3, teste: 4 };
    const atencao = lista.filter(x => x.s.cod in peso && (x.s.cod !== 'teste' || x.s.resta <= 3) && !(x.s.cod === 'bloqueada' && !x.s.auto))
      .sort((p, q) => peso[p.s.cod] - peso[q.s.cod]);
    const uso = lista.filter(x => x.b.status !== 'inativa').map(x => ({
      rot: x.b.nome, valor: Store.de('agendamentos', x.b.id).filter(a => a.data.startsWith(mes) && a.status !== 'cancelado').length
    })).sort((p, q) => q.valor - p.valor);

    return `<div class="topo"><div><h1>Visão geral</h1><p class="sub">${cap(Datas.longa(hoje))}</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="nova-bb">${ic('mais')} Novo cliente</button></div></div>
      <div class="kpis">
        ${this.kpi('Receita mensal (MRR)', dinheiro(soma(pagantes, x => x.b.valor_mensal)), `${pagantes.length} assinatura${pagantes.length === 1 ? '' : 's'} ativa${pagantes.length === 1 ? '' : 's'}`, 'subindo', 'destaque')}
        ${this.kpi(`Recebido em ${MESES[+mes.slice(5) - 1]}`, dinheiro(pagoNo(mes)), 'mensalidades pagas', 'check')}
        ${this.kpi('A receber', dinheiro(soma(aReceber, c => c.valor)), `${aReceber.length} cobrança${aReceber.length === 1 ? '' : 's'} no prazo`, 'relogio')}
        ${this.kpi('Em atraso', `<span class="${atrasadas.length ? 'tom-ruim' : ''}">${dinheiro(soma(atrasadas, c => c.valor))}</span>`, `${atrasadas.length} cobrança${atrasadas.length === 1 ? '' : 's'} vencida${atrasadas.length === 1 ? '' : 's'}`, 'alerta', 'clicavel', 'data-a="ir-cob" data-v="atraso"')}
      </div>
      <div class="kpis">
        ${['em_dia', 'teste', 'atrasada', 'bloqueada', 'inativa'].map(k => this.kpi(g[k].rot, String(qtd(k)), qtd(k) === 1 ? 'cliente' : 'clientes', '', 'clicavel', `data-a="ir-sit" data-v="${k}"`)).join('')}
      </div>
      <div class="duas-col">
        <div class="card"><div class="card-cab"><div><h3>Mensalidades recebidas</h3><p>Últimos 6 meses, pela data do pagamento</p></div></div>${UI.barras(graf)}</div>
        <div class="card"><div class="card-cab"><div><h3>Precisa de atenção</h3><p>Atrasos, bloqueios e testes acabando</p></div></div>
          ${atencao.length ? atencao.map(x => this.itemAtencao(x.b, x.s)).join('') : UI.vazio('check', 'Tudo em ordem', 'Nenhum cliente precisa de ação agora.')}
        </div>
      </div>
      <div class="card"><div class="card-cab"><div><h3>Uso da plataforma</h3><p>Agendamentos de cada cliente em ${MESES[+mes.slice(5) - 1]} (sem os cancelados)</p></div></div>
        ${UI.partes(uso, { fmt: n => `${n} agend.` })}</div>`;
  },
  itemAtencao(b, s) {
    let txt = s.motivo || '', acoes = '';
    if (s.cod === 'atrasada' || (s.cod === 'bloqueada' && s.auto)) {
      txt = `${dinheiro(s.emAtraso)} em aberto · ${s.atraso} dias de atraso${s.liberada ? ` · liberada até ${Datas.brCurta(b.liberado_ate)}` : ''}`;
      acoes = `<button class="btn peq" data-a="cobrar-bb" data-id="${b.id}">${ic('mensagem')} Cobrar</button>`;
      if (s.cod === 'bloqueada') acoes += `<button class="btn peq" data-a="liberar" data-id="${b.id}">Liberar</button>`;
    } else if (s.cod === 'vence_logo') {
      txt = `${dinheiro(s.proxima.valor)} vence em ${Datas.br(s.proxima.vencimento)}`;
      acoes = `<button class="btn peq" data-a="cobrar-bb" data-id="${b.id}">${ic('mensagem')} Lembrar</button>`;
    } else if (s.cod === 'teste' || s.cod === 'teste_fim') {
      txt = s.cod === 'teste' ? `Teste termina em ${Datas.br(b.teste_ate)}` : `Teste terminou em ${Datas.br(b.teste_ate)}`;
      acoes = `<button class="btn peq" data-a="ativar" data-id="${b.id}">Ativar</button><button class="btn peq" data-a="estender" data-id="${b.id}">+7 dias</button>`;
    }
    return `<div class="atencao-item">${this.logo(b)}<div class="clicavel" data-a="ver-bb" data-id="${b.id}" style="cursor:pointer"><b>${esc(b.nome)}</b><small>${esc(txt)}</small></div>${UI.badge(s.texto, s.tom)}<div class="acoes">${acoes}</div></div>`;
  },

  v_barbearias() {
    const g = this.grupos();
    const lista = Store.t('barbearias').map(b => Cobranca.situacao(b));
    return `<div class="topo"><div><h1>Clientes</h1><p class="sub">${Store.t('barbearias').length} barbearias e salões cadastrados</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="nova-bb">${ic('mais')} Novo cliente</button></div></div>
      <div class="barra-filtros">
        <label class="busca campo"><span class="sr">Buscar</span>${ic('busca')}<input id="busca-bb" type="search" placeholder="Buscar por nome, cidade ou responsável" value="${esc(this.f.busca)}"></label>
        <div class="fichas">${Object.entries(g).map(([k, v]) => `<button class="ficha ${this.f.sit === k ? 'on' : ''}" data-a="filtro-sit" data-v="${k}">${v.rot} <span class="cont">${lista.filter(v.f).length}</span></button>`).join('')}</div>
      </div>
      <div class="card" style="padding:8px 12px"><div id="lista-bb">${this.linhasBB()}</div></div>`;
  },
  linhasBB() {
    const g = this.grupos()[this.f.sit] || this.grupos().todas;
    const busca = semAcento(this.f.busca);
    const mes = Datas.mes(Datas.hoje());
    const lista = Store.t('barbearias').map(b => ({ b, s: Cobranca.situacao(b) }))
      .filter(x => g.f(x.s) && (!busca || semAcento(`${x.b.nome} ${x.b.cidade} ${x.b.responsavel} ${x.b.slug}`).includes(busca)))
      .sort((p, q) => p.b.nome.localeCompare(q.b.nome));
    if (!lista.length) return UI.vazio('loja', 'Nenhum cliente encontrado', 'Mude o filtro ou a busca.');
    return lista.map(({ b, s }) => {
      const plano = Store.get('planos', b.plano_id);
      const ags = Store.de('agendamentos', b.id).filter(a => a.data.startsWith(mes) && a.status !== 'cancelado').length;
      return `<div class="bb-linha" data-a="ver-bb" data-id="${b.id}">
        <div class="bb-nome">${this.logo(b)}<div><b>${esc(b.nome)}</b><small>${esc(b.cidade || '—')} · ${esc(b.responsavel || 'sem responsável')}</small></div></div>
        <div class="bb-col so-largo"><b>${esc(plano?.nome || 'Sem plano')} · ${dinheiro(b.valor_mensal)}</b><small>vence todo dia ${b.dia_vencimento}</small></div>
        <div class="bb-col so-largo num"><b>${ags}</b><small>agend. no mês</small></div>
        <div class="bb-col">${UI.badge(s.texto, s.tom)}</div>
        <span class="btn-icone so-largo bb-col">${ic('direita')}</span>
      </div>`;
    }).join('');
  },

  v_cobrancas() {
    const hoje = Datas.hoje(), mes = this.f.mes;
    const sitCob = c => c.status === 'pendente' && c.vencimento < hoje ? 'vencida' : c.status;
    const filtros = {
      todas: { rot: 'Todas do mês', f: c => c.referencia === mes },
      pendente: { rot: 'A vencer', f: c => c.referencia === mes && sitCob(c) === 'pendente' },
      paga: { rot: 'Pagas', f: c => c.referencia === mes && c.status === 'paga' },
      cancelada: { rot: 'Canceladas', f: c => c.referencia === mes && c.status === 'cancelada' },
      atraso: { rot: 'Em atraso (todos os meses)', f: c => sitCob(c) === 'vencida' }
    };
    const filtro = filtros[this.f.cob] || filtros.todas;
    const cobs = Store.t('cobrancas').filter(filtro.f).sort((p, q) => p.vencimento.localeCompare(q.vencimento));
    const doMes = Store.t('cobrancas').filter(c => c.referencia === mes && c.status !== 'cancelada');
    const semCob = Store.t('barbearias').filter(b => b.status === 'ativa' && !Store.de('cobrancas', b.id).some(c => c.referencia === mes && c.status !== 'cancelada'));
    const tag = { pendente: ['A vencer', 'info'], vencida: ['Vencida', 'ruim'], paga: ['Paga', 'ok'], cancelada: ['Cancelada', 'neutro'] };
    const linhas = cobs.map(c => {
      const b = Store.get('barbearias', c.barbearia_id);
      if (!b) return '';
      const st = sitCob(c);
      const atraso = st === 'vencida' ? ` · ${Datas.diff(hoje, c.vencimento)} dias` : '';
      return `<tr class="clicavel" data-a="ver-bb" data-id="${b.id}">
        <td><div class="bb-nome">${this.logo(b)}<div><b>${esc(b.nome)}</b><small>${esc(b.responsavel)}</small></div></div></td>
        <td>${cap(Datas.nomeMes(c.referencia))}${c.descricao ? `<small>${esc(c.descricao)}</small>` : ''}</td>
        <td>${Datas.br(c.vencimento)}${c.lembretes ? `<small>cobrado ${c.lembretes}×</small>` : ''}</td>
        <td class="num">${dinheiro(c.valor)}</td>
        <td>${UI.badge(tag[st][0] + atraso, tag[st][1])}${c.status === 'paga' ? `<small>em ${Datas.br(c.pago_em)}</small>` : ''}</td>
        <td><div class="acoes">${['pendente', 'vencida'].includes(st) ? `
          <button class="btn peq" data-a="cobrar" data-id="${c.id}" title="Cobrar no WhatsApp">${ic('mensagem')}<span>Cobrar</span></button>
          <button class="btn peq ok" data-a="pagar" data-id="${c.id}">${ic('check')}<span>Pago</span></button>` : ''}</div></td>
      </tr>`;
    }).join('');
    return `<div class="topo"><div><h1>Cobranças</h1><p class="sub">Mensalidades dos clientes</p></div>
        <div class="topo-acoes"><span class="mes-nav"><button class="btn-icone" data-a="mes" data-d="-1" aria-label="Mês anterior">${ic('esquerda')}</button><span>${cap(Datas.nomeMes(mes))}</span><button class="btn-icone" data-a="mes" data-d="1" aria-label="Próximo mês">${ic('direita')}</button></span></div></div>
      ${semCob.length ? `<div class="aviso-faixa info">${ic('info')}<span>${semCob.length} cliente${semCob.length > 1 ? 's ativos ainda não têm' : ' ativo ainda não tem'} a cobrança de ${Datas.nomeMes(mes)}.</span><button class="btn peq" data-a="gerar-mes">Gerar cobranças</button></div>` : ''}
      <div class="kpis">
        ${this.kpi('Previsto no mês', dinheiro(soma(doMes, c => c.valor)), `${doMes.length} cobranças`, 'recibo')}
        ${this.kpi('Recebido', `<span class="tom-ok">${dinheiro(soma(doMes.filter(c => c.status === 'paga'), c => c.valor))}</span>`, '', 'check')}
        ${this.kpi('A vencer', dinheiro(soma(doMes.filter(c => sitCob(c) === 'pendente'), c => c.valor)), '', 'relogio')}
        ${this.kpi('Vencido', `<span class="tom-ruim">${dinheiro(soma(doMes.filter(c => sitCob(c) === 'vencida'), c => c.valor))}</span>`, '', 'alerta')}
      </div>
      <div class="barra-filtros"><div class="fichas">${Object.entries(filtros).map(([k, v]) => `<button class="ficha ${this.f.cob === k ? 'on' : ''}" data-a="filtro-cob" data-v="${k}">${v.rot} <span class="cont">${Store.t('cobrancas').filter(v.f).length}</span></button>`).join('')}</div></div>
      <div class="card">${cobs.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Cliente</th><th>Referência</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
        : UI.vazio('recibo', 'Nenhuma cobrança aqui', this.f.cob === 'atraso' ? 'Ninguém em atraso.' : 'Troque o mês ou o filtro.')}</div>`;
  },

  v_planos() {
    const bbs = Store.t('barbearias').filter(b => b.status !== 'inativa');
    return `<div class="topo"><div><h1>Planos</h1><p class="sub">O que cada plano libera no painel do cliente. O valor de cada cliente pode ser ajustado na ficha dele.</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="novo-plano">${ic('mais')} Novo plano</button></div></div>
      <div class="aviso-faixa info">${ic('info')}<span>No período de teste o cliente experimenta todos os recursos. Quando vira ativo, vale o que o plano dele libera.</span></div>
      <div class="plano-grade">${Store.t('planos').slice().sort((x, y) => x.preco - y.preco).map(p => {
        const n = bbs.filter(b => b.plano_id === p.id).length;
        return `<div class="plano">
          <h3>${ic(p.max_barbeiros === 0 ? 'diamante' : p.max_barbeiros === 1 ? 'usuario' : 'usuarios')} ${esc(p.nome)}</h3>
          <div class="preco">${dinheiro(p.preco)} <small>/mês</small></div>
          <p class="muted">${esc(p.descricao)}</p>
          <ul><li>${ic('check')} ${p.max_barbeiros ? `Até ${p.max_barbeiros} profissiona${p.max_barbeiros > 1 ? 'is' : 'l'}` : 'Profissionais sem limite'}</li>
            <li>${ic('check')} Agendamento pelo chat, agenda e clientes</li><li>${ic('check')} Catálogo com fotos, faturamento e fechar o dia</li>
            ${Object.entries(RECURSOS).map(([k, r]) => p.recursos?.includes(k) ? `<li>${ic('check')} ${esc(r.nome)}</li>` : `<li class="fora">${ic('x')} ${esc(r.nome)}</li>`).join('')}</ul>
          <p class="muted" style="font-size:13px">${n} cliente${n === 1 ? '' : 's'} neste plano</p>
          <div class="acoes"><button class="btn peq" data-a="editar-plano" data-id="${p.id}">${ic('lapis')} Editar</button></div>
        </div>`;
      }).join('')}</div>`;
  },

  v_ajustes() {
    const c = Store.db.config;
    return `<div class="topo"><div><h1>Ajustes</h1><p class="sub">Regras de cobrança e mensagens</p></div></div>
      <form id="f-ajustes" class="pilha" style="max-width:820px">
        <div class="card"><div class="card-cab"><h3>Cobrança</h3></div><div class="grade-form">
          <label class="campo"><span>Chave PIX para receber</span><input name="chave_pix" value="${esc(c.chave_pix)}"></label>
          <label class="campo"><span>WhatsApp do suporte</span><input name="suporte_whatsapp" data-tel value="${esc(fmtTel(c.suporte_whatsapp))}"><small>Aparece para o cliente bloqueado falar com você.</small></label>
          <div class="campo inteiro"><label class="chave"><input type="checkbox" name="bloqueio_auto" ${c.bloqueio_auto ? 'checked' : ''}><i></i>Bloquear automaticamente quem atrasar a mensalidade</label></div>
          <label class="campo"><span>Tolerância antes de bloquear (dias)</span><input type="number" name="tolerancia_dias" min="0" max="60" value="${c.tolerancia_dias}"><small>Depois desse prazo, painel e agendamento online ficam suspensos até o pagamento.</small></label>
        </div></div>
        <div class="card"><div class="card-cab"><div><h3>Mensagens de cobrança (WhatsApp)</h3><p>Use: {responsavel} {estabelecimento} {valor} {vencimento} {referencia} {pix} {dias}</p></div></div><div class="grade-form">
          <label class="campo inteiro"><span>Lembrete (antes de vencer)</span><textarea name="msg_lembrete" rows="3">${esc(c.msg_lembrete)}</textarea></label>
          <label class="campo inteiro"><span>Cobrança (depois de vencer)</span><textarea name="msg_atraso" rows="4">${esc(c.msg_atraso)}</textarea></label>
        </div></div>
        ${this.oficial() ? `<div class="card"><div class="card-cab"><div><h3>Cobrança pelo Asaas</h3><p>Assinaturas criadas na contratação; os pagamentos chegam sozinhos pelo aviso do Asaas.</p></div></div>
          <p class="muted" style="margin:0 0 10px">A chave do Asaas fica nos segredos do Supabase (ASAAS_API_KEY), nunca aqui na tela. Servidor: <b>${esc(Nuvem.cfg.nome)}</b>.</p>
          <div class="acoes"><button type="button" class="btn" data-a="asaas-testar">${ic('check')} Testar a conexão</button>
            <button type="button" class="btn" data-a="asaas-configurar">${ic('link')} Ligar o aviso de pagamento</button>
            <a class="btn fantasma" href="#/contratar" target="_blank">${ic('externo')} Página de contratação</a></div></div>`
        : `<div class="card"><div class="card-cab"><h3>Acesso</h3></div><div class="grade-form">
          <label class="campo"><span>Nova senha da administração</span><input type="password" name="senha_nova" autocomplete="new-password" placeholder="Deixe em branco para manter"></label>
        </div></div>
        <div class="card"><div class="card-cab"><div><h3>Dados de demonstração</h3><p>Os dados desta versão ficam só neste navegador.</p></div></div>
          <div class="acoes"><button type="button" class="btn" data-a="exportar">${ic('baixar')} Baixar cópia (JSON)</button>
            <button type="button" class="btn perigo-txt" data-a="restaurar">${ic('atualizar')} Restaurar dados de demonstração</button></div></div>`}
        <div class="salvar-barra"><button class="btn pri grande">${ic('check')} Salvar ajustes</button></div>
      </form>`;
  },

  /* ---------------- ficha da barbearia ---------------- */
  verBB(id) {
    const b = Store.get('barbearias', id);
    if (!b) return;
    this.aberto = id;
    const m = UI.modal({ titulo: b.nome, classe: 'largo', corpo: '<div id="ficha-bb"></div>', rodape: '<div id="ficha-acoes" class="acoes" style="width:100%;justify-content:flex-end"></div>', aoFechar: () => { this.aberto = null; } });
    m.el.onclick = e => this.clique(e);
    this.preencherFicha();
  },
  preencherFicha() {
    const b = Store.get('barbearias', this.aberto);
    const corpo = $('#ficha-bb'), rod = $('#ficha-acoes');
    if (!b || !corpo) return;
    const s = Cobranca.situacao(b), plano = Store.get('planos', b.plano_id);
    const hoje = Datas.hoje(), mes = Datas.mes(hoje);
    const fat = Financeiro.resumo(b, mes + '-01', hoje);
    const ags = Store.de('agendamentos', b.id).filter(a => a.data.startsWith(mes) && a.status !== 'cancelado').length;
    const nBarb = Agenda.barbeiros(b).length;
    const cobs = Store.de('cobrancas', b.id).sort((p, q) => q.vencimento.localeCompare(p.vencimento));
    const sitCob = c => c.status === 'pendente' && c.vencimento < hoje ? 'vencida' : c.status;
    const tag = { pendente: ['A vencer', 'info'], vencida: ['Vencida', 'ruim'], paga: ['Paga', 'ok'], cancelada: ['Cancelada', 'neutro'] };
    const acimaDoPlano = plano?.max_barbeiros && nBarb > plano.max_barbeiros;
    corpo.innerHTML = `
      <div class="det-topo">${this.logo(b, '')}<div><h4>${esc(b.nome)}</h4><span class="muted" style="font-size:13.5px">${esc(b.cidade)}</span></div>${UI.badge(s.texto, s.tom)}</div>
      ${!s.acesso ? `<div class="aviso-faixa ruim">${ic('cadeado')}<span><b>Sem acesso:</b> ${esc(s.motivo)} O painel e a página de agendamento estão suspensos.</span></div>` : ''}
      ${s.liberada ? `<div class="aviso-faixa">${ic('info')}<span>Liberada por negociação até ${Datas.br(b.liberado_ate)}, mesmo com atraso.</span></div>` : ''}
      ${acimaDoPlano ? `<div class="aviso-faixa">${ic('alerta')}<span>Tem ${nBarb} profissionais ativos, mas o plano ${esc(plano.nome)} permite ${plano.max_barbeiros}.</span></div>` : ''}
      <div class="metricas-mini">
        <div><small>Profissionais ativos</small><b>${nBarb}</b></div>
        <div><small>Serviços</small><b>${Agenda.servicos(b).length}</b></div>
        <div><small>Agendamentos no mês</small><b>${ags}</b></div>
        <div><small>Faturamento no mês</small><b>${dinheiro(fat.total)}</b></div>
      </div>
      <div class="secao-modal" style="margin-top:18px"><h4>Dados</h4><dl class="info-lista">
        <dt>Responsável</dt><dd>${esc(b.responsavel || '—')}</dd>
        <dt>WhatsApp</dt><dd>${b.whatsapp ? `<a href="${linkWhats(b.whatsapp)}" target="_blank" rel="noopener">${esc(fmtTel(b.whatsapp))}</a>` : '—'}</dd>
        <dt>E-mail</dt><dd>${esc(b.email || '—')}</dd>
        <dt>Endereço</dt><dd>${esc(b.endereco || '—')}</dd>
        <dt>Plano</dt><dd>${esc(plano?.nome || '—')} · <b>${dinheiro(b.valor_mensal)}</b>/mês · vence todo dia ${b.dia_vencimento}</dd>
        <dt>Cliente desde</dt><dd>${Datas.br((b.criado_em || '').slice(0, 10))}${b.status === 'teste' ? ` · teste até ${Datas.br(b.teste_ate)}` : ''}</dd>
        ${this.oficial()
          ? `<dt>Painel</dt><dd><a href="#/${esc(b.slug)}/painel" target="_blank">${ic('externo')} Abrir painel</a> · login: <b>${esc(b.email || '—')}</b> <button class="btn peq fantasma" data-a="senha-dono" data-id="${b.id}">Nova senha</button></dd>
            <dt>CPF/CNPJ</dt><dd>${esc(b.cpf_cnpj || '—')}</dd>
            <dt>Asaas</dt><dd>${b.asaas_assinatura_id ? `assinatura <b>${esc(b.asaas_assinatura_id)}</b>${b.primeiro_vencimento ? ` · 1º vencimento ${Datas.br(b.primeiro_vencimento)}` : ''} <button class="btn peq fantasma" data-a="asaas-assinar" data-id="${b.id}">Buscar cobranças</button>`
              : `<span class="erro-txt">sem assinatura${b.asaas_erro ? `: ${esc(b.asaas_erro)}` : ''}</span> <button class="btn peq" data-a="asaas-assinar" data-id="${b.id}">Criar assinatura</button>`}</dd>`
          : `<dt>Painel</dt><dd><a href="#/${esc(b.slug)}/painel" target="_blank">${ic('externo')} Abrir painel</a> · PIN do dono: <b>${esc(b.pin_dono)}</b> <button class="btn peq fantasma" data-a="novo-pin" data-id="${b.id}">Trocar</button></dd>`}
        <dt>Agendamento</dt><dd><a href="#/${esc(b.slug)}" target="_blank">${ic('externo')} /${esc(b.slug)}</a></dd>
        ${b.obs ? `<dt>Observações</dt><dd>${esc(b.obs)}</dd>` : ''}
      </dl></div>
      <div class="secao-modal"><div class="card-cab" style="margin-bottom:8px"><h4 style="margin:0">Cobranças</h4><button class="btn peq" data-a="nova-cob" data-id="${b.id}">${ic('mais')} Cobrança avulsa</button></div>
        ${cobs.length ? `<div class="tabela-wrap" style="margin:0"><table class="tabela"><thead><tr><th>Referência</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
        ${cobs.map(c => { const st = sitCob(c); return `<tr>
          <td>${cap(Datas.nomeMes(c.referencia))}${c.descricao ? `<small>${esc(c.descricao)}</small>` : ''}</td><td>${Datas.br(c.vencimento)}</td><td class="num">${dinheiro(c.valor)}</td>
          <td>${UI.badge(tag[st][0], tag[st][1])}${c.status === 'paga' ? `<small>${Datas.br(c.pago_em)} · ${esc(c.forma || '')}</small>` : c.lembretes ? `<small>cobrado ${c.lembretes}×</small>` : ''}</td>
          <td><div class="acoes">${['pendente', 'vencida'].includes(st) ? `<button class="btn peq" data-a="cobrar" data-id="${c.id}">${ic('mensagem')}</button><button class="btn peq ok" data-a="pagar" data-id="${c.id}">Pago</button><button class="btn peq fantasma" data-a="cancelar-cob" data-id="${c.id}" title="Cancelar cobrança">${ic('x')}</button>` : c.status === 'paga' ? `<button class="btn peq fantasma" data-a="estornar" data-id="${c.id}">Desfazer</button>` : ''}</div></td>
        </tr>`; }).join('')}</tbody></table></div>` : `<p class="muted">Nenhuma cobrança ainda${b.status === 'teste' ? ' (está em teste)' : ''}.</p>`}
      </div>`;
    const a = (acao, rot, cls = '', icone = '') => `<button class="btn ${cls}" data-a="${acao}" data-id="${b.id}">${icone ? ic(icone) : ''}${rot}</button>`;
    let botoes = a('editar-bb', 'Editar', 'esq', 'lapis');
    if (b.status === 'inativa') botoes += a('reativar', 'Reativar', 'pri', 'power');
    else {
      botoes += a('inativar', 'Inativar', 'perigo-txt', 'power');
      if (b.bloqueada) botoes += a('desbloquear', 'Desbloquear', '', 'cadeado-aberto');
      else if (s.cod === 'bloqueada' && s.auto) botoes += a('liberar', 'Liberar acesso', '', 'cadeado-aberto');
      else botoes += a('bloquear', 'Bloquear', '', 'cadeado');
      if (b.status === 'teste') botoes += a('estender', '+7 dias de teste', '') + a('ativar', 'Ativar assinatura', 'pri', 'check');
      else if (s.pendentes.length) botoes += a('cobrar-bb', 'Cobrar no WhatsApp', 'pri', 'mensagem');
    }
    rod.innerHTML = botoes;
  },

  /* ---------------- ações ---------------- */
  async clique(e) {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a, id = el.dataset.id;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    try {
      switch (a) {
        case 'sair': this.entrar(false); location.hash = '#/admin'; Rotas.render(); return;
        case 'nova-bb': return this.formBB();
        case 'editar-bb': return this.formBB(id);
        case 'ver-bb': return this.verBB(id);
        case 'filtro-sit': this.f.sit = el.dataset.v; return this.pintar();
        case 'ir-sit': this.f.sit = el.dataset.v; this.f.busca = ''; location.hash = '#/admin/barbearias'; return;
        case 'filtro-cob': this.f.cob = el.dataset.v; return this.pintar();
        case 'ir-cob': this.f.cob = el.dataset.v; location.hash = '#/admin/cobrancas'; return;
        case 'mes': this.f.mes = Datas.somaMes(this.f.mes, Number(el.dataset.d)); return this.pintar();
        case 'asaas-testar': return this.acaoServidor({ acao: 'asaas_testar' }, r => `Asaas ligado: ${r.conta} (${r.ambiente}).`);
        case 'asaas-configurar': return this.acaoServidor({ acao: 'asaas_configurar' }, () => 'Aviso de pagamento ligado no Asaas.');
        case 'asaas-assinar': return this.acaoServidor({ acao: 'asaas_assinar', barbearia_id: id }, r => `Assinatura em dia no Asaas · ${r.cobrancas} cobrança(s).`);
        case 'senha-dono': {
          const senha = (prompt('Nova senha para o dono (pelo menos 8 caracteres). Mande para ele pelo WhatsApp e peça para trocar em Ajustes.') || '').trim();
          if (!senha) return;
          return this.acaoServidor({ acao: 'senha', barbearia_id: id, senha }, () => 'Senha nova definida.');
        }
        case 'gerar-mes': {
          if (this.oficial()) return UI.toast('Na versão oficial as mensalidades são geradas pelo Asaas, todo mês, sozinhas.', 'info');
          const n = await Cobranca.gerarMes(this.f.mes);
          UI.toast(n ? `${n} cobrança${n > 1 ? 's geradas' : ' gerada'}.` : 'Nenhuma cobrança nova.');
          return this.depois();
        }
        case 'cobrar': return this.cobrar(id);
        case 'cobrar-bb': {
          const s = Cobranca.situacao(Store.get('barbearias', id));
          const c = s.vencidas[0] || s.pendentes[0];
          if (!c) return UI.toast('Esse cliente não tem cobrança em aberto.', 'info');
          return this.cobrar(c.id);
        }
        case 'pagar': return this.pagar(id);
        case 'estornar': {
          if (!await UI.confirmar('A cobrança volta a ficar em aberto.', { titulo: 'Desfazer pagamento', ok: 'Desfazer' })) return;
          await Store.salvar('cobrancas', { id, status: 'pendente', pago_em: null, forma: null });
          return this.depois();
        }
        case 'cancelar-cob': {
          if (!await UI.confirmar('A cobrança deixa de contar como dívida. Use para valores negociados ou lançados por engano.', { titulo: 'Cancelar cobrança', ok: 'Cancelar cobrança', perigo: true })) return;
          await Store.salvar('cobrancas', { id, status: 'cancelada' });
          return this.depois();
        }
        case 'nova-cob': return this.formCobranca(id);
        case 'bloquear': return this.bloquear(id);
        case 'desbloquear':
          await Store.salvar('barbearias', { id, bloqueada: false, motivo_bloqueio: '' });
          UI.toast('Acesso desbloqueado.');
          return this.depois();
        case 'liberar': return this.liberar(id);
        case 'inativar': {
          const b = Store.get('barbearias', id);
          if (!await UI.confirmar(`<b>${esc(b.nome)}</b> perde o acesso ao painel e a página de agendamento sai do ar. Os dados continuam guardados e dá para reativar depois.`, { titulo: 'Inativar cliente', ok: 'Inativar', perigo: true })) return;
          await Store.salvar('barbearias', { id, status: 'inativa', inativada_em: Datas.hoje() });
          UI.toast('Cliente inativado.');
          return this.depois();
        }
        case 'reativar':
          await Store.salvar('barbearias', { id, status: 'ativa', bloqueada: false, motivo_bloqueio: '' });
          UI.toast('Cliente reativado.');
          return this.depois();
        case 'ativar': return this.ativar(id);
        case 'estender': {
          const b = Store.get('barbearias', id);
          const base = b.teste_ate && b.teste_ate > Datas.hoje() ? b.teste_ate : Datas.hoje();
          await Store.salvar('barbearias', { id, status: 'teste', teste_ate: Datas.soma(base, 7) });
          UI.toast(`Teste estendido até ${Datas.br(Datas.soma(base, 7))}.`);
          return this.depois();
        }
        case 'novo-pin': {
          const pin = pinAleatorio();
          await Store.salvar('barbearias', { id, pin_dono: pin });
          UI.toast(`Novo PIN do dono: ${pin}`, 'info');
          return this.depois();
        }
        case 'novo-plano': return this.formPlano();
        case 'editar-plano': return this.formPlano(id);
        case 'exportar': return UI.baixar(`bsflow-${Datas.hoje()}.json`, JSON.stringify(Store.db, null, 2), 'application/json');
        case 'restaurar':
          if (!await UI.confirmar('Tudo o que foi feito neste navegador será apagado e os dados de teste voltam ao original.', { titulo: 'Restaurar demonstração', ok: 'Restaurar', perigo: true })) return;
          Store.restaurar();
          UI.toast('Dados de demonstração restaurados.');
          return this.depois();
      }
    } catch (err) { UI.erro(err); }
  },

  cobrar(cid) {
    const c = Store.get('cobrancas', cid), b = Store.get('barbearias', c.barbearia_id);
    if (!b.whatsapp) return UI.toast('Cadastre o WhatsApp do cliente primeiro.', 'erro');
    const texto = Cobranca.mensagem(b, c);
    const m = UI.modal({
      titulo: 'Cobrar no WhatsApp', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:10px">Para <b>${esc(b.responsavel || b.nome)}</b> · ${esc(fmtTel(b.whatsapp))}</p>
        <label class="campo"><span>Mensagem</span><textarea id="msg-cob" rows="7">${esc(texto)}</textarea></label>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ir-whats">${ic('mensagem')} Abrir WhatsApp</button>`
    });
    $('#ir-whats', m.el).onclick = async () => {
      window.open(linkWhats(b.whatsapp, $('#msg-cob', m.el).value), '_blank', 'noopener');
      await Store.salvar('cobrancas', { id: c.id, lembretes: (c.lembretes || 0) + 1, cobrado_em: new Date().toISOString() });
      m.fechar();
      this.depois();
    };
  },

  pagar(cid) {
    const c = Store.get('cobrancas', cid), b = Store.get('barbearias', c.barbearia_id);
    const m = UI.modal({
      titulo: 'Registrar pagamento', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:14px">${esc(b.nome)} · ${cap(Datas.nomeMes(c.referencia))} · <b>${dinheiro(c.valor)}</b></p>
        <form id="f-pag" class="pilha">
          <label class="campo"><span>Data do pagamento</span><input type="date" name="data" value="${Datas.hoje()}" max="${Datas.hoje()}"></label>
          <label class="campo"><span>Forma</span><select name="forma"><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option></select></label>
        </form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ok" id="conf-pag">${ic('check')} Confirmar pagamento</button>`
    });
    $('#conf-pag', m.el).onclick = async () => {
      try {
        const f = UI.form($('#f-pag', m.el));
        const antes = Cobranca.situacao(b);
        await Store.salvar('cobrancas', { id: c.id, status: 'paga', pago_em: f.data || Datas.hoje(), forma: f.forma });
        const depois = Cobranca.situacao(Store.get('barbearias', b.id));
        UI.toast(!antes.acesso && depois.acesso ? 'Pagamento registrado. O acesso foi liberado.' : 'Pagamento registrado.');
        m.fechar();
        this.depois();
      } catch (err) { UI.erro(err); }
    };
  },

  formCobranca(bid) {
    const b = Store.get('barbearias', bid);
    const m = UI.modal({
      titulo: 'Cobrança avulsa', classe: 'pequeno',
      corpo: `<form id="f-cob" class="pilha">
        <label class="campo"><span>Descrição</span><input name="descricao" placeholder="Ex.: taxa de implantação" autofocus></label>
        <div class="grade-form"><label class="campo"><span>Valor (R$)</span><input name="valor" inputmode="decimal" value="${numBR(b.valor_mensal)}"></label>
        <label class="campo"><span>Vencimento</span><input type="date" name="vencimento" value="${Datas.soma(Datas.hoje(), 5)}"></label></div></form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-cob">Criar cobrança</button>`
    });
    $('#salvar-cob', m.el).onclick = async () => {
      const f = UI.form($('#f-cob', m.el));
      const valor = lerDinheiro(f.valor);
      if (!(valor > 0) || !f.vencimento) return UI.toast('Informe valor e vencimento.', 'erro');
      await Store.salvar('cobrancas', { barbearia_id: bid, referencia: Datas.mes(f.vencimento), descricao: f.descricao, valor, vencimento: f.vencimento, status: 'pendente' });
      m.fechar();
      this.depois();
    };
  },

  bloquear(id) {
    const b = Store.get('barbearias', id);
    const m = UI.modal({
      titulo: 'Bloquear acesso', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:12px"><b>${esc(b.nome)}</b> fica sem acesso ao painel e o agendamento online é pausado até você desbloquear.</p>
        <label class="campo"><span>Motivo (aparece para o cliente)</span><textarea id="motivo-bl" rows="3">Mensalidade em atraso. Fale com o suporte para regularizar.</textarea></label>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn perigo" id="conf-bl">${ic('cadeado')} Bloquear</button>`
    });
    $('#conf-bl', m.el).onclick = async () => {
      await Store.salvar('barbearias', { id, bloqueada: true, motivo_bloqueio: $('#motivo-bl', m.el).value.trim() });
      UI.toast('Acesso bloqueado.');
      m.fechar();
      this.depois();
    };
  },

  liberar(id) {
    const b = Store.get('barbearias', id);
    const m = UI.modal({
      titulo: 'Liberar acesso', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:12px">A mensalidade continua em aberto, mas <b>${esc(b.nome)}</b> volta a usar o sistema até a data combinada.</p>
        <div class="opcoes-grade">${[2, 3, 5, 7, 10].map(n => `<button class="op-btn" data-dias="${n}">${n} dias <small>até ${Datas.brCurta(Datas.soma(Datas.hoje(), n))}</small></button>`).join('')}</div>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button>`
    });
    m.el.querySelectorAll('[data-dias]').forEach(bt => bt.onclick = async () => {
      const ate = Datas.soma(Datas.hoje(), Number(bt.dataset.dias));
      await Store.salvar('barbearias', { id, liberado_ate: ate });
      UI.toast(`Liberada até ${Datas.br(ate)}.`);
      m.fechar();
      this.depois();
    });
  },

  async ativar(id) {
    const b = Store.get('barbearias', id);
    const hoje = Datas.hoje();
    let ref = Datas.mes(hoje);
    if (Cobranca.vencimentoDe(b, ref) < hoje) ref = Datas.somaMes(ref, 1);
    const venc = Cobranca.vencimentoDe(b, ref);
    if (!await UI.confirmar(`<b>${esc(b.nome)}</b> sai do teste e passa a pagar <b>${dinheiro(b.valor_mensal)}</b> por mês. A primeira cobrança vence em <b>${Datas.br(venc)}</b>.`, { titulo: 'Ativar assinatura', ok: 'Ativar' })) return;
    await Store.salvar('barbearias', { id, status: 'ativa', teste_ate: null, bloqueada: false });
    if (!Store.de('cobrancas', id).some(c => c.referencia === ref && c.status !== 'cancelada'))
      await Store.salvar('cobrancas', { barbearia_id: id, referencia: ref, valor: b.valor_mensal, vencimento: venc, status: 'pendente' });
    UI.toast('Assinatura ativada.');
    this.depois();
  },

  formBB(id) {
    if (!id && this.oficial()) {
      const link = location.href.split('#')[0] + '#/contratar';
      const m = UI.modal({ titulo: 'Novo cliente', classe: 'pequeno',
        corpo: `<p class="texto-modal">Na versão oficial o cliente se cadastra pela página de contratação: escolhe o plano, cria o login e já começa o teste grátis. Mande o link para ele ou preencha junto com ele.</p><div class="link-caixa" style="margin-top:12px"><code>${esc(link)}</code></div>`,
        rodape: `<button class="btn" data-fechar>Fechar</button><button class="btn" id="cp-contratar">${ic('copiar')} Copiar link</button><a class="btn pri" href="#/contratar" target="_blank">${ic('externo')} Abrir</a>` });
      $('#cp-contratar', m.el).onclick = () => UI.copiar(link);
      return;
    }
    const b = id ? Store.get('barbearias', id) : null;
    const planos = Store.t('planos');
    const v = (k, d = '') => esc(b ? b[k] ?? d : d);
    const m = UI.modal({
      titulo: b ? 'Editar cliente' : 'Novo cliente', classe: 'largo', fixo: true,
      corpo: `<form id="f-bb" class="grade-form" autocomplete="off">
        <label class="campo"><span>Nome do estabelecimento</span><input name="nome" value="${v('nome')}" required autofocus></label>
        <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS_ESTAB).map(([k, t]) => `<option value="${k}" ${(b?.tipo || 'barbearia') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Endereço do link</span><input name="slug" value="${v('slug')}" pattern="[a-z0-9-]{3,40}" required><small>O cliente agenda em …/#/<b id="slug-prev">${v('slug', 'nome-do-estabelecimento')}</b></small></label>
        <label class="campo"><span>Responsável</span><input name="responsavel" value="${v('responsavel')}"></label>
        <label class="campo"><span>WhatsApp do responsável</span><input name="whatsapp" data-tel inputmode="tel" value="${esc(fmtTel(b?.whatsapp || ''))}"></label>
        <label class="campo"><span>E-mail</span><input name="email" type="email" value="${v('email')}"></label>
        <label class="campo"><span>Cidade</span><input name="cidade" value="${v('cidade')}" placeholder="Ex.: Niterói - RJ"></label>
        <label class="campo inteiro"><span>Endereço</span><input name="endereco" value="${v('endereco')}"></label>
        <label class="campo"><span>Plano</span><select name="plano_id">${planos.map(p => `<option value="${p.id}" data-preco="${p.preco}" ${(b?.plano_id || 'pl_equipe') === p.id ? 'selected' : ''}>${esc(p.nome)} — ${dinheiro(p.preco)}</option>`).join('')}</select></label>
        <div class="grade-form" style="gap:14px">
          <label class="campo"><span>Mensalidade (R$)</span><input name="valor_mensal" inputmode="decimal" value="${numBR(b ? b.valor_mensal : (planos.find(p => p.id === 'pl_equipe') || planos[0]).preco)}"></label>
          <label class="campo"><span>Vence todo dia</span><select name="dia_vencimento">${[1, 5, 10, 15, 20, 25, 28].map(d => `<option ${(b?.dia_vencimento || 10) === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        </div>
        ${b ? '' : `
        <label class="campo"><span>Período de teste grátis</span><select name="teste"><option value="0">Sem teste: já começa cobrando</option><option value="7">7 dias</option><option value="14" selected>14 dias</option><option value="30">30 dias</option></select></label>
        <div class="campo" style="justify-content:flex-end;gap:10px">
          <label class="check"><input type="checkbox" name="cria_barbeiro" checked> O responsável também atende (entra na agenda)</label>
          <label class="check"><input type="checkbox" name="cria_servicos" checked> Começar com os serviços mais comuns do tipo escolhido</label>
        </div>`}
        <label class="campo inteiro"><span>Observações internas</span><textarea name="obs" rows="2">${v('obs')}</textarea></label>
      </form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-bb">${ic('check')} ${b ? 'Salvar' : 'Cadastrar cliente'}</button>`
    });
    const f = $('#f-bb', m.el);
    let slugMexido = !!b;
    f.nome.oninput = () => { if (!slugMexido) { f.slug.value = slugify(f.nome.value); $('#slug-prev', m.el).textContent = f.slug.value || 'nome-do-estabelecimento'; } };
    f.slug.oninput = () => { slugMexido = true; f.slug.value = f.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); $('#slug-prev', m.el).textContent = f.slug.value; };
    f.plano_id.onchange = () => { f.valor_mensal.value = numBR(f.plano_id.selectedOptions[0].dataset.preco); };
    $('#salvar-bb', m.el).onclick = async () => {
      try {
        const d = UI.form(f);
        if (d.nome.length < 2) throw new Error('Informe o nome do estabelecimento.');
        if (!/^[a-z0-9-]{3,40}$/.test(d.slug)) throw new Error('O endereço do link precisa ter de 3 a 40 letras minúsculas, números ou hífen.');
        if (SLUGS_RESERVADOS.includes(d.slug)) throw new Error('Esse endereço é reservado pelo sistema. Escolha outro.');
        if (Store.t('barbearias').some(x => x.slug === d.slug && x.id !== id)) throw new Error('Já existe um cliente com esse endereço.');
        const tel = soDigitos(d.whatsapp);
        if (tel && ![10, 11].includes(tel.length)) throw new Error('Confira o WhatsApp: DDD + número.');
        const dados = {
          nome: d.nome, tipo: d.tipo, slug: d.slug, responsavel: d.responsavel, whatsapp: tel, email: d.email, cidade: d.cidade, endereco: d.endereco,
          plano_id: d.plano_id, valor_mensal: lerDinheiro(d.valor_mensal), dia_vencimento: Number(d.dia_vencimento), obs: d.obs
        };
        if (b) {
          await Store.salvar('barbearias', { id, ...dados });
          UI.toast('Dados salvos.');
          m.fechar();
          return this.depois();
        }
        const dias = Number(d.teste);
        const nova = await Store.salvar('barbearias', Modelos.barbearia({
          ...dados, id: uid('bb_'), status: dias ? 'teste' : 'ativa', teste_ate: dias ? Datas.soma(Datas.hoje(), dias) : null
        }));
        if (!dias) {
          let ref = Datas.mes(Datas.hoje());
          if (Cobranca.vencimentoDe(nova, ref) < Datas.hoje()) ref = Datas.somaMes(ref, 1);
          await Store.salvar('cobrancas', { barbearia_id: nova.id, referencia: ref, valor: nova.valor_mensal, vencimento: Cobranca.vencimentoDe(nova, ref), status: 'pendente' });
        }
        if (d.cria_barbeiro && d.responsavel)
          await Store.salvar('barbeiros', { barbearia_id: nova.id, nome: d.responsavel, telefone: tel, pin: pinAleatorio(), comissao: 0, cor: '#c9a227', servicos: [], horario: null, ativo: true, foto: null, ordem: 0 });
        if (d.cria_servicos) for (const s of Modelos.servicosPadrao(nova.id, d.tipo)) await Store.salvar('servicos', s);
        m.fechar();
        this.depois();
        this.boasVindas(nova);
      } catch (err) { UI.erro(err); }
    };
  },
  boasVindas(b) {
    const msg = `Olá, ${primeiroNome(b.responsavel) || 'tudo bem'}! ${b.nome} já está no ${APP.nome}.\n\nPainel (agenda, serviços e faturamento): ${UI.linkPainel(b)}\nPIN de acesso do dono: ${b.pin_dono}\n\nLink para seus clientes agendarem: ${UI.linkCliente(b)}`;
    const m = UI.modal({
      titulo: 'Cliente cadastrado', classe: 'pequeno',
      corpo: `<div class="vazio" style="padding:8px 0 16px">${ic('check')}<b>Tudo pronto para ${esc(b.nome)}</b><p>Envie o acesso para o responsável.</p></div>
        <dl class="info-lista"><dt>PIN do dono</dt><dd><b style="font-size:20px;letter-spacing:.15em">${esc(b.pin_dono)}</b></dd>
        <dt>Painel</dt><dd><a href="#/${esc(b.slug)}/painel" target="_blank">/${esc(b.slug)}/painel</a></dd><dt>Clientes</dt><dd><a href="#/${esc(b.slug)}" target="_blank">/${esc(b.slug)}</a></dd></dl>`,
      rodape: `<button class="btn" data-fechar>Fechar</button>${b.whatsapp ? `<a class="btn pri" href="${linkWhats(b.whatsapp, msg)}" target="_blank" rel="noopener">${ic('mensagem')} Enviar no WhatsApp</a>` : ''}`
    });
  },

  formPlano(id) {
    const p = id ? Store.get('planos', id) : null;
    const emUso = p ? Store.t('barbearias').filter(b => b.plano_id === p.id).length : 0;
    const m = UI.modal({
      titulo: p ? 'Editar plano' : 'Novo plano', classe: 'pequeno',
      corpo: `<form id="f-plano" class="pilha">
        <label class="campo"><span>Nome</span><input name="nome" value="${esc(p?.nome || '')}" autofocus></label>
        <div class="grade-form"><label class="campo"><span>Preço (R$/mês)</span><input name="preco" inputmode="decimal" value="${numBR(p?.preco || 0)}"></label>
        <label class="campo"><span>Máximo de profissionais</span><input name="max" type="number" min="0" value="${p?.max_barbeiros ?? 1}"><small>0 = sem limite</small></label></div>
        <label class="campo"><span>Descrição</span><input name="descricao" value="${esc(p?.descricao || '')}"></label>
        <div class="campo"><span>O que o plano libera <small>(agenda, chat, clientes, catálogo e faturamento estão em todos)</small></span>
          <div class="lista-chaves">${Object.entries(RECURSOS).map(([k, r]) => `<label class="chave"><input type="checkbox" name="rec" value="${k}" ${p?.recursos?.includes(k) ? 'checked' : ''}><i></i><span>${esc(r.nome)}<small class="muted" style="display:block">${esc(r.desc)}</small></span></label>`).join('')}</div></div>
        ${p ? '<p class="ajuda">Mudar o preço vale para clientes novos. Os atuais mantêm o valor deles. Os recursos mudam na hora para todos do plano.</p>' : ''}
      </form>`,
      rodape: `${p && !emUso ? `<button class="btn perigo-txt esq" id="del-plano">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-plano">Salvar</button>`
    });
    $('#salvar-plano', m.el).onclick = async () => {
      const d = UI.form($('#f-plano', m.el));
      if (!d.nome) return UI.toast('Dê um nome ao plano.', 'erro');
      await Store.salvar('planos', { ...(p ? { id } : { id: uid('pl_') }), nome: d.nome, preco: lerDinheiro(d.preco), max_barbeiros: Math.max(0, Number(d.max) || 0), descricao: d.descricao,
        recursos: $$('[name="rec"]:checked', m.el).map(i => i.value) });
      m.fechar();
      this.depois();
    };
    const del = $('#del-plano', m.el);
    if (del) del.onclick = async () => { await Store.remover('planos', id); m.fechar(); this.depois(); };
  },

  async salvarAjustes(f) {
    const d = UI.form(f);
    const patch = {
      chave_pix: d.chave_pix, suporte_whatsapp: soDigitos(d.suporte_whatsapp), bloqueio_auto: !!f.bloqueio_auto.checked,
      tolerancia_dias: Math.max(0, Number(d.tolerancia_dias) || 0), msg_lembrete: d.msg_lembrete, msg_atraso: d.msg_atraso
    };
    if (d.senha_nova) {
      if (d.senha_nova.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.');
      patch.senha_admin = d.senha_nova;
    }
    await Store.config(patch);
    UI.toast('Ajustes salvos.');
    this.pintar();
  }
};
