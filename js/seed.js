'use strict';
/* Dados de demonstração. São gerados em relação ao dia de hoje e saem sempre
   iguais (sorteio com semente), para o teste ser repetível. */
const Seed = {
  gerar() {
    const rnd = sorteio(20261026);
    const hoje = Datas.hoje();
    const mesAtual = Datas.mes(hoje);
    const db = {
      versao: 1, criado_em: new Date().toISOString(),
      config: {
        senha_admin: 'admin',
        suporte_whatsapp: '21999990000',
        chave_pix: 'financeiro@bsflow.app.br',
        tolerancia_dias: 7,
        bloqueio_auto: true,
        msg_lembrete: 'Olá, {responsavel}! Aqui é do {app}. Passando para lembrar que a mensalidade de {estabelecimento} ({referencia}), no valor de {valor}, vence em {vencimento}. Chave PIX: {pix}. Obrigado!',
        msg_atraso: 'Olá, {responsavel}! Aqui é do {app}. A mensalidade de {estabelecimento} ({referencia}), no valor de {valor}, venceu em {vencimento} e ainda está em aberto. Para evitar o bloqueio da agenda, pague pelo PIX: {pix}. Se já pagou, é só me mandar o comprovante.'
      },
      planos: [
        { id: 'pl_solo', nome: 'Básico', preco: 24.99, max_barbeiros: 1, descricao: 'Para quem trabalha sozinho.', recursos: [] },
        { id: 'pl_equipe', nome: 'Equipe', preco: 49.99, max_barbeiros: 3, descricao: 'Para a equipe crescer e o cliente voltar.', recursos: ['promocoes', 'fidelidade', 'mensalistas', 'lembretes'] },
        { id: 'pl_premium', nome: 'Premium', preco: 79.99, max_barbeiros: 0, descricao: 'Tudo, com cobrança pelo app e suporte humanizado.', recursos: ['promocoes', 'fidelidade', 'mensalistas', 'lembretes', 'pagamento_app', 'cobranca_auto', 'suporte'] }
      ],
      barbearias: [], cobrancas: [], barbeiros: [], servicos: [], produtos: [],
      clientes: [], agendamentos: [], bloqueios: [], vendas: [],
      promocoes: [], fidelidades: [], planos_mensais: [], mensalistas: [], mensalidades: [], creditos: [], mensagens: [], fechamentos: []
    };
    const add = (t, r) => { db[t].push(r); return r; };

    // ---- cobranças: meses pagos + situações especiais ----
    const historico = (b, meses, { pularAtual = false } = {}) => {
      for (let k = meses; k >= (pularAtual ? 1 : 0); k--) {
        const ref = Datas.somaMes(mesAtual, -k);
        const venc = Cobranca.vencimentoDe(b, ref);
        if (venc < b.criado_em.slice(0, 10)) continue;
        const pago = venc <= hoje;
        add('cobrancas', {
          id: uid('cb_'), barbearia_id: b.id, referencia: ref, valor: b.valor_mensal, vencimento: venc,
          status: pago ? 'paga' : 'pendente', pago_em: pago ? Datas.soma(venc, -Math.floor(rnd() * 3)) : null,
          forma: pago ? (rnd() < 0.8 ? 'pix' : 'boleto') : null, criado_em: Datas.soma(venc, -10)
        });
      }
    };
    const pendente = (b, venc) => add('cobrancas', {
      id: uid('cb_'), barbearia_id: b.id, referencia: Datas.mes(venc), valor: b.valor_mensal, vencimento: venc,
      status: 'pendente', pago_em: null, forma: null, criado_em: Datas.soma(venc, -10)
    });

    // ---- 1. Navalha de Ouro: completa, em dia ----
    const nav = add('barbearias', Modelos.barbearia({
      id: 'bb_navalha', slug: 'navalha-de-ouro', nome: 'Barbearia Navalha de Ouro', status: 'ativa',
      responsavel: 'Marcos Vieira', email: 'contato@navalhadeouro.com.br', whatsapp: '21987654321',
      cidade: 'Niterói - RJ', endereco: 'Rua Moreira César, 245 — Icaraí, Niterói - RJ', instagram: 'navalhadeouro',
      plano_id: 'pl_premium', valor_mensal: 79.99, dia_vencimento: 10, criado_em: Datas.soma(hoje, -230) + 'T10:00:00Z',
      cor: '#c9a227', pin_dono: '1234',
      boas_vindas: 'Corte de respeito, café passado na hora e o futebol na TV.',
      horario: { 0: [], 1: [['09:00', '20:00']], 2: [['09:00', '20:00']], 3: [['09:00', '20:00']], 4: [['09:00', '20:00']], 5: [['09:00', '20:00']], 6: [['08:00', '18:00']] },
      regras: { intervalo: 30, antecedencia: 60, dias_frente: 30, cancelar_ate: 2 }
    }));
    historico(nav, 6);
    const svNav = [
      ['Corte masculino', 'Máquina e tesoura, lavagem e finalização com pomada.', 45, 30, 'Cabelo', 30],
      ['Corte + Barba', 'O combo completo: corte, barba na toalha quente e finalização.', 75, 60, 'Combo', 25],
      ['Degradê (fade)', 'Degradê navalhado do zero ao topo, com risquinho se quiser.', 50, 45, 'Cabelo', 15],
      ['Barba completa', 'Toalha quente, navalha, óleo e balm pós-barba.', 35, 30, 'Barba', 10],
      ['Corte infantil', 'Para a garotada até 12 anos, com paciência e capricho.', 35, 30, 'Cabelo', 6],
      ['Pigmentação', 'Disfarça falhas na barba ou no cabelo.', 30, 30, 'Estética', 4],
      ['Sobrancelha', 'Limpeza e desenho na navalha.', 15, 15, 'Estética', 4],
      ['Pezinho', 'Acabamento do contorno entre um corte e outro.', 15, 15, 'Cabelo', 4],
      ['Platinado', 'Descoloração completa com matização. Consulte antes.', 140, 120, 'Química', 2]
    ].map(([nome, descricao, preco, duracao, categoria, peso], i) => add('servicos', {
      id: 'sv_nav_' + i, barbearia_id: nav.id, nome, descricao, preco, duracao, categoria, peso,
      foto: null, ativo: true, online: true, ordem: i
    }));
    const pdNav = [
      ['Pomada modeladora matte', 'Fixação forte com efeito seco, sem brilho. 120 g.', 39.9, 14],
      ['Óleo para barba', 'Hidrata e perfuma. Amadeirado. 30 ml.', 34.9, 9],
      ['Balm pós-barba', 'Acalma a pele e evita irritação. 60 g.', 29.9, 6],
      ['Shampoo para barba', 'Limpeza suave com mentol. 150 ml.', 27.9, 11],
      ['Pente de madeira', 'Feito à mão, não gera frizz.', 19.9, 20],
      ['Cerveja long neck', 'Gelada, para curtir enquanto espera.', 9, 48]
    ].map(([nome, descricao, preco, estoque], i) => add('produtos', {
      id: 'pd_nav_' + i, barbearia_id: nav.id, nome, descricao, preco, estoque, foto: null, ativo: true, ordem: i
    }));
    const todos = svNav.map(s => s.id);
    const bbNav = [
      { nome: 'Rafael Mendes', pin: '1111', comissao: 50, cor: '#c9a227', servicos: [], horario: null },
      { nome: 'Diego Santos', pin: '2222', comissao: 45, cor: '#0e9f8e', servicos: todos.filter(id => id !== 'sv_nav_8'),
        horario: { 0: [], 1: [], 2: [['10:00', '13:00'], ['14:00', '20:00']], 3: [['10:00', '13:00'], ['14:00', '20:00']], 4: [['10:00', '13:00'], ['14:00', '20:00']], 5: [['10:00', '13:00'], ['14:00', '20:00']], 6: [['08:00', '18:00']] } },
      { nome: 'Lucas Prado', pin: '3333', comissao: 40, cor: '#6d5bd0', servicos: ['sv_nav_0', 'sv_nav_2', 'sv_nav_3', 'sv_nav_4', 'sv_nav_6', 'sv_nav_7', 'sv_nav_1'],
        horario: { 0: [], 1: [['12:00', '20:00']], 2: [['12:00', '20:00']], 3: [['12:00', '20:00']], 4: [['12:00', '20:00']], 5: [['12:00', '20:00']], 6: [] } }
    ].map((x, i) => add('barbeiros', { id: 'br_nav_' + i, barbearia_id: nav.id, telefone: '2198' + (7000000 + i * 1111), ativo: true, foto: null, ordem: i, ...x }));
    popular(db, rnd, nav, bbNav, svNav, pdNav, { diasAtras: 75, diasFrente: 14, densidade: 0.62, clientes: 160 });
    add('bloqueios', { id: uid('bl_'), barbearia_id: nav.id, barbeiro_id: 'br_nav_1', data: Datas.soma(hoje, 2), ini: Datas.min('15:00'), fim: Datas.min('17:00'), motivo: 'Consulta médica' });
    limparConflitos(db, nav.id);
    extrasNavalha(db, rnd, nav, svNav, pdNav, bbNav);

    // ---- 2. Rei do Corte: em dia, mensalidade vence em 2 dias (plano Equipe) ----
    const rei = add('barbearias', Modelos.barbearia({
      id: 'bb_rei', slug: 'rei-do-corte', nome: 'Rei do Corte', status: 'ativa',
      responsavel: 'Anderson Lima', email: 'anderson@reidocorte.com', whatsapp: '21976543210', cidade: 'Rio de Janeiro - RJ',
      endereco: 'Av. Amaral Peixoto, 1.020 — Centro', plano_id: 'pl_equipe', valor_mensal: 49.99,
      dia_vencimento: Number(Datas.soma(hoje, 2).slice(8)), criado_em: Datas.soma(hoje, -150) + 'T10:00:00Z', cor: '#dc2626', pin_dono: '1234'
    }));
    historico(rei, 5, { pularAtual: true });
    if (!db.cobrancas.some(c => c.barbearia_id === rei.id && c.vencimento === Datas.soma(hoje, 2))) pendente(rei, Datas.soma(hoje, 2));
    montarSimples(db, rnd, rei, ['Wagner', 'Thiago', 'Caio'], { diasAtras: 30, densidade: 0.4 });

    // ---- 3. Dom Barbearia: atrasada (ainda dentro da tolerância) ----
    const vDom = Datas.soma(hoje, -4);
    const dom = add('barbearias', Modelos.barbearia({
      id: 'bb_dom', slug: 'dom-barbearia', nome: 'Dom Barbearia', status: 'ativa',
      responsavel: 'Felipe Andrade', email: 'felipe.dom@gmail.com', whatsapp: '21965432109', cidade: 'São Gonçalo - RJ',
      endereco: 'Rua Dr. Nilo Peçanha, 88 — Alcântara', plano_id: 'pl_solo', valor_mensal: 24.99,
      dia_vencimento: Number(vDom.slice(8)), criado_em: Datas.soma(hoje, -120) + 'T10:00:00Z', cor: '#0ea5e9', pin_dono: '1234'
    }));
    historico(dom, 4, { pularAtual: true });
    db.cobrancas = db.cobrancas.filter(c => !(c.barbearia_id === dom.id && c.referencia === Datas.mes(vDom)));
    pendente(dom, vDom);
    montarSimples(db, rnd, dom, ['Felipe'], { diasAtras: 30, densidade: 0.4 });

    // ---- 4. Espaço Lumière (salão de beleza): em teste ----
    const fino = add('barbearias', Modelos.barbearia({
      id: 'bb_fino', slug: 'espaco-lumiere', nome: 'Espaço Lumière', tipo: 'salao', status: 'teste', teste_ate: Datas.soma(hoje, 5),
      responsavel: 'Camila Rocha', email: 'camila@espacolumiere.com.br', whatsapp: '21954321098', cidade: 'Maricá - RJ',
      endereco: 'Rua Ribeiro de Almeida, 12 — Centro, Maricá', plano_id: 'pl_equipe', valor_mensal: 49.99, dia_vencimento: 15,
      criado_em: Datas.soma(hoje, -9) + 'T10:00:00Z', cor: '#db2777', pin_dono: '1234',
      boas_vindas: 'Cabelo, unhas e sobrancelha com hora marcada e sem espera.'
    }));
    montarSimples(db, rnd, fino, ['Camila', 'Juliana', 'Bianca'], { diasAtras: 8, densidade: 0.3 });

    // ---- 5. Barbearia do Bairro: bloqueada por atraso ----
    const bairro = add('barbearias', Modelos.barbearia({
      id: 'bb_bairro', slug: 'do-bairro', nome: 'Barbearia do Bairro', status: 'ativa',
      responsavel: 'Sérgio Ramos', email: 'sergioramos@hotmail.com', whatsapp: '21943210987', cidade: 'Itaboraí - RJ',
      endereco: 'Rua Vinte e Dois de Maio, 300', plano_id: 'pl_solo', valor_mensal: 24.99, dia_vencimento: 5,
      criado_em: Datas.soma(hoje, -200) + 'T10:00:00Z', cor: '#16a34a', pin_dono: '1234'
    }));
    historico(bairro, 6);
    const atrasoBairro = [Datas.soma(hoje, -52), Datas.soma(hoje, -22)];
    db.cobrancas = db.cobrancas.filter(c => !(c.barbearia_id === bairro.id && atrasoBairro.some(v => Datas.mes(v) === c.referencia)));
    atrasoBairro.forEach(v => pendente(bairro, v));
    montarSimples(db, rnd, bairro, ['Sérgio'], { diasAtras: 60, densidade: 0.3, ate: -22 });

    // ---- 6. Old School: cancelou a assinatura ----
    const old = add('barbearias', Modelos.barbearia({
      id: 'bb_old', slug: 'old-school', nome: 'Old School Barber Shop', status: 'inativa',
      responsavel: 'Ricardo Nunes', email: 'ricardo@oldschool.com', whatsapp: '21932109876', cidade: 'Niterói - RJ',
      endereco: 'Rua Gavião Peixoto, 50 — Icaraí', plano_id: 'pl_equipe', valor_mensal: 49.99, dia_vencimento: 20,
      criado_em: Datas.soma(hoje, -300) + 'T10:00:00Z', cor: '#a16207', pin_dono: '1234', obs: 'Cancelou: fechou a unidade.'
    }));
    historico(old, 9);
    db.cobrancas = db.cobrancas.filter(c => !(c.barbearia_id === old.id && c.referencia >= Datas.somaMes(mesAtual, -2)));

    db.servicos.forEach(s => delete s.peso);
    return db;
  }
};

function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES = ['João', 'Pedro', 'Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Bruno', 'Felipe', 'Gustavo', 'Thiago', 'André', 'Carlos', 'Daniel', 'Eduardo', 'Fernando', 'Henrique', 'Igor', 'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo', 'Renato', 'Samuel', 'Vinícius', 'Wesley', 'Caio', 'Enzo', 'Murilo', 'Arthur', 'Davi', 'Heitor', 'Bernardo', 'Miguel', 'Ricardo', 'Rodrigo', 'Sérgio', 'Alexandre', 'Luan', 'Kauã'];
const NOMES_F = ['Ana', 'Maria', 'Juliana', 'Beatriz', 'Camila', 'Larissa', 'Fernanda', 'Mariana', 'Amanda', 'Bruna', 'Letícia', 'Gabriela', 'Patrícia', 'Carla', 'Renata', 'Aline', 'Vanessa', 'Débora', 'Priscila', 'Isabela', 'Luana', 'Natália', 'Rafaela', 'Sabrina', 'Tatiane', 'Yasmin', 'Helena', 'Alice', 'Laura', 'Sofia'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Freitas', 'Moreira', 'Cardoso', 'Teixeira', 'Correia', 'Mendes', 'Pinto', 'Cavalcanti'];

// estabelecimentos menores: serviços padrão do tipo, equipe com o horário da casa e poucos atendimentos
function montarSimples(db, rnd, b, nomes, opts) {
  const pesos = b.tipo === 'salao' ? [18, 24, 10, 6, 20, 12, 10] : [40, 15, 30, 8, 7];
  const svs = Modelos.servicosPadrao(b.id, b.tipo).map((s, i) => ({ ...s, id: `sv_${b.id}_${i}`, peso: pesos[i] || 5 }));
  db.servicos.push(...svs);
  const cores = ['#c9a227', '#0e9f8e', '#6d5bd0', '#d9480f', '#2563eb'];
  const bbs = nomes.map((n, i) => ({
    id: `br_${b.id}_${i}`, barbearia_id: b.id, nome: n + ' ' + SOBRENOMES[(i * 7 + n.length) % SOBRENOMES.length],
    telefone: '2199' + (1000000 + i * 4321), pin: String(1111 * (i + 1)).slice(0, 4), comissao: 50, cor: cores[i % cores.length],
    servicos: [], horario: null, ativo: true, foto: null, ordem: i
  }));
  db.barbeiros.push(...bbs);
  popular(db, rnd, b, bbs, svs, [], { diasFrente: 7, clientes: 50, ...opts });
}

function popular(db, rnd, b, barbeiros, servicos, produtos, { diasAtras, diasFrente, densidade, clientes, ate = null }) {
  const hoje = Datas.hoje(), agoraMin = Datas.agoraMin();
  const pool = [];
  for (let i = 0; i < clientes; i++) {
    const lista = b.tipo === 'salao' ? NOMES_F : b.tipo === 'ambos' && rnd() < 0.5 ? NOMES_F : NOMES;
    const nome = `${lista[Math.floor(rnd() * lista.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]}`;
    const telefone = '219' + String(Math.floor(rnd() * 1e8)).padStart(8, '0');
    const c = { id: uid('cl_'), barbearia_id: b.id, nome, telefone, criado_em: Datas.soma(hoje, -diasAtras - 30) + 'T12:00:00Z' };
    db.clientes.push(c);
    pool.push({ c, peso: i < clientes * 0.25 ? 5 : 1 });
  }
  const pesoTotal = soma(pool, p => p.peso);
  const escolherCliente = () => { let r = rnd() * pesoTotal; for (const p of pool) { r -= p.peso; if (r <= 0) return p.c; } return pool[0].c; };
  const escolherServico = lista => {
    const tot = soma(lista, s => s.peso || 1);
    let r = rnd() * tot;
    for (const s of lista) { r -= s.peso || 1; if (r <= 0) return s; }
    return lista[0];
  };
  const formas = () => { const r = rnd(); return r < 0.45 ? 'pix' : r < 0.65 ? 'credito' : r < 0.85 ? 'debito' : 'dinheiro'; };
  const passo = b.regras.intervalo || 30;
  const fimDias = ate ?? diasFrente;

  for (let d = -diasAtras; d <= fimDias; d++) {
    const data = Datas.soma(hoje, d);
    const dow = Datas.dow(data);
    for (const x of barbeiros) {
      const lista = servicos.filter(s => !x.servicos.length || x.servicos.includes(s.id));
      for (const [i, f] of (x.horario || b.horario)[dow] || []) {
        let t = Datas.min(i);
        const z = Datas.min(f);
        while (t < z) {
          const prob = d <= 0 ? densidade : Math.max(0.06, densidade * (0.9 - d * 0.075));
          if (rnd() >= prob) { t += passo; continue; }
          const sv = escolherServico(lista);
          if (t + sv.duracao > z) { t += passo; continue; }
          const cli = escolherCliente();
          const passado = d < 0 || (d === 0 && t + sv.duracao <= agoraMin);
          const r = rnd();
          let status = 'confirmado';
          if (passado) status = r < 0.05 ? 'faltou' : r < 0.11 ? 'cancelado' : 'concluido';
          else if (r < 0.04) status = 'cancelado';
          const ag = {
            id: uid('ag_'), barbearia_id: b.id, barbeiro_id: x.id, cliente_id: cli.id, cliente_nome: cli.nome, cliente_tel: cli.telefone,
            data, ini: t, fim: t + sv.duracao, servicos: [{ id: sv.id, nome: sv.nome, preco: sv.preco, duracao: sv.duracao }],
            total: sv.preco, status, origem: rnd() < 0.7 ? 'cliente' : 'balcao', obs: '',
            criado_em: Datas.soma(data, -Math.floor(rnd() * 6)) + 'T12:00:00Z'
          };
          if (status === 'concluido') {
            const prods = produtos.length && rnd() < 0.2 ? [{ ...pick(rnd, produtos) }] : [];
            ag.produtos = prods.map(p => ({ id: p.id, nome: p.nome, preco: p.preco, qtd: 1 }));
            ag.valor_servicos = sv.preco;
            ag.valor_produtos = soma(ag.produtos, p => p.preco * p.qtd);
            ag.desconto = 0;
            ag.total_pago = ag.valor_servicos + ag.valor_produtos;
            ag.forma_pagamento = formas();
            ag.concluido_em = data + 'T' + Datas.hhmm(ag.fim) + ':00';
          }
          if (status === 'cancelado') ag.cancelado_por = rnd() < 0.7 ? 'cliente' : 'barbearia';
          db.agendamentos.push(ag);
          t += status === 'cancelado' ? passo : Math.ceil(sv.duracao / passo) * passo;
        }
      }
    }
    // vendas no balcão, de vez em quando
    if (produtos.length && d <= 0 && rnd() < 0.35) {
      const p = pick(rnd, produtos);
      db.vendas.push({ id: uid('vd_'), barbearia_id: b.id, barbeiro_id: null, data, hora: 17 * 60, cliente: 'Venda no balcão',
        itens: [{ id: p.id, nome: p.nome, preco: p.preco, qtd: 1 }], total: p.preco, forma: formas() });
    }
  }
}
const pick = (rnd, lista) => lista[Math.floor(rnd() * lista.length)];

// tira agendamentos de demonstração que caíram em cima de um bloqueio
function limparConflitos(db, barbeariaId) {
  const bloqs = db.bloqueios.filter(k => k.barbearia_id === barbeariaId);
  db.agendamentos = db.agendamentos.filter(a => !(a.barbearia_id === barbeariaId && a.status === 'confirmado' &&
    bloqs.some(k => k.data === a.data && (!k.barbeiro_id || k.barbeiro_id === a.barbeiro_id) && a.ini < k.fim && a.fim > k.ini)));
}
