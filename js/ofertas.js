'use strict';
/* ============================================================
   BSFlow — regras de promoções, fidelidade, mensalistas, créditos,
   pagamento pelo app e mensagens automáticas.
   Usadas pelo painel (conclusão, faturamento) e pelo chat (preço, agendamento).
   ============================================================ */

const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
const FORMAS_LOCAL = { pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito' };
FORMAS_PAGAMENTO.app = 'Pelo app';
FORMAS_PAGAMENTO.cartao = 'Cartão';
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const nomesDias = dias => {
  const l = ORDEM_DIAS.filter(d => dias.includes(d)).map(d => DIAS_CURTOS[d]);
  return l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l[0] || '';
};

/* ---------------- promoções ---------------- */
const Promocoes = {
  todas(b) { return Store.de('promocoes', b.id).sort((p, q) => q.inicio.localeCompare(p.inicio)); },
  situacao(p, hoje = Datas.hoje()) {
    if (p.ativo === false) return { cod: 'pausada', texto: 'Pausada', tom: 'neutro' };
    if (p.fim < hoje) return { cod: 'encerrada', texto: 'Encerrada', tom: 'neutro' };
    if (p.inicio > hoje) return { cod: 'agendada', texto: `Começa ${Datas.relativa(p.inicio)}`, tom: 'info' };
    return { cod: 'ativa', texto: 'Valendo', tom: 'ok' };
  },
  // o chat divulga as que valem hoje ou começam dentro do prazo de agendamento
  divulgaveis(b) {
    if (!Planos.tem(b, 'promocoes')) return [];
    const hoje = Datas.hoje(), lim = Agenda.ultimoDiaCliente(b);
    return Store.de('promocoes', b.id).filter(p => p.ativo !== false && p.divulgar !== false && p.fim >= hoje && p.inicio <= lim)
      .sort((p, q) => p.inicio.localeCompare(q.inicio));
  },
  /* A promoção vale para este item neste contexto?
     ctx: { data, ini (minutos), online, antecipado, primeiraVisita, bruto } */
  vale(p, tipo, itemId, ctx = {}) {
    if (p.ativo === false) return false;
    if (p.alvo !== 'tudo' && p.alvo !== tipo) return false;
    if (p.itens?.length && !p.itens.includes(itemId)) return false;
    const data = ctx.data || Datas.hoje();
    if (data < p.inicio || data > p.fim) return false;
    const c = p.criterios || {};
    if (c.dias?.length && !c.dias.includes(Datas.dow(data))) return false;
    if (tipo === 'servicos' && ctx.ini != null) {
      if (c.hora_ini != null && ctx.ini < c.hora_ini) return false;
      if (c.hora_fim != null && ctx.ini >= c.hora_fim) return false;
    }
    if (c.so_online && !ctx.online) return false;
    if (c.antecipado && !ctx.antecipado) return false;
    if (c.primeira_visita && !ctx.primeiraVisita) return false;
    if (c.minimo && (ctx.bruto ?? Infinity) < c.minimo) return false;
    return true;
  },
  desconto(p, valor) { return round2(p.tipo === 'valor' ? Math.min(valor, p.valor) : valor * p.valor / 100); },
  melhor(b, tipo, item, ctx) {
    if (!Planos.tem(b, 'promocoes')) return null;
    let m = null;
    for (const p of Store.de('promocoes', b.id)) {
      if (!this.vale(p, tipo, item.id, ctx)) continue;
      const d = this.desconto(p, item.preco);
      if (d > (m?.desconto || 0)) m = { promo: p, desconto: d };
    }
    return m;
  },
  // promoções que podem valer para o item em algum dia/horário (selo no catálogo do chat)
  doItem(b, tipo, id) { return this.divulgaveis(b).filter(p => (p.alvo === 'tudo' || p.alvo === tipo) && (!p.itens?.length || p.itens.includes(id))); },
  precoProduto(b, prod, ctx = {}) {
    const m = this.melhor(b, 'produtos', prod, ctx);
    return { preco: round2(prod.preco - (m?.desconto || 0)), original: prod.preco, promo: m?.promo || null };
  },
  rotulo(p) { return p.tipo === 'valor' ? `${dinheiro(p.valor)} off` : `${String(p.valor).replace('.', ',')}% off`; },
  periodo(p) {
    const hoje = Datas.hoje();
    if (p.inicio <= hoje) return p.inicio === p.fim ? 'só hoje' : `até ${Datas.brCurta(p.fim)}`;
    return p.inicio === p.fim ? `dia ${Datas.brCurta(p.inicio)}` : `de ${Datas.brCurta(p.inicio)} a ${Datas.brCurta(p.fim)}`;
  },
  criterios(p) {
    const c = p.criterios || {}, l = [];
    if (c.dias?.length && c.dias.length < 7) l.push(nomesDias(c.dias));
    if (c.hora_ini != null && c.hora_fim != null) l.push(`das ${Datas.hhmm(c.hora_ini)} às ${Datas.hhmm(c.hora_fim)}`);
    else if (c.hora_fim != null) l.push(`antes das ${Datas.hhmm(c.hora_fim)}`);
    else if (c.hora_ini != null) l.push(`a partir das ${Datas.hhmm(c.hora_ini)}`);
    if (c.antecipado) l.push('pagando antecipado pelo app');
    if (c.so_online) l.push('agendando pelo chat');
    if (c.primeira_visita) l.push('na primeira visita');
    if (c.minimo) l.push(`acima de ${dinheiro(c.minimo)}`);
    return l;
  },
  alvoTexto(b, p) {
    const tab = p.alvo === 'produtos' ? 'produtos' : 'servicos';
    if (p.alvo === 'tudo') return 'Serviços e produtos';
    if (!p.itens?.length) return p.alvo === 'produtos' ? 'Todos os produtos' : 'Todos os serviços';
    return p.itens.map(id => Store.get(tab, id)?.nome).filter(Boolean).join(', ');
  }
};

/* ---------------- fidelidade ---------------- */
const Fidelidade = {
  programas(b, { todos = false } = {}) { return Planos.tem(b, 'fidelidade') || todos ? Store.de('fidelidades', b.id).filter(f => todos || f.ativo !== false) : []; },
  conta(prog, a) { return !prog.servicos?.length || a.servicos.some(s => prog.servicos.includes(s.id)); },
  // posição de uma visita (data/hora) na contagem: concluídas + marcadas antes dela
  posicao(b, prog, tel, data = Datas.hoje(), ini = 0, ignorar = null) {
    const d = soDigitos(tel);
    if (!d) return { feitas: 0, noCiclo: 0, falta: prog.a_cada - 1, ganhaAgora: false };
    const alvo = Datas.abs(data, ini ?? 0);
    const n = Store.de('agendamentos', b.id).filter(a => a.cliente_tel === d && a.id !== ignorar && this.conta(prog, a) &&
      (a.status === 'concluido' || (a.status === 'confirmado' && Datas.abs(a.data, a.ini) < alvo)) && (!prog.desde || a.data >= prog.desde)).length;
    const noCiclo = n % prog.a_cada;
    return { feitas: n, noCiclo, falta: prog.a_cada - 1 - noCiclo, ganhaAgora: noCiclo === prog.a_cada - 1 };
  },
  desconto(prog, servicos) {
    const alvo = servicos.filter(s => !prog.servicos?.length || prog.servicos.includes(s.id));
    if (!alvo.length) return 0;
    const valor = soma(alvo, s => s.preco);
    if (prog.tipo === 'gratis') return round2(Math.max(...alvo.map(s => s.preco)));
    if (prog.tipo === 'valor') return round2(Math.min(valor, prog.valor));
    return round2(valor * prog.valor / 100);
  },
  premio(prog) {
    if (prog.tipo === 'gratis') return 'sai de graça';
    if (prog.tipo === 'valor') return `tem ${dinheiro(prog.valor)} de desconto`;
    return `tem ${String(prog.valor).replace('.', ',')}% de desconto`;
  },
  texto(prog) { return `A cada ${prog.a_cada} ${prog.rotulo || 'visitas'}, a ${prog.a_cada}ª ${this.premio(prog)}.`; },
  // situação do cliente em cada programa ativo
  doCliente(b, tel) { return this.programas(b).map(prog => ({ prog, ...this.posicao(b, prog, tel, Datas.hoje(), Datas.agoraMin()) })); }
};

/* ---------------- mensalistas (planos mensais dos clientes) ---------------- */
const Mensal = {
  planos(b, { todos = false } = {}) { return Planos.tem(b, 'mensalistas') || todos ? Store.de('planos_mensais', b.id).filter(p => todos || p.ativo !== false).sort((p, q) => p.valor - q.valor) : []; },
  plano(m) { return Store.get('planos_mensais', m?.plano_id); },
  valor(m) { return m.valor ?? this.plano(m)?.valor ?? 0; },
  assinantes(b) { return Store.de('mensalistas', b.id); },
  doTelefone(b, tel) {
    if (!Planos.tem(b, 'mensalistas')) return null;
    const d = soDigitos(tel);
    return d ? Store.de('mensalistas', b.id).find(m => m.cliente_tel === d && m.status === 'ativo') || null : null;
  },
  usados(b, m, ym, ignorar = null) {
    const contaFalta = this.plano(m)?.regras?.falta_conta !== false;
    return Store.de('agendamentos', b.id).filter(a => a.mensalista_id === m.id && a.id !== ignorar && a.data.startsWith(ym) &&
      (a.status === 'confirmado' || a.status === 'concluido' || (contaFalta && a.status === 'faltou'))).length;
  },
  restantes(b, m, ym, ignorar) { return Math.max(0, (this.plano(m)?.qtd_mes || 0) - this.usados(b, m, ym, ignorar)); },
  cobrancas(b, m) { return Store.de('mensalidades', b.id).filter(c => c.mensalista_id === m.id).sort((p, q) => q.vencimento.localeCompare(p.vencimento)); },
  situacao(b, m, hoje = Datas.hoje()) {
    if (m.status !== 'ativo') return { cod: m.status, texto: m.status === 'pausado' ? 'Pausado' : 'Cancelado', tom: 'neutro' };
    const pend = this.cobrancas(b, m).filter(c => c.status === 'pendente').sort((p, q) => p.vencimento.localeCompare(q.vencimento));
    const venc = pend.filter(c => c.vencimento < hoje);
    if (venc.length) {
      const atraso = Datas.diff(hoje, venc[0].vencimento);
      return { cod: 'atrasado', texto: `Atrasado · ${atraso} dia${atraso > 1 ? 's' : ''}`, tom: 'ruim', atraso, valor: soma(venc, c => c.valor), cobranca: venc[0] };
    }
    const prox = pend[0] || null;
    if (prox && Datas.diff(prox.vencimento, hoje) <= 3) return { cod: 'vence_logo', texto: `Vence ${Datas.relativa(prox.vencimento)}`, tom: 'aviso', cobranca: prox };
    return { cod: 'em_dia', texto: 'Em dia', tom: 'ok', cobranca: prox };
  },
  podeAgendar(b, m, data, ignorar = null) {
    const p = this.plano(m);
    if (!p) return { ok: false, motivo: 'Plano não encontrado.' };
    if (m.status !== 'ativo') return { ok: false, motivo: 'O plano está pausado.' };
    const r = p.regras || {};
    const s = this.situacao(b, m);
    if (r.exige_em_dia !== false && s.cod === 'atrasado' && s.atraso > (r.tolerancia ?? 5))
      return { ok: false, motivo: `A mensalidade está em atraso há ${s.atraso} dias. Regularize para agendar pelo plano.`, pagar: s.cobranca };
    if (r.dias?.length && !r.dias.includes(Datas.dow(data))) return { ok: false, motivo: `Pelo plano dá para agendar só ${nomesDias(r.dias)}.` };
    if (m.inicio && data < m.inicio) return { ok: false, motivo: `O plano começa em ${Datas.br(m.inicio)}.` };
    const usados = this.usados(b, m, Datas.mes(data), ignorar);
    if (usados >= p.qtd_mes) return { ok: false, motivo: `Os ${p.qtd_mes} atendimentos do plano em ${MESES[+data.slice(5, 7) - 1]} já foram usados.` };
    return { ok: true, restantes: p.qtd_mes - usados };
  },
  cobre(m, servicos) {
    const ids = this.plano(m)?.servicos || [];
    return { cobertos: servicos.filter(s => ids.includes(s.id)), extras: servicos.filter(s => !ids.includes(s.id)) };
  },
  vencimentoDe(m, ym) { return `${ym}-${pad(Math.min(m.dia_vencimento || 10, Datas.diasNoMes(ym)))}`; },
  // cria a cobrança do mês para cada mensalista ativo que ainda não tem
  async gerarMes(b, ym) {
    let n = 0;
    for (const m of this.assinantes(b)) {
      if (m.status !== 'ativo' || (m.inicio && Datas.mes(m.inicio) > ym)) continue;
      if (Store.de('mensalidades', b.id).some(c => c.mensalista_id === m.id && c.referencia === ym && c.status !== 'cancelada')) continue;
      await Store.salvar('mensalidades', { barbearia_id: b.id, mensalista_id: m.id, referencia: ym, valor: this.valor(m), vencimento: this.vencimentoDe(m, ym), status: 'pendente', lembretes: 0 });
      n++;
    }
    return n;
  },
  mensagemCobranca(b, m, c) {
    const p = this.plano(m), pix = Pagamentos.config(b).chave_pix;
    const atrasada = c.vencimento < Datas.hoje();
    return `Olá, ${primeiroNome(m.cliente_nome)}! Aqui é da equipe ${b.nome}. ${atrasada ? 'A' : 'Passando para lembrar que a'} mensalidade do seu plano ${p?.nome || ''} (${Datas.nomeMes(c.referencia)}), de ${dinheiro(c.valor)}, ${atrasada ? `venceu em ${Datas.br(c.vencimento)} e ainda está em aberto` : `vence em ${Datas.br(c.vencimento)}`}.` +
      (pix ? ` PIX: ${pix}.` : '') + ` Você também pode pagar pelo nosso app: ${UI.linkCliente(b)}`;
  },
  regrasTexto(p) {
    const r = p.regras || {}, l = [`${p.qtd_mes} atendimento${p.qtd_mes > 1 ? 's' : ''} por mês`];
    if (r.max_remarcacoes != null) l.push(r.max_remarcacoes === 0 ? 'não pode remarcar' : `remarca até ${r.max_remarcacoes}× cada horário`);
    if (r.dias?.length) l.push(`só ${nomesDias(r.dias)}`);
    if (r.exige_em_dia !== false) l.push(`precisa estar em dia (tolerância de ${r.tolerancia ?? 5} dias)`);
    if (r.falta_conta !== false) l.push('falta conta como usado');
    return l;
  }
};

/* ---------------- créditos do cliente (cancelamento com pagamento feito) ---------------- */
const Creditos = {
  saldo(b, tel) {
    const d = soDigitos(tel);
    return d ? round2(soma(Store.de('creditos', b.id).filter(c => c.cliente_tel === d), c => c.valor)) : 0;
  },
  lancar(b, { tel, nome, valor, origem, agendamento_id = null }) {
    return Store.salvar('creditos', { barbearia_id: b.id, cliente_tel: soDigitos(tel), cliente_nome: nome || '', valor: round2(valor), origem, agendamento_id });
  },
  async desfazerUso(b, agendamento_id) {
    for (const c of Store.de('creditos', b.id).filter(c => c.agendamento_id === agendamento_id && c.origem === 'uso')) await Store.remover('creditos', c.id);
  }
};

/* ---------------- orçamento: o que o cliente paga num agendamento ----------------
   Ordem: plano mensal cobre o que pode → promoção por serviço → fidelidade
   (não acumula com promoção: vale a maior) → crédito do cliente. */
const Orcamento = {
  calcular(b, servicos, ctx = {}) {
    const tel = soDigitos(ctx.tel || '');
    const data = ctx.data || Datas.hoje();
    let mensalista = ctx.mensalista !== undefined ? ctx.mensalista : (tel ? Mensal.doTelefone(b, tel) : null);
    let cobertos = [], pagos = servicos, plano = null;
    if (mensalista && ctx.usarPlano !== false) {
      plano = Mensal.podeAgendar(b, mensalista, data, ctx.ignorar);
      if (plano.ok) ({ cobertos, extras: pagos } = Mensal.cobre(mensalista, servicos));
    }
    if (!cobertos.length) mensalista = null;
    const primeiraVisita = !tel || !Store.de('agendamentos', b.id).some(a => a.cliente_tel === tel && a.status === 'concluido' && a.id !== ctx.ignorar);
    const bruto = round2(soma(pagos, s => s.preco));
    const pctx = { data, ini: ctx.ini, online: !!ctx.online, antecipado: !!ctx.antecipado, primeiraVisita, bruto };
    const itens = pagos.map(s => { const m = Promocoes.melhor(b, 'servicos', s, pctx); return { id: s.id, nome: s.nome, preco: s.preco, desconto: m?.desconto || 0, promo: m?.promo || null }; });
    const descPromo = round2(soma(itens, i => i.desconto));
    let fid = null;
    if (tel && pagos.length) for (const prog of Fidelidade.programas(b)) {
      const pos = Fidelidade.posicao(b, prog, tel, data, ctx.ini ?? 0, ctx.ignorar);
      if (!pos.ganhaAgora) continue;
      const d = Fidelidade.desconto(prog, pagos);
      if (d > (fid?.desconto || 0)) fid = { prog, desconto: d, visita: pos.feitas + 1 };
    }
    let desconto = descPromo, motivo = descPromo ? 'promo' : null;
    if (fid && fid.desconto >= descPromo) { desconto = fid.desconto; motivo = 'fidelidade'; itens.forEach(i => { i.desconto = 0; i.promo = null; }); }
    else fid = null;
    const subtotal = round2(Math.max(0, bruto - desconto));
    const credito = ctx.usarCredito === false ? 0 : round2(Math.min(Creditos.saldo(b, tel), subtotal));
    const promos = [...new Map(itens.filter(i => i.promo).map(i => [i.promo.id, i.promo])).values()];
    return {
      cobertos, itens, bruto, desconto, motivo, fid, promos, mensalista, plano, subtotal, credito,
      total: round2(subtotal - credito), tabela: round2(soma(servicos, s => s.preco)), valorCoberto: round2(soma(cobertos, s => s.preco))
    };
  },
  // campos que vão para o agendamento
  campos(orc) {
    return {
      total: orc.total, valor_tabela: orc.tabela, desconto_previsto: orc.desconto, desconto_motivo: orc.motivo,
      promo_ids: orc.promos.map(p => p.id), fidelidade_id: orc.fid?.prog.id || null,
      mensalista_id: orc.mensalista?.id || null, cobertos: orc.cobertos.map(s => s.id), credito_usado: orc.credito
    };
  },
  // linhas de explicação (resumo do chat e janela de conclusão)
  linhas(orc) {
    const l = [];
    if (orc.cobertos.length) l.push({ rot: `Coberto pelo plano (${orc.cobertos.map(s => s.nome).join(' + ')})`, valor: -orc.valorCoberto });
    if (orc.motivo === 'promo') for (const p of orc.promos) l.push({ rot: `Promoção: ${p.nome}`, valor: -soma(orc.itens.filter(i => i.promo?.id === p.id), i => i.desconto) });
    if (orc.motivo === 'fidelidade') l.push({ rot: `Fidelidade: ${orc.fid.visita}ª visita`, valor: -orc.desconto });
    if (orc.credito) l.push({ rot: 'Crédito que você tinha aqui', valor: -orc.credito });
    return l;
  }
};

/* ---------------- pagamento pelo app (na demonstração é simulado) ---------------- */
const Pagamentos = {
  config(b) { return { modo: 'desligado', sinal: 100, cancelamento: 'credito', falta: 'retem', chave_pix: '', prazo_credito: 90, ...(b.pagamento || {}) }; },
  // na versão oficial fica desligado até o pagamento de verdade (Mercado Pago) entrar
  oficial() { return typeof Nuvem !== 'undefined' && Nuvem.ativo; },
  ativo(b) { return !this.oficial() && this.config(b).modo !== 'desligado' && Planos.tem(b, 'pagamento_app'); },
  aCobrar(b, total) { return round2(total * (this.config(b).sinal || 100) / 100); },
  simular(forma, valor) {
    const vel = typeof Cliente !== 'undefined' ? Cliente.vel : 1;
    return new Promise(ok => setTimeout(() => ok({ status: 'pago', forma, valor: round2(valor), ref: uid('pg_'), pago_em: new Date().toISOString() }), 1300 * vel));
  },
  copiaCola(b, valor, ref) {
    const nome = semAcento(b.nome).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 25);
    return `00020126580014BR.GOV.BCB.PIX0136SIMULACAO-BSFLOW-${ref.slice(-8)}5204000053039865406${round2(valor).toFixed(2)}5802BR59${String(nome.length).padStart(2, '0')}${nome}6009SAO PAULO62070503***6304SIMU`;
  },
  // desenho de um QR ilustrativo (não é um PIX de verdade)
  qrSimulado(texto) {
    let h = 2166136261;
    for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const n = 25, cel = [];
    const canto = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (canto(x, y)) continue;
      h = Math.imul(h ^ (x * 31 + y), 16777619) >>> 0;
      if (h % 2) cel.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    const olho = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" width="180" height="180" role="img" aria-label="QR Code ilustrativo" style="background:#fff;border-radius:10px"><g fill="#111">${cel.join('')}${olho(0, 0)}${olho(n - 7, 0)}${olho(0, n - 7)}</g></svg>`;
  }
};

/* ---------------- mensagens automáticas (WhatsApp) ----------------
   Na demonstração elas ficam numa "caixa de saída" com o horário em que sairiam;
   na versão oficial um robô no servidor envia sozinho. */
const Mensagens = {
  MODELOS: {
    confirmacao: 'Olá, {nome}! Seu horário em {estabelecimento} está confirmado: {quando}, com {profissional}. Para remarcar ou cancelar: {link}',
    lembrete_vespera: 'Oi, {nome}! Amanhã tem horário em {estabelecimento}: {hora}, com {profissional}. Te esperamos!',
    lembrete_antes: 'Oi, {nome}! Seu horário em {estabelecimento} é daqui a {minutos} minutos ({hora}). Até já!',
    cancelamento: 'Olá, {nome}. Seu horário de {quando} em {estabelecimento} foi cancelado. Para marcar outro: {link}',
    aviso_profissional: 'Novo agendamento: {cliente} · {quando} · {servicos}.',
    aviso_cancelou: '{cliente} cancelou o horário de {quando}.',
    resumo_dia: 'Bom dia, {profissional}! Sua agenda de hoje tem {qtd} atendimento(s). O primeiro é às {primeiro}.',
    mensal_lembrete: 'Olá, {nome}! A mensalidade do seu plano em {estabelecimento} ({valor}) vence em {vencimento}. Pague pelo app: {link}',
    mensal_atraso: 'Olá, {nome}! A mensalidade do seu plano em {estabelecimento} ({valor}) venceu em {vencimento}. Pague pelo app para continuar agendando: {link}'
  },
  ROTULOS: {
    confirmacao: 'Confirmação do agendamento', lembrete_vespera: 'Lembrete na véspera', lembrete_antes: 'Lembrete antes do horário',
    cancelamento: 'Aviso de cancelamento', aviso_profissional: 'Aviso de novo agendamento ao profissional', aviso_cancelou: 'Aviso de cancelamento ao profissional',
    resumo_dia: 'Resumo do dia para o profissional', mensal_lembrete: 'Lembrete da mensalidade', mensal_atraso: 'Cobrança da mensalidade atrasada'
  },
  config(b) {
    return { ativo: true, confirmacao: true, lembrete_vespera: true, lembrete_antes: 30, cancelamento: true, aviso_profissional: true,
      resumo_dia: true, mensal_antes: 3, mensal_atraso: true, modelos: {}, ...(b.mensagens || {}) };
  },
  modelo(b, tipo) { return this.config(b).modelos?.[tipo] || this.MODELOS[tipo]; },
  preencher(txt, vars) { return txt.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m); },
  vars(b, a) {
    const x = Store.get('barbeiros', a.barbeiro_id);
    return {
      nome: primeiroNome(a.cliente_nome), cliente: a.cliente_nome, estabelecimento: b.nome, profissional: primeiroNome(x?.nome) || 'a equipe',
      quando: `${Datas.relativa(a.data)} (${Datas.brCurta(a.data)}) às ${Datas.hhmm(a.ini)}`, hora: Datas.hhmm(a.ini),
      servicos: (a.servicos || []).map(s => s.nome).join(' + '), link: UI.linkCliente(b)
    };
  },
  quandoTxt(data, min) { return `${data}T${Datas.hhmm(Math.max(0, Math.min(1439, min)))}`; },
  async criar(b, m) {
    await Store.salvar('mensagens', { barbearia_id: b.id, status: 'agendada', ...m });
    const todas = Store.de('mensagens', b.id);
    if (todas.length > 400) for (const v of todas.sort((p, q) => p.quando.localeCompare(q.quando)).slice(0, todas.length - 400)) await Store.remover('mensagens', v.id);
  },
  async cancelarDo(b, agId) {
    for (const m of Store.de('mensagens', b.id).filter(m => m.ref === agId && m.status === 'agendada')) await Store.salvar('mensagens', { id: m.id, status: 'cancelada' });
  },
  agoraTxt() { const d = new Date(); return `${Datas.ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; },
  // chamado pelo Store sempre que um agendamento é criado ou alterado
  async aoMudarAgendamento(antes, a) {
    if (typeof Nuvem !== 'undefined' && Nuvem.ativo) return; // na versão oficial o banco cria as mensagens
    const b = Store.get('barbearias', a.barbearia_id);
    if (!b || !Planos.tem(b, 'lembretes')) return;
    const cfg = this.config(b);
    if (!cfg.ativo) return;
    const v = this.vars(b, a), agora = this.agoraTxt(), x = Store.get('barbeiros', a.barbeiro_id);
    const paraCliente = (tipo, quando) => a.cliente_tel && this.criar(b, { tipo, para: 'cliente', nome: a.cliente_nome, tel: a.cliente_tel, texto: this.preencher(this.modelo(b, tipo), v), quando, ref: a.id });
    const paraProf = tipo => x?.telefone && this.criar(b, { tipo, para: 'profissional', nome: x.nome, tel: x.telefone, texto: this.preencher(this.modelo(b, tipo), v), quando: agora, ref: a.id });
    const lembretes = async () => {
      const vesp = this.quandoTxt(Datas.soma(a.data, -1), 18 * 60);
      if (cfg.lembrete_vespera && vesp > agora) await paraCliente('lembrete_vespera', vesp);
      if (cfg.lembrete_antes) {
        const q = this.quandoTxt(a.data, a.ini - cfg.lembrete_antes);
        if (q > agora) await this.criar(b, { tipo: 'lembrete_antes', para: 'cliente', nome: a.cliente_nome, tel: a.cliente_tel, ref: a.id, quando: q,
          texto: this.preencher(this.modelo(b, 'lembrete_antes'), { ...v, minutos: cfg.lembrete_antes }) });
      }
    };
    const novo = !antes;
    const remarcou = antes && a.status === 'confirmado' && (antes.data !== a.data || antes.ini !== a.ini);
    const cancelou = antes && antes.status === 'confirmado' && a.status === 'cancelado';
    if (novo && a.status === 'confirmado') {
      if (cfg.confirmacao) await paraCliente('confirmacao', agora);
      if (a.cliente_tel) await lembretes();
      if (cfg.aviso_profissional && a.origem === 'cliente') await paraProf('aviso_profissional');
    } else if (remarcou) {
      await this.cancelarDo(b, a.id);
      if (cfg.confirmacao) await paraCliente('confirmacao', agora);
      if (a.cliente_tel) await lembretes();
    } else if (cancelou) {
      await this.cancelarDo(b, a.id);
      if (cfg.cancelamento && a.cancelado_por !== 'cliente') await paraCliente('cancelamento', agora);
      if (cfg.aviso_profissional && a.cancelado_por === 'cliente') await paraProf('aviso_cancelou');
    }
  },
  // na demonstração, o que já passou do horário conta como enviado
  processar(b) {
    // na versão oficial nada é marcado como enviado sozinho: o dono envia pelo botão do WhatsApp
    if (typeof Nuvem !== 'undefined' && Nuvem.ativo) return;
    const agora = this.agoraTxt();
    for (const m of Store.de('mensagens', b.id)) if (m.status === 'agendada' && m.quando <= agora) { m.status = 'enviada'; m.enviada_em = m.quando; }
  },
  // lembretes de mensalidade (gerados quando o painel abre)
  async mensalidades(b) {
    if (typeof Nuvem !== 'undefined' && Nuvem.ativo) return; // na versão oficial a rotina diária do servidor cuida
    const cfg = this.config(b);
    if (!cfg.ativo || !Planos.tem(b, 'cobranca_auto')) return;
    const hoje = Datas.hoje(), ja = new Set(Store.de('mensagens', b.id).map(m => `${m.tipo}|${m.ref}`));
    for (const c of Store.de('mensalidades', b.id).filter(c => c.status === 'pendente')) {
      const m = Store.get('mensalistas', c.mensalista_id);
      if (!m || m.status !== 'ativo') continue;
      const vars = { nome: primeiroNome(m.cliente_nome), estabelecimento: b.nome, valor: dinheiro(c.valor), vencimento: Datas.br(c.vencimento), link: UI.linkCliente(b) };
      if (cfg.mensal_antes && c.vencimento >= hoje && !ja.has(`mensal_lembrete|${c.id}`)) {
        const dia = Datas.soma(c.vencimento, -cfg.mensal_antes);
        await this.criar(b, { tipo: 'mensal_lembrete', para: 'cliente', nome: m.cliente_nome, tel: m.cliente_tel, ref: c.id,
          quando: this.quandoTxt(dia < hoje ? hoje : dia, 10 * 60), texto: this.preencher(this.modelo(b, 'mensal_lembrete'), vars) });
      }
      if (cfg.mensal_atraso && !ja.has(`mensal_atraso|${c.id}`)) {
        await this.criar(b, { tipo: 'mensal_atraso', para: 'cliente', nome: m.cliente_nome, tel: m.cliente_tel, ref: c.id,
          quando: this.quandoTxt(Datas.soma(c.vencimento, 1), 10 * 60), texto: this.preencher(this.modelo(b, 'mensal_atraso'), vars) });
      }
    }
  },
  async pararDaMensalidade(b, cobrancaId) {
    for (const m of Store.de('mensagens', b.id).filter(m => m.ref === cobrancaId && m.status === 'agendada')) await Store.salvar('mensagens', { id: m.id, status: 'cancelada' });
  }
};
Store.aoSalvar = (tabela, antes, depois) => {
  if (tabela === 'agendamentos') Mensagens.aoMudarAgendamento(antes, depois).catch(e => console.warn(e));
};
