'use strict';
/* ============================================================
   BSFlow oficial — telas do site (início, contratação, entrar, termos)
   e o que muda no painel quando ele está ligado no servidor.
   Também o guia "Como usar" e os primeiros passos de quem acabou de contratar.
   ============================================================ */

/* ---------------- guia de uso (painel → Como usar, e no login) ---------------- */
const AJUDA = [
  { id: 'primeiro', icone: 'casa', titulo: 'Primeiro acesso', passos: [
    'Entre com o <b>e-mail e a senha</b> que você criou na contratação.',
    'Na agenda aparece o cartão <b>Primeiros passos</b>: siga um item de cada vez, leva uns 15 minutos.',
    'Pronto o básico, faça um agendamento de teste pelo seu link e veja ele chegar na agenda na hora.',
    'Seu teste grátis dura 14 dias, com tudo liberado. A primeira mensalidade só vence depois dele.'] },
  { id: 'dados', icone: 'ajustes', titulo: 'Dados, logo e horário de funcionamento', passos: [
    'Abra <b>Ajustes</b>. Confira nome, WhatsApp e endereço: é o que o cliente vê no chat.',
    'Escolha a logo e a cor da marca. A cor aparece no chat e no app do cliente.',
    'Em <b>Horário de funcionamento</b>, marque os dias e as faixas de atendimento (dá para ter intervalo de almoço).',
    'Em <b>Regras do agendamento online</b>, defina de quanto em quanto tempo saem os horários, a antecedência mínima e até quando o cliente pode cancelar.',
    'Toque em <b>Salvar ajustes</b>.'] },
  { id: 'catalogo', icone: 'tesoura', titulo: 'Serviços e produtos', passos: [
    'Abra <b>Catálogo</b>. Já deixamos alguns serviços prontos: ajuste nome, preço e duração de cada um.',
    'Coloque uma foto e uma descrição curta: ajuda o cliente a escolher.',
    'Serviço que você não quer no agendamento online: desmarque "Aparece no agendamento online".',
    'Na aba <b>Produtos</b>, cadastre o que você vende (pomada, shampoo...) com preço e, se quiser, o estoque.'] },
  { id: 'equipe', icone: 'usuario', titulo: 'Equipe e acesso dos profissionais', passos: [
    'Abra <b>Equipe</b> e cadastre quem atende, com os serviços que cada um faz e a comissão.',
    'Quem tem horário diferente do estabelecimento: marque "Tem horário próprio".',
    'Para o profissional entrar no painel, crie uma <b>senha de acesso</b> no cadastro dele. Ele entra escolhendo o próprio nome na tela de login e vê só a agenda e os ganhos dele.',
    'O número de profissionais depende do seu plano.'] },
  { id: 'agenda', icone: 'calendario', titulo: 'Agenda do dia a dia', passos: [
    'Os horários marcados pelo chat entram sozinhos na agenda, com aviso na tela (e no celular, com o app instalado).',
    'Para marcar alguém que ligou ou chegou: toque num horário livre da grade ou em <b>Agendar</b>.',
    '<b>Bloquear</b> fecha um horário (almoço, folga, compromisso). <b>Sem agendamento</b> lança quem chegou sem marcar.',
    'Toque num agendamento para concluir (com a forma de pagamento), marcar falta, remarcar ou cancelar.',
    'No fim do dia, use <b>Fechar o dia</b>: confira o que foi feito e o faturamento fica certinho.'] },
  { id: 'link', icone: 'compartilhar', titulo: 'Seu link de agendamento', passos: [
    'Em <b>Ajustes</b>, no topo, está o seu link. Toque em <b>Copiar</b>.',
    'Coloque na bio do Instagram, no status e na mensagem automática do WhatsApp e no Google Meu Negócio.',
    'O cliente abre o link, conversa com o assistente e escolhe serviço, profissional, dia e horário. Sem baixar nada.',
    'Ele pode remarcar ou cancelar pelo mesmo link, dentro do prazo que você definiu.'] },
  { id: 'clientes', icone: 'usuarios', titulo: 'Clientes, promoções, fidelidade e mensalistas', passos: [
    '<b>Clientes</b> reúne todo mundo que já agendou, com histórico e quanto gastou.',
    '<b>Promoções</b>: desconto com prazo, dias e horários. O chat divulga sozinho e o preço já sai com desconto.',
    '<b>Fidelidade</b> (em Clientes): "a cada 10 cortes, o 10º com desconto". A contagem é automática.',
    '<b>Mensalistas</b>: planos mensais para os clientes, com os atendimentos do mês e a cobrança de cada mês.',
    'Esses recursos dependem do plano: no teste grátis estão todos liberados para você experimentar.'] },
  { id: 'mensagens', icone: 'mensagem', titulo: 'Mensagens no WhatsApp', passos: [
    'Em <b>Mensagens</b> o sistema prepara a confirmação, os lembretes do horário e as cobranças dos mensalistas.',
    'Por enquanto o envio é com um toque: abra a mensagem e toque no botão verde, que ela vai pronta pelo seu WhatsApp.',
    'O envio totalmente automático, pelo número do estabelecimento, chega numa próxima atualização.'] },
  { id: 'app', icone: 'baixar', titulo: 'App no celular', passos: [
    'No celular, abra o painel pelo navegador e toque em <b>Mais → Instalar o app no celular</b> (no iPhone: Compartilhar → Adicionar à Tela de Início).',
    'Depois, toque em <b>Ativar notificações</b> para ser avisado de cada agendamento novo.',
    'O chat do cliente também pode ser instalado: ele fica com o nome e a cor do seu estabelecimento.'] },
  { id: 'assinatura', icone: 'recibo', titulo: 'Assinatura e pagamento do BSFlow', passos: [
    'Em <b>Ajustes → Assinatura</b> você vê o plano, o valor e as mensalidades.',
    'A cobrança chega por e-mail e fica também ali, com o botão <b>Pagar</b>: boleto, PIX ou cartão, você escolhe.',
    'Se uma mensalidade atrasar além da tolerância, o painel e o agendamento online pausam até o pagamento ser confirmado (é automático).',
    'Quer mudar de plano? Toque em <b>Comparar planos</b> e fale com a gente.'] }
];

const Ajuda = {
  html(abertos = []) {
    return `<div class="ajuda-lista">${AJUDA.map(s => `<details class="ajuda-item" ${abertos.includes(s.id) ? 'open' : ''}>
      <summary>${ic(s.icone)}<span>${esc(s.titulo)}</span>${ic('baixo')}</summary>
      <ol>${s.passos.map(p => `<li>${p}</li>`).join('')}</ol></details>`).join('')}</div>`;
  },
  abrir(abertos = ['primeiro']) {
    UI.modal({ titulo: 'Como usar o BSFlow', classe: 'largo', corpo: this.html(abertos) });
  }
};

/* ---------------- primeiros passos (cartão na agenda do dono) ---------------- */
const PASSOS = [
  { id: 'dados', icone: 'ajustes', titulo: 'Confira os dados, a logo e o horário de funcionamento', aba: 'ajustes' },
  { id: 'servicos', icone: 'tesoura', titulo: 'Ajuste os serviços e preços (já deixamos alguns prontos)', aba: 'catalogo' },
  { id: 'equipe', icone: 'usuario', titulo: 'Confira quem atende e o horário de cada um', aba: 'equipe' },
  { id: 'teste', icone: 'calendario', titulo: 'Faça um agendamento de teste pelo seu link', link: true },
  { id: 'divulgar', icone: 'compartilhar', titulo: 'Divulgue o link no Instagram e no WhatsApp', acao: 'passo-divulgar' },
  { id: 'app', icone: 'baixar', titulo: 'Instale o painel no celular e ligue as notificações', acao: 'instalar-app' }
];
const Passos = {
  feito(b, id) {
    const p = b.passos || {};
    if (p[id]) return true;
    const depois = r => r.atualizado_em || (r.criado_em && b.criado_em && r.criado_em.slice(0, 16) > b.criado_em.slice(0, 16));
    if (id === 'servicos') return Store.de('servicos', b.id).some(depois);
    if (id === 'equipe') return Store.de('barbeiros', b.id).some(depois);
    if (id === 'teste') return Store.de('agendamentos', b.id).some(a => a.origem === 'cliente');
    if (id === 'app') return PWA.instalado();
    return false;
  },
  async marcar(b, id, valor = true) {
    await Store.salvar('barbearias', { id: b.id, passos: { ...(b.passos || {}), [id]: valor } });
  },
  cartao(painel) {
    const b = painel.b;
    if (!Nuvem.ativo || !painel.eDono() || b.passos?.oculto) return '';
    const feitos = PASSOS.filter(p => this.feito(b, p.id)).length;
    if (feitos === PASSOS.length) return '';
    return `<div class="card passos-card">
      <div class="card-cab"><div><h3>${ic('brilho')} Primeiros passos</h3><p>${feitos} de ${PASSOS.length} feitos · deixe tudo pronto para receber os primeiros agendamentos</p></div>
        <div class="acoes"><button class="btn peq" data-a="ver-ajuda">${ic('info')} Como usar</button><button class="btn peq fantasma" data-a="passos-ocultar" title="Esconder">${ic('x')}</button></div></div>
      <div class="parte-trilho" style="margin-bottom:12px"><div style="width:${Math.round(feitos / PASSOS.length * 100)}%"></div></div>
      <div class="passos-lista">${PASSOS.map((p, i) => {
        const ok = this.feito(b, p.id);
        const ir = p.aba ? `<a class="btn peq" href="${painel.h(p.aba)}">Abrir</a>`
          : p.link ? `<a class="btn peq" href="#/${esc(b.slug)}" target="_blank">${ic('externo')} Abrir meu link</a>`
          : `<button class="btn peq" data-a="${p.acao}">${p.id === 'divulgar' ? `${ic('copiar')} Copiar link` : `${ic('baixar')} Instalar`}</button>`;
        return `<div class="passo ${ok ? 'ok' : ''}">
          <span class="passo-n">${ok ? ic('check') : i + 1}</span>
          <span class="passo-txt">${esc(p.titulo)}</span>
          <span class="passo-acoes">${ok ? '<small class="muted">Feito</small>' : `${ir}<button class="btn peq fantasma" data-a="passo-feito" data-v="${p.id}" title="Marcar como feito">${ic('check')}</button>`}</span>
        </div>`;
      }).join('')}</div>
    </div>`;
  }
};

/* ---------------- telas do site oficial ---------------- */
const CPF_CNPJ = {
  valido(v) {
    const d = soDigitos(v);
    if (/^(\d)\1+$/.test(d)) return false;
    const dv = (base, pesos) => { const s = pesos.reduce((t, p, i) => t + Number(base[i]) * p, 0) % 11; return s < 2 ? 0 : 11 - s; };
    if (d.length === 11) return dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[9] && dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[10];
    if (d.length === 14) return dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[12] && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[13];
    return false;
  },
  formatar(v) {
    const d = soDigitos(v).slice(0, 14);
    if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  }
};
// mesmo cálculo do banco (_primeiro_vencimento): o dia escolhido, logo depois do fim do teste
const primeiroVencimento = (fimTeste, dia) => {
  const ym = fimTeste.slice(0, 7), d = `${ym}-${pad(dia)}`;
  return +fimTeste.slice(8) <= dia ? d : `${Datas.somaMes(ym, 1)}-${pad(dia)}`;
};
const DIAS_TESTE = 14;

const Site = {
  casca(conteudo, { simples = false } = {}) {
    const sup = Store.db.config?.suporte_whatsapp;
    return `<div class="site">
      <header class="site-cab"><a class="marca" href="#/"><span class="marca-icone">${ic('tesoura')}</span><span class="marca-txt"><b>${APP.nome}</b><small>agendamento para barbearias e salões</small></span></a>
        ${simples ? '' : `<nav class="site-nav"><a class="btn fantasma" href="#/entrar">Entrar</a><a class="btn pri" href="#/contratar">Teste grátis</a></nav>`}</header>
      <main class="site-in">${conteudo}</main>
      <footer class="site-rodape"><span>${APP.nome} · agendamento online para barbearias e salões</span>
        <span><a href="#/termos">Termos de uso</a> · <a href="#/privacidade">Privacidade</a>${sup ? ` · <a href="${linkWhats(sup, `Olá! Quero saber mais sobre o ${APP.nome}.`)}" target="_blank" rel="noopener">Fale com a gente</a>` : ''}</span></footer>
    </div>`;
  },
  planos(destaque = 'pl_equipe', escolher = false) {
    const planos = Store.t('planos').filter(p => p.ativo !== false).sort((p, q) => p.preco - q.preco);
    const linha = (ok, txt) => `<li class="${ok ? '' : 'fora'}">${ic(ok ? 'check' : 'x')}<span>${txt}</span></li>`;
    return `<div class="home-planos-grade">${planos.map(p => `<${escolher ? 'label' : 'div'} class="home-plano ${p.id === destaque ? 'destaque' : ''}" ${escolher ? `data-plano="${p.id}"` : ''}>
        ${escolher ? `<input type="radio" name="plano_id" value="${p.id}" ${p.id === destaque ? 'checked' : ''}>` : ''}
        <div class="hp-topo"><h3>${esc(p.nome)}</h3>${p.id === 'pl_equipe' ? '<span class="badge destaque">Mais escolhido</span>' : ''}</div>
        <div class="hp-preco"><b>${dinheiro(p.preco)}</b><small>/mês</small></div>
        <ul>${linha(true, p.max_barbeiros ? `Até ${p.max_barbeiros} profissiona${p.max_barbeiros > 1 ? 'is' : 'l'}` : 'Profissionais sem limite')}
          ${linha(true, 'Agendamento pelo chat, agenda, clientes, catálogo com fotos e faturamento')}
          ${Object.entries(RECURSOS).map(([k, r]) => linha(p.recursos?.includes(k), esc(r.nome))).join('')}</ul>
        ${escolher ? '' : `<a class="btn ${p.id === destaque ? 'pri' : ''} cheio" href="#/contratar?plano=${p.id}">Começar ${DIAS_TESTE} dias grátis</a>`}
      </${escolher ? 'label' : 'div'}>`).join('')}</div>`;
  },

  home(app) {
    document.title = `${APP.nome} — agendamento online para barbearias e salões`;
    app.innerHTML = this.casca(`
      <section class="site-hero">
        <h1>Agenda cheia, <em>sem ficar no WhatsApp</em> o dia todo.</h1>
        <p class="home-lead">O cliente marca sozinho, por uma conversa simples no seu link. Você acompanha a agenda, a equipe e o faturamento no painel, no computador ou no celular.</p>
        <div class="acoes"><a class="btn pri grande" href="#/contratar">Começar ${DIAS_TESTE} dias grátis ${ic('direita')}</a></div>
        <p class="muted" style="margin-top:10px">Sem cartão para começar. Cancele quando quiser.</p>
      </section>
      <section class="site-recursos">
        ${[['mensagem', 'Agendamento por conversa', 'O cliente escolhe serviço, profissional, dia e horário num chat, sem baixar nada.'],
           ['calendario', 'Agenda da equipe', 'Grade do dia por profissional, encaixes, bloqueios e aviso de horário novo na hora.'],
           ['carteira', 'Faturamento certinho', 'Fechamento do dia, comissões, vendas de produtos e relatórios por período.'],
           ['estrela', 'Cliente que volta', 'Promoções, cartão fidelidade e planos mensais para os clientes.'],
           ['baixar', 'App no celular', 'Painel e chat instaláveis na tela do celular, com notificação de agendamento.'],
           ['cadeado', 'Seus dados protegidos', 'Cada estabelecimento vê só o que é dele; o cliente vê só os próprios horários.']]
          .map(([i, t, d]) => `<div class="site-recurso">${ic(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}
      </section>
      <section class="site-bloco"><h2>Planos e preços</h2><p class="home-lead">${DIAS_TESTE} dias grátis com tudo liberado. Depois, a mensalidade do plano escolhido.</p>${this.planos()}</section>
      <section class="site-bloco"><h2>Como começar</h2><ol class="site-passos">
        <li><b>Contrate em 3 minutos</b><span>Escolha o plano, preencha os dados e o dia do vencimento.</span></li>
        <li><b>Monte seu estabelecimento</b><span>O painel mostra os primeiros passos: horário, serviços, equipe.</span></li>
        <li><b>Divulgue o seu link</b><span>Na bio do Instagram e no WhatsApp. Os agendamentos começam a chegar.</span></li></ol></section>`);
  },

  entrar(app) {
    document.title = `Entrar · ${APP.nome}`;
    app.innerHTML = this.casca(`<div class="site-form-card">
      <h1>Entrar</h1><p class="muted">Para o dono do estabelecimento e a administração do ${APP.nome}. Profissionais da equipe entram pelo link do painel do estabelecimento.</p>
      <form id="f-entrar" class="pilha">
        <label class="campo"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
        <label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password" required></label>
        <button class="btn pri grande">Entrar</button>
      </form>
      <p class="muted" style="margin-top:14px">Esqueceu a senha? <a href="#/esqueci">Receber um link por e-mail</a>.</p>
      <p class="muted">Ainda não tem conta? <a href="#/contratar">Comece o teste grátis</a>.</p>
    </div>`, { simples: true });
    const f = $('#f-entrar', app);
    f.onsubmit = async e => {
      e.preventDefault();
      const bt = $('button', f); bt.disabled = true;
      try {
        const c = await Nuvem.entrar(f.email.value, f.senha.value);
        location.hash = c.papel === 'admin' ? '#/admin' : `#/${c.slug}/painel`;
      } catch (err) { UI.erro(err); bt.disabled = false; }
    };
  },

  // "Esqueci a senha": o servidor manda por e-mail um link de uso único (vale 1 hora)
  esqueci(app) {
    document.title = `Esqueci a senha · ${APP.nome}`;
    app.innerHTML = this.casca(`<div class="site-form-card">
      <h1>Esqueci a senha</h1><p class="muted">Digite o e-mail do seu login. Se ele tiver conta no ${APP.nome}, mandamos um link para você criar uma senha nova.</p>
      <form id="f-esqueci" class="pilha">
        <label class="campo"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
        <button class="btn pri grande">Enviar o link</button>
      </form>
      <p class="muted" style="margin-top:14px">É da equipe de um estabelecimento? Peça ao dono para criar uma senha nova no seu cadastro (Equipe).</p>
      <p class="muted"><a href="#/entrar">Voltar para o login</a></p>
    </div>`, { simples: true });
    const f = $('#f-esqueci', app);
    setTimeout(() => f.email.focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault();
      const bt = $('button', f), email = f.email.value.trim().toLowerCase();
      bt.disabled = true;
      try {
        await Nuvem.funcao('senha', { email });
        $('.site-form-card', app).innerHTML = `<h1>Confira seu e-mail</h1>
          <p>Se <b>${esc(email)}</b> tiver conta no ${APP.nome}, o link para criar uma senha nova chega em alguns minutos. Olhe também a caixa de spam.</p>
          <p class="muted">O link vale por 1 hora e só funciona uma vez.</p>
          <div class="acoes"><a class="btn" href="#/entrar">Voltar para o login</a></div>`;
      } catch (err) { UI.erro(err); bt.disabled = false; }
    };
  },

  // link do e-mail: o código vale uma vez; com ele o Supabase abre a sessão e a pessoa escolhe a senha nova
  async 'nova-senha'(app) {
    document.title = `Senha nova · ${APP.nome}`;
    const codigo = new URLSearchParams(location.hash.split('?')[1] || '').get('t');
    // o código sai do endereço na hora (não fica no histórico nem em print da tela)
    history.replaceState(history.state, '', location.pathname + location.search + '#/nova-senha');
    const invalido = () => { app.innerHTML = this.casca(`<div class="site-form-card"><h1>Esse link não vale mais</h1>
      <p class="muted">O link para criar uma senha nova vale por 1 hora e só funciona uma vez. Peça outro, que chega na hora.</p>
      <div class="acoes"><a class="btn pri" href="#/esqueci">Pedir outro link</a><a class="btn" href="#/entrar">Voltar para o login</a></div></div>`, { simples: true }); };
    if (!codigo) return invalido();
    app.innerHTML = this.casca(`<div class="site-form-card"><p class="muted"><span class="pag-girando"></span> Conferindo o link…</p></div>`, { simples: true });
    const { data, error } = await Nuvem.sb.auth.verifyOtp({ token_hash: codigo, type: 'recovery' });
    if (error || !data?.user) return invalido();
    Nuvem.conta = undefined; Nuvem.contexto = null; // a sessão agora é de quem pediu o link
    const email = data.user.email;
    app.innerHTML = this.casca(`<div class="site-form-card">
      <h1>Criar senha nova</h1><p class="muted">Login: <b>${esc(email)}</b></p>
      <form id="f-nova-senha" class="pilha">
        <label class="campo"><span>Senha nova</span><input type="password" name="senha" autocomplete="new-password" minlength="8" required><small>Pelo menos 8 caracteres.</small></label>
        <label class="campo"><span>Repita a senha nova</span><input type="password" name="senha2" autocomplete="new-password" minlength="8" required></label>
        <button class="btn pri grande">Salvar e entrar</button>
      </form></div>`, { simples: true });
    const f = $('#f-nova-senha', app);
    setTimeout(() => f.senha.focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault();
      const bt = $('button', f);
      try {
        if (f.senha.value.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        if (f.senha.value !== f.senha2.value) throw new Error('As duas senhas não estão iguais.');
        bt.disabled = true;
        await Nuvem.trocarSenha(f.senha.value);
        const c = await Nuvem.lerConta(true);
        UI.toast('Senha nova salva.', 'ok');
        location.hash = !c ? '#/entrar' : c.papel === 'admin' ? '#/admin' : `#/${c.slug}/painel`;
      } catch (err) { UI.erro(err); bt.disabled = false; }
    };
  },

  contratar(app) {
    document.title = `Contratar · ${APP.nome}`;
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const plano = Store.get('planos', q.get('plano')) ? q.get('plano') : 'pl_equipe';
    const fimTeste = Datas.soma(Datas.hoje(), DIAS_TESTE);
    app.innerHTML = this.casca(`<form id="f-contratar" class="contratar" novalidate>
      <div class="contratar-cab"><h1>Comece seu teste grátis</h1><p class="home-lead">${DIAS_TESTE} dias com tudo liberado. Você só paga a primeira mensalidade depois do teste.</p></div>
      <section class="card"><div class="card-cab"><h3><span class="etapa">1</span> Escolha o plano</h3></div>${this.planos(plano, true)}</section>
      <section class="card"><div class="card-cab"><h3><span class="etapa">2</span> Seu estabelecimento</h3></div><div class="grade-form">
        <label class="campo"><span>Nome do estabelecimento</span><input name="nome" maxlength="80" required placeholder="Ex.: Barbearia do João"></label>
        <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS_ESTAB).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
        <label class="campo inteiro"><span>Endereço do seu link de agendamento</span>
          <div class="link-montado"><small>${esc(location.host)}/#/</small><input name="slug" maxlength="40" required placeholder="nome-do-estabelecimento"></div>
          <small id="slug-situacao" class="muted">Só letras minúsculas, números e hífen. É o link que você vai divulgar.</small></label>
        <label class="campo"><span>WhatsApp do estabelecimento</span><input name="whatsapp" data-tel inputmode="tel" required placeholder="(21) 99999-9999"></label>
        <label class="campo"><span>Cidade</span><input name="cidade" required placeholder="Ex.: Maricá - RJ"></label>
        <label class="campo"><span>Endereço <small>(opcional)</small></span><input name="endereco" placeholder="Rua, número, bairro"></label>
        <label class="campo"><span>Instagram <small>(opcional)</small></span><input name="instagram" placeholder="@seuperfil"></label>
        <div class="campo inteiro"><label class="chave"><input type="checkbox" name="atende" checked><i></i><span>Eu também atendo clientes (entro na agenda como profissional)</span></label></div>
      </div></section>
      <section class="card"><div class="card-cab"><h3><span class="etapa">3</span> Responsável e acesso</h3></div><div class="grade-form">
        <label class="campo"><span>Seu nome completo</span><input name="responsavel" autocomplete="name" required></label>
        <label class="campo"><span>CPF ou CNPJ</span><input name="cpf_cnpj" inputmode="numeric" required placeholder="000.000.000-00"><small>Para emitir a cobrança da mensalidade.</small></label>
        <label class="campo inteiro"><span>E-mail</span><input type="email" name="email" autocomplete="email" required><small>É o seu login e onde chega a cobrança.</small></label>
        <label class="campo"><span>Crie uma senha</span><input type="password" name="senha" autocomplete="new-password" minlength="8" required placeholder="Pelo menos 8 caracteres"></label>
        <label class="campo"><span>Repita a senha</span><input type="password" name="senha2" autocomplete="new-password" required></label>
      </div></section>
      <section class="card"><div class="card-cab"><h3><span class="etapa">4</span> Mensalidade</h3></div><div class="grade-form">
        <label class="campo"><span>Dia do vencimento</span><select name="dia_vencimento">${[5, 10, 15, 20, 25].map(d => `<option value="${d}" ${d === 10 ? 'selected' : ''}>Todo dia ${d}</option>`).join('')}</select></label>
        <div class="campo"><span>Forma de pagamento</span><p class="muted" style="margin:6px 0 0">Boleto, PIX ou cartão: você escolhe na hora de pagar cada mensalidade.</p></div>
        <div class="inteiro det-nota" id="resumo-contrato"></div>
      </div></section>
      <section class="card">
        <label class="chave"><input type="checkbox" name="aceite"><i></i><span>Li e aceito os <a href="#/termos" target="_blank">Termos de uso</a> e a <a href="#/privacidade" target="_blank">Política de privacidade</a>.</span></label>
        <div class="acoes" style="margin-top:16px"><button class="btn pri grande" id="bt-contratar">${ic('check')} Criar minha conta e começar o teste</button></div>
        <p class="muted" style="margin-top:8px">Já tem conta? <a href="#/entrar">Entrar</a>.</p>
      </section>
    </form>`);
    const f = $('#f-contratar', app);
    let slugManual = false, slugOk = null, slugVez = 0;
    const resumo = () => {
      const p = Store.get('planos', UI.form(f).plano_id), dia = +f.dia_vencimento.value, venc = primeiroVencimento(fimTeste, dia);
      $$('[data-plano]', f).forEach(el => el.classList.toggle('destaque', el.dataset.plano === p?.id));
      $('#resumo-contrato', f).innerHTML = `${ic('info')}<span>Teste grátis até <b>${Datas.br(fimTeste)}</b>, com todos os recursos.
        Primeira mensalidade do plano <b>${esc(p?.nome || '')}</b>: <b>${dinheiro(p?.preco)}</b> em <b>${Datas.br(venc)}</b>; depois, todo dia ${dia}. Sem multa para cancelar.</span>`;
    };
    const conferirSlug = async () => {
      const s = slugify(f.slug.value), el = $('#slug-situacao', f), vez = ++slugVez;
      if (f.slug.value !== s) f.slug.value = s;
      if (s.length < 3) { slugOk = null; el.className = 'muted'; el.textContent = 'Use pelo menos 3 letras.'; return; }
      el.className = 'muted'; el.textContent = 'Conferindo...';
      const livre = await Nuvem.rpc('slug_disponivel', { p_slug: s }).catch(() => null);
      if (vez !== slugVez) return;
      slugOk = livre;
      el.className = livre ? 'ok-txt' : 'erro-txt';
      el.textContent = livre ? `Disponível: ${location.host}/#/${s}` : 'Esse endereço já está em uso. Tente outro.';
    };
    let espera = null;
    const agendarConferencia = () => { clearTimeout(espera); espera = setTimeout(conferirSlug, 450); };
    f.nome.oninput = () => { if (!slugManual) { f.slug.value = slugify(f.nome.value); agendarConferencia(); } };
    f.slug.oninput = () => { slugManual = true; agendarConferencia(); };
    f.cpf_cnpj.oninput = () => { f.cpf_cnpj.value = CPF_CNPJ.formatar(f.cpf_cnpj.value); };
    f.whatsapp.oninput = () => { f.whatsapp.value = fmtTel(f.whatsapp.value); };
    f.onchange = resumo;
    resumo();
    f.onsubmit = async e => {
      e.preventDefault();
      const d = UI.form(f), bt = $('#bt-contratar', f);
      try {
        if (!d.plano_id) throw new Error('Escolha um plano.');
        if ((d.nome || '').trim().length < 2) throw new Error('Informe o nome do estabelecimento.');
        if (slugOk === false) throw new Error('O endereço do link já está em uso. Escolha outro.');
        if ((d.slug || '').length < 3) throw new Error('Escolha o endereço do seu link.');
        if (![10, 11].includes(soDigitos(d.whatsapp).length)) throw new Error('Confira o WhatsApp: DDD + número.');
        if (!(d.cidade || '').trim()) throw new Error('Informe a cidade.');
        if ((d.responsavel || '').trim().split(/\s+/).length < 2) throw new Error('Informe seu nome completo.');
        if (!CPF_CNPJ.valido(d.cpf_cnpj)) throw new Error('Confira o CPF ou CNPJ: os números não batem.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) throw new Error('Confira o e-mail.');
        if ((d.senha || '').length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        if (d.senha !== d.senha2) throw new Error('As duas senhas não são iguais.');
        if (!f.aceite.checked) throw new Error('Para continuar, aceite os termos de uso e a política de privacidade.');
        bt.disabled = true; bt.innerHTML = '<span class="pag-girando"></span> Criando sua conta...';
        const r = await Nuvem.funcao('contratar', {
          plano_id: d.plano_id, nome: d.nome.trim(), tipo: d.tipo, slug: d.slug, whatsapp: soDigitos(d.whatsapp), cidade: d.cidade.trim(),
          endereco: (d.endereco || '').trim(), instagram: (d.instagram || '').trim(), atende: f.atende.checked,
          responsavel: d.responsavel.trim(), cpf_cnpj: soDigitos(d.cpf_cnpj), email: d.email.trim().toLowerCase(), senha: d.senha,
          dia_vencimento: +d.dia_vencimento, aceite: true
        });
        await Nuvem.entrar(d.email, d.senha);
        try { localStorage.setItem('bsflow:boas-vindas', r.slug); } catch (er) { /* sem armazenamento */ }
        location.hash = `#/${r.slug}/painel`;
      } catch (err) {
        UI.erro(err);
        bt.disabled = false; bt.innerHTML = `${ic('check')} Criar minha conta e começar o teste`;
      }
    };
  },

  texto(app, titulo, secoes) {
    document.title = `${titulo} · ${APP.nome}`;
    app.innerHTML = this.casca(`<article class="site-texto"><h1>${titulo}</h1><p class="muted">Versão de ${Datas.br('2026-10-28')}</p>
      ${secoes.map(([t, ps]) => `<h2>${t}</h2>${ps.map(p => `<p>${p}</p>`).join('')}`).join('')}</article>`);
  },
  termos(app) {
    this.texto(app, 'Termos de uso', [
      ['1. O que é o BSFlow', ['O BSFlow é um sistema online de agendamento e gestão para barbearias e salões de beleza ("estabelecimentos"). O estabelecimento contrata um plano e usa o painel de gestão; os clientes dele agendam pela página de agendamento.']],
      ['2. Conta e acesso', ['Quem contrata é responsável pelos dados informados e pela guarda da senha. O dono pode criar acessos para os profissionais da equipe e responde pelo uso que eles fazem do sistema.', 'O endereço do link de agendamento é escolhido na contratação e só pode ser trocado pelo suporte.']],
      ['3. Teste grátis, planos e pagamento', [`O teste grátis dura ${DIAS_TESTE} dias corridos a partir da contratação, com todos os recursos liberados. Depois, valem os recursos e o limite de profissionais do plano escolhido.`, 'A mensalidade vence no dia escolhido; a primeira, no primeiro dia de vencimento depois do teste. O pagamento é feito por boleto, PIX ou cartão, pela plataforma de cobrança Asaas.', 'Se a mensalidade atrasar além do prazo de tolerância, o painel e o agendamento online ficam pausados até o pagamento ser confirmado. Os dados são mantidos.']],
      ['4. Cancelamento', ['O estabelecimento pode cancelar quando quiser, sem multa, falando com o suporte. O acesso fica ativo até o fim do período já pago. Mensalidades pagas não são devolvidas proporcionalmente.']],
      ['5. Uso adequado', ['É proibido usar o BSFlow para enviar mensagens em massa não solicitadas, para fins ilegais ou para coletar dados de terceiros sem autorização. Contas que fizerem isso podem ser suspensas.']],
      ['6. Disponibilidade e responsabilidade', ['Trabalhamos para manter o sistema no ar o tempo todo, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (internet, hospedagem, WhatsApp). O BSFlow não responde por lucros cessantes decorrentes dessas interrupções. Os atendimentos, preços e serviços combinados com os clientes finais são de responsabilidade do estabelecimento.']],
      ['7. Mudanças', ['Estes termos podem mudar. Mudanças importantes serão avisadas no painel com antecedência. Dúvidas: fale com o suporte pelo WhatsApp informado no site.']]
    ]);
  },
  privacidade(app) {
    this.texto(app, 'Política de privacidade', [
      ['Quem somos', ['Esta política explica como o BSFlow trata dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Para os dados dos clientes finais, o estabelecimento é o controlador e o BSFlow é o operador, que trata os dados em nome dele.']],
      ['Que dados tratamos', ['Do estabelecimento e do responsável: nome, CPF ou CNPJ, e-mail, WhatsApp, cidade, endereço e dados de uso do sistema.', 'Dos clientes finais: nome, WhatsApp e o histórico de agendamentos e atendimentos naquele estabelecimento.']],
      ['Para que usamos', ['Para funcionar o agendamento e a gestão do estabelecimento, emitir e cobrar a mensalidade, enviar avisos sobre a conta e dar suporte. Não vendemos dados.']],
      ['Com quem compartilhamos', ['Com fornecedores necessários para o serviço: hospedagem e banco de dados (Supabase), cobrança (Asaas) e, quando o recurso estiver ligado, o envio de mensagens pelo WhatsApp. Cada estabelecimento vê só os próprios dados; o cliente final vê só os próprios horários.']],
      ['Segurança e guarda', ['Os dados ficam em servidores com acesso controlado e regras que separam cada estabelecimento. Guardamos os dados enquanto a conta estiver ativa e pelo prazo exigido por lei depois do cancelamento.']],
      ['Seus direitos', ['Você pode pedir acesso, correção, cópia ou exclusão dos seus dados. Cliente final: fale com o estabelecimento onde agendou. Estabelecimento: fale com o suporte do BSFlow pelo WhatsApp do site.']]
    ]);
  }
};

/* ---------------- painel ligado no servidor ---------------- */
if (Nuvem.ativo) Object.assign(Painel, {
  lerSessao(b) {
    const c = Nuvem.conta;
    if (!c) return null;
    if (c.papel === 'admin') return { tipo: 'dono', admin: true };
    if (c.barbearia_id !== b.id) return null;
    return c.papel === 'dono' ? { tipo: 'dono' } : { tipo: 'barbeiro', id: c.barbeiro_id };
  },
  gravarSessao(b, s) { if (!s) Nuvem.sair(); },
  login() {
    const b = this.b, barbs = Agenda.barbeiros(b), sup = Store.db.config?.suporte_whatsapp;
    this.app.innerHTML = `<div class="login"><div class="login-card login-oficial">
      <span class="marca" style="justify-content:center"><span class="marca-icone" style="width:56px;height:56px;border-radius:16px">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ic('tesoura')}</span></span>
      <h1>${esc(b.nome)}</h1><p>Painel de gestão</p>
      <div class="seg cheio" style="margin:14px 0"><button class="on" data-a="login-tipo" data-v="dono">${ic('coroa')} Dono / gerência</button>${barbs.length ? `<button data-a="login-tipo" data-v="equipe">${ic('usuario')} Equipe</button>` : ''}</div>
      <form id="f-login" class="pilha" style="text-align:left">
        <label class="campo" data-dono><span>E-mail</span><input type="email" name="email" autocomplete="email"></label>
        <label class="campo" data-equipe hidden><span>Quem é você?</span><select name="barbeiro">${barbs.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password"></label>
        <button class="btn pri grande">Entrar</button>
      </form>
      <p class="muted" style="font-size:13.5px;margin-top:12px" data-dono>Esqueceu a senha? <a href="#/esqueci">Receber um link por e-mail</a>.${sup ? ` Se não chegar, <a href="${linkWhats(sup, `Olá! Esqueci a senha do painel de ${b.nome}.`)}" target="_blank" rel="noopener">fale com o suporte</a>.` : ''}</p>
      <p class="muted" style="font-size:13.5px;margin-top:12px" data-equipe hidden>Sem senha ou esqueceu? Peça ao dono do estabelecimento para criar uma no seu cadastro (Equipe).</p>
      <details class="primeiro-acesso"><summary>${ic('info')} Primeiro acesso? Veja o passo a passo</summary>
        <ol><li>Entre com o <b>e-mail e a senha</b> que você criou na contratação.</li>
          <li>Na agenda aparece o cartão <b>Primeiros passos</b>: confira os dados e o horário de funcionamento, ajuste os serviços e preços, a equipe e o horário de cada um.</li>
          <li>Faça um agendamento de teste pelo seu link (${esc(location.host)}/#/${esc(b.slug)}) e veja ele chegar na agenda.</li>
          <li>Divulgue o link na bio do Instagram e no WhatsApp, e instale o painel no celular para receber os avisos.</li></ol>
        <button type="button" class="btn peq" data-a="ver-ajuda">${ic('info')} Guia completo de uso</button></details>
      <div class="login-voltar"><a class="btn fantasma" href="#/">${ic('voltar')} Início</a></div>
    </div></div>`;
    const f = $('#f-login', this.app);
    let tipo = 'dono';
    setTimeout(() => f.email.focus(), 50);
    this.app.onclick = e => {
      const el = e.target.closest('[data-a]');
      if (!el) return;
      if (el.dataset.a === 'ver-ajuda') return Ajuda.abrir();
      if (el.dataset.a === 'login-tipo') {
        tipo = el.dataset.v;
        $$('[data-a="login-tipo"]', this.app).forEach(x => x.classList.toggle('on', x === el));
        $$('[data-dono]', this.app).forEach(x => { x.hidden = tipo !== 'dono'; });
        $$('[data-equipe]', this.app).forEach(x => { x.hidden = tipo !== 'equipe'; });
      }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const bt = $('button', f); bt.disabled = true;
      try {
        if (!f.senha.value) throw new Error('Digite a senha.');
        const c = tipo === 'dono' ? await Nuvem.entrar(f.email.value, f.senha.value) : await Nuvem.entrarEquipe(f.barbeiro.value, f.senha.value);
        if (c.papel !== 'admin' && c.barbearia_id !== b.id) { await Nuvem.sair(); throw new Error('Este login é de outro estabelecimento.'); }
        Rotas.render();
      } catch (err) { UI.erro(err); bt.disabled = false; }
    };
  },
  trocarSenha() {
    const m = UI.modal({
      titulo: 'Trocar minha senha', classe: 'pequeno',
      corpo: `<form id="f-senha" class="pilha"><label class="campo"><span>Nova senha</span><input type="password" name="s1" autocomplete="new-password" placeholder="Pelo menos 8 caracteres"></label>
        <label class="campo"><span>Repita a nova senha</span><input type="password" name="s2" autocomplete="new-password"></label></form>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ok-senha">${ic('check')} Trocar</button>`
    });
    $('#ok-senha', m.el).onclick = async () => {
      const f = $('#f-senha', m.el);
      try {
        if (f.s1.value.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        if (f.s1.value !== f.s2.value) throw new Error('As duas senhas não são iguais.');
        await Nuvem.trocarSenha(f.s1.value);
        UI.toast('Senha trocada.'); m.fechar();
      } catch (err) { UI.erro(err); }
    };
  },
  // senha de acesso do profissional (cria o login dele na primeira vez)
  async acessoEquipe(x, senha) {
    await Nuvem.funcao('equipe', { acao: 'definir', barbeiro_id: x.id, senha });
    const novo = Store.get('barbeiros', x.id);
    if (novo && !novo.usuario_id) novo.usuario_id = 'criado';
  }
});

/* ---------------- guia no painel (também na demonstração) ---------------- */
Painel.v_ajuda = function () {
  const b = this.b;
  return `<div class="topo"><div><h1>Como usar</h1><p class="sub">Passo a passo do ${APP.nome} para ${esc(b.nome)}</p></div>
      <div class="topo-acoes"><a class="btn" href="#/${esc(b.slug)}" target="_blank">${ic('externo')} Minha página de agendamento</a></div></div>
    ${Ajuda.html(['primeiro'])}
    <div class="card" style="margin-top:14px"><div class="card-cab"><div><h3>Precisa de ajuda?</h3><p>Fale com a gente pelo WhatsApp</p></div>
      <a class="btn pri" href="${linkWhats(Store.db.config?.suporte_whatsapp, `Olá! Sou de ${b.nome} e preciso de ajuda com o ${APP.nome}.`)}" target="_blank" rel="noopener">${ic('mensagem')} Falar com o suporte</a></div></div>`;
};

// quem acabou de contratar: boas-vindas uma vez, com o resumo e o caminho para começar
Passos.boasVindas = function (painel) {
  const b = painel.b;
  let marca = null;
  try { marca = localStorage.getItem('bsflow:boas-vindas'); } catch (e) { /* sem armazenamento */ }
  if (!Nuvem.ativo || marca !== b.slug || !painel.eDono()) return;
  try { localStorage.removeItem('bsflow:boas-vindas'); } catch (e) { /* sem armazenamento */ }
  const plano = Planos.de(b), link = UI.linkCliente(b);
  const m = UI.modal({
    titulo: `Bem-vindo(a) ao ${APP.nome}!`,
    corpo: `<div class="boas-vindas">
      <p><b>${esc(b.nome)}</b> já está no ar. Seu teste grátis vai até <b>${Datas.br(b.teste_ate)}</b>, com todos os recursos liberados.</p>
      <p>Plano escolhido: <b>${esc(plano?.nome || '')}</b>, ${dinheiro(b.valor_mensal)}/mês.${b.primeiro_vencimento ? ` A primeira mensalidade vence em <b>${Datas.br(b.primeiro_vencimento)}</b> e chega no seu e-mail.` : ''}</p>
      <div class="link-caixa" style="margin:12px 0"><code>${esc(link)}</code></div>
      <p class="muted">Agora é só seguir os <b>Primeiros passos</b> que aparecem na agenda: horário, serviços, equipe e o primeiro agendamento de teste.</p>
    </div>`,
    rodape: `<button class="btn" id="bv-guia">${ic('info')} Ver o guia de uso</button><button class="btn pri" data-fechar>${ic('check')} Começar</button>`
  });
  $('#bv-guia', m.el).onclick = () => { m.fechar(); Ajuda.abrir(['primeiro', 'dados']); };
};

/* ---------------- WhatsApp do estabelecimento (mensagens automáticas) ---------------- */
if (Nuvem.ativo) Object.assign(Painel, {
  cartaoWhatsApp() {
    const b = this.b, pode = Planos.tem(b, 'lembretes') || Planos.tem(b, 'cobranca_auto');
    const est = b.whatsapp_estado || 'desconectado';
    const selo = est === 'conectado' ? UI.badge('Conectado', 'ok', 'check') : est === 'conectando' ? UI.badge('Aguardando o QR code', 'aviso') : UI.badge('Desconectado', 'neutro');
    let corpo;
    if (!pode) corpo = `<button type="button" class="trava-linha" data-a="bloq-recurso" data-v="lembretes">${ic('cadeado')}<span>Mensagens automáticas no WhatsApp: disponível a partir do plano ${esc(Planos.minimoPara('lembretes')?.nome || 'Equipe')}</span><b>Quero</b></button>`;
    else if (est === 'conectado') corpo = `<p style="margin:0 0 12px">As mensagens saem sozinhas pelo número <b>${esc(fmtTel(b.whatsapp_numero || b.whatsapp))}</b>: confirmação, lembretes, avisos à equipe${Planos.tem(b, 'cobranca_auto') ? ' e cobrança dos mensalistas' : ''}.</p>
        <div class="acoes"><button type="button" class="btn" data-a="wa-testar">${ic('mensagem')} Enviar teste</button><button type="button" class="btn fantasma" data-a="wa-atualizar">${ic('atualizar')} Conferir conexão</button><button type="button" class="btn perigo-txt" data-a="wa-desconectar">${ic('power')} Desconectar</button></div>`;
    else corpo = `<ol class="passos" style="margin:0 0 12px"><li>Use o celular com o <b>WhatsApp do estabelecimento</b> (de preferência o WhatsApp Business).</li><li>Toque em <b>Conectar WhatsApp</b> e leia o QR code em <b>Configurações → Aparelhos conectados → Conectar um aparelho</b>.</li><li>Pronto: as mensagens do BSFlow passam a sair por esse número, no horário certo.</li></ol>
        <div class="acoes"><button type="button" class="btn pri" data-a="wa-conectar">${ic('link')} Conectar WhatsApp</button>${est === 'conectando' ? `<button type="button" class="btn fantasma" data-a="wa-atualizar">${ic('atualizar')} Já li o código</button>` : ''}</div>
        <p class="ajuda" style="margin-top:10px">Envie só mensagens de atendimento para quem agendou. Disparo em massa pode fazer o WhatsApp bloquear o número.</p>`;
    return `<div class="card" id="whatsapp"><div class="card-cab"><div><h3>WhatsApp do estabelecimento</h3><p>As mensagens automáticas saem por este número</p></div>${pode ? selo : ''}</div>${corpo}</div>`;
  },
  // guarda no cache o que o servidor respondeu sobre o WhatsApp e redesenha
  waGuardar(r) {
    const b = Store.get('barbearias', this.b.id);
    if (b && r?.estado) Object.assign(b, { whatsapp_estado: r.estado, ...(r.numero != null ? { whatsapp_numero: r.numero } : {}) });
    this.b = b || this.b;
  },
  async waAcao(acao, ok) {
    try {
      const r = await Nuvem.funcao('whatsapp', { acao });
      this.waGuardar(r);
      UI.toast(ok || (r.estado === 'conectado' ? 'WhatsApp conectado.' : 'WhatsApp não está conectado.'), r.estado === 'conectado' || ok ? 'ok' : 'info');
      this.pintar();
    } catch (e) { UI.erro(e); }
  },
  async waConectar() {
    let fim = false, r;
    try { r = await Nuvem.funcao('whatsapp', { acao: 'conectar' }); } catch (e) { return UI.erro(e); }
    if (r.estado === 'conectado') { this.waGuardar(r); this.pintar(); return UI.toast('WhatsApp conectado.'); }
    const img = q => q ? `<img src="${q.startsWith('data:') ? q : 'data:image/png;base64,' + q}" alt="QR code do WhatsApp" style="width:260px;height:260px;image-rendering:pixelated;background:#fff;border-radius:12px;padding:8px">` : '<p class="muted">Gerando o código...</p>';
    const m = UI.modal({
      titulo: 'Conectar o WhatsApp', classe: 'pequeno',
      corpo: `<div style="text-align:center"><div id="wa-qr">${img(r.qr)}</div>
        <ol class="passos" style="text-align:left;margin-top:14px"><li>Abra o WhatsApp no celular do estabelecimento.</li><li>Toque em <b>Configurações</b> (ou nos três pontinhos) e em <b>Aparelhos conectados</b>.</li><li>Toque em <b>Conectar um aparelho</b> e aponte a câmera para o código.</li></ol>
        <p class="muted" id="wa-situacao"><span class="pag-girando"></span> Esperando a leitura do código...</p></div>`,
      rodape: '<button class="btn" data-fechar>Fechar</button>',
      aoFechar: () => { fim = true; this.pintar(); }
    });
    // confere a conexão a cada 3 s e troca o código a cada 40 s (o WhatsApp expira o código)
    for (let i = 0; i < 60 && !fim; i++) {
      await esperar(3000);
      if (fim) return;
      const st = await Nuvem.funcao('whatsapp', { acao: 'estado' }).catch(() => null);
      if (st?.estado === 'conectado') {
        this.waGuardar(st);
        fim = true; m.fechar();
        return UI.toast(`WhatsApp conectado${st.numero ? ` (${fmtTel(st.numero)})` : ''}. As mensagens já saem sozinhas.`);
      }
      if (i % 13 === 12) {
        const novo = await Nuvem.funcao('whatsapp', { acao: 'conectar' }).catch(() => null);
        if (novo?.qr && $('#wa-qr', m.el)) $('#wa-qr', m.el).innerHTML = img(novo.qr);
      }
    }
    if (!fim && $('#wa-situacao', m.el)) $('#wa-situacao', m.el).textContent = 'O código expirou. Feche e toque em Conectar de novo.';
  }
});

/* ---------------- pagamento pelo app: Mercado Pago do estabelecimento ---------------- */
if (Nuvem.ativo) {
  Object.assign(Painel, {
    // miolo do cartão "Pagamento" em Ajustes (pg = configuração atual, pix = campo da chave PIX)
    corpoMercadoPago(pg, pix) {
      const b = this.b, taxa = Store.db.config?.taxa_pagamento ?? 1;
      if (!Planos.tem(b, 'pagamento_app')) return `<button type="button" class="trava-linha" data-a="bloq-recurso" data-v="pagamento_app" style="margin-bottom:14px">${ic('cadeado')}<span>Cobrança direto no app (PIX e cartão no chat): disponível no plano ${esc(Planos.minimoPara('pagamento_app')?.nome || 'Premium')}</span><b>Quero</b></button><div class="grade-form">${pix}</div>`;
      // a produção só ganha o botão depois de receber a migração do pagamento (config_publica passa a trazer a taxa)
      if (Store.db.config?.taxa_pagamento == null) return `<p class="muted" style="margin:0 0 12px">O pagamento pelo app (PIX e cartão no chat) chega em breve.</p><div class="grade-form">${pix}</div>`;
      if (!b.mp_conectado) return `<p style="margin:0 0 12px">O cliente paga o horário direto no chat, no <b>PIX</b> ou no <b>cartão de crédito ou débito</b>, e o dinheiro cai <b>na sua conta do Mercado Pago</b>, sem passar pelo BSFlow.</p>
        <ol class="passos" style="margin:0 0 12px"><li>Toque em <b>Conectar Mercado Pago</b> e entre com a conta que vai receber (conta com identidade verificada).</li><li>Autorize o BSFlow a cobrar em seu nome.</li><li>Volte aqui e escolha como cobrar.</li></ol>
        <p class="ajuda" style="margin:0 0 12px">Para receber PIX, a conta precisa ter uma <b>chave Pix cadastrada no Mercado Pago</b> (no app do Mercado Pago: Pix, Minhas chaves).</p>
        <div class="acoes"><button type="button" class="btn pri" data-a="mp-conectar">${ic('link')} Conectar Mercado Pago</button></div>
        <p class="ajuda" style="margin-top:10px">O BSFlow retém ${String(taxa).replace('.', ',')}% de cada pagamento recebido pelo app, além da tarifa do próprio Mercado Pago.</p>
        <div class="grade-form" style="margin-top:12px">${pix}</div>`;
      const radio = (nome, atual, ops) => `<div class="opcoes-grade">${ops.map(([v, t]) => `<label class="op-btn" style="cursor:pointer"><input type="radio" name="${nome}" value="${v}" ${String(atual) === String(v) ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
      return `<div class="aviso-faixa ok" style="margin-bottom:14px">${ic('check')}<span>Mercado Pago conectado${b.mp_user_id ? ` (conta ${esc(b.mp_user_id)})` : ''}. O dinheiro dos pagamentos cai direto nela.</span></div>
        <div class="pilha">
          <div class="campo"><span>Como funciona</span>${radio('pg_modo', pg.modo, [['desligado', 'Desligado'], ['opcional', 'Opcional: o cliente escolhe'], ['obrigatorio', 'Obrigatório para garantir o horário']])}</div>
          <div class="campo"><span>Quanto cobrar antecipado</span>${radio('pg_sinal', pg.sinal, [[100, 'O valor todo'], [50, 'Sinal de 50%'], [30, 'Sinal de 30%']])}</div>
          <div class="grade-form">
            <label class="campo"><span>Se o cliente faltar</span><select name="pg_falta"><option value="retem" ${pg.falta !== 'credito' ? 'selected' : ''}>O valor fica com o estabelecimento</option></select></label>
            ${pix}
          </div>
          <p class="ajuda">Se o cliente cancelar pelo chat dentro do prazo, o valor é devolvido sozinho pelo Mercado Pago. No modo obrigatório, quem não paga em 15 minutos perde o horário. O BSFlow retém ${String(taxa).replace('.', ',')}% de cada pagamento.</p>
          <p class="ajuda">Formas aceitas: PIX (precisa de chave Pix cadastrada no Mercado Pago), crédito à vista (Visa, Mastercard, Elo, Amex) e débito (pela internet o Mercado Pago aceita Elo). O prazo para o dinheiro do cartão ficar disponível segue o que está escolhido na sua conta do Mercado Pago.</p>
          <div class="acoes"><button type="button" class="btn perigo-txt" data-a="mp-desligar">${ic('power')} Desconectar Mercado Pago</button></div>
        </div>`;
    },
    async mpConectar() {
      try {
        const r = await Nuvem.funcao('mp-conectar', { acao: 'url' });
        location.href = r.url; // o Mercado Pago pede o login e devolve para este painel
      } catch (e) { UI.erro(e); }
    },
    async mpDesligar() {
      if (!await UI.confirmar('O cliente deixa de poder pagar pelo app. Os horários já pagos continuam valendo.', { titulo: 'Desconectar o Mercado Pago', ok: 'Desconectar', perigo: true })) return;
      try {
        await Nuvem.funcao('mp-conectar', { acao: 'desligar' });
        const b = Store.get('barbearias', this.b.id);
        if (b) Object.assign(b, { mp_conectado: false, mp_user_id: null });
        this.b = b || this.b;
        UI.toast('Mercado Pago desconectado.');
        this.pintar();
      } catch (e) { UI.erro(e); }
    }
  });
  // cliques novos
  const cliqueAntes = Painel.cliqueExtra;
  Painel.cliqueExtra = async function (a, el, e) {
    if (a === 'mp-conectar') return this.mpConectar();
    if (a === 'mp-desligar') return this.mpDesligar();
    return cliqueAntes.call(this, a, el, e);
  };
  // volta do login do Mercado Pago: avisa e limpa o ?mp= do endereço
  const renderAntes = Painel.render;
  Painel.render = function (...args) {
    const r = renderAntes.apply(this, args);
    const mp = new URLSearchParams((location.hash.split('?')[1] || '')).get('mp');
    if (mp) {
      history.replaceState(history.state, '', location.pathname + location.search + location.hash.split('?')[0]);
      setTimeout(() => UI.toast(mp === 'ok' ? 'Mercado Pago conectado. Agora escolha como cobrar e salve os ajustes.' : 'Não deu para conectar o Mercado Pago. Tente de novo.', mp === 'ok' ? 'ok' : 'erro'), 400);
    }
    return r;
  };
}
