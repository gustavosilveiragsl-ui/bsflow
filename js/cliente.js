'use strict';
/* ============================================================
   Frente 3 — Agendamento do cliente, em forma de conversa
   O "robô" vai guiando: serviço → profissional → dia → hora → nome → confirmação.
   Também mostra catálogo, dias livres, endereço e os horários do cliente.
   ============================================================ */
const CANCELADO = Symbol('cancelado');

const simNao = t => {
  const n = semAcento(t).trim();
  if (/^(s|sim|isso|pode|ok|certo|claro|bora|sou eu|confirm|beleza|blz|isso mesmo|quero|manda)/.test(n)) return { valor: true };
  if (/^(n|nao|outro|errado|mudar|alterar|cancela)/.test(n)) return { valor: false };
  return undefined;
};
const nomeProprio = s => s.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
  .map((p, i) => i === 0 || p.length > 2 ? cap(p) : p).join(' ');

const Cliente = {
  app: null, b: null, msgs: null, fluxo: null, pendente: null, pausado: false,
  vel: 1, // os testes automáticos aceleram a "digitação"

  RAPIDAS: {
    agendar: ['Agendar horário', 'calendario-mais'], servicos: ['Serviços e preços', 'tesoura'], dias: ['Dias livres', 'calendario'],
    produtos: ['Produtos', 'sacola'], meus: ['Meus horários', 'relogio'], info: ['Endereço', 'pin'],
    equipe: ['Equipe', 'usuarios'], whats: ['WhatsApp', 'mensagem'], inicio: ['Início', 'casa'],
    promocoes: ['Promoções', 'brilho'], plano: ['Plano mensal', 'coroa'], fidelidade: ['Fidelidade', 'estrela'], instalar: ['Instalar o app', 'baixar']
  },

  render(app, slug) {
    this.app = app;
    document.body.className = 'tela-cliente';
    const b = Store.t('barbearias').find(x => x.slug === slug);
    if (!b) {
      app.innerHTML = `<div class="tela-msg"><div><span class="grande-icone">${ic('busca')}</span><h1>Página não encontrada</h1><p>Confira se o link está certinho.</p><a class="btn" href="#/">Início</a></div></div>`;
      return;
    }
    Object.assign(this, { b, pendente: null, fluxo: null });
    UI.aplicarCor(b.cor);
    PWA.configurar({ nome: b.nome, curto: b.nome, cor: b.cor, logo: b.logo, texto: UI.iniciaisMarca(b.nome), inicio: UI.linkCliente(b) });
    document.title = `${b.nome} · Agende seu horário`;
    this.pausado = !Cobranca.situacao(b).acesso;
    const aberto = Agenda.abertoAgora(b);
    app.innerHTML = `<div class="chat-palco"><div class="chat">
      <header class="chat-cab">
        <span class="chat-logo">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : esc(UI.iniciaisMarca(b.nome))}</span>
        <div class="chat-cab-txt"><b>${esc(b.nome)}</b><span><i class="${aberto ? '' : 'fechado'}"></i>${aberto ? 'Aberto agora · agenda online 24h' : 'Agendamento online 24h'}</span></div>
        ${this.pausado ? '' : `<button class="btn-icone" data-a="catalogo" aria-label="Ver catálogo" title="Catálogo">${ic('grade')}</button>`}
      </header>
      <div class="chat-msgs" id="msgs" role="log" aria-live="polite"></div>
      <div class="chat-rapidas" id="rapidas"></div>
      <form class="chat-entrada" id="entrada"><input id="texto" autocomplete="off" placeholder="Escreva aqui…" enterkeyhint="send" aria-label="Mensagem"><button class="chat-enviar" aria-label="Enviar">${ic('enviar')}</button></form>
    </div></div>`;
    this.msgs = $('#msgs', app);
    app.onclick = e => this.clique(e);
    $('#entrada', app).onsubmit = e => { e.preventDefault(); this.enviarTexto(); };
    Store.ouvinte = () => { const nb = Store.get('barbearias', b.id); if (nb) this.b = nb; };
    this.msgs.insertAdjacentHTML('beforeend', '<div class="chat-dia">Hoje</div>');
    if (this.pausado) return this.indisponivel();
    this.inicio();
  },

  /* ---------------- conversa: peças básicas ---------------- */
  add(lado, html, cls = '') {
    const m = document.createElement('div');
    m.className = `msg ${lado} ${cls}`;
    m.innerHTML = `<div class="bolha">${html}</div>`;
    this.msgs.appendChild(m);
    this.rolarPara(m);
    return m;
  },
  // mostra a mensagem nova; se ela for alta (lista de serviços), mostra o começo dela
  rolarPara(m) {
    requestAnimationFrame(() => {
      const fundo = this.msgs.scrollHeight - this.msgs.clientHeight;
      this.msgs.scrollTo({ top: Math.min(fundo, m.offsetTop - 56), behavior: 'smooth' });
    });
  },
  eu(texto) { if (texto) this.add('eu', esc(texto)); },
  async bot(html, { espera } = {}) {
    const f = this.fluxo;
    const d = this.add('bot', '<span></span><span></span><span></span>', 'digitando');
    const ms = espera ?? Math.min(950, 260 + html.replace(/<[^>]+>/g, '').length * 7);
    await esperar(ms * this.vel);
    d.remove();
    if (f && (!f.vivo || f !== this.fluxo)) throw CANCELADO;
    return this.add('bot', html);
  },
  // começa uma conversa nova; a anterior (se estava esperando resposta) é encerrada
  rodar(fn) {
    if (this.fluxo) this.fluxo.vivo = false;
    if (this.pendente) { const p = this.pendente; this.pendente = null; p.el?.classList.add('respondido'); p.rejeitar(CANCELADO); }
    this.modoTexto(null);
    const f = this.fluxo = { vivo: true };
    this.rapidas(['inicio']);
    return Promise.resolve().then(() => fn(f)).catch(e => {
      if (e === CANCELADO) return;
      console.error(e);
      this.add('bot', 'Ops, algo deu errado aqui. Pode tentar de novo?');
      this.menuRapido();
    });
  },
  // espera o cliente escolher uma opção do widget (ou digitar algo que case com ela)
  perguntar(el, { opcoes = [], casar = null } = {}) {
    return new Promise((ok, falha) => {
      this.pendente = {
        el, casar, rejeitar: falha,
        escolher: i => {
          const o = opcoes[i];
          if (!o) return;
          const valor = typeof o.valor === 'function' ? o.valor() : o.valor;
          if (valor === undefined) return;
          this.pendente = null;
          el.classList.add('respondido');
          el.querySelector(`[data-op="${i}"]`)?.classList.add('escolhida');
          this.eu(typeof o.eco === 'function' ? o.eco() : o.eco);
          ok(valor);
        },
        responder: valor => { this.pendente = null; el.classList.add('respondido'); ok(valor); }
      };
    });
  },
  widget(html, opcoes, extra = {}) {
    const m = this.add('bot', html, 'com-widget');
    return this.perguntar(m.querySelector('.widget'), { opcoes, ...extra });
  },
  op(i, inner, cls = '', attrs = '') { return `<button type="button" class="w-op ${cls}" data-op="${i}" ${attrs}>${inner}</button>`; },
  texto({ placeholder = 'Escreva aqui…', tel = false, validar = null } = {}) {
    this.modoTexto({ placeholder, tel });
    return new Promise((ok, falha) => {
      this.pendente = { tipo: 'texto', rejeitar: falha, validar, responder: v => { this.pendente = null; this.modoTexto(null); ok(v); } };
    });
  },
  modoTexto(cfg) {
    const i = $('#texto', this.app);
    if (!i) return;
    i.placeholder = cfg?.placeholder || 'Escreva aqui…';
    i.type = cfg?.tel ? 'tel' : 'text';
    i.inputMode = cfg?.tel ? 'tel' : 'text';
    i.autocomplete = cfg?.tel ? 'tel' : cfg ? 'name' : 'off';
    if (cfg?.tel) i.setAttribute('data-tel', ''); else i.removeAttribute('data-tel');
    if (cfg) setTimeout(() => i.focus(), 60);
  },
  rapidas(lista) {
    const caixa = $('#rapidas', this.app);
    if (!caixa) return;
    caixa.innerHTML = lista.filter(k => this.RAPIDAS[k]).map(k => `<button type="button" class="rapida" data-a="${k}" data-rot="${this.RAPIDAS[k][0]}">${ic(this.RAPIDAS[k][1])}${this.RAPIDAS[k][0]}</button>`).join('');
    caixa.scrollLeft = 0;
  },
  menuRapido(primeiro = []) {
    const b = this.b;
    const todas = ['agendar', Promocoes.divulgaveis(b).length ? 'promocoes' : null, Mensal.planos(b).length ? 'plano' : null, 'servicos', 'dias',
      Agenda.produtos(b).length ? 'produtos' : null, 'meus', Fidelidade.programas(b).length ? 'fidelidade' : null, 'info',
      Agenda.barbeiros(b).length > 1 ? 'equipe' : null, b.whatsapp ? 'whats' : null, PWA.instalado() ? null : 'instalar'].filter(Boolean);
    this.rapidas([...new Set([...primeiro, ...todas])]);
  },
  menuWidget() {
    const b = this.b, nPd = Agenda.produtos(b).length, eu = this.lembrado();
    const promos = Promocoes.divulgaveis(b), mens = eu && Mensal.doTelefone(b, eu.tel), planos = Mensal.planos(b);
    const itens = [
      mens ? ['plano', 'coroa', 'Agendar pelo meu plano', `${Mensal.plano(mens)?.nome}: ${Mensal.restantes(b, mens, Datas.mes(Datas.hoje()))} atendimento(s) livre(s) este mês`, 'pri'] : null,
      ['agendar', 'calendario-mais', 'Agendar horário', 'Serviço, dia e hora em poucos toques', mens ? '' : 'pri'],
      promos.length ? ['promocoes', 'brilho', 'Promoções', promos.length === 1 ? promos[0].nome : `${promos.length} promoções: ${promos[0].nome} e mais`] : null,
      !mens && planos.length ? ['plano', 'coroa', 'Planos mensais', `A partir de ${dinheiro(planos[0].valor)}/mês · já sou mensalista`] : null,
      ['servicos', 'tesoura', 'Serviços e preços', `${Agenda.servicos(b, { soOnline: true }).length} serviços com foto e valor`],
      ['dias', 'calendario', 'Ver dias e horários livres', 'Confira a agenda antes de escolher'],
      nPd ? ['produtos', 'sacola', 'Produtos', `${nPd} produtos à venda aqui`] : null,
      ['meus', 'relogio', 'Meus horários', 'Remarcar ou cancelar'],
      ['info', 'pin', 'Endereço e funcionamento', b.endereco ? b.endereco.split('—')[0].trim() : 'Como chegar']
    ].filter(Boolean);
    this.add('bot', `<div class="widget w-menu">${itens.map(([a, icone, t, s, cls]) =>
      `<button type="button" class="w-menu-op ${cls || ''}" data-a="${a}" data-rot="${t}"><span class="ic-caixa">${ic(icone)}</span><div><b>${t}</b><small>${esc(s)}</small></div>${ic('direita')}</button>`).join('')}</div>`, 'com-widget');
  },
  lembrado() { try { return JSON.parse(localStorage.getItem('bsflow:cliente:' + this.b.id) || 'null'); } catch (e) { return null; } },
  lembrar(c) { try { localStorage.setItem('bsflow:cliente:' + this.b.id, JSON.stringify({ nome: c.nome, tel: c.tel })); } catch (e) { /* sem armazenamento */ } },
  normTel: v => soDigitos(v).replace(/^55(?=\d{10,11}$)/, ''),
  validarTel(v) { return [10, 11].includes(Cliente.normTel(v).length) || 'Confere o número? Preciso do DDD + número, por exemplo (21) 99999-9999.'; },
  botaoWhats(texto = 'Olá!') {
    if (!this.b.whatsapp) return;
    this.add('bot', `<div class="widget"><a class="btn-chat verde" style="width:100%" href="${linkWhats(this.b.whatsapp, texto)}" target="_blank" rel="noopener">${ic('mensagem')} Chamar no WhatsApp</a></div>`, 'com-widget');
  },

  /* ---------------- eventos ---------------- */
  clique(e) {
    const op = e.target.closest('[data-op]');
    if (op) {
      const p = this.pendente, w = op.closest('.widget');
      if (p?.escolher && p.el === w) p.escolher(Number(op.dataset.op));
      return;
    }
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    switch (a) {
      case 'catalogo': return this.abrirCatalogo('servicos');
      case 'w-toggle': return this.toggleServico(el);
      case 'ver-cal': return this.alternarCal(el.closest('.widget'));
      case 'cal-mes': { const w = el.closest('.widget'); w._mes = Datas.somaMes(w._mes, Number(el.dataset.d)); return this.desenharMes(w); }
      case 'ics': return this.baixarIcs(el.dataset.id);
      case 'agendar-sv': {
        const s = Store.get('servicos', el.dataset.id);
        this.fecharFolha();
        this.eu(`Quero agendar: ${s.nome}`);
        return this.fluxoAgendar({ servicos: [s] });
      }
      case 'agendar-com': {
        const x = Store.get('barbeiros', el.dataset.id);
        this.fecharFolha();
        this.eu(`Quero agendar com ${primeiroNome(x.nome)}`);
        return this.fluxoAgendar({ barbeiro: x });
      }
      case 'quero-pd': this.fecharFolha(); return this.querProduto(el.dataset.id);
      case 'promo-usar': return this.usarPromocao(el.dataset.id);
      case 'copiar-pix': return UI.copiar(el.dataset.v);
      case 'notif': return this.ativarNotificacoes();
      default:
        if (this.RAPIDAS[a]) { this.eu(el.dataset.rot); return this.acao(a); }
    }
  },
  acao(a) {
    if (this.pausado) return this.indisponivel(false);
    const f = {
      agendar: () => this.fluxoAgendar(), servicos: () => this.fluxoServicos(), dias: () => this.fluxoAgendar({ calendario: true }),
      produtos: () => this.fluxoProdutos(), meus: () => this.fluxoMeus(), info: () => this.fluxoInfo(),
      equipe: () => this.fluxoEquipe(), whats: () => this.fluxoWhats(), inicio: () => this.fluxoMenu(),
      promocoes: () => this.fluxoPromocoes(), plano: () => this.fluxoPlano(), fidelidade: () => this.fluxoFidelidade(), instalar: () => PWA.instalar()
    }[a];
    if (f) f();
  },
  enviarTexto() {
    const inp = $('#texto', this.app), v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    this.eu(v);
    if (this.pausado) return this.indisponivel(false);
    const p = this.pendente;
    if (p?.tipo === 'texto') {
      const ok = p.validar ? p.validar(v) : true;
      if (ok !== true) return this.add('bot', esc(ok));
      return p.responder(v);
    }
    if (p?.casar) {
      const r = p.casar(v);
      if (r?.erro) return this.add('bot', r.erro);
      if (r) return p.responder(r.valor);
    }
    const it = this.entender(v);
    // se estava no meio de uma escolha e a frase não pede outra coisa, não perde o que já foi escolhido
    if (p && ['naoentendi', 'oi', 'obrigado'].includes(it.a)) {
      return this.add('bot', it.a === 'obrigado' ? 'Imagina! Escolha uma das opções acima para continuar.' : 'Não entendi muito bem. Escolha uma das opções acima, ou toque em <b>Início</b> para recomeçar.');
    }
    this.executar(it);
  },
  entender(t) {
    const n = semAcento(t), tem = re => re.test(n), sv = this.servicoCitado(n);
    if (tem(/cancel|desmarc|remarc|reagend|meus horario|meu horario|marquei|agendei|meu agendamento|minha hora/)) return { a: 'meus' };
    if (tem(/promo|desconto|oferta|cupom/)) return { a: 'promocoes' };
    if (tem(/plano|mensal|assinatura|assinar|mensalista/)) return { a: 'plano' };
    if (tem(/fidelidade|selo|carimbo|cartao fidel|pontos/)) return { a: 'fidelidade' };
    if (tem(/instalar|baixar o app|aplicativo/)) return { a: 'instalar' };
    if (tem(/que horas|abre|fecha|funciona|aberto|horario de funcionamento|expediente/)) return { a: 'info' };
    if (tem(/endereco|onde fica|onde voces|localiza|como cheg|mapa|fica onde|qual o local|qual a rua/)) return { a: 'info' };
    if (tem(/barbeiro|equipe|quem corta|profission|quem atende|cabeleireir|manicure|quem faz/)) return { a: 'equipe' };
    if (tem(/agend|marcar|marca um|horario|vaga|disponiv|livre|cortar|quero fazer|tem hora|encaixe|hoje|amanha/)) return { a: 'agendar', sv };
    if (sv) return { a: 'servico', sv };
    if (tem(/preco|valor|quanto|custa|servico|tabela|catalogo|cardapio/)) return { a: 'servicos' };
    if (tem(/produto|pomada|oleo|shampoo|condicionador|creme|esmalte|balm|comprar|vende|cerveja/)) return { a: 'produtos' };
    if (tem(/whats|zap|falar com|atendente|humano|ligar|telefone|contato|pessoa/)) return { a: 'whats' };
    if (tem(/\b(oi|ola|opa|eai|e ai|bom dia|boa tarde|boa noite|salve|fala|hey|hello)\b/)) return { a: 'oi' };
    if (tem(/obrigad|valeu|vlw|tmj|show|top|beleza|blz|perfeito|massa/)) return { a: 'obrigado' };
    return { a: 'naoentendi' };
  },
  executar({ a, sv }) {
    switch (a) {
      case 'agendar': return this.fluxoAgendar(sv ? { servicos: [sv] } : {});
      case 'servico': return this.fluxoUmServico(sv);
      case 'oi': return this.rodar(async () => { await this.bot('Olá! Tudo certo? Como posso te ajudar?'); this.menuWidget(); this.menuRapido(); });
      case 'obrigado': return this.rodar(async () => { await this.bot('Por nada! Qualquer coisa é só chamar.'); this.menuRapido(); });
      case 'naoentendi': return this.rodar(async () => { await this.bot('Hmm, não entendi muito bem. Posso te ajudar com uma destas opções:'); this.menuWidget(); this.menuRapido(); });
      default: return this.acao(a);
    }
  },
  // acha o serviço citado numa frase ("quero fazer a barba" → Barba completa)
  servicoCitado(n) {
    let melhor = null, nota = 0;
    for (const s of Agenda.servicos(this.b, { soOnline: true })) {
      const palavras = semAcento(s.nome).split(/[^a-z0-9]+/).filter(p => p.length >= 4);
      if (!palavras.length) continue;
      const tem = p => new RegExp(`\\b${p}`).test(n) || (p.length >= 6 && n.includes(p.slice(0, -1)));
      const acertos = palavras.filter(tem).length;
      if (!acertos) continue;
      const v = acertos / palavras.length + (tem(palavras[0]) ? 0.05 : 0);
      if (v > nota) { nota = v; melhor = s; }
    }
    return melhor;
  },

  /* ---------------- conversas ---------------- */
  inicio() {
    return this.rodar(async () => {
      const b = this.b, eu = this.lembrado();
      await this.bot(`Olá${eu ? `, <b>${esc(primeiroNome(eu.nome))}</b>` : ''}! Que bom te ver por aqui.`, { espera: 450 });
      if (b.boas_vindas) await this.bot(esc(b.boas_vindas));
      const prox = eu && Agenda.proximosDoCliente(b, eu.tel)[0];
      if (prox) await this.bot(`Você tem horário marcado <b>${Datas.relativa(prox.data)} às ${Datas.hhmm(prox.ini)}</b> com ${esc(primeiroNome(Store.get('barbeiros', prox.barbeiro_id)?.nome))}.`);
      await this.saudacaoExtras(eu);
      await this.bot('Sou o assistente de agendamento. Como posso te ajudar?');
      this.menuWidget();
      this.menuRapido();
    });
  },
  fluxoMenu() {
    return this.rodar(async () => { await this.bot('Como posso te ajudar?', { espera: 350 }); this.menuWidget(); this.menuRapido(); });
  },
  indisponivel(primeira = true) {
    const b = this.b;
    return this.rodar(async () => {
      if (primeira) await this.bot(`Olá! Este é o agendamento online de <b>${esc(b.nome)}</b>.`, { espera: 400 });
      await this.bot('No momento o agendamento online está pausado. Fale com a gente pelo WhatsApp que a gente te atende:');
      this.botaoWhats('Olá! Quero agendar um horário.');
      this.rapidas([]);
    });
  },

  fluxoAgendar(pre = {}) {
    return this.rodar(async () => {
      const b = this.b;
      if (!Agenda.servicos(b, { soOnline: true }).length) {
        await this.bot('Ainda não temos serviços para agendar online. Fale com a gente pelo WhatsApp:');
        return this.botaoWhats('Olá! Quero agendar um horário.');
      }
      const sel = { servicos: pre.servicos || null, barbeiro: pre.barbeiro, cliente: pre.cliente || null, remarcar: pre.remarcar || null, calendario: !!pre.calendario, data: null, ini: null };
      let etapa = !sel.servicos ? 'servicos' : sel.remarcar && sel.barbeiro !== undefined ? 'dia' : 'barbeiro';
      if (sel.calendario && !sel.servicos) await this.bot('Para te mostrar os horários certinhos, primeiro me diz o serviço.');
      if (pre.promo) {
        const crit = Promocoes.criterios(pre.promo);
        await this.bot(`Para valer a promoção <b>${esc(pre.promo.nome)}</b> (${esc(Promocoes.rotulo(pre.promo))})${crit.length ? `: ${esc(crit.join(', '))}` : ''}, ${esc(Promocoes.periodo(pre.promo))}. O desconto entra sozinho no resumo.`);
      }
      for (let voltas = 0; voltas < 60; voltas++) {
        if (etapa === 'servicos') {
          sel.servicos = await this.pServicos(sel.servicos);
          etapa = 'barbeiro';
        } else if (etapa === 'barbeiro') {
          const aptos = Agenda.barbeiros(b, sel.servicos.map(s => s.id));
          if (!aptos.length) {
            await this.bot('Ninguém da equipe faz todos esses serviços juntos. Vamos escolher de novo?');
            etapa = 'servicos'; sel.servicos = null; continue;
          }
          if (sel.barbeiro && !aptos.some(x => x.id === sel.barbeiro.id)) {
            await this.bot(`<b>${esc(primeiroNome(sel.barbeiro.nome))}</b> não faz ${sel.servicos.length > 1 ? 'todos esses serviços' : esc(sel.servicos[0].nome)}. Escolha quem vai te atender:`);
            sel.barbeiro = undefined;
          }
          if (sel.barbeiro === undefined) sel.barbeiro = await this.pBarbeiro(sel.servicos, aptos);
          etapa = 'dia';
        } else if (etapa === 'dia') {
          const r = await this.pDia(sel);
          if (r === 'barbeiro') { sel.barbeiro = undefined; etapa = 'barbeiro'; continue; }
          if (r === 'servicos') { etapa = 'servicos'; continue; }
          sel.data = r; etapa = 'hora';
        } else if (etapa === 'hora') {
          const r = await this.pHora(sel);
          if (r === 'dia') { etapa = 'dia'; continue; }
          sel.ini = r.ini; sel.barbeiroFinal = r.barbeiro;
          etapa = sel.cliente ? 'resumo' : 'quem';
        } else if (etapa === 'quem') {
          sel.cliente = await this.pQuem();
          etapa = 'resumo';
        } else if (etapa === 'resumo') {
          const r = await this.pResumo(sel);
          if (r === 'quem') { sel.cliente = null; etapa = 'quem'; continue; }
          if (r === 'barbeiro') { sel.barbeiro = undefined; etapa = 'barbeiro'; continue; }
          if (r !== 'ok') { etapa = r; continue; }
          let pg = null;
          try {
            let extras = {};
            if (sel.remarcar) extras = { total: sel.remarcar.total };
            else {
              pg = await this.pPagamento(sel); // preço final e, se for o caso, o pagamento pelo app
              if (pg === 'voltar') { pg = null; continue; }
              extras = { ...Orcamento.campos(pg.orc), ...(pg.pagamento ? { pagamento: pg.pagamento } : {}) };
            }
            const ag = await Agenda.agendar({
              b, barbeiroId: sel.barbeiro === null ? null : sel.barbeiroFinal.id, data: sel.data, ini: sel.ini, servicos: sel.servicos,
              nome: sel.cliente.nome, telefone: sel.cliente.tel, origem: 'cliente', id: sel.remarcar?.id || null, obs: sel.remarcar?.obs || '', extras
            });
            if (pg?.orc.credito) await Creditos.lancar(b, { tel: ag.cliente_tel, nome: ag.cliente_nome, valor: -pg.orc.credito, origem: 'uso', agendamento_id: ag.id });
            return this.sucesso(ag, !!sel.remarcar);
          } catch (err) {
            if (err === CANCELADO) throw err;
            await this.bot(esc(err.message));
            if (pg?.pagamento) {
              await Creditos.lancar(b, { tel: sel.cliente.tel, nome: sel.cliente.nome, valor: pg.pagamento.valor, origem: 'falha' });
              await this.bot(`O valor pago (${dinheiro(pg.pagamento.valor)}) ficou como <b>crédito</b> para você usar no horário que escolher agora.`);
            }
            etapa = 'hora';
          }
        }
      }
    });
  },

  async pServicos(pre) {
    const svs = Agenda.servicos(this.b, { soOnline: true });
    await this.bot(pre ? 'Quais serviços você quer?' : 'Qual serviço você quer fazer? Pode marcar mais de um.');
    const marcados = new Set((pre || []).map(s => s.id));
    const m = this.add('bot', `<div class="widget w-servicos">
      <div class="w-lista">${svs.map(s => `<button type="button" class="w-sv ${marcados.has(s.id) ? 'on' : ''}" data-a="w-toggle" data-id="${s.id}" aria-pressed="${marcados.has(s.id)}">
        <span class="w-sv-foto">${UI.capa(s)}</span>
        <span class="w-sv-txt"><b>${esc(s.nome)}</b><small>${esc(s.descricao || '')}</small>${this.seloPromo(s)}</span>
        <span class="w-sv-fim"><b>${dinheiro(s.preco)}</b><small>${duracaoTxt(s.duracao)}</small><span class="w-marca">${ic('check')}</span></span></button>`).join('')}</div>
      <div class="w-rodape">${this.op(0, 'Escolha um serviço', 'w-continuar')}</div></div>`, 'com-widget');
    const w = $('.widget', m);
    Object.assign(w, { _marcados: marcados, _svs: svs });
    this.atualizarContinuar(w);
    const escolhidos = () => svs.filter(s => w._marcados.has(s.id));
    return this.perguntar(w, {
      opcoes: [{ valor: () => escolhidos().length ? escolhidos() : undefined, eco: () => escolhidos().map(s => s.nome).join(' + ') }],
      casar: t => { const s = this.servicoCitado(semAcento(t)); return s ? { valor: [s] } : undefined; }
    });
  },
  toggleServico(el) {
    const w = el.closest('.widget');
    if (!w || w.classList.contains('respondido')) return;
    const id = el.dataset.id;
    w._marcados.has(id) ? w._marcados.delete(id) : w._marcados.add(id);
    el.classList.toggle('on', w._marcados.has(id));
    el.setAttribute('aria-pressed', w._marcados.has(id));
    this.atualizarContinuar(w);
  },
  atualizarContinuar(w) {
    const sel = w._svs.filter(s => w._marcados.has(s.id)), bt = $('.w-continuar', w);
    bt.disabled = !sel.length;
    bt.innerHTML = sel.length ? `Continuar · ${sel.length > 1 ? `${sel.length} serviços · ` : ''}${dinheiro(Agenda.total(sel))} · ${duracaoTxt(Agenda.duracao(sel))} ${ic('direita')}` : 'Escolha um serviço';
  },

  async pBarbeiro(svs, aptos) {
    if (aptos.length === 1) {
      await this.bot(`Quem vai te atender: <b>${esc(primeiroNome(aptos[0].nome))}</b>.`);
      return aptos[0];
    }
    await this.bot('Tem preferência de profissional?');
    const dur = Agenda.duracao(svs);
    const prox = aptos.map(x => Agenda.proximo(this.b, x, dur));
    const primeiro = prox.filter(Boolean).sort((p, q) => Datas.abs(p.data, p.ini) - Datas.abs(q.data, q.ini))[0];
    const txt = p => p ? `<em>${cap(Datas.relativa(p.data))}, ${Datas.hhmm(p.ini)}</em>próximo horário` : 'sem horários livres';
    const html = `<div class="widget"><div class="carrossel w-barbeiros">
      ${this.op(0, `<span class="avatar g">${ic('usuarios')}</span><b>Sem preferência</b><small>${txt(primeiro)}</small>`, 'qualquer')}
      ${aptos.map((x, i) => this.op(i + 1, `${UI.avatar(x.nome, x.foto, x.cor, 'g')}<b>${esc(primeiroNome(x.nome))}</b><small>${txt(prox[i])}</small>`)).join('')}
    </div></div>`;
    return this.widget(html, [{ valor: null, eco: 'Sem preferência' }, ...aptos.map(x => ({ valor: x, eco: primeiroNome(x.nome) }))], {
      casar: t => {
        const n = semAcento(t);
        if (/qualquer|tanto faz|sem pref|nenhum|indiferente|primeiro livre|o que tiver/.test(n)) return { valor: null };
        const x = aptos.find(o => n.includes(semAcento(primeiroNome(o.nome))));
        return x ? { valor: x } : undefined;
      }
    });
  },

  async pDia(sel) {
    const b = this.b, dur = Agenda.duracao(sel.servicos);
    const aptos = Agenda.barbeiros(b, sel.servicos.map(s => s.id));
    const lista = sel.barbeiro ? [sel.barbeiro] : aptos;
    const dias = Agenda.dias(b, lista, dur, { ignorar: sel.remarcar?.id });
    const com = sel.barbeiro ? ` com <b>${esc(primeiroNome(sel.barbeiro.nome))}</b>` : '';
    if (!dias.some(d => d.qtd)) {
      await this.bot(`Poxa, não achei horário livre nos próximos ${b.regras.dias_frente} dias${com}.`);
      const ops = [];
      if (sel.barbeiro && aptos.length > 1) ops.push({ valor: 'barbeiro', eco: 'Escolher outro profissional', rot: 'Outro profissional', icone: 'usuario' });
      ops.push({ valor: 'servicos', eco: 'Trocar o serviço', rot: 'Trocar o serviço', icone: 'tesoura' });
      this.botaoWhats('Olá! Não achei horário livre no agendamento online. Tem algum encaixe?');
      return this.widget(`<div class="widget w-botoes">${ops.map((o, i) => this.op(i, `${ic(o.icone)} ${o.rot}`)).join('')}</div>`, ops);
    }
    await this.bot(sel.remarcar ? 'Para qual dia você quer remarcar?' : sel.calendario ? `Estes são os dias com horário livre${com}. Toque no dia:` : `Qual dia fica bom pra você?${com ? ` Mostro só os dias livres${com}.` : ''}`);
    const ops = dias.map((d, i) => ({ valor: d.data, eco: i < 2 ? `${cap(Datas.relativa(d.data))}, ${Datas.brCurta(d.data)}` : cap(Datas.curta(d.data)) }));
    const extras = aptos.length > 1 ? [{ valor: 'barbeiro', eco: sel.barbeiro ? 'Trocar de profissional' : 'Escolher um profissional', rot: sel.barbeiro ? 'Trocar de profissional' : 'Escolher um profissional', icone: 'usuario' }] : [];
    const chips = dias.map((d, i) => this.op(i, `<small>${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS_CURTOS[Datas.dow(d.data)]}</small><b>${+d.data.slice(8)}</b><small>${MESES_CURTOS[+d.data.slice(5, 7) - 1]}</small><em>${d.qtd ? `${d.qtd} livre${d.qtd > 1 ? 's' : ''}` : d.fechado ? 'fechado' : 'sem vagas'}</em>`, 'w-dia', d.qtd ? '' : 'disabled')).join('');
    const m = this.add('bot', `<div class="widget w-dias"><div class="trilho">${chips}</div><div class="w-cal" hidden></div>
      <div class="w-extra"><button type="button" class="w-link" data-a="ver-cal">${ic('calendario')} Ver em calendário</button>${extras.map((x, k) => this.op(dias.length + k, `${ic(x.icone)} ${x.rot}`, 'w-link')).join('')}</div></div>`, 'com-widget');
    const w = $('.widget', m);
    w._dias = dias;
    if (sel.calendario) this.alternarCal(w);
    return this.perguntar(w, { opcoes: [...ops, ...extras], casar: t => this.casarDia(t, dias) });
  },
  alternarCal(w) {
    const cal = $('.w-cal', w), trilho = $('.trilho', w), bt = $('[data-a="ver-cal"]', w);
    const abrir = cal.hidden;
    cal.hidden = !abrir;
    trilho.hidden = abrir;
    bt.innerHTML = abrir ? `${ic('lista')} Ver em lista` : `${ic('calendario')} Ver em calendário`;
    if (abrir) { w._mes = w._mes || w._dias.find(d => d.qtd)?.data.slice(0, 7) || w._dias[0].data.slice(0, 7); this.desenharMes(w); }
    this.rolarPara(w.closest('.msg'));
  },
  desenharMes(w) {
    const ym = w._mes, dias = w._dias;
    const idx = Object.fromEntries(dias.map((d, i) => [d.data, i]));
    const minMes = dias[0].data.slice(0, 7), maxMes = dias[dias.length - 1].data.slice(0, 7);
    let cel = DIAS_CURTOS.map(d => `<span class="sem">${d}</span>`).join('');
    for (let i = 0; i < Datas.parse(ym + '-01').getDay(); i++) cel += '<span class="vazio-cel"></span>';
    for (let d = 1; d <= Datas.diasNoMes(ym); d++) {
      const i = idx[`${ym}-${pad(d)}`], info = dias[i];
      cel += i !== undefined && info.qtd
        ? this.op(i, `${d}<i></i>`, '', `title="${info.qtd} horários livres" aria-label="${d}: ${info.qtd} horários livres"`)
        : `<button type="button" class="w-op" disabled>${d}</button>`;
    }
    $('.w-cal', w).innerHTML = `<div class="w-mes-cab"><button type="button" class="btn-icone" data-a="cal-mes" data-d="-1" ${ym <= minMes ? 'disabled' : ''} aria-label="Mês anterior">${ic('esquerda')}</button><span>${cap(Datas.nomeMes(ym))}</span><button type="button" class="btn-icone" data-a="cal-mes" data-d="1" ${ym >= maxMes ? 'disabled' : ''} aria-label="Próximo mês">${ic('direita')}</button></div><div class="w-mes">${cel}</div>`;
  },
  casarDia(t, dias) {
    const n = semAcento(t), hoje = Datas.hoje();
    const semana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    let alvo = null;
    if (/depois de amanha/.test(n)) alvo = Datas.soma(hoje, 2);
    else if (/\bamanha\b/.test(n)) alvo = Datas.soma(hoje, 1);
    else if (/\bhoje\b/.test(n)) alvo = hoje;
    else {
      const dm = n.match(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\b/), so = n.match(/\bdia\s*(\d{1,2})\b/) || n.match(/^\s*(\d{1,2})\s*$/);
      const ds = semana.findIndex(s => n.includes(s));
      if (dm) alvo = dias.find(d => +d.data.slice(8) === +dm[1] && +d.data.slice(5, 7) === +dm[2])?.data || 'fora';
      else if (so) alvo = dias.find(d => +d.data.slice(8) === +so[1])?.data || 'fora';
      else if (ds >= 0) alvo = (dias.find(d => Datas.dow(d.data) === ds && d.qtd) || dias.find(d => Datas.dow(d.data) === ds))?.data;
    }
    if (!alvo) return undefined;
    const d = dias.find(x => x.data === alvo);
    if (!d) return { erro: `Consigo agendar até ${Datas.br(dias[dias.length - 1].data)}. Escolha um dos dias acima.` };
    if (!d.qtd) return { erro: `${cap(Datas.relativa(alvo))} (${Datas.brCurta(alvo)}) ${d.fechado ? 'não abrimos' : 'já está sem horários'}. Escolha outro dia acima.` };
    return { valor: alvo };
  },

  async pHora(sel) {
    const b = this.b, dur = Agenda.duracao(sel.servicos), data = sel.data, ignorar = sel.remarcar?.id;
    const slots = sel.barbeiro
      ? Agenda.horarios(b, sel.barbeiro, data, dur, { ignorar }).map(ini => ({ ini, barbeiro: sel.barbeiro }))
      : Agenda.horariosQualquer(b, Agenda.barbeiros(b, sel.servicos.map(s => s.id)), data, dur, { ignorar }).map(h => ({ ini: h.ini, barbeiro: Agenda.maisLivre(b, h.barbeiros, data) }));
    if (!slots.length) { await this.bot('Esse dia acabou de lotar. Vamos escolher outro?'); return 'dia'; }
    const rel = Datas.relativa(data);
    await this.bot(`Horários livres para <b>${rel}</b>${['hoje', 'amanhã'].includes(rel) ? ` (${Datas.brCurta(data)})` : ''}:`);
    const grupos = [['Manhã', s => s.ini < 720], ['Tarde', s => s.ini >= 720 && s.ini < 1080], ['Noite', s => s.ini >= 1080]];
    // horários em que alguma promoção vale (sem contar as que exigem pagamento antecipado, avisadas depois)
    const promoNo = ini => !sel.remarcar && sel.servicos.some(s => Store.de('promocoes', b.id).some(p => !p.criterios?.antecipado && Promocoes.vale(p, 'servicos', s.id, { data, ini, online: true, primeiraVisita: true, bruto: Infinity }) && (p.criterios?.dias?.length || p.criterios?.hora_ini != null || p.criterios?.hora_fim != null)));
    const comPromo = slots.some(s => promoNo(s.ini));
    const html = `<div class="widget w-horas">${grupos.map(([nome, f]) => {
      const g = slots.map((s, i) => [s, i]).filter(([s]) => f(s));
      return g.length ? `<h5>${nome}</h5><div class="w-horas-grade">${g.map(([s, i]) => this.op(i, Datas.hhmm(s.ini), `w-hora ${promoNo(s.ini) ? 'promo' : ''}`)).join('')}</div>` : '';
    }).join('')}${comPromo ? `<p class="w-legenda"><i></i> horário com promoção</p>` : ''}<div class="w-extra">${this.op(slots.length, `${ic('calendario')} Escolher outro dia`, 'w-link')}</div></div>`;
    return this.widget(html, [...slots.map(s => ({ valor: s, eco: Datas.hhmm(s.ini) })), { valor: 'dia', eco: 'Escolher outro dia' }], { casar: t => this.casarHora(t, slots) });
  },
  casarHora(t, slots) {
    const n = semAcento(t);
    if (/outro dia|outra data|mudar o dia|trocar o dia|outro horario/.test(n)) return { valor: 'dia' };
    const m = n.match(/(\d{1,2})\s*(?:(?:h|:)\s*(\d{2})?|horas?)?/);
    if (!m) return undefined;
    let h = +m[1];
    const mi = +(m[2] || 0);
    if (h < 8 && /tarde|noite/.test(n)) h += 12;
    if (h > 23 || mi > 59) return undefined;
    const alvo = h * 60 + mi, s = slots.find(x => x.ini === alvo);
    if (s) return { valor: s };
    const perto = [...slots].sort((p, q) => Math.abs(p.ini - alvo) - Math.abs(q.ini - alvo)).slice(0, 2).sort((p, q) => p.ini - q.ini);
    return { erro: `Às ${Datas.hhmm(alvo)} não tenho. Os mais próximos são ${perto.map(x => `<b>${Datas.hhmm(x.ini)}</b>`).join(' e ')}.` };
  },

  async pQuem() {
    const eu = this.lembrado();
    if (eu) {
      await this.bot(`Vou marcar no nome de <b>${esc(eu.nome)}</b>, WhatsApp ${esc(fmtTel(eu.tel))}. Pode ser?`);
      const sim = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('check')} Sim, sou eu`, 'pri')}${this.op(1, 'Usar outro nome')}</div>`,
        [{ valor: true, eco: 'Sim, sou eu' }, { valor: false, eco: 'Usar outro nome' }], { casar: simNao });
      if (sim) return eu;
    }
    await this.bot('Qual é o seu nome?');
    const nome = await this.texto({ placeholder: 'Seu nome', validar: v => v.replace(/[^a-zA-ZÀ-ÿ]/g, '').length >= 2 || 'Me diz o seu nome, por favor.' });
    await this.bot(`Prazer, <b>${esc(primeiroNome(nomeProprio(nome)))}</b>! Qual é o seu WhatsApp com DDD? É por ele que a gente fala com você.`);
    const tel = await this.texto({ placeholder: '(21) 99999-9999', tel: true, validar: v => this.validarTel(v) });
    return { nome: nomeProprio(nome), tel: this.normTel(tel) };
  },

  ticket({ data, ini, servicos, barbeiro, semPref, total, dur, cliente, linhas = [], tabela = null, pagamento = '' }) {
    const d = Datas.parse(data), rel = Datas.relativa(data);
    return `<div class="ticket">
      <div class="ticket-topo"><div class="ticket-data"><small>${MESES_CURTOS[d.getMonth()]}</small><b>${d.getDate()}</b></div>
        <div><b class="q">${cap(Datas.longa(data).split(',')[0])}${['hoje', 'amanhã'].includes(rel) ? ` (${rel})` : ''}</b><span>às <b style="color:#fff">${Datas.hhmm(ini)}</b> · ${duracaoTxt(dur)}</span></div></div>
      <div class="ticket-linhas">
        <div><span>${servicos.length > 1 ? 'Serviços' : 'Serviço'}</span><b>${servicos.map(s => esc(s.nome)).join('<br>')}</b></div>
        <div><span>Profissional</span><b>${esc(barbeiro?.nome || '')}${semPref ? '<br><small style="color:var(--c-muted);font-weight:500">primeiro livre</small>' : ''}</b></div>
        ${cliente ? `<div><span>Cliente</span><b>${esc(cliente.nome)}<br><small style="color:var(--c-muted);font-weight:500">${esc(fmtTel(cliente.tel))}</small></b></div>` : ''}
        ${this.b.endereco ? `<div><span>Local</span><b>${esc(this.b.endereco)}</b></div>` : ''}
        ${linhas.length && tabela != null ? `<div><span>Valor</span><b>${dinheiro(tabela)}</b></div>` : ''}
        ${linhas.map(l => `<div class="desc"><span>${esc(l.rot)}</span><b>${dinheiro(l.valor)}</b></div>`).join('')}
        ${pagamento ? `<div><span>Pagamento</span><b>${pagamento}</b></div>` : ''}
        <div class="tot"><span>Total</span><b>${dinheiro(total)}</b></div>
      </div></div>`;
  },
  async pResumo(sel) {
    const dur = Agenda.duracao(sel.servicos);
    await this.bot(sel.remarcar ? 'Confere a remarcação:' : 'Confere se está tudo certo:');
    const conf = sel.remarcar ? 'Confirmar remarcação' : 'Confirmar agendamento';
    const orc = sel.remarcar ? null : this.orcamento(sel);
    const r = await this.widget(`<div class="widget">${this.ticket({ data: sel.data, ini: sel.ini, servicos: sel.servicos, barbeiro: sel.barbeiroFinal, semPref: sel.barbeiro === null,
        total: orc ? orc.total : sel.remarcar.total, dur, cliente: sel.cliente, linhas: orc ? Orcamento.linhas(orc) : [], tabela: orc?.tabela })}
      <div class="w-botoes" style="margin-top:10px">${this.op(0, `${ic('check')} ${conf}`, 'pri')}${this.op(1, `${ic('lapis')} Alterar`)}</div></div>`,
      [{ valor: 'ok', eco: conf }, { valor: 'alterar', eco: 'Quero alterar' }],
      { casar: t => { const v = simNao(t); return v ? { valor: v.valor ? 'ok' : 'alterar' } : undefined; } });
    if (r === 'ok') return 'ok';
    await this.bot('O que você quer mudar?');
    const ops = [['servicos', 'Serviço', 'tesoura'], ['barbeiro', 'Profissional', 'usuario'], ['dia', 'Dia e horário', 'calendario'], ['hora', 'Só o horário', 'relogio'], ['quem', 'Nome ou WhatsApp', 'telefone']]
      .filter(o => o[0] !== 'barbeiro' || Agenda.barbeiros(this.b, sel.servicos.map(s => s.id)).length > 1);
    return this.widget(`<div class="widget w-botoes">${ops.map((o, i) => this.op(i, `${ic(o[2])} ${o[1]}`)).join('')}</div>`, ops.map(o => ({ valor: o[0], eco: o[1] })));
  },
  async sucesso(ag, remarcou) {
    const b = this.b, x = Store.get('barbeiros', ag.barbeiro_id);
    this.lembrar({ nome: ag.cliente_nome, tel: ag.cliente_tel });
    await this.bot(remarcou ? `Pronto, <b>${esc(primeiroNome(ag.cliente_nome))}</b>! Seu horário foi <b>remarcado</b>.` : `Prontinho, <b>${esc(primeiroNome(ag.cliente_nome))}</b>! Seu horário está <b>confirmado</b>.`);
    this.add('bot', `<div class="widget">${this.ticket({ data: ag.data, ini: ag.ini, servicos: ag.servicos, barbeiro: x, total: ag.total, dur: ag.fim - ag.ini, cliente: { nome: ag.cliente_nome, tel: ag.cliente_tel }, ...this.detalheAg(ag) })}
      <div class="ticket-acoes" style="padding:10px 0 0"><button type="button" class="btn-chat pri" data-a="ics" data-id="${ag.id}">${ic('calendario-ok')} Pôr na agenda</button>
      <a class="btn-chat" href="${esc(UI.mapa(b))}" target="_blank" rel="noopener">${ic('pin')} Como chegar</a></div></div>`, 'com-widget');
    await this.posAgendamento(ag);
    const h = b.regras.cancelar_ate;
    await this.bot(`Se precisar cancelar ou remarcar, é só tocar em <b>Meus horários</b>${h ? ` (até ${h}h antes)` : ''}. Te esperamos!`);
    this.menuRapido(['meus', 'produtos', PWA.instalado() ? null : 'instalar'].filter(Boolean));
  },
  baixarIcs(id) {
    const ag = Store.get('agendamentos', id);
    if (ag) UI.baixar(`horario-${this.b.slug}-${ag.data}.ics`, UI.ics(ag, this.b, Store.get('barbeiros', ag.barbeiro_id)), 'text/calendar;charset=utf-8');
  },

  fluxoMeus() {
    return this.rodar(async () => {
      const b = this.b;
      let eu = this.lembrado();
      if (!eu) {
        await this.bot('Me passa o seu WhatsApp com DDD que eu procuro seus horários.');
        const tel = this.normTel(await this.texto({ placeholder: '(21) 99999-9999', tel: true, validar: v => this.validarTel(v) }));
        const c = Store.de('clientes', b.id).find(x => x.telefone === tel), algum = Store.de('agendamentos', b.id).find(a => a.cliente_tel === tel);
        eu = { nome: c?.nome || algum?.cliente_nome || '', tel };
        if (eu.nome) this.lembrar(eu);
      }
      const prox = Agenda.proximosDoCliente(b, eu.tel);
      if (!prox.length) {
        await this.bot(`Não encontrei nenhum horário marcado${eu.nome ? ` para <b>${esc(primeiroNome(eu.nome))}</b>` : ' com esse número'}.`);
        const ult = Agenda.ultimoDoCliente(b, eu.tel);
        const cliente = eu.nome ? eu : null;
        if (!ult) { await this.bot('Quer marcar um agora?', { espera: 300 }); return this.menuRapido(['agendar']); }
        const x = Store.get('barbeiros', ult.barbeiro_id);
        await this.bot(`Seu último atendimento foi em ${Datas.br(ult.data)}: <b>${esc(ult.servicos.map(s => s.nome).join(' + '))}</b> com ${esc(primeiroNome(x?.nome))}. Quer marcar o mesmo de novo?`);
        const r = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('atualizar')} Repetir agendamento`, 'pri')}${this.op(1, 'Escolher outro serviço')}</div>`,
          [{ valor: true, eco: 'Repetir agendamento' }, { valor: false, eco: 'Escolher outro serviço' }], { casar: simNao });
        const svs = ult.servicos.map(s => Store.get('servicos', s.id)).filter(s => s && s.ativo !== false && s.online !== false);
        return this.fluxoAgendar(r && svs.length ? { servicos: svs, barbeiro: x && x.ativo !== false ? x : undefined, cliente } : { cliente });
      }
      await this.bot(prox.length > 1 ? `Você tem <b>${prox.length} horários</b> marcados:` : 'Achei o seu horário:');
      const ops = [];
      let html = '<div class="widget">';
      for (const a of prox.slice(0, 5)) {
        const x = Store.get('barbeiros', a.barbeiro_id), d = Datas.parse(a.data);
        html += `<div class="meu-ag"><div class="meu-ag-topo"><div class="ticket-data"><small>${MESES_CURTOS[d.getMonth()]}</small><b>${d.getDate()}</b></div>
          <div><b>${cap(Datas.longa(a.data).split(',')[0])} às ${Datas.hhmm(a.ini)}</b><small>${esc(a.servicos.map(s => s.nome).join(' + '))} · ${esc(primeiroNome(x?.nome))} · ${a.mensalista_id && !a.total ? 'pelo plano' : dinheiro(a.total)}${a.pagamento?.status === 'pago' ? ' · pago pelo app' : ''}</small></div></div>
          <div class="w-botoes">${this.op(ops.length, `${ic('calendario')} Remarcar`)}${this.op(ops.length + 1, `${ic('x')} Cancelar`, 'perigo')}</div></div>`;
        ops.push({ valor: { acao: 'remarcar', a }, eco: `Remarcar o de ${Datas.curta(a.data)}` }, { valor: { acao: 'cancelar', a }, eco: `Cancelar o de ${Datas.curta(a.data)}` });
      }
      this.menuRapido(['agendar']);
      const r = await this.widget(html + '</div>', ops);
      return r.acao === 'cancelar' ? this.cancelar(r.a) : this.remarcar(r.a);
    });
  },
  podeMexer(a) { return Datas.abs(a.data, a.ini) - Datas.agoraAbs() >= (this.b.regras.cancelar_ate || 0) * 60; },
  async semPrazo(a, oque) {
    await this.bot(`Pelo chat dá para ${oque} até <b>${this.b.regras.cancelar_ate}h antes</b>. Como falta pouco, fala com a gente pelo WhatsApp:`);
    this.botaoWhats(`Olá! Preciso ${oque} meu horário de ${Datas.curta(a.data)} às ${Datas.hhmm(a.ini)}.`);
    this.menuRapido();
  },
  async cancelar(a) {
    if (!this.podeMexer(a)) return this.semPrazo(a, 'cancelar');
    const pago = a.pagamento?.status === 'pago', pol = Pagamentos.config(this.b).cancelamento;
    await this.bot(`Quer mesmo cancelar o horário de <b>${Datas.relativa(a.data)} às ${Datas.hhmm(a.ini)}</b>?${pago ? ` Você pagou ${dinheiro(a.pagamento.valor)} pelo app: ${pol === 'devolucao' ? 'o valor será devolvido' : 'o valor vira <b>crédito</b> para o próximo agendamento'}.` : ''}`);
    const sim = await this.widget(`<div class="widget w-botoes">${this.op(0, 'Sim, cancelar', 'perigo')}${this.op(1, 'Não, manter', 'pri')}</div>`,
      [{ valor: true, eco: 'Sim, cancelar' }, { valor: false, eco: 'Não, manter' }], { casar: simNao });
    if (!sim) { await this.bot('Beleza, seu horário continua marcado.'); return this.menuRapido(); }
    const atual = Store.get('agendamentos', a.id);
    if (!atual || atual.status !== 'confirmado') { await this.bot('Esse horário já não estava mais ativo.'); return this.menuRapido(); }
    const patch = { id: a.id, status: 'cancelado', cancelado_por: 'cliente', cancelado_em: new Date().toISOString() };
    if (pago) {
      patch.pagamento = { ...atual.pagamento, status: pol === 'devolucao' ? 'devolvido' : 'credito' };
      if (pol !== 'devolucao') await Creditos.lancar(this.b, { tel: a.cliente_tel, nome: a.cliente_nome, valor: a.pagamento.valor, origem: 'cancelamento', agendamento_id: a.id });
    }
    await Creditos.desfazerUso(this.b, a.id);
    await Store.salvar('agendamentos', patch);
    const saldo = Creditos.saldo(this.b, a.cliente_tel);
    await this.bot(`Pronto, cancelado.${saldo > 0 ? ` Você tem <b>${dinheiro(saldo)} de crédito</b> aqui, que entra sozinho no próximo agendamento.` : pago && pol === 'devolucao' ? ' O valor pago será devolvido.' : ''} Quer marcar outro horário?`);
    this.menuRapido(['agendar']);
  },
  remarcar(a) {
    if (!this.podeMexer(a)) return this.semPrazo(a, 'remarcar');
    const regra = a.mensalista_id ? Mensal.plano(Store.get('mensalistas', a.mensalista_id))?.regras?.max_remarcacoes : null;
    if (regra != null && (a.remarcacoes || 0) >= regra) {
      return this.rodar(async () => {
        await this.bot(regra === 0 ? 'Pelo seu plano, os horários não podem ser remarcados pelo chat.' : `Pelo seu plano, cada horário pode ser remarcado ${regra === 1 ? 'uma vez' : `${regra} vezes`}, e esse já foi. Fala com a gente pelo WhatsApp:`);
        this.botaoWhats(`Olá! Preciso remarcar meu horário de ${Datas.curta(a.data)} às ${Datas.hhmm(a.ini)}.`);
        this.menuRapido(['meus']);
      });
    }
    const svs = a.servicos.map(s => Store.get('servicos', s.id) || s);
    const x = Store.get('barbeiros', a.barbeiro_id);
    return this.fluxoAgendar({ servicos: svs, barbeiro: x && x.ativo !== false ? x : undefined, remarcar: a, cliente: { nome: a.cliente_nome, tel: a.cliente_tel } });
  },

  cardServico(s) {
    return `<div class="cc"><div class="cc-foto">${UI.capa(s)}</div><div class="cc-txt"><b>${esc(s.nome)}</b><p>${esc(s.descricao || '')}</p>
      ${this.seloPromo(s)}<div class="cc-preco"><b>${dinheiro(s.preco)}</b><small>${ic('relogio')} ${duracaoTxt(s.duracao)}</small></div></div>
      <button type="button" class="cc-btn" data-a="agendar-sv" data-id="${s.id}">${ic('calendario-mais')} Agendar</button></div>`;
  },
  cardProduto(p) {
    const esgotado = p.estoque != null && p.estoque <= 0, pr = Promocoes.precoProduto(this.b, p);
    return `<div class="cc"><div class="cc-foto">${UI.capa(p, 'produto')}</div><div class="cc-txt"><b>${esc(p.nome)}</b><p>${esc(p.descricao || '')}</p>
      ${pr.promo ? `<em class="w-sv-promo">${ic('brilho')} ${esc(pr.promo.nome)}</em>` : ''}
      <div class="cc-preco"><b>${pr.promo ? `<s class="riscado">${dinheiro(pr.original)}</s> ` : ''}${dinheiro(pr.preco)}</b>${esgotado ? '<small>Esgotado</small>' : ''}</div></div>
      <button type="button" class="cc-btn" data-a="quero-pd" data-id="${p.id}" ${esgotado ? 'disabled style="opacity:.4"' : ''}>${ic('sacola')} Quero este</button></div>`;
  },
  fluxoServicos() {
    return this.rodar(async () => {
      const svs = Agenda.servicos(this.b, { soOnline: true });
      await this.bot('Esses são os nossos serviços. Arraste para o lado para ver todos:');
      this.add('bot', `<div class="widget"><div class="carrossel">${svs.map(s => this.cardServico(s)).join('')}</div></div>`, 'com-widget');
      await this.bot('Gostou de algum? Toque em <b>Agendar</b> no card.', { espera: 500 });
      this.menuRapido(['agendar', 'produtos']);
    });
  },
  fluxoUmServico(sv) {
    return this.rodar(async () => {
      await this.bot(`O <b>${esc(sv.nome)}</b> sai por <b>${dinheiro(sv.preco)}</b> e leva ${duracaoTxt(sv.duracao)}.`);
      this.add('bot', `<div class="widget"><div class="carrossel">${this.cardServico(sv)}</div></div>`, 'com-widget');
      this.menuRapido(['servicos', 'agendar']);
    });
  },
  fluxoProdutos() {
    return this.rodar(async () => {
      const pds = Agenda.produtos(this.b);
      if (!pds.length) { await this.bot('Ainda não temos produtos no catálogo online.'); return this.menuRapido(); }
      await this.bot('Esses são os produtos que vendemos aqui:');
      this.add('bot', `<div class="widget"><div class="carrossel">${pds.map(p => this.cardProduto(p)).join('')}</div></div>`, 'com-widget');
      await this.bot('Toque em <b>Quero este</b> que a gente separa pra você no dia do seu horário.', { espera: 500 });
      this.menuRapido(['agendar', 'meus']);
    });
  },
  querProduto(id) {
    const p = Store.get('produtos', id);
    if (!p) return;
    this.eu(`Quero: ${p.nome}`);
    return this.rodar(async () => {
      const eu = this.lembrado(), prox = eu ? Agenda.proximosDoCliente(this.b, eu.tel)[0] : null;
      const pr = Promocoes.precoProduto(this.b, p, { data: prox?.data });
      const preco = `${dinheiro(pr.preco)}${pr.promo ? ` com a promoção ${esc(pr.promo.nome)}` : ''}`;
      if (!prox) {
        await this.bot(`O <b>${esc(p.nome)}</b> sai por <b>${preco}</b> e você compra aqui no dia do atendimento. Se marcar um horário, depois é só pedir aqui que a gente deixa separado.`);
        return this.menuRapido(['agendar', 'whats']);
      }
      await this.bot(`Quer que a gente separe <b>${esc(p.nome)}</b> (${preco}) para o seu horário de <b>${Datas.relativa(prox.data)} às ${Datas.hhmm(prox.ini)}</b>? Você paga lá na hora.`);
      const sim = await this.widget(`<div class="widget w-botoes">${this.op(0, `${ic('check')} Sim, separar`, 'pri')}${this.op(1, 'Não, obrigado')}</div>`,
        [{ valor: true, eco: 'Sim, separar' }, { valor: false, eco: 'Não, obrigado' }], { casar: simNao });
      if (!sim) { await this.bot('Tranquilo!'); return this.menuRapido(); }
      const atual = Store.get('agendamentos', prox.id), res = copia(atual.reservas || []), ja = res.find(x => x.id === p.id);
      if (ja) ja.qtd++; else res.push({ id: p.id, nome: p.nome, preco: pr.preco, qtd: 1 });
      await Store.salvar('agendamentos', { id: prox.id, reservas: res });
      await this.bot('Fechado! Vai estar separado te esperando.');
      this.menuRapido(['produtos', 'meus']);
    });
  },
  fluxoEquipe() {
    return this.rodar(async () => {
      const b = this.b, svs = Agenda.servicos(b, { soOnline: true });
      await this.bot('Esse é o nosso time:');
      this.add('bot', `<div class="widget"><div class="carrossel">${Agenda.barbeiros(b).map(x => `<div class="cc" style="align-items:center;text-align:center;padding:16px 12px 0">
        ${UI.avatar(x.nome, x.foto, x.cor, 'gg')}<div class="cc-txt" style="align-items:center"><b>${esc(x.nome)}</b><p>${!x.servicos?.length ? 'Faz todos os serviços' : esc(svs.filter(s => x.servicos.includes(s.id)).map(s => s.nome).slice(0, 4).join(', '))}</p></div>
        <button type="button" class="cc-btn" style="width:calc(100% - 0px);margin:0 0 12px" data-a="agendar-com" data-id="${x.id}">${ic('calendario-mais')} Agendar</button></div>`).join('')}</div></div>`, 'com-widget');
      this.menuRapido(['agendar']);
    });
  },
  fluxoInfo() {
    return this.rodar(async () => {
      const b = this.b, hoje = Datas.dow(Datas.hoje());
      await this.bot(b.endereco ? `Estamos em <b>${esc(b.endereco)}</b>.` : 'Ainda não cadastramos o endereço por aqui.');
      const linhas = [1, 2, 3, 4, 5, 6, 0].map(d => {
        const iv = b.horario[d] || [];
        return `<span class="${d === hoje ? 'hoje' : ''}">${cap(DIAS[d])}</span><span class="${d === hoje ? 'hoje' : ''}">${iv.length ? iv.map(([i, f]) => `${i} às ${f}`).join(' · ') : 'Fechado'}</span>`;
      }).join('');
      this.add('bot', `<div class="widget"><div class="w-info">
        <div class="w-info-linha">${ic('relogio')}<div class="w-horario">${linhas}</div></div>
        ${b.instagram ? `<div class="w-info-linha">${ic('camera')}<a href="https://instagram.com/${encodeURIComponent(b.instagram)}" target="_blank" rel="noopener" style="color:inherit">@${esc(b.instagram)}</a></div>` : ''}
        <div class="ticket-acoes" style="padding:4px 0 0"><a class="btn-chat pri" href="${esc(UI.mapa(b))}" target="_blank" rel="noopener">${ic('pin')} Abrir no mapa</a>${b.whatsapp ? `<a class="btn-chat verde" href="${linkWhats(b.whatsapp, 'Olá!')}" target="_blank" rel="noopener">${ic('mensagem')} WhatsApp</a>` : ''}</div>
      </div></div>`, 'com-widget');
      this.menuRapido(['agendar', 'servicos']);
    });
  },
  fluxoWhats() {
    return this.rodar(async () => {
      if (!this.b.whatsapp) { await this.bot('Ainda não temos WhatsApp cadastrado. Mas dá para agendar direto por aqui!'); return this.menuRapido(['agendar']); }
      await this.bot('Pode falar com a gente no WhatsApp:');
      this.botaoWhats('Olá! Vim pelo agendamento online.');
      this.menuRapido(['agendar']);
    });
  },

  /* ---------------- catálogo em tela cheia ---------------- */
  abrirCatalogo(aba = 'servicos') {
    this.fecharFolha();
    const b = this.b, fundo = document.createElement('div');
    fundo.className = 'folha-fundo';
    fundo.innerHTML = `<div class="folha" role="dialog" aria-modal="true" aria-label="Catálogo"><div class="folha-cab"><div class="folha-puxador"></div>
      <div class="folha-cab-l"><h3>${esc(b.nome)}</h3><button type="button" class="btn-icone" data-fechar aria-label="Fechar">${ic('x')}</button></div>
      <div class="folha-abas">${[['servicos', 'Serviços'], ['produtos', 'Produtos'], ['equipe', 'Equipe']].map(([k, t]) => `<button type="button" data-aba="${k}">${t}</button>`).join('')}</div></div>
      <div class="folha-corpo"></div></div>`;
    document.body.appendChild(fundo);
    requestAnimationFrame(() => fundo.classList.add('aberto'));
    const desenhar = a => {
      $$('[data-aba]', fundo).forEach(x => x.classList.toggle('on', x.dataset.aba === a));
      const corpo = $('.folha-corpo', fundo);
      if (a === 'servicos') corpo.innerHTML = `<div class="folha-grade">${Agenda.servicos(b, { soOnline: true }).map(s => this.cardServico(s)).join('')}</div>`;
      else if (a === 'produtos') { const p = Agenda.produtos(b); corpo.innerHTML = p.length ? `<div class="folha-grade">${p.map(x => this.cardProduto(x)).join('')}</div>` : '<p style="color:var(--c-muted)">Nenhum produto cadastrado.</p>'; }
      else corpo.innerHTML = `<div class="folha-equipe">${Agenda.barbeiros(b).map(x => `<div class="folha-membro">${UI.avatar(x.nome, x.foto, x.cor, 'g')}<div><b>${esc(x.nome)}</b><small>${!x.servicos?.length ? 'Faz todos os serviços' : `${x.servicos.length} serviços`}</small></div><button type="button" class="cc-btn" style="margin:0" data-a="agendar-com" data-id="${x.id}">Agendar</button></div>`).join('')}</div>`;
      corpo.scrollTop = 0;
    };
    fundo.onclick = e => {
      if (e.target === fundo || e.target.closest('[data-fechar]')) return this.fecharFolha();
      const ab = e.target.closest('[data-aba]');
      if (ab) return desenhar(ab.dataset.aba);
      if (e.target.closest('[data-a]')) this.clique(e);
    };
    fundo._tecla = e => { if (e.key === 'Escape') this.fecharFolha(); };
    document.addEventListener('keydown', fundo._tecla);
    desenhar(aba);
  },
  fecharFolha() {
    const f = $('.folha-fundo:not(.saindo)');
    if (!f) return;
    f.classList.add('saindo');
    f.classList.remove('aberto');
    document.removeEventListener('keydown', f._tecla);
    setTimeout(() => f.remove(), 220);
  }
};
