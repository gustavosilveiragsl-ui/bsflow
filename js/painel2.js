'use strict';
/* ============================================================
   Painel — promoções, fidelidade, mensalistas, fechar o dia,
   atendimento sem agendamento, pagamento pelo app, mensagens automáticas
   ============================================================ */
const CHIP_DIAS = (nome, marcados = []) => `<div class="dias-sel">${ORDEM_DIAS.map(d => `<label><input type="checkbox" name="${nome}" value="${d}" ${marcados.includes(d) ? 'checked' : ''}><span>${DIAS_CURTOS[d]}</span></label>`).join('')}</div>`;
const lerDias = (raiz, nome) => $$(`[name="${nome}"]:checked`, raiz).map(i => +i.value);
const CHECKS_ITENS = (nome, itens, marcados = []) => `<div class="opcoes-grade">${itens.map(s => `<label class="op-btn" style="cursor:pointer"><input type="checkbox" name="${nome}" value="${s.id}" ${marcados.includes(s.id) ? 'checked' : ''} style="accent-color:var(--accent)"> ${esc(s.nome)} <small>${dinheiro(s.preco)}</small></label>`).join('')}</div>`;

Object.assign(Painel, {
  promoFiltro: 'ativa', mensAba: 'clientes', mensMes: null, msgAba: 'proximas',

  /* ============================ PROMOÇÕES ============================ */
  v_promocoes() {
    const b = this.b, hoje = Datas.hoje();
    const todas = Promocoes.todas(b);
    const filtros = { ativa: 'Valendo', agendada: 'Vão começar', encerrada: 'Encerradas e pausadas', todas: 'Todas' };
    const lista = todas.filter(p => {
      const s = Promocoes.situacao(p, hoje).cod;
      return this.promoFiltro === 'todas' || s === this.promoFiltro || (this.promoFiltro === 'encerrada' && s === 'pausada');
    });
    const uso = id => Store.de('agendamentos', b.id).filter(a => (a.promo_ids || []).includes(id) && a.status !== 'cancelado');
    return `<div class="topo"><div><h1>Promoções</h1><p class="sub">Descontos com prazo e regras. As marcadas para divulgar aparecem no chat de agendamento.</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="nova-promo">${ic('mais')} Nova promoção</button></div></div>
      <div class="barra-filtros"><div class="fichas">${Object.entries(filtros).map(([k, v]) => `<button class="ficha ${this.promoFiltro === k ? 'on' : ''}" data-a="promo-filtro" data-v="${k}">${v} <span class="cont">${k === 'todas' ? todas.length : todas.filter(p => { const s = Promocoes.situacao(p, hoje).cod; return s === k || (k === 'encerrada' && s === 'pausada'); }).length}</span></button>`).join('')}</div></div>
      ${lista.length ? `<div class="promo-grade">${lista.map(p => {
        const s = Promocoes.situacao(p, hoje), us = uso(p.id), crit = Promocoes.criterios(p);
        return `<button class="promo-card ${s.cod === 'ativa' ? '' : 'apagada'}" data-a="editar-promo" data-id="${p.id}">
          <div class="promo-topo"><span class="promo-rotulo">${esc(Promocoes.rotulo(p))}</span>${UI.badge(s.texto, s.tom)}</div>
          <b class="promo-nome">${esc(p.nome)}</b>
          <p>${esc(p.descricao || '')}</p>
          <div class="promo-dados">
            <span>${ic('tesoura')} ${esc(Promocoes.alvoTexto(b, p))}</span>
            <span>${ic('calendario')} ${Datas.brCurta(p.inicio)} a ${Datas.brCurta(p.fim)}</span>
            ${crit.length ? `<span>${ic('info')} ${esc(crit.join(' · '))}</span>` : ''}
            <span>${ic(p.divulgar !== false ? 'mensagem' : 'olho')} ${p.divulgar !== false ? 'Divulgada no chat' : 'Não aparece no chat'}</span>
          </div>
          <div class="promo-uso">${us.length} agendamento${us.length === 1 ? '' : 's'} com a promoção</div>
        </button>`;
      }).join('')}</div>` : `<div class="card">${UI.vazio('brilho', 'Nenhuma promoção aqui', 'Crie descontos por período, dia da semana, horário ou pagamento antecipado.', `<button class="btn pri" data-a="nova-promo">${ic('mais')} Nova promoção</button>`)}</div>`}`;
  },
  formPromo(id) {
    const b = this.b, p = id ? Store.get('promocoes', id) : null, c = p?.criterios || {};
    const pag = Pagamentos.config(b);
    const hoje = Datas.hoje();
    const m = UI.modal({
      titulo: p ? 'Editar promoção' : 'Nova promoção', classe: 'largo', fixo: true,
      corpo: `<form id="f-promo" class="pilha">
        <div class="grade-form">
          <label class="campo"><span>Nome</span><input name="nome" value="${esc(p?.nome || '')}" placeholder="Ex.: Semana do degradê" autofocus></label>
          <label class="campo"><span>Desconto</span><div style="display:flex;gap:8px"><input name="valor" inputmode="decimal" value="${p ? numBR(p.valor).replace(',00', '') : ''}" placeholder="20" style="flex:1"><select name="tipo" style="width:auto"><option value="percentual" ${p?.tipo !== 'valor' ? 'selected' : ''}>%</option><option value="valor" ${p?.tipo === 'valor' ? 'selected' : ''}>R$</option></select></div></label>
          <label class="campo inteiro"><span>Texto que o cliente lê</span><input name="descricao" value="${esc(p?.descricao || '')}" placeholder="Ex.: 20% no degradê de terça e quarta de manhã"></label>
          <label class="campo"><span>Começa em</span><input type="date" name="inicio" value="${p?.inicio || hoje}"></label>
          <label class="campo"><span>Termina em</span><input type="date" name="fim" value="${p?.fim || Datas.soma(hoje, 7)}"></label>
        </div>
        <div class="secao-modal"><h4>Vale para</h4>
          <div class="seg" id="promo-alvo">${[['servicos', 'Serviços'], ['produtos', 'Produtos'], ['tudo', 'Tudo']].map(([k, t]) => `<button type="button" class="${(p?.alvo || 'servicos') === k ? 'on' : ''}" data-alvo="${k}">${t}</button>`).join('')}</div>
          <div id="promo-itens" style="margin-top:10px"></div>
          <p class="ajuda" style="margin-top:6px">Sem nenhum marcado, vale para todos.</p></div>
        <div class="secao-modal"><h4>Regras para ganhar o desconto</h4>
          <div class="campo"><span>Dias da semana <small>(nenhum = todos)</small></span>${CHIP_DIAS('dias', c.dias || [])}</div>
          <div class="grade-form" style="margin-top:12px">
            <label class="campo"><span>A partir das <small>(opcional)</small></span><input type="time" name="hora_ini" value="${c.hora_ini != null ? Datas.hhmm(c.hora_ini) : ''}"></label>
            <label class="campo"><span>Até as <small>(opcional)</small></span><input type="time" name="hora_fim" value="${c.hora_fim != null ? Datas.hhmm(c.hora_fim) : ''}"></label>
            <label class="campo"><span>Valor mínimo do atendimento <small>(opcional)</small></span><input name="minimo" inputmode="decimal" value="${c.minimo ? numBR(c.minimo) : ''}" placeholder="0,00"></label>
          </div>
          <div class="lista-chaves" style="margin-top:12px">
            <label class="chave"><input type="checkbox" name="antecipado" ${c.antecipado ? 'checked' : ''}><i></i><span>Só pagando antecipado pelo app${pag.modo === 'desligado' ? ' <small class="muted">(ligue o pagamento pelo app em Ajustes)</small>' : ''}</span></label>
            <label class="chave"><input type="checkbox" name="so_online" ${c.so_online ? 'checked' : ''}><i></i><span>Só agendando pelo chat</span></label>
            <label class="chave"><input type="checkbox" name="primeira_visita" ${c.primeira_visita ? 'checked' : ''}><i></i><span>Só na primeira visita do cliente</span></label>
          </div></div>
        <div class="secao-modal"><div class="lista-chaves">
          <label class="chave"><input type="checkbox" name="divulgar" ${p?.divulgar !== false ? 'checked' : ''}><i></i><span>Divulgar no chat de agendamento</span></label>
          <label class="chave"><input type="checkbox" name="ativo" ${p?.ativo !== false ? 'checked' : ''}><i></i><span>Promoção ativa</span></label>
        </div><div class="det-nota" id="promo-prev" style="margin-top:12px"></div></div>
      </form>`,
      rodape: `${p ? `<button class="btn perigo-txt esq" id="del-promo">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-promo">${ic('check')} Salvar</button>`
    });
    const f = $('#f-promo', m.el);
    let alvo = p?.alvo || 'servicos', itens = [...(p?.itens || [])];
    const ler = () => {
      const d = UI.form(f);
      return {
        nome: d.nome, descricao: d.descricao, alvo, itens: $$('[name="item"]:checked', f).map(i => i.value), tipo: d.tipo, valor: lerDinheiro(d.valor),
        inicio: d.inicio, fim: d.fim, divulgar: f.divulgar.checked, ativo: f.ativo.checked,
        criterios: {
          dias: lerDias(f, 'dias'), hora_ini: d.hora_ini ? Datas.min(d.hora_ini) : null, hora_fim: d.hora_fim ? Datas.min(d.hora_fim) : null,
          minimo: lerDinheiro(d.minimo) || null, antecipado: f.antecipado.checked, so_online: f.so_online.checked, primeira_visita: f.primeira_visita.checked
        }
      };
    };
    const desenharItens = () => {
      const lista = alvo === 'produtos' ? Agenda.produtos(b) : alvo === 'servicos' ? Agenda.servicos(b) : [];
      $('#promo-itens', m.el).innerHTML = alvo === 'tudo' ? '<p class="ajuda">Vale para todos os serviços e produtos.</p>' : CHECKS_ITENS('item', lista, itens);
    };
    const previa = () => {
      const x = ler();
      if (!x.nome || !x.valor) { $('#promo-prev', m.el).innerHTML = `${ic('info')}<span>Preencha o nome e o desconto para ver como fica no chat.</span>`; return; }
      const crit = Promocoes.criterios(x);
      $('#promo-prev', m.el).innerHTML = `${ic('mensagem')}<span>No chat: <b>${esc(x.nome)}</b> · ${esc(Promocoes.rotulo(x))} em ${esc(Promocoes.alvoTexto(b, x).toLowerCase())}${crit.length ? ` (${esc(crit.join(', '))})` : ''}, ${esc(Promocoes.periodo(x))}.</span>`;
    };
    desenharItens(); previa();
    m.el.onclick = e => {
      const a = e.target.closest('[data-alvo]');
      if (a) { itens = $$('[name="item"]:checked', f).map(i => i.value); alvo = a.dataset.alvo; $$('[data-alvo]', m.el).forEach(x => x.classList.toggle('on', x === a)); if (alvo !== (p?.alvo || '')) itens = []; desenharItens(); previa(); }
    };
    f.oninput = previa; f.onchange = previa;
    $('#salvar-promo', m.el).onclick = async () => {
      try {
        const x = ler();
        if (!x.nome) throw new Error('Dê um nome para a promoção.');
        if (!(x.valor > 0)) throw new Error('Informe o desconto.');
        if (x.tipo === 'percentual' && x.valor > 100) throw new Error('O desconto em % vai até 100.');
        if (!x.inicio || !x.fim || x.fim < x.inicio) throw new Error('Confira as datas: o fim precisa ser depois do começo.');
        if (x.criterios.hora_ini != null && x.criterios.hora_fim != null && x.criterios.hora_fim <= x.criterios.hora_ini) throw new Error('Confira o horário da promoção.');
        await Store.salvar('promocoes', { ...(p ? { id } : { barbearia_id: b.id }), ...x });
        UI.toast('Promoção salva.');
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
    const del = $('#del-promo', m.el);
    if (del) del.onclick = async () => {
      if (!await UI.confirmar(`Excluir a promoção <b>${esc(p.nome)}</b>? Os agendamentos que já usaram continuam com o desconto.`, { titulo: 'Excluir promoção', ok: 'Excluir', perigo: true })) return;
      await Store.remover('promocoes', id); m.fechar(); this.pintar();
    };
  },

  /* ============================ FIDELIDADE ============================ */
  abasClientes() {
    if (!this.eDono()) return '';
    const a = this.cliAba || 'lista';
    return `<div class="barra-filtros"><div class="seg"><a class="btn fantasma peq ${a === 'lista' ? 'on-seg' : ''}" href="${this.h('clientes')}">${ic('usuarios')} Clientes</a><a class="btn fantasma peq ${a === 'fidelidade' ? 'on-seg' : ''}" href="${this.h('clientes/fidelidade')}">${ic('estrela')} Fidelidade</a></div></div>`;
  },
  v_fidelidade() {
    const b = this.b, progs = Fidelidade.programas(b, { todos: true });
    const ativos = progs.filter(p => p.ativo !== false);
    const clientes = this.dadosClientes().filter(c => c.tel && c.visitas);
    const perto = [];
    for (const prog of ativos) for (const c of clientes) {
      const pos = Fidelidade.posicao(b, prog, c.tel, Datas.hoje(), Datas.agoraMin());
      if (pos.feitas) perto.push({ c, prog, pos });
    }
    perto.sort((x, y) => x.pos.falta - y.pos.falta || y.pos.feitas - x.pos.feitas);
    return `<div class="topo"><div><h1>Fidelidade</h1><p class="sub">Recompense quem sempre volta. O desconto entra sozinho no atendimento certo.</p></div>
        <div class="topo-acoes"><button class="btn pri" data-a="nova-fid">${ic('mais')} Novo programa</button></div></div>
      ${this.abasClientes()}
      ${progs.length ? `<div class="fid-grade">${progs.map(p => `<button class="fid-card ${p.ativo === false ? 'apagada' : ''}" data-a="editar-fid" data-id="${p.id}">
          <div class="promo-topo"><span class="promo-rotulo">${ic('estrela')} ${esc(p.nome)}</span>${p.ativo === false ? UI.badge('Pausado', 'neutro') : UI.badge('Ativo', 'ok')}</div>
          <p><b>${esc(Fidelidade.texto(p))}</b></p>
          <div class="selos">${[...Array(Math.min(p.a_cada, 12))].map((_, i) => `<i class="${i === Math.min(p.a_cada, 12) - 1 ? 'premio' : ''}">${i === Math.min(p.a_cada, 12) - 1 ? ic('estrela') : ''}</i>`).join('')}</div>
          <small class="muted">Contam: ${p.servicos?.length ? esc(p.servicos.map(id => Store.get('servicos', id)?.nome).filter(Boolean).join(', ')) : 'todos os serviços'}${p.desde ? ` · desde ${Datas.br(p.desde)}` : ''}</small>
        </button>`).join('')}</div>`
        : `<div class="card">${UI.vazio('estrela', 'Nenhum programa de fidelidade', 'Exemplo: a cada 10 cortes, o 10º com 20% de desconto.', `<button class="btn pri" data-a="nova-fid">${ic('mais')} Criar programa</button>`)}</div>`}
      ${ativos.length ? `<div class="card" style="margin-top:14px"><div class="card-cab"><div><h3>Quem está perto do prêmio</h3><p>Mande uma mensagem para trazer o cliente de volta</p></div></div>
        ${perto.length ? `<div class="linhas">${perto.slice(0, 40).map(({ c, prog, pos }) => {
          const msg = pos.ganhaAgora
            ? `Oi, ${primeiroNome(c.nome)}! No seu próximo atendimento aqui em ${b.nome} você ${Fidelidade.premio(prog).replace('tem', 'ganha')}. Agende pelo link: ${UI.linkCliente(b)}`
            : `Oi, ${primeiroNome(c.nome)}! Faltam só ${pos.falta + 1} visita(s) para você ganhar o prêmio do ${prog.nome} em ${b.nome}. Agende pelo link: ${UI.linkCliente(b)}`;
          return `<div class="linha">${UI.avatar(c.nome, null, '#57514a')}
            <div class="linha-txt"><b>${esc(c.nome)}</b><small>${esc(prog.nome)} · ${pos.noCiclo} de ${prog.a_cada}${pos.ganhaAgora ? ' · ganha no próximo' : ` · faltam ${pos.falta + 1}`}</small>
              <div class="parte-trilho" style="max-width:260px"><div style="width:${Math.round((pos.noCiclo / prog.a_cada) * 100)}%"></div></div></div>
            <div class="linha-fim">${pos.ganhaAgora ? UI.badge('Prêmio no próximo', 'ok', 'estrela') : ''}<a class="btn peq" href="${linkWhats(c.tel, msg)}" target="_blank" rel="noopener">${ic('mensagem')} Avisar</a></div></div>`;
        }).join('')}</div>` : '<p class="muted">Ninguém começou a juntar ainda.</p>'}</div>` : ''}`;
  },
  formFidelidade(id) {
    const b = this.b, p = id ? Store.get('fidelidades', id) : null;
    const m = UI.modal({
      titulo: p ? 'Editar programa de fidelidade' : 'Novo programa de fidelidade', fixo: true,
      corpo: `<form id="f-fid" class="pilha">
        <label class="campo"><span>Nome</span><input name="nome" value="${esc(p?.nome || 'Cartão fidelidade')}" autofocus></label>
        <div class="grade-form">
          <label class="campo"><span>A cada quantas visitas</span><input type="number" name="a_cada" min="2" max="50" value="${p?.a_cada || 10}"></label>
          <label class="campo"><span>Chamar de</span><select name="rotulo">${['cortes', 'visitas', 'atendimentos'].map(r => `<option ${(p?.rotulo || 'cortes') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="campo"><span>Prêmio</span><select name="tipo"><option value="percentual" ${p?.tipo !== 'valor' && p?.tipo !== 'gratis' ? 'selected' : ''}>Desconto em %</option><option value="valor" ${p?.tipo === 'valor' ? 'selected' : ''}>Desconto em R$</option><option value="gratis" ${p?.tipo === 'gratis' ? 'selected' : ''}>Sai de graça</option></select></label>
          <label class="campo" id="fid-valor"><span>Valor do desconto</span><input name="valor" inputmode="decimal" value="${p ? numBR(p.valor || 0).replace(',00', '') : '20'}"></label>
        </div>
        <div class="campo"><span>Serviços que contam <small>(nenhum = todos)</small></span>${CHECKS_ITENS('sv', Agenda.servicos(b), p?.servicos || [])}</div>
        <label class="campo"><span>Contar visitas a partir de <small>(opcional)</small></span><input type="date" name="desde" value="${p?.desde || ''}"><small>Deixe em branco para contar todo o histórico do cliente.</small></label>
        <label class="chave"><input type="checkbox" name="ativo" ${p?.ativo !== false ? 'checked' : ''}><i></i><span>Programa ativo</span></label>
        <div class="det-nota" id="fid-prev"></div>
      </form>`,
      rodape: `${p ? `<button class="btn perigo-txt esq" id="del-fid">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-fid">${ic('check')} Salvar</button>`
    });
    const f = $('#f-fid', m.el);
    const ler = () => ({ nome: f.nome.value.trim(), a_cada: Math.max(2, Math.min(50, +f.a_cada.value || 10)), rotulo: f.rotulo.value, tipo: f.tipo.value,
      valor: f.tipo.value === 'gratis' ? 0 : lerDinheiro(f.valor.value), servicos: $$('[name="sv"]:checked', f).map(i => i.value), desde: f.desde.value || null, ativo: f.ativo.checked });
    const previa = () => { const x = ler(); $('#fid-valor', m.el).hidden = x.tipo === 'gratis'; $('#fid-prev', m.el).innerHTML = `${ic('estrela')}<span>${esc(Fidelidade.texto(x))}</span>`; };
    previa();
    f.oninput = previa; f.onchange = previa;
    $('#salvar-fid', m.el).onclick = async () => {
      try {
        const x = ler();
        if (!x.nome) throw new Error('Dê um nome ao programa.');
        if (x.tipo !== 'gratis' && !(x.valor > 0)) throw new Error('Informe o desconto do prêmio.');
        if (x.tipo === 'percentual' && x.valor > 100) throw new Error('O desconto em % vai até 100.');
        await Store.salvar('fidelidades', { ...(p ? { id } : { barbearia_id: b.id }), ...x });
        UI.toast('Programa salvo.'); m.fechar(); this.pintar();
      } catch (err) { UI.erro(err); }
    };
    const del = $('#del-fid', m.el);
    if (del) del.onclick = async () => {
      if (!await UI.confirmar(`Excluir <b>${esc(p.nome)}</b>? A contagem dos clientes deixa de aparecer.`, { titulo: 'Excluir programa', ok: 'Excluir', perigo: true })) return;
      await Store.remover('fidelidades', id); m.fechar(); this.pintar();
    };
  },

  /* ============================ MENSALISTAS ============================ */
  v_mensalistas() {
    const b = this.b, hoje = Datas.hoje(), mes = Datas.mes(hoje);
    this.mensMes ||= mes;
    const abas = `<div class="barra-filtros"><div class="seg">${[['clientes', 'usuarios', 'Mensalistas'], ['planos', 'coroa', 'Planos'], ['cobrancas', 'recibo', 'Cobranças']].map(([k, i, t]) => `<button class="${this.mensAba === k ? 'on' : ''}" data-a="mens-aba" data-v="${k}">${ic(i)} ${t}</button>`).join('')}</div></div>`;
    const topo = `<div class="topo"><div><h1>Mensalistas</h1><p class="sub">Clientes com plano mensal: valor fixo, atendimentos liberados no mês e cobrança todo mês.</p></div>
        <div class="topo-acoes">${this.mensAba === 'planos' ? `<button class="btn pri" data-a="novo-plano-m">${ic('mais')} Novo plano</button>` : `<button class="btn pri" data-a="novo-mens">${ic('mais')} Novo mensalista</button>`}</div></div>`;
    return topo + abas + (this.mensAba === 'planos' ? this.mensPlanos() : this.mensAba === 'cobrancas' ? this.mensCobrancas() : this.mensClientes());
  },
  avisoMensalistas() {
    if (!this.eDono() || !Planos.tem(this.b, 'mensalistas')) return '';
    const atr = Mensal.assinantes(this.b).filter(m => m.status === 'ativo' && Mensal.situacao(this.b, m).cod === 'atrasado');
    if (!atr.length) return '';
    return `<div class="aviso-faixa ruim">${ic('alerta')}<span><b>${atr.length} mensalista${atr.length > 1 ? 's' : ''}</b> com mensalidade em atraso: ${esc(atr.slice(0, 3).map(m => primeiroNome(m.cliente_nome)).join(', '))}${atr.length > 3 ? '…' : ''}.</span><a class="btn peq" href="${this.h('mensalistas')}">Ver mensalistas</a></div>`;
  },
  mensClientes() {
    const b = this.b, hoje = Datas.hoje(), mes = Datas.mes(hoje);
    const lista = Mensal.assinantes(b).map(m => ({ m, s: Mensal.situacao(b, m), p: Mensal.plano(m) }))
      .sort((x, y) => (x.m.status === 'ativo' ? 0 : 1) - (y.m.status === 'ativo' ? 0 : 1) || ({ atrasado: 0, vence_logo: 1, em_dia: 2 }[x.s.cod] ?? 3) - ({ atrasado: 0, vence_logo: 1, em_dia: 2 }[y.s.cod] ?? 3));
    const ativos = lista.filter(x => x.m.status === 'ativo');
    const cobsMes = Store.de('mensalidades', b.id).filter(c => c.referencia === mes && c.status !== 'cancelada');
    const atrasados = ativos.filter(x => x.s.cod === 'atrasado');
    const kpi = (r, v, s = '', i = '', cls = '') => `<div class="kpi ${cls}"><small>${i ? ic(i) : ''}${r}</small><b>${v}</b>${s ? `<em>${s}</em>` : ''}</div>`;
    return `<div class="kpis">
        ${kpi('Receita mensal dos planos', dinheiro(soma(ativos, x => Mensal.valor(x.m))), `${ativos.length} mensalista${ativos.length === 1 ? '' : 's'} ativo${ativos.length === 1 ? '' : 's'}`, 'coroa', 'destaque')}
        ${kpi(`Recebido em ${MESES[+mes.slice(5) - 1]}`, `<span class="tom-ok">${dinheiro(soma(cobsMes.filter(c => c.status === 'paga'), c => c.valor))}</span>`, '', 'check')}
        ${kpi('A receber no mês', dinheiro(soma(cobsMes.filter(c => c.status === 'pendente'), c => c.valor)), '', 'relogio')}
        ${kpi('Em atraso', `<span class="${atrasados.length ? 'tom-ruim' : ''}">${dinheiro(soma(atrasados, x => x.s.valor))}</span>`, `${atrasados.length} cliente${atrasados.length === 1 ? '' : 's'}`, 'alerta')}
      </div>
      ${!Mensal.planos(b).length ? `<div class="aviso-faixa info">${ic('info')}<span>Crie primeiro um plano (aba Planos) e depois cadastre os clientes nele.</span><button class="btn peq" data-a="mens-aba" data-v="planos">Criar plano</button></div>` : ''}
      <div class="card" style="padding:6px 14px">${lista.length ? `<div class="linhas">${lista.map(({ m, s, p }) => {
        const usados = Mensal.usados(b, m, mes);
        return `<div class="linha clicavel" data-a="ver-mens" data-id="${m.id}">${UI.avatar(m.cliente_nome, null, '#57514a')}
          <div class="linha-txt"><b>${esc(m.cliente_nome)}</b><small>${esc(p?.nome || 'Plano')} · ${dinheiro(Mensal.valor(m))}/mês · usou ${usados} de ${p?.qtd_mes || 0} em ${MESES_CURTOS[+mes.slice(5) - 1]}</small></div>
          <div class="linha-fim">${UI.badge(s.texto, s.tom)}<small class="muted" style="font-size:12.5px">${s.cobranca ? `vence ${Datas.brCurta(s.cobranca.vencimento)}` : 'sem cobrança aberta'}</small></div></div>`;
      }).join('')}</div>` : UI.vazio('coroa', 'Nenhum mensalista ainda', 'Cadastre clientes que pagam um valor fixo por mês.', `<button class="btn pri" data-a="novo-mens">${ic('mais')} Novo mensalista</button>`)}</div>`;
  },
  mensPlanos() {
    const b = this.b, planos = Mensal.planos(b, { todos: true });
    if (!planos.length) return `<div class="card">${UI.vazio('coroa', 'Nenhum plano criado', 'Exemplo: 4 cortes por mês por R$ 140.', `<button class="btn pri" data-a="novo-plano-m">${ic('mais')} Criar plano</button>`)}</div>`;
    return `<div class="plano-grade">${planos.map(p => {
      const n = Mensal.assinantes(b).filter(m => m.plano_id === p.id && m.status === 'ativo').length;
      const tabela = soma(p.servicos.map(id => Store.get('servicos', id)).filter(Boolean), s => s.preco) * p.qtd_mes;
      return `<div class="plano ${p.ativo === false ? 'apagada' : ''}">
        <h3>${ic('coroa')} ${esc(p.nome)}</h3>
        <div class="preco">${dinheiro(p.valor)} <small>/mês</small></div>
        <p class="muted">${esc(p.descricao || '')}</p>
        <ul>${Mensal.regrasTexto(p).map(r => `<li>${ic('check')} ${esc(r)}</li>`).join('')}
          <li>${ic('check')} ${esc(p.servicos.map(id => Store.get('servicos', id)?.nome).filter(Boolean).join(', '))}</li></ul>
        ${tabela > p.valor ? `<p class="muted" style="font-size:13px">Avulso sairia ${dinheiro(tabela)} (economia de ${dinheiro(tabela - p.valor)})</p>` : ''}
        <p class="muted" style="font-size:13px">${n} mensalista${n === 1 ? '' : 's'} neste plano</p>
        <div class="acoes"><button class="btn peq" data-a="editar-plano-m" data-id="${p.id}">${ic('lapis')} Editar</button></div>
      </div>`;
    }).join('')}</div>`;
  },
  mensCobrancas() {
    const b = this.b, hoje = Datas.hoje(), ym = this.mensMes;
    const cobs = Store.de('mensalidades', b.id).filter(c => c.referencia === ym).sort((p, q) => p.vencimento.localeCompare(q.vencimento));
    const faltam = Mensal.assinantes(b).filter(m => m.status === 'ativo' && (!m.inicio || Datas.mes(m.inicio) <= ym) && !cobs.some(c => c.mensalista_id === m.id && c.status !== 'cancelada'));
    const tag = c => c.status === 'paga' ? UI.badge('Paga', 'ok') : c.status === 'cancelada' ? UI.badge('Cancelada', 'neutro') : c.vencimento < hoje ? UI.badge(`Atrasada · ${Datas.diff(hoje, c.vencimento)} d`, 'ruim') : UI.badge('A vencer', 'info');
    return `<div class="barra-filtros"><span class="mes-nav"><button class="btn-icone" data-a="mens-mes" data-d="-1" aria-label="Mês anterior">${ic('esquerda')}</button><span>${cap(Datas.nomeMes(ym))}</span><button class="btn-icone" data-a="mens-mes" data-d="1" aria-label="Próximo mês">${ic('direita')}</button></span></div>
      ${faltam.length ? `<div class="aviso-faixa info">${ic('info')}<span>${faltam.length} mensalista${faltam.length > 1 ? 's ainda não têm' : ' ainda não tem'} a cobrança de ${Datas.nomeMes(ym)}.</span><button class="btn peq" data-a="gerar-mens">Gerar cobranças</button></div>` : ''}
      <div class="card">${cobs.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Cliente</th><th>Plano</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
        ${cobs.map(c => { const m = Store.get('mensalistas', c.mensalista_id); return `<tr>
          <td><b>${esc(m?.cliente_nome || '—')}</b><small>${esc(fmtTel(m?.cliente_tel))}</small></td><td>${esc(Mensal.plano(m)?.nome || '—')}</td>
          <td>${Datas.br(c.vencimento)}${c.lembretes ? `<small>cobrado ${c.lembretes}×</small>` : ''}</td><td class="num">${dinheiro(c.valor)}</td>
          <td>${tag(c)}${c.status === 'paga' ? `<small>${Datas.br(c.pago_em)} · ${esc(FORMAS_PAGAMENTO[c.forma] || c.forma || '')}</small>` : ''}</td>
          <td><div class="acoes">${c.status === 'pendente' ? `<button class="btn peq" data-a="cobrar-mens" data-id="${c.id}">${ic('mensagem')}<span>Cobrar</span></button><button class="btn peq ok" data-a="pagar-mens" data-id="${c.id}">${ic('check')}<span>Pago</span></button>` : c.status === 'paga' ? `<button class="btn peq fantasma" data-a="desfazer-mens" data-id="${c.id}">Desfazer</button>` : ''}</div></td></tr>`; }).join('')}
      </tbody></table></div>` : UI.vazio('recibo', 'Nenhuma cobrança neste mês')}</div>`;
  },
  formPlanoMensal(id) {
    const b = this.b, p = id ? Store.get('planos_mensais', id) : null, r = p?.regras || { max_remarcacoes: 1, exige_em_dia: true, tolerancia: 5, falta_conta: true, dias: [] };
    const m = UI.modal({
      titulo: p ? 'Editar plano mensal' : 'Novo plano mensal', fixo: true, classe: 'largo',
      corpo: `<form id="f-pm" class="pilha">
        <div class="grade-form">
          <label class="campo"><span>Nome do plano</span><input name="nome" value="${esc(p?.nome || '')}" placeholder="Ex.: Corte em dia" autofocus></label>
          <label class="campo"><span>Valor por mês (R$)</span><input name="valor" inputmode="decimal" value="${p ? numBR(p.valor) : ''}" placeholder="140,00"></label>
          <label class="campo"><span>Atendimentos liberados por mês</span><input type="number" name="qtd_mes" min="1" max="31" value="${p?.qtd_mes || 4}"></label>
          <label class="campo"><span>Descrição <small>(aparece no chat)</small></span><input name="descricao" value="${esc(p?.descricao || '')}" placeholder="Ex.: 4 cortes por mês com preço fechado"></label>
        </div>
        <div class="campo"><span>Serviços que o plano cobre</span>${CHECKS_ITENS('sv', Agenda.servicos(b), p?.servicos || [])}</div>
        <div class="secao-modal"><h4>Regras</h4><div class="grade-form">
          <label class="campo"><span>Remarcar cada horário</span><select name="max_remarcacoes">${[['0', 'Não pode remarcar'], ['1', 'Até 1 vez'], ['2', 'Até 2 vezes'], ['', 'Sem limite']].map(([v, t]) => `<option value="${v}" ${String(r.max_remarcacoes ?? '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="campo"><span>Tolerância de atraso no pagamento (dias)</span><input type="number" name="tolerancia" min="0" max="30" value="${r.tolerancia ?? 5}"></label>
          <div class="campo inteiro"><span>Dias em que pode agendar pelo plano <small>(nenhum = todos)</small></span>${CHIP_DIAS('dias', r.dias || [])}</div>
        </div>
        <div class="lista-chaves" style="margin-top:12px">
          <label class="chave"><input type="checkbox" name="exige_em_dia" ${r.exige_em_dia !== false ? 'checked' : ''}><i></i><span>Só agenda pelo plano quem está em dia (depois da tolerância)</span></label>
          <label class="chave"><input type="checkbox" name="falta_conta" ${r.falta_conta !== false ? 'checked' : ''}><i></i><span>Falta conta como atendimento usado</span></label>
          <label class="chave"><input type="checkbox" name="ativo" ${p?.ativo !== false ? 'checked' : ''}><i></i><span>Plano ativo (aparece para novos clientes no chat)</span></label>
        </div></div>
      </form>`,
      rodape: `${p ? `<button class="btn perigo-txt esq" id="del-pm">${ic('lixo')} Excluir</button>` : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-pm">${ic('check')} Salvar</button>`
    });
    const f = $('#f-pm', m.el);
    $('#salvar-pm', m.el).onclick = async () => {
      try {
        const servicos = $$('[name="sv"]:checked', f).map(i => i.value);
        const valor = lerDinheiro(f.valor.value);
        if (!f.nome.value.trim()) throw new Error('Dê um nome ao plano.');
        if (!(valor > 0)) throw new Error('Informe o valor do plano.');
        if (!servicos.length) throw new Error('Marque pelo menos um serviço coberto.');
        await Store.salvar('planos_mensais', {
          ...(p ? { id } : { barbearia_id: b.id }), nome: f.nome.value.trim(), descricao: f.descricao.value.trim(), valor, qtd_mes: Math.max(1, +f.qtd_mes.value || 1), servicos, ativo: f.ativo.checked,
          regras: { max_remarcacoes: f.max_remarcacoes.value === '' ? null : +f.max_remarcacoes.value, tolerancia: +f.tolerancia.value || 0, dias: lerDias(f, 'dias'), exige_em_dia: f.exige_em_dia.checked, falta_conta: f.falta_conta.checked }
        });
        UI.toast('Plano salvo.'); m.fechar(); this.pintar();
      } catch (err) { UI.erro(err); }
    };
    const del = $('#del-pm', m.el);
    if (del) del.onclick = async () => {
      if (Mensal.assinantes(b).some(x => x.plano_id === id && x.status === 'ativo')) return UI.toast('Esse plano tem mensalistas ativos. Mude o plano deles antes ou desative o plano.', 'erro');
      if (!await UI.confirmar(`Excluir o plano <b>${esc(p.nome)}</b>?`, { titulo: 'Excluir plano', ok: 'Excluir', perigo: true })) return;
      await Store.remover('planos_mensais', id); m.fechar(); this.pintar();
    };
  },
  formMensalista(id, pre = {}) {
    const b = this.b, x = id ? Store.get('mensalistas', id) : null, planos = Mensal.planos(b);
    if (!planos.length) { this.mensAba = 'planos'; this.pintar(); return UI.toast('Crie um plano mensal primeiro.', 'info'); }
    const clientes = Store.de('clientes', b.id);
    const hoje = Datas.hoje();
    const m = UI.modal({
      titulo: x ? 'Editar mensalista' : 'Novo mensalista', fixo: true,
      corpo: `<form id="f-ms" class="pilha" autocomplete="off">
        <div class="grade-form">
          <label class="campo"><span>Cliente</span><input name="nome" list="lista-cli-ms" value="${esc(x?.cliente_nome || pre.nome || '')}" autofocus></label>
          <label class="campo"><span>WhatsApp</span><input name="tel" data-tel inputmode="tel" value="${esc(fmtTel(x?.cliente_tel || pre.tel || ''))}"></label>
          <label class="campo"><span>Plano</span><select name="plano">${planos.map(p => `<option value="${p.id}" data-valor="${p.valor}" ${x?.plano_id === p.id ? 'selected' : ''}>${esc(p.nome)} — ${dinheiro(p.valor)}</option>`).join('')}</select></label>
          <label class="campo"><span>Valor para este cliente (R$)</span><input name="valor" inputmode="decimal" value="${numBR(x ? Mensal.valor(x) : planos[0].valor)}"></label>
          <label class="campo"><span>Vence todo dia</span><select name="dia">${[...Array(28)].map((_, i) => i + 1).map(d => `<option ${(x?.dia_vencimento || Math.min(28, +hoje.slice(8))) === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="campo"><span>Começa em</span><input type="date" name="inicio" value="${x?.inicio || hoje}"></label>
          <label class="campo"><span>Profissional <small>(opcional)</small></span><select name="barbeiro"><option value="">Qualquer um da equipe</option>${Agenda.barbeiros(b).map(o => `<option value="${o.id}" ${x?.barbeiro_id === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
          <label class="campo"><span>Situação</span><select name="status">${[['ativo', 'Ativo'], ['pausado', 'Pausado'], ['cancelado', 'Cancelado']].map(([v, t]) => `<option value="${v}" ${(x?.status || 'ativo') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="campo inteiro"><span>Observação</span><input name="obs" value="${esc(x?.obs || '')}"></label>
        </div>
        <datalist id="lista-cli-ms">${clientes.slice(0, 400).map(c => `<option value="${esc(c.nome)}">${esc(fmtTel(c.telefone))}</option>`).join('')}</datalist>
        ${x ? '' : '<p class="ajuda">A primeira mensalidade já é criada. Se o dia de vencimento deste mês já passou, ela vence hoje.</p>'}
      </form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="salvar-ms">${ic('check')} Salvar</button>`
    });
    const f = $('#f-ms', m.el);
    f.plano.onchange = () => { f.valor.value = numBR(f.plano.selectedOptions[0].dataset.valor); };
    f.nome.oninput = () => { if (soDigitos(f.tel.value)) return; const c = clientes.find(c => c.nome.toLowerCase() === f.nome.value.trim().toLowerCase()); if (c) f.tel.value = fmtTel(c.telefone); };
    $('#salvar-ms', m.el).onclick = async () => {
      try {
        const tel = soDigitos(f.tel.value), nome = f.nome.value.trim();
        if (nome.length < 2) throw new Error('Informe o nome do cliente.');
        if (![10, 11].includes(tel.length)) throw new Error('Confira o WhatsApp: DDD + número. É por ele que o cliente é reconhecido no chat.');
        const outro = Mensal.assinantes(b).find(o => o.cliente_tel === tel && o.status === 'ativo' && o.id !== id);
        if (outro && f.status.value === 'ativo') throw new Error(`Esse número já é mensalista (${Mensal.plano(outro)?.nome}).`);
        const cli = await Agenda.cliente(b, nome, tel);
        const reg = await Store.salvar('mensalistas', {
          ...(x ? { id } : { barbearia_id: b.id }), cliente_nome: nome, cliente_tel: tel, cliente_id: cli?.id || null, plano_id: f.plano.value,
          valor: lerDinheiro(f.valor.value), dia_vencimento: +f.dia.value, inicio: f.inicio.value || hoje, barbeiro_id: f.barbeiro.value || null, status: f.status.value, obs: f.obs.value.trim()
        });
        if (!x && reg.status === 'ativo') {
          const ym = Datas.mes(reg.inicio > hoje ? reg.inicio : hoje);
          const v = Mensal.vencimentoDe(reg, ym);
          await Store.salvar('mensalidades', { barbearia_id: b.id, mensalista_id: reg.id, referencia: ym, valor: reg.valor, vencimento: v < hoje ? hoje : v, status: 'pendente', lembretes: 0 });
          await Mensagens.mensalidades(b);
        }
        UI.toast('Mensalista salvo.'); m.fechar(); this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  verMensalista(id) {
    const b = this.b, x = Store.get('mensalistas', id);
    if (!x) return;
    const p = Mensal.plano(x), s = Mensal.situacao(b, x), mes = Datas.mes(Datas.hoje());
    const ags = Store.de('agendamentos', b.id).filter(a => a.mensalista_id === x.id && a.data.startsWith(mes)).sort((p1, q) => p1.data.localeCompare(q.data) || p1.ini - q.ini);
    const cobs = Mensal.cobrancas(b, x).slice(0, 6);
    const modal = UI.modal({
      titulo: x.cliente_nome,
      corpo: `<div class="det-topo">${UI.avatar(x.cliente_nome, null, '#57514a', 'g')}<div><h4>${esc(x.cliente_nome)}</h4>
          <a href="${linkWhats(x.cliente_tel)}" target="_blank" rel="noopener">${ic('mensagem')} ${esc(fmtTel(x.cliente_tel))}</a></div>${UI.badge(s.texto, s.tom)}</div>
        <div class="metricas-mini" style="margin-bottom:14px"><div><small>Plano</small><b style="font-size:14px">${esc(p?.nome || '—')}</b></div><div><small>Mensalidade</small><b>${dinheiro(Mensal.valor(x))}</b></div>
          <div><small>Usados em ${MESES_CURTOS[+mes.slice(5) - 1]}</small><b>${Mensal.usados(b, x, mes)} de ${p?.qtd_mes || 0}</b></div><div><small>Vence todo dia</small><b>${x.dia_vencimento}</b></div></div>
        <div class="secao-modal"><h4>Horários do plano neste mês</h4>${ags.length ? `<div class="linhas">${ags.map(a => `<div class="linha"><div class="linha-txt"><b>${Datas.curta(a.data)} · ${Datas.hhmm(a.ini)}</b><small>${esc(a.servicos.map(s1 => s1.nome).join(' + '))} · ${esc(primeiroNome(Store.get('barbeiros', a.barbeiro_id)?.nome))}${a.remarcacoes ? ` · remarcado ${a.remarcacoes}×` : ''}</small></div><div class="linha-fim">${this.badgeAg(a)}</div></div>`).join('')}</div>` : '<p class="muted">Nenhum horário pelo plano neste mês.</p>'}</div>
        <div class="secao-modal"><h4>Mensalidades</h4><div class="linhas">${cobs.map(c => `<div class="linha"><div class="linha-txt"><b>${cap(Datas.nomeMes(c.referencia))}</b><small>vence ${Datas.br(c.vencimento)}${c.pago_em ? ` · pago em ${Datas.br(c.pago_em)} (${esc(FORMAS_PAGAMENTO[c.forma] || c.forma || '')})` : ''}</small></div>
          <div class="linha-fim"><b>${dinheiro(c.valor)}</b>${c.status === 'pendente' ? `<span class="acoes"><button class="btn peq" data-a="cobrar-mens" data-id="${c.id}">${ic('mensagem')}</button><button class="btn peq ok" data-a="pagar-mens" data-id="${c.id}">Pago</button></span>` : UI.badge(c.status === 'paga' ? 'Paga' : 'Cancelada', c.status === 'paga' ? 'ok' : 'neutro')}</div></div>`).join('') || '<p class="muted">Nenhuma ainda.</p>'}</div></div>`,
      rodape: `<button class="btn esq" data-a="editar-mens" data-id="${x.id}">${ic('lapis')} Editar</button><button class="btn pri" data-a="agendar-mens" data-id="${x.id}">${ic('calendario-mais')} Agendar pelo plano</button>`
    });
    modal.el.onclick = e => { const el = e.target.closest('[data-a]'); if (el) { modal.fechar(); this.clique(e); } };
  },
  pagarMensalidade(cid) {
    const c = Store.get('mensalidades', cid), x = Store.get('mensalistas', c.mensalista_id);
    const m = UI.modal({
      titulo: 'Registrar pagamento da mensalidade', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:14px">${esc(x?.cliente_nome)} · ${cap(Datas.nomeMes(c.referencia))} · <b>${dinheiro(c.valor)}</b></p>
        <form id="f-pm-pag" class="pilha"><label class="campo"><span>Data do pagamento</span><input type="date" name="data" value="${Datas.hoje()}" max="${Datas.hoje()}"></label>
        <div class="campo"><span>Forma</span><div class="opcoes-grade">${Object.entries({ pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', app: 'Pelo app' }).map(([k, v], i) => `<label class="op-btn" style="cursor:pointer"><input type="radio" name="forma" value="${k}" ${i === 0 ? 'checked' : ''}> ${v}</label>`).join('')}</div></div></form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ok" id="conf-pm-pag">${ic('check')} Confirmar</button>`
    });
    $('#conf-pm-pag', m.el).onclick = async () => {
      const d = UI.form($('#f-pm-pag', m.el));
      await Store.salvar('mensalidades', { id: cid, status: 'paga', pago_em: d.data || Datas.hoje(), forma: d.forma || 'pix' });
      await Mensagens.pararDaMensalidade(this.b, cid);
      UI.toast('Mensalidade paga.'); m.fechar(); this.pintar();
    };
  },
  cobrarMensalidade(cid) {
    const b = this.b, c = Store.get('mensalidades', cid), x = Store.get('mensalistas', c.mensalista_id);
    const m = UI.modal({
      titulo: 'Cobrar no WhatsApp', classe: 'pequeno',
      corpo: `<p class="texto-modal" style="margin-bottom:10px">Para <b>${esc(x.cliente_nome)}</b> · ${esc(fmtTel(x.cliente_tel))}</p><label class="campo"><span>Mensagem</span><textarea id="msg-mens" rows="6">${esc(Mensal.mensagemCobranca(b, x, c))}</textarea></label>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ir-mens">${ic('mensagem')} Abrir WhatsApp</button>`
    });
    $('#ir-mens', m.el).onclick = async () => {
      window.open(linkWhats(x.cliente_tel, $('#msg-mens', m.el).value), '_blank', 'noopener');
      await Store.salvar('mensalidades', { id: cid, lembretes: (c.lembretes || 0) + 1, cobrado_em: new Date().toISOString() });
      m.fechar(); this.pintar();
    };
  },

  /* ============================ FECHAR O DIA ============================ */
  // valores de uma conclusão: plano cobre → promoção/fidelidade → desconto extra; o que já foi pago pelo app sai do "a receber"
  calcConclusao(a, servicos, produtos, descExtra = 0) {
    const m = a.mensalista_id ? Store.get('mensalistas', a.mensalista_id) : null;
    const orc = Orcamento.calcular(this.b, servicos, { data: a.data, ini: a.ini, tel: a.cliente_tel, online: a.origem === 'cliente', antecipado: a.pagamento?.status === 'pago', ignorar: a.id, usarCredito: false, mensalista: m });
    const vp = round2(soma(produtos, p => p.preco * p.qtd));
    const total = round2(Math.max(0, orc.bruto - orc.desconto - descExtra) + vp);
    const jaPago = round2((a.pagamento?.status === 'pago' ? a.pagamento.valor || 0 : 0) + (a.credito_usado || 0));
    return { orc, vs: orc.bruto, coberto: orc.valorCoberto, vp, descAuto: orc.desconto, descExtra, total, jaPago, aReceber: round2(Math.max(0, total - jaPago)) };
  },
  async gravarConclusao(a, servicos, produtos, descExtra, forma) {
    const c = this.calcConclusao(a, servicos, produtos, descExtra);
    await Store.salvar('agendamentos', {
      id: a.id, status: 'concluido', servicos, total: round2(c.vs - c.descAuto), valor_servicos: c.vs, valor_coberto: c.coberto, produtos, valor_produtos: c.vp,
      desconto: round2(c.descAuto + descExtra), desconto_motivo: c.orc.motivo, promo_ids: c.orc.promos.map(p => p.id), fidelidade_id: c.orc.fid?.prog.id || null,
      cobertos: c.orc.cobertos.map(s => s.id), mensalista_id: c.orc.mensalista?.id || a.mensalista_id || null,
      total_pago: c.total, forma_pagamento: c.aReceber > 0 ? forma : 'app', concluido_em: new Date().toISOString()
    });
    if (c.jaPago > c.total) await Creditos.lancar(this.b, { tel: a.cliente_tel, nome: a.cliente_nome, valor: round2(c.jaPago - c.total), origem: 'sobra', agendamento_id: a.id });
    if (Store.local !== false) for (const p of produtos) this.mexerEstoque(p.id, -p.qtd);
    return c;
  },
  // concluir com a janela completa (serviços, produtos, descontos automáticos, pago pelo app)
  concluir(id) {
    const a = Store.get('agendamentos', id), b = this.b;
    const st = { servicos: copia(a.servicos), produtos: copia(a.produtos?.length ? a.produtos : (a.reservas || [])), extra: 0, forma: a.forma_pagamento && a.forma_pagamento !== 'app' ? a.forma_pagamento : 'pix' };
    st.produtos = st.produtos.map(p => { const pr = Store.get('produtos', p.id); return pr ? { ...p, preco: Promocoes.precoProduto(b, pr, { data: a.data }).preco } : p; });
    const m = UI.modal({ titulo: 'Concluir atendimento', fixo: true, corpo: '<div id="conc"></div>', rodape: `<button class="btn" data-fechar>Voltar</button><button class="btn ok" id="conf-conc">${ic('check')} Concluir e registrar</button>` });
    const desenhar = () => {
      const c = this.calcConclusao(a, st.servicos, st.produtos, st.extra);
      const cob = new Set(c.orc.cobertos.map(s => s.id));
      $('#conc', m.el).innerHTML = `
        <p class="texto-modal" style="margin-bottom:14px"><b>${esc(a.cliente_nome)}</b> · ${Datas.curta(a.data)} às ${Datas.hhmm(a.ini)}</p>
        <div class="secao-modal"><h4>Serviços feitos</h4><div class="itens-conta">${st.servicos.map((s, i) => `<div class="item-conta"><span>${esc(s.nome)}${cob.has(s.id) ? ` ${UI.badge('Plano', 'destaque')}` : ''}</span><b>${cob.has(s.id) ? `<s class="muted">${dinheiro(s.preco)}</s>` : dinheiro(s.preco)}</b><button type="button" class="btn-icone" data-rm-sv="${i}" aria-label="Tirar ${esc(s.nome)}">${ic('x')}</button></div>`).join('') || '<p class="muted">Nenhum serviço.</p>'}</div>
          <select class="entrada" id="add-sv" style="margin-top:8px"><option value="">+ Adicionar serviço</option>${Agenda.servicos(b).map(s => `<option value="${s.id}">${esc(s.nome)} — ${dinheiro(s.preco)}</option>`).join('')}</select></div>
        <div class="secao-modal"><h4>Produtos vendidos</h4><div class="itens-conta">${st.produtos.map((p, i) => `<div class="item-conta"><span>${esc(p.nome)}</span><span class="qtd"><button type="button" data-qtd="${i}" data-d="-1" aria-label="Menos">${ic('menos')}</button><span>${p.qtd}</span><button type="button" data-qtd="${i}" data-d="1" aria-label="Mais">${ic('mais')}</button></span><b>${dinheiro(p.preco * p.qtd)}</b></div>`).join('') || '<p class="muted" style="font-size:14px">Nenhum produto.</p>'}</div>
          <select class="entrada" id="add-pd" style="margin-top:8px"><option value="">+ Adicionar produto</option>${Agenda.produtos(b).map(p => { const pr = Promocoes.precoProduto(b, p, { data: a.data }); return `<option value="${p.id}">${esc(p.nome)} — ${dinheiro(pr.preco)}${pr.promo ? ' (promoção)' : ''}${p.estoque != null ? ` · ${p.estoque} em estoque` : ''}</option>`; }).join('')}</select></div>
        <div class="secao-modal"><h4>Conta</h4>
          <div class="conta-linhas">
            ${Orcamento.linhas({ ...c.orc, credito: 0 }).map(l => `<div><span>${esc(l.rot)}</span><b class="tom-ok">${dinheiro(l.valor)}</b></div>`).join('')}
            ${c.jaPago ? `<div><span>${ic('check')} Já pago pelo app</span><b class="tom-ok">−${dinheiro(c.jaPago)}</b></div>` : ''}
          </div>
          <label class="campo" style="margin-top:10px"><span>Desconto extra (R$)</span><input id="desc" inputmode="decimal" value="${st.extra ? numBR(st.extra) : ''}" placeholder="0,00"></label>
          ${c.aReceber > 0 ? `<div class="opcoes-grade" style="margin-top:12px">${Object.entries(FORMAS_LOCAL).map(([k, v]) => `<button type="button" class="op-btn ${st.forma === k ? 'on' : ''}" data-forma="${k}">${v}</button>`).join('')}</div>` : ''}
          <div class="total-grande"><span>${c.aReceber > 0 ? 'Receber agora' : 'Nada a receber'}</span><b id="tot-conc">${dinheiro(c.aReceber)}</b></div>
          ${c.jaPago ? `<p class="ajuda" style="margin-top:6px">Total do atendimento: ${dinheiro(c.total)}</p>` : ''}</div>`;
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
        if (ja) ja.qtd++; else st.produtos.push({ id: p.id, nome: p.nome, preco: Promocoes.precoProduto(b, p, { data: a.data }).preco, qtd: 1 });
        desenhar();
      }
    };
    m.el.oninput = e => {
      if (e.target.id !== 'desc') return;
      st.extra = lerDinheiro(e.target.value);
      $('#tot-conc', m.el).textContent = dinheiro(this.calcConclusao(a, st.servicos, st.produtos, st.extra).aReceber);
    };
    $('#conf-conc', m.el).onclick = async () => {
      try {
        if (!st.servicos.length && !st.produtos.length) throw new Error('Inclua pelo menos um serviço ou produto.');
        const c0 = this.calcConclusao(a, st.servicos, st.produtos, 0);
        if (st.extra > c0.total) throw new Error('O desconto é maior que o total.');
        const c = await this.gravarConclusao(a, st.servicos, st.produtos, st.extra, st.forma);
        UI.toast(`Atendimento concluído · ${dinheiro(c.total)}`);
        m.fechar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  fecharDia(data = this.dia) {
    const b = this.b, eu = this.eu();
    const m = UI.modal({ titulo: `Fechar o dia · ${cap(Datas.curta(data))}`, classe: 'largo', corpo: '<div id="fd"></div>',
      rodape: `<button class="btn esq" data-fd="avulso">${ic('mais')} Atendimento sem agendamento</button><button class="btn" data-fechar>Fechar</button><button class="btn pri" data-fd="fechar">${ic('check')} Concluir o fechamento</button>` });
    const formas = {};
    const desenhar = () => {
      const ags = Store.de('agendamentos', b.id).filter(a => a.data === data && a.status !== 'cancelado' && (!eu || a.barbeiro_id === eu.id)).sort((p, q) => p.ini - q.ini);
      const pend = ags.filter(a => a.status === 'confirmado');
      const r = Financeiro.resumo(b, data, data, eu ? eu.id : null);
      const fech = Store.de('fechamentos', b.id).find(f => f.data === data && (f.barbeiro_id || null) === (eu?.id || null));
      $('#fd', m.el).innerHTML = `
        ${fech ? `<div class="aviso-faixa info">${ic('check')}<span>Dia fechado em ${new Date(fech.fechado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Dá para corrigir e fechar de novo.</span></div>` : ''}
        <p class="ajuda" style="margin-bottom:12px">Confirme o que aconteceu com cada horário. Só o que foi <b>realizado</b> entra no faturamento; a falta sai da conta.</p>
        ${ags.length ? `<div class="fd-lista">${ags.map(a => {
          const x = Store.get('barbeiros', a.barbeiro_id);
          const c = this.calcConclusao(a, a.servicos, [], 0);
          const forma = formas[a.id] || 'pix';
          const pago = a.pagamento?.status === 'pago';
          let dir;
          if (a.status === 'confirmado') dir = `<div class="fd-acoes">
              ${c.aReceber > 0 ? `<select class="entrada fd-forma" data-forma-ag="${a.id}" aria-label="Forma de pagamento">${Object.entries(FORMAS_LOCAL).map(([k, v]) => `<option value="${k}" ${forma === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
              <button class="btn peq ok" data-fd="ok" data-id="${a.id}">${ic('check')} Realizado</button>
              <button class="btn peq" data-fd="faltou" data-id="${a.id}">${ic('usuario-x')} Faltou</button>
              <button class="btn peq fantasma" data-fd="detalhar" data-id="${a.id}" title="Concluir com produtos ou outro valor">${ic('reticencias')}</button></div>`;
          else dir = `<div class="fd-acoes">${a.status === 'concluido' ? UI.badge(`Realizado · ${dinheiro(a.total_pago ?? a.total)} · ${FORMAS_PAGAMENTO[a.forma_pagamento] || ''}`, 'ok') : UI.badge(a.pagamento?.retido ? 'Faltou · valor retido' : 'Faltou', 'ruim')}<button class="btn peq fantasma" data-fd="desfazer" data-id="${a.id}">Desfazer</button></div>`;
          return `<div class="fd-item st-${a.status}"><div class="ag-hora"><b>${Datas.hhmm(a.ini)}</b><small>${esc(primeiroNome(x?.nome))}</small></div>
            <div class="ag-txt"><b>${esc(a.cliente_nome)}${a.avulso ? ` ${UI.badge('Sem agendamento', 'neutro')}` : ''}</b><small>${esc(a.servicos.map(s => s.nome).join(' + '))} · ${a.status === 'confirmado' ? (c.orc.cobertos.length ? 'plano' : dinheiro(c.total)) : (a.cobertos?.length ? 'plano' : dinheiro(a.total_pago ?? a.total))}${pago ? ' · pago pelo app' : ''}</small></div>${dir}</div>`;
        }).join('')}</div>` : UI.vazio('calendario', 'Nenhum horário neste dia', 'Lance os atendimentos feitos sem agendamento pelo botão abaixo.')}
        ${pend.length > 1 ? `<button class="btn peq" data-fd="todos" style="margin-top:10px">${ic('check')} Marcar os ${pend.length} pendentes como realizados</button>` : ''}
        <div class="metricas-mini" style="margin-top:16px">
          <div><small>Realizados</small><b>${r.atendimentos}</b></div><div><small>Faturado no dia</small><b>${dinheiro(r.total)}</b></div>
          <div><small>Faltas</small><b>${r.faltas}</b></div><div><small>Pendentes</small><b>${pend.length}</b></div></div>
        ${Object.keys(r.porForma).length ? `<div style="margin-top:14px">${UI.partes(Object.entries(r.porForma).sort((p, q) => q[1] - p[1]).map(([k, v]) => ({ rot: FORMAS_PAGAMENTO[k] || k, valor: v })))}</div>` : ''}`;
    };
    desenhar();
    m.el.onchange = e => { const s = e.target.closest('[data-forma-ag]'); if (s) formas[s.dataset.formaAg] = s.value; };
    m.el.onclick = async e => {
      const el = e.target.closest('[data-fd]');
      if (!el) return;
      const a = el.dataset.id ? Store.get('agendamentos', el.dataset.id) : null;
      try {
        switch (el.dataset.fd) {
          case 'ok': await this.gravarConclusao(a, a.servicos, [], 0, formas[a.id] || 'pix'); break;
          case 'faltou': await this.marcarFalta(a); break;
          case 'detalhar': m.fechar(); return this.concluir(a.id);
          case 'desfazer': await this.reabrirAg(a); break;
          case 'todos':
            for (const x of Store.de('agendamentos', b.id).filter(x => x.data === data && x.status === 'confirmado' && (!eu || x.barbeiro_id === eu.id)))
              await this.gravarConclusao(x, x.servicos, [], 0, formas[x.id] || 'pix');
            break;
          case 'avulso': m.fechar(); return this.formAvulso(data);
          case 'fechar': {
            const pend = Store.de('agendamentos', b.id).filter(x => x.data === data && x.status === 'confirmado' && (!eu || x.barbeiro_id === eu.id)).length;
            if (pend && !await UI.confirmar(`Ainda ${pend > 1 ? `há ${pend} horários` : 'há 1 horário'} sem baixa. Fechar mesmo assim?`, { titulo: 'Fechar o dia', ok: 'Fechar assim' })) return;
            const r = Financeiro.resumo(b, data, data, eu ? eu.id : null);
            const ja = Store.de('fechamentos', b.id).find(f => f.data === data && (f.barbeiro_id || null) === (eu?.id || null));
            await Store.salvar('fechamentos', { ...(ja ? { id: ja.id } : { barbearia_id: b.id }), data, barbeiro_id: eu?.id || null, fechado_em: new Date().toISOString(),
              resumo: { atendimentos: r.atendimentos, total: r.total, faltas: r.faltas, porForma: r.porForma } });
            UI.toast(`Dia fechado · ${dinheiro(r.total)}`);
            m.fechar();
            return this.pintar();
          }
        }
        desenhar();
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  async marcarFalta(a) {
    const b = this.b, pg = Pagamentos.config(b);
    const patch = { id: a.id, status: 'faltou' };
    if (a.pagamento?.status === 'pago') {
      if (pg.falta === 'credito') {
        await Creditos.lancar(b, { tel: a.cliente_tel, nome: a.cliente_nome, valor: a.pagamento.valor, origem: 'falta', agendamento_id: a.id });
        patch.pagamento = { ...a.pagamento, status: 'credito' };
      } else patch.pagamento = { ...a.pagamento, retido: true };
    }
    await Store.salvar('agendamentos', patch);
    UI.toast(a.pagamento?.status === 'pago' ? (pg.falta === 'credito' ? 'Falta marcada. O valor pago virou crédito do cliente.' : 'Falta marcada. O valor pago fica com o estabelecimento.') : 'Falta marcada.');
  },
  async reabrirAg(a) {
    const b = this.b;
    if (a.status !== 'concluido' && Agenda.conflitos(b, a.barbeiro_id, a.data, a.ini, a.fim, a.id).length)
      throw new Error('Esse horário já foi ocupado por outro agendamento. Crie um novo ou remarque.');
    if (a.status === 'concluido' && Store.local !== false) for (const p of a.produtos || []) this.mexerEstoque(p.id, p.qtd);
    const patch = { id: a.id, status: 'confirmado', total_pago: null, forma_pagamento: null, valor_servicos: null, valor_produtos: null, valor_coberto: null, produtos: [], desconto: 0, concluido_em: null, cancelado_por: null };
    if (a.pagamento?.retido) patch.pagamento = { ...a.pagamento, retido: false };
    if (a.status === 'faltou' && a.pagamento?.status === 'credito') {
      for (const c of Store.de('creditos', b.id).filter(c => c.agendamento_id === a.id && c.origem === 'falta')) await Store.remover('creditos', c.id);
      patch.pagamento = { ...a.pagamento, status: 'pago' };
    }
    for (const c of Store.de('creditos', b.id).filter(c => c.agendamento_id === a.id && c.origem === 'sobra')) await Store.remover('creditos', c.id);
    await Store.salvar('agendamentos', patch);
  },
  // atendimento feito sem agendamento (cliente chegou na hora)
  formAvulso(data = this.dia) {
    const b = this.b, eu = this.eu(), svs = Agenda.servicos(b);
    const agora = new Date();
    const st = { servicos: [], produtos: [], extra: 0, forma: 'pix', barbeiro: eu ? eu.id : (Agenda.barbeiros(b)[0]?.id || ''), nome: '', tel: '',
      hora: data === Datas.hoje() ? Math.floor((agora.getHours() * 60 + agora.getMinutes()) / 5) * 5 : 10 * 60 };
    const clientes = Store.de('clientes', b.id);
    const m = UI.modal({
      titulo: 'Atendimento sem agendamento', fixo: true,
      corpo: `<form id="f-av" autocomplete="off">
        <p class="ajuda" style="margin-bottom:12px">Para o cliente que chegou sem marcar. Entra direto como realizado no faturamento de ${Datas.curta(data)}.</p>
        <div class="grade-form">
          <label class="campo"><span>Cliente <small>(opcional)</small></span><input name="nome" list="lista-cli-av" placeholder="Nome"></label>
          <label class="campo"><span>WhatsApp <small>(opcional)</small></span><input name="tel" data-tel inputmode="tel" placeholder="(21) 99999-9999"></label>
          <label class="campo"><span>Profissional</span><select name="barbeiro" ${eu ? 'disabled' : ''}>${(eu ? [eu] : Agenda.barbeiros(b)).map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>
          <label class="campo"><span>Horário</span><input type="time" name="hora" value="${Datas.hhmm(st.hora)}"></label>
        </div>
        <datalist id="lista-cli-av">${clientes.slice(0, 400).map(c => `<option value="${esc(c.nome)}">${esc(fmtTel(c.telefone))}</option>`).join('')}</datalist>
        <div class="campo" style="margin-top:14px"><span>Serviços</span><div class="opcoes-grade">${svs.map(s => `<button type="button" class="op-btn" data-sv="${s.id}">${esc(s.nome)} <small>${dinheiro(s.preco)}</small></button>`).join('')}</div></div>
        <div class="campo" style="margin-top:14px"><span>Produtos <small>(opcional)</small></span><div class="itens-conta" id="av-pd"></div>
          <select class="entrada" id="av-add-pd" style="margin-top:6px"><option value="">+ Adicionar produto</option>${Agenda.produtos(b).map(p => `<option value="${p.id}">${esc(p.nome)} — ${dinheiro(Promocoes.precoProduto(b, p, { data }).preco)}</option>`).join('')}</select></div>
        <div id="av-conta"></div>
      </form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ok" id="salvar-av">${ic('check')} Registrar atendimento</button>`
    });
    const f = $('#f-av', m.el);
    const fake = () => ({ id: '__avulso', data, ini: st.hora, cliente_tel: soDigitos(f.tel.value), origem: 'balcao', mensalista_id: null });
    const desenhar = () => {
      $('#av-pd', m.el).innerHTML = st.produtos.map((p, i) => `<div class="item-conta"><span>${esc(p.nome)}</span><span class="qtd"><button type="button" data-pq="${i}" data-d="-1">${ic('menos')}</button><span>${p.qtd}</span><button type="button" data-pq="${i}" data-d="1">${ic('mais')}</button></span><b>${dinheiro(p.preco * p.qtd)}</b></div>`).join('');
      const svsSel = st.servicos.map(id => svs.find(s => s.id === id)).filter(Boolean);
      const c = this.calcConclusao(fake(), svsSel, st.produtos, st.extra);
      $('#av-conta', m.el).innerHTML = `<div class="conta-linhas" style="margin-top:12px">${Orcamento.linhas({ ...c.orc, credito: 0 }).map(l => `<div><span>${esc(l.rot)}</span><b class="tom-ok">${dinheiro(l.valor)}</b></div>`).join('')}</div>
        <label class="campo" style="margin-top:10px"><span>Desconto extra (R$)</span><input id="av-desc" inputmode="decimal" value="${st.extra ? numBR(st.extra) : ''}" placeholder="0,00"></label>
        <div class="opcoes-grade" style="margin-top:12px">${Object.entries(FORMAS_LOCAL).map(([k, v]) => `<button type="button" class="op-btn ${st.forma === k ? 'on' : ''}" data-forma="${k}">${v}</button>`).join('')}</div>
        <div class="total-grande"><span>Total</span><b id="av-tot">${dinheiro(c.total)}</b></div>`;
    };
    desenhar();
    m.el.onclick = e => {
      const sv = e.target.closest('[data-sv]'), pq = e.target.closest('[data-pq]'), fm = e.target.closest('[data-forma]');
      if (sv) { const i = st.servicos.indexOf(sv.dataset.sv); i >= 0 ? st.servicos.splice(i, 1) : st.servicos.push(sv.dataset.sv); sv.classList.toggle('on'); desenhar(); }
      if (pq) { const p = st.produtos[+pq.dataset.pq]; p.qtd += +pq.dataset.d; if (p.qtd <= 0) st.produtos.splice(+pq.dataset.pq, 1); desenhar(); }
      if (fm) { st.forma = fm.dataset.forma; desenhar(); }
    };
    m.el.onchange = e => {
      if (e.target.id === 'av-add-pd' && e.target.value) {
        const p = Store.get('produtos', e.target.value), ja = st.produtos.find(x => x.id === p.id);
        if (ja) ja.qtd++; else st.produtos.push({ id: p.id, nome: p.nome, preco: Promocoes.precoProduto(b, p, { data }).preco, qtd: 1 });
        desenhar();
      }
      if (e.target.name === 'hora' && e.target.value) { st.hora = Datas.min(e.target.value); desenhar(); }
      if (e.target.name === 'tel') desenhar();
    };
    m.el.oninput = e => {
      if (e.target.name === 'nome' && !soDigitos(f.tel.value)) { const c = clientes.find(c => c.nome.toLowerCase() === e.target.value.trim().toLowerCase()); if (c) { f.tel.value = fmtTel(c.telefone); desenhar(); } }
      if (e.target.id === 'av-desc') { st.extra = lerDinheiro(e.target.value); const svsSel = st.servicos.map(id => svs.find(s => s.id === id)).filter(Boolean); $('#av-tot', m.el).textContent = dinheiro(this.calcConclusao(fake(), svsSel, st.produtos, st.extra).total); }
    };
    $('#salvar-av', m.el).onclick = async () => {
      try {
        const svsSel = st.servicos.map(id => svs.find(s => s.id === id)).filter(Boolean);
        if (!svsSel.length && !st.produtos.length) throw new Error('Escolha pelo menos um serviço ou produto.');
        const tel = soDigitos(f.tel.value);
        if (tel && ![10, 11].includes(tel.length)) throw new Error('Confira o WhatsApp: DDD + número.');
        const barbeiro = eu ? eu.id : f.barbeiro.value;
        const ini = Datas.min(f.hora.value || Datas.hhmm(st.hora));
        const dur = Math.max(15, Agenda.duracao(svsSel));
        const cli = await Agenda.cliente(b, f.nome.value.trim() || 'Cliente', tel);
        const reg = await Store.salvar('agendamentos', {
          barbearia_id: b.id, barbeiro_id: barbeiro, cliente_id: cli?.id || null, cliente_nome: f.nome.value.trim() || 'Cliente sem cadastro', cliente_tel: tel,
          data, ini, fim: Math.min(1440, ini + dur), servicos: svsSel.map(({ id, nome, preco, duracao }) => ({ id, nome, preco, duracao })), total: 0,
          status: 'confirmado', origem: 'balcao', avulso: true, obs: ''
        });
        const c = await this.gravarConclusao(reg, reg.servicos, st.produtos, st.extra, st.forma);
        UI.toast(`Atendimento registrado · ${dinheiro(c.total)}`);
        m.fechar();
        if (data !== this.dia) this.dia = data;
        this.pintar();
      } catch (err) { UI.erro(err); }
    };
  },
  // informações extras do agendamento (pagamento, plano, desconto) para a janela de detalhes
  infoExtraAg(a) {
    const l = [];
    if (a.pagamento) {
      const t = { pago: a.pagamento.retido ? 'Pago pelo app · ficou com o estabelecimento (faltou)' : `Pago pelo app${a.pagamento.tipo === 'sinal' ? ' (sinal)' : ''}`, credito: 'Pago pelo app · virou crédito do cliente', devolvido: 'Pago pelo app · devolvido' }[a.pagamento.status] || 'Pagamento pendente';
      l.push(`<dt>Pagamento</dt><dd>${esc(t)} · ${dinheiro(a.pagamento.valor)} · ${esc(FORMAS_PAGAMENTO[a.pagamento.forma] || a.pagamento.forma || '')}</dd>`);
    }
    if (a.mensalista_id) {
      const m = Store.get('mensalistas', a.mensalista_id);
      if (m) l.push(`<dt>Plano mensal</dt><dd>${esc(Mensal.plano(m)?.nome || '')} · ${Mensal.usados(this.b, m, Datas.mes(a.data))} de ${Mensal.plano(m)?.qtd_mes || 0} usados no mês${a.remarcacoes ? ` · remarcado ${a.remarcacoes}×` : ''}</dd>`);
    }
    if (a.status === 'confirmado' && a.desconto_previsto) l.push(`<dt>Desconto</dt><dd>${dinheiro(a.desconto_previsto)} · ${a.desconto_motivo === 'fidelidade' ? 'fidelidade' : 'promoção'}</dd>`);
    if (a.credito_usado) l.push(`<dt>Crédito usado</dt><dd>${dinheiro(a.credito_usado)}</dd>`);
    if (a.avulso) l.push('<dt>Tipo</dt><dd>Atendimento sem agendamento</dd>');
    return l.join('');
  },

  /* ============================ MENSAGENS AUTOMÁTICAS ============================ */
  v_mensagens() {
    const b = this.b, cfg = Mensagens.config(b);
    Mensagens.processar(b);
    try { Store.gravar(); } catch (e) { /* segue com o que tem */ }
    const todas = Store.de('mensagens', b.id);
    const abas = { proximas: ['Programadas', m => m.status === 'agendada'], enviadas: ['Enviadas', m => m.status === 'enviada'], canceladas: ['Canceladas', m => m.status === 'cancelada'] };
    const [, filtro] = abas[this.msgAba] || abas.proximas;
    const lista = todas.filter(filtro).sort((p, q) => this.msgAba === 'proximas' ? p.quando.localeCompare(q.quando) : q.quando.localeCompare(p.quando)).slice(0, 80);
    const quando = q => { const [d, h] = q.split('T'); return `${cap(Datas.relativa(d))} · ${h}`; };
    const temLemb = Planos.tem(b, 'lembretes'), temCob = Planos.tem(b, 'cobranca_auto');
    const chave = (k, rot, sub = '', livre = true) => `<label class="chave ${livre ? '' : 'travada'}"><input type="checkbox" name="${k}" ${cfg[k] && livre ? 'checked' : ''} ${livre ? '' : 'disabled'}><i></i><span>${rot}${sub ? `<small class="muted" style="display:block">${sub}</small>` : ''}</span></label>`;
    const trava = r => `<button type="button" class="trava-linha" data-a="bloq-recurso" data-v="${r}">${ic('cadeado')}<span>${esc(RECURSOS[r].nome)}: disponível no plano ${esc(Planos.minimoPara(r)?.nome || 'superior')}</span><b>Quero</b></button>`;
    return `<div class="topo"><div><h1>Mensagens automáticas</h1><p class="sub">WhatsApp para clientes e equipe: confirmação, lembretes e cobrança</p></div></div>
      <div class="aviso-faixa ${b.whatsapp_estado === 'conectado' ? 'ok' : 'info'}">${ic(b.whatsapp_estado === 'conectado' ? 'check' : 'info')}<span>${typeof Nuvem !== 'undefined' && Nuvem.ativo
        ? (b.whatsapp_estado === 'conectado'
          ? `Envio automático ligado pelo WhatsApp ${esc(fmtTel(b.whatsapp_numero || b.whatsapp))}: as mensagens saem sozinhas no horário certo.`
          : `O WhatsApp do estabelecimento não está conectado. As mensagens ficam prontas aqui e você envia com um toque no botão verde, ou <a href="${this.h('ajustes')}">conecte em Ajustes</a> para saírem sozinhas.`)
        : 'Na demonstração as mensagens ficam nesta caixa de saída, com o horário em que sairiam. Na versão oficial elas saem sozinhas pelo WhatsApp do estabelecimento.'}</span></div>
      <div class="duas-col">
        <div class="card"><div class="card-cab"><div><h3>Caixa de saída</h3><p>${todas.filter(m => m.status === 'agendada').length} programadas</p></div>
          <div class="seg">${Object.entries(abas).map(([k, [t]]) => `<button class="${this.msgAba === k ? 'on' : ''}" data-a="msg-aba" data-v="${k}">${t}</button>`).join('')}</div></div>
          ${lista.length ? `<div class="linhas">${lista.map(mg => `<div class="linha msg-item"><span class="avatar p" style="--av:${mg.para === 'cliente' ? '#57514a' : 'var(--accent)'}">${ic(mg.para === 'cliente' ? 'usuario' : 'loja')}</span>
            <div class="linha-txt"><b>${esc(Mensagens.ROTULOS[mg.tipo] || mg.tipo)} · ${esc(primeiroNome(mg.nome))}</b><small>${esc(mg.texto)}</small></div>
            <div class="linha-fim"><small class="muted" style="font-size:12.5px">${quando(mg.quando)}</small>${mg.tel && mg.status !== 'cancelada' ? `<a class="btn peq ${mg.status === 'agendada' ? 'ok' : ''}" href="${linkWhats(mg.tel, mg.texto)}" target="_blank" rel="noopener" title="Enviar agora pelo WhatsApp" data-a="msg-enviada" data-id="${mg.id}">${ic('mensagem')}</a>` : ''}</div></div>`).join('')}</div>` : UI.vazio('mensagem', 'Nada por aqui')}</div>
        <form class="card" id="f-msg"><div class="card-cab"><h3>O que enviar</h3></div>
          <div class="lista-chaves">
            ${chave('ativo', '<b>Mensagens automáticas ligadas</b>')}
            ${temLemb ? '' : trava('lembretes')}
            ${chave('confirmacao', 'Confirmação quando o cliente agenda ou remarca', '', temLemb)}
            ${chave('lembrete_vespera', 'Lembrete na véspera (18h)', '', temLemb)}
            <label class="campo ${temLemb ? '' : 'travada'}"><span>Lembrete antes do horário</span><select name="lembrete_antes" ${temLemb ? '' : 'disabled'}>${[[0, 'Não enviar'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [120, '2 horas antes']].map(([v, t]) => `<option value="${v}" ${+cfg.lembrete_antes === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            ${chave('cancelamento', 'Aviso ao cliente quando o estabelecimento cancela', '', temLemb)}
            ${chave('aviso_profissional', 'Aviso ao profissional de novo agendamento e cancelamento', '', temLemb)}
            ${chave('resumo_dia', 'Resumo do dia para cada profissional (de manhã)', '', temLemb)}
            ${temCob ? '' : trava('cobranca_auto')}
            <label class="campo ${temCob ? '' : 'travada'}"><span>Lembrete da mensalidade</span><select name="mensal_antes" ${temCob ? '' : 'disabled'}>${[[0, 'Não enviar'], [1, '1 dia antes'], [2, '2 dias antes'], [3, '3 dias antes'], [5, '5 dias antes']].map(([v, t]) => `<option value="${v}" ${+cfg.mensal_antes === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            ${chave('mensal_atraso', 'Cobrança no dia seguinte ao vencimento', '', temCob)}
          </div>
          <div class="acoes" style="margin-top:14px"><button type="button" class="btn" data-a="msg-textos">${ic('lapis')} Editar os textos</button><button class="btn pri">${ic('check')} Salvar</button></div>
        </form>
      </div>`;
  },
  async salvarMensagens(f) {
    const b = this.b, cfg = Mensagens.config(b);
    const lemb = Planos.tem(b, 'lembretes') ? { confirmacao: f.confirmacao.checked, lembrete_vespera: f.lembrete_vespera.checked, lembrete_antes: +f.lembrete_antes.value,
      cancelamento: f.cancelamento.checked, aviso_profissional: f.aviso_profissional.checked, resumo_dia: f.resumo_dia.checked } : {};
    const cob = Planos.tem(b, 'cobranca_auto') ? { mensal_antes: +f.mensal_antes.value, mensal_atraso: f.mensal_atraso.checked } : {};
    await Store.salvar('barbearias', { id: b.id, mensagens: { ...cfg, ativo: f.ativo.checked, ...lemb, ...cob } });
    this.b = Store.get('barbearias', b.id);
    UI.toast('Mensagens salvas.');
    this.pintar();
  },
  formTextosMensagens() {
    const b = this.b, cfg = Mensagens.config(b);
    const m = UI.modal({
      titulo: 'Textos das mensagens', classe: 'largo', fixo: true,
      corpo: `<p class="ajuda" style="margin-bottom:12px">Use: {nome} {estabelecimento} {quando} {hora} {profissional} {servicos} {link} {minutos} {valor} {vencimento}</p>
        <form id="f-txt" class="pilha">${Object.keys(Mensagens.MODELOS).map(k => `<label class="campo"><span>${esc(Mensagens.ROTULOS[k])}</span><textarea name="${k}" rows="2">${esc(Mensagens.modelo(b, k))}</textarea></label>`).join('')}</form>`,
      rodape: `<button class="btn esq" id="txt-padrao">${ic('atualizar')} Voltar ao padrão</button><button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="txt-salvar">${ic('check')} Salvar</button>`
    });
    $('#txt-salvar', m.el).onclick = async () => {
      const d = UI.form($('#f-txt', m.el)), modelos = {};
      for (const k of Object.keys(Mensagens.MODELOS)) if (d[k] && d[k] !== Mensagens.MODELOS[k]) modelos[k] = d[k];
      await Store.salvar('barbearias', { id: b.id, mensagens: { ...cfg, modelos } });
      this.b = Store.get('barbearias', b.id);
      UI.toast('Textos salvos.'); m.fechar();
    };
    $('#txt-padrao', m.el).onclick = async () => {
      await Store.salvar('barbearias', { id: b.id, mensagens: { ...cfg, modelos: {} } });
      this.b = Store.get('barbearias', b.id);
      UI.toast('Textos voltaram ao padrão.'); m.fechar();
    };
  },

  /* ============================ AJUSTES: pagamento e app ============================ */
  secoesAjustesExtras() {
    const pg = Pagamentos.config(this.b), oficial = Pagamentos.oficial();
    const pix = `<label class="campo inteiro"><span>Chave PIX do estabelecimento <small>(aparece nas cobranças de mensalidade)</small></span><input name="pg_pix" value="${esc(pg.chave_pix)}" placeholder="CNPJ, e-mail, telefone ou chave aleatória"></label>`;
    const app = `<div class="card"><div class="card-cab"><div><h3>App no celular e notificações</h3><p>Instale o painel como app e receba avisos de novos agendamentos</p></div></div>
        <div class="acoes"><button type="button" class="btn" data-a="instalar-app">${ic('baixar')} Instalar o app</button><button type="button" class="btn" data-a="ativar-notif">${ic('info')} Ativar notificações neste aparelho</button><button type="button" class="btn fantasma" data-a="testar-notif">Testar</button></div>
        <p class="ajuda" style="margin-top:10px">${PWA.textoSituacao()}</p></div>`;
    if (oficial) return `${this.cartaoWhatsApp()}<div class="card" id="pagamento"><div class="card-cab"><div><h3>Pagamento</h3><p>Como o cliente paga você</p></div></div>
        ${this.corpoMercadoPago(pg, pix)}</div>${app}`;
    if (!Planos.tem(this.b, 'pagamento_app')) return `<div class="card" id="pagamento"><div class="card-cab"><div><h3>Pagamento</h3><p>Como o cliente paga você</p></div></div>
        <button type="button" class="trava-linha" data-a="bloq-recurso" data-v="pagamento_app" style="margin-bottom:14px">${ic('cadeado')}<span>Cobrança direto no app (PIX e cartão no chat): disponível no plano ${esc(Planos.minimoPara('pagamento_app')?.nome || 'superior')}</span><b>Quero</b></button>
        <div class="grade-form">${pix}</div></div>${app}`;
    const radio = (nome, atual, ops) => `<div class="opcoes-grade">${ops.map(([v, t]) => `<label class="op-btn" style="cursor:pointer"><input type="radio" name="${nome}" value="${v}" ${String(atual) === String(v) ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
    return `<div class="card" id="pagamento"><div class="card-cab"><div><h3>Pagamento pelo app</h3><p>PIX ou cartão no chat, antes do atendimento</p></div></div>
        <div class="aviso-faixa info" style="margin-bottom:14px">${ic('info')}<span>Na demonstração o pagamento é simulado. Na versão oficial o dinheiro cai direto na conta do estabelecimento.</span></div>
        <div class="pilha">
          <div class="campo"><span>Como funciona</span>${radio('pg_modo', pg.modo, [['desligado', 'Desligado'], ['opcional', 'Opcional: o cliente escolhe'], ['obrigatorio', 'Obrigatório para agendar']])}</div>
          <div class="campo"><span>Quanto cobrar antecipado</span>${radio('pg_sinal', pg.sinal, [[100, 'O valor todo'], [50, 'Sinal de 50%'], [30, 'Sinal de 30%']])}</div>
          <div class="grade-form">
            <label class="campo"><span>Se o cliente cancelar no prazo</span><select name="pg_cancelamento"><option value="credito" ${pg.cancelamento === 'credito' ? 'selected' : ''}>O valor vira crédito para o próximo</option><option value="devolucao" ${pg.cancelamento === 'devolucao' ? 'selected' : ''}>O valor é devolvido</option></select></label>
            <label class="campo"><span>Se o cliente faltar</span><select name="pg_falta"><option value="retem" ${pg.falta === 'retem' ? 'selected' : ''}>O valor fica com o estabelecimento</option><option value="credito" ${pg.falta === 'credito' ? 'selected' : ''}>O valor vira crédito</option></select></label>
            ${pix}
          </div>
        </div></div>
      ${app}`;
  },
  lerAjustesExtras(f) {
    const d = UI.form(f), pg = Pagamentos.config(this.b);
    if (!f.querySelector('[name="pg_modo"]')) return { pagamento: { ...pg, chave_pix: d.pg_pix ?? pg.chave_pix } };
    return { pagamento: { ...pg, modo: d.pg_modo || 'desligado', sinal: +d.pg_sinal || 100, cancelamento: d.pg_cancelamento, falta: d.pg_falta, chave_pix: d.pg_pix } };
  },

  /* ============================ PLANOS DE VENDA ============================ */
  // a tela aberta precisa de um recurso que o plano não tem? mostra o convite em vez da tela
  telaDoPlano() {
    if (!this.eDono()) return '';
    const b = this.b;
    const precisa = this.aba === 'mensalistas' ? ['mensalistas'] : this.aba === 'promocoes' ? ['promocoes']
      : this.aba === 'mensagens' ? ['lembretes', 'cobranca_auto'] : this.aba === 'clientes' && this.cliAba === 'fidelidade' ? ['fidelidade'] : null;
    if (!precisa || precisa.some(r => Planos.tem(b, r))) return '';
    return this.v_bloqueado(precisa[0]);
  },
  linkMudarPlano(plano, recurso) {
    const b = this.b;
    return linkWhats(Store.db.config.suporte_whatsapp, `Olá! Sou responsável por ${b.nome} (${UI.linkCliente(b)}) e quero mudar para o plano ${plano.nome} do ${APP.nome}${recurso ? ` para usar ${RECURSOS[recurso].nome}` : ''}.`);
  },
  v_bloqueado(recurso) {
    const b = this.b, r = RECURSOS[recurso], alvo = Planos.minimoPara(recurso), atual = Planos.de(b);
    const titulo = { mensalistas: 'Mensalistas', promocoes: 'Promoções', fidelidade: 'Fidelidade', lembretes: 'Mensagens automáticas' }[recurso] || r.nome;
    const exemplos = {
      mensalistas: ['Planos mensais com valor fixo e atendimentos liberados no mês', 'O cliente agenda todos os horários do mês de uma vez pelo chat', 'Controle de quem pagou, quem está em atraso e cobrança pelo WhatsApp'],
      promocoes: ['Descontos com prazo, dias da semana e horários', 'O chat divulga as promoções sozinho para o cliente', 'Preço promocional já aparece no agendamento'],
      fidelidade: ['Cartão fidelidade: a cada X visitas, um prêmio', 'O desconto entra sozinho no atendimento certo', 'Lista de quem está perto do prêmio para chamar de volta'],
      lembretes: ['Confirmação do horário no WhatsApp do cliente', 'Lembrete na véspera e minutos antes: menos faltas', 'Aviso ao profissional de novo agendamento e cancelamento']
    }[recurso] || [r.desc];
    return `<div class="topo"><div><h1>${esc(titulo)}</h1><p class="sub">${esc(r.desc)}</p></div></div>
      ${recurso === 'fidelidade' ? this.abasClientes() : ''}
      <div class="card bloqueado">
        <span class="bloq-icone">${ic('cadeado')}</span>
        <h2>${esc(r.nome)} não está no seu plano${atual ? ` ${esc(atual.nome)}` : ''}</h2>
        ${alvo ? `<p>Disponível a partir do plano <b>${esc(alvo.nome)}</b>, por <b>${dinheiro(alvo.preco)}/mês</b>.</p>` : '<p>Fale com o suporte para liberar.</p>'}
        <ul class="bloq-lista">${exemplos.map(t => `<li>${ic('check')}<span>${esc(t)}</span></li>`).join('')}</ul>
        <div class="acoes" style="justify-content:center">${alvo ? `<a class="btn pri" href="${this.linkMudarPlano(alvo, recurso)}" target="_blank" rel="noopener">${ic('mensagem')} Quero esse recurso</a>` : ''}<button class="btn" data-a="ver-planos" data-v="${recurso}">${ic('diamante')} Comparar planos</button></div>
      </div>`;
  },
  // lista curta do que o plano atual libera (cartão Assinatura em Ajustes)
  resumoPlano() {
    const b = this.b, p = Planos.de(b);
    if (!p) return '';
    const teste = b.status === 'teste';
    return `<div class="plano-resumo">
        <span class="plano-item">${ic('usuario')} ${p.max_barbeiros ? `Até ${p.max_barbeiros} profissiona${p.max_barbeiros > 1 ? 'is' : 'l'}` : 'Profissionais sem limite'}</span>
        ${Object.entries(RECURSOS).map(([k, r]) => `<span class="plano-item ${p.recursos?.includes(k) ? '' : 'fora'}">${ic(p.recursos?.includes(k) ? 'check' : 'cadeado')} ${esc(r.nome)}</span>`).join('')}
      </div>${teste ? `<p class="ajuda" style="margin:8px 0 4px">No período de teste tudo fica liberado para você experimentar. Depois vale o que o plano ${esc(p.nome)} inclui.</p>` : ''}`;
  },
  verPlanos(recurso) {
    const b = this.b, atual = Planos.de(b), planos = Store.t('planos').filter(p => p.ativo !== false).sort((p, q) => p.preco - q.preco);
    const linha = (ok, txt) => `<li class="${ok ? '' : 'fora'}">${ic(ok ? 'check' : 'x')}<span>${txt}</span></li>`;
    UI.modal({
      titulo: `Planos do ${APP.nome}`, classe: 'largo',
      corpo: `<div class="planos-grade">${planos.map(p => {
        const eAtual = p.id === atual?.id, destaque = recurso && p.recursos?.includes(recurso) && Planos.minimoPara(recurso)?.id === p.id;
        return `<div class="plano-card ${eAtual ? 'atual' : ''} ${destaque ? 'destaque' : ''}">
          <div class="plano-topo"><h3>${esc(p.nome)}</h3>${eAtual ? UI.badge('Seu plano', 'ok') : destaque ? UI.badge('Libera o que você quer', 'info') : ''}</div>
          <div class="plano-preco"><b>${dinheiro(p.preco)}</b><small>/mês</small></div>
          <p class="muted">${esc(p.descricao || '')}</p>
          <ul class="plano-lista">
            ${linha(true, p.max_barbeiros ? `Até ${p.max_barbeiros} profissiona${p.max_barbeiros > 1 ? 'is' : 'l'}` : 'Profissionais sem limite')}
            ${linha(true, 'Agendamento pelo chat, agenda, clientes, catálogo e faturamento')}
            ${Object.entries(RECURSOS).map(([k, r]) => linha(p.recursos?.includes(k), esc(r.nome))).join('')}
          </ul>
          ${eAtual ? '<button class="btn" disabled>Plano atual</button>' : `<a class="btn ${destaque || (!recurso && p.preco > (atual?.preco || 0)) ? 'pri' : ''}" href="${this.linkMudarPlano(p, recurso && p.recursos?.includes(recurso) ? recurso : null)}" target="_blank" rel="noopener">${ic('mensagem')} Quero este plano</a>`}
        </div>`;
      }).join('')}</div>
      <p class="ajuda" style="margin-top:12px">A mudança de plano é feita pelo suporte. O valor novo vale a partir da próxima mensalidade.</p>`
    });
  },

  /* ============================ cliques das telas novas ============================ */
  async cliqueExtra(a, el, e) {
    const id = el.dataset.id;
    switch (a) {
      case 'nova-promo': return this.formPromo();
      case 'editar-promo': return this.formPromo(id);
      case 'promo-filtro': this.promoFiltro = el.dataset.v; return this.pintar();
      case 'nova-fid': return this.formFidelidade();
      case 'editar-fid': return this.formFidelidade(id);
      case 'mens-aba': this.mensAba = el.dataset.v; return this.pintar();
      case 'mens-mes': this.mensMes = Datas.somaMes(this.mensMes, +el.dataset.d); return this.pintar();
      case 'novo-plano-m': return this.formPlanoMensal();
      case 'editar-plano-m': return this.formPlanoMensal(id);
      case 'novo-mens': return this.formMensalista();
      case 'editar-mens': return this.formMensalista(id);
      case 'ver-mens': return this.verMensalista(id);
      case 'agendar-mens': {
        const x = Store.get('mensalistas', id), p = Mensal.plano(x);
        return this.formAg({ cliente: { nome: x.cliente_nome, telefone: x.cliente_tel }, servicos: p?.servicos?.slice(0, 1) || [], barbeiroId: x.barbeiro_id || undefined });
      }
      case 'gerar-mens': { const n = await Mensal.gerarMes(this.b, this.mensMes); await Mensagens.mensalidades(this.b); UI.toast(n ? `${n} cobrança${n > 1 ? 's geradas' : ' gerada'}.` : 'Nenhuma cobrança nova.'); return this.pintar(); }
      case 'pagar-mens': return this.pagarMensalidade(id);
      case 'cobrar-mens': return this.cobrarMensalidade(id);
      case 'desfazer-mens':
        if (!await UI.confirmar('A mensalidade volta a ficar em aberto.', { titulo: 'Desfazer pagamento', ok: 'Desfazer' })) return;
        await Store.salvar('mensalidades', { id, status: 'pendente', pago_em: null, forma: null });
        return this.pintar();
      case 'fechar-dia': return this.fecharDia(el.dataset.d || this.dia);
      case 'avulso': return this.formAvulso(this.dia);
      case 'msg-aba': this.msgAba = el.dataset.v; return this.pintar();
      case 'msg-textos': return this.formTextosMensagens();
      case 'instalar-app': return PWA.instalar();
      case 'ativar-notif': { const ok = await PWA.pedirPermissao(); UI.toast(ok ? 'Notificações ativadas neste aparelho.' : 'As notificações foram bloqueadas no navegador.', ok ? 'ok' : 'erro'); return this.pintar(); }
      case 'testar-notif': return PWA.notificar('BSFlow', 'As notificações deste aparelho estão funcionando.', UI.linkPainel(this.b));
      case 'ver-planos': return this.verPlanos();
      case 'ver-ajuda': return Ajuda.abrir();
      case 'wa-conectar': return this.waConectar();
      case 'wa-testar': return this.waAcao('testar', 'Mensagem de teste enviada para o WhatsApp do estabelecimento.');
      case 'wa-desconectar':
        if (!await UI.confirmar('As mensagens automáticas param até você conectar de novo.', { titulo: 'Desconectar o WhatsApp', ok: 'Desconectar', perigo: true })) return;
        return this.waAcao('desconectar', 'WhatsApp desconectado.');
      case 'wa-atualizar': return this.waAcao('estado');
      case 'trocar-senha': return this.trocarSenha();
      case 'passos-ocultar': await Passos.marcar(this.b, 'oculto'); this.b = Store.get('barbearias', this.b.id); UI.toast('Primeiros passos escondidos. O guia continua em Como usar.'); return this.pintar();
      case 'passo-feito': await Passos.marcar(this.b, el.dataset.v); this.b = Store.get('barbearias', this.b.id); return this.pintar();
      case 'passo-divulgar': UI.copiar(UI.linkCliente(this.b)); await Passos.marcar(this.b, 'divulgar'); this.b = Store.get('barbearias', this.b.id); return this.pintar();
      case 'msg-enviada': {
        const mg = Store.get('mensagens', id);
        if (mg && mg.status === 'agendada') await Store.salvar('mensagens', { id, status: 'enviada', enviada_em: Mensagens.agoraTxt() });
        return setTimeout(() => this.pintar(), 300);
      }
      case 'bloq-recurso': return this.verPlanos(el.dataset.v);
    }
  }
});
