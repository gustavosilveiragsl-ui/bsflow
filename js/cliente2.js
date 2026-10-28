'use strict';
/* ============================================================
   Chat — promoções, fidelidade, plano mensal e pagamento pelo app
   ============================================================ */
Object.assign(Cliente, {
  seloPromo(s) {
    const p = Promocoes.doItem(this.b, 'servicos', s.id)[0];
    if (!p) return '';
    const crit = Promocoes.criterios(p);
    return `<em class="w-sv-promo">${ic('brilho')} ${esc(Promocoes.rotulo(p))}${crit.length ? ` · ${esc(crit[0])}` : ''}</em>`;
  },
  orcamento(sel, antecipado = false) {
    return Orcamento.calcular(this.b, sel.servicos, { data: sel.data, ini: sel.ini, tel: sel.cliente?.tel, online: true, antecipado });
  },
  // linhas do resumo de um agendamento já feito
  detalheAg(ag) {
    const linhas = [];
    if (ag.cobertos?.length) linhas.push({ rot: 'Coberto pelo plano', valor: -soma(ag.servicos.filter(s => ag.cobertos.includes(s.id)), s => s.preco) });
    if (ag.desconto_previsto) linhas.push({ rot: ag.desconto_motivo === 'fidelidade' ? 'Desconto da fidelidade' : 'Desconto da promoção', valor: -ag.desconto_previsto });
    if (ag.credito_usado) linhas.push({ rot: 'Crédito usado', valor: -ag.credito_usado });
    const pg = ag.pagamento?.status === 'pago'
      ? `Pago pelo app (${FORMAS_PAGAMENTO[ag.pagamento.forma] || ag.pagamento.forma})${ag.pagamento.tipo === 'sinal' ? ` · sinal de ${dinheiro(ag.pagamento.valor)}, o resto no dia` : ''}`
      : Pagamentos.ativo(this.b) && ag.total > 0 ? 'No local' : '';
    return { linhas, tabela: ag.valor_tabela ?? soma(ag.servicos, s => s.preco), pagamento: pg };
  },

  /* ---------------- saudação: plano, fidelidade, crédito e promoções ---------------- */
  async saudacaoExtras(eu) {
    const b = this.b;
    if (eu?.tel) {
      const m = Mensal.doTelefone(b, eu.tel);
      if (m) {
        const p = Mensal.plano(m), ym = Datas.mes(Datas.hoje()), s = Mensal.situacao(b, m);
        await this.bot(`Seu plano <b>${esc(p?.nome || '')}</b>: ${Mensal.usados(b, m, ym)} de ${p?.qtd_mes || 0} atendimentos usados em ${MESES[+ym.slice(5) - 1]}.` +
          (s.cod === 'atrasado' ? ' A mensalidade está em atraso: toque em <b>Agendar pelo meu plano</b> para pagar.' : s.cod === 'vence_logo' ? ` A mensalidade vence ${Datas.relativa(s.cobranca.vencimento)}.` : ''));
      }
      const fid = Fidelidade.doCliente(b, eu.tel).find(f => f.feitas);
      if (fid) await this.bot(fid.ganhaAgora
        ? `${esc(fid.prog.nome)}: no seu próximo atendimento você ganha o prêmio (${esc(Fidelidade.premio(fid.prog).replace(/^tem |^sai /, ''))})!`
        : `${esc(fid.prog.nome)}: ${fid.noCiclo} de ${fid.prog.a_cada}. Faltam ${fid.falta + 1} para o prêmio.`);
      const cr = Creditos.saldo(b, eu.tel);
      if (cr > 0) await this.bot(`Você tem <b>${dinheiro(cr)} de crédito</b> aqui. Ele entra sozinho no próximo agendamento.`);
    }
    const promos = Promocoes.divulgaveis(b);
    if (promos.length) {
      await this.bot(promos.length > 1 ? 'Olha as promoções de agora:' : 'Olha a promoção de agora:');
      this.add('bot', `<div class="widget"><div class="carrossel">${promos.slice(0, 5).map(p => this.cardPromo(p)).join('')}</div></div>`, 'com-widget');
    }
  },
  cardPromo(p) {
    const crit = Promocoes.criterios(p);
    return `<div class="cc promo-cc"><div class="promo-faixa">${esc(Promocoes.rotulo(p))}</div><div class="cc-txt"><b>${esc(p.nome)}</b><p>${esc(p.descricao || '')}</p>
      <small class="promo-quando">${ic('calendario')} ${esc(cap(Promocoes.periodo(p)))}${crit.length ? ` · ${esc(crit.join(', '))}` : ''}</small></div>
      <button type="button" class="cc-btn" data-a="promo-usar" data-id="${p.id}">${ic(p.alvo === 'produtos' ? 'sacola' : 'calendario-mais')} ${p.alvo === 'produtos' ? 'Ver produtos' : 'Aproveitar'}</button></div>`;
  },
  fluxoPromocoes() {
    return this.rodar(async () => {
      const promos = Promocoes.divulgaveis(this.b);
      if (!promos.length) { await this.bot('No momento não temos promoção rolando. Mas fica de olho, sempre aparece novidade!'); return this.menuRapido(['agendar']); }
      await this.bot(promos.length > 1 ? `Temos <b>${promos.length} promoções</b>. Arraste para o lado:` : 'Essa é a promoção de agora:');
      this.add('bot', `<div class="widget"><div class="carrossel">${promos.map(p => this.cardPromo(p)).join('')}</div></div>`, 'com-widget');
      await this.bot('O desconto entra sozinho quando o horário ou o produto se encaixa nas regras.', { espera: 400 });
      this.menuRapido(['agendar', 'produtos']);
    });
  },
  usarPromocao(id) {
    const p = Store.get('promocoes', id);
    if (!p) return;
    this.eu(`Quero aproveitar: ${p.nome}`);
    if (p.alvo === 'produtos') return this.fluxoProdutos();
    const svs = p.itens?.length ? p.itens.map(i => Store.get('servicos', i)).filter(s => s && s.ativo !== false && s.online !== false) : [];
    return this.fluxoAgendar({ servicos: svs.length === 1 ? svs : null, promo: p });
  },

  /* ---------------- fidelidade ---------------- */
  async pegarTelefone(pergunta, { sempre = false } = {}) {
    const eu = this.lembrado();
    if (eu?.tel && !sempre) return eu;
    await this.bot(pergunta);
    const tel = this.normTel(await this.texto({ placeholder: '(21) 99999-9999', tel: true, validar: v => this.validarTel(v) }));
    const c = Store.de('clientes', this.b.id).find(x => x.telefone === tel), m = Store.de('mensalistas', this.b.id).find(x => x.cliente_tel === tel);
    const r = { nome: c?.nome || m?.cliente_nome || '', tel };
    if (r.nome) this.lembrar(r);
    return r;
  },
  fluxoFidelidade() {
    return this.rodar(async () => {
      const b = this.b, progs = Fidelidade.programas(b);
      if (!progs.length) { await this.bot('Ainda não temos cartão fidelidade por aqui.'); return this.menuRapido(['agendar']); }
      const eu = await this.pegarTelefone('Me diz seu WhatsApp que eu vejo como está seu cartão fidelidade.');
      for (const f of Fidelidade.doCliente(b, eu.tel)) {
        const n = f.prog.a_cada;
        this.add('bot', `<div class="widget fid-chat"><b>${ic('estrela')} ${esc(f.prog.nome)}</b><p>${esc(Fidelidade.texto(f.prog))}</p>
          <div class="selos">${[...Array(n)].map((_, i) => `<i class="${i < f.noCiclo ? 'on' : ''} ${i === n - 1 ? 'premio' : ''}">${i === n - 1 ? ic('estrela') : i < f.noCiclo ? ic('check') : ''}</i>`).join('')}</div>
          <small>${f.ganhaAgora ? 'No seu próximo atendimento você ganha o prêmio!' : `${f.noCiclo} de ${n} · faltam ${f.falta + 1} para o prêmio`}</small></div>`, 'com-widget');
      }
      await this.bot('Cada atendimento concluído conta um selo. O desconto entra sozinho na hora certa.', { espera: 400 });
      this.menuRapido(['agendar']);
    });
  },

  /* ---------------- depois de agendar ---------------- */
  async posAgendamento(ag) {
    const b = this.b;
    if (ag.mensalista_id) {
      const m = Store.get('mensalistas', ag.mensalista_id), ym = Datas.mes(ag.data);
      if (m) await this.bot(`Esse horário é do seu plano. Restam <b>${Mensal.restantes(b, m, ym)}</b> atendimento(s) em ${MESES[+ym.slice(5) - 1]}.`);
    }
    const cfg = Mensagens.config(b);
    if (cfg.ativo && Planos.tem(b, 'lembretes') && ag.cliente_tel && (cfg.lembrete_antes || cfg.lembrete_vespera))
      await this.bot(`Você vai receber a confirmação e um lembrete no WhatsApp${cfg.lembrete_antes ? ` ${cfg.lembrete_antes} minutos antes do horário` : ' na véspera'}.`, { espera: 400 });
    if (!PWA.instalado()) {
      const notif = 'Notification' in window && Notification.permission === 'default';
      this.add('bot', `<div class="widget w-botoes"><button type="button" class="w-op" data-a="instalar" data-rot="Instalar o app">${ic('baixar')} Instalar o app de ${esc(b.nome)}</button>${notif ? `<button type="button" class="w-op" data-a="notif">${ic('info')} Receber avisos neste celular</button>` : ''}</div>`, 'com-widget');
    }
  },
  async ativarNotificacoes() {
    const ok = await PWA.pedirPermissao();
    this.add('bot', ok ? 'Pronto! Os avisos vão aparecer neste celular.' : 'Tudo bem. Os lembretes continuam chegando pelo WhatsApp.');
    if (ok) PWA.notificar(this.b.nome, 'Avisos ativados. Até o seu horário!', UI.linkCliente(this.b));
  },

  /* ---------------- pagamento pelo app ---------------- */
  // devolve { orc, pagamento } ou 'voltar'
  async pPagamento(sel) {
    const b = this.b, cfg = Pagamentos.config(b);
    const local = this.orcamento(sel, false);
    if (!Pagamentos.ativo(b) || local.total <= 0) return { orc: local, pagamento: null };
    const ant = this.orcamento(sel, true);
    const ganho = round2(local.total - ant.total), sinal = cfg.sinal < 100, cobrar = Pagamentos.aCobrar(b, ant.total);
    let agora = cfg.modo === 'obrigatorio';
    if (!agora) {
      const promo = ant.promos.find(p => p.criterios?.antecipado);
      await this.bot(ganho > 0
        ? `Pagando agora pelo app sai por <b>${dinheiro(ant.total)}</b> em vez de ${dinheiro(local.total)}${promo ? ` (${esc(promo.nome)})` : ''}. Como prefere?`
        : 'Quer já deixar pago pelo app? Assim seu horário fica garantido.');
      agora = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('cartao')} Pagar agora · ${dinheiro(cobrar)}${sinal ? ' de sinal' : ''}`, 'pri')}${this.op(1, `${ic('loja')} Pagar no local · ${dinheiro(local.total)}`)}</div>`,
        [{ valor: true, eco: 'Pagar agora pelo app' }, { valor: false, eco: 'Pagar no local' }],
        { casar: t => { const n = semAcento(t); if (/agora|app|pix|cartao/.test(n)) return { valor: true }; if (/local|depois|na hora|la/.test(n)) return { valor: false }; return undefined; } });
    } else {
      await this.bot(`Para garantir o horário, o pagamento é feito agora pelo app${sinal ? `: um sinal de <b>${dinheiro(cobrar)}</b> (${cfg.sinal}%) e o resto no dia` : `: <b>${dinheiro(cobrar)}</b>`}.${ganho > 0 ? ' Já com o desconto de pagamento antecipado.' : ''}`);
    }
    if (!agora) return { orc: local, pagamento: null };
    const pg = await this.pagar(cobrar, sinal ? 'Sinal do agendamento' : 'Pagamento do agendamento');
    if (!pg) {
      if (cfg.modo === 'obrigatorio') { await this.bot('Sem o pagamento não consigo reservar o horário. Vamos ver o resumo de novo?'); return 'voltar'; }
      await this.bot('Sem problema, você paga no local.');
      return { orc: local, pagamento: null };
    }
    return { orc: ant, pagamento: { ...pg, tipo: sinal ? 'sinal' : 'total' } };
  },
  // tela de pagamento (simulada na demonstração); devolve o pagamento ou null
  async pagar(valor, titulo) {
    const b = this.b, f = this.fluxo;
    await this.bot('Como você quer pagar?', { espera: 300 });
    const forma = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('gota')} PIX`, 'pri')}${this.op(1, `${ic('cartao')} Cartão de crédito`)}${this.op(2, 'Voltar')}</div>`,
      [{ valor: 'pix', eco: 'PIX' }, { valor: 'cartao', eco: 'Cartão de crédito' }, { valor: null, eco: 'Voltar' }],
      { casar: t => { const n = semAcento(t); if (/pix/.test(n)) return { valor: 'pix' }; if (/cartao|credito/.test(n)) return { valor: 'cartao' }; if (/voltar|nao/.test(n)) return { valor: null }; return undefined; } });
    if (!forma) return null;
    const ref = uid('pg_'), topo = `<div class="pag-topo"><b>${esc(titulo)}</b><span>${dinheiro(valor)}</span></div>`;
    let ok;
    if (forma === 'pix') {
      const codigo = Pagamentos.copiaCola(b, valor, ref);
      ok = await this.widget(`<div class="widget pag-box">${topo}<div class="pag-qr">${Pagamentos.qrSimulado(codigo)}</div>
        <p class="pag-aviso">${ic('info')} Demonstração: este PIX é ilustrativo e não cobra nada de verdade.</p>
        <div class="pag-codigo"><code>${esc(codigo.slice(0, 40))}…</code><button type="button" class="btn-chat" data-a="copiar-pix" data-v="${esc(codigo)}">${ic('copiar')} Copiar</button></div>
        <div class="w-botoes">${this.op(0, `${ic('check')} Já paguei (simular)`, 'pri')}${this.op(1, 'Voltar')}</div></div>`,
        [{ valor: true, eco: 'Já paguei' }, { valor: false, eco: 'Voltar' }], { casar: simNao });
    } else {
      ok = await this.widget(`<div class="widget pag-box">${topo}
        <p class="pag-aviso">${ic('cadeado')} Na versão oficial abre a página segura do meio de pagamento; o BSFlow não guarda dados de cartão. Aqui é uma simulação.</p>
        <div class="w-botoes">${this.op(0, `${ic('check')} Simular pagamento aprovado`, 'pri')}${this.op(1, 'Voltar')}</div></div>`,
        [{ valor: true, eco: 'Pagar' }, { valor: false, eco: 'Voltar' }], { casar: simNao });
    }
    if (!ok) return null;
    const espera = this.add('bot', '<span class="pag-girando"></span> Confirmando o pagamento…');
    const pg = await Pagamentos.simular(forma, valor);
    espera.remove();
    if (f && (!f.vivo || f !== this.fluxo)) throw CANCELADO;
    await this.bot(`${ic('check')} Pagamento de <b>${dinheiro(valor)}</b> aprovado.`, { espera: 200 });
    return pg;
  },

  /* ---------------- plano mensal ---------------- */
  cardPlano(p) {
    const svs = p.servicos.map(id => Store.get('servicos', id)?.nome).filter(Boolean).join(', ');
    return `<div class="cc promo-cc"><div class="promo-faixa">${dinheiro(p.valor)}/mês</div><div class="cc-txt"><b>${esc(p.nome)}</b><p>${esc(p.descricao || '')}</p>
      <small class="promo-quando">${ic('check')} ${esc(Mensal.regrasTexto(p).slice(0, 2).join(' · '))}</small><small class="promo-quando">${ic('tesoura')} ${esc(svs)}</small></div></div>`;
  },
  fluxoPlano() {
    return this.rodar(async () => {
      const b = this.b, lemb = this.lembrado();
      let m = lemb ? Mensal.doTelefone(b, lemb.tel) : null;
      if (!m) {
        const planos = Mensal.planos(b);
        if (!planos.length) { await this.bot('Ainda não temos planos mensais por aqui.'); return this.menuRapido(['agendar']); }
        await this.bot(planos.length > 1 ? 'Esses são os nossos planos mensais:' : 'Esse é o nosso plano mensal:');
        this.add('bot', `<div class="widget"><div class="carrossel">${planos.map(p => this.cardPlano(p)).join('')}</div></div>`, 'com-widget');
        const r = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('coroa')} Já sou mensalista`, 'pri')}${this.op(1, `${ic('cartao')} Quero assinar`)}</div>`,
          [{ valor: 'sou', eco: 'Já sou mensalista' }, { valor: 'assinar', eco: 'Quero assinar' }],
          { casar: t => /assin|quero/.test(semAcento(t)) ? { valor: 'assinar' } : /sou|ja/.test(semAcento(t)) ? { valor: 'sou' } : undefined });
        if (r === 'assinar') return this.assinarPlano(planos);
        const eu = await this.pegarTelefone('Me diz o WhatsApp cadastrado no seu plano.', { sempre: true });
        m = Mensal.doTelefone(b, eu.tel);
        if (!m) {
          await this.bot('Não achei plano ativo com esse número. Confere com a gente pelo WhatsApp?');
          this.botaoWhats('Olá! Sou mensalista e não estou achando meu plano no app.');
          return this.menuRapido(['agendar']);
        }
        this.lembrar({ nome: m.cliente_nome, tel: m.cliente_tel });
        await this.bot(`Achei, <b>${esc(primeiroNome(m.cliente_nome))}</b>!`, { espera: 300 });
      }
      return this.menuPlano(m);
    });
  },
  async menuPlano(m) {
    const b = this.b, p = Mensal.plano(m), hoje = Datas.hoje(), ym = Datas.mes(hoje), s = Mensal.situacao(b, m);
    const usados = Mensal.usados(b, m, ym), rest = Mensal.restantes(b, m, ym);
    const marcados = Agenda.proximosDoCliente(b, m.cliente_tel).filter(a => a.mensalista_id === m.id).length;
    this.add('bot', `<div class="widget plano-chat"><div class="promo-topo"><b>${ic('coroa')} ${esc(p.nome)}</b>${UI.badge(s.texto, s.tom)}</div>
      <div class="plano-uso"><b>${usados}</b> de ${p.qtd_mes} atendimentos usados em ${MESES[+ym.slice(5) - 1]}</div>
      <div class="parte-trilho"><div style="width:${Math.round(usados / p.qtd_mes * 100)}%"></div></div>
      <small>${dinheiro(Mensal.valor(m))}/mês · vence todo dia ${m.dia_vencimento}${marcados ? ` · ${marcados} horário(s) marcado(s)` : ''}</small></div>`, 'com-widget');
    const pend = s.cobranca?.status === 'pendente' && (s.cod !== 'em_dia' || Datas.diff(s.cobranca.vencimento, hoje) <= 10) ? s.cobranca : null;
    const pode = Mensal.podeAgendar(b, m, hoje);
    const ops = [];
    const prox = Datas.somaMes(ym, 1), proxAberto = `${prox}-01` <= Agenda.ultimoDiaCliente(b) && Mensal.podeAgendar(b, m, `${prox}-01`).ok;
    if (rest > 0 && pode.ok) ops.push({ valor: 'um', eco: 'Agendar um horário', rot: `${ic('calendario-mais')} Agendar um horário`, cls: 'pri' });
    if ((rest > 1 && pode.ok) || proxAberto) ops.push({ valor: 'todos', eco: 'Agendar vários de uma vez', rot: `${ic('calendario')} ${rest > 1 && pode.ok ? `Agendar os ${rest} de uma vez` : `Agendar os de ${MESES[+prox.slice(5) - 1]}`}` });
    if (pend && Pagamentos.ativo(b)) ops.push({ valor: 'pagar', eco: 'Pagar a mensalidade', rot: `${ic('cartao')} Pagar mensalidade · ${dinheiro(pend.valor)}`, cls: s.cod === 'atrasado' ? 'pri' : '' });
    ops.push({ valor: 'meus', eco: 'Meus horários', rot: `${ic('relogio')} Meus horários` });
    if (!pode.ok) await this.bot(esc(pode.motivo));
    else if (!rest) await this.bot(`Você já usou todos os atendimentos de ${MESES[+ym.slice(5) - 1]}. No dia 1º libera de novo.`);
    const r = await this.widget(`<div class="widget w-botoes">${ops.map((o, i) => this.op(i, o.rot, o.cls || '')).join('')}</div>`, ops.map(o => ({ valor: o.valor, eco: o.eco })));
    if (r === 'um') return this.agendarPeloPlano(m);
    if (r === 'todos') return this.agendarTodos(m);
    if (r === 'pagar') return this.pagarMensalidade(m, pend);
    return this.fluxoMeus();
  },
  servicosDoPlano(m) {
    return (Mensal.plano(m)?.servicos || []).map(id => Store.get('servicos', id)).filter(s => s && s.ativo !== false);
  },
  agendarPeloPlano(m) {
    const svs = this.servicosDoPlano(m), x = m.barbeiro_id ? Store.get('barbeiros', m.barbeiro_id) : undefined;
    return this.fluxoAgendar({ servicos: svs.length === 1 ? svs : null, barbeiro: x && x.ativo !== false ? x : undefined, cliente: { nome: m.cliente_nome, tel: m.cliente_tel } });
  },
  // marca de uma vez os atendimentos que faltam no mês, no mesmo dia da semana e horário
  async agendarTodos(m) {
    const b = this.b, p = Mensal.plano(m), hoje = Datas.hoje(), limite = Agenda.ultimoDiaCliente(b);
    const sv = this.servicosDoPlano(m)[0];
    if (!sv) { await this.bot('O serviço do plano não está disponível agora. Fala com a gente pelo WhatsApp.'); return this.botaoWhats(); }
    // mês: o atual e, se já estiver aberto para agendar, o próximo
    const meses = [Datas.mes(hoje), Datas.somaMes(Datas.mes(hoje), 1)]
      .filter(x => `${x}-01` <= limite || x === Datas.mes(hoje))
      .filter(x => Mensal.restantes(b, m, x) > 0 && Mensal.podeAgendar(b, m, x === Datas.mes(hoje) ? hoje : `${x}-01`).ok);
    if (!meses.length) { await this.bot('Não há atendimentos do plano para marcar agora.'); return this.menuRapido(['plano', 'meus']); }
    let ym = meses[0];
    if (meses.length > 1) {
      await this.bot('Para qual mês?');
      ym = await this.widget(`<div class="widget w-botoes">${meses.map((x, i) => this.op(i, `${cap(MESES[+x.slice(5) - 1])} · ${Mensal.restantes(b, m, x)} livre(s)`)).join('')}</div>`,
        meses.map(x => ({ valor: x, eco: cap(MESES[+x.slice(5) - 1]) })));
    }
    const rest = Mensal.restantes(b, m, ym), dur = sv.duracao;
    let x = m.barbeiro_id ? Store.get('barbeiros', m.barbeiro_id) : undefined;
    const aptos = Agenda.barbeiros(b, [sv.id]);
    if (x === undefined) x = await this.pBarbeiro([sv], aptos);
    const lista = x ? [x] : aptos;
    const inicio = ym === Datas.mes(hoje) ? hoje : `${ym}-01`;
    const datasDo = dow => { const l = []; for (let d = inicio; Datas.mes(d) === ym && d <= limite; d = Datas.soma(d, 1)) if (Datas.dow(d) === dow) l.push(d); return l; };
    const permitidos = (p.regras?.dias?.length ? p.regras.dias : [0, 1, 2, 3, 4, 5, 6])
      .filter(dow => datasDo(dow).some(d => lista.some(o => Agenda.horarios(b, o, d, dur).length)));
    if (!permitidos.length) { await this.bot(`Não tem mais vaga pelo plano em ${MESES[+ym.slice(5) - 1]}. Fala com a gente pelo WhatsApp:`); return this.botaoWhats('Olá! Quero marcar meus horários do plano.'); }
    await this.bot(`Vamos deixar seus <b>${rest}</b> atendimentos de ${MESES[+ym.slice(5) - 1]} marcados. Qual dia da semana fica melhor?`);
    const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const todo = d => `${d === 0 || d === 6 ? 'Todo' : 'Toda'} ${NOMES_DIA[d]}`;
    const dow = await this.widget(`<div class="widget w-botoes">${permitidos.map((d, i) => this.op(i, todo(d))).join('')}</div>`,
      permitidos.map(d => ({ valor: d, eco: todo(d) })),
      { casar: t => { const n = semAcento(t), i = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].findIndex(s => n.includes(s)); return permitidos.includes(i) ? { valor: i } : undefined; } });
    const datas = datasDo(dow);
    const cont = new Map();
    for (const d of datas) {
      const hs = new Set();
      for (const o of lista) for (const t of Agenda.horarios(b, o, d, dur)) hs.add(t);
      for (const t of hs) cont.set(t, (cont.get(t) || 0) + 1);
    }
    const horas = [...cont.entries()].sort((p1, q) => p1[0] - q[0]);
    await this.bot(`Qual horário? Embaixo de cada um mostro em quantas das ${datas.length} datas ele está livre:`);
    const t = await this.widget(`<div class="widget w-horas"><div class="w-horas-grade">${horas.map(([h, n], i) => this.op(i, `${Datas.hhmm(h)}<small>${n}/${datas.length}</small>`, 'w-hora')).join('')}</div></div>`,
      horas.map(([h]) => ({ valor: h, eco: Datas.hhmm(h) })), { casar: txt => { const r = this.casarHora(txt, horas.map(([h]) => ({ ini: h }))); return r?.valor?.ini != null ? { valor: r.valor.ini } : r?.erro ? r : undefined; } });
    // cada data no horário escolhido, ou no mais perto livre (até 2 horas de diferença)
    const plano = [];
    for (const d of datas) {
      if (plano.filter(i => i.ok).length >= rest) break;
      const livres = [];
      for (const o of lista) for (const h of Agenda.horarios(b, o, d, dur)) livres.push({ h, o });
      const melhor = livres.filter(l => Math.abs(l.h - t) <= 120).sort((p1, q) => Math.abs(p1.h - t) - Math.abs(q.h - t))[0];
      plano.push(melhor ? { data: d, ini: melhor.h, barbeiro: melhor.o, ok: true, ajustado: melhor.h !== t } : { data: d, ok: false });
    }
    const ok = plano.filter(i => i.ok);
    if (!ok.length) { await this.bot('Nesse horário não achei vaga em nenhuma das datas. Vamos tentar outro?'); return this.menuPlano(m); }
    await this.bot('Confere os horários. Desmarque o que não quiser:');
    const w = await this.widget(`<div class="widget"><div class="w-checks">${plano.map((i, k) => i.ok
        ? `<label class="w-check"><input type="checkbox" data-k="${k}" checked><span><b>${cap(Datas.curta(i.data))} · ${Datas.hhmm(i.ini)}</b>${i.ajustado ? '<small>horário mais perto do escolhido</small>' : ''}${!x ? `<small>com ${esc(primeiroNome(i.barbeiro.nome))}</small>` : ''}</span></label>`
        : `<div class="w-check off"><span><b>${cap(Datas.curta(i.data))}</b><small>sem vaga perto desse horário</small></span></div>`).join('')}</div>
      <div class="w-botoes" style="margin-top:10px">${this.op(0, `${ic('check')} Confirmar horários`, 'pri')}${this.op(1, 'Voltar')}</div></div>`,
      [{ valor: () => $$('.widget:not(.respondido) .w-check input:checked', this.msgs).map(i => +i.dataset.k), eco: 'Confirmar horários' }, { valor: false, eco: 'Voltar' }]);
    if (!w || !w.length) return this.menuPlano(m);
    const feitos = [], falhas = [];
    for (const k of w) {
      const i = plano[k];
      try {
        const orc = Orcamento.calcular(b, [sv], { data: i.data, ini: i.ini, tel: m.cliente_tel, online: true, mensalista: m });
        feitos.push(await Agenda.agendar({ b, barbeiroId: i.barbeiro.id, data: i.data, ini: i.ini, servicos: [sv], nome: m.cliente_nome, telefone: m.cliente_tel, origem: 'cliente', extras: Orcamento.campos(orc) }));
      } catch (e) { falhas.push(i); }
    }
    this.lembrar({ nome: m.cliente_nome, tel: m.cliente_tel });
    if (feitos.length) {
      await this.bot(`Prontinho! Marquei <b>${feitos.length} horário${feitos.length > 1 ? 's' : ''}</b> pelo seu plano:`);
      this.add('bot', `<div class="widget"><div class="w-checks">${feitos.map(a => `<div class="w-check"><span><b>${cap(Datas.curta(a.data))} · ${Datas.hhmm(a.ini)}</b><small>${esc(sv.nome)} com ${esc(primeiroNome(Store.get('barbeiros', a.barbeiro_id)?.nome))}</small></span>${ic('check')}</div>`).join('')}</div></div>`, 'com-widget');
    }
    if (falhas.length) await this.bot(`Não consegui marcar ${falhas.map(i => Datas.curta(i.data)).join(', ')}: o horário acabou de ser ocupado.`);
    await this.bot('Você recebe o lembrete de cada um no WhatsApp. Para remarcar, é em <b>Meus horários</b>.', { espera: 400 });
    this.menuRapido(['meus', 'plano']);
  },
  async pagarMensalidade(m, c) {
    await this.bot(`Mensalidade de <b>${Datas.nomeMes(c.referencia)}</b>: ${dinheiro(c.valor)} (vence ${Datas.br(c.vencimento)}).`);
    const pg = await this.pagar(c.valor, `Mensalidade · ${Mensal.plano(m)?.nome || ''}`);
    if (!pg) { await this.bot('Tudo bem. Você pode pagar quando quiser por aqui.'); return this.menuRapido(['plano']); }
    await Store.salvar('mensalidades', { id: c.id, status: 'paga', pago_em: Datas.hoje(), forma: 'app', pagamento: pg });
    await Mensagens.pararDaMensalidade(this.b, c.id);
    await this.bot('Mensalidade paga. Obrigado!');
    return this.menuPlano(Store.get('mensalistas', m.id));
  },
  async assinarPlano(planos) {
    const b = this.b;
    let p = planos[0];
    if (planos.length > 1) {
      await this.bot('Qual plano você quer?');
      p = await this.widget(`<div class="widget w-botoes">${planos.map((x, i) => this.op(i, `${esc(x.nome)} · ${dinheiro(x.valor)}`)).join('')}</div>`, planos.map(x => ({ valor: x, eco: x.nome })));
    }
    if (!Pagamentos.ativo(b)) {
      await this.bot(`Para assinar o <b>${esc(p.nome)}</b>, fala com a gente no WhatsApp que a gente ativa pra você:`);
      this.botaoWhats(`Olá! Quero assinar o plano ${p.nome}.`);
      return this.menuRapido(['agendar']);
    }
    const cli = await this.pQuem();
    const ja = Mensal.doTelefone(b, cli.tel);
    if (ja) { await this.bot('Você já tem um plano ativo com esse número.'); return this.menuPlano(ja); }
    const dia = Math.min(28, +Datas.hoje().slice(8));
    await this.bot(`O <b>${esc(p.nome)}</b> custa ${dinheiro(p.valor)} por mês, com ${p.qtd_mes} atendimentos. A primeira mensalidade é paga agora e as próximas vencem todo dia ${dia}.`);
    const pg = await this.pagar(p.valor, `Primeira mensalidade · ${p.nome}`);
    if (!pg) { await this.bot('Tudo bem. Quando quiser, é só voltar aqui.'); return this.menuRapido(['agendar']); }
    const hoje = Datas.hoje();
    const m = await Store.salvar('mensalistas', { barbearia_id: b.id, plano_id: p.id, cliente_nome: cli.nome, cliente_tel: cli.tel, valor: p.valor, dia_vencimento: dia, inicio: hoje, status: 'ativo', barbeiro_id: null, obs: 'Assinou pelo chat' });
    await Store.salvar('mensalidades', { barbearia_id: b.id, mensalista_id: m.id, referencia: Datas.mes(hoje), valor: p.valor, vencimento: hoje, status: 'paga', pago_em: hoje, forma: 'app', lembretes: 0, pagamento: pg });
    this.lembrar(cli);
    await this.bot(`Bem-vindo ao plano, <b>${esc(primeiroNome(cli.nome))}</b>! Já dá para agendar.`);
    return this.menuPlano(m);
  }
});
