'use strict';
/* ============================================================
   BSFlow — núcleo (barbearias e salões)
   Nos dados, "barbearia" = estabelecimento e "barbeiro" = profissional.
   Utilidades, dados, regras de cobrança, agenda e financeiro.
   Por enquanto os dados ficam no navegador (localStorage), para testar
   sem servidor. As "tabelas" já têm o formato que terão no Supabase
   (ver docs/BANCO.md), então trocar o Store depois não mexe nas telas.
   ============================================================ */

const APP = { nome: 'BSFlow', versao: '0.2.0' };

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const FORMAS_PAGAMENTO = { pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito' };
const STATUS_AG = { confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' };
const CATEGORIAS = ['Cabelo', 'Barba', 'Unhas', 'Sobrancelha', 'Estética', 'Química', 'Maquiagem', 'Combo', 'Outros'];
const TIPOS_ESTAB = { barbearia: 'Barbearia', salao: 'Salão de beleza', ambos: 'Barbearia e salão' };
const SLUGS_RESERVADOS = ['admin', 'painel', 'api', 'app', 'login', 'demo', 'suporte'];

/* ---------- utilidades ---------- */
const pad = n => String(n).padStart(2, '0');
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const soDigitos = s => String(s ?? '').replace(/\D/g, '');
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = s => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || '';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const pinAleatorio = () => String(Math.floor(1000 + Math.random() * 9000));
const soma = (lista, f) => lista.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const esperar = ms => new Promise(r => setTimeout(r, ms));

const _brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = v => _brl.format(Number(v) || 0);
const numBR = v => (Number(v) || 0).toFixed(2).replace('.', ',');
function lerDinheiro(s) {
  if (typeof s === 'number') return s;
  s = String(s || '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}
function fmtTel(t) {
  const d = soDigitos(t).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || '';
}
function linkWhats(tel, texto) {
  let d = soDigitos(tel);
  if (d && d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}
function duracaoTxt(min) {
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
const copia = o => JSON.parse(JSON.stringify(o));

/* ---------- datas (sempre no horário local do aparelho) ---------- */
const Datas = {
  ymd(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  hoje() { return this.ymd(new Date()); },
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  soma(s, dias) { const d = this.parse(s); d.setDate(d.getDate() + dias); return this.ymd(d); },
  diff(a, b) { return Math.round((this.parse(a) - this.parse(b)) / 864e5); }, // a − b, em dias
  dow(s) { return this.parse(s).getDay(); },
  mes(s) { return s.slice(0, 7); },
  somaMes(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; },
  diasNoMes(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); },
  min(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); },
  hhmm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); },
  agoraMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
  abs(data, min) { return Math.round(this.parse(data).getTime() / 60000) + min; }, // minutos desde 1970
  agoraAbs() { return Math.floor(Date.now() / 60000); },
  curta(s) { const d = this.parse(s); return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`; },
  longa(s) { const d = this.parse(s); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; },
  br(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : ''; },
  brCurta(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : ''; },
  relativa(s) {
    const n = this.diff(s, this.hoje());
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return this.curta(s);
  },
  nomeMes(ym) { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; },
  mesCurto(ym) { const [y, m] = ym.split('-').map(Number); return `${MESES_CURTOS[m - 1]}/${String(y).slice(2)}`; },
  inicioSemana(s) { return this.soma(s, -this.dow(s)); }
};

/* ---------- modelos (valores padrão de cada registro) ---------- */
const HORARIO_PADRAO = {
  0: [], 1: [['09:00', '19:00']], 2: [['09:00', '19:00']], 3: [['09:00', '19:00']],
  4: [['09:00', '19:00']], 5: [['09:00', '19:00']], 6: [['08:00', '17:00']]
};
const Modelos = {
  barbearia(d = {}) {
    return {
      tipo: 'barbearia', status: 'teste', bloqueada: false, motivo_bloqueio: '', liberado_ate: null, teste_ate: null,
      plano_id: 'pl_solo', valor_mensal: 49.9, dia_vencimento: 10,
      responsavel: '', email: '', whatsapp: '', cidade: '', endereco: '', maps_url: '', instagram: '',
      logo: null, cor: '#c9a227', boas_vindas: 'Aqui você marca seu horário em poucos toques, a qualquer hora do dia.',
      horario: copia(HORARIO_PADRAO),
      regras: { intervalo: 30, antecedencia: 60, dias_frente: 30, cancelar_ate: 2 },
      pin_dono: String(Math.floor(1000 + Math.random() * 9000)), obs: '',
      ...d
    };
  },
  servicosPadrao(barbeariaId, tipo = 'barbearia') {
    const barbearia = [
      ['Corte masculino', 'Corte na máquina e tesoura, com lavagem e finalização.', 40, 30, 'Cabelo'],
      ['Barba', 'Toalha quente, navalha e hidratação.', 30, 30, 'Barba'],
      ['Corte + Barba', 'O combo completo com preço especial.', 65, 60, 'Combo'],
      ['Pezinho', 'Acabamento do contorno.', 15, 15, 'Cabelo']
    ];
    const salao = [
      ['Corte feminino', 'Corte com lavagem e finalização.', 70, 60, 'Cabelo'],
      ['Escova', 'Escova modelada, lisa ou com movimento.', 50, 45, 'Cabelo'],
      ['Hidratação', 'Tratamento com máscara e finalização.', 60, 45, 'Cabelo'],
      ['Coloração', 'Cor da raiz às pontas. O valor pode variar com o comprimento.', 120, 120, 'Química'],
      ['Manicure', 'Cutilagem e esmaltação.', 30, 40, 'Unhas'],
      ['Pedicure', 'Cutilagem e esmaltação dos pés.', 35, 45, 'Unhas']
    ];
    const sobrancelha = [['Design de sobrancelha', 'Limpeza e desenho.', 25, 20, 'Sobrancelha']];
    const lista = tipo === 'salao' ? [...salao, ...sobrancelha] : tipo === 'ambos' ? [...barbearia, ...salao.slice(0, 2), salao[4], ...sobrancelha] : [...barbearia, ...sobrancelha];
    return lista.map(([nome, descricao, preco, duracao, categoria], i) => ({
      id: uid('sv_'), barbearia_id: barbeariaId, nome, descricao, preco, duracao, categoria, foto: null, ativo: true, online: true, ordem: i
    }));
  }
};

/* ============================================================
   Store — onde os dados ficam guardados.
   Leitura síncrona (cache em memória); gravação assíncrona,
   para trocar por chamadas ao Supabase sem mudar as telas.
   ============================================================ */
const Store = {
  CHAVE: 'bsflow:dados:v1',
  db: null,
  ouvinte: null, // tela atual: chamada quando outra aba muda os dados

  carregar() {
    let bruto = null;
    try { bruto = localStorage.getItem(this.CHAVE); } catch (e) { /* navegador sem armazenamento */ }
    if (bruto) { try { this.db = JSON.parse(bruto); } catch (e) { this.db = null; } }
    if (!this.db || this.db.versao !== 1) { this.db = Seed.gerar(); this.gravar(); }
    return this.db;
  },
  gravar() {
    try { localStorage.setItem(this.CHAVE, JSON.stringify(this.db)); }
    catch (e) {
      try { const b = localStorage.getItem(this.CHAVE); if (b) this.db = JSON.parse(b); } catch (_) { /* mantém o cache */ }
      throw new Error('O armazenamento do navegador encheu. Use fotos menores ou remova fotos antigas.');
    }
  },
  t(tabela) { return this.db[tabela] || (this.db[tabela] = []); },
  get(tabela, id) { return id ? this.t(tabela).find(r => r.id === id) || null : null; },
  de(tabela, barbeariaId) { return this.t(tabela).filter(r => r.barbearia_id === barbeariaId); },
  async salvar(tabela, reg) {
    const lista = this.t(tabela);
    const agora = new Date().toISOString();
    if (!reg.id) reg = { ...reg, id: uid() };
    const i = lista.findIndex(r => r.id === reg.id);
    if (i >= 0) lista[i] = { ...lista[i], ...reg, atualizado_em: agora };
    else lista.push({ criado_em: agora, ...reg });
    this.gravar();
    return this.get(tabela, reg.id);
  },
  async remover(tabela, id) {
    this.db[tabela] = this.t(tabela).filter(r => r.id !== id);
    this.gravar();
  },
  async config(patch) { Object.assign(this.db.config, patch); this.gravar(); return this.db.config; },
  restaurar() { this.db = Seed.gerar(); this.gravar(); }
};
window.addEventListener('storage', e => {
  if (e.key !== Store.CHAVE || !e.newValue) return;
  try { Store.db = JSON.parse(e.newValue); } catch (_) { return; }
  if (Store.ouvinte) Store.ouvinte();
});

/* ============================================================
   Cobrança — situação de cada barbearia na plataforma
   ============================================================ */
const Cobranca = {
  situacao(b, hoje = Datas.hoje()) {
    const cfg = Store.db.config;
    const pendentes = Store.de('cobrancas', b.id).filter(c => c.status === 'pendente')
      .sort((x, y) => x.vencimento.localeCompare(y.vencimento));
    const vencidas = pendentes.filter(c => c.vencimento < hoje);
    const atraso = vencidas.length ? Datas.diff(hoje, vencidas[0].vencimento) : 0;
    const emAtraso = soma(vencidas, c => c.valor);
    const proxima = pendentes.find(c => c.vencimento >= hoje) || null;
    const base = { atraso, vencidas, pendentes, emAtraso, proxima };

    if (b.status === 'inativa') return { ...base, cod: 'inativa', texto: 'Inativa', tom: 'neutro', acesso: false, motivo: 'Esta conta está inativa.' };
    if (b.bloqueada) return { ...base, cod: 'bloqueada', texto: 'Bloqueada', tom: 'ruim', acesso: false, motivo: b.motivo_bloqueio || 'Acesso bloqueado pela administração.' };
    if (b.status === 'teste') {
      const resta = b.teste_ate ? Datas.diff(b.teste_ate, hoje) : -1;
      if (resta < 0) return { ...base, cod: 'teste_fim', texto: 'Teste encerrado', tom: 'ruim', acesso: false, motivo: 'O período de teste terminou.' };
      return { ...base, cod: 'teste', texto: resta === 0 ? 'Teste acaba hoje' : `Teste · ${resta} dia${resta > 1 ? 's' : ''}`, tom: 'info', acesso: true, resta };
    }
    if (vencidas.length) {
      const liberada = b.liberado_ate && b.liberado_ate >= hoje;
      if (cfg.bloqueio_auto && atraso > cfg.tolerancia_dias && !liberada)
        return { ...base, cod: 'bloqueada', texto: 'Bloqueada por atraso', tom: 'ruim', acesso: false, auto: true, motivo: `Mensalidade em atraso há ${atraso} dias.` };
      return { ...base, cod: 'atrasada', texto: `Atrasada · ${atraso} dia${atraso > 1 ? 's' : ''}`, tom: 'alerta', acesso: true, liberada };
    }
    if (proxima && Datas.diff(proxima.vencimento, hoje) <= 3)
      return { ...base, cod: 'vence_logo', texto: `Vence ${Datas.relativa(proxima.vencimento)}`, tom: 'aviso', acesso: true };
    return { ...base, cod: 'em_dia', texto: 'Em dia', tom: 'ok', acesso: true };
  },
  vencimentoDe(b, ym) { return `${ym}-${pad(Math.min(b.dia_vencimento || 10, Datas.diasNoMes(ym)))}`; },
  // cria a cobrança do mês para cada barbearia ativa que ainda não tem
  async gerarMes(ym) {
    let n = 0;
    for (const b of Store.t('barbearias')) {
      if (b.status !== 'ativa') continue;
      if (Store.de('cobrancas', b.id).some(c => c.referencia === ym && c.status !== 'cancelada')) continue;
      await Store.salvar('cobrancas', { barbearia_id: b.id, referencia: ym, valor: b.valor_mensal, vencimento: this.vencimentoDe(b, ym), status: 'pendente' });
      n++;
    }
    return n;
  },
  mensagem(b, c) {
    const cfg = Store.db.config;
    const atrasada = c.vencimento < Datas.hoje();
    const modelo = atrasada ? cfg.msg_atraso : cfg.msg_lembrete;
    const vars = {
      responsavel: primeiroNome(b.responsavel) || 'tudo bem', estabelecimento: b.nome, barbearia: b.nome, app: APP.nome,
      valor: dinheiro(c.valor), vencimento: Datas.br(c.vencimento), referencia: Datas.nomeMes(c.referencia),
      pix: cfg.chave_pix || '', dias: String(Datas.diff(Datas.hoje(), c.vencimento))
    };
    return modelo.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  }
};

/* ============================================================
   Agenda — expediente, horários livres e agendamento
   ============================================================ */
const Agenda = {
  OCUPAM: ['confirmado', 'concluido'],

  barbeiros(b, servicoIds = []) {
    return Store.de('barbeiros', b.id)
      .filter(x => x.ativo !== false && (!x.servicos || !x.servicos.length || servicoIds.every(id => x.servicos.includes(id))))
      .sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  },
  servicos(b, { soOnline = false } = {}) {
    return Store.de('servicos', b.id).filter(s => s.ativo !== false && (!soOnline || s.online !== false))
      .sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  },
  produtos(b) {
    return Store.de('produtos', b.id).filter(p => p.ativo !== false).sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  },
  duracao: servicos => soma(servicos, s => s.duracao),
  total: servicos => soma(servicos, s => s.preco),

  // faixas de trabalho do barbeiro no dia, em minutos: [[540, 720], [780, 1140]]
  expediente(b, barbeiro, data) {
    const h = (barbeiro && barbeiro.horario) ? barbeiro.horario : b.horario;
    return (h?.[Datas.dow(data)] || []).map(([i, f]) => [Datas.min(i), Datas.min(f)]);
  },
  ocupado(b, barbeiroId, data, ignorar) {
    const out = [];
    for (const a of Store.de('agendamentos', b.id))
      if (a.data === data && a.barbeiro_id === barbeiroId && this.OCUPAM.includes(a.status) && a.id !== ignorar) out.push([a.ini, a.fim, a]);
    for (const k of Store.de('bloqueios', b.id))
      if (k.data === data && (!k.barbeiro_id || k.barbeiro_id === barbeiroId)) out.push([k.ini, k.fim, k]);
    return out;
  },
  conflitos(b, barbeiroId, data, ini, fim, ignorar) {
    return this.ocupado(b, barbeiroId, data, ignorar).filter(([x, y]) => ini < y && fim > x).map(o => o[2]);
  },
  dentroExpediente(b, barbeiro, data, ini, fim) {
    return this.expediente(b, barbeiro, data).some(([x, y]) => ini >= x && fim <= y);
  },
  // limite mais cedo que o cliente pode marcar (antecedência mínima), em minutos absolutos
  limiteCliente(b) { return Datas.agoraAbs() + (b.regras?.antecedencia || 0); },
  ultimoDiaCliente(b) { return Datas.soma(Datas.hoje(), b.regras?.dias_frente || 30); },

  // horários de início livres (em minutos) para um barbeiro num dia
  horarios(b, barbeiro, data, duracao, { ignorar = null, cliente = true } = {}) {
    if (!barbeiro || duracao <= 0) return [];
    if (cliente && (data < Datas.hoje() || data > this.ultimoDiaCliente(b))) return [];
    const passo = b.regras?.intervalo || 30;
    const limite = cliente ? this.limiteCliente(b) : -Infinity;
    const ocup = this.ocupado(b, barbeiro.id, data, ignorar);
    const out = [];
    for (const [x, y] of this.expediente(b, barbeiro, data)) {
      for (let t = x; t + duracao <= y; t += passo) {
        if (Datas.abs(data, t) < limite) continue;
        if (ocup.some(([p, q]) => t < q && t + duracao > p)) continue;
        out.push(t);
      }
    }
    return out;
  },
  // para "sem preferência": cada horário com a lista de barbeiros livres
  horariosQualquer(b, barbeiros, data, duracao, opts) {
    const mapa = new Map();
    for (const x of barbeiros) for (const t of this.horarios(b, x, data, duracao, opts)) {
      if (!mapa.has(t)) mapa.set(t, []);
      mapa.get(t).push(x);
    }
    return [...mapa.entries()].sort((p, q) => p[0] - q[0]).map(([ini, lista]) => ({ ini, barbeiros: lista }));
  },
  // os próximos dias com a quantidade de horários livres
  dias(b, barbeiros, duracao, { ignorar = null } = {}) {
    const hoje = Datas.hoje();
    const n = b.regras?.dias_frente || 30;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const data = Datas.soma(hoje, i);
      const fechado = barbeiros.every(x => !this.expediente(b, x, data).length);
      const qtd = fechado ? 0 : this.horariosQualquer(b, barbeiros, data, duracao, { ignorar }).length;
      out.push({ data, qtd, fechado });
    }
    return out;
  },
  proximo(b, barbeiro, duracao) {
    const n = b.regras?.dias_frente || 30;
    for (let i = 0; i <= n; i++) {
      const data = Datas.soma(Datas.hoje(), i);
      const h = this.horarios(b, barbeiro, data, duracao);
      if (h.length) return { data, ini: h[0] };
    }
    return null;
  },
  // escolhe, entre os barbeiros livres, o que tem menos atendimentos no dia
  maisLivre(b, lista, data) {
    const qtd = x => Store.de('agendamentos', b.id).filter(a => a.data === data && a.barbeiro_id === x.id && a.status === 'confirmado').length;
    return [...lista].sort((p, q) => qtd(p) - qtd(q))[0];
  },
  cabe(b, barbeiro, data, ini, duracao, ignorar) {
    return this.dentroExpediente(b, barbeiro, data, ini, ini + duracao) && !this.conflitos(b, barbeiro.id, data, ini, ini + duracao, ignorar).length;
  },

  async cliente(b, nome, telefone) {
    const tel = soDigitos(telefone);
    if (!tel) return null;
    const existente = Store.de('clientes', b.id).find(c => c.telefone === tel);
    if (existente) {
      if (nome && existente.nome !== nome) return Store.salvar('clientes', { id: existente.id, nome });
      return existente;
    }
    return Store.salvar('clientes', { barbearia_id: b.id, nome, telefone: tel });
  },

  /* Marca (ou remarca, com id) um horário. Confere de novo se o horário está livre,
     porque outra pessoa pode ter marcado enquanto o cliente escolhia. */
  async agendar({ b, barbeiroId, data, ini, servicos, nome, telefone, origem = 'cliente', obs = '', encaixe = false, id = null }) {
    const dur = this.duracao(servicos);
    const ocupado = new Error('Esse horário acabou de ser ocupado. Escolha outro, por favor.');
    if (!Cobranca.situacao(b).acesso) throw new Error('O agendamento online está pausado no momento.');
    if (!servicos.length || dur <= 0) throw new Error('Escolha pelo menos um serviço.');
    if (origem === 'cliente' && Datas.abs(data, ini) < this.limiteCliente(b)) throw new Error('Esse horário já passou do prazo para agendar online.');
    let barbeiro = barbeiroId ? Store.get('barbeiros', barbeiroId) : null;
    if (!barbeiro) {
      const livres = this.barbeiros(b, servicos.map(s => s.id)).filter(x => this.cabe(b, x, data, ini, dur, id));
      if (!livres.length) throw ocupado;
      barbeiro = this.maisLivre(b, livres, data);
    } else if (!encaixe && !this.cabe(b, barbeiro, data, ini, dur, id)) throw ocupado;
    const cliente = await this.cliente(b, (nome || '').trim(), telefone);
    const reg = {
      barbearia_id: b.id, barbeiro_id: barbeiro.id, cliente_id: cliente?.id || null,
      cliente_nome: (nome || '').trim() || 'Cliente', cliente_tel: soDigitos(telefone),
      data, ini, fim: ini + dur,
      servicos: servicos.map(({ id, nome, preco, duracao }) => ({ id, nome, preco, duracao })),
      total: this.total(servicos), status: 'confirmado', origem, obs
    };
    if (id) Object.assign(reg, { id, remarcado_em: new Date().toISOString() });
    return Store.salvar('agendamentos', reg);
  },

  // agendamentos futuros (confirmados) de um telefone
  proximosDoCliente(b, tel) {
    const d = soDigitos(tel), agora = Datas.agoraAbs();
    return Store.de('agendamentos', b.id)
      .filter(a => a.cliente_tel === d && a.status === 'confirmado' && Datas.abs(a.data, a.fim) > agora)
      .sort((x, y) => Datas.abs(x.data, x.ini) - Datas.abs(y.data, y.ini));
  },
  ultimoDoCliente(b, tel) {
    const d = soDigitos(tel);
    return Store.de('agendamentos', b.id).filter(a => a.cliente_tel === d && a.status === 'concluido')
      .sort((x, y) => Datas.abs(y.data, y.ini) - Datas.abs(x.data, x.ini))[0] || null;
  },
  abertoAgora(b) {
    const hoje = Datas.hoje(), agora = Datas.agoraMin();
    return this.expediente(b, null, hoje).some(([x, y]) => agora >= x && agora < y);
  }
};

/* ============================================================
   Financeiro da barbearia
   ============================================================ */
const Financeiro = {
  comissao(barbeiro, valorServicos) { return Math.round((valorServicos * (barbeiro?.comissao || 0)) ) / 100; },

  movimentos(b, de, ate, barbeiroId = null) {
    const out = [];
    for (const a of Store.de('agendamentos', b.id)) {
      if (a.status !== 'concluido' || a.data < de || a.data > ate) continue;
      if (barbeiroId && a.barbeiro_id !== barbeiroId) continue;
      const servicos = Math.max(0, (a.valor_servicos ?? a.total) - (a.desconto || 0));
      out.push({
        tipo: 'atendimento', id: a.id, data: a.data, hora: a.ini, barbeiro_id: a.barbeiro_id, cliente: a.cliente_nome,
        descricao: a.servicos.map(s => s.nome).join(' + '), servicos, produtos: a.valor_produtos || 0,
        total: a.total_pago ?? a.total, forma: a.forma_pagamento || 'dinheiro', itens: a.servicos, prods: a.produtos || []
      });
    }
    for (const v of Store.de('vendas', b.id)) {
      if (v.data < de || v.data > ate) continue;
      if (barbeiroId && v.barbeiro_id !== barbeiroId) continue;
      out.push({
        tipo: 'venda', id: v.id, data: v.data, hora: v.hora ?? 0, barbeiro_id: v.barbeiro_id, cliente: v.cliente || 'Venda no balcão',
        descricao: v.itens.map(i => `${i.qtd}× ${i.nome}`).join(', '), servicos: 0, produtos: v.total,
        total: v.total, forma: v.forma, itens: [], prods: v.itens
      });
    }
    return out.sort((x, y) => (y.data + pad(y.hora)).localeCompare(x.data + pad(x.hora)));
  },

  resumo(b, de, ate, barbeiroId = null) {
    const movs = this.movimentos(b, de, ate, barbeiroId);
    const r = {
      movs, total: 0, servicos: 0, produtos: 0, atendimentos: 0, vendas: 0, comissao: 0,
      faltas: 0, cancelados: 0, previsto: 0, semBaixa: 0,
      porDia: {}, porBarbeiro: {}, porServico: {}, porForma: {}, porProduto: {}
    };
    const barbeiros = Object.fromEntries(Store.de('barbeiros', b.id).map(x => [x.id, x]));
    for (const m of movs) {
      r.total += m.total; r.servicos += m.servicos; r.produtos += m.produtos;
      if (m.tipo === 'atendimento') r.atendimentos++; else r.vendas++;
      r.porDia[m.data] = (r.porDia[m.data] || 0) + m.total;
      r.porForma[m.forma] = (r.porForma[m.forma] || 0) + m.total;
      const pb = r.porBarbeiro[m.barbeiro_id || '-'] ||= { atendimentos: 0, servicos: 0, produtos: 0, total: 0, comissao: 0 };
      pb.total += m.total; pb.servicos += m.servicos; pb.produtos += m.produtos;
      if (m.tipo === 'atendimento') {
        pb.atendimentos++;
        const c = this.comissao(barbeiros[m.barbeiro_id], m.servicos);
        pb.comissao += c; r.comissao += c;
        for (const s of m.itens) { const ps = r.porServico[s.nome] ||= { qtd: 0, valor: 0 }; ps.qtd++; ps.valor += s.preco; }
      }
      for (const p of m.prods) { const pp = r.porProduto[p.nome] ||= { qtd: 0, valor: 0 }; pp.qtd += p.qtd; pp.valor += p.preco * p.qtd; }
    }
    const agora = Datas.agoraAbs();
    for (const a of Store.de('agendamentos', b.id)) {
      if (a.data < de || a.data > ate || (barbeiroId && a.barbeiro_id !== barbeiroId)) continue;
      if (a.status === 'faltou') r.faltas++;
      else if (a.status === 'cancelado') r.cancelados++;
      else if (a.status === 'confirmado') {
        if (Datas.abs(a.data, a.fim) > agora) r.previsto += a.total; else r.semBaixa++;
      }
    }
    r.ticket = r.atendimentos ? (r.total - soma(movs.filter(m => m.tipo === 'venda'), m => m.total)) / r.atendimentos : 0;
    return r;
  }
};
