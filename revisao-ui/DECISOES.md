# Revisão de UX/UI — decisões (25/10/2026, manhã)

Avaliação feita com as skills de **crítica de design** (`design:design-critique`) e **texto de interface** (`design:ux-copy`), mais
medições de acessibilidade (contraste WCAG calculado e tamanho real dos alvos de toque no navegador).
Fotos: `antes/` (versão publicada até agora) e `depois/` (375 e 400 px, antes das 17h e em simulação).

## Correção de dado (P0)

| Item | O que foi feito |
|---|---|
| Versão C | Intervalo de 90% **42,9–53,5** (meia-largura 5,3), média 48,2%. O motor dá P(Lula) = 25,5%, batendo com os 25% do modelo. O "(verificar)" saiu. |
| Padrão B | Com o `localStorage` vazio (equivalente à janela anônima), a página abre em B: **37 em 100 × 63 em 100**, Lula 49,3% × Flávio 50,7%. Testado. |

## Sugestões

| # | Decisão | Por quê (avaliação) | Regra que pesou |
|---|---|---|---|
| S1 ponto de partida no topo | **aplicada, adaptada** | Linha "Ponto de partida: pesquisas, versão B — Lula 49,3% · Flávio 50,7%" com o botão "trocar". Adaptação: mostrar **os dois** candidatos, e não só Lula. O "trocar" tem 48 × 48 px e leva até a seção, descontando o cabeçalho fixo. | 1 (simetria) |
| S2 separar chance de votos | **aplicada** | A barra leva a chance com o valor nas duas pontas ("Lula 37 em 100" · "63 em 100 Flávio"). O número grande dos cartões passou a ser a **projeção de votos** ("49,3% dos votos válidos, no fim da apuração") com "provável (80%)" e "faixa de 95%". A chance continua no cartão como linha **secundária**, com uma casa decimal, para não perder informação. "X em 100" foi o texto mais claro na avaliação de UX copy, porque não parece % de votos. Os rótulos nas pontas também resolvem um problema de acessibilidade: as duas cores têm a mesma luminosidade (contraste entre elas de 1,03:1), então sem rótulo quem não distingue as cores não sabe qual metade é de quem. | 1, 3 |
| S3 frase de favorito | **aplicada** | "X é levemente favorito / é o favorito / é o grande favorito", "Indefinido: nenhum dos dois é favorito" e "X não pode mais ser alcançado". É a mesma regra para os dois. A nota virou um botão "i" de 48 × 48 px, com `aria-label` ("O que significam estas frases") e `aria-expanded`. | 1 |
| S4 estados vazios | **aplicada** | A parcial mostra "votos a partir das 17h" ocupando a mesma altura. O gráfico vazio virou um retângulo com a mensagem centralizada, sem eixos. | 4 |
| S5 checagem nos cartões | **aplicada** | "parcial agora" + "esperado agora: a–b%" + "✓ dentro do normal" / "↑ acima do normal" / "↓ abaixo do normal": símbolo **e** palavras, nunca só cor. A explicação da checagem continua sempre visível, abaixo dos cartões (para não pular quando a apuração começar). | 4, 5 |
| S6 uma hora só | **aplicada** | "TSE atualizado há 40 s" (ou "há 3 min"; com mais de 1 h, "arquivo do TSE de 24/10, 19:19"). Tocando, aparecem a hora exata do arquivo do TSE e a da última consulta. Uma falha aparece **na mesma linha**, em vermelho ("⚠ falha ao consultar o TSE às …; tentando de novo"), sem precisar tocar e sem mudar a altura do cartão. O arquivo nacional passou a ser o primeiro do rodízio, para a hora aparecer logo. | 4 |
| S7 ordem das seções | **aplicada** | status → favorito → cartões → avisos → gráfico → estados → previsão → "Ferramentas" (entrada manual + simulação, num bloco fechado) → como funciona. | — |
| S8 tabela em 2 níveis | **aplicada** | Lista sem rolagem lateral: "SP ▓░ 49% apurado" / "parcial 13: … 22: …" / "projeção 13: … ±… 22: … ±…". Botões de ordem "Maiores primeiro" (padrão) e "Ainda podem mudar" (votos que faltam × incerteza do estado). O ± passou a aparecer para os dois candidatos. | 1, 5 |
| S9 rótulo no gráfico | **aplicada** | "Lula" e "Flávio" na ponta direita das linhas; se ficarem perto demais, eles se afastam para não sobrepor. Cabe a 375 px. | 5 |

## Outras correções achadas no caminho

- **Skeleton sumindo antes da hora:** depois de um toque, se um cálculo antigo ainda estivesse em curso, o skeleton sumia com o número **velho**, e o certo só aparecia no ciclo seguinte. Agora um resultado ultrapassado não é desenhado.
- **Alvos de toque:** o "i", o "trocar", a hora, os "Ferramentas" e os campos ficaram com pelo menos 48 px (antes 40–44 px).
- **Rolagem para uma seção:** se o navegador não animar a rolagem (economia de bateria), a página pula direto.

## Nenhuma informação foi perdida

Conferido item por item contra a versão anterior. O que mudou de lugar:

| Informação | Onde está agora |
|---|---|
| Chance com uma casa decimal | Linha secundária do cartão. |
| Hora do arquivo do TSE e da última consulta | Um toque na linha da hora. |
| Explicação das faixas de favorito | Botão "i". |
| Checagem por candidato | Dentro dos cartões, com a explicação sempre visível logo abaixo. |
| Tabela de estados | Lista; agora com ± também para o 22. |
| Entrada manual e simulação | Bloco "Ferramentas". |
| Nota da previsão (ajuste inicial e ajuste depois da apuração) | No mesmo lugar, agora com os dois candidatos e o intervalo de 90% de cada versão. |

## Decisão que fica com o Jadson

**O que aparece primeiro: a chance ("37 em 100") ou a projeção de votos ("49,3%")?** Mantive como estava: a chance no topo, na barra, e a projeção de votos como número principal dos cartões (S2).

Recomendação: **manter assim.** A pergunta que o leitor faz primeiro é "quem vai ganhar?", e a frase de favorito com a barra responde isso. Os cartões respondem "por quanto". Inverter só faz sentido se o público confundir "chance" com "votos" mesmo com o "em 100"; isso pode ser visto depois.

## Testes (375 e 400 px)

| Teste | Resultado |
|---|---|
| Antes das 17h (arquivos zerados) | Sem rolagem lateral; a página abre em B (37 × 63). |
| Simulação (`?simulado=1`) | Sem rolagem lateral; layout shift **0** em 25 s (375 e 400 px). |
| Ao vivo, 40 s com o TSE real | Layout shift **0**. |
| Cada versão (A, B, C, empate, valor livre) | O botão marca na hora. Valores certos: A 38×62, B 37×63, C 25×75, empate 50×50. O valor livre mostra o campo. |
| Toques reais | Ordem dos estados, "i", "trocar" e hora funcionando. Alvos medidos: "i" 48×48, "trocar" 48×48, hora 187×48, botões de versão e de ordem 157×58. |
| Console | Sem erros. |
