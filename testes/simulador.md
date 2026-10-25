# Testes do simulador de cenários

Calibragem (dados/historico.json): região 0.0393 e estado 0.0401 em logit; válidos: região 2.4%, estado 1.5%.

## 1. Simetria
✔ "Aleatório" com previsão de empate: média nacional de Lula 50.00% em 4000 sorteios (esperado 50)
✔ Lula vence em 50.2% dos sorteios (esperado 50%)
✔ cada cenário sai com a mesma frequência (normal 9.8%, empate 9.5%, abstSul 9.8%, abstNE 10.6%, pesqA 9.6%, pesqB 10.4%, neA 9.5%, neB 10.2%, seA 10.7%, seB 10.0%)

| Cenário | Média nacional de Lula | Espelho | Média do espelho | Desvio de 50 (soma) |
|---|---|---|---|---|
| Sem surpresa | 49.97% | (ele mesmo) | 49.97% | -0.05 |
| Empate técnico | 50.01% | (ele mesmo) | 50.01% | 0.03 |
| Mais abstenção no Sul, menos no Nordeste | 50.26% | Mais abstenção no Nordeste, menos no Sul | 49.83% | 0.10 |
✔ abstSul × abstNE: efeitos opostos (0.26 e -0.17 pontos)
| Pesquisas subestimam Lula em 3 pontos | 53.03% | Pesquisas subestimam Flávio em 3 pontos | 47.05% | 0.08 |
✔ pesqA × pesqB: efeitos opostos (3.03 e -2.95 pontos)
| Nordeste vai mais para Lula do que no 1º turno | 50.67% | Nordeste vai mais para Flávio do que no 1º turno | 49.23% | -0.10 |
✔ neA × neB: efeitos opostos (0.67 e -0.77 pontos)
| Sudeste vai mais para Lula do que no 1º turno | 51.22% | Sudeste vai mais para Flávio do que no 1º turno | 48.82% | 0.04 |
✔ seA × seB: efeitos opostos (1.22 e -1.18 pontos)

## 2. Limites históricos por estado
Limite = mínimo e máximo do PT nos 2º turnos de 2014, 2018, 2022 e no 1º turno de 2026, ± 5 pontos. Um estado que passa do limite tem o desvio sorteado de novo.
✔ nenhum estado fora do limite em 4000 sorteios × 28 estados
- ressorteios: 9642 (8.61% dos estados sorteados); cortes no limite: 175
✔ previsão extrema (Lula 65%): 19 estados param no limite, e isso é contado, não escondido

| Estado | 2º t. 2014 | 2º t. 2018 | 2º t. 2022 | 1º t. 2026 | Limite do simulador | Menor e maior sorteados |
|---|---|---|---|---|---|---|
| PI | 78.29 | 77.05 | 76.86 | 74.67 | 69.67–83.29 | 69.72–82.81 |
| BA | 70.15 | 72.69 | 72.12 | 69.87 | 64.87–77.69 | 64.87–77.56 |
| CE | 76.73 | 71.11 | 69.97 | 66.93 | 61.93–81.73 | 61.93–77.18 |
| MA | 78.76 | 73.26 | 71.14 | 67.44 | 62.44–83.76 | 62.44–77.99 |
| AL | 62.11 | 59.92 | 58.68 | 57.5 | 52.50–67.11 | 52.50–67.11 |
| SP | 35.68 | 32.03 | 44.76 | 42.38 | 27.03–49.76 | 34.76–49.76 |
| SC | 35.4 | 24.08 | 30.73 | 27.31 | 19.08–40.40 | 21.78–37.17 |
| RO | 45.14 | 27.82 | 29.34 | 27.74 | 22.74–50.14 | 22.81–37.09 |
| AC | 36.32 | 22.78 | 29.7 | 30.8 | 17.78–41.32 | 24.70–40.96 |
| RR | 41.08 | 28.45 | 23.92 | 24.34 | 18.92–46.08 | 19.15–33.70 |

## 3. Tamanho dos desvios (cenário sem surpresa)
- Desvio típico de um estado em relação ao deslocamento uniforme: 1.25 ponto (em 2022, do 1º para o 2º turno: 0,51; o motor supõe 0,65).
✔ desvio por estado na faixa plausível (0,4 a 2,5 pontos)

## 4. A faixa do motor cobre o resultado? (medição, motor inalterado)
Previsão de partida B (49,26 ± 4,55). Para cada cenário, 40 apurações simuladas; o motor roda com 10%, 30%, 60% e 90% das seções.

| Cenário | Dentro da faixa provável (80%) | Dentro da faixa de 95% | Erro médio da projeção (pontos) |
|---|---|---|---|
| Sem surpresa | 73% | 90% | 0.61 |
| Empate técnico | 70% | 84% | 0.61 |
| Mais abstenção no Sul, menos no Nordeste | 69% | 87% | 0.65 |
| Mais abstenção no Nordeste, menos no Sul | 66% | 84% | 0.60 |
| Pesquisas subestimam Lula em 3 pontos | 62% | 79% | 0.78 |
| Pesquisas subestimam Flávio em 3 pontos | 69% | 84% | 0.68 |
| Nordeste vai mais para Lula do que no 1º turno | 54% | 77% | 0.84 |
| Nordeste vai mais para Flávio do que no 1º turno | 61% | 82% | 0.75 |
| Sudeste vai mais para Lula do que no 1º turno | 35% | 51% | 1.17 |
| Sudeste vai mais para Flávio do que no 1º turno | 34% | 54% | 1.18 |
| **Todos** | **59%** | **77%** | |

(1600 projeções em 34 s.) Uma faixa de 80% bem calibrada acerta perto de 80% no total; num cenário de surpresa é esperado acertar menos.

**Todas as verificações passaram.**
