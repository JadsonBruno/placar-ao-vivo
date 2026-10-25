# Placar ao Vivo — como cada parte da página se comporta

Página: https://jadsonbruno.github.io/placar-ao-vivo/ (demonstração: `?simulado=1`)
Código da interface: `docs/index.html`, `docs/estilo.css`, `docs/app.js`. O cálculo roda em `docs/calculo.js` (Web Worker), que usa `docs/motor.js`.

Este texto descreve o comportamento **atual** da página, para quem vai avaliar a interface. Antes de sugerir mudanças, leia
"Regras que a interface precisa manter" e "Limites conhecidos", no fim.

---

## Visão geral

- **Para que serve:** acompanhar, no celular, a apuração do 2º turno presidencial de 25/10/2026 (Lula, nº 13 × Flávio Bolsonaro, nº 22).
  A página mostra a projeção do resultado final e a chance de vitória de cada um, atualizadas enquanto o TSE divulga os votos.
- **Como é feita:** é uma página estática (GitHub Pages), sem servidor. O próprio navegador baixa os arquivos oficiais do TSE,
  e o motor de projeção roda no aparelho.
- **Uso principal:** celular, tela de ~375–400 px de largura, com a página aberta por horas (das 17h até ~23h). O usuário não está no computador.
- **Tema:** escuro, uma coluna, com largura máxima de 760 px no computador.

## Fluxo de dados e tempos (vale para a página inteira)

| O quê | Como funciona |
|---|---|
| Busca no TSE | Um arquivo por vez, a cada ~1 s, em rodízio entre 29 arquivos: as 27 UFs, o exterior (`zz`) e o nacional (`br`). Cada arquivo é revisto a cada ~30 s. O navegador revalida pelo cache (ETag), então um arquivo sem mudança custa pouco. |
| Recalcular a projeção | Só quando chegou dado novo, e **no máximo uma vez a cada 4 s**. Em uso normal, isso dá cerca de um recálculo a cada 30 s. |
| Onde o cálculo roda | Num Web Worker, fora da tela. Se outro pedido chega enquanto um está em curso, só o **mais novo** é calculado (os do meio são descartados). Leva ~10–40 ms num computador. Num celular, espere algumas vezes mais, ainda abaixo de 1 s. |
| Toques | Respondem na hora: o botão muda de estado antes do cálculo. Os botões **nunca são recriados**, o que antes fazia toques se perderem. |
| Esqueleto (blocos piscando no lugar dos números) | Aparece no carregamento inicial e quando o **usuário** muda algo que altera o significado dos números: a previsão de partida, a entrada manual, iniciar a simulação ou voltar ao vivo. **Não** aparece nas atualizações automáticas de ~30 s; nelas, os números antigos ficam na tela até os novos chegarem. |
| Aviso "calculando a projeção…" | Fica no cartão de status. O espaço dele está sempre reservado: ele só aparece e some por transparência. A página **não pula** (layout shift medido: 0). |
| Volta para a aba | Ao reabrir a página ou desbloquear o celular, a busca retoma na hora. Com a tela bloqueada, o navegador pode pausar as buscas. |
| Cache de versões | Os arquivos são chamados com `?v=AAAAMMDDx`. O endereço da página em si pode ficar até ~10 min no cache do GitHub Pages depois de uma publicação. |
| Antes das 17h | Os arquivos do TSE existem, mas vêm zerados. A página mostra só a previsão das pesquisas (37,4% × 62,6% na versão padrão). |

---

## Parte por parte, de cima para baixo

### 1. Cabeçalho (fixo no topo)

- Título "Placar ao Vivo" e subtítulo "2º turno presidencial · 25/10/2026 · projeção por estado".
- **Selo de modo**, à direita, com 4 estados:
  - verde **"TSE ao vivo"**: buscando no TSE normalmente;
  - roxo **"SIMULAÇÃO"**: demonstração com números inventados;
  - âmbar **"manual + TSE"**: há pelo menos uma entrada manual valendo;
  - vermelho **"TSE fora"**: a última busca falhou e **nenhuma** busca deu certo desde que a página abriu.
    Depois de um sucesso, uma falha isolada não muda o selo; ela aparece no cartão de status.
- O cabeçalho continua visível ao rolar a página.

### 2. Cartão de status

- **Frase principal**, com 4 variantes:
  - "Apuração ainda não começou (a votação vai até 17h de Brasília)": 0% totalizado;
  - "Apuração em andamento";
  - "Apuração encerrada no TSE": 100%;
  - "Apuração simulada (números inventados)".
- **Hora em que o TSE gerou o arquivo nacional**, à direita: "TSE gerou às HH:MM:SS". Some na simulação.
- **Barra de progresso:** % de seções totalizadas no país.
  - Ao vivo, vem do arquivo nacional do TSE.
  - Na simulação ou com entrada manual, é estimada a partir dos estados, pesados pelos votos válidos esperados.
- **Linha de baixo:** "X,XX% das seções totalizadas" e, à direita, "TSE consultado às HH:MM:SS" (hora do último sucesso) ou "última falha: …".
- **"calculando a projeção…"**, com um anel girando: visível só enquanto o Worker calcula. Ver a tabela acima.
- A área tem `aria-live="polite"`, para leitores de tela.

### 3. "Quem está mais favorecido agora"

- **Frase grande:** "Indefinido" ou "<nome>: <faixa>". O nome sai na cor do candidato.
- **Faixas**, a partir da chance do candidato que está à frente:

  | Chance do candidato à frente | Frase |
  |---|---|
  | 45–55% | indefinido |
  | 55–70% | levemente favorável |
  | 70–90% | favorável |
  | 90–99% | muito favorável |

  - Acima de 99%, continua "muito favorável".
  - **"definido matematicamente"** só aparece quando a diferença de votos já contados é maior que o total de eleitores que ainda faltam totalizar (dado do próprio TSE: `te − est`).
- **Barra dividida:** a parte da esquerda é a chance do 13; a da direita, a do 22. As larguras somam 100%.
- **Nota fixa**, embaixo: as faixas são uma convenção de exibição, não uma regra estatística.

### 4. Cartões dos candidatos (dois, lado a lado)

- **Ordem:** pelo número na urna (13 à esquerda, 22 à direita). A ordem não muda com quem está na frente.
- Cada cartão tem uma faixa de cor no topo:
  - 13: verde-azulado `#2bb3a3`;
  - 22: laranja `#e08a3c`.
  - As duas cores foram escolhidas para ter o mesmo peso visual e não são cores de partido.
- **Conteúdo, de cima para baixo:**
  - nome e "nº 13" / "nº 22";
  - **chance de vencer**, número grande (ex.: "37,4%"; nos extremos, "> 99,9%" ou "< 0,1%");
  - **projeção final** (% dos votos válidos) e, embaixo, "80%: a–b · 95%: c–d" (intervalos);
  - **parcial agora**: % dos válidos já contados e número de votos. Antes da apuração, mostra "—% · 0 votos".
- **Simetria dos números:** os valores dos dois cartões são espelhos exatos (somam 100) e saem do mesmo cálculo.
- **Estado de carregamento:** os números viram blocos de esqueleto.

### 5. Avisos (cartão amarelo, só aparece quando há algum aviso)

O cartão some quando não há nenhum aviso. Avisos possíveis:
- "Cedo demais: SP, RJ, BA, CE e PE costumam entrar tarde…", com o país entre 0% e 30% apurado.
- "Estados grandes ainda abaixo de 20% apurado: …", que lista os estados entre SP, MG, RJ, BA, RS, PR, PE e CE.
- "Definido matematicamente…"
- "SIMULAÇÃO: nada nesta tela é resultado real."
- "Há N entrada(s) manual(is) substituindo o TSE."

### 6. "Ao longo da noite" (gráfico)

- **Desenho:** SVG responsivo, com largura de 100% do cartão.
  - Eixo X: % de seções totalizadas no país (0–100).
  - Eixo Y: % dos votos válidos; vai de 42 a 58, e alarga se algum valor sair dessa faixa. A linha de 50% é mais clara.
- **Para cada candidato, na sua cor:**
  - uma **linha** com a projeção final;
  - uma **faixa** sombreada com o intervalo de 80%;
  - **pontos** com a parcial do TSE em cada momento.
  - As curvas dos dois são espelhadas em torno de 50.
- **Quando ganha um ponto novo:** quando o % apurado muda mais de 0,05 ponto ou a projeção muda mais de 0,02 ponto.
- **Onde fica guardado:**
  - **ao vivo**, no `localStorage` do aparelho, então sobrevive a recarregar a página;
  - **na simulação**, o histórico começa do zero e não é guardado.
- Antes da apuração, mostra "o gráfico começa quando a apuração começar".
- Não tem interação (nada de toque, zoom ou tooltip).

### 7. "Checagem simples: o ritmo das apurações passadas"

- Só aparece com a apuração em andamento. Antes, mostra "Aparece quando a apuração começar."
- **Dois quadros**, um por candidato, com a parcial atual e a "faixa esperada agora".
  - A faixa é a previsão de partida mais o quanto a parcial costumava ficar longe do resultado final com o mesmo % apurado, em duas noites passadas: o 1º turno de 2026 e o 2º turno de 2022.
  - Cada quadro diz se a parcial está "abaixo do esperado", "dentro do esperado" ou "acima do esperado" (com tolerância de 0,3 ponto).
- **Texto explicativo**, embaixo: é só uma conferência; a projeção que vale é a feita estado por estado.

### 8. "Estado por estado" (tabela)

- 28 linhas (27 UFs + exterior), em ordem de tamanho: do estado com mais votos esperados ao com menos.
- **Colunas:**
  - UF (um `*` marca entrada manual);
  - "apurado": % de seções do estado, com uma mini barra;
  - "parcial 13" e "parcial 22": % dos válidos já contados no estado;
  - "final 13", com "±x" (meia-largura do intervalo de 80%), e "final 22".
- **No celular**, a tabela rola **na horizontal dentro do cartão**; a página em si não rola para o lado. O cabeçalho da tabela **não** acompanha a rolagem vertical da página (ela tem 28 linhas).
- **Estado de carregamento:** o corpo da tabela vira esqueleto.

### 9. "Previsão das pesquisas usada como ponto de partida"

- **5 botões numa grade de 2 colunas**, com 52 px de altura. O selecionado fica claro e com "✓". O toque dá um leve "afundar".
  - **A · só pesquisas:** 49,15% para Lula; intervalo de 90%: 43,8–54,4.
  - **B · correção histórica:** é o padrão; 49,26%; intervalo de 90%: 44,7–53,8.
  - **C · sem faltosos do 1º turno:** 48,2%. A largura do intervalo dessa versão não veio no fechamento; usei a da B, e o texto da página avisa "(verificar)".
  - **Empate (50%).**
  - **Valor livre:** mostra um campo numérico (30 a 70). O valor vale quando o campo perde o foco ou o usuário confirma.
- **O que acontece ao tocar:** o botão marca na hora, os números viram esqueleto e o resultado chega logo depois.
- **Escolha salva:** a opção (e o valor livre) fica no `localStorage`, então volta igual ao reabrir a página.
- **Nota, embaixo:**
  - a descrição da versão escolhida;
  - o "ajuste inicial s0";
  - o ajuste depois da apuração ("± incerteza"), que mostra quanto a apuração já corrigiu a previsão das pesquisas.

### 10. "Entrada manual (se o TSE sair do ar)"

- É um bloco que abre e fecha; vem **fechado**.
- **Campos:**
  - **UF**, com a opção "Brasil (só o nacional)" e as 28 UFs;
  - **% seções**;
  - **votos 13**;
  - **votos 22**.
- **Botões:**
  - **"Aplicar":** grava a entrada e recalcula, com esqueleto. Campo inválido é ignorado, sem mensagem de erro.
  - **"Apagar entradas manuais":** remove todas.
- **Prioridade:** a entrada manual substitui o TSE naquele estado até ser apagada. Ela **fica salva no aparelho** (`localStorage`) mesmo depois de recarregar a página.
- **Só o nacional, sem nenhum estado:** a projeção usa o país como se fosse um único estado. Fica menos precisa.
- **Lista "Manuais: …":** mostra o que está valendo.

### 11. "Demonstração (apuração simulada)"

- É um bloco que abre e fecha; vem fechado.
- **"Simular uma apuração":**
  - inicia uma apuração inventada, com a **ordem real** de chegada dos estados do 1º turno de 2026;
  - o resultado final é sorteado a cada vez, em torno da previsão de partida;
  - a página volta ao topo, e o texto do botão muda para "Simulando…" e depois "Simular de novo";
  - a simulação avança 4 "minutos" da noite a cada 0,7 s e acaba em ~66 s.
- **Durante a simulação:** o selo fica roxo, aparece o aviso de simulação e a busca no TSE fica pausada.
- **"Voltar ao TSE ao vivo":** limpa a simulação, restaura o histórico real guardado e volta a buscar no TSE.
- **Atalho:** abrir a página com `?simulado=1` já começa na simulação.

### 12. "Como funciona" (texto fixo)

Três parágrafos curtos:
- a ideia do método (estado por estado, com o peso da parcial crescendo à medida que o estado termina);
- a garantia de simetria entre os candidatos;
- o aviso de que **não é resultado oficial**, com as fontes.

Embaixo, uma linha cinza com o código da eleição no TSE (6258).

---

## Regras que a interface precisa manter (não negociáveis)

1. **Simetria entre os candidatos.** O mesmo texto, o mesmo tamanho, o mesmo peso de cor e o mesmo destaque para os dois. Nenhum elemento pode favorecer um lado (por exemplo, destacar só o "líder" com cor mais forte, ou trocar a ordem dos cartões).
2. **Não parecer resultado oficial.** A projeção é estatística; os avisos de simulação e de "não é oficial" precisam continuar visíveis.
3. **Incerteza sempre junto da projeção.** Os intervalos e as faixas de "indefinido" fazem parte da mensagem; não podem sumir para "limpar" a tela.
4. **Nada de pulo de layout** nas atualizações automáticas, e nenhum toque pode se perder.
5. **Celular primeiro:** sem rolagem lateral da página, botões com pelo menos ~48 px de altura, texto legível sem zoom.
6. **Educação com o TSE:** no máximo 1 consulta por arquivo a cada ~30 s. Sugestões que aumentem a frequência não servem.

## Limites conhecidos (já sabidos; não precisam ser apontados como descoberta)

- **Antes das 17h**, tudo mostra a previsão das pesquisas e os cartões de checagem e de avisos ficam vazios ou escondidos.
- **Histórico só no aparelho:** o histórico do gráfico e as entradas manuais ficam no próprio celular; não há conta nem sincronização.
- **Sem extras:** não há mapa, som, notificação nem modo claro.
- **Valor livre:** o campo só aplica o valor quando perde o foco.
- **Entrada manual:** não avisa quando um campo está inválido.
- **Versão C:** a largura do intervalo é uma suposição (a mesma da B).
- **Tela bloqueada:** o navegador do celular pode pausar as buscas; elas voltam quando a página volta a ficar visível.
