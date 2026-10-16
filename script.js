/* =====================================================================
   Glossário Libras Brasil — protótipo demonstrativo
   ---------------------------------------------------------------------
   JavaScript puro, sem frameworks e sem conexão com a internet.
   - Navegação por hash (#/inicio, #/explorar, #/sinal/ID ...), o que
     permite abrir o index.html direto do disco (file://).
   - Dados persistidos em localStorage (chave GLB_CHAVE).
   - Vídeos enviados ficam no IndexedDB do navegador, quando possível.
   - Regras do sistema (ver README):
       1. Nota comunitária, revisão profissional e região são dimensões
          separadas. A nota NUNCA concede selo e nunca apaga um registro.
       2. Variantes diferentes de um mesmo conceito convivem.
       3. Todo parecer fica no histórico; nada é sobrescrito.
   ===================================================================== */
(function () {
  'use strict';

  var GLB_CHAVE = 'glb_dados_v1';
  var CHAVE_VOTANTE = 'glb_votante';
  var VERSAO_DADOS = 1;
  var DIA = 86400000;
  var LIMITE_VIDEO = 150 * 1024 * 1024; // acima disso não tentamos guardar

  var main = document.getElementById('conteudo');
  var modal = document.getElementById('modal');
  var modalTitulo = document.getElementById('modal-titulo');
  var modalCorpo = document.getElementById('modal-corpo');

  /* ---------------------------------------------------------------
     Vocabulário do sistema
     --------------------------------------------------------------- */
  var STATUS = {
    novo: {
      rotulo: 'Novo registro', longo: 'Novo registro — aguardando revisão', icone: 'i-novo',
      desc: 'Registro recém-enviado pela comunidade. Ainda não passou por revisão profissional e já pode ser consultado e avaliado.'
    },
    em_revisao: {
      rotulo: 'Em revisão', longo: 'Em revisão', icone: 'i-relogio',
      desc: 'Um revisor iniciou a análise. Ainda não há parecer conclusivo.'
    },
    revisado: {
      rotulo: 'Revisado por profissional', longo: 'Revisado por profissional', icone: 'i-selo',
      desc: 'Recebeu parecer profissional favorável, dentro do escopo indicado no selo. Não torna incorretas outras variantes do mesmo conceito.'
    },
    divergencia: {
      rotulo: 'Com divergências', longo: 'Com divergências', icone: 'i-divergencia',
      desc: 'Revisores apresentaram pareceres diferentes. O registro continua disponível para consulta enquanto a análise segue, e todos os pareceres ficam visíveis.'
    },
    atualizacao: {
      rotulo: 'Atualização solicitada', longo: 'Atualização solicitada', icone: 'i-atualizar',
      desc: 'Um revisor pediu ajustes, por exemplo na descrição ou na gravação. O registro continua disponível para consulta.'
    }
  };
  var ORDEM_STATUS = ['novo', 'em_revisao', 'revisado', 'divergencia', 'atualizacao'];

  var DECISOES = {
    validar: { rotulo: 'Validar registro', curto: 'Validou o registro', status: 'revisado',
      ajuda: 'O conteúdo corresponde ao significado e ao contexto informados.' },
    correcao: { rotulo: 'Solicitar correção', curto: 'Solicitou correção', status: 'atualizacao',
      ajuda: 'O autor precisa ajustar a descrição, a gravação ou a indicação regional.' },
    variante: { rotulo: 'Identificar variante regional', curto: 'Identificou como variante regional', status: 'revisado',
      ajuda: 'O sinal é uma variante legítima de outro registro. Os dois permanecem disponíveis.' },
    divergencia: { rotulo: 'Marcar divergência para análise', curto: 'Marcou divergência para análise', status: 'divergencia',
      ajuda: 'Há dúvida ou discordância que precisa de mais análise. Nada é apagado.' }
  };

  var ESCOPOS = {
    correspondencia: 'Correspondência entre sinal e significado',
    contexto: 'Descrição e contexto de uso',
    regiao: 'Indicação regional ou comunitária',
    video: 'Qualidade da gravação'
  };

  var CLAREZA = { 1: 'Pouco claro', 2: 'Razoável', 3: 'Muito claro' };
  var CORRESPONDE = { sim: 'Descrição corresponde', parcial: 'Corresponde em parte', nao: 'Não corresponde' };
  var TIPOS_SUGESTAO = {
    descricao: 'Correção na descrição ou no significado',
    video: 'Problema na gravação',
    regiao: 'Correção na região ou comunidade',
    variante: 'Variante regional indicada',
    denuncia: 'Denúncia de conteúdo inadequado'
  };
  var PERIODOS = { '': 'Qualquer data', '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', '90': 'Últimos 90 dias', '365': 'Últimos 12 meses' };
  var ORDENS = { recentes: 'Mais recentes', antigos: 'Mais antigos', nota: 'Maior nota', avaliacoes: 'Mais avaliações' };

  /* ---------------------------------------------------------------
     Estado da interface (não persistido)
     --------------------------------------------------------------- */
  var estado = null;               // dados persistidos
  var filtros = { q: '', regiao: '', status: '', periodo: '', ordem: 'recentes' };
  var filaFiltro = 'todos';         // filtro da fila no painel de revisão
  var revisorAtual = '';            // revisor escolhido no painel
  var comunidadeFiltro = 'todos';   // filtro da lista "Avaliar registros"
  var videosSessao = {};            // id -> URL temporária (vídeos não armazenados)
  var rotaAnterior = '';
  var opener = null;                // elemento que abriu o modal (devolve o foco)
  var focoPendente = null;          // seletor a focar depois do próximo desenho da tela

  /* ---------------------------------------------------------------
     Utilitários
     --------------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function isoDiasAtras(d) {
    var dt = new Date(Date.now() - d * DIA);
    dt.setHours(10 + (d % 7), (d * 13) % 60, 0, 0);
    return dt.toISOString();
  }
  function fmtData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
  }
  function fmtNum(n) { return n.toFixed(1).replace('.', ','); }
  function hojeInput() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function iniciais(nome) {
    return nome.replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase();
  }
  function icone(nome, cls) { return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#' + nome + '"/></svg>'; }
  function porData(campo, desc) {
    return function (a, b) { var x = new Date(a[campo]) - new Date(b[campo]); return desc ? -x : x; };
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function avisar(msg) {
    var el = document.getElementById('aviso');
    el.textContent = msg;
    el.classList.add('visivel');
    clearTimeout(avisar._t);
    avisar._t = setTimeout(function () { el.classList.remove('visivel'); }, 3400);
  }

  function votanteId() {
    var id = null;
    try { id = localStorage.getItem(CHAVE_VOTANTE); } catch (e) { /* sem storage */ }
    if (!id) {
      id = uid('v');
      try { localStorage.setItem(CHAVE_VOTANTE, id); } catch (e) { /* sem storage */ }
    }
    return id;
  }

  /* ---------------------------------------------------------------
     Dados: semente, carregamento e gravação
     --------------------------------------------------------------- */
  function construirSemente() {
    var seed = window.GLB_SEED;
    var perfis = seed.perfis.map(function (p) {
      var c = Object.assign({}, p);
      c.desde = isoDiasAtras(p.desde);
      return c;
    });
    var nomePerfil = function (id) { var p = perfis.find(function (x) { return x.id === id; }); return p ? p.nome : 'Autor'; };

    var sinais = seed.sinais.map(function (s) {
      var r = {
        id: s.id, termo: s.termo, significado: s.significado, contexto: s.contexto,
        regiao: s.regiao, comunidade: s.comunidade, local: s.local, fonte: s.fonte,
        autorId: s.autorId, status: s.status, denuncias: s.denuncias || 0,
        dataSubmissao: isoDiasAtras(s.dias), base: Object.assign({}, s.base),
        relacionadas: (s.relacionadas || []).slice(), video: null, demonstrativo: true
      };
      r.avaliacoes = (s.avaliacoes || []).map(function (a) {
        return { id: uid('a'), autor: a.autor, data: isoDiasAtras(a.dias), nota: a.nota, clareza: a.clareza,
          corresponde: a.corresponde, comentario: a.comentario || '', variante: !!a.variante, votante: null };
      });
      r.pareceres = (s.pareceres || []).map(function (p) {
        return { id: uid('p'), revisorId: p.revisorId, data: isoDiasAtras(p.dias), decisao: p.decisao, escopo: p.escopo.slice(), texto: p.texto };
      });
      r.sugestoes = (s.sugestoes || []).map(function (g) {
        return { id: uid('g'), autor: g.autor, data: isoDiasAtras(g.dias), tipo: g.tipo, texto: g.texto };
      });
      r.comentarios = (s.comentarios || []).map(function (c) {
        return { id: uid('c'), autor: c.autor, data: isoDiasAtras(c.dias), texto: c.texto };
      });
      // Histórico montado a partir dos eventos de demonstração
      var h = [{ data: r.dataSubmissao, tipo: 'envio', texto: 'Registro enviado por ' + nomePerfil(r.autorId) + '.' }];
      (s.historicoExtra || []).forEach(function (e) { h.push({ data: isoDiasAtras(e.dias), tipo: e.tipo, texto: e.texto }); });
      r.sugestoes.forEach(function (g) {
        h.push({ data: g.data, tipo: 'sugestao', texto: (g.tipo === 'denuncia' ? 'Denúncia registrada pela comunidade.' : 'Sugestão da comunidade: ' + TIPOS_SUGESTAO[g.tipo].toLowerCase() + '.') });
      });
      r.pareceres.forEach(function (p) {
        h.push({ data: p.data, tipo: 'parecer', texto: 'Parecer de ' + nomePerfil(p.revisorId) + ': ' + DECISOES[p.decisao].curto.toLowerCase() + '.' });
      });
      r.historico = h.sort(porData('data'));
      return r;
    });

    return { versao: VERSAO_DADOS, criadoEm: new Date().toISOString(), regioes: seed.regioes.slice(), perfis: perfis, sinais: sinais };
  }

  function carregar() {
    var dados = null;
    try { dados = JSON.parse(localStorage.getItem(GLB_CHAVE)); } catch (e) { dados = null; }
    if (!dados || dados.versao !== VERSAO_DADOS || !Array.isArray(dados.sinais)) {
      dados = construirSemente();
      estado = dados;
      salvar();
    }
    estado = dados;
  }

  function salvar() {
    try {
      localStorage.setItem(GLB_CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      avisar('Não foi possível salvar neste navegador. As mudanças valem só até fechar a página.');
      return false;
    }
  }

  /* Vídeos: IndexedDB (blobs não cabem no localStorage). */
  var Videos = {
    abrir: function () {
      return new Promise(function (ok, falha) {
        try {
          if (!window.indexedDB) { falha(new Error('IndexedDB indisponível')); return; }
          var req = indexedDB.open('glb_videos', 1);
          req.onupgradeneeded = function () { req.result.createObjectStore('videos'); };
          req.onsuccess = function () { ok(req.result); };
          req.onerror = function () { falha(req.error); };
        } catch (e) { falha(e); }
      });
    },
    operar: function (modo, fn) {
      return Videos.abrir().then(function (db) {
        return new Promise(function (ok, falha) {
          var tx = db.transaction('videos', modo);
          var res;
          var req = fn(tx.objectStore('videos'));
          if (req) req.onsuccess = function () { res = req.result; };
          tx.oncomplete = function () { db.close(); ok(res); };
          tx.onerror = tx.onabort = function () { db.close(); falha(tx.error || new Error('Falha no IndexedDB')); };
        });
      });
    },
    salvar: function (id, blob) { return Videos.operar('readwrite', function (st) { return st.put(blob, id); }); },
    ler: function (id) { return Videos.operar('readonly', function (st) { return st.get(id); }); },
    limpar: function () { return Videos.operar('readwrite', function (st) { return st.clear(); }).catch(function () {}); }
  };

  /* ---------------------------------------------------------------
     Consultas derivadas
     --------------------------------------------------------------- */
  function sinal(id) { return estado.sinais.find(function (s) { return s.id === id; }); }
  function perfil(id) { return estado.perfis.find(function (p) { return p.id === id; }); }
  function nomeDe(id) { var p = perfil(id); return p ? p.nome : 'Autor não identificado'; }
  function revisores() { return estado.perfis.filter(function (p) { return p.tipo === 'revisor'; }); }

  function media(s) {
    var soma = s.base.soma, qtd = s.base.qtd;
    s.avaliacoes.forEach(function (a) { soma += a.nota; qtd += 1; });
    return { media: qtd ? soma / qtd : 0, qtd: qtd };
  }
  function baixaAvaliacao(s) { var m = media(s); return m.qtd >= 3 && m.media < 3; }
  function ultimaRevisao(s) {
    if (!s.pareceres.length) return null;
    return s.pareceres.slice().sort(porData('data', true))[0].data;
  }
  function relacionadas(s) { return s.relacionadas.map(sinal).filter(Boolean); }
  function mesmoTermo(s) {
    var t = normalizar(s.termo);
    return estado.sinais.filter(function (x) { return normalizar(x.termo) === t; }).sort(porData('dataSubmissao'));
  }
  function rotuloVariante(s) {
    var grupo = mesmoTermo(s);
    if (grupo.length < 2) return '';
    return 'Variante ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(grupo.indexOf(s));
  }
  function minhaAvaliacao(s) {
    var v = votanteId();
    return s.avaliacoes.find(function (a) { return a.votante === v; });
  }
  function naFila(s) { return s.status !== 'revisado' || baixaAvaliacao(s) || s.denuncias > 0; }

  /* ---------------------------------------------------------------
     Componentes de interface (HTML como texto)
     --------------------------------------------------------------- */
  function seloHTML(s, opts) {
    opts = opts || {};
    var st = STATUS[s.status];
    var cls = 'selo selo-' + s.status + (opts.grande ? ' selo-g' : '');
    var rot = opts.longo ? st.longo : st.rotulo;
    if (opts.estatico) return '<span class="' + cls + ' selo-estatico">' + icone(st.icone) + esc(rot) + '</span>';
    return '<button type="button" class="' + cls + '" data-acao="selo" data-id="' + esc(s.id) + '" aria-haspopup="dialog">' +
      icone(st.icone) + esc(rot) + '<span class="sr-only">: consultar detalhes da validação</span></button>';
  }

  function notaHTML(s) {
    var m = media(s);
    if (!m.qtd) return '<span class="nota">Sem avaliações ainda</span>';
    var cheias = Math.round(m.media), est = '';
    for (var i = 1; i <= 5; i++) est += '<svg class="ic' + (i <= cheias ? ' cheia' : '') + '" aria-hidden="true"><use href="#i-estrela"/></svg>';
    return '<span class="nota"><span class="estrelas" aria-hidden="true">' + est + '</span>' +
      '<strong aria-hidden="true">' + fmtNum(m.media) + '</strong><span aria-hidden="true">(' + m.qtd + ')</span>' +
      '<span class="sr-only">Nota comunitária ' + fmtNum(m.media) + ' de 5, com ' + plural(m.qtd, 'avaliação', 'avaliações') + '</span></span>';
  }

  function semValidacaoHTML(s) {
    if (s.status === 'revisado') return '';
    return '<span class="sem-validacao">' + icone('i-info') + 'Sem validação profissional</span>';
  }

  function midiaMiniHTML(s) {
    var titulo = 'Vídeo demonstrativo não disponível', icn = 'i-video-off', det = 'Área preparada para a gravação do sinal';
    if (s.video) { icn = 'i-video'; titulo = 'Vídeo enviado pelo autor'; det = s.video.armazenado ? 'Guardado neste navegador' : 'Arquivo não armazenado'; }
    return '<div class="midia midia-mini"><div class="midia-conteudo">' + icone(icn) +
      '<span class="midia-titulo">' + titulo + '</span><span class="midia-detalhe">' + det + '</span></div></div>';
  }

  function cartaoSinalHTML(s, nivel) {
    var tag = nivel || 'h3';
    var v = rotuloVariante(s);
    return '<article class="cartao-sinal">' + midiaMiniHTML(s) +
      '<div class="cartao-corpo">' +
        '<div class="cartao-topo"><div>' + (v ? '<span class="cartao-variante">' + v + '</span>' : '') +
          '<' + tag + '><a href="#/sinal/' + esc(s.id) + '">' + esc(s.termo) + '</a></' + tag + '></div></div>' +
        '<p class="cartao-significado">' + esc(s.significado) + '</p>' +
        '<div class="meta"><span>' + icone('i-local') + esc(s.regiao) + (s.local ? ' · ' + esc(s.local) : '') + '</span>' +
          '<span>' + icone('i-calendario') + 'Enviado em ' + fmtData(s.dataSubmissao) + '</span></div>' +
        '<div>' + notaHTML(s) + '</div>' +
        '<div class="cartao-rodape">' + seloHTML(s) + semValidacaoHTML(s) + '</div>' +
      '</div></article>';
  }

  function vazioHTML(titulo, texto, acoes) {
    return '<div class="vazio">' + icone('i-busca') + '<h3>' + titulo + '</h3><p>' + texto + '</p>' +
      (acoes ? '<div class="acoes">' + acoes + '</div>' : '') + '</div>';
  }

  function avatarHTML(p, grande) {
    return '<span class="avatar ' + p.tipo + (grande ? ' g' : '') + '" aria-hidden="true">' + esc(iniciais(p.nome)) + '</span>';
  }

  function opcoesHTML(mapa, atual) {
    return Object.keys(mapa).map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === atual ? ' selected' : '') + '>' + esc(mapa[k]) + '</option>';
    }).join('');
  }
  function opcoesRegiao(atual, primeira) {
    return '<option value="">' + primeira + '</option>' + estado.regioes.map(function (r) {
      return '<option' + (r === atual ? ' selected' : '') + '>' + esc(r) + '</option>';
    }).join('');
  }
  function opcoesStatus(atual) {
    return '<option value="">Todas as situações</option>' + ORDEM_STATUS.map(function (k) {
      return '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + STATUS[k].rotulo + '</option>';
    }).join('');
  }
  function opcoesSinais(excluir, selecionado) {
    return estado.sinais.filter(function (x) { return excluir.indexOf(x.id) === -1; })
      .sort(function (a, b) { return a.termo.localeCompare(b.termo, 'pt-BR') || (new Date(a.dataSubmissao) - new Date(b.dataSubmissao)); })
      .map(function (x) {
        var v = rotuloVariante(x);
        return '<option value="' + esc(x.id) + '"' + (x.id === selecionado ? ' selected' : '') + '>' +
          esc(x.termo + (v ? ' (' + v + ')' : '') + ' — ' + x.regiao) + '</option>';
      }).join('');
  }

  function linhaTempoHTML(itens) {
    if (!itens.length) return '<p class="texto-suave">Sem registros no histórico.</p>';
    return '<ol class="linha-tempo">' + itens.map(function (h) {
      return '<li class="t-' + esc(h.tipo) + '"><span class="lt-data">' + fmtData(h.data) + '</span>' +
        '<p class="lt-texto">' + esc(h.texto) + '</p></li>';
    }).join('') + '</ol>';
  }

  /* ---------------------------------------------------------------
     Navegação (rotas por hash)
     --------------------------------------------------------------- */
  function lerRota() {
    var h = location.hash.replace(/^#\/?/, '');
    var partes = h.split('?');
    var params = {};
    if (partes[1]) partes[1].split('&').forEach(function (par) {
      var kv = par.split('=');
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    var caminho = (partes[0] || 'inicio').split('/').filter(Boolean);
    return { nome: caminho[0] || 'inicio', args: caminho.slice(1), params: params, chave: partes[0] || 'inicio' };
  }

  function ir(hash) {
    if (location.hash === hash) renderizar(); else location.hash = hash;
  }

  function renderizar(opcoes) {
    opcoes = opcoes || {};
    var r = lerRota();
    var y = window.scrollY;
    var telas = {
      inicio: telaInicio, explorar: telaExplorar, sinal: telaSinal, enviar: telaEnviar,
      comunidade: telaComunidade, perfil: telaPerfil, revisao: telaRevisao, sobre: telaSobre
    };
    var fn = telas[r.nome] || telaNaoEncontrada;
    var titulo = fn(r) || 'Página não encontrada';
    document.title = titulo + ' · Glossário Libras Brasil';

    // Marca o item ativo do menu
    var grupo = { sinal: 'explorar', perfil: 'comunidade' }[r.nome] || r.nome;
    document.querySelectorAll('[data-rota]').forEach(function (a) {
      if (a.getAttribute('data-rota') === grupo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    fecharMenu();

    if (opcoes.manterPosicao) {
      window.scrollTo(0, y);
    } else if (r.chave !== rotaAnterior) {
      window.scrollTo(0, 0);
      var h1 = main.querySelector('h1');
      if (h1 && rotaAnterior) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
    rotaAnterior = r.chave;
    if (focoPendente) {
      var el = main.querySelector(focoPendente);
      focoPendente = null;
      if (el) el.focus();
    }
  }

  /* ---------------------------------------------------------------
     Tela A — Início
     --------------------------------------------------------------- */
  function telaInicio() {
    var total = estado.sinais.length;
    var variantes = estado.sinais.filter(function (s) { return s.relacionadas.length > 0; }).length;
    var revisados = estado.sinais.filter(function (s) { return s.pareceres.length > 0; }).length;
    var recentes = estado.sinais.slice().sort(porData('dataSubmissao', true)).slice(0, 4);
    var validados = estado.sinais.filter(function (s) { return s.status === 'revisado'; })
      .sort(function (a, b) { return new Date(ultimaRevisao(b)) - new Date(ultimaRevisao(a)); }).slice(0, 4);

    // Agrupa conceitos com mais de uma variante
    var grupos = {};
    estado.sinais.forEach(function (s) { var k = normalizar(s.termo); (grupos[k] = grupos[k] || []).push(s); });
    var gruposVar = Object.keys(grupos).map(function (k) { return grupos[k]; })
      .filter(function (g) { return g.length > 1; })
      .sort(function (a, b) { return b.length - a.length || a[0].termo.localeCompare(b[0].termo, 'pt-BR'); });

    main.innerHTML =
      '<section class="hero"><div class="container hero-grade">' +
        '<div>' +
          '<span class="sobretitulo">Glossário nacional colaborativo</span>' +
          '<h1 class="titulo-display">Encontre, compare e valide sinais de Libras.</h1>' +
          '<p class="subtitulo">A comunidade envia e avalia sinais, profissionais revisam com identificação e cada variante regional tem seu lugar, com histórico aberto.</p>' +
          '<form class="busca-destaque" data-form="busca-inicio" role="search">' +
            '<label for="busca-inicio">Qual sinal você está procurando?</label>' +
            '<div class="busca-campo">' + icone('i-busca') +
              '<input id="busca-inicio" name="q" type="search" placeholder="Digite uma palavra ou expressão" autocomplete="off">' +
              '<button class="btn btn-escuro" type="submit">Pesquisar</button></div>' +
            '<div class="busca-sugestoes"><span>Experimente:</span>' +
              ['Saudade', 'Família', 'Trabalho', 'Aprender'].map(function (t) {
                return '<button type="button" class="chip-link" data-acao="buscar-termo" data-termo="' + t + '">' + t + '</button>';
              }).join('') + '</div>' +
          '</form>' +
          '<div class="hero-acoes">' +
            '<a class="btn btn-primario btn-g" href="#/explorar">Explorar o glossário ' + icone('i-seta') + '</a>' +
            '<a class="btn btn-contorno btn-g" href="#/enviar">' + icone('i-enviar') + 'Enviar um sinal</a>' +
          '</div>' +
        '</div>' +
        '<aside class="indicadores" aria-labelledby="titulo-indicadores">' +
          '<h2 id="titulo-indicadores">Indicadores</h2>' +
          '<p class="nota-demo">' + icone('i-info') + 'Dados demonstrativos deste protótipo</p>' +
          '<dl>' +
            '<div class="indicador"><dt>Sinais cadastrados</dt><dd>' + total + '</dd></div>' +
            '<div class="indicador"><dt>Variantes documentadas</dt><dd>' + variantes + '</dd></div>' +
            '<div class="indicador"><dt>Registros revisados</dt><dd>' + revisados + '</dd></div>' +
          '</dl>' +
        '</aside>' +
      '</div></section>' +

      '<section class="secao" aria-labelledby="t-recentes"><div class="container">' +
        '<div class="secao-cabecalho"><div><h2 id="t-recentes" class="titulo-secao">Enviados recentemente</h2>' +
          '<p>Registros novos aparecem logo, com a indicação de que ainda não foram revisados.</p></div>' +
          '<a class="btn btn-fantasma" href="#/explorar?ordem=recentes">Ver todos ' + icone('i-seta') + '</a></div>' +
        '<div class="grade-cartoes quatro">' + recentes.map(function (s) { return cartaoSinalHTML(s); }).join('') + '</div>' +
      '</div></section>' +

      '<section class="secao" aria-labelledby="t-validados"><div class="container">' +
        '<div class="secao-cabecalho"><div><h2 id="t-validados" class="titulo-secao">Revisados por profissionais</h2>' +
          '<p>Cada selo mostra quem emitiu o parecer, quando e qual foi o escopo da revisão.</p></div>' +
          '<a class="btn btn-fantasma" href="#/explorar?status=revisado">Ver revisados ' + icone('i-seta') + '</a></div>' +
        (validados.length ? '<div class="grade-cartoes quatro">' + validados.map(function (s) { return cartaoSinalHTML(s); }).join('') + '</div>'
          : vazioHTML('Nenhum registro revisado ainda', 'Use o painel de revisão para registrar um parecer.', '')) +
      '</div></section>' +

      '<section class="secao" aria-labelledby="t-variantes"><div class="container">' +
        '<div class="secao-cabecalho"><div><h2 id="t-variantes" class="titulo-secao">Variantes regionais</h2>' +
          '<p>Um mesmo conceito pode ter sinais diferentes em cada região ou comunidade. Diferente não quer dizer incorreto.</p></div></div>' +
        '<div class="lista-variantes">' + gruposVar.map(function (g) {
          return '<div class="grupo-variante"><h3>' + esc(g[0].termo) + ' <span>' + plural(g.length, 'variante', 'variantes') + '</span></h3><ul>' +
            g.sort(porData('dataSubmissao')).map(function (s) {
              return '<li><a href="#/sinal/' + esc(s.id) + '"><span class="regiao-nome">' + icone('i-local', 'ic-p') + esc(rotuloVariante(s)) + ' · ' + esc(s.regiao) + '</span>' +
                seloHTML(s, { estatico: true }) + '</a></li>';
            }).join('') + '</ul></div>';
        }).join('') + '</div>' +
        '<p class="nota-demo" style="margin-top:16px">' + icone('i-info') + 'As regiões atribuídas aos registros são fictícias e não descrevem o uso real dos sinais.</p>' +
      '</div></section>' +

      '<section class="secao" aria-labelledby="t-como"><div class="container">' +
        '<div class="secao-cabecalho"><div><h2 id="t-como" class="titulo-secao">Como funciona a validação colaborativa</h2>' +
          '<p>Quatro etapas, todas registradas no histórico de cada sinal.</p></div></div>' +
        '<ol class="passos">' +
          '<li><h3>Alguém envia um sinal</h3><p>Com vídeo, significado, contexto de uso e a região ou comunidade onde é usado.</p></li>' +
          '<li><h3>A comunidade avalia</h3><p>Notas, clareza, sugestões de correção e indicação de variantes. Notas baixas levam o registro à fila de análise.</p></li>' +
          '<li><h3>Profissionais revisam</h3><p>Validam, pedem correção, identificam variantes ou marcam divergência, sempre com nome e escopo.</p></li>' +
          '<li><h3>O selo fica transparente</h3><p>Qualquer pessoa consulta quem revisou, quando e o quê. Pareceres anteriores nunca são apagados.</p></li>' +
        '</ol>' +
        '<div class="dimensoes">' +
          '<div class="dimensao"><h3>' + icone('i-estrela') + 'Avaliação comunitária</h3><p>Mostra o quanto o registro ajuda quem consulta. Não concede selo profissional.</p></div>' +
          '<div class="dimensao"><h3>' + icone('i-selo') + 'Revisão profissional</h3><p>Parecer identificado de quem revisou, com data e escopo definidos.</p></div>' +
          '<div class="dimensao"><h3>' + icone('i-local') + 'Região e contexto</h3><p>Onde e em que situação o sinal é usado. Variantes convivem lado a lado.</p></div>' +
        '</div>' +
      '</div></section>' +

      '<section class="secao"><div class="container"><div class="faixa-noite">' +
        '<div><h2>Conhece um sinal que <span class="destaque">ainda não está aqui</span>?</h2>' +
          '<p>Envie um registro com vídeo e contexto. Ele entra como novo registro e segue para avaliação da comunidade e revisão profissional.</p></div>' +
        '<div class="acoes"><a class="btn btn-ciano btn-g" href="#/enviar">' + icone('i-enviar') + 'Enviar um sinal</a>' +
          '<a class="btn btn-claro btn-g" href="#/revisao">Ver o painel de revisão</a></div>' +
      '</div></div></section>';

    return 'Início';
  }

  /* ---------------------------------------------------------------
     Tela B — Explorar
     --------------------------------------------------------------- */
  function aplicarParams(params) {
    var chaves = ['q', 'regiao', 'status', 'periodo', 'ordem'];
    if (!chaves.some(function (k) { return k in params; })) return;
    filtros = { q: '', regiao: '', status: '', periodo: '', ordem: 'recentes' };
    chaves.forEach(function (k) { if (params[k] != null) filtros[k] = params[k]; });
  }

  function filtrarSinais() {
    var q = normalizar(filtros.q.trim());
    var limite = filtros.periodo ? Date.now() - Number(filtros.periodo) * DIA : null;
    var lista = estado.sinais.filter(function (s) {
      if (q) {
        var alvo = normalizar([s.termo, s.significado, s.contexto, s.regiao, s.local, s.comunidade].join(' '));
        if (alvo.indexOf(q) === -1) return false;
      }
      if (filtros.regiao && s.regiao !== filtros.regiao) return false;
      if (filtros.status && s.status !== filtros.status) return false;
      if (limite && new Date(s.dataSubmissao).getTime() < limite) return false;
      return true;
    });
    var ord = {
      recentes: porData('dataSubmissao', true),
      antigos: porData('dataSubmissao'),
      nota: function (a, b) { var x = media(a), y = media(b); return (y.media - x.media) || (y.qtd - x.qtd); },
      avaliacoes: function (a, b) { return media(b).qtd - media(a).qtd || (media(b).media - media(a).media); }
    }[filtros.ordem] || porData('dataSubmissao', true);
    lista.sort(ord);
    // Na busca por palavra, quem tem o termo exato aparece primeiro
    if (q) lista.sort(function (a, b) {
      var ea = normalizar(a.termo).indexOf(q) === 0 ? 0 : 1, eb = normalizar(b.termo).indexOf(q) === 0 ? 0 : 1;
      return ea - eb;
    });
    return lista;
  }

  function telaExplorar(r) {
    aplicarParams(r.params);
    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Glossário</span>' +
          '<h1 class="titulo-pagina">Explorar sinais</h1>' +
          '<p class="subtitulo">Pesquise por palavra ou expressão e compare variantes. A situação de revisão e a nota da comunidade aparecem separadas em cada resultado.</p></header>' +
        '<div class="explorar-layout">' +
          '<form class="filtros" data-form="filtros" role="search" aria-label="Pesquisa e filtros">' +
            '<h2>' + icone('i-filtro') + 'Pesquisa e filtros</h2>' +
            '<div class="campo"><label for="f-q">Palavra ou expressão</label>' +
              '<input id="f-q" type="search" data-filtro="q" value="' + esc(filtros.q) + '" placeholder="Ex.: saudade" autocomplete="off"></div>' +
            '<div class="campo"><label for="f-regiao">Região</label><select id="f-regiao" data-filtro="regiao">' + opcoesRegiao(filtros.regiao, 'Todas as regiões') + '</select></div>' +
            '<div class="campo"><label for="f-status">Situação de revisão</label><select id="f-status" data-filtro="status">' + opcoesStatus(filtros.status) + '</select></div>' +
            '<div class="campo"><label for="f-periodo">Data de submissão</label><select id="f-periodo" data-filtro="periodo">' + opcoesHTML(PERIODOS, filtros.periodo) + '</select></div>' +
            '<button type="button" class="btn btn-contorno btn-p" data-acao="limpar-filtros">Limpar filtros</button>' +
            '<p class="texto-fraco" style="margin:0">Regiões e registros são fictícios, apenas para demonstração.</p>' +
          '</form>' +
          '<section aria-labelledby="t-resultados">' +
            '<h2 id="t-resultados" class="sr-only">Resultados</h2>' +
            '<div class="resultados-topo"><p class="contagem" id="contagem" role="status"></p>' +
              '<div class="campo"><label for="f-ordem">Ordenar por</label><select id="f-ordem" data-filtro="ordem">' + opcoesHTML(ORDENS, filtros.ordem) + '</select></div></div>' +
            '<div id="filtros-ativos" class="filtros-ativos"></div>' +
            '<div id="resultados"></div>' +
          '</section>' +
        '</div>' +
      '</div>';
    renderizarResultados();
    return 'Explorar sinais';
  }

  function renderizarResultados() {
    var alvo = document.getElementById('resultados');
    if (!alvo) return;
    var lista = filtrarSinais();
    document.getElementById('contagem').textContent = lista.length === 0 ? 'Nenhum registro encontrado' :
      plural(lista.length, 'registro encontrado', 'registros encontrados');

    var ativos = [];
    if (filtros.q) ativos.push(['q', '“' + filtros.q + '”']);
    if (filtros.regiao) ativos.push(['regiao', filtros.regiao]);
    if (filtros.status) ativos.push(['status', STATUS[filtros.status].rotulo]);
    if (filtros.periodo) ativos.push(['periodo', PERIODOS[filtros.periodo]]);
    document.getElementById('filtros-ativos').innerHTML = ativos.map(function (a) {
      return '<button type="button" class="filtro-ativo" data-acao="remover-filtro" data-filtro-chave="' + a[0] + '">' + esc(a[1]) +
        icone('i-fechar') + '<span class="sr-only">: remover filtro</span></button>';
    }).join('');

    if (!lista.length) {
      var termo = filtros.q.trim();
      alvo.innerHTML = vazioHTML(
        termo ? 'Nenhum sinal encontrado para “' + esc(termo) + '”' : 'Nenhum sinal com esses filtros',
        'Tente outra palavra, remova algum filtro ou contribua enviando o registro que você procura.',
        '<button type="button" class="btn btn-contorno" data-acao="limpar-filtros">Limpar filtros</button>' +
        '<a class="btn btn-escuro" href="#/enviar' + (termo ? '?termo=' + encodeURIComponent(termo) : '') + '">' + icone('i-enviar') + 'Enviar este sinal</a>');
      return;
    }
    alvo.innerHTML = '<div class="grade-cartoes">' + lista.map(function (s) { return cartaoSinalHTML(s); }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------
     Tela C — Detalhes do sinal
     --------------------------------------------------------------- */
  function telaSinal(r) {
    var s = sinal(r.args[0]);
    if (!s) return telaNaoEncontrada();
    var m = media(s);
    var v = rotuloVariante(s);
    var autor = perfil(s.autorId);
    var rel = relacionadas(s);
    var minha = minhaAvaliacao(s);
    var ult = ultimaRevisao(s);
    var validacoes = s.pareceres.filter(function (p) { return p.decisao === 'validar' || p.decisao === 'variante'; });

    // indicadores de clareza e correspondência a partir das avaliações detalhadas
    var det = s.avaliacoes.length;
    var clarezaPct = det ? Math.round(s.avaliacoes.reduce(function (t, a) { return t + a.clareza; }, 0) / (det * 3) * 100) : 0;
    var corrPct = det ? Math.round(s.avaliacoes.filter(function (a) { return a.corresponde === 'sim'; }).length / det * 100) : 0;

    main.innerHTML =
      '<div class="container">' +
        '<header class="detalhe-cabecalho">' +
          '<a class="voltar" href="#/explorar">' + icone('i-voltar') + 'Voltar para Explorar sinais</a>' +
          '<span class="sobretitulo" style="display:block">Registro fictício de demonstração</span>' +
          '<div class="detalhe-titulo"><h1 class="titulo-pagina">' + esc(s.termo) + '</h1>' +
            (v ? '<span class="cartao-variante">' + v + ' · ' + esc(s.regiao) + '</span>' : '') + '</div>' +
          '<div class="meta" style="margin-top:12px">' +
            '<span>' + icone('i-calendario') + 'Enviado em ' + fmtData(s.dataSubmissao) + '</span>' +
            '<span>' + icone('i-historico') + 'Última revisão: ' + (ult ? fmtData(ult) : 'ainda não revisado') + '</span>' +
            '<span>' + icone('i-pessoa') + 'Por ' + (autor ? '<a href="#/perfil/' + esc(autor.id) + '">' + esc(autor.nome) + '</a>' : 'autor não identificado') + '</span>' +
          '</div>' +
        '</header>' +

        '<div class="detalhe-grade">' +
          '<div>' +
            '<div id="midia-sinal">' + midiaGrandeHTML(s) + '</div>' +

            '<section class="bloco" aria-labelledby="t-signif"><h2 id="t-signif">Significado e contexto de uso</h2>' +
              '<p>' + esc(s.significado) + '</p>' +
              '<dl class="lista-definicao"><dt>Contexto</dt><dd>' + esc(s.contexto) + '</dd>' +
              '<dt>Fonte ou referência</dt><dd>' + esc(s.fonte || 'Não informada.') + '</dd></dl>' +
            '</section>' +

            '<section class="bloco" aria-labelledby="t-var"><h2 id="t-var">Variantes relacionadas <span class="contador">' + rel.length + '</span></h2>' +
              (rel.length ? '<ul class="variantes-lista">' + rel.map(function (x) {
                var rv = rotuloVariante(x);
                return '<li class="variante-item"><a href="#/sinal/' + esc(x.id) + '"><span class="vi-nome">' + esc(x.termo) + (rv ? ' · ' + rv : '') + '</span>' +
                  '<span class="vi-meta">' + esc(x.regiao) + (x.local ? ' · ' + esc(x.local) : '') + ' · ' + (media(x).qtd ? 'nota ' + fmtNum(media(x).media) : 'sem avaliações') + '</span>' +
                  seloHTML(x, { estatico: true }) + '</a></li>';
              }).join('') + '</ul>' : '<p class="texto-suave">Nenhuma variante relacionada até agora.</p>') +
              '<div class="painel-acoes"><button type="button" class="btn btn-contorno btn-p" data-acao="relacionar" data-id="' + esc(s.id) + '">' + icone('i-ligar') + 'Relacionar uma variante</button></div>' +
              '<p class="aviso-regra">' + icone('i-info') + '<span>Variantes diferentes para o mesmo conceito permanecem disponíveis lado a lado, mesmo quando revisores têm pareceres distintos.</span></p>' +
            '</section>' +

            '<section class="bloco" aria-labelledby="t-hist"><h2 id="t-hist">Histórico de atualizações</h2>' +
              linhaTempoHTML(s.historico.slice().sort(porData('data', true))) +
            '</section>' +

            '<section class="bloco" aria-labelledby="t-aval"><h2 id="t-aval">Avaliações registradas <span class="contador">' + plural(m.qtd, 'no total', 'no total') + '</span></h2>' +
              (det ? '<ul class="lista-avaliacoes">' + s.avaliacoes.slice().sort(porData('data', true)).map(avaliacaoItemHTML).join('') + '</ul>' +
                '<p class="texto-fraco" style="margin-top:10px">Mostrando ' + plural(det, 'avaliação detalhada', 'avaliações detalhadas') + '. As demais entram apenas na média demonstrativa.</p>'
                : '<p class="texto-suave">Este registro ainda não recebeu avaliações.</p>') +
            '</section>' +

            (s.sugestoes.length ? '<section class="bloco" aria-labelledby="t-sug"><h2 id="t-sug">Sugestões de correção <span class="contador">' + s.sugestoes.length + '</span></h2>' +
              '<ul class="lista-comentarios">' + s.sugestoes.slice().sort(porData('data', true)).map(sugestaoItemHTML).join('') + '</ul></section>' : '') +

            '<section class="bloco" aria-labelledby="t-com"><h2 id="t-com">Comentários <span class="contador">' + s.comentarios.length + '</span></h2>' +
              (s.comentarios.length ? '<ul class="lista-comentarios">' + s.comentarios.slice().sort(porData('data', true)).map(function (c) {
                return '<li class="item-comentario"><div class="item-topo"><strong>' + esc(c.autor) + '</strong><span class="texto-fraco">' + fmtData(c.data) + '</span></div><p class="item-texto">' + esc(c.texto) + '</p></li>';
              }).join('') + '</ul>' : '<p class="texto-suave">Nenhum comentário ainda.</p>') +
              '<form class="form-comentario" data-form="comentario" data-id="' + esc(s.id) + '">' +
                '<div class="campo"><label for="novo-comentario">Deixe um comentário</label>' +
                '<textarea id="novo-comentario" name="texto" maxlength="500" required placeholder="Comentário demonstrativo, salvo só neste navegador"></textarea></div>' +
                '<div class="acoes"><button type="submit" class="btn btn-contorno btn-p">' + icone('i-comentario') + 'Publicar comentário</button></div>' +
              '</form>' +
            '</section>' +
          '</div>' +

          '<aside aria-label="Situação do registro">' +
            '<section class="painel" aria-labelledby="t-p-rev"><h2 class="painel-titulo" id="t-p-rev">' + icone('i-selo') + 'Revisão profissional</h2>' +
              seloHTML(s, { grande: true, longo: true }) +
              '<p class="texto-suave" style="margin-top:12px;font-size:14.5px">' + STATUS[s.status].desc + '</p>' +
              (validacoes.length ? '<div style="margin-top:14px"><p class="texto-fraco" style="margin-bottom:10px">Pareceres favoráveis</p>' + validacoes.map(function (p) {
                var rv = perfil(p.revisorId);
                return '<div class="revisor">' + avatarHTML(rv) + '<div><span class="revisor-nome"><a href="#/perfil/' + esc(rv.id) + '">' + esc(rv.nome) + '</a></span>' +
                  '<small>' + esc(rv.funcao) + ' · perfil fictício</small><small>' + DECISOES[p.decisao].curto + ' em ' + fmtData(p.data) + '</small></div></div>';
              }).join('') + '</div>' : '<p class="sem-validacao" style="margin-top:4px">' + icone('i-info') + 'Ainda sem validação profissional</p>') +
              '<div class="painel-acoes"><button type="button" class="btn btn-fantasma btn-p" data-acao="selo" data-id="' + esc(s.id) + '">Ver todos os pareceres (' + s.pareceres.length + ')</button></div>' +
            '</section>' +

            '<section class="painel" aria-labelledby="t-p-com"><h2 class="painel-titulo" id="t-p-com">' + icone('i-estrela') + 'Avaliação comunitária</h2>' +
              '<div class="painel-nota"><span class="nota-grande">' + (m.qtd ? fmtNum(m.media) : '—') + '</span>' +
                '<div>' + notaHTML(s) + '<div class="texto-fraco">' + (m.qtd ? plural(m.qtd, 'avaliação', 'avaliações') + ' (demonstrativas)' : 'Seja a primeira pessoa a avaliar') + '</div></div></div>' +
              (det ? '<div class="barras">' +
                '<div class="barra"><span>Clareza</span><span class="barra-trilho"><span style="width:' + clarezaPct + '%"></span></span><span>' + clarezaPct + '%</span></div>' +
                '<div class="barra"><span>Corresponde</span><span class="barra-trilho"><span style="width:' + corrPct + '%"></span></span><span>' + corrPct + '%</span></div>' +
              '</div>' : '') +
              (baixaAvaliacao(s) ? '<p class="aviso-regra">' + icone('i-alerta') + '<span>Nota baixa: o registro entrou na fila de análise profissional. Ele continua disponível para consulta.</span></p>' : '') +
              (s.denuncias ? '<p class="aviso-regra">' + icone('i-bandeira') + '<span>' + plural(s.denuncias, 'denúncia registrada', 'denúncias registradas') + ', em análise.</span></p>' : '') +
              '<div class="painel-acoes">' +
                '<button type="button" class="btn btn-primario" data-acao="avaliar" data-id="' + esc(s.id) + '">' + icone('i-estrela') + (minha ? 'Alterar minha avaliação' : 'Avaliar este registro') + '</button>' +
                '<button type="button" class="btn btn-contorno" data-acao="sugerir" data-id="' + esc(s.id) + '">' + icone('i-lapis') + 'Sugerir correção</button>' +
              '</div>' +
              (minha ? '<p class="ja-avaliou" style="margin-top:10px">' + icone('i-check') + 'Você avaliou este registro em ' + fmtData(minha.data) + ' (nota ' + minha.nota + ').</p>' : '') +
              '<p class="aviso-regra">' + icone('i-info') + '<span>A nota da comunidade não concede selo profissional e não apaga registros.</span></p>' +
            '</section>' +

            '<section class="painel" aria-labelledby="t-p-reg"><h2 class="painel-titulo" id="t-p-reg">' + icone('i-local') + 'Região e contexto</h2>' +
              '<dl class="lista-definicao">' +
                '<dt>Região</dt><dd>' + esc(s.regiao) + '</dd>' +
                '<dt>Comunidade</dt><dd>' + esc(s.comunidade || 'Não informada') + '</dd>' +
                '<dt>Cidade/UF</dt><dd>' + esc(s.local || 'Não informada') + '</dd>' +
                '<dt>Enviado em</dt><dd>' + fmtData(s.dataSubmissao) + '</dd>' +
                '<dt>Última revisão</dt><dd>' + (ult ? fmtData(ult) : '—') + '</dd>' +
              '</dl>' +
              '<p class="aviso-regra">' + icone('i-info') + '<span>Indicação regional fictícia, informada no envio. Não descreve o uso real do sinal.</span></p>' +
            '</section>' +
          '</aside>' +
        '</div>' +
      '</div>';

    carregarVideo(s);
    return s.termo;
  }

  function midiaGrandeHTML(s) {
    var titulo = 'Vídeo demonstrativo não disponível';
    var det = 'Esta área está preparada para receber a gravação autêntica do sinal. O protótipo não exibe ilustrações no lugar do sinal verdadeiro.';
    var icn = 'i-video-off';
    if (s.video) {
      icn = 'i-video';
      titulo = s.video.armazenado ? 'Carregando o vídeo enviado…' : 'Vídeo não armazenado neste navegador';
      det = s.video.armazenado ? '' : 'Arquivo informado no envio: ' + s.video.nome + '. Nesta demonstração o vídeo não foi guardado, ou o navegador não permitiu armazená-lo.';
    }
    return '<div class="midia midia-grande"><div class="midia-conteudo">' + icone(icn) +
      '<span class="midia-titulo">' + esc(titulo) + '</span>' + (det ? '<span class="midia-detalhe">' + esc(det) + '</span>' : '') + '</div></div>';
  }

  /* Mostra o vídeo do envio, se houver (sessão atual ou IndexedDB). */
  function carregarVideo(s) {
    if (!s.video) return;
    var alvo = document.getElementById('midia-sinal');
    var mostrar = function (url, origem) {
      if (!document.getElementById('midia-sinal')) return;
      alvo.innerHTML = '<div class="midia midia-grande midia-tem-video">' +
        '<video controls preload="metadata" src="' + url + '" aria-label="Vídeo do sinal ' + esc(s.termo) + '"></video>' +
        '<span class="midia-marca">' + esc(origem) + '</span></div>' +
        '<div class="painel-acoes" role="group" aria-label="Velocidade de reprodução"><span class="texto-fraco" style="align-self:center">Velocidade:</span>' +
        ['0.5', '0.75', '1'].map(function (vel) {
          return '<button type="button" class="btn btn-contorno btn-p" data-acao="velocidade" data-vel="' + vel + '" aria-pressed="' + (vel === '1') + '">' + vel.replace('.', ',') + '×</button>';
        }).join('') + '</div>';
    };
    if (videosSessao[s.id]) { mostrar(videosSessao[s.id], s.video.armazenado ? 'Vídeo enviado (guardado neste navegador)' : 'Vídeo enviado (somente nesta sessão)'); return; }
    if (!s.video.armazenado) return;
    Videos.ler(s.id).then(function (blob) {
      if (!blob) throw new Error('vazio');
      videosSessao[s.id] = URL.createObjectURL(blob);
      mostrar(videosSessao[s.id], 'Vídeo enviado (guardado neste navegador)');
    }).catch(function () {
      if (!document.getElementById('midia-sinal')) return;
      alvo.innerHTML = '<div class="midia midia-grande"><div class="midia-conteudo">' + icone('i-video-off') +
        '<span class="midia-titulo">Vídeo indisponível neste navegador</span>' +
        '<span class="midia-detalhe">O arquivo ' + esc(s.video.nome) + ' foi enviado em outro navegador ou os dados de vídeo foram apagados.</span></div></div>';
    });
  }

  function avaliacaoItemHTML(a) {
    return '<li class="item-avaliacao"><div class="item-topo"><strong>' + esc(a.autor) + (a.votante === votanteId() ? ' (você)' : '') + '</strong>' +
      '<span class="texto-fraco">' + fmtData(a.data) + '</span></div>' +
      '<div class="item-meta"><span class="etiqueta info">' + icone('i-estrela') + 'Nota ' + a.nota + '</span>' +
      '<span class="etiqueta">' + CLAREZA[a.clareza] + '</span><span class="etiqueta">' + CORRESPONDE[a.corresponde] + '</span>' +
      (a.variante ? '<span class="etiqueta">' + icone('i-local') + 'Conhece uma variante</span>' : '') + '</div>' +
      (a.comentario ? '<p class="item-texto">' + esc(a.comentario) + '</p>' : '') + '</li>';
  }

  function sugestaoItemHTML(g) {
    return '<li class="item-comentario"><div class="item-topo"><strong>' + esc(g.autor) + '</strong><span class="texto-fraco">' + fmtData(g.data) + '</span></div>' +
      '<div class="item-meta"><span class="etiqueta' + (g.tipo === 'denuncia' ? ' alerta' : '') + '">' + icone(g.tipo === 'denuncia' ? 'i-bandeira' : 'i-lapis') + esc(TIPOS_SUGESTAO[g.tipo]) + '</span></div>' +
      '<p class="item-texto">' + esc(g.texto) + '</p></li>';
  }

  /* ---------------------------------------------------------------
     Tela D — Enviar um sinal
     --------------------------------------------------------------- */
  function telaEnviar(r) {
    if (r.args[0] === 'enviado' && sinal(r.args[1])) return telaEnviado(sinal(r.args[1]));
    var termoInicial = r.params.termo || '';

    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Contribuir</span>' +
          '<h1 class="titulo-pagina">Enviar um sinal</h1>' +
          '<p class="subtitulo">Seu registro entra como novo registro, aparece no glossário com essa indicação e segue para avaliação da comunidade e revisão profissional.</p></header>' +
        '<div class="envio-layout">' +
          '<form class="form" data-form="envio" novalidate>' +
            '<p class="texto-fraco" style="margin:0">Campos marcados com <span class="obrigatorio">*</span> são obrigatórios.</p>' +
            '<fieldset class="form-grupo"><legend>O sinal</legend>' +
              '<div class="campo"><label for="e-termo">Palavra ou expressão <span class="obrigatorio">*</span></label>' +
                '<input id="e-termo" name="termo" type="text" maxlength="80" required value="' + esc(termoInicial) + '" aria-describedby="e-termo-ajuda" autocomplete="off">' +
                '<p class="ajuda" id="e-termo-ajuda">Ex.: Saudade, Bom dia, Escola.</p><div id="e-termo-existente" aria-live="polite"></div></div>' +
              '<div class="campo"><label for="e-signif">Significado <span class="obrigatorio">*</span></label>' +
                '<textarea id="e-signif" name="significado" maxlength="400" required aria-describedby="e-signif-ajuda"></textarea>' +
                '<p class="ajuda" id="e-signif-ajuda">Explique o que a palavra ou expressão quer dizer.</p></div>' +
              '<div class="campo"><label for="e-contexto">Contexto de uso <span class="obrigatorio">*</span></label>' +
                '<textarea id="e-contexto" name="contexto" maxlength="400" required aria-describedby="e-contexto-ajuda"></textarea>' +
                '<p class="ajuda" id="e-contexto-ajuda">Em que situações o sinal é usado: escola, família, trabalho, conversa informal…</p></div>' +
            '</fieldset>' +

            '<fieldset class="form-grupo"><legend>Onde é usado</legend>' +
              '<div class="duas-colunas">' +
                '<div class="campo"><label for="e-regiao">Região <span class="obrigatorio">*</span></label>' +
                  '<select id="e-regiao" name="regiao" required>' + opcoesRegiao('', 'Selecione a região') + '</select></div>' +
                '<div class="campo"><label for="e-local">Cidade ou estado <span class="texto-fraco">(opcional)</span></label>' +
                  '<input id="e-local" name="local" type="text" maxlength="60" placeholder="Ex.: Recife (PE)"></div>' +
              '</div>' +
              '<div class="campo"><label for="e-comunidade">Comunidade em que o sinal é utilizado <span class="texto-fraco">(opcional)</span></label>' +
                '<input id="e-comunidade" name="comunidade" type="text" maxlength="100" placeholder="Ex.: escola bilíngue, associação, grupo de convivência"></div>' +
              '<div class="campo"><label for="e-variante">É uma variante de um registro existente? <span class="texto-fraco">(opcional)</span></label>' +
                '<select id="e-variante" name="variante"><option value="">Não sei ou não se aplica</option>' + opcoesSinais([], '') + '</select>' +
                '<p class="ajuda">Registros com a mesma palavra são relacionados automaticamente como variantes.</p></div>' +
            '</fieldset>' +

            '<fieldset class="form-grupo"><legend>Vídeo e fonte</legend>' +
              '<div class="campo"><label for="e-video">Vídeo do sinal <span class="texto-fraco">(opcional nesta demonstração)</span></label>' +
                '<input id="e-video" name="video" type="file" accept="video/*" aria-describedby="e-video-ajuda">' +
                '<p class="ajuda" id="e-video-ajuda">O arquivo não é enviado para nenhum servidor. Ele fica apenas neste navegador.</p>' +
                '<div id="e-video-previa" class="pre-video"></div></div>' +
              '<fieldset class="campo" id="e-armazenar-grupo" hidden><legend>Como tratar o vídeo nesta demonstração</legend>' +
                '<div class="opcoes">' +
                  '<label class="opcao opcao-cartao"><input type="radio" name="armazenar" value="sim" checked><span><strong>Guardar neste navegador</strong><span>Usa o armazenamento local (IndexedDB). Arquivos grandes podem não caber.</span></span></label>' +
                  '<label class="opcao opcao-cartao"><input type="radio" name="armazenar" value="nao"><span><strong>Não guardar o vídeo</strong><span>Registra só o nome do arquivo. O vídeo aparece até a página ser fechada.</span></span></label>' +
                '</div></fieldset>' +
              '<div class="campo"><label for="e-fonte">Fonte ou referência <span class="texto-fraco">(quando houver)</span></label>' +
                '<input id="e-fonte" name="fonte" type="text" maxlength="160" placeholder="Ex.: material de aula, dicionário, gravação própria"></div>' +
              '<label class="opcao"><input type="checkbox" name="autorizacao" id="e-autorizacao" required>' +
                '<span>Declaro que tenho autorização das pessoas que aparecem no vídeo para compartilhá-lo e que ele pode ser exibido para consulta no glossário. <span class="obrigatorio">*</span></span></label>' +
              '<div id="e-autorizacao-erro"></div>' +
            '</fieldset>' +

            '<div class="form-rodape"><p class="nota-demo" style="margin:0">' + icone('i-info') + 'Envio demonstrativo: nada sai deste computador.</p>' +
              '<button type="submit" class="btn btn-primario btn-g">' + icone('i-enviar') + 'Enviar para avaliação</button></div>' +
          '</form>' +

          '<aside class="lateral">' +
            '<section class="painel"><h2 class="painel-titulo">' + icone('i-info') + 'O que acontece depois</h2>' +
              '<ul class="lista-simples">' +
                '<li>' + icone('i-novo') + '<span>O registro aparece como <strong>Novo registro — aguardando revisão</strong>.</span></li>' +
                '<li>' + icone('i-estrela') + '<span>A comunidade pode avaliar, comentar e sugerir correções.</span></li>' +
                '<li>' + icone('i-selo') + '<span>Um profissional emite um parecer identificado, com data e escopo.</span></li>' +
                '<li>' + icone('i-historico') + '<span>Tudo fica no histórico do registro.</span></li>' +
              '</ul></section>' +
            '<section class="painel"><h2 class="painel-titulo">' + icone('i-video') + 'Dicas para a gravação</h2>' +
              '<ul class="lista-simples">' +
                '<li>' + icone('i-check') + '<span>Fundo neutro e boa iluminação no rosto e nas mãos.</span></li>' +
                '<li>' + icone('i-check') + '<span>Enquadramento da cabeça até a cintura.</span></li>' +
                '<li>' + icone('i-check') + '<span>Expressão facial visível: ela faz parte do sinal.</span></li>' +
              '</ul></section>' +
          '</aside>' +
        '</div>' +
      '</div>';

    atualizarTermoExistente();
    return 'Enviar sinal';
  }

  function atualizarTermoExistente() {
    var campo = document.getElementById('e-termo');
    var alvo = document.getElementById('e-termo-existente');
    if (!campo || !alvo) return;
    var t = normalizar(campo.value.trim());
    var iguais = t ? estado.sinais.filter(function (s) { return normalizar(s.termo) === t; }) : [];
    alvo.innerHTML = iguais.length ? '<p class="aviso-regra" style="margin-top:6px">' + icone('i-divergencia') +
      '<span>Já ' + (iguais.length === 1 ? 'existe 1 registro' : 'existem ' + iguais.length + ' registros') + ' para “' + esc(iguais[0].termo) +
      '”. Seu envio será mostrado como mais uma variante. Ser diferente não torna nenhum deles incorreto.</span></p>' : '';
  }

  function telaEnviado(s) {
    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Contribuir</span><h1 class="titulo-pagina">Registro enviado</h1></header>' +
        '<div class="confirmacao" role="status">' + icone('i-check', 'ic-g') +
          '<h2>“' + esc(s.termo) + '” foi enviado para avaliação.</h2>' +
          '<p>O registro já aparece no glossário com a situação abaixo. Comunidade e revisores podem avaliá-lo a partir de agora.</p>' +
          seloHTML(s, { grande: true, longo: true }) +
          (s.video ? '<p class="texto-suave" style="margin-top:14px">' + (s.video.armazenado ?
            'Vídeo “' + esc(s.video.nome) + '” guardado neste navegador.' :
            'Vídeo “' + esc(s.video.nome) + '” não foi guardado; ele pode ser visto até a página ser fechada.') + '</p>' : '') +
          '<div class="acoes">' +
            '<a class="btn btn-escuro" href="#/sinal/' + esc(s.id) + '">Ver o registro ' + icone('i-seta') + '</a>' +
            '<a class="btn btn-contorno" href="#/explorar?ordem=recentes">Ver no glossário</a>' +
            '<a class="btn btn-fantasma" href="#/enviar">Enviar outro sinal</a>' +
          '</div></div>' +
      '</div>';
    return 'Registro enviado';
  }

  function enviarSinal(form) {
    var d = new FormData(form);
    var erros = [];
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.erro-campo').forEach(function (el) { el.remove(); });

    function exigir(nome, msg) {
      var el = form.elements[nome];
      var vazio = el.type === 'checkbox' ? !el.checked : !String(el.value).trim();
      if (vazio) {
        el.setAttribute('aria-invalid', 'true');
        var p = document.createElement('p');
        p.className = 'erro-campo'; p.id = el.id + '-erro';
        p.innerHTML = icone('i-alerta') + msg;
        if (el.type === 'checkbox') document.getElementById('e-autorizacao-erro').appendChild(p);
        else el.insertAdjacentElement('afterend', p);
        el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '').replace(el.id + '-erro', '') + ' ' + p.id).trim());
        erros.push(el);
      }
    }
    exigir('termo', 'Informe a palavra ou expressão.');
    exigir('significado', 'Descreva o significado.');
    exigir('contexto', 'Descreva o contexto de uso.');
    exigir('regiao', 'Selecione a região.');
    exigir('autorizacao', 'Confirme a declaração de autorização para compartilhar o vídeo.');
    if (erros.length) { erros[0].focus(); avisar('Revise os campos destacados.'); return; }

    var arquivo = form.elements.video.files[0];
    var agora = new Date().toISOString();
    var novo = {
      id: uid('s'), termo: d.get('termo').trim(), significado: d.get('significado').trim(), contexto: d.get('contexto').trim(),
      regiao: d.get('regiao'), comunidade: (d.get('comunidade') || '').trim(), local: (d.get('local') || '').trim(),
      fonte: (d.get('fonte') || '').trim() || 'Não informada.', autorId: 'u-demo', status: 'novo', denuncias: 0,
      dataSubmissao: agora, base: { soma: 0, qtd: 0 }, avaliacoes: [], pareceres: [], sugestoes: [], comentarios: [],
      relacionadas: [], video: null, demonstrativo: false,
      historico: [{ data: agora, tipo: 'envio', texto: 'Registro enviado por Você (usuário da demonstração).' }]
    };

    // Relaciona automaticamente com registros do mesmo termo + o escolhido
    var alvos = mesmoTermo(novo).map(function (x) { return x.id; });
    if (d.get('variante') && alvos.indexOf(d.get('variante')) === -1) alvos.push(d.get('variante'));
    alvos.forEach(function (id) { relacionar(novo, sinal(id), false); });

    var botao = form.querySelector('[type="submit"]');
    botao.disabled = true;

    var concluir = function () {
      estado.sinais.push(novo);
      salvar();
      ir('#/enviar/enviado/' + novo.id);
      avisar('Registro enviado. Situação: Novo registro — aguardando revisão.');
    };

    if (!arquivo) { concluir(); return; }

    novo.video = { nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type, armazenado: false };
    var guardar = d.get('armazenar') !== 'nao';
    if (!guardar || arquivo.size > LIMITE_VIDEO) {
      videosSessao[novo.id] = URL.createObjectURL(arquivo);
      if (guardar) avisar('Vídeo grande demais para guardar no navegador. Ele ficará disponível só nesta sessão.');
      concluir();
      return;
    }
    Videos.salvar(novo.id, arquivo).then(function () {
      novo.video.armazenado = true;
      concluir();
    }).catch(function () {
      // Alternativa quando o navegador não permite guardar o vídeo
      videosSessao[novo.id] = URL.createObjectURL(arquivo);
      concluir();
      setTimeout(function () { avisar('O navegador não permitiu guardar o vídeo. Ele ficará disponível só nesta sessão.'); }, 3500);
    });
  }

  function relacionar(a, b, comHistorico) {
    if (!a || !b || a.id === b.id) return;
    if (a.relacionadas.indexOf(b.id) === -1) a.relacionadas.push(b.id);
    if (b.relacionadas.indexOf(a.id) === -1) b.relacionadas.push(a.id);
    if (comHistorico) {
      var agora = new Date().toISOString();
      a.historico.push({ data: agora, tipo: 'variante', texto: 'Relacionado à variante “' + b.termo + '” (' + b.regiao + ').' });
      b.historico.push({ data: agora, tipo: 'variante', texto: 'Relacionado à variante “' + a.termo + '” (' + a.regiao + ').' });
    } else {
      b.historico.push({ data: new Date().toISOString(), tipo: 'variante', texto: 'Nova variante relacionada: “' + a.termo + '” (' + a.regiao + ').' });
    }
  }

  /* ---------------------------------------------------------------
     Tela E/G — Comunidade (avaliação, perfis, selos)
     --------------------------------------------------------------- */
  function abasComunidade(atual) {
    var abas = [['', 'Avaliar registros'], ['perfis', 'Perfis e validações'], ['selos', 'Significado dos selos']];
    return '<nav class="abas" aria-label="Seções da comunidade">' + abas.map(function (a) {
      return '<a class="aba" href="#/comunidade' + (a[0] ? '/' + a[0] : '') + '"' + (a[0] === atual ? ' aria-current="page"' : '') + '>' + a[1] + '</a>';
    }).join('') + '</nav>';
  }

  function telaComunidade(r) {
    var sub = r.args[0] || '';
    var corpo = '', titulo = 'Comunidade';
    if (sub === 'perfis') { corpo = comunidadePerfis(); titulo = 'Perfis e validações'; }
    else if (sub === 'selos') { corpo = comunidadeSelos(); titulo = 'Significado dos selos'; }
    else { corpo = comunidadeAvaliar(); titulo = 'Avaliação comunitária'; }

    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Comunidade</span>' +
          '<h1 class="titulo-pagina">' + titulo + '</h1>' +
          '<p class="subtitulo">' + {
            '': 'Avalie registros, indique variantes e sugira correções. As notas ajudam a organizar a fila de análise, mas não concedem selo profissional.',
            perfis: 'Perfis demonstrativos de contribuidores, revisores e instituições parceiras. Todos são fictícios.',
            selos: 'Cada selo descreve a situação de revisão de um registro. A nota da comunidade é uma informação separada.'
          }[sub] + '</p></header>' +
        abasComunidade(sub) + corpo +
      '</div>';
    return titulo;
  }

  function comunidadeAvaliar() {
    var v = votanteId();
    var lista = estado.sinais.slice().sort(porData('dataSubmissao', true)).filter(function (s) {
      if (comunidadeFiltro === 'pendentes') return !minhaAvaliacao(s);
      if (comunidadeFiltro === 'poucas') return media(s).qtd < 5;
      return true;
    });
    var feed = [];
    estado.sinais.forEach(function (s) { s.avaliacoes.forEach(function (a) { feed.push({ s: s, a: a, data: a.data }); }); });
    feed.sort(porData('data', true));
    var minhas = estado.sinais.filter(function (s) { return s.avaliacoes.some(function (a) { return a.votante === v; }); }).length;

    return '<div class="comunidade-grade">' +
      '<section aria-labelledby="t-lista-avaliar">' +
        '<div class="secao-cabecalho" style="margin-bottom:16px"><h2 id="t-lista-avaliar" class="titulo-secao">Registros para avaliar</h2>' +
          '<div class="campo" style="grid-auto-flow:column;align-items:center;gap:10px"><label for="c-filtro">Mostrar</label>' +
          '<select id="c-filtro" data-acao-change="comunidade-filtro" style="width:auto">' +
            opcoesHTML({ todos: 'Todos os registros', pendentes: 'Ainda não avaliados por mim', poucas: 'Com poucas avaliações' }, comunidadeFiltro) +
          '</select></div></div>' +
        '<p class="texto-fraco">Você avaliou ' + plural(minhas, 'registro', 'registros') + ' neste navegador. Cada navegador registra uma avaliação por sinal; avaliar de novo substitui a anterior.</p>' +
        (lista.length ? '<ul class="lista-avaliar">' + lista.map(function (s) {
          var minha = minhaAvaliacao(s), rv = rotuloVariante(s);
          return '<li class="linha-avaliar"><h3><a href="#/sinal/' + esc(s.id) + '">' + esc(s.termo) + '</a>' + (rv ? ' <span class="cartao-variante">' + rv + '</span>' : '') + '</h3>' +
            '<div class="meta"><span>' + icone('i-local') + esc(s.regiao) + '</span><span>' + notaHTML(s) + '</span>' + seloHTML(s) + '</div>' +
            '<div class="acoes">' + (minha ? '<span class="ja-avaliou">' + icone('i-check') + 'Nota ' + minha.nota + '</span>' : '') +
              '<button type="button" class="btn ' + (minha ? 'btn-fantasma' : 'btn-contorno') + ' btn-p" data-acao="avaliar" data-id="' + esc(s.id) + '">' + (minha ? 'Alterar' : 'Avaliar') +
              '<span class="sr-only"> ' + esc(s.termo + ' ' + s.regiao) + '</span></button></div></li>';
        }).join('') + '</ul>' : vazioHTML('Tudo avaliado', 'Você já avaliou todos os registros deste filtro.', '')) +
      '</section>' +
      '<aside>' +
        '<section class="painel" aria-labelledby="t-feed"><h2 class="painel-titulo" id="t-feed">' + icone('i-historico') + 'Avaliações registradas recentemente</h2>' +
          (feed.length ? '<ul class="lista-avaliacoes">' + feed.slice(0, 8).map(function (f) {
            return '<li class="item-avaliacao"><div class="item-topo"><a href="#/sinal/' + esc(f.s.id) + '"><strong>' + esc(f.s.termo) + '</strong> · ' + esc(f.s.regiao) + '</a>' +
              '<span class="texto-fraco">' + fmtData(f.a.data) + '</span></div>' +
              '<div class="item-meta"><span class="etiqueta info">' + icone('i-estrela') + 'Nota ' + f.a.nota + '</span><span class="etiqueta">' + CLAREZA[f.a.clareza] + '</span>' +
              '<span class="etiqueta">' + CORRESPONDE[f.a.corresponde] + '</span></div>' +
              '<p class="texto-fraco" style="margin:6px 0 0">por ' + esc(f.a.autor) + (f.a.votante === v ? ' (você)' : '') + '</p></li>';
          }).join('') + '</ul>' : '<p class="texto-suave">Nenhuma avaliação ainda.</p>') +
        '</section>' +
        '<section class="painel"><h2 class="painel-titulo">' + icone('i-info') + 'Regras da avaliação</h2>' +
          '<ul class="lista-simples">' +
            '<li>' + icone('i-check') + '<span>A nota vai de 1 a 5 e mede o quanto o registro ajuda quem consulta.</span></li>' +
            '<li>' + icone('i-check') + '<span>Nota baixa (abaixo de 3, com 3 avaliações ou mais) leva o registro à fila de análise profissional.</span></li>' +
            '<li>' + icone('i-check') + '<span>A nota nunca apaga um sinal nem concede selo profissional.</span></li>' +
            '<li>' + icone('i-check') + '<span>Um sinal diferente de outro não é considerado incorreto: pode ser uma variante.</span></li>' +
          '</ul></section>' +
      '</aside></div>';
  }

  function estatisticasPerfil(p) {
    if (p.tipo === 'instituicao') {
      var vinc = estado.perfis.filter(function (x) { return x.vinculo === p.id; });
      var ids = vinc.map(function (x) { return x.id; });
      var pareceres = 0, sinaisRev = {};
      estado.sinais.forEach(function (s) { s.pareceres.forEach(function (q) { if (ids.indexOf(q.revisorId) > -1) { pareceres++; sinaisRev[s.id] = 1; } }); });
      return { a: vinc.length, aRot: 'Revisores vinculados', b: Object.keys(sinaisRev).length, bRot: 'Registros revisados', c: pareceres, cRot: 'Pareceres emitidos' };
    }
    var envios = estado.sinais.filter(function (s) { return s.autorId === p.id; }).length;
    var revs = estado.sinais.filter(function (s) { return s.pareceres.some(function (q) { return q.revisorId === p.id; }); }).length;
    var aval = 0;
    estado.sinais.forEach(function (s) { s.avaliacoes.forEach(function (a) {
      if ((p.id === 'u-demo' && a.votante === votanteId()) || a.autor === p.nome) aval++;
    }); });
    if (p.tipo === 'revisor') {
      var np = 0; estado.sinais.forEach(function (s) { s.pareceres.forEach(function (q) { if (q.revisorId === p.id) np++; }); });
      return { a: revs, aRot: 'Registros revisados', b: np, bRot: 'Pareceres emitidos', c: envios, cRot: 'Contribuições enviadas' };
    }
    return { a: envios, aRot: 'Contribuições enviadas', b: aval, bRot: 'Avaliações feitas', c: revs, cRot: 'Registros revisados' };
  }

  function cartaoPerfilHTML(p) {
    var e = estatisticasPerfil(p);
    return '<article class="cartao-perfil">' + avatarHTML(p) + '<div><h3><a href="#/perfil/' + esc(p.id) + '">' + esc(p.nome) + '</a></h3>' +
      '<p>' + esc(p.funcao) + '</p><div class="meta"><span>' + e.a + ' ' + e.aRot.toLowerCase() + '</span><span>' + e.b + ' ' + e.bRot.toLowerCase() + '</span></div>' +
      (p.id !== 'u-demo' ? '<span class="ficticio" style="margin-top:8px">Perfil fictício</span>' : '') + '</div></article>';
  }

  function comunidadePerfis() {
    var grupo = function (tipo, titulo, texto) {
      var ps = estado.perfis.filter(function (p) { return p.tipo === tipo; });
      return '<section class="bloco" aria-labelledby="t-g-' + tipo + '" style="margin-top:0;margin-bottom:40px"><h2 id="t-g-' + tipo + '" class="titulo-secao">' + titulo + '</h2>' +
        '<p class="texto-suave" style="margin:6px 0 18px">' + texto + '</p><div class="perfis-grade">' + ps.map(cartaoPerfilHTML).join('') + '</div></section>';
    };
    return '<div style="padding-bottom:40px">' +
      '<p class="aviso-simulacao">' + icone('i-info') + '<span>Todos os perfis e instituições são <strong>fictícios</strong> e servem apenas para demonstrar o fluxo. Nenhum deles representa pessoas ou entidades reais, e a plataforma não concede credenciais.</span></p>' +
      grupo('revisor', 'Revisores profissionais', 'Podem emitir pareceres identificados no painel de revisão. Cada parecer informa data e escopo.') +
      grupo('contribuidor', 'Contribuidores', 'Enviam sinais, avaliam registros e sugerem correções.') +
      grupo('instituicao', 'Instituições parceiras', 'Instituições ilustrativas às quais os revisores fictícios estão vinculados.') +
      '</div>';
  }

  function comunidadeSelos() {
    var cont = {};
    estado.sinais.forEach(function (s) { cont[s.status] = (cont[s.status] || 0) + 1; });
    return '<div style="padding-bottom:64px"><ul class="legenda-selos">' + ORDEM_STATUS.map(function (k) {
      var st = STATUS[k];
      return '<li><span><span class="selo selo-' + k + ' selo-estatico">' + icone(st.icone) + st.rotulo + '</span></span>' +
        '<div><p>' + st.desc + '</p><p style="margin-top:6px"><a href="#/explorar?status=' + k + '">' + plural(cont[k] || 0, 'registro', 'registros') + ' nesta situação</a></p></div></li>';
    }).join('') + '</ul>' +
    '<div class="dimensoes">' +
      '<div class="dimensao"><h3>' + icone('i-estrela') + 'Nota não é selo</h3><p>A avaliação comunitária é exibida à parte e nunca muda a situação de revisão por conta própria.</p></div>' +
      '<div class="dimensao"><h3>' + icone('i-selo') + 'Selo com autoria</h3><p>Clique em qualquer selo para ver quem emitiu o parecer, em qual data e qual foi o escopo.</p></div>' +
      '<div class="dimensao"><h3>' + icone('i-historico') + 'Histórico preservado</h3><p>Novos pareceres se somam aos anteriores. Divergências ficam registradas.</p></div>' +
    '</div></div>';
  }

  /* Perfil individual */
  function telaPerfil(r) {
    var p = perfil(r.args[0]);
    if (!p) return telaNaoEncontrada();
    var e = estatisticasPerfil(p);
    var atividades = [];
    var envios = estado.sinais.filter(function (s) { return s.autorId === p.id; });
    var revisados = estado.sinais.filter(function (s) { return s.pareceres.some(function (q) { return q.revisorId === p.id; }); });
    var vinculo = p.vinculo ? perfil(p.vinculo) : null;
    var vinculados = estado.perfis.filter(function (x) { return x.vinculo === p.id; });

    envios.forEach(function (s) { atividades.push({ data: s.dataSubmissao, tipo: 'envio', texto: 'Enviou o registro “' + s.termo + '” (' + s.regiao + ').' }); });
    estado.sinais.forEach(function (s) {
      s.pareceres.forEach(function (q) {
        if (q.revisorId === p.id) atividades.push({ data: q.data, tipo: 'parecer', texto: DECISOES[q.decisao].curto + ': “' + s.termo + '” (' + s.regiao + ').' });
        else if (p.tipo === 'instituicao' && vinculados.some(function (x) { return x.id === q.revisorId; }))
          atividades.push({ data: q.data, tipo: 'parecer', texto: nomeDe(q.revisorId) + ' — ' + DECISOES[q.decisao].curto.toLowerCase() + ': “' + s.termo + '”.' });
      });
      s.avaliacoes.forEach(function (a) {
        if ((p.id === 'u-demo' && a.votante === votanteId()) || a.autor === p.nome) atividades.push({ data: a.data, tipo: 'avaliacao', texto: 'Avaliou “' + s.termo + '” (' + s.regiao + ') com nota ' + a.nota + '.' });
      });
      s.comentarios.forEach(function (c) { if (c.autor === p.nome) atividades.push({ data: c.data, tipo: 'comentario', texto: 'Comentou em “' + s.termo + '”.' }); });
      s.historico.forEach(function (h) { if (h.tipo === 'revisao' && h.texto.indexOf(p.nome) > -1) atividades.push({ data: h.data, tipo: 'revisao', texto: 'Iniciou a revisão de “' + s.termo + '” (' + s.regiao + ').' }); });
    });
    atividades.sort(porData('data', true));

    main.innerHTML =
      '<div class="container">' +
        '<div class="perfil-cabecalho">' + avatarHTML(p, true) + '<div>' +
          '<a class="voltar" href="#/comunidade/perfis" style="margin-bottom:8px">' + icone('i-voltar') + 'Todos os perfis</a>' +
          '<h1 class="titulo-pagina">' + esc(p.nome) + '</h1>' +
          '<p class="texto-suave" style="margin:6px 0 0">' + esc(p.funcao) + (vinculo ? ' · vínculo: <a href="#/perfil/' + esc(vinculo.id) + '">' + esc(vinculo.nome) + '</a>' : '') + '</p>' +
          (p.id !== 'u-demo' ? '<span class="ficticio" style="margin-top:10px">Perfil fictício · demonstração</span>' : '') +
        '</div></div>' +
        '<p class="subtitulo" style="margin-bottom:24px">' + esc(p.descricao) + '</p>' +
        '<div class="estatisticas">' +
          '<div class="estatistica"><strong>' + e.a + '</strong><span>' + e.aRot + '</span></div>' +
          '<div class="estatistica"><strong>' + e.b + '</strong><span>' + e.bRot + '</span></div>' +
          '<div class="estatistica"><strong>' + e.c + '</strong><span>' + e.cRot + '</span></div>' +
        '</div>' +
        '<div class="comunidade-grade">' +
          '<div>' +
            (p.tipo === 'instituicao' ? '<section class="bloco" style="margin-top:0"><h2>Revisores vinculados</h2><div class="perfis-grade">' + vinculados.map(cartaoPerfilHTML).join('') + '</div></section>' : '') +
            (envios.length ? '<section class="bloco" style="margin-top:0"><h2>Contribuições realizadas</h2><div class="grade-cartoes">' + envios.map(function (s) { return cartaoSinalHTML(s); }).join('') + '</div></section>' : '') +
            (revisados.length ? '<section class="bloco"><h2>Registros revisados</h2><div class="grade-cartoes">' + revisados.map(function (s) { return cartaoSinalHTML(s); }).join('') + '</div></section>' : '') +
            (!envios.length && !revisados.length && p.tipo !== 'instituicao' ? vazioHTML('Ainda sem contribuições', 'Envie um sinal ou avalie registros para ver sua atividade aqui.', '<a class="btn btn-contorno" href="#/enviar">Enviar um sinal</a>') : '') +
          '</div>' +
          '<aside><section class="painel"><h2 class="painel-titulo">' + icone('i-historico') + 'Histórico de atividade</h2>' + linhaTempoHTML(atividades.slice(0, 20)) + '</section></aside>' +
        '</div>' +
      '</div>';
    return p.nome;
  }

  /* ---------------------------------------------------------------
     Tela F — Painel de revisão profissional (simulação)
     --------------------------------------------------------------- */
  var FILTROS_FILA = {
    todos: { rotulo: 'Fila completa', teste: naFila },
    novos: { rotulo: 'Novos', teste: function (s) { return s.status === 'novo'; } },
    baixa: { rotulo: 'Baixa avaliação', teste: baixaAvaliacao },
    denuncias: { rotulo: 'Denúncias', teste: function (s) { return s.denuncias > 0; } },
    divergencias: { rotulo: 'Divergências', teste: function (s) { return s.status === 'divergencia'; } },
    revisados: { rotulo: 'Já revisados', teste: function (s) { return s.status === 'revisado'; } }
  };

  function motivosFila(s) {
    var m = [];
    if (s.status === 'novo') m.push('<span class="etiqueta info">' + icone('i-novo') + 'Novo</span>');
    if (baixaAvaliacao(s)) m.push('<span class="etiqueta alerta">' + icone('i-estrela') + 'Nota baixa ' + fmtNum(media(s).media) + '</span>');
    if (s.denuncias) m.push('<span class="etiqueta alerta">' + icone('i-bandeira') + plural(s.denuncias, 'denúncia', 'denúncias') + '</span>');
    var sug = s.sugestoes.filter(function (g) { return g.tipo !== 'denuncia'; }).length;
    if (sug) m.push('<span class="etiqueta">' + icone('i-lapis') + plural(sug, 'sugestão', 'sugestões') + '</span>');
    return m.join('');
  }

  function telaRevisao(r) {
    var teste = FILTROS_FILA[filaFiltro].teste;
    var fila = estado.sinais.filter(teste).sort(function (a, b) {
      // prioridade: denúncias, nota baixa, divergência, mais antigo primeiro
      var pa = (a.denuncias ? 4 : 0) + (baixaAvaliacao(a) ? 2 : 0) + (a.status === 'divergencia' ? 1 : 0);
      var pb = (b.denuncias ? 4 : 0) + (baixaAvaliacao(b) ? 2 : 0) + (b.status === 'divergencia' ? 1 : 0);
      return pb - pa || new Date(a.dataSubmissao) - new Date(b.dataSubmissao);
    });
    var sel = sinal(r.args[0]) || fila[0] || null;

    var decisoesTodas = [];
    estado.sinais.forEach(function (s) { s.pareceres.forEach(function (p) { decisoesTodas.push({ s: s, p: p, data: p.data }); }); });
    decisoesTodas.sort(porData('data', true));

    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Área profissional</span>' +
          '<h1 class="titulo-pagina">Painel de revisão profissional</h1>' +
          '<p class="subtitulo">Analise registros na fila, compare variantes e emita pareceres identificados. Cada decisão se soma ao histórico e aparece no selo do registro.</p></header>' +
        '<div class="aviso-simulacao" role="note">' + icone('i-alerta') + '<span><strong>Simulação.</strong> Os revisores são perfis fictícios. Os pareceres ficam salvos apenas neste navegador e não concedem credenciais reais a ninguém.</span></div>' +
        '<div class="revisao-layout">' +
          '<section class="fila" aria-labelledby="t-fila">' +
            '<h2 id="t-fila" class="sr-only">Fila de revisão</h2>' +
            '<div class="fila-filtros" role="group" aria-label="Filtrar fila">' + Object.keys(FILTROS_FILA).map(function (k) {
              var n = estado.sinais.filter(FILTROS_FILA[k].teste).length;
              return '<button type="button" class="filtro-pilula" data-acao="fila-filtro" data-fila="' + k + '" aria-pressed="' + (k === filaFiltro) + '">' + FILTROS_FILA[k].rotulo + '<span class="n">' + n + '</span></button>';
            }).join('') + '</div>' +
            (fila.length ? '<ul class="fila-lista">' + fila.map(function (s) {
              return '<li><a class="fila-item" href="#/revisao/' + esc(s.id) + '"' + (sel && sel.id === s.id ? ' aria-current="true"' : '') + '>' +
                '<span class="fila-item-topo"><strong>' + esc(s.termo) + (rotuloVariante(s) ? ' · ' + rotuloVariante(s) : '') + '</strong>' + seloHTML(s, { estatico: true }) + '</span>' +
                '<span class="meta"><span>' + esc(s.regiao) + '</span><span>Enviado em ' + fmtData(s.dataSubmissao) + '</span></span>' +
                '<span class="item-meta">' + motivosFila(s) + '</span></a></li>';
            }).join('') + '</ul>' : '<p class="fila-vazia">Nenhum registro neste filtro.</p>') +
          '</section>' +
          '<section aria-label="Registro selecionado">' + (sel ? fichaRevisaoHTML(sel) : vazioHTML('Selecione um registro', 'Escolha um item da fila para ver os dados da submissão e registrar um parecer.', '')) + '</section>' +
        '</div>' +
        '<section class="historico-decisoes" aria-labelledby="t-hist-dec"><div class="secao-cabecalho"><div><h2 id="t-hist-dec" class="titulo-secao">Histórico das decisões</h2>' +
          '<p>Todos os pareceres emitidos, do mais recente ao mais antigo. Nenhum parecer é apagado.</p></div></div>' +
          '<div class="tabela-wrap"><table><thead><tr><th scope="col">Data</th><th scope="col">Registro</th><th scope="col">Revisor</th><th scope="col">Decisão</th><th scope="col">Escopo</th></tr></thead><tbody>' +
          decisoesTodas.map(function (d) {
            return '<tr><td>' + fmtData(d.p.data) + '</td><td><a href="#/sinal/' + esc(d.s.id) + '">' + esc(d.s.termo) + '</a> · ' + esc(d.s.regiao) + '</td>' +
              '<td><a href="#/perfil/' + esc(d.p.revisorId) + '">' + esc(nomeDe(d.p.revisorId)) + '</a></td><td>' + DECISOES[d.p.decisao].curto + '</td>' +
              '<td>' + d.p.escopo.map(function (e) { return ESCOPOS[e]; }).join('; ') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        '</section>' +
      '</div>';

    atualizarCampoVariante();
    return 'Painel de revisão';
  }

  function fichaRevisaoHTML(s) {
    var m = media(s);
    var rel = relacionadas(s);
    var autor = perfil(s.autorId);
    var outros = estado.sinais.filter(function (x) { return x.id !== s.id; });
    var mesmo = mesmoTermo(s).filter(function (x) { return x.id !== s.id; })[0];

    return '<div class="ficha-revisao">' +
      '<div class="ficha-topo"><div><h2>' + esc(s.termo) + (rotuloVariante(s) ? ' <span class="cartao-variante">' + rotuloVariante(s) + '</span>' : '') + '</h2>' +
        '<div class="meta" style="margin-top:6px"><span>' + icone('i-local') + esc(s.regiao) + '</span><span>' + icone('i-calendario') + 'Enviado em ' + fmtData(s.dataSubmissao) + '</span></div></div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + seloHTML(s) + '<a class="btn btn-fantasma btn-p" href="#/sinal/' + esc(s.id) + '">Página pública ' + icone('i-seta') + '</a></div></div>' +
      '<div class="ficha-colunas">' +
        '<div class="painel"><h3 class="painel-titulo">' + icone('i-enviar') + 'Dados da submissão</h3>' +
          '<dl class="lista-definicao">' +
            '<dt>Significado</dt><dd>' + esc(s.significado) + '</dd><dt>Contexto</dt><dd>' + esc(s.contexto) + '</dd>' +
            '<dt>Região</dt><dd>' + esc(s.regiao) + (s.local ? ' · ' + esc(s.local) : '') + '</dd>' +
            '<dt>Comunidade</dt><dd>' + esc(s.comunidade || 'Não informada') + '</dd>' +
            '<dt>Autor</dt><dd>' + (autor ? '<a href="#/perfil/' + esc(autor.id) + '">' + esc(autor.nome) + '</a>' : '—') + '</dd>' +
            '<dt>Fonte</dt><dd>' + esc(s.fonte || 'Não informada.') + '</dd>' +
            '<dt>Vídeo</dt><dd>' + (s.video ? esc(s.video.nome) + (s.video.armazenado ? ' (neste navegador)' : ' (não armazenado)') : 'Não disponível nesta demonstração') + '</dd>' +
          '</dl></div>' +
        '<div class="painel"><h3 class="painel-titulo">' + icone('i-grupo') + 'Sinais da comunidade</h3>' +
          '<div class="painel-nota"><span class="nota-grande">' + (m.qtd ? fmtNum(m.media) : '—') + '</span><div>' + notaHTML(s) + '</div></div>' +
          '<div class="item-meta" style="margin-top:12px">' + (motivosFila(s) || '<span class="etiqueta">Sem alertas da comunidade</span>') + '</div>' +
          (s.sugestoes.length ? '<ul class="lista-comentarios" style="margin-top:14px">' + s.sugestoes.slice().sort(porData('data', true)).slice(0, 3).map(sugestaoItemHTML).join('') + '</ul>' : '') +
          '<p class="aviso-regra">' + icone('i-info') + '<span>A nota comunitária é um indicador para priorizar a fila. A decisão é do parecer profissional.</span></p>' +
        '</div>' +
      '</div>' +
      '<div class="painel"><h3 class="painel-titulo">' + icone('i-divergencia') + 'Variantes para comparar (' + rel.length + ')</h3>' +
        (rel.length ? '<ul class="variantes-lista">' + rel.map(function (x) {
          return '<li class="variante-item"><a href="#/revisao/' + esc(x.id) + '"><span class="vi-nome">' + esc(x.termo) + (rotuloVariante(x) ? ' · ' + rotuloVariante(x) : '') + '</span>' +
            '<span class="vi-meta">' + esc(x.regiao) + ' · ' + plural(x.pareceres.length, 'parecer', 'pareceres') + '</span>' + seloHTML(x, { estatico: true }) + '</a></li>';
        }).join('') + '</ul>' : '<p class="texto-suave">Nenhuma variante relacionada.</p>') +
      '</div>' +
      '<div class="painel"><h3 class="painel-titulo">' + icone('i-historico') + 'Pareceres anteriores (' + s.pareceres.length + ')</h3>' +
        (s.pareceres.length ? s.pareceres.slice().sort(porData('data', true)).map(parecerDetalheHTML).join('') : '<p class="texto-suave">Nenhum parecer registrado.</p>') +
      '</div>' +

      '<form class="form-parecer" data-form="parecer" data-id="' + esc(s.id) + '" novalidate>' +
        '<h3>Registrar parecer</h3>' +
        '<div class="duas-colunas">' +
          '<div class="campo"><label for="p-revisor">Revisor responsável <span class="obrigatorio">*</span></label>' +
            '<select id="p-revisor" name="revisor" required><option value="">Selecione o revisor</option>' + revisores().map(function (rv) {
              return '<option value="' + rv.id + '"' + (rv.id === revisorAtual ? ' selected' : '') + '>' + esc(rv.nome + ' — ' + rv.funcao) + ' (fictício)</option>';
            }).join('') + '</select></div>' +
          '<div class="campo"><label for="p-data">Data do parecer <span class="obrigatorio">*</span></label>' +
            '<input id="p-data" name="data" type="date" required value="' + hojeInput() + '" max="' + hojeInput() + '"></div>' +
        '</div>' +
        '<fieldset class="campo"><legend>Decisão <span class="obrigatorio">*</span></legend><div class="opcoes">' +
          Object.keys(DECISOES).map(function (k, i) {
            return '<label class="opcao opcao-cartao"><input type="radio" name="decisao" value="' + k + '"' + (i === 0 ? ' required' : '') + '>' +
              '<span><strong>' + DECISOES[k].rotulo + '</strong><span>' + DECISOES[k].ajuda + ' Situação resultante: ' + STATUS[DECISOES[k].status].rotulo + '.</span></span></label>';
          }).join('') + '</div></fieldset>' +
        '<div class="campo" id="p-variante-campo" hidden><label for="p-variante">Variante de qual registro? <span class="obrigatorio">*</span></label>' +
          '<select id="p-variante" name="varianteDe"><option value="">Selecione o registro</option>' + opcoesSinais([s.id], mesmo ? mesmo.id : '') + '</select>' +
          '<p class="ajuda">Os dois registros ficam relacionados e continuam disponíveis para consulta.</p></div>' +
        '<fieldset class="campo"><legend>Escopo da revisão <span class="obrigatorio">*</span></legend><div class="opcoes linha">' +
          Object.keys(ESCOPOS).map(function (k) {
            return '<label class="opcao"><input type="checkbox" name="escopo" value="' + k + '"><span>' + ESCOPOS[k] + '</span></label>';
          }).join('') + '</div></fieldset>' +
        '<div class="campo"><label for="p-texto">Parecer profissional <span class="obrigatorio">*</span></label>' +
          '<textarea id="p-texto" name="texto" maxlength="800" required placeholder="Descreva o que foi analisado e a justificativa da decisão."></textarea></div>' +
        '<div id="p-erros" aria-live="assertive"></div>' +
        '<div class="form-rodape">' +
          (s.status !== 'em_revisao' ? '<button type="button" class="btn btn-contorno" data-acao="assumir" data-id="' + esc(s.id) + '">' + icone('i-relogio') + 'Marcar como em revisão</button>' : '<span class="texto-fraco">Registro já está em revisão.</span>') +
          '<button type="submit" class="btn btn-primario">' + icone('i-selo') + 'Registrar parecer</button></div>' +
      '</form>' +
    '</div>';
  }

  function parecerDetalheHTML(p) {
    var rv = perfil(p.revisorId);
    var vinc = rv && rv.vinculo ? perfil(rv.vinculo) : null;
    return '<div class="parecer-modal"><div class="revisor" style="border:none;padding:0">' + avatarHTML(rv) + '<div>' +
      '<span class="revisor-nome"><a href="#/perfil/' + esc(rv.id) + '">' + esc(rv.nome) + '</a></span>' +
      '<small>' + esc(rv.funcao) + ' · perfil fictício' + (vinc ? ' · ' + esc(vinc.nome) + ' (fictícia)' : '') + '</small></div></div>' +
      '<dl class="lista-definicao" style="margin-top:10px"><dt>Data</dt><dd>' + fmtData(p.data) + '</dd>' +
      '<dt>Decisão</dt><dd>' + DECISOES[p.decisao].curto + '</dd>' +
      '<dt>Escopo</dt><dd>' + p.escopo.map(function (e) { return ESCOPOS[e]; }).join('; ') + '</dd></dl>' +
      '<blockquote>' + esc(p.texto) + '</blockquote></div>';
  }

  function atualizarCampoVariante() {
    var form = document.querySelector('[data-form="parecer"]');
    if (!form) return;
    var marcado = form.querySelector('input[name="decisao"]:checked');
    var campo = document.getElementById('p-variante-campo');
    campo.hidden = !(marcado && marcado.value === 'variante');
  }

  function registrarParecer(form) {
    var s = sinal(form.getAttribute('data-id'));
    var d = new FormData(form);
    var erros = [];
    var revisor = d.get('revisor'), decisao = d.get('decisao'), escopo = d.getAll('escopo'), texto = (d.get('texto') || '').trim();
    var dataStr = d.get('data'), varianteDe = d.get('varianteDe');
    if (!revisor) erros.push(['p-revisor', 'Selecione o revisor responsável.']);
    if (!dataStr) erros.push(['p-data', 'Informe a data do parecer.']);
    else if (dataStr > hojeInput()) erros.push(['p-data', 'A data do parecer não pode estar no futuro.']);
    if (!decisao) erros.push([form.querySelector('input[name="decisao"]').id || null, 'Escolha uma decisão.']);
    if (decisao === 'variante' && !varianteDe) erros.push(['p-variante', 'Indique de qual registro este sinal é variante.']);
    if (!escopo.length) erros.push([null, 'Marque pelo menos um item no escopo da revisão.']);
    if (texto.length < 15) erros.push(['p-texto', 'Escreva o parecer (pelo menos 15 caracteres).']);

    var caixa = document.getElementById('p-erros');
    if (erros.length) {
      caixa.innerHTML = erros.map(function (e) { return '<p class="erro-campo">' + icone('i-alerta') + e[1] + '</p>'; }).join('');
      var primeiro = erros[0][0] && document.getElementById(erros[0][0]);
      (primeiro || form.querySelector('input[name="decisao"]')).focus();
      return;
    }

    var partes = dataStr.split('-').map(Number);
    var data = new Date(partes[0], partes[1] - 1, partes[2], new Date().getHours(), new Date().getMinutes());
    var parecer = { id: uid('p'), revisorId: revisor, data: data.toISOString(), decisao: decisao, escopo: escopo, texto: texto };
    var antes = s.status;
    s.pareceres.push(parecer);
    s.status = DECISOES[decisao].status;
    s.historico.push({ data: parecer.data, tipo: 'parecer', texto: 'Parecer de ' + nomeDe(revisor) + ': ' + DECISOES[decisao].curto.toLowerCase() + '.' });
    if (antes !== s.status) s.historico.push({ data: parecer.data, tipo: 'status', texto: 'Situação alterada de “' + STATUS[antes].rotulo + '” para “' + STATUS[s.status].rotulo + '”.' });
    if (decisao === 'variante') relacionar(s, sinal(varianteDe), true);
    revisorAtual = revisor;
    salvar();
    renderizar({ manterPosicao: true });
    avisar('Parecer registrado. Situação: ' + STATUS[s.status].rotulo + '.');
  }

  /* ---------------------------------------------------------------
     Sobre
     --------------------------------------------------------------- */
  function telaSobre() {
    main.innerHTML =
      '<div class="container">' +
        '<header class="cabecalho-pagina"><span class="sobretitulo">Sobre o projeto</span>' +
          '<h1 class="titulo-pagina">Um glossário de Libras feito em conjunto.</h1>' +
          '<p class="subtitulo">Glossário Libras Brasil é uma proposta de plataforma colaborativa para pesquisar, cadastrar, avaliar e comparar sinais, com revisão profissional transparente.</p></header>' +
        '<div class="sobre-grade">' +
          '<div class="texto-longo">' +
            '<h2>O problema</h2>' +
            '<p>Encontrar um sinal de Libras na internet pode exigir pesquisas demoradas em vídeos dispersos, antigos e sem informações claras sobre atualidade, contexto e variação regional. Muitas vezes não se sabe quem gravou, quando, nem se alguém com formação revisou o conteúdo.</p>' +
            '<h2>A proposta</h2>' +
            '<ul><li>Glossário nacional pesquisável, com catálogo de variantes regionais.</li>' +
              '<li>Envio colaborativo de sinais, com vídeo, significado, contexto e região.</li>' +
              '<li>Avaliação comunitária: nota, clareza, correspondência e sugestões.</li>' +
              '<li>Revisão profissional com selos que identificam quem revisou, quando e com qual escopo.</li>' +
              '<li>Histórico completo de submissões, pareceres e atualizações.</li></ul>' +
            '<h2>Três dimensões separadas</h2>' +
            '<p>A plataforma mostra lado a lado, e nunca mistura: <strong>popularidade e avaliação comunitária</strong>, <strong>situação da revisão profissional</strong> e <strong>região e contexto de uso</strong>. Uma nota baixa pode colocar o registro na fila de análise, mas não apaga o sinal nem decide sozinha sua validade linguística.</p>' +
            '<h2>Variação regional</h2>' +
            '<p>Libras tem variações regionais e comunitárias. Um sinal não é considerado incorreto só porque é diferente de outro associado à mesma palavra. Variantes ficam relacionadas e disponíveis para consulta, mesmo quando revisores têm pareceres diferentes.</p>' +
            '<h2>Limitações deste protótipo</h2>' +
            '<ul><li>Funciona offline e sem servidor: os dados ficam no armazenamento local deste navegador.</li>' +
              '<li>Registros, regiões, perfis, instituições e pareceres são fictícios.</li>' +
              '<li>Não há vídeos autênticos de sinais. As áreas de mídia estão prontas para receber gravações legítimas.</li>' +
              '<li>O painel de revisão é uma simulação: não verifica identidade nem concede credenciais.</li>' +
              '<li>A prevenção de votos duplicados vale apenas para este navegador.</li></ul>' +
          '</div>' +
          '<aside class="lateral">' +
            '<section class="painel"><h2 class="painel-titulo">' + icone('i-restaurar') + 'Dados da demonstração</h2>' +
              '<p class="texto-suave" style="font-size:14.5px">Há ' + plural(estado.sinais.length, 'registro', 'registros') + ' neste navegador. Restaurar apaga envios, avaliações, comentários e pareceres feitos durante a demonstração.</p>' +
              '<button type="button" class="btn btn-contorno" data-acao="restaurar">' + icone('i-restaurar') + 'Restaurar dados iniciais</button></section>' +
            '<section class="painel"><h2 class="painel-titulo">Uma iniciativa</h2>' +
              '<div class="assinatura"><img src="assets/img/inclusivr-roxo.png" alt="InclusiVR" width="72" height="101">' +
              '<p class="texto-suave" style="margin:0;font-size:14.5px">A InclusiVR cria produtos para a disseminação e o ensino da Libras de forma lúdica e acessível.</p></div></section>' +
          '</aside>' +
        '</div>' +
      '</div>';
    return 'Sobre';
  }

  function telaNaoEncontrada() {
    main.innerHTML = '<div class="container" style="padding:64px 24px">' +
      '<h1 class="titulo-pagina" style="margin-bottom:20px">Página não encontrada</h1>' +
      vazioHTML('Não encontramos este endereço', 'O registro pode ter sido removido ao restaurar os dados de demonstração.',
        '<a class="btn btn-escuro" href="#/inicio">Ir para o início</a><a class="btn btn-contorno" href="#/explorar">Explorar sinais</a>') + '</div>';
    return 'Página não encontrada';
  }

  /* ---------------------------------------------------------------
     Modais
     --------------------------------------------------------------- */
  function abrirModal(titulo, html) {
    opener = document.activeElement;
    modalTitulo.textContent = titulo;
    modalCorpo.innerHTML = html;
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    // Foco no primeiro campo; sem campos, no botão de fechar (mantém o topo visível)
    var foco = modalCorpo.querySelector('input:not([type="hidden"]), select, textarea') || modal.querySelector('.modal-cabecalho [data-acao="fechar-modal"]');
    if (foco) foco.focus();
    modalCorpo.scrollTop = 0;
  }
  function fecharModal() {
    if (modal.open) { if (typeof modal.close === 'function') modal.close(); else modal.removeAttribute('open'); }
  }
  modal.addEventListener('close', function () {
    modalCorpo.innerHTML = '';
    if (!opener) return;
    var alvo = opener;
    if (!document.body.contains(alvo) && alvo.getAttribute) {
      // a tela foi redesenhada: procura o botão equivalente
      var acao = alvo.getAttribute('data-acao'), id = alvo.getAttribute('data-id');
      alvo = acao ? main.querySelector('[data-acao="' + acao + '"]' + (id ? '[data-id="' + id + '"]' : '')) : null;
    }
    if (alvo && document.body.contains(alvo) && !modal.open) alvo.focus();
    opener = null;
  });
  modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

  function modalSelo(s) {
    var st = STATUS[s.status];
    var html = '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">' + seloHTML(s, { grande: true, longo: true, estatico: true }) + '</div>' +
      '<p class="texto-suave">' + st.desc + '</p>' +
      '<p class="aviso-regra">' + icone('i-info') + '<span>A nota da comunidade (' + (media(s).qtd ? fmtNum(media(s).media) : 'sem avaliações') + ') é exibida à parte e não concede este selo.</span></p>' +
      '<h3 style="font-size:16px;margin:22px 0 12px">Pareceres emitidos (' + s.pareceres.length + ')</h3>' +
      (s.pareceres.length ? s.pareceres.slice().sort(porData('data', true)).map(parecerDetalheHTML).join('') :
        '<p class="texto-suave">Este registro ainda não recebeu parecer profissional.</p>') +
      '<p class="texto-fraco" style="margin-top:18px">Selo demonstrativo emitido por perfis fictícios. Não constitui certificação.</p>' +
      '<div class="modal-acoes"><a class="btn btn-contorno" href="#/revisao/' + esc(s.id) + '">Abrir no painel de revisão</a>' +
      '<button type="button" class="btn btn-escuro" data-acao="fechar-modal">Fechar</button></div>';
    abrirModal('Selo: ' + s.termo + (rotuloVariante(s) ? ' (' + rotuloVariante(s) + ', ' + s.regiao + ')' : ''), html);
  }

  function modalAvaliar(s) {
    var minha = minhaAvaliacao(s) || {};
    var escala = function (nome, mapa, atual, comEstrela) {
      return '<div class="escala">' + Object.keys(mapa).map(function (k) {
        return '<label><input type="radio" name="' + nome + '" value="' + k + '"' + (String(atual) === k ? ' checked' : '') + ' required>' +
          '<span>' + (comEstrela ? icone('i-estrela') : '') + mapa[k] + '</span></label>';
      }).join('') + '</div>';
    };
    var html = '<form class="form" data-form="avaliacao" data-id="' + esc(s.id) + '" novalidate>' +
      (minha.id ? '<p class="aviso-regra" style="margin-top:0">' + icone('i-check') + '<span>Você avaliou este registro em ' + fmtData(minha.data) + '. Ao enviar, sua avaliação anterior será substituída (uma por navegador).</span></p>' : '') +
      '<fieldset class="campo"><legend>Nota geral <span class="obrigatorio">*</span></legend>' + escala('nota', { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }, minha.nota, true) +
        '<p class="ajuda">1 = não ajuda · 5 = ajuda muito quem consulta.</p></fieldset>' +
      '<fieldset class="campo"><legend>Clareza do registro <span class="obrigatorio">*</span></legend>' + escala('clareza', CLAREZA, minha.clareza) + '</fieldset>' +
      '<fieldset class="campo"><legend>A descrição corresponde ao conteúdo apresentado? <span class="obrigatorio">*</span></legend>' +
        escala('corresponde', { sim: 'Sim', parcial: 'Em parte', nao: 'Não' }, minha.corresponde) + '</fieldset>' +
      '<div class="campo"><label for="a-comentario">Comentário ou sugestão de correção <span class="texto-fraco">(opcional)</span></label>' +
        '<textarea id="a-comentario" name="comentario" maxlength="400">' + esc(minha.comentario || '') + '</textarea>' +
        '<p class="ajuda">Se descrever um problema, ele também aparece como sugestão para os revisores.</p></div>' +
      '<label class="opcao"><input type="checkbox" name="variante" id="a-variante"' + (minha.variante ? ' checked' : '') + '><span>Conheço uma variante regional deste sinal</span></label>' +
      '<div id="a-variante-campos" class="duas-colunas"' + (minha.variante ? '' : ' hidden') + '>' +
        '<div class="campo"><label for="a-var-regiao">Região da variante</label><select id="a-var-regiao" name="varRegiao">' + opcoesRegiao('', 'Selecione') + '</select></div>' +
        '<div class="campo"><label for="a-var-obs">Onde é usada</label><input id="a-var-obs" name="varObs" type="text" maxlength="120" placeholder="Cidade, comunidade…"></div></div>' +
      '<div class="campo"><label for="a-nome">Nome para exibição <span class="texto-fraco">(opcional)</span></label>' +
        '<input id="a-nome" name="nome" type="text" maxlength="60" placeholder="Usuário anônimo" value="' + esc(minha.autor && minha.autor !== 'Usuário anônimo' ? minha.autor : '') + '"></div>' +
      '<div id="a-erros" aria-live="assertive"></div>' +
      '<p class="aviso-regra" style="margin-top:0">' + icone('i-info') + '<span>Sua nota altera a média demonstrativa, mas não muda a situação de revisão profissional.</span></p>' +
      '<div class="modal-acoes"><button type="button" class="btn btn-fantasma" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="submit" class="btn btn-primario">' + (minha.id ? 'Atualizar avaliação' : 'Registrar avaliação') + '</button></div>' +
      '</form>';
    abrirModal((minha.id ? 'Alterar avaliação: ' : 'Avaliar: ') + s.termo + (rotuloVariante(s) ? ' (' + rotuloVariante(s) + ')' : ''), html);
  }

  function registrarAvaliacao(form) {
    var s = sinal(form.getAttribute('data-id'));
    var d = new FormData(form);
    if (!d.get('nota') || !d.get('clareza') || !d.get('corresponde')) {
      document.getElementById('a-erros').innerHTML = '<p class="erro-campo">' + icone('i-alerta') + 'Responda nota, clareza e correspondência.</p>';
      form.querySelector('input[name="' + (!d.get('nota') ? 'nota' : !d.get('clareza') ? 'clareza' : 'corresponde') + '"]').focus();
      return;
    }
    var v = votanteId();
    var antes = media(s);
    var eraBaixa = baixaAvaliacao(s);
    var agora = new Date().toISOString();
    var existente = minhaAvaliacao(s);
    var av = {
      id: existente ? existente.id : uid('a'), autor: (d.get('nome') || '').trim() || 'Usuário anônimo', data: agora,
      nota: Number(d.get('nota')), clareza: Number(d.get('clareza')), corresponde: d.get('corresponde'),
      comentario: (d.get('comentario') || '').trim(), variante: !!d.get('variante'), votante: v
    };
    if (existente) s.avaliacoes[s.avaliacoes.indexOf(existente)] = av; else s.avaliacoes.push(av);

    // Comentários que apontam problema também viram sugestão para revisores
    if (av.comentario && av.corresponde !== 'sim') {
      s.sugestoes.push({ id: uid('g'), autor: av.autor, data: agora, tipo: 'descricao', texto: av.comentario });
      s.historico.push({ data: agora, tipo: 'sugestao', texto: 'Sugestão da comunidade registrada junto a uma avaliação.' });
    }
    if (av.variante) {
      var reg = d.get('varRegiao'), obs = (d.get('varObs') || '').trim();
      s.sugestoes.push({ id: uid('g'), autor: av.autor, data: agora, tipo: 'variante',
        texto: 'Conhece uma variante' + (reg ? ' na região ' + reg : '') + (obs ? ' (' + obs + ')' : '') + '.' });
      s.historico.push({ data: agora, tipo: 'sugestao', texto: 'A comunidade indicou uma possível variante regional.' });
    }
    var depois = media(s);
    if (!eraBaixa && baixaAvaliacao(s)) s.historico.push({ data: agora, tipo: 'fila', texto: 'Nota comunitária abaixo de 3: registro incluído na fila de análise. O sinal continua disponível.' });
    salvar();
    fecharModal();
    renderizar({ manterPosicao: true });
    avisar((existente ? 'Avaliação atualizada. ' : 'Avaliação registrada. ') + 'Nota demonstrativa: ' + (antes.qtd ? fmtNum(antes.media) + ' → ' : '') + fmtNum(depois.media) + '.');
  }

  function modalSugerir(s) {
    var html = '<form class="form" data-form="sugestao" data-id="' + esc(s.id) + '" novalidate>' +
      '<fieldset class="campo"><legend>Tipo de sugestão <span class="obrigatorio">*</span></legend><div class="opcoes">' +
        ['descricao', 'video', 'regiao', 'variante', 'denuncia'].map(function (k, i) {
          return '<label class="opcao"><input type="radio" name="tipo" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span>' + TIPOS_SUGESTAO[k] + '</span></label>';
        }).join('') + '</div></fieldset>' +
      '<div class="campo"><label for="g-texto">Descreva a sugestão <span class="obrigatorio">*</span></label>' +
        '<textarea id="g-texto" name="texto" maxlength="500" required></textarea>' +
        '<p class="ajuda">A sugestão fica visível no registro e no painel de revisão. Ela não altera o registro sozinha.</p></div>' +
      '<div id="g-erros" aria-live="assertive"></div>' +
      '<div class="modal-acoes"><button type="button" class="btn btn-fantasma" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="submit" class="btn btn-escuro">Enviar sugestão</button></div></form>';
    abrirModal('Sugerir correção: ' + s.termo, html);
  }

  function registrarSugestao(form) {
    var s = sinal(form.getAttribute('data-id'));
    var d = new FormData(form);
    var texto = (d.get('texto') || '').trim();
    if (texto.length < 5) {
      document.getElementById('g-erros').innerHTML = '<p class="erro-campo">' + icone('i-alerta') + 'Descreva a sugestão (pelo menos 5 caracteres).</p>';
      document.getElementById('g-texto').focus();
      return;
    }
    var tipo = d.get('tipo'), agora = new Date().toISOString();
    s.sugestoes.push({ id: uid('g'), autor: 'Você (usuário da demonstração)', data: agora, tipo: tipo, texto: texto });
    if (tipo === 'denuncia') s.denuncias += 1;
    s.historico.push({ data: agora, tipo: 'sugestao', texto: tipo === 'denuncia' ? 'Denúncia registrada pela comunidade; registro incluído na fila de análise.' : 'Sugestão da comunidade: ' + TIPOS_SUGESTAO[tipo].toLowerCase() + '.' });
    salvar();
    fecharModal();
    renderizar({ manterPosicao: true });
    avisar(tipo === 'denuncia' ? 'Denúncia registrada. O registro entrou na fila de análise.' : 'Sugestão registrada para os revisores.');
  }

  function modalRelacionar(s) {
    var opcoes = opcoesSinais([s.id].concat(s.relacionadas), '');
    var html = opcoes ? '<form class="form" data-form="relacionar" data-id="' + esc(s.id) + '">' +
      '<div class="campo"><label for="r-alvo">Relacionar “' + esc(s.termo) + '” (' + esc(s.regiao) + ') a</label>' +
        '<select id="r-alvo" name="alvo" required>' + opcoes + '</select>' +
        '<p class="ajuda">Use para variantes regionais do mesmo conceito ou para sinais relacionados. A relação aparece nos dois registros.</p></div>' +
      '<p class="aviso-regra" style="margin-top:0">' + icone('i-info') + '<span>Relacionar variantes não altera a situação de revisão de nenhum dos registros.</span></p>' +
      '<div class="modal-acoes"><button type="button" class="btn btn-fantasma" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="submit" class="btn btn-escuro">' + icone('i-ligar') + 'Relacionar</button></div></form>'
      : '<p>Este registro já está relacionado a todos os outros.</p><div class="modal-acoes"><button type="button" class="btn btn-escuro" data-acao="fechar-modal">Fechar</button></div>';
    abrirModal('Relacionar variante', html);
  }

  function modalRestaurar() {
    abrirModal('Restaurar dados iniciais?',
      '<p>Isso apaga os sinais enviados, avaliações, comentários, sugestões, pareceres e vídeos guardados durante a demonstração e volta aos ' + window.GLB_SEED.sinais.length + ' registros fictícios originais.</p>' +
      '<div class="modal-acoes"><button type="button" class="btn btn-fantasma" data-acao="fechar-modal">Cancelar</button>' +
      '<button type="button" class="btn btn-escuro" data-acao="confirmar-restaurar">' + icone('i-restaurar') + 'Restaurar</button></div>');
  }

  function restaurar() {
    Object.keys(videosSessao).forEach(function (k) { URL.revokeObjectURL(videosSessao[k]); });
    videosSessao = {};
    Videos.limpar();
    estado = construirSemente();
    salvar();
    filtros = { q: '', regiao: '', status: '', periodo: '', ordem: 'recentes' };
    filaFiltro = 'todos'; comunidadeFiltro = 'todos'; revisorAtual = '';
    fecharModal();
    ir('#/inicio');
    avisar('Dados de demonstração restaurados.');
  }

  /* ---------------------------------------------------------------
     Menu móvel
     --------------------------------------------------------------- */
  var btnMenu = document.querySelector('.btn-menu');
  var nav = document.getElementById('nav-principal');
  function fecharMenu() { nav.classList.remove('aberto'); btnMenu.setAttribute('aria-expanded', 'false'); }
  btnMenu.addEventListener('click', function () {
    var aberto = nav.classList.toggle('aberto');
    btnMenu.setAttribute('aria-expanded', String(aberto));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('aberto')) { fecharMenu(); btnMenu.focus(); }
  });

  /* ---------------------------------------------------------------
     Eventos (delegação)
     --------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    switch (acao) {
      case 'fechar-modal': fecharModal(); break;
      case 'restaurar': modalRestaurar(); break;
      case 'confirmar-restaurar': restaurar(); break;
      case 'selo': e.preventDefault(); modalSelo(sinal(id)); break;
      case 'avaliar': modalAvaliar(sinal(id)); break;
      case 'sugerir': modalSugerir(sinal(id)); break;
      case 'relacionar': modalRelacionar(sinal(id)); break;
      case 'buscar-termo':
        filtros = { q: alvo.getAttribute('data-termo'), regiao: '', status: '', periodo: '', ordem: 'recentes' };
        ir('#/explorar');
        break;
      case 'limpar-filtros':
        filtros = { q: '', regiao: '', status: '', periodo: '', ordem: filtros.ordem };
        ['f-q', 'f-regiao', 'f-status', 'f-periodo'].forEach(function (i) { var el = document.getElementById(i); if (el) el.value = ''; });
        renderizarResultados();
        break;
      case 'remover-filtro':
        var k = alvo.getAttribute('data-filtro-chave');
        filtros[k] = '';
        var campo = document.querySelector('[data-filtro="' + k + '"]');
        if (campo) campo.value = '';
        renderizarResultados();
        var prox = document.querySelector('.filtro-ativo') || document.getElementById('f-q');
        if (prox) prox.focus();
        break;
      case 'fila-filtro':
        filaFiltro = alvo.getAttribute('data-fila');
        focoPendente = '[data-acao="fila-filtro"][data-fila="' + filaFiltro + '"]';
        ir('#/revisao');
        break;
      case 'assumir':
        var form = document.querySelector('[data-form="parecer"]');
        var rev = form && form.elements.revisor.value;
        if (!rev) {
          document.getElementById('p-erros').innerHTML = '<p class="erro-campo">' + icone('i-alerta') + 'Selecione o revisor que vai assumir a revisão.</p>';
          document.getElementById('p-revisor').focus();
          return;
        }
        var s = sinal(id), agora = new Date().toISOString(), antes = s.status;
        s.status = 'em_revisao';
        s.historico.push({ data: agora, tipo: 'revisao', texto: 'Revisão iniciada por ' + nomeDe(rev) + ' (perfil fictício). Situação anterior: ' + STATUS[antes].rotulo + '.' });
        revisorAtual = rev;
        salvar();
        renderizar({ manterPosicao: true });
        avisar('Registro marcado como em revisão.');
        break;
      case 'velocidade':
        var video = document.querySelector('#midia-sinal video');
        if (video) video.playbackRate = Number(alvo.getAttribute('data-vel'));
        document.querySelectorAll('[data-acao="velocidade"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === alvo)); });
        break;
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    var tipo = form.getAttribute('data-form');
    if (!tipo) return;
    e.preventDefault();
    if (tipo === 'busca-inicio') {
      filtros = { q: form.elements.q.value.trim(), regiao: '', status: '', periodo: '', ordem: 'recentes' };
      ir('#/explorar');
    } else if (tipo === 'envio') enviarSinal(form);
    else if (tipo === 'avaliacao') registrarAvaliacao(form);
    else if (tipo === 'sugestao') registrarSugestao(form);
    else if (tipo === 'parecer') registrarParecer(form);
    else if (tipo === 'relacionar') {
      var a = sinal(form.getAttribute('data-id')), b = sinal(form.elements.alvo.value);
      relacionar(a, b, true);
      salvar(); fecharModal(); renderizar({ manterPosicao: true });
      avisar('Variantes relacionadas: “' + a.termo + '” e “' + b.termo + '” (' + b.regiao + ').');
    } else if (tipo === 'comentario') {
      var s = sinal(form.getAttribute('data-id'));
      var texto = form.elements.texto.value.trim();
      if (!texto) { form.elements.texto.focus(); return; }
      s.comentarios.push({ id: uid('c'), autor: 'Você (usuário da demonstração)', data: new Date().toISOString(), texto: texto });
      salvar(); renderizar({ manterPosicao: true });
      avisar('Comentário publicado (demonstração).');
    }
  });

  // Filtros da tela Explorar: atualizam os resultados enquanto se digita
  document.addEventListener('input', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-filtro');
    if (k) { filtros[k] = e.target.value; renderizarResultados(); }
    if (e.target.id === 'e-termo') atualizarTermoExistente();
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    var k = t.getAttribute('data-filtro');
    if (k) { filtros[k] = t.value; renderizarResultados(); return; }
    if (t.getAttribute('data-acao-change') === 'comunidade-filtro') {
      comunidadeFiltro = t.value;
      renderizar({ manterPosicao: true });
      var sel = document.getElementById('c-filtro'); if (sel) sel.focus();
      return;
    }
    if (t.name === 'decisao') atualizarCampoVariante();
    if (t.id === 'p-revisor') revisorAtual = t.value;
    if (t.id === 'a-variante') document.getElementById('a-variante-campos').hidden = !t.checked;
    if (t.id === 'e-video') {
      var previa = document.getElementById('e-video-previa');
      var grupo = document.getElementById('e-armazenar-grupo');
      if (previa.dataset.url) URL.revokeObjectURL(previa.dataset.url);
      var f = t.files[0];
      if (!f) { previa.innerHTML = ''; grupo.hidden = true; return; }
      var url = URL.createObjectURL(f);
      previa.dataset.url = url;
      previa.innerHTML = '<video controls preload="metadata" src="' + url + '" aria-label="Pré-visualização do vídeo selecionado"></video>' +
        '<p class="ajuda">' + esc(f.name) + ' · ' + (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB' +
        (f.size > LIMITE_VIDEO ? ' · grande demais para guardar no navegador; ficará disponível só nesta sessão' : '') + '</p>';
      grupo.hidden = false;
    }
  });

  window.addEventListener('hashchange', function () { fecharModal(); renderizar(); });

  /* ---------------------------------------------------------------
     Início
     --------------------------------------------------------------- */
  carregar();
  if (!location.hash) { try { history.replaceState(null, '', '#/inicio'); } catch (e) { /* alguns navegadores bloqueiam em file:// */ } }
  renderizar();
})();
