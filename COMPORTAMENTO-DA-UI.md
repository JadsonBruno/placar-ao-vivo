# Placar ao Vivo — como cada parte da página se comporta

Página: https://jadsonbruno.github.io/placar-ao-vivo/ (demonstração: `?simulado=1`)
Código da interface: `docs/index.html`, `docs/estilo.css`, `docs/app.js`. O cálculo roda em `docs/calculo.js` (Web Worker), que usa `docs/motor.js`.
Última revisão de UX: `revisao-ui/DECISOES.md` (25/10, manhã), com fotos de antes e depois.

Este texto descreve o comportamento **atual** da página, para quem vai avaliar a interface. Antes de sugerir mudanças, leia
"Regras que a interface precisa manter" e "Limites conhecidos", no fim.

---

## Visão geral

- **Para que serve:** acompanhar, no celular, a apuração do 2º turno presidencial de 25/10/2026 (Lula, nº 13 × Flávio Bolsonaro, nº 22).
  A página mostra a projeção do resultado final e a chance de vitória de cada um, atualizadas enquanto o TSE divulga os votos.
- **Como é feita:** é uma página estática (GitHub Pages), sem servidor. O próprio navegador baixa os arquivos oficiais do TSE,
  e o motor de projeção roda no aparelho.
- **Uso principal:** celular, tela de ~375–400 px de largura, com a página aberta por horas (das 17h até ~23h).
- **Tema:** escuro, uma coluna, com largura máxima de 760 px no computador.
- **Dois números que não se confundem:**
  - a **chance de vencer** aparece escrita como frequência, "X em 100";
  - a **projeção de votos** aparece como "% dos votos válidos".

## Fluxo de dados e tempos (vale para a página inteira)

| O quê | Como funciona |
|---|---|
| Busca no TSE | Um arquivo por vez, a cada ~1 s, em rodízio entre 29 arquivos: **primeiro o nacional (`br`)**, depois as 27 UFs e o exterior (`zz`). Cada arquivo é revisto a cada ~30 s. O navegador revalida pelo cache (ETag). |
| Recalcular a projeção | Só quando chegou dado novo, e **no máximo uma vez a cada 4 s**. Em uso normal, isso dá cerca de um recálculo a cada 30 s. |
| Onde o cálculo roda | Num Web Worker, fora da tela. Só o pedido **mais novo** vale: se chegou um pedido mais novo enquanto outro calculava, o resultado antigo nem é desenhado. Leva ~10–40 ms num computador. |
| Toques | Respondem na hora: o botão muda de estado antes do cálculo. Os botões nunca são recriados. Todos os alvos de toque têm pelo menos **48 px**. |
| Esqueleto (blocos piscando no lugar dos números) | Aparece no carregamento e quando o **usuário** muda algo que altera o significado dos números: a previsão de partida, a entrada manual, iniciar a simulação ou voltar ao vivo. Fica até chegar o resultado **daquele** pedido. Não aparece nas atualizações automáticas. |
| Aviso "calculando…" | Fica na linha da hora, no cartão de status. O espaço está sempre reservado: o aviso só aparece e some por transparência. |
| Layout shift | Medido 0: em 40 s de busca real no TSE, em 25 s de simulação (375 e 400 px) e no carregamento. |
| Rolagem para uma seção | É suave e desconta o cabeçalho fixo. Se o navegador não animar (por exemplo, em economia de bateria), a página pula direto. |
| Cache de versões | Os arquivos são chamados com `?v=AAAAMMDDx`. O endereço da página pode ficar até ~10 min no cache do GitHub Pages. |
| Antes das 17h | Os arquivos do TSE existem, mas vêm zerados. A página mostra só a previsão das pesquisas (37 em 100 × 63 em 100 na versão padrão). |

---

## Parte por parte, de cima para baixo

### 1. Cabeçalho (fixo no topo)

- **Título** "Placar ao Vivo", com o subtítulo "2º turno presidencial · 25/10/2026 · projeção, não resultado oficial".
- **Selo de modo**, com 4 estados:
  - verde **"TSE ao vivo"**: buscando no TSE normalmente;
  - roxo **"SIMULAÇÃO"**: demonstração com números inventados;
  - âmbar **"manual + TSE"**: há pelo menos uma entrada manual valendo;
  - vermelho **"TSE fora"**: nenhuma busca deu certo desde que a página abriu.

### 2. Cartão de status

- **Frase principal:**
  - "A apuração ainda não começou (a votação vai até 17h de Brasília)";
  - "Apuração em andamento";
  - "Apuração encerrada no TSE";
  - "Apuração simulada (números inventados)".
- **Barra de progresso** e a linha "X,XX% das seções totalizadas no país".
  - Ao vivo, o número vem do arquivo nacional do TSE.
  - Na simulação ou com entrada manual, é estimado a partir dos estados.
- **Linha da hora**, que é um botão com 48 px de altura:
  - **"TSE atualizado há 40 s"** ou **"há 3 min"**, contado a partir da hora em que o TSE gerou o arquivo nacional; é atualizado a cada segundo, sem mudar a altura;
  - com mais de 1 h, mostra "arquivo do TSE de hoje, HH:MM", ou com a data, se for de outro dia;
  - antes de chegar o arquivo nacional, "TSE consultado às HH:MM:SS";
  - **falha:** a mesma linha vira vermelha, "⚠ falha ao consultar o TSE às HH:MM:SS; tentando de novo", sem precisar tocar;
  - **ao tocar,** abre uma linha com a data e a hora exatas do arquivo do TSE, a hora da última consulta bem-sucedida e a última falha, se houver;
  - na simulação, mostra "simulação: sem horário do TSE".
- **"calculando…"**, com um anel girando, à direita da linha da hora.
- A área tem `aria-live="polite"`.

### 3. Quem é o favorito

- **Frase**, como título, sempre com a mesma gramática para os dois. O nome sai na cor do candidato.

  | Chance de quem está à frente | Frase |
  |---|---|
  | até 55 em 100 | "Indefinido: nenhum dos dois é favorito" |
  | 55–70 | "<nome> é levemente favorito" |
  | 70–90 | "<nome> é o favorito" |
  | acima de 90 | "<nome> é o grande favorito" |

  - **"<nome> não pode mais ser alcançado"** só aparece quando a diferença já contada é maior que todos os eleitores que ainda faltam totalizar (dado do TSE: `te − est`).
- **Botão "i"** (48 × 48 px, `aria-label` "O que significam estas frases", `aria-expanded`): abre e fecha a explicação das faixas e avisa que elas são uma convenção de exibição.
- **"CHANCE DE VENCER"**: uma linha com "**Lula** 37 em 100" à esquerda e "63 em 100 **Flávio**" à direita, com o mesmo tamanho e peso.
  - Nos extremos, aparece "menos de 1 em 100" ou "mais de 99 em 100".
  - Embaixo vem a barra dividida: a parte da esquerda é a chance do 13, a da direita a do 22. Os rótulos nas pontas permitem ler a barra sem depender da cor.
- **"Ponto de partida: pesquisas, versão B — Lula 49,3% · Flávio 50,7%"** e o botão **"trocar"** (48 px), que rola até a seção 8.

### 4. Cartões dos candidatos (dois, lado a lado)

- **Ordem e cores:** a ordem segue o número na urna (13 à esquerda, 22 à direita). A faixa de cor no topo é verde-azulada `#2bb3a3` para o 13 e laranja `#e08a3c` para o 22. As duas cores têm o mesmo peso visual e não são cores de partido.
- **De cima para baixo:**
  - nome e "nº 13" / "nº 22";
  - **"PROJEÇÃO DE VOTOS"**: número grande (ex.: "49,3%") com a legenda "dos votos válidos, no fim da apuração";
  - **"provável (80%)"**, com o intervalo em destaque médio;
  - **"faixa de 95%"**, menor;
  - **"chance de vencer"**: "37,4 em 100", com uma casa decimal; é secundária;
  - uma linha divisória;
  - **"PARCIAL AGORA"**: "47,00% · 37.184.045 votos". Antes das 17h, "votos a partir das 17h"; na simulação, antes dos primeiros votos, "aguardando os primeiros votos". O espaço é reservado (2 linhas).
  - **"esperado agora: a–b%"**, com "✓ dentro do normal", "↑ acima do normal" ou "↓ abaixo do normal" (tolerância de 0,3 ponto). É a checagem pelo ritmo das apurações passadas, com símbolo **e** palavras. O espaço também é reservado.
- **Simetria:** os números dos dois cartões são espelhos exatos.
- **Explicação da checagem:** fica sempre visível, logo abaixo dos cartões.
  - O "esperado agora" é a previsão de partida mais o quanto a parcial costumava ficar longe do final com o mesmo % apurado, em duas noites passadas: o 1º turno de 2026 e o 2º turno de 2022.
  - O texto também traz as ressalvas e diz que a projeção que vale é a feita estado por estado.

### 5. Avisos (cartão amarelo, só quando há algum)

- "Cedo demais: SP, RJ, BA, CE e PE costumam entrar tarde…", com o país entre 0% e 30% apurado.
- "Estados grandes ainda abaixo de 20% apurado: …"
- "Definido matematicamente: … O resultado oficial é o do TSE."
- "SIMULAÇÃO: nada nesta tela é resultado real."
- "Há N entrada(s) manual(is) substituindo o TSE."

O cartão fica **abaixo** dos cartões dos candidatos. Quando ele aparece ou some, só o que está abaixo dele se mexe.

### 6. "Ao longo da noite" (gráfico)

- **Antes da apuração:** um retângulo de mesma altura com a mensagem centralizada "O gráfico começa quando a apuração começar (17h)", sem eixos.
- **Durante a apuração:**
  - eixo X: % de seções totalizadas no país;
  - eixo Y: % dos votos válidos, de 42 a 58, alargando se preciso;
  - para cada candidato, na sua cor: a **linha** da projeção, a **faixa** de 80% e os **pontos** da parcial;
  - **rótulo direto** ("Lula", "Flávio") na ponta direita de cada linha, que se afasta para não sobrepor.
- **Quando ganha um ponto novo:** quando o % apurado muda mais de 0,05 ponto ou a projeção muda mais de 0,02 ponto.
- **Onde fica guardado:** ao vivo, no `localStorage` do aparelho. Na simulação, começa do zero.
- O `aria-label` do gráfico traz a projeção atual dos dois.

### 7. "Estado por estado"

- **Dois botões de ordem** (58 px):
  - **"Maiores primeiro"** (padrão): do estado com mais votos esperados ao com menos;
  - **"Ainda podem mudar"**: votos que ainda faltam contar × incerteza do estado. Mostra quais estados ainda mexem no resultado.
- **Lista de 28 itens, sem rolagem lateral.** Cada item tem 3 linhas:
  - "**SP** ▓░ 49% apurado" (um `*` marca entrada manual);
  - "parcial 13: 40,6 · 22: 59,4";
  - "projeção 13: 40,8 ±1,0 · 22: 59,2 ±1,0" (± = meia-largura do intervalo de 80%).
- **Estado de carregamento:** 6 linhas de esqueleto.

### 8. "Ponto de partida: previsão das pesquisas"

- Um texto curto explica que a projeção parte desta previsão e que os votos contados vão corrigindo esse ponto de partida.
- **5 botões numa grade de 2 colunas** (58 px de altura); o selecionado fica claro e com "✓".

  | Versão | Lula (% dos válidos) | Intervalo de 90% | Chance de Lula no modelo |
  |---|---|---|---|
  | A · só pesquisas | 49,15 | 43,8–54,4 | 37,5 |
  | B · correção histórica (**padrão**) | 49,26 | 44,7–53,8 | 37,4 |
  | C · sem faltosos do 1º turno | 48,2 | 42,9–53,5 | 25 |
  | Empate (50%) | 50 | largura da B | — |
  | Valor livre | campo de 30 a 70 | largura da B | — |

  - No **valor livre**, o número vale quando o campo perde o foco ou o usuário confirma.
- **O que acontece ao tocar:** o botão marca na hora, a linha do ponto de partida (seção 3) muda na hora, os números viram esqueleto e o resultado chega logo depois.
- **Escolha salva:** a opção fica salva no `localStorage`.
- **Nota, embaixo:**
  - a previsão dos dois candidatos;
  - o intervalo de 90% dos dois;
  - a chance no modelo das pesquisas (dos dois);
  - o "ajuste inicial" e o ajuste "depois dos votos contados (± incerteza)".

### 9. "Ferramentas: entrada manual e simulação" (bloco que abre e fecha; vem fechado)

- **Entrada manual (se o TSE sair do ar):**
  - campos UF ("Brasil (só o nacional)" + 28 UFs), "% seções", "votos 13" e "votos 22";
  - **"Aplicar"** grava a entrada e recalcula, com esqueleto. Campo inválido é ignorado, sem mensagem;
  - **"Apagar entradas manuais"** remove todas;
  - a entrada substitui o TSE naquele estado e **fica salva no aparelho**;
  - a linha "Valendo agora: …" mostra o que está ativo;
  - com só o nacional e nenhum estado, o país é tratado como um único estado (menos preciso).
- **Demonstração:**
  - **"Simular uma apuração"** inicia uma apuração inventada, com a ordem real de chegada dos estados e o resultado sorteado a cada vez. A página volta ao topo, e a simulação acaba em ~66 s;
  - **"Voltar ao TSE ao vivo"** restaura o histórico real e volta a buscar no TSE;
  - **atalho:** `?simulado=1` no endereço já começa na simulação.

### 10. "Como funciona" (texto fixo)

- O método e a regra de que a ordem de chegada dos estados é levada em conta.
- **Chance de vencer** (ex.: 22 em 100) × **projeção de votos** (ex.: 48,2%): o que é cada uma.
- A simetria entre os candidatos.
- O aviso de que não é resultado oficial, com as fontes.
- Uma linha com o código da eleição no TSE (6258).

---

## Regras que a interface precisa manter (não negociáveis)

1. **Simetria entre os candidatos.** O mesmo texto, o mesmo tamanho, o mesmo peso de cor e o mesmo destaque para os dois. Isso vale também para as linhas que citam valores, como o ponto de partida e a nota da previsão: sempre os dois.
2. **Não parecer resultado oficial.** O subtítulo diz "projeção, não resultado oficial", e os avisos de simulação e de "o resultado oficial é o do TSE" continuam visíveis.
3. **Incerteza sempre junto da projeção:** "provável (80%)", "faixa de 95%" e "indefinido".
4. **Nada de pulo de layout** nas atualizações automáticas, e nenhum toque pode se perder.
5. **Celular primeiro:** sem rolagem lateral da página, alvos de toque com pelo menos 48 px, texto legível sem zoom.
6. **Educação com o TSE:** no máximo 1 consulta por arquivo a cada ~30 s.

## Limites conhecidos (já sabidos; não precisam ser apontados como descoberta)

- **Antes das 17h:** tudo mostra a previsão das pesquisas, e os cartões e a lista de estados não têm parciais.
- **Histórico só no aparelho:** o histórico do gráfico e as entradas manuais ficam no próprio celular; não há conta nem sincronização.
- **Sem extras:** não há mapa, som, notificação nem modo claro.
- **Valor livre:** o campo só aplica o valor quando perde o foco.
- **Entrada manual:** não avisa quando um campo está inválido.
- **Tela bloqueada:** o navegador do celular pode pausar as buscas; elas voltam quando a página fica visível.
- **Avisos:** o cartão de avisos aparece e some algumas vezes na noite (quando cruza 30% apurado e quando os estados grandes passam de 20%). Isso mexe só no que está abaixo dele.
