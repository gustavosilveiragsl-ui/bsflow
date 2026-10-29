'use strict';
/* ============================================================
   BSFlow oficial — liga as telas no Supabase.
   Sem NUVEM_CONFIG (demonstração) nada daqui é usado e os dados ficam no navegador.
   O Store continua com leitura síncrona: aqui o cache é preenchido a partir do
   servidor conforme a tela (admin, painel, chat) e cada gravação vai antes ao servidor.
   Campos da tela sem coluna própria no banco ficam na coluna "extras".
   ============================================================ */

// colunas de cada tabela (o que não está aqui vai para "extras")
const COLUNAS = {
  planos: 'id,nome,preco,max_barbeiros,descricao,recursos,ativo,criado_em,atualizado_em,extras',
  config: 'id,chave_pix,suporte_whatsapp,tolerancia_dias,bloqueio_auto,msg_lembrete,msg_atraso,atualizado_em,site_url',
  barbearias: 'id,slug,nome,tipo,status,bloqueada,motivo_bloqueio,liberado_ate,teste_ate,inativada_em,plano_id,valor_mensal,dia_vencimento,responsavel,email,whatsapp,cpf_cnpj,cidade,endereco,maps_url,instagram,logo,cor,boas_vindas,horario,regras,asaas_cliente_id,asaas_assinatura_id,criado_em,atualizado_em,pagamento,mensagens,extras,origem,termos_em,primeiro_vencimento,asaas_erro,whatsapp_instancia,whatsapp_estado,whatsapp_numero',
  cobrancas: 'id,barbearia_id,referencia,descricao,valor,vencimento,status,pago_em,forma,lembretes,cobrado_em,asaas_cobranca_id,link_pagamento,criado_em,atualizado_em,extras',
  barbeiros: 'id,barbearia_id,nome,telefone,foto,cor,comissao,servicos,horario,ativo,ordem,usuario_id,criado_em,atualizado_em,extras',
  servicos: 'id,barbearia_id,nome,descricao,preco,duracao,categoria,foto,ativo,online,ordem,criado_em,atualizado_em,extras',
  produtos: 'id,barbearia_id,nome,descricao,preco,estoque,foto,ativo,ordem,criado_em,atualizado_em,extras',
  clientes: 'id,barbearia_id,nome,telefone,criado_em,atualizado_em,extras',
  agendamentos: 'id,barbearia_id,barbeiro_id,cliente_id,cliente_nome,cliente_tel,data,ini,fim,servicos,total,status,origem,obs,reservas,produtos,valor_servicos,valor_produtos,desconto,total_pago,forma_pagamento,concluido_em,cancelado_por,cancelado_em,remarcado_em,token,criado_em,atualizado_em,valor_tabela,desconto_previsto,desconto_motivo,promo_ids,fidelidade_id,mensalista_id,cobertos,valor_coberto,credito_usado,remarcacoes,pagamento,extras',
  bloqueios: 'id,barbearia_id,barbeiro_id,data,ini,fim,motivo,criado_em,atualizado_em,extras',
  vendas: 'id,barbearia_id,barbeiro_id,data,hora,cliente,itens,total,forma,criado_em,atualizado_em,extras',
  promocoes: 'id,barbearia_id,nome,descricao,alvo,itens,tipo,valor,inicio,fim,criterios,ativo,divulgar,extras,criado_em,atualizado_em',
  fidelidades: 'id,barbearia_id,nome,a_cada,rotulo,servicos,tipo,valor,desde,ativo,extras,criado_em,atualizado_em',
  planos_mensais: 'id,barbearia_id,nome,descricao,valor,qtd_mes,servicos,regras,ativo,extras,criado_em,atualizado_em',
  mensalistas: 'id,barbearia_id,plano_id,cliente_id,cliente_nome,cliente_tel,barbeiro_id,dia_vencimento,inicio,status,valor,obs,extras,criado_em,atualizado_em',
  mensalidades: 'id,barbearia_id,mensalista_id,referencia,valor,vencimento,status,pago_em,forma,lembretes,extras,criado_em,atualizado_em',
  creditos: 'id,barbearia_id,cliente_tel,cliente_nome,valor,origem,agendamento_id,extras,criado_em,atualizado_em',
  mensagens: 'id,barbearia_id,tipo,para,nome,tel,ref,quando,status,texto,extras,criado_em,atualizado_em,tentativas,erro,enviado_em,push_em',
  fechamentos: 'id,barbearia_id,data,barbeiro_id,fechado_em,resumo,extras,criado_em,atualizado_em'
};
for (const t in COLUNAS) COLUNAS[t] = COLUNAS[t].split(',');
// tabelas do estabelecimento (carregadas no painel) e a coluna de data usada para não trazer história demais
const TABELAS_ESTAB = ['cobrancas', 'barbeiros', 'servicos', 'produtos', 'clientes', 'agendamentos', 'bloqueios', 'vendas',
  'promocoes', 'fidelidades', 'planos_mensais', 'mensalistas', 'mensalidades', 'creditos', 'mensagens', 'fechamentos'];
const DATA_DE = { agendamentos: 'data', bloqueios: 'data', vendas: 'data', mensagens: 'quando', fechamentos: 'data' };
const EMAIL_EQUIPE = id => `${String(id).toLowerCase().replace(/[^a-z0-9_-]/g, '')}@equipe.bsflow.app.br`;

const Nuvem = {
  ativo: false, sb: null, conta: undefined, contexto: null, pronto: false,
  canal: null, relogio: null, recentes: new Map(),

  iniciar() {
    const cfg = window.NUVEM_CONFIG;
    if (!cfg || !window.supabase) return;
    this.ativo = true;
    this.cfg = cfg;
    this.sb = window.supabase.createClient(cfg.url, cfg.chave, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bsflow:login' } });
    Store.db = this.vazio();
    Store.carregar = () => Store.db;
    Store.gravar = () => {};
    Store.restaurar = () => {};
    Store.salvar = (t, r) => this.salvar(t, r);
    Store.remover = (t, id) => this.remover(t, id);
    Store.config = patch => this.salvarConfig(patch);
    this.sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') this.conta = null; });
  },
  vazio() {
    const db = { versao: 1, config: { tolerancia_dias: 7, bloqueio_auto: true, chave_pix: '', suporte_whatsapp: '' } };
    for (const t of Object.keys(COLUNAS)) if (t !== 'config') db[t] = [];
    return db;
  },
  ehChat() { return this.ativo && /^(chat|publico):/.test(this.contexto || ''); },

  /* ---------- erros do servidor em português ---------- */
  erro(e) {
    const m = e?.message || String(e);
    if (/row-level security|permission denied|violates row-level/i.test(m)) return new Error('Sem permissão para isso, ou o acesso do estabelecimento está pausado.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    if (/duplicate key/i.test(m)) return new Error('Esse registro já existe.');
    if (/Invalid login credentials/i.test(m)) return new Error('E-mail ou senha incorretos.');
    return new Error(m.replace(/^.*?ERROR:\s*/, ''));
  },
  async rpc(nome, args) {
    const { data, error } = await this.sb.rpc(nome, args);
    if (error) throw this.erro(error);
    return data;
  },
  // chama uma função do servidor (contratar, equipe, bsflow-admin)
  async funcao(nome, corpo) {
    const { data: s } = await this.sb.auth.getSession();
    const r = await fetch(`${this.cfg.url}/functions/v1/${nome}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.cfg.chave, Authorization: `Bearer ${s?.session?.access_token || this.cfg.chave}` },
      body: JSON.stringify(corpo)
    }).catch(e => { throw this.erro(e); });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro || `O servidor respondeu ${r.status}.`);
    return j;
  },

  /* ---------- linhas do banco ↔ registros da tela ---------- */
  deLinha(tabela, l) {
    if (!l) return l;
    const { extras, ...resto } = l;
    for (const k of ['preco', 'valor', 'total', 'valor_mensal', 'comissao', 'valor_servicos', 'valor_produtos', 'desconto', 'total_pago',
      'valor_tabela', 'desconto_previsto', 'valor_coberto', 'credito_usado']) if (resto[k] != null) resto[k] = Number(resto[k]);
    return { ...(extras || {}), ...resto };
  },
  paraLinha(tabela, parcial, completo) {
    const cols = COLUNAS[tabela] || [];
    const linha = {};
    let extras = false;
    for (const [k, v] of Object.entries(parcial)) {
      if (['criado_em', 'atualizado_em', 'token'].includes(k) || k.startsWith('_')) continue;
      if (cols.includes(k)) linha[k] = v === undefined ? null : v;
      else if (!(tabela === 'barbearias' && k === 'obs')) extras = true;
    }
    if (extras && cols.includes('extras')) {
      linha.extras = {};
      for (const [k, v] of Object.entries(completo))
        if (!cols.includes(k) && !k.startsWith('_') && v !== undefined && !(tabela === 'barbearias' && k === 'obs')) linha.extras[k] = v;
    }
    return linha;
  },
  // lê a tabela inteira (o servidor devolve no máximo 1000 linhas por vez)
  async todos(tabela, filtro) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      let q = this.sb.from(tabela).select('*');
      if (filtro) q = filtro(q);
      const { data, error } = await q.range(i, i + 999);
      if (error) throw this.erro(error);
      out.push(...data);
      if (data.length < 1000) return out.map(l => this.deLinha(tabela, l));
    }
  },

  /* ---------- quem está logado ---------- */
  async lerConta(forcar = false) {
    if (this.conta !== undefined && !forcar) return this.conta;
    const { data } = await this.sb.auth.getSession();
    this.conta = data?.session ? await this.rpc('minha_conta').catch(() => null) : null;
    if (this.conta) this.conta.email = data.session.user.email;
    return this.conta;
  },
  async entrar(email, senha) {
    const { error } = await this.sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: senha });
    if (error) throw this.erro(error);
    this.contexto = null;
    const c = await this.lerConta(true);
    if (!c) { await this.sb.auth.signOut(); throw new Error('Este login ainda não tem acesso ao BSFlow. Fale com o suporte.'); }
    return c;
  },
  entrarEquipe(barbeiroId, senha) { return this.entrar(EMAIL_EQUIPE(barbeiroId), senha); },
  // limpa tudo antes de avisar o servidor, para a tela de login não esperar o logout terminar
  async sair() {
    this.pararAoVivo();
    this.conta = null; this.contexto = null; this.pronto = false;
    Store.db = this.vazio();
    await this.sb.auth.signOut().catch(() => {});
  },
  async trocarSenha(nova) {
    const { error } = await this.sb.auth.updateUser({ password: nova });
    if (error) throw this.erro(error);
  },

  /* ---------- o que cada tela precisa ---------- */
  async preparar(p) {
    await this.lerConta();
    if (!p.length || !this.ehEstab(p)) return this.garantirPlanos();
    if (p[0] === 'admin') return this.conta?.papel === 'admin' ? this.carregar('admin') : this.garantirPlanos();
    const slug = p[0];
    if (p[1] === 'painel') {
      const meu = this.conta && (this.conta.slug === slug || this.conta.papel === 'admin');
      return this.carregar((meu ? 'painel:' : 'publico:') + slug);
    }
    return this.carregar('chat:' + slug);
  },
  ehEstab(p) { return !['contratar', 'entrar', 'termos', 'privacidade'].includes(p[0]); },
  async garantirPlanos() {
    if (this.contexto === 'site') return;
    this.pararAoVivo();
    const db = this.vazio();
    const [{ data }, cfg] = await Promise.all([this.sb.from('planos').select('*').eq('ativo', true), this.sb.rpc('config_publica')]);
    db.planos = (data || []).map(l => this.deLinha('planos', l));
    Object.assign(db.config, cfg.data || {});
    Store.db = db; this.contexto = 'site';
  },
  async carregar(ctx) {
    if (this.contexto === ctx && this.pronto) return;
    this.pararAoVivo();
    this.contexto = ctx; this.pronto = false;
    const db = this.vazio();
    const [tipo, slug] = ctx.split(':');
    if (tipo === 'admin') await this.carregarAdmin(db);
    else if (tipo === 'painel') await this.carregarPainel(db, slug);
    else await this.carregarChat(db, slug, tipo === 'chat');
    if (this.contexto !== ctx) return; // outra tela foi aberta enquanto carregava
    Store.db = db; this.pronto = true;
    if (tipo === 'painel' && db.barbearias[0]) this.aoVivo(db.barbearias[0].id);
    if (tipo === 'chat') this.relogio = setInterval(() => this.atualizarChat().catch(() => {}), 45000);
  },
  async planosEConfig(db) {
    const [pl, cfg] = await Promise.all([this.sb.from('planos').select('*'), this.sb.rpc('config_publica')]);
    db.planos = (pl.data || []).map(l => this.deLinha('planos', l));
    Object.assign(db.config, cfg.data || {});
  },
  async carregarAdmin(db) {
    const desde = Datas.somaMes(Datas.mes(Datas.hoje()), -1) + '-01';
    const [bbs, notas, cfg] = await Promise.all([
      this.todos('barbearias'), this.todos('notas_internas'), this.sb.from('config').select('*').eq('id', 1).maybeSingle()
    ]);
    const obs = Object.fromEntries(notas.map(n => [n.barbearia_id, n.obs]));
    db.barbearias = bbs.map(b => ({ ...b, obs: obs[b.id] || '' }));
    Object.assign(db.config, cfg.data || {});
    const [planos, cobs, barbs, svs, ags, vds] = await Promise.all([
      this.todos('planos'), this.todos('cobrancas'), this.todos('barbeiros'), this.todos('servicos'),
      this.todos('agendamentos', q => q.gte('data', desde)), this.todos('vendas', q => q.gte('data', desde))
    ]);
    Object.assign(db, { planos, cobrancas: cobs, barbeiros: barbs, servicos: svs, agendamentos: ags, vendas: vds });
  },
  async carregarPainel(db, slug) {
    const { data: b, error } = await this.sb.from('barbearias').select('*').eq('slug', slug).maybeSingle();
    if (error) throw this.erro(error);
    if (!b) return;
    db.barbearias = [this.deLinha('barbearias', b)];
    const desde = Datas.soma(Datas.hoje(), -400);
    await Promise.all([this.planosEConfig(db), ...TABELAS_ESTAB.map(async t => {
      db[t] = await this.todos(t, q => { q = q.eq('barbearia_id', b.id); return DATA_DE[t] ? q.gte(DATA_DE[t], desde) : q; });
    })]);
    // este aparelho já deixou notificar: confirma a inscrição no servidor (avisos com o app fechado)
    if ('Notification' in window && Notification.permission === 'granted') this.inscreverPush().catch(() => {});
  },
  // chat (e tela de login do painel): só o que é público, mais o que é do próprio cliente
  async carregarChat(db, slug, completo) {
    const d = await this.rpc('chat_dados', { p_slug: slug });
    if (!d) return;
    db.barbearias = [{ ...d.barbearia, _sit: d.situacao }];
    db.planos = d.plano ? [d.plano] : [];
    db.config.suporte_whatsapp = d.suporte_whatsapp || '';
    for (const t of ['servicos', 'produtos', 'barbeiros', 'promocoes', 'fidelidades', 'planos_mensais']) db[t] = (d[t] || []).map(l => this.deLinha(t, l));
    if (!completo) return;
    await this.ocupacao(db, slug);
    await this.doCliente(db, slug);
  },
  async ocupacao(db, slug) {
    const b = db.barbearias[0];
    const o = await this.rpc('chat_ocupacao', { p_slug: slug, p_de: Datas.hoje(), p_ate: Datas.soma(Datas.hoje(), (b.regras?.dias_frente || 30) + 1) });
    const meus = new Map(db.agendamentos.filter(a => a.token).map(a => [a.id, a]));
    db.agendamentos = [
      ...(o.agendamentos || []).map(a => meus.get(a.id) || { cliente_nome: '', cliente_tel: '', servicos: [], total: 0, origem: 'balcao', ...a }),
      ...[...meus.values()].filter(a => !(o.agendamentos || []).some(x => x.id === a.id))
    ];
    db.bloqueios = o.bloqueios || [];
  },
  tokens(slug) { try { return JSON.parse(localStorage.getItem('bsflow:tokens:' + slug) || '[]'); } catch (e) { return []; } },
  guardarToken(slug, token) {
    if (!token) return;
    const l = [token, ...this.tokens(slug).filter(t => t !== token)].slice(0, 50);
    try { localStorage.setItem('bsflow:tokens:' + slug, JSON.stringify(l)); } catch (e) { /* sem armazenamento */ }
  },
  async doCliente(db, slug) {
    const tk = this.tokens(slug);
    if (!tk.length) return;
    const c = await this.rpc('chat_cliente', { p_slug: slug, p_tokens: tk });
    if (!c) return;
    const proprios = (c.agendamentos || []).map(a => this.deLinha('agendamentos', a));
    const ids = new Set(proprios.map(a => a.id));
    db.agendamentos = [...db.agendamentos.filter(a => !ids.has(a.id)), ...proprios];
    db.mensalistas = c.mensalistas || [];
    db.mensalidades = c.mensalidades || [];
    db.creditos = c.creditos || [];
  },
  async atualizarChat() {
    if (!/^chat:/.test(this.contexto || '')) return;
    const slug = this.contexto.slice(5);
    await this.ocupacao(Store.db, slug);
  },

  /* ---------- avisos ao vivo no painel ---------- */
  aoVivo(bid) {
    this.canal = this.sb.channel('estab-' + bid);
    // só tabelas que estão na publicação do Realtime (uma de fora derruba o canal inteiro)
    for (const t of ['agendamentos', 'mensagens'])
      this.canal.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `barbearia_id=eq.${bid}` }, ev => this.mudouNoServidor(t, ev));
    this.canal.subscribe();
    this._volta ||= () => { if (!document.hidden && /^painel:/.test(this.contexto || '')) this.recarregarAgenda().catch(() => {}); };
    document.addEventListener('visibilitychange', this._volta);
  },
  pararAoVivo() {
    if (this.canal) { this.sb.removeChannel(this.canal); this.canal = null; }
    if (this.relogio) { clearInterval(this.relogio); this.relogio = null; }
  },
  mudouNoServidor(t, ev) {
    const lista = Store.t(t);
    const id = ev.new?.id || ev.old?.id;
    if (ev.eventType === 'DELETE') Store.db[t] = lista.filter(r => r.id !== id);
    else {
      const r = this.deLinha(t, ev.new), i = lista.findIndex(x => x.id === r.id), antes = i >= 0 ? lista[i] : null;
      if (i >= 0) lista[i] = r; else lista.push(r);
    }
    if (Store.ouvinte) Store.ouvinte();
  },
  foiEuQueSalvei(id) { const q = this.recentes.get(id); return q && Date.now() - q < 15000; },
  async recarregarAgenda() {
    const b = Store.db.barbearias[0];
    if (!b) return;
    const de = Datas.soma(Datas.hoje(), -2);
    const novos = await this.todos('agendamentos', q => q.eq('barbearia_id', b.id).gte('data', de));
    Store.db.agendamentos = [...Store.t('agendamentos').filter(a => a.data < de), ...novos];
    if (Store.ouvinte) Store.ouvinte();
  },
  // horários marcados pelo chat enquanto o painel estava fechado: cria as mensagens que faltam
  async mensagensPendentes(db) {
    const comMsg = new Set(db.mensagens.map(m => m.ref));
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const falta = db.agendamentos.filter(a => a.origem === 'cliente' && a.status === 'confirmado' && a.data >= Datas.hoje() && (a.criado_em || '') >= desde && !comMsg.has(a.id));
    if (!falta.length) return;
    const antes = Store.db;
    Store.db = db;
    try { for (const a of falta) await Mensagens.aoMudarAgendamento(null, a); } catch (e) { console.warn(e); } finally { Store.db = antes; }
  },

  /* ---------- notificações com o app fechado (Web Push) ---------- */
  async inscreverPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const chave = await this.rpc('push_chave');
    if (!chave) return false;
    const bin = atob(chave.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - chave.length % 4) % 4));
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(bin, c => c.charCodeAt(0)) });
    const j = sub.toJSON();
    if (/^chat:/.test(this.contexto || '')) {
      const slug = this.contexto.slice(5);
      return this.rpc('chat_push_inscrever', { p_slug: slug, p_tokens: this.tokens(slug), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    }
    if (!this.conta || this.conta.papel === 'admin') return false;
    return this.rpc('push_inscrever', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  },

  /* ---------- gravação ---------- */
  async salvar(tabela, reg) {
    if (this.ehChat()) return this.salvarChat(tabela, reg);
    const lista = Store.t(tabela);
    const antes = reg.id ? lista.find(r => r.id === reg.id) || null : null;
    reg = await this.subirFotos(tabela, reg, antes);
    const completo = { ...(antes || {}), ...reg };
    // mensagem automática com id fixo: dois aparelhos abertos não criam a mesma duas vezes
    if (!completo.id) completo.id = tabela === 'mensagens' && completo.ref ? this.idMensagem(completo) : uid();
    const linha = this.paraLinha(tabela, antes ? reg : completo, completo);
    if (!antes) linha.id = completo.id;
    this.recentes.set(completo.id, Date.now());
    const q = this.sb.from(tabela);
    let { data, error } = antes ? await q.update(linha).eq('id', completo.id).select().maybeSingle() : await q.insert(linha).select().maybeSingle();
    if (error && tabela === 'mensagens' && /duplicate key/i.test(error.message)) return lista.find(r => r.id === completo.id) || completo;
    if (error) throw this.erro(error);
    if (!data) throw new Error('Não deu para salvar: sem permissão, ou o acesso do estabelecimento está pausado.');
    const depois = this.deLinha(tabela, data);
    if (tabela === 'barbearias' && 'obs' in reg && this.conta?.papel === 'admin') {
      await this.sb.from('notas_internas').upsert({ id: depois.id, barbearia_id: depois.id, obs: reg.obs || '' });
      depois.obs = reg.obs || '';
    } else if (tabela === 'barbearias' && antes) depois.obs = antes.obs;
    const i = lista.findIndex(r => r.id === depois.id);
    if (i >= 0) lista[i] = depois; else lista.push(depois);
    if (Store.aoSalvar) await Store.aoSalvar(tabela, antes ? { ...antes } : null, depois);
    if (tabela === 'barbearias' && antes && this.conta?.papel === 'admin' && depois.asaas_assinatura_id &&
        (antes.valor_mensal !== depois.valor_mensal || antes.plano_id !== depois.plano_id))
      this.funcao('bsflow-admin', { acao: 'asaas_atualizar', barbearia_id: depois.id })
        .then(() => UI.toast('Assinatura atualizada no Asaas.'))
        .catch(e => UI.toast('Atualize no Asaas: ' + e.message, 'erro'));
    return depois;
  },
  idMensagem(m) { return ('mg_' + semAcento(`${m.ref}_${m.tipo}_${m.para}_${m.quando}`).replace(/[^a-z0-9_]/g, '')).slice(0, 120); },
  async remover(tabela, id) {
    if (this.ehChat()) { Store.db[tabela] = Store.t(tabela).filter(r => r.id !== id); return; }
    const { error } = await this.sb.from(tabela).delete().eq('id', id);
    if (error) throw this.erro(error);
    Store.db[tabela] = Store.t(tabela).filter(r => r.id !== id);
  },
  async salvarConfig(patch) {
    const linha = {};
    for (const [k, v] of Object.entries(patch)) if (COLUNAS.config.includes(k)) linha[k] = v;
    if (Object.keys(linha).length) {
      const { error } = await this.sb.from('config').update(linha).eq('id', 1);
      if (error) throw this.erro(error);
    }
    Object.assign(Store.db.config, patch);
    return Store.db.config;
  },
  // fotos escolhidas na tela (data:image...) vão para o Storage; no banco fica só o endereço
  async subirFotos(tabela, reg, antes) {
    const out = { ...reg };
    for (const campo of ['foto', 'logo']) {
      const v = out[campo];
      if (typeof v !== 'string' || !v.startsWith('data:image')) continue;
      const pasta = tabela === 'barbearias' ? (reg.id || antes?.id) : (reg.barbearia_id || antes?.barbearia_id);
      const blob = await (await fetch(v)).blob();
      const tipo = blob.type || 'image/jpeg';
      const nome = `${pasta}/${tabela}-${uid()}.${(tipo.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
      const { error } = await this.sb.storage.from('fotos').upload(nome, blob, { contentType: tipo, upsert: false });
      if (error) throw new Error('Não deu para enviar a foto: ' + error.message);
      out[campo] = this.sb.storage.from('fotos').getPublicUrl(nome).data.publicUrl;
    }
    return out;
  },

  /* ---------- chat do cliente: tudo pelas funções do servidor ---------- */
  guardarAg(r) {
    const a = this.deLinha('agendamentos', r);
    const lista = Store.t('agendamentos'), i = lista.findIndex(x => x.id === a.id);
    if (i >= 0) lista[i] = { ...lista[i], ...a }; else lista.push(a);
    return Store.get('agendamentos', a.id);
  },
  async chatAgendar({ b, barbeiroId, data, ini, servicos, nome, telefone, id }) {
    const velho = id ? Store.get('agendamentos', id) : null;
    try {
      const r = await this.rpc('chat_agendar', {
        p_slug: b.slug, p_barbeiro: barbeiroId || null, p_data: data, p_ini: ini, p_servicos: servicos.map(s => s.id),
        p_nome: (nome || '').trim(), p_tel: soDigitos(telefone), p_token: velho?.token || null
      });
      this.guardarToken(b.slug, r.token);
      return this.guardarAg(r);
    } catch (e) {
      this.atualizarChat().catch(() => {});
      throw e;
    }
  },
  async salvarChat(tabela, reg) {
    if (tabela === 'agendamentos' && reg.id) {
      const a = Store.get('agendamentos', reg.id);
      if (!a?.token) throw new Error('Esse horário não foi marcado neste aparelho. Fale com o estabelecimento pelo WhatsApp.');
      let r = null;
      if (reg.status === 'cancelado') r = await this.rpc('chat_cancelar', { p_token: a.token });
      else if (reg.reservas) {
        for (const it of reg.reservas) {
          const tinha = (a.reservas || []).find(x => x.id === it.id)?.qtd || 0;
          for (let k = tinha; k < it.qtd; k++) r = await this.rpc('chat_reservar', { p_token: a.token, p_produto: it.id });
        }
      }
      return r ? this.guardarAg(r) : a;
    }
    // créditos, mensagens e cadastro do cliente: o servidor cuida sozinho
    if (['creditos', 'mensagens', 'clientes'].includes(tabela)) return { ...reg, id: reg.id || uid() };
    throw new Error('Isso ainda não está disponível pelo chat. Fale com o estabelecimento pelo WhatsApp.');
  }
};
Nuvem.iniciar();
