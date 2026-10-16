/* =====================================================================
   Glossário Libras Brasil — dados de demonstração
   ---------------------------------------------------------------------
   TODOS os registros, perfis, regiões, avaliações e pareceres abaixo são
   FICTÍCIOS. Servem apenas para mostrar a interface e não descrevem o uso
   real de nenhum sinal em nenhuma região. Nenhum vídeo de sinal é incluído:
   as áreas de mídia ficam prontas para receber gravações legítimas.

   As datas são relativas ("dias atrás") e convertidas em datas reais no
   momento em que os dados são carregados ou restaurados, para que os
   filtros por período continuem fazendo sentido em qualquer dia da
   apresentação.
   ===================================================================== */

window.GLB_SEED = (function () {
  'use strict';

  /* Regiões usadas nos filtros e no formulário. */
  var regioes = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

  /* Perfis demonstrativos. Função "revisor" = profissional que pode emitir
     parecer no painel de revisão (simulado, sem credencial real). */
  var perfis = [
    {
      id: 'r-ana', tipo: 'revisor', nome: 'Ana Ribeiro',
      funcao: 'Intérprete e tradutora de Libras',
      descricao: 'Perfil fictício de revisora. Atua na revisão de correspondência entre sinal e significado.',
      vinculo: 'i-instituto', desde: 420
    },
    {
      id: 'r-marcos', tipo: 'revisor', nome: 'Marcos Teixeira',
      funcao: 'Professor surdo de Libras',
      descricao: 'Perfil fictício de revisor. Atua na revisão de uso, contexto e variação comunitária.',
      vinculo: 'i-associacao', desde: 380
    },
    {
      id: 'r-lucia', tipo: 'revisor', nome: 'Lúcia Prado',
      funcao: 'Linguista, pesquisadora de línguas de sinais',
      descricao: 'Perfil fictício de revisora. Atua na documentação de variantes regionais.',
      vinculo: 'i-instituto', desde: 300
    },
    {
      id: 'r-paulo', tipo: 'revisor', nome: 'Paulo Almeida',
      funcao: 'Instrutor de Libras',
      descricao: 'Perfil fictício de revisor. Atua na revisão de clareza e qualidade das gravações.',
      vinculo: 'i-associacao', desde: 200
    },
    {
      id: 'u-carla', tipo: 'contribuidor', nome: 'Carla Menezes',
      funcao: 'Contribuidora', descricao: 'Perfil fictício de contribuidora da comunidade.', desde: 260
    },
    {
      id: 'u-joao', tipo: 'contribuidor', nome: 'João Pereira',
      funcao: 'Contribuidor', descricao: 'Perfil fictício de contribuidor da comunidade.', desde: 240
    },
    {
      id: 'u-beatriz', tipo: 'contribuidor', nome: 'Beatriz Souza',
      funcao: 'Contribuidora', descricao: 'Perfil fictício de contribuidora da comunidade.', desde: 190
    },
    {
      id: 'u-rafael', tipo: 'contribuidor', nome: 'Rafael Tavares',
      funcao: 'Contribuidor', descricao: 'Perfil fictício de contribuidor da comunidade.', desde: 120
    },
    {
      id: 'u-demo', tipo: 'contribuidor', nome: 'Você (usuário da demonstração)',
      funcao: 'Contribuidor', descricao: 'Perfil usado pelas ações feitas neste navegador durante a demonstração.', desde: 0
    },
    {
      id: 'i-instituto', tipo: 'instituicao', nome: 'Instituto Exemplo de Educação Bilíngue',
      funcao: 'Instituição parceira (fictícia)',
      descricao: 'Instituição ilustrativa criada para a demonstração. Não representa nenhuma instituição real.',
      desde: 450
    },
    {
      id: 'i-associacao', tipo: 'instituicao', nome: 'Associação Modelo de Surdos',
      funcao: 'Instituição parceira (fictícia)',
      descricao: 'Associação ilustrativa criada para a demonstração. Não representa nenhuma entidade real.',
      desde: 430
    }
  ];

  /* Registros de sinais.
     dias = dias atrás da submissão; base = avaliações anteriores agregadas
     (soma das notas e quantidade); avaliacoes = avaliações detalhadas mais
     recentes, que também entram na média. */
  var sinais = [
    {
      id: 's-saudade-a', termo: 'Saudade', regiao: 'Nordeste', local: 'Recife (PE)',
      comunidade: 'Comunidade escolar bilíngue (exemplo)',
      significado: 'Sentimento de falta de alguém, de um lugar ou de um momento que ficou no passado.',
      contexto: 'Uso cotidiano, em conversas informais e em relatos pessoais.',
      fonte: 'Gravação enviada pela contribuidora (exemplo).',
      autorId: 'u-carla', dias: 160, status: 'revisado', denuncias: 0,
      base: { soma: 160, qtd: 35 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 30, nota: 5, clareza: 3, corresponde: 'sim', comentario: 'Gravação nítida.' },
        { autor: 'João Pereira', dias: 22, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'Usuário anônimo', dias: 9, nota: 5, clareza: 2, corresponde: 'sim', comentario: 'Seria bom ter um exemplo em frase.' }
      ],
      pareceres: [
        { revisorId: 'r-ana', dias: 140, decisao: 'validar', escopo: ['correspondencia', 'contexto'],
          texto: 'O registro corresponde ao significado descrito e o contexto de uso está adequado. Revisão restrita à comunidade informada.' }
      ],
      comentarios: [
        { autor: 'Beatriz Souza', dias: 40, texto: 'Usamos este registro em sala de aula (comentário demonstrativo).' }
      ],
      relacionadas: ['s-saudade-b']
    },
    {
      id: 's-saudade-b', termo: 'Saudade', regiao: 'Sul', local: 'Porto Alegre (RS)',
      comunidade: 'Grupo de convivência (exemplo)',
      significado: 'Sentimento de falta de alguém, de um lugar ou de um momento que ficou no passado.',
      contexto: 'Uso cotidiano, mais frequente entre jovens segundo o autor do envio.',
      fonte: 'Não informada.',
      autorId: 'u-joao', dias: 95, status: 'divergencia', denuncias: 0,
      base: { soma: 82, qtd: 20 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 12, nota: 4, clareza: 2, corresponde: 'sim', comentario: 'Conheço outro sinal para saudade.', variante: true },
        { autor: 'Carla Menezes', dias: 6, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [
        { revisorId: 'r-lucia', dias: 60, decisao: 'variante', escopo: ['regiao', 'correspondencia'],
          texto: 'Registro reconhecido como variante regional do conceito "Saudade". As duas formas podem coexistir no glossário.' },
        { revisorId: 'r-marcos', dias: 35, decisao: 'divergencia', escopo: ['contexto'],
          texto: 'Há dúvida sobre a faixa etária e o contexto informados. Sugiro consulta a mais pessoas da comunidade antes de concluir.' }
      ],
      comentarios: [
        { autor: 'Rafael Tavares', dias: 20, texto: 'Interessante comparar com a variante do Nordeste (comentário demonstrativo).' }
      ],
      relacionadas: ['s-saudade-a']
    },
    {
      id: 's-obrigado-a', termo: 'Obrigado', regiao: 'Sudeste', local: 'São Paulo (SP)',
      comunidade: 'Comunidade surda local (exemplo)',
      significado: 'Expressão de agradecimento por algo recebido ou feito por outra pessoa.',
      contexto: 'Uso em situações formais e informais.',
      fonte: 'Material de aula do contribuidor (exemplo).',
      autorId: 'u-beatriz', dias: 210, status: 'revisado', denuncias: 0,
      base: { soma: 293, qtd: 61 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 18, nota: 5, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'Rafael Tavares', dias: 11, nota: 5, clareza: 3, corresponde: 'sim', comentario: 'Muito claro.' },
        { autor: 'Usuário anônimo', dias: 4, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [
        { revisorId: 'r-marcos', dias: 190, decisao: 'validar', escopo: ['correspondencia', 'contexto', 'video'],
          texto: 'Registro claro, com descrição coerente e gravação adequada.' },
        { revisorId: 'r-paulo', dias: 170, decisao: 'validar', escopo: ['video'],
          texto: 'Revisão de qualidade da gravação: enquadramento e iluminação adequados para consulta.' }
      ],
      comentarios: [],
      relacionadas: []
    },
    {
      id: 's-familia-a', termo: 'Família', regiao: 'Sudeste', local: 'Belo Horizonte (MG)',
      comunidade: 'Escola bilíngue (exemplo)',
      significado: 'Grupo de pessoas ligadas por parentesco ou por convivência e afeto.',
      contexto: 'Uso escolar e cotidiano.',
      fonte: 'Gravação própria (exemplo).',
      autorId: 'u-carla', dias: 130, status: 'revisado', denuncias: 0,
      base: { soma: 115, qtd: 26 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 25, nota: 5, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'João Pereira', dias: 14, nota: 4, clareza: 2, corresponde: 'parcial', comentario: 'A descrição poderia citar o uso escolar.' },
        { autor: 'Usuário anônimo', dias: 3, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [
        { revisorId: 'r-lucia', dias: 100, decisao: 'validar', escopo: ['correspondencia', 'regiao'],
          texto: 'Correspondência adequada. A indicação regional se refere à comunidade informada e não exclui outras formas.' }
      ],
      comentarios: [],
      relacionadas: ['s-familia-b']
    },
    {
      id: 's-familia-b', termo: 'Família', regiao: 'Norte', local: 'Manaus (AM)',
      comunidade: 'Associação local (exemplo)',
      significado: 'Grupo de pessoas ligadas por parentesco ou por convivência e afeto.',
      contexto: 'Uso cotidiano.',
      fonte: 'Não informada.',
      autorId: 'u-rafael', dias: 40, status: 'em_revisao', denuncias: 0,
      base: { soma: 34, qtd: 9 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 15, nota: 4, clareza: 2, corresponde: 'sim', comentario: '' },
        { autor: 'Beatriz Souza', dias: 8, nota: 5, clareza: 3, corresponde: 'sim', comentario: 'Bom ter mais de uma variante registrada.' }
      ],
      pareceres: [],
      historicoExtra: [
        { dias: 10, tipo: 'revisao', texto: 'Revisão iniciada por Lúcia Prado (perfil fictício).' }
      ],
      comentarios: [],
      relacionadas: ['s-familia-a']
    },
    {
      id: 's-escola-a', termo: 'Escola', regiao: 'Centro-Oeste', local: 'Brasília (DF)',
      comunidade: 'Grupo de estudos (exemplo)',
      significado: 'Instituição ou lugar onde se ensina e se aprende.',
      contexto: 'Uso cotidiano e escolar.',
      fonte: 'Gravação própria (exemplo).',
      autorId: 'u-joao', dias: 2, status: 'novo', denuncias: 0,
      base: { soma: 0, qtd: 0 }, avaliacoes: [], pareceres: [], comentarios: [],
      relacionadas: ['s-escola-b']
    },
    {
      id: 's-escola-b', termo: 'Escola', regiao: 'Sul', local: 'Pelotas (RS)',
      comunidade: 'Não informada',
      significado: 'Instituição ou lugar onde se ensina e se aprende.',
      contexto: 'O autor não informou o contexto.',
      fonte: 'Não informada.',
      autorId: 'u-rafael', dias: 26, status: 'novo', denuncias: 2,
      base: { soma: 7, qtd: 4 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 5, nota: 2, clareza: 1, corresponde: 'nao', comentario: 'O vídeo parece cortado no início.' }
      ],
      sugestoes: [
        { autor: 'Usuário anônimo', dias: 5, tipo: 'video', texto: 'O vídeo parece cortado no início; seria bom regravar.' },
        { autor: 'Usuário anônimo', dias: 4, tipo: 'denuncia', texto: 'Registro sem contexto e com gravação incompleta.' }
      ],
      pareceres: [], comentarios: [],
      relacionadas: ['s-escola-a']
    },
    {
      id: 's-amizade-a', termo: 'Amizade', regiao: 'Sul', local: 'Curitiba (PR)',
      comunidade: 'Coletivo cultural (exemplo)',
      significado: 'Relação de afeto, confiança e companheirismo entre pessoas.',
      contexto: 'Uso cotidiano.',
      fonte: 'Não informada.',
      autorId: 'u-beatriz', dias: 75, status: 'atualizacao', denuncias: 0,
      base: { soma: 13, qtd: 6 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 30, nota: 2, clareza: 1, corresponde: 'parcial', comentario: 'A descrição não bate com o vídeo.' },
        { autor: 'Carla Menezes', dias: 21, nota: 3, clareza: 2, corresponde: 'parcial', comentario: '' },
        { autor: 'Usuário anônimo', dias: 16, nota: 3, clareza: 2, corresponde: 'nao', comentario: '' }
      ],
      sugestoes: [
        { autor: 'Carla Menezes', dias: 21, tipo: 'descricao', texto: 'A descrição fala em "amigo", mas o registro trata de "amizade" como relação.' }
      ],
      pareceres: [
        { revisorId: 'r-marcos', dias: 12, decisao: 'correcao', escopo: ['correspondencia', 'contexto'],
          texto: 'Solicito ao autor revisar a descrição para que corresponda ao conteúdo do vídeo. O sinal permanece disponível para consulta.' }
      ],
      comentarios: [],
      relacionadas: ['s-amizade-b']
    },
    {
      id: 's-amizade-b', termo: 'Amizade', regiao: 'Nordeste', local: 'Fortaleza (CE)',
      comunidade: 'Escola estadual (exemplo)',
      significado: 'Relação de afeto, confiança e companheirismo entre pessoas.',
      contexto: 'Uso escolar, entre crianças e adolescentes.',
      fonte: 'Gravação feita em oficina (exemplo).',
      autorId: 'u-carla', dias: 33, status: 'em_revisao', denuncias: 0,
      base: { soma: 20, qtd: 5 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 7, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [],
      historicoExtra: [
        { dias: 6, tipo: 'revisao', texto: 'Revisão iniciada por Ana Ribeiro (perfil fictício).' }
      ],
      comentarios: [],
      relacionadas: ['s-amizade-a']
    },
    {
      id: 's-trabalho-a', termo: 'Trabalho', regiao: 'Centro-Oeste', local: 'Goiânia (GO)',
      comunidade: 'Associação local (exemplo)',
      significado: 'Atividade realizada para produzir algo ou prestar um serviço; também o lugar onde ela acontece.',
      contexto: 'Uso cotidiano e profissional.',
      fonte: 'Gravação própria (exemplo).',
      autorId: 'u-joao', dias: 180, status: 'revisado', denuncias: 0,
      base: { soma: 59, qtd: 14 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 40, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'Rafael Tavares', dias: 28, nota: 5, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'Usuário anônimo', dias: 10, nota: 4, clareza: 2, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [
        { revisorId: 'r-ana', dias: 150, decisao: 'validar', escopo: ['correspondencia', 'video'],
          texto: 'Correspondência adequada e gravação legível.' }
      ],
      comentarios: [
        { autor: 'Carla Menezes', dias: 50, texto: 'Seria útil um exemplo em frase (comentário demonstrativo).' }
      ],
      relacionadas: ['s-trabalho-b', 's-trabalho-c']
    },
    {
      id: 's-trabalho-b', termo: 'Trabalho', regiao: 'Nordeste', local: 'Salvador (BA)',
      comunidade: 'Comunidade religiosa (exemplo)',
      significado: 'Atividade realizada para produzir algo ou prestar um serviço; também o lugar onde ela acontece.',
      contexto: 'Uso cotidiano.',
      fonte: 'Não informada.',
      autorId: 'u-beatriz', dias: 8, status: 'novo', denuncias: 0,
      base: { soma: 3, qtd: 1 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 3, nota: 3, clareza: 2, corresponde: 'parcial', comentario: '' }
      ],
      pareceres: [], comentarios: [],
      relacionadas: ['s-trabalho-a', 's-trabalho-c']
    },
    {
      id: 's-trabalho-c', termo: 'Trabalho', regiao: 'Sul', local: 'Florianópolis (SC)',
      comunidade: 'Não informada',
      significado: 'Atividade realizada para produzir algo ou prestar um serviço.',
      contexto: 'Uso profissional.',
      fonte: 'Não informada.',
      autorId: 'u-rafael', dias: 55, status: 'em_revisao', denuncias: 1,
      base: { soma: 13, qtd: 5 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 20, nota: 3, clareza: 2, corresponde: 'parcial', comentario: '' },
        { autor: 'Usuário anônimo', dias: 14, nota: 2, clareza: 1, corresponde: 'nao', comentario: 'Pouco nítido.' }
      ],
      sugestoes: [
        { autor: 'Usuário anônimo', dias: 14, tipo: 'denuncia', texto: 'Gravação escura, difícil de acompanhar.' }
      ],
      pareceres: [],
      historicoExtra: [
        { dias: 9, tipo: 'revisao', texto: 'Revisão iniciada por Paulo Almeida (perfil fictício).' }
      ],
      comentarios: [],
      relacionadas: ['s-trabalho-a', 's-trabalho-b']
    },
    {
      id: 's-aprender-a', termo: 'Aprender', regiao: 'Norte', local: 'Belém (PA)',
      comunidade: 'Projeto de extensão (exemplo)',
      significado: 'Adquirir conhecimento ou habilidade por meio de estudo, prática ou experiência.',
      contexto: 'Uso escolar e cotidiano.',
      fonte: 'Gravação própria (exemplo).',
      autorId: 'u-carla', dias: 1, status: 'novo', denuncias: 0,
      base: { soma: 0, qtd: 0 }, avaliacoes: [], pareceres: [], comentarios: [],
      relacionadas: ['s-aprender-b']
    },
    {
      id: 's-aprender-b', termo: 'Aprender', regiao: 'Sudeste', local: 'Rio de Janeiro (RJ)',
      comunidade: 'Escola bilíngue (exemplo)',
      significado: 'Adquirir conhecimento ou habilidade por meio de estudo, prática ou experiência.',
      contexto: 'Uso escolar.',
      fonte: 'Material de oficina (exemplo).',
      autorId: 'u-joao', dias: 120, status: 'revisado', denuncias: 0,
      base: { soma: 85, qtd: 19 },
      avaliacoes: [
        { autor: 'Usuário anônimo', dias: 19, nota: 5, clareza: 3, corresponde: 'sim', comentario: '' },
        { autor: 'Beatriz Souza', dias: 5, nota: 4, clareza: 3, corresponde: 'sim', comentario: '' }
      ],
      pareceres: [
        { revisorId: 'r-lucia', dias: 90, decisao: 'validar', escopo: ['correspondencia', 'contexto', 'regiao'],
          texto: 'Registro coerente com a descrição. A indicação regional reflete apenas a comunidade informada pelo autor.' }
      ],
      comentarios: [],
      relacionadas: ['s-aprender-a']
    }
  ];

  return { regioes: regioes, perfis: perfis, sinais: sinais };
})();
