'use strict';
/* Dados de demonstração: promoções, fidelidade, mensalistas e pagamento pelo app
   na barbearia de exemplo (chamado por Seed.gerar). */
function extrasNavalha(db, rnd, b, svs, pds, bbs) {
  const hoje = Datas.hoje(), mes = Datas.mes(hoje), agora = new Date().toISOString();
  const prox = Datas.somaMes(mes, 1);
  b.pagamento = { modo: 'opcional', sinal: 100, cancelamento: 'credito', falta: 'retem', chave_pix: 'pix@navalhadeouro.com.br', prazo_credito: 90 };
  b.mensagens = { ativo: true, confirmacao: true, lembrete_vespera: true, lembrete_antes: 30, cancelamento: true, aviso_profissional: true, resumo_dia: true, mensal_antes: 3, mensal_atraso: true, modelos: {} };

  const promo = p => db.promocoes.push({ barbearia_id: b.id, ativo: true, divulgar: true, itens: [], criterios: {}, criado_em: agora, ...p });
  promo({ id: 'pr_manha', nome: 'Manhã de terça e quarta', descricao: 'Corte e degradê com 20% de desconto nas manhãs de terça e quarta.',
    alvo: 'servicos', itens: ['sv_nav_0', 'sv_nav_2'], tipo: 'percentual', valor: 20, inicio: Datas.soma(hoje, -10), fim: Datas.soma(hoje, 40), criterios: { dias: [2, 3], hora_fim: 12 * 60 } });
  promo({ id: 'pr_pomada', nome: 'Semana dos produtos', descricao: '15% de desconto em todos os produtos.',
    alvo: 'produtos', tipo: 'percentual', valor: 15, inicio: Datas.soma(hoje, -2), fim: Datas.soma(hoje, 5) });
  promo({ id: 'pr_antecipado', nome: `Agenda de ${MESES[+prox.slice(5) - 1]} aberta`, descricao: 'Agende pelo chat, pague antecipado pelo app e ganhe 30% de desconto.',
    alvo: 'servicos', tipo: 'percentual', valor: 30, inicio: prox + '-01', fim: `${prox}-${pad(Datas.diasNoMes(prox))}`, criterios: { antecipado: true, so_online: true } });
  promo({ id: 'pr_primeira', nome: 'Primeira visita', descricao: 'R$ 10 de desconto no seu primeiro atendimento agendado pelo chat.',
    alvo: 'servicos', tipo: 'valor', valor: 10, inicio: Datas.soma(hoje, -60), fim: Datas.soma(hoje, 120), criterios: { primeira_visita: true, so_online: true } });

  db.fidelidades.push({ id: 'fd_corte', barbearia_id: b.id, nome: 'Cartão fidelidade', a_cada: 10, rotulo: 'cortes',
    servicos: ['sv_nav_0', 'sv_nav_1', 'sv_nav_2', 'sv_nav_4'], tipo: 'percentual', valor: 20, ativo: true, desde: null, criado_em: agora });

  const regras = { max_remarcacoes: 1, dias: [], exige_em_dia: true, tolerancia: 5, falta_conta: true };
  db.planos_mensais.push(
    { id: 'pm_corte', barbearia_id: b.id, nome: 'Corte em dia', descricao: '4 cortes por mês com preço fechado.', valor: 140, qtd_mes: 4, servicos: ['sv_nav_0', 'sv_nav_2'], regras, ativo: true, criado_em: agora },
    { id: 'pm_combo', barbearia_id: b.id, nome: 'Corte + Barba toda semana', descricao: '4 combos por mês, de segunda a sexta.', valor: 240, qtd_mes: 4, servicos: ['sv_nav_1'], regras: { ...regras, dias: [1, 2, 3, 4, 5] }, ativo: true, criado_em: agora }
  );

  // mensalistas: clientes frequentes que já têm atendimentos neste mês
  const ags = db.agendamentos.filter(a => a.barbearia_id === b.id && a.data.startsWith(mes) && ['confirmado', 'concluido'].includes(a.status));
  const porTel = {};
  for (const a of ags) (porTel[a.cliente_tel] ||= []).push(a);
  const candidatos = Object.entries(porTel).filter(([, l]) => l.length >= 2).sort((p, q) => q[1].length - p[1].length).slice(0, 5);
  const situacoes = [['paga', 2], ['paga', 8], ['pendente', -2], ['pendente', 3], ['pendente', 9]]; // [status, dias de atraso (negativo = vence em)]
  candidatos.forEach(([tel, lista], i) => {
    const plano = i === 1 ? db.planos_mensais[1] : db.planos_mensais[0];
    const [st, dias] = situacoes[i];
    const venc = Datas.soma(hoje, -dias);
    const m = { id: 'ms_' + i, barbearia_id: b.id, plano_id: plano.id, cliente_nome: lista[0].cliente_nome, cliente_tel: tel, cliente_id: lista[0].cliente_id,
      dia_vencimento: Math.min(28, +venc.slice(8)), inicio: Datas.soma(hoje, -100), status: 'ativo', valor: plano.valor, barbeiro_id: null, obs: '', criado_em: agora };
    db.mensalistas.push(m);
    for (let k = 3; k >= 1; k--) {
      const ref = Datas.somaMes(Datas.mes(venc), -k);
      const v = `${ref}-${pad(Math.min(m.dia_vencimento, Datas.diasNoMes(ref)))}`;
      db.mensalidades.push({ id: uid('mn_'), barbearia_id: b.id, mensalista_id: m.id, referencia: ref, valor: m.valor, vencimento: v, status: 'paga', pago_em: v, forma: rnd() < 0.5 ? 'app' : 'pix', lembretes: 0, criado_em: agora });
    }
    db.mensalidades.push({ id: uid('mn_'), barbearia_id: b.id, mensalista_id: m.id, referencia: Datas.mes(venc), valor: m.valor, vencimento: venc,
      status: st, pago_em: st === 'paga' ? venc : null, forma: st === 'paga' ? 'app' : null, lembretes: 0, criado_em: agora });
    // até 2 atendimentos do mês passam a ser do plano
    const sv = svs.find(s => s.id === plano.servicos[0]);
    lista.filter(a => a.fim - a.ini >= sv.duracao).slice(0, 2).forEach(a => {
      Object.assign(a, { mensalista_id: m.id, cobertos: [sv.id], fim: a.ini + sv.duracao, servicos: [{ id: sv.id, nome: sv.nome, preco: sv.preco, duracao: sv.duracao }], total: 0, valor_tabela: sv.preco });
      if (a.status === 'concluido') Object.assign(a, { valor_servicos: 0, valor_coberto: sv.preco, desconto: 0, total_pago: a.valor_produtos || 0 });
    });
  });

  // alguns horários futuros já pagos pelo app, uma falta com o valor retido e um crédito de cancelamento
  db.agendamentos.filter(a => a.barbearia_id === b.id && a.status === 'confirmado' && a.origem === 'cliente' && a.total > 0 && a.data >= hoje)
    .filter(() => rnd() < 0.25)
    .forEach(a => { a.pagamento = { status: 'pago', forma: rnd() < 0.6 ? 'pix' : 'cartao', valor: a.total, tipo: 'total', ref: uid('pg_'), pago_em: a.criado_em }; });
  const falta = db.agendamentos.find(a => a.barbearia_id === b.id && a.status === 'faltou' && a.origem === 'cliente' && a.data < hoje && a.data >= Datas.soma(hoje, -10));
  if (falta) falta.pagamento = { status: 'pago', forma: 'pix', valor: falta.total, tipo: 'total', ref: uid('pg_'), pago_em: falta.criado_em, retido: true };
  const cancelado = db.agendamentos.find(a => a.barbearia_id === b.id && a.status === 'cancelado' && a.cancelado_por === 'cliente' && a.data >= Datas.soma(hoje, -15));
  if (cancelado) {
    cancelado.pagamento = { status: 'credito', forma: 'pix', valor: cancelado.total, tipo: 'total', ref: uid('pg_'), pago_em: cancelado.criado_em };
    db.creditos.push({ id: uid('cr_'), barbearia_id: b.id, cliente_tel: cancelado.cliente_tel, cliente_nome: cancelado.cliente_nome, valor: cancelado.total, origem: 'cancelamento', agendamento_id: cancelado.id, criado_em: agora });
  }

  // lembretes já programados para os próximos horários (caixa de saída do WhatsApp)
  const nomeDe = id => (bbs.find(x => x.id === id)?.nome || '').split(' ')[0];
  const quando = (d, m) => `${d}T${Datas.hhmm(Math.max(0, m))}`;
  db.agendamentos.filter(a => a.barbearia_id === b.id && a.status === 'confirmado' && a.data >= hoje && a.data <= Datas.soma(hoje, 2)).slice(0, 30).forEach(a => {
    const v = { nome: a.cliente_nome.split(' ')[0], estabelecimento: b.nome, profissional: nomeDe(a.barbeiro_id), hora: Datas.hhmm(a.ini), minutos: 30 };
    const txt = t => Mensagens.MODELOS[t].replace(/\{(\w+)\}/g, (s, k) => v[k] ?? s);
    db.mensagens.push({ id: uid('mg_'), barbearia_id: b.id, tipo: 'lembrete_antes', para: 'cliente', nome: a.cliente_nome, tel: a.cliente_tel, ref: a.id,
      quando: quando(a.data, a.ini - 30), status: 'agendada', texto: txt('lembrete_antes'), criado_em: agora });
    if (a.data > hoje) db.mensagens.push({ id: uid('mg_'), barbearia_id: b.id, tipo: 'lembrete_vespera', para: 'cliente', nome: a.cliente_nome, tel: a.cliente_tel, ref: a.id,
      quando: quando(Datas.soma(a.data, -1), 18 * 60), status: 'agendada', texto: txt('lembrete_vespera'), criado_em: agora });
  });
}
