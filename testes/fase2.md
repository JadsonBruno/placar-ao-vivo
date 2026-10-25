# Fase 2: motor atual × motor com efeito de região

PARAMS2: σε 0.65 (vezes c = 4p(1−p)), σr 0.75 ponto a 50%, escala logística. Motor atual: σε 0.65, sem região.

## Conferência do modelo novo (dados sorteados do próprio modelo)
✔ 300 apurações sorteadas do modelo novo: faixa de 80% acerta 81%, de 95% acerta 93% (o cálculo exato confere com o modelo)

## V2: simulador de cenários (40 apurações por cenário × 4 momentos)

| Cenário | Atual 80% / 95% | Novo 80% / 95% | Erro médio atual → novo |
|---|---|---|---|
| Sem surpresa | 73% / 90% | 84% / 97% | 0.61 → 0.56 |
| Empate técnico | 70% / 84% | 79% / 93% | 0.61 → 0.59 |
| Mais abstenção no Sul, menos no Nordeste | 69% / 87% | 78% / 94% | 0.65 → 0.61 |
| Mais abstenção no Nordeste, menos no Sul | 66% / 84% | 84% / 98% | 0.60 → 0.50 |
| Pesquisas subestimam Lula em 3 pontos | 62% / 79% | 66% / 91% | 0.78 → 0.74 |
| Pesquisas subestimam Flávio em 3 pontos | 69% / 84% | 81% / 93% | 0.68 → 0.64 |
| Nordeste vai mais para Lula do que no 1º turno | 54% / 77% | 72% / 92% | 0.84 → 0.74 |
| Nordeste vai mais para Flávio do que no 1º turno | 61% / 82% | 81% / 95% | 0.75 → 0.61 |
| Sudeste vai mais para Lula do que no 1º turno | 35% / 51% | 56% / 78% | 1.17 → 0.90 |
| Sudeste vai mais para Flávio do que no 1º turno | 34% / 54% | 55% / 76% | 1.18 → 0.94 |
| **Todos** | **59% / 77%** | **73% / 91%** | 0.79 → 0.68 |
✘ V2: faixa de 80% acerta 73% (meta 75–88%); de 95%, 91% (meta 91–98%)

## V3: eleições reais fora da amostra (60 apurações por ano × 4 momentos)

| Ano | Atual 80% / 95% | Novo 80% / 95% | Erro médio atual → novo |
|---|---|---|---|
| 2014 | 88% / 98% | 92% / 98% | 0.64 → 0.67 |
| 2018 | 70% / 90% | 75% / 95% | 0.90 → 0.94 |
| 2022 | 83% / 96% | 85% / 98% | 0.55 → 0.57 |
✔ V3: faixa de 80% acerta ≥ 70% em cada ano (2014: 92%/98% erro 0.67 · 2018: 75%/95% erro 0.94 · 2022: 85%/98% erro 0.57)

## V4: largura da faixa de 80% (média, pontos)

| | 10% apurado | 30% apurado | 60% apurado | 90% apurado |
|---|---|---|---|---|
| atual | 3.14 | 1.98 | 1.32 | 0.59 |
| novo | 3.29 | 2.24 | 1.59 | 0.68 |
✘ V4: com 30% apurado a faixa fica 1.13× a atual (limite 1,6×); erro médio 0.79 → 0.68

## V6: tempo do cálculo (Node, todos os estados com 30% apurado)
✔ atual 17.57 ms, novo 21.17 ms por cálculo (1.21×; limite 1,3×)

(72 s.) V1 e V5: ver testes/resultados-motor2.md.

**2 critério(s) falharam.**
