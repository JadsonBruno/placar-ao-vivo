# Fase 2: incerteza regional no motor

## Resultado (25/10, 14h05): o motor atual continua como padrão; o novo fica em `?motor=2`

**Implementado.** O efeito de região está em `src/motor.mjs` (`PARAMS2`):
- conta exata por região;
- simetria mantida (diferença de 2e-13 ao trocar os rótulos);
- com σr = 0, o resultado é idêntico ao motor atual.

**Primeira grade (com escala logística).** σε 1 e σr 1,25 passaram nos critérios como estavam escritos (V2 81/95%, V3 ≥ 70%, faixa 1,3×). Mas o erro médio nas **eleições reais** piorou (2014: 0,64 → 0,77; 2018: 0,90 → 1,05; 2022: 0,55 → 0,62). Eu só tinha aplicado o "erro não piora" ao simulador. Passei a exigir isso também nas eleições reais (no máximo +0,03 ponto por ano) e testei sem a escala logística.

**Segunda grade (`testes/fase2-grade.md`).** Nenhum conjunto passou em tudo. O mais perto foi σε 0,65 e σr 0,75, em pontos, sem escala logística.

**Rodada completa com esse conjunto** (`testes/fase2.md`), que é o que está em `?motor=2`:

| Critério | Atual | Motor 2 | Passa? |
|---|---|---|---|
| V2: acerto da faixa de 80% / 95% no simulador | 59% / 77% | 73% / 91% | ✘ (meta 75–88%) |
| V3: faixa de 80% / 95% nas eleições reais | 88/98, 70/90, 83/96 | 92/98, 75/95, 85/98 | ✔ |
| V3: erro médio por ano (2014, 2018, 2022) | 0,64, 0,90, 0,55 | 0,67, 0,94, 0,57 | ✘ em 2018 (+0,04) |
| V4: largura com 30% apurado | 1,98 | 1,13× | ✔ |
| V1/V5: testes antigos; acerto por estado às 17h52 do 1º turno de 2026 | 19/28 | 22/28 | ✔ |
| V6: tempo do cálculo | — | 1,2× | ✔ |

**Leitura.** O motor 2 acerta a faixa com bem mais frequência, no simulador e nas eleições reais, com faixas só 13% mais largas. O erro médio fica igual ou um pouco pior: +0,02 a +0,04 ponto, dentro do ruído de 60 apurações. Pelo critério combinado, **não troco o padrão hoje**. Quem quiser comparar abre a página com `?motor=2`.

## Rodada 2 (25/10, 15h15): melhorias e regra de adoção, escritas antes de rodar

**Melhorias no motor 2 (`projetar2`):**
1. **Para onde vão os votos dos outros candidatos.** O ponto de partida do estado passa a ser `base·(1−o) + 50·o`, onde `o` é a fatia de outros candidatos no 1º turno. Um parâmetro τ, aprendido na apuração, diz se esses votos vão mais para um lado.
   - O ajuste é centrado no nacional, então não mexe na previsão das pesquisas.
   - A conta continua exata, porque τ é integrado junto com os efeitos de região.
2. **σr aprendido na noite.** O motor considera três tamanhos de efeito regional (0; 0,75; 1,5) e pondera cada um pelo que a apuração mostra.
3. **Comparecimento por região.** A razão entre votos válidos contados e esperados nos estados já apurados corrige o esperado dos vizinhos que ainda não contaram, com encolhimento quando há poucos dados.
4. **Agrupamentos que não sejam as regiões do IBGE:** não faço. Com só 3 eleições, o risco de ajustar ao passado é maior que o ganho.

**Avaliação.**
- **Nota principal:** CRPS (aproximado por 19 quantis), comparado aos pares: os dois motores rodam nas mesmas apurações.
- **Volume:** 200 apurações por ano real e 40 por cenário do simulador, nos 4 momentos de sempre.

**Regra para virar padrão (todas precisam passar):**
- **(a)** Nas eleições reais, o CRPS médio do motor 2 é menor que o do atual em pelo menos 2 dos 3 anos. Em nenhum ano ele é pior com significância, ou seja, com a diferença maior que 2 erros-padrão.
- **(b)** A faixa de 80% acerta ≥ 72% nas eleições reais em cada ano, e entre 72% e 90% no simulador.
- **(c)** Os testes antigos (V1) passam, e o acerto por estado às 17h52 do 1º turno de 2026 (V5) não piora.
- **(d)** O tempo de cálculo fica no máximo 2× o atual no Node.
- **(e)** Tudo pronto até as 16h30. Se não estiver, fica só em `?motor=2`.

---

# Plano original

## Problema medido (testes/simulador.md)

O motor supõe que cada estado se desvia sozinho (ε_uf ~ N(0; 0,65), independente). No histórico, os estados de uma
mesma região se movem juntos. Resultado: com o simulador de cenários, a faixa de 80% acerta 59% das vezes e a de 95%,
77%. Nos deslocamentos do Sudeste, só 35%. A projeção parece mais segura do que é, sobretudo no começo da noite, quando
um estado contado "fala" pelos vizinhos sem pagar o preço disso.

## Mudança proposta (o mínimo que resolve)

1. **Efeito de região no modelo.**
   - O novo modelo: `F_uf = base_uf + s + r_região + ε_uf`, com `r_região ~ N(0, σr)` comum aos estados da região.
   - Continua tudo normal e linear, dado (s, b). Por isso, r é integrado de forma exata por região: um estado contado
     do Nordeste passa a mover a expectativa dos estados do Nordeste que ainda não contaram, com o peso certo.
   - A verossimilhança de (s, b) na grade passa a considerar que os estados de uma região são correlacionados
     (fórmula de Sherman–Morrison).
   - O custo continua proporcional ao número de estados por célula da grade: mesma ordem de tempo que hoje.
2. **Desvio proporcional ao tamanho do estado na escala logística.**
   - Fórmula: `σ_uf = σ_logit · p(1−p) · 100`.
   - Efeito: o Piauí (75%) varia menos que São Paulo (42%), como no simulador.
   - Simetria: `p(1−p)` é simétrico, então a troca de rótulos continua exata.
3. **Calibragem.**
   - σr e σε saem de `dados/historico.json`: região 0,039 e estado 0,040 em logit, ≈ 1 ponto perto de 50%.
   - σr é escolhido numa grade: 0, 0,5, 0,75, 1,0 e 1,25 ponto a 50%.
   - Fica o **menor** valor que passa nos critérios abaixo, e não o que dá a melhor cobertura (evita faixa larga à toa).
4. **Fica de fora, de propósito:**
   - **Limites históricos dentro do motor.** Cortar a distribuição quebra o cálculo exato. O efeito também é raro:
     com o item 2, um estado quase nunca chega perto da borda.
   - **Abstenção no motor.** O motor já reestima os válidos de cada estado pelo que foi contado (`V = vv + (1−f)·Vesp`).
     Vou medir quanto da falta de cobertura vem disso antes de mexer.

## Validação (tudo antes de aplicar)

O motor novo entra como `PARAMS2`, ao lado do atual. Os testes rodam os dois e comparam.

| # | Teste | Critério para aplicar |
|---|---|---|
| V1 | Testes atuais 6.1–6.5 com o motor novo | Todos passam; simetria ≤ 1e-9 |
| V2 | Cobertura no simulador de cenários (10 cenários × 40 apurações × 4 momentos) | Total: 80% → entre 75 e 88%; 95% → entre 91 e 98% |
| V3 | **Fora da amostra:** 2014, 2018 e 2022 reais (base = 1º turno, verdade = 2º turno, apuração na ordem de 2026; σ reescalado pelos "outros" de cada ano) | Cobertura de 80% ≥ 70% em cada ano; o motor atual é o comparativo |
| V4 | Largura da faixa de 80% com 10%, 30%, 60% e 90% apurado | No máximo 1,6 vez a de hoje com 30% apurado; erro médio da projeção não piora |
| V5 | 17h52 do 1º turno de 2026 (6.2, dado real) | Cobertura por estado igual ou melhor (hoje 19/28 no de 80%) |
| V6 | Tempo do cálculo no worker | No máximo +30% em relação a hoje, e < 150 ms no celular |

O V3 é o que impede o teste de ser circular: o simulador foi calibrado com a mesma história, mas as eleições reais
não sabem nada do modelo.

## Como entra no ar

1. Implementar em `src/motor.mjs` com `PARAMS2`; o padrão continua `PARAMS`.
2. Rodar V1–V6 e escrever `testes/fase2.md` com a tabela antes × depois.
3. Na página, `?motor=2` usa o novo, para comparar lado a lado no celular. O padrão segue o atual.
4. Só troco o padrão se **todos** os critérios passarem. A troca é um commit (com nova versão `?v=`) e reverter é o mesmo commit ao contrário.
5. **Horário:** a apuração começa às 17h. Se a validação não fechar até as 16h30, o motor atual fica para esta noite e
   o novo entra só como `?motor=2`. Não troco o motor no meio da apuração.

## Resultado da rodada 2 (15h31)

**Teste peça por peça** (60 apurações por ano):
- **Mistura 50/50 dos votos de outros:** pior em 2014 (CRPS 0,47 → 1,23). Os eleitores de Marina não se dividiram ao meio.
- **τ:** pior em 2018 (0,67 → 0,78).
- As duas peças ficam desligadas.

**Configuração final do motor 2:** efeito regional com σr aprendido (0, 0,75 e 1,5) e comparecimento por região.

| Ano | CRPS motor 1 | CRPS motor 2 | Diferença |
|---|---|---|---|
| 2014 | 0,479 | 0,546 | +0,067 ± 0,016 |
| 2018 | 0,636 | 0,633 | −0,003 ± 0,022 |
| 2022 | 0,353 | 0,366 | +0,012 ± 0,006 |

- **Simulador:** CRPS 0,608 → 0,493, e a faixa de 80% acerta 59% → 77%.
- **Regra de adoção:** falha (a); passam (b), (c) e (d). **O motor 1 continua como padrão.**
- **Leitura:** nas eleições reais, o motor 1 já cobria bem (85–89% na faixa de 80% em 2014 e 2022), e alargar a faixa custa CRPS. O ganho do motor 2 aparece no simulador, que sorteia desvios por estado cerca de 2× maiores que os de 2022. O motor 2 serve de segunda opinião em `?motor=2`, para uma noite com surpresa regional.
