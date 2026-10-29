'use strict';
/* ============================================================
   App no celular (PWA): instalação pela tela inicial, ícone com o nome
   do estabelecimento e notificações no aparelho.
   O painel e o chat de cada estabelecimento viram apps separados.
   ============================================================ */
const PWA = {
  pedido: null, // evento de instalação do Chrome/Android
  _url: null,

  iniciar() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.pedido = e; });
    window.addEventListener('appinstalled', () => { this.pedido = null; UI.toast('App instalado.'); });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e));
    }
  },
  instalado() { return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent); },

  // ícone quadrado com a cor e as iniciais (ou o logo) do estabelecimento
  icone(tam, { cor = '#c9a227', texto = 'BS', logo = null } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = tam;
    const g = c.getContext('2d');
    g.fillStyle = cor;
    g.fillRect(0, 0, tam, tam);
    if (logo && this._img?.src === logo && this._img.complete && this._img.naturalWidth) {
      const k = 0.78, l = tam * k;
      g.drawImage(this._img, (tam - l) / 2, (tam - l) / 2, l, l);
    } else {
      g.fillStyle = UI.corTexto(cor);
      g.font = `800 ${Math.round(tam * 0.38)}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(texto).slice(0, 2), tam / 2, tam / 2 + tam * 0.02);
    }
    return c.toDataURL('image/png');
  },
  /* Troca o "manifesto" da página: nome, ícone e endereço que abre quando o app é instalado. */
  configurar({ nome, curto, cor = '#c9a227', logo = null, texto = 'BS', inicio = location.href }) {
    try {
      if (logo && this._img?.src !== logo) { this._img = new Image(); this._img.onload = () => this.configurar({ nome, curto, cor, logo, texto, inicio }); this._img.src = logo; }
      const base = document.baseURI.split('#')[0].replace(/[^/]*$/, ''); // respeita o <base> da demonstração
      const manifesto = {
        id: inicio.replace(location.origin, ''), name: nome, short_name: (curto || nome).slice(0, 18), start_url: inicio, scope: base,
        display: 'standalone', background_color: '#110f0c', theme_color: cor, lang: 'pt-BR',
        icons: [192, 512].map(t => ({ src: this.icone(t, { cor, texto, logo }), sizes: `${t}x${t}`, type: 'image/png', purpose: 'any' }))
          .concat([{ src: base + 'icones/app-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'icones/app-512.png', sizes: '512x512', type: 'image/png' }])
      };
      if (this._url) URL.revokeObjectURL(this._url);
      this._url = URL.createObjectURL(new Blob([JSON.stringify(manifesto)], { type: 'application/manifest+json' }));
      const pegar = (sel, criar) => document.head.querySelector(sel) || document.head.appendChild(criar());
      pegar('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest' })).href = this._url;
      pegar('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement('link'), { rel: 'apple-touch-icon' })).href = this.icone(180, { cor, texto, logo });
      pegar('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title' })).content = (curto || nome).slice(0, 18);
      pegar('meta[name="apple-mobile-web-app-capable"]', () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-capable' })).content = 'yes';
      pegar('meta[name="theme-color"]', () => Object.assign(document.createElement('meta'), { name: 'theme-color' })).content = cor;
      if (this.ios() && !this.instalado()) this.marcarRota();
    } catch (e) { console.warn('manifesto', e); }
  },
  /* iPhone: o "Adicionar à Tela de Início" guarda o endereço da tela, mas nem sempre o que vem depois do #.
     A tela vai também no ?app=, e o app instalado abre direto nela (ver Rotas.inicioDoApp). */
  marcarRota() {
    const u = new URL(location.href), rota = location.hash.replace(/^#/, '');
    if (rota && rota !== '/') u.searchParams.set('app', rota); else u.searchParams.delete('app');
    const novo = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + location.hash;
    if (novo !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', novo);
  },
  async instalar() {
    if (this.instalado()) return UI.toast('O app já está instalado neste aparelho.', 'info');
    if (this.pedido) {
      this.pedido.prompt();
      const r = await this.pedido.userChoice.catch(() => null);
      this.pedido = null;
      if (r?.outcome === 'accepted') UI.toast('Pronto! O app foi para a tela inicial.');
      return;
    }
    const passos = this.ios()
      ? `<ol class="passos"><li>Toque em <b>Compartilhar</b> ${ic('compartilhar')} na barra do Safari.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>. O app aparece com o ícone do estabelecimento.</li></ol>`
      : `<ol class="passos"><li>Abra o menu do navegador ${ic('reticencias')} (os três pontinhos).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme. O app aparece com o ícone do estabelecimento.</li></ol>`;
    UI.modal({ titulo: 'Instalar o app no celular', classe: 'pequeno', corpo: `<p class="texto-modal" style="margin-bottom:12px">Não precisa de loja: o app é instalado direto pelo navegador.</p>${passos}`, rodape: '<button class="btn pri" data-fechar>Entendi</button>' });
  },
  async pedirPermissao() {
    if (!('Notification' in window)) return false;
    let ok = Notification.permission === 'granted';
    if (!ok && Notification.permission !== 'denied') ok = (await Notification.requestPermission()) === 'granted';
    // versão oficial: inscreve o aparelho no servidor para receber os avisos mesmo com o app fechado
    if (ok && typeof Nuvem !== 'undefined' && Nuvem.ativo) await Nuvem.inscreverPush().catch(e => console.warn('push', e));
    return ok;
  },
  async notificar(titulo, corpo, url) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return false;
      const reg = await navigator.serviceWorker?.getRegistration?.();
      const icone = document.head.querySelector('link[rel="apple-touch-icon"]')?.href;
      if (reg) await reg.showNotification(titulo, { body: corpo, icon: icone, badge: icone, data: { url: url || location.href }, tag: 'bsflow-' + Date.now() });
      else new Notification(titulo, { body: corpo, icon: icone });
      return true;
    } catch (e) { console.warn('notificação', e); return false; }
  },
  textoSituacao() {
    const n = !('Notification' in window) ? 'este navegador não mostra notificações' : Notification.permission === 'granted' ? 'notificações ativas neste aparelho' : Notification.permission === 'denied' ? 'notificações bloqueadas no navegador' : 'notificações ainda não ativadas';
    const fechado = typeof Nuvem !== 'undefined' && Nuvem.ativo
      ? 'Os avisos chegam mesmo com o app fechado' + (this.ios() ? ' (no iPhone, com o app instalado na tela de início).' : '.')
      : 'Com o app aberto em segundo plano chega aviso de novo agendamento; na versão oficial chega mesmo com o app fechado.';
    return `${this.instalado() ? 'App instalado' : 'Abrindo pelo navegador'} · ${n}. ${fechado}`;
  }
};
PWA.iniciar();
