# Rodada 2: motor atual × motor 2

Motor 2: transferência dos votos de outros (σt 0), σr aprendido entre 0, 0.75, 1.5, comparecimento por região (encolhimento 0.3). CRPS por 19 quantis; comparação pareada (mesmas apurações).

## Eleições reais (100 apurações por ano × 4 momentos; base = 1º turno, verdade = 2º turno)

| Ano | CRPS atual | CRPS motor 2 | Diferença (± 2 erros-padrão) | Faixa 80% atual → m2 | 95% atual → m2 | Erro médio atual → m2 | Largura 80% atual → m2 |
|---|---|---|---|---|---|---|---|
| 2014 | 0.465 | 0.535 | 0.070 ± 0.022 | 88% → 91% | 98% → 99% | 0.64 → 0.74 | 2.37 → 2.78 |
| 2018 | 0.651 | 0.570 | -0.082 ± 0.044 | 73% → 83% | 91% → 97% | 0.88 → 0.76 | 2.35 → 2.72 |
| 2022 | 0.382 | 0.415 | 0.033 ± 0.016 | 86% → 90% | 97% → 98% | 0.50 → 0.55 | 1.80 → 2.09 |

## Simulador de cenários (40 apurações por cenário × 4 momentos)

| Cenário | Faixa 80% atual → m2 | 95% atual → m2 | CRPS atual → m2 |
|---|---|---|---|
| Sem surpresa | 73% → 83% | 90% → 99% | 0.451 → 0.419 |
| Empate técnico | 70% → 81% | 84% → 93% | 0.469 → 0.465 |
| Mais abstenção no Sul, menos no Nordeste | 69% → 78% | 87% → 94% | 0.485 → 0.493 |
| Mais abstenção no Nordeste, menos no Sul | 66% → 88% | 84% → 97% | 0.457 → 0.386 |
| Pesquisas subestimam Lula em 3 pontos | 62% → 71% | 79% → 89% | 0.596 → 0.593 |
| Pesquisas subestimam Flávio em 3 pontos | 69% → 80% | 84% → 93% | 0.526 → 0.555 |
| Nordeste vai mais para Lula do que no 1º turno | 54% → 78% | 77% → 98% | 0.626 → 0.469 |
| Nordeste vai mais para Flávio do que no 1º turno | 61% → 83% | 82% → 96% | 0.568 → 0.442 |
| Sudeste vai mais para Lula do que no 1º turno | 35% → 71% | 51% → 87% | 0.947 → 0.615 |
| Sudeste vai mais para Flávio do que no 1º turno | 34% → 66% | 54% → 86% | 0.956 → 0.659 |
| **Todos** | **59% → 78%** | **77% → 93%** | **0.608 → 0.510** (dif. -0.098 ± 0.018) |

## Regra de adoção
✘ (a) CRPS menor em 1 de 3 anos reais; pior com significância em 2
✔ (b) faixa de 80% nas eleições reais: 91%, 83%, 90% (≥ 72%); no simulador: 78% (72–90%)
✔ (d) tempo: atual 17.21 ms, motor 2 20.41 ms (1.19×; limite 2×)
(c) V1/V5: testes/resultados-motor2.md.

(279 s.)
