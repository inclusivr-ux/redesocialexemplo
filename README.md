# Glossário Libras Brasil — protótipo demonstrativo

Protótipo visual e interativo de um **glossário nacional colaborativo de Libras**, desenvolvido pela InclusiVR para apresentação presencial. A proposta reúne pesquisa de sinais, catálogo de variantes regionais, envio colaborativo, avaliação comunitária, revisão profissional com selos identificados e histórico aberto de cada registro.

> **Tudo é demonstrativo.** Registros, regiões, perfis, instituições, avaliações e pareceres são fictícios. Nenhum vídeo de sinal é incluído e nada é enviado para a internet.

## Como executar (offline)

1. Baixe ou clone esta pasta.
2. Abra o arquivo `index.html` com dois cliques (ou arraste-o para o navegador).

Não é preciso servidor, instalação nem conexão. Funciona em Chrome, Edge, Firefox e Safari atuais. Fontes, ícones e imagens são arquivos locais.

## Roteiro sugerido para a apresentação (cerca de 5 minutos)

1. **Início:** pesquise "saudade" no campo em destaque. Mostre os indicadores (marcados como demonstrativos) e a seção de variantes regionais.
2. **Explorar sinais:** troque a região, a situação de revisão e a data de submissão. Ordene por nota. Pesquise uma palavra inexistente para mostrar o estado vazio, que oferece enviar o sinal.
3. **Detalhes do sinal:** abra "Saudade · Variante B". Mostre as três dimensões separadas (revisão profissional, avaliação comunitária, região e contexto), o histórico e as variantes relacionadas. Clique no selo **Com divergências** para ver os dois pareceres diferentes.
4. **Avaliar:** dê uma nota. A média muda, mas o selo continua igual. Avalie de novo para mostrar que a avaliação é substituída, e não duplicada.
5. **Enviar sinal:** preencha o formulário (o vídeo é opcional) e envie. O registro aparece como **Novo registro — aguardando revisão**.
6. **Painel de revisão:** abra o novo registro, escolha um revisor fictício, decida "Validar", marque o escopo e registre o parecer. Volte para Explorar ou para o Início: a nova situação aparece em todas as telas.
7. **Restaurar:** use "Restaurar dados iniciais" no rodapé para deixar tudo pronto para a próxima apresentação.

## Telas

| Tela | Endereço | O que demonstra |
| --- | --- | --- |
| A — Início | `#/inicio` | Busca em destaque, recentes, revisados, variantes regionais, indicadores e como funciona a validação |
| B — Explorar | `#/explorar` | Pesquisa por palavra, filtros (região, situação, data), ordenação e estado sem resultados |
| C — Detalhes | `#/sinal/ID` | Área de vídeo, significado, contexto, região, datas, nota, histórico, variantes, comentários, avaliação, correção e revisores |
| D — Enviar | `#/enviar` | Formulário com validação, vídeo local, fonte, declaração de autorização e confirmação |
| E — Avaliação comunitária | `#/comunidade` | Nota de 1 a 5, clareza, correspondência, sugestão, variante conhecida e avaliações recentes |
| F — Painel de revisão | `#/revisao` | Fila com filtros (baixa avaliação, denúncias, divergências), dados da submissão, parecer, revisor, data e histórico das decisões |
| G — Perfis e validações | `#/comunidade/perfis`, `#/perfil/ID`, `#/comunidade/selos` | Contribuidores, revisores e instituições fictícios, atividade e significado dos selos |
| Sobre | `#/sobre` | Conceito, regras do sistema, limitações e restauração dos dados |

## Regras do sistema que o protótipo respeita

- **Três dimensões separadas:** popularidade e avaliação comunitária, situação da revisão profissional, e região e contexto de uso aparecem em blocos distintos.
- **A nota não concede selo.** Avaliar nunca muda a situação de revisão. Uma média abaixo de 3, com 3 avaliações ou mais, apenas coloca o registro na fila de análise. O sinal nunca é apagado.
- **Variantes convivem.** Registros com a mesma palavra são relacionados como variantes. Um sinal diferente não é tratado como incorreto, e duas variantes continuam disponíveis mesmo com pareceres distintos.
- **Histórico preservado.** Cada parecer se soma aos anteriores. O selo mostra todos, com revisor, data, decisão e escopo.
- **Selos com significado próprio:** Novo registro · Em revisão · Revisado por profissional · Com divergências · Atualização solicitada. Os selos sempre trazem ícone e texto, nunca dependem só da cor.

## Estrutura dos arquivos

```
index.html      Estrutura da página, ícones SVG locais, menu, rodapé e modal
style.css       Identidade visual (tokens InclusiVR), componentes e versão para celular
data.js         Dados fictícios de demonstração (14 registros, perfis e instituições)
script.js       Navegação, telas, regras, persistência local e eventos
assets/fonts    Archivo Expanded, Outfit e Lexend (licença OFL), substitutas das fontes da marca
assets/img      Logos InclusiVR e favicon
```

## Dados e persistência

- Os dados ficam no `localStorage` do navegador, na chave `glb_dados_v1`. Envios, avaliações, comentários, sugestões, relações entre variantes e pareceres continuam salvos depois de recarregar a página.
- As datas dos dados iniciais são calculadas em relação ao dia em que a página é aberta ou restaurada, para os filtros por período funcionarem em qualquer dia.
- **Restaurar dados iniciais** (rodapé e página Sobre) apaga as alterações e os vídeos guardados e volta aos 14 registros originais.
- **Votos duplicados:** cada navegador recebe um identificador local (`glb_votante`). Uma nova avaliação do mesmo navegador para o mesmo registro substitui a anterior.

## Vídeos

- Não há vídeos autênticos de Libras no protótipo. As áreas de mídia mostram "Vídeo demonstrativo não disponível" e estão prontas para receber gravações legítimas. O protótipo não usa ilustrações no lugar de sinais.
- No envio, o vídeo escolhido **não sai do computador**. Ele pode:
  - ser **guardado neste navegador** (IndexedDB), para continuar disponível depois de recarregar; ou
  - **não ser guardado**: fica registrado só o nome do arquivo, e o vídeo pode ser visto até a página ser fechada.
- Se o navegador não permitir guardar o vídeo (modo privativo, falta de espaço, restrições ao abrir arquivos locais em alguns navegadores) ou se o arquivo passar de 150 MB, o protótipo usa automaticamente a segunda opção e avisa na tela.
- Na página do sinal, vídeos reais têm controles de reprodução e de velocidade (0,5×, 0,75× e 1×).

## Acessibilidade

- Contraste adequado (texto acima de 4,5:1), foco visível em todos os controles, link "Pular para o conteúdo" e navegação completa por teclado.
- Modais nativos (`<dialog>`) que fecham com Esc e devolvem o foco ao botão que os abriu.
- Rótulos em todos os campos, mensagens de erro ligadas aos campos e avisos lidos por leitores de tela.
- Interface responsiva para computador e celular, com alvos de toque de 44px e respeito à preferência por menos movimento.

## Limitações do protótipo

- Não há backend, contas de usuário nem verificação de identidade. O painel de revisão é uma simulação e não concede credenciais reais.
- Perfis e instituições parceiras são fictícios e não representam pessoas ou entidades reais.
- As regiões atribuídas aos registros são ilustrativas e não descrevem o uso real de nenhum sinal.
- A prevenção de votos duplicados vale apenas para o navegador em uso. Limpar os dados do navegador permite votar de novo.
- Os dados de cada navegador são independentes: uma demonstração em outro computador começa com os dados iniciais.

## Identidade visual

Segue a base InclusiVR (tema claro): índigo `#280eaa` e noite `#100448` como cores principais, roxo `#ac2fed` para a ação principal (um por tela), neutros para texto e divisores. Títulos em Archivo Expanded (substituta da Presicav), rótulos em Outfit (substituta da Alfarn) e texto em Lexend (substituta da Axiforma). O logotipo tipográfico "Glossário Libras Brasil" é original deste protótipo, e o logo InclusiVR é usado sem alterações, como assinatura.
