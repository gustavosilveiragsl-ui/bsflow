'use strict';
/* Qual servidor o site usa.
   - site oficial (bsflow.app.br ou github.io): produção
   - demonstração (/demo/ ou ?demo): nenhum, os dados ficam no navegador
   - no computador (localhost): demonstração; com ?nuvem=teste usa o projeto de testes
   As chaves abaixo são públicas (feitas para ficar no site); quem protege os dados
   são as regras de acesso do banco. */
window.NUVEM_CONFIG = (() => {
  const SERVIDORES = {
    producao: { nome: 'produção', url: 'https://jmpzcqosqkisavkdloat.supabase.co', chave: 'sb_publishable_12mogFXOiAyT4SvYDqldjw_Fm-qt-c4' },
    teste: { nome: 'testes', url: 'https://ojysjmfbxxlpsjnamtdy.supabase.co', chave: 'sb_publishable_I8GWLRKYawppPvUXNoA59w_hvdXigks' }
  };
  const q = new URLSearchParams(location.search);
  if (window.BSFLOW_DEMO || q.has('demo')) return null;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return SERVIDORES[q.get('nuvem')] || null;
  return SERVIDORES[q.get('nuvem')] || SERVIDORES.producao;
})();
