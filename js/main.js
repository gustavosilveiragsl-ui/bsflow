'use strict';
/* Rotas (pelo # do endereço, funciona em qualquer hospedagem estática):
   #/                        início (demonstração)
   #/admin[/aba]             painel do dono do sistema
   #/<estab>/painel[/aba]    painel do estabelecimento (barbearia ou salão)
   #/<estab>                 página do cliente (chat)            */
const Rotas = {
  partes() { return location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent); },
  render() {
    Store.ouvinte = null;
    $$('.modal-fundo, .folha-fundo').forEach(m => m.remove());
    document.body.classList.remove('com-modal');
    const velho = $('#app');
    const app = velho.cloneNode(false); // troca o elemento para não acumular eventos
    velho.replaceWith(app);
    document.body.className = '';
    UI.aplicarCor(null);
    const p = this.partes();
    const base = location.href.split('#')[0];
    PWA.configurar(p[0] === 'admin'
      ? { nome: `${APP.nome} · Administração`, curto: `${APP.nome} Admin`, texto: 'BS', inicio: base + '#/admin' }
      : { nome: APP.nome, curto: APP.nome, texto: 'BS', inicio: base });
    try {
      if (!p.length) return Home.render(app);
      if (p[0] === 'admin') return Admin.render(app, p.slice(1));
      if (p[1] === 'painel') return Painel.render(app, p[0], p.slice(2));
      return Cliente.render(app, p[0]);
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="tela-msg"><div><span class="grande-icone">${ic('alerta')}</span><h1>Algo deu errado</h1><p>${esc(e.message)}</p><a class="btn" href="#/">Voltar ao início</a></div></div>`;
    }
  }
};

const Home = {
  render(app) {
    document.title = `${APP.nome} — agendamento para barbearias e salões`;
    const bbs = Store.t('barbearias');
    const item = (b, href, extra) => {
      const s = Cobranca.situacao(b);
      return `<a href="${href}"><i class="cor" style="background:${esc(b.cor)}"></i><span>${esc(b.nome)}</span><small>${esc(extra || s.texto)}</small></a>`;
    };
    const abertas = bbs.filter(b => Cobranca.situacao(b).acesso);
    app.innerHTML = `<div class="home"><div class="home-in">
      <header class="home-cab">
        <span class="marca"><span class="marca-icone">${ic('tesoura')}</span><span class="marca-txt"><b style="color:#fff">${APP.nome}</b><small>versão de demonstração</small></span></span>
        <span class="badge destaque">${ic('info')} Dados de teste</span>
      </header>
      <h1>Agenda cheia, <em>sem ficar no WhatsApp</em> o dia todo.</h1>
      <p class="home-lead" style="margin-bottom:0">Para barbearias e salões de beleza.</p>
      <p class="home-lead">O sistema tem três frentes. Escolha uma para testar. Tudo o que você fizer fica salvo neste navegador.</p>
      <div class="home-grade">
        <section class="home-card">
          <span class="n">${ic('coroa')}</span>
          <h2>1. Administração do sistema</h2>
          <p>Para você, dono da plataforma: barbearias e salões clientes, planos, mensalidades, cobrança pelo WhatsApp, inadimplência, bloqueio e inativação.</p>
          <p class="muted" style="font-size:13px">Senha de teste: <b style="color:#fff">admin</b></p>
          <a class="btn pri grande" href="#/admin">Entrar na administração ${ic('direita')}</a>
        </section>
        <section class="home-card">
          <span class="n">${ic('loja')}</span>
          <h2>2. Painel do estabelecimento</h2>
          <p>Para o dono e a equipe: agenda do dia, serviços e produtos com foto e preço, equipe, clientes e faturamento.</p>
          <p class="muted" style="font-size:13px">PIN de teste: dono <b style="color:#fff">1234</b> · equipe <b style="color:#fff">1111</b>, <b style="color:#fff">2222</b>, <b style="color:#fff">3333</b></p>
          <div class="home-lista">${bbs.map(b => item(b, `#/${b.slug}/painel`)).join('')}</div>
        </section>
        <section class="home-card">
          <span class="n">${ic('mensagem')}</span>
          <h2>3. Agendamento do cliente</h2>
          <p>O link que o estabelecimento divulga: uma conversa que leva o cliente até o horário marcado, com catálogo, dias livres e horários.</p>
          <div class="home-lista">${abertas.map(b => item(b, `#/${b.slug}`, '/' + b.slug)).join('')}</div>
        </section>
      </div>
      <p class="home-dica">${ic('info')}<span><b>Teste em duas abas:</b> abra o painel da Navalha de Ouro (ou do salão Espaço Lumière) numa aba e o agendamento do cliente em outra. O horário marcado no chat aparece na agenda na mesma hora.</span></p>
    </div></div>`;
  }
};

Store.carregar();
window.addEventListener('hashchange', () => Rotas.render());
Rotas.render();
