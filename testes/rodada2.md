# Rodada 2: motor atual × motor 2

Motor 2: transferência dos votos de outros (σt 0), σr aprendido entre 0, 0.75, 1.5, comparecimento por região (encolhimento 0.3). CRPS por 19 quantis; comparação pareada (mesmas apurações).

## Eleições reais (200 apurações por ano × 4 momentos; base = 1º turno, verdade = 2º turno)

| Ano | CRPS atual | CRPS motor 2 | Diferença (± 2 erros-padrão) | Faixa 80% atual → m2 | 95% atual → m2 | Erro médio atual → m2 | Largura 80% atual → m2 |
|---|---|---|---|---|---|---|---|
| 2014 | 0.479 | 0.546 | 0.067 ± 0.016 | 85% → 88% | 98% → 98% | 0.65 → 0.75 | 2.36 → 2.73 |
| 2018 | 0.636 | 0.633 | -0.003 ± 0.022 | 75% → 80% | 93% → 96% | 0.86 → 0.86 | 2.35 → 2.78 |
| 2022 | 0.353 | 0.366 | 0.012 ± 0.006 | 89% → 91% | 99% → 99% | 0.47 → 0.49 | 1.79 → 1.97 |

## Simulador de cenários (40 apurações por cenário × 4 momentos)

| Cenário | Faixa 80% atual → m2 | 95% atual → m2 | CRPS atual → m2 |
|---|---|---|---|
| Sem surpresa | 73% → 85% | 90% → 99% | 0.451 → 0.401 |
| Empate técnico | 70% → 78% | 84% → 93% | 0.469 → 0.435 |
| Mais abstenção no Sul, menos no Nordeste | 69% → 81% | 87% → 96% | 0.485 → 0.456 |
| Mais abstenção no Nordeste, menos no Sul | 66% → 88% | 84% → 98% | 0.457 → 0.370 |
| Pesquisas subestimam Lula em 3 pontos | 62% → 68% | 79% → 92% | 0.596 → 0.559 |
| Pesquisas subestimam Flávio em 3 pontos | 69% → 83% | 84% → 93% | 0.526 → 0.472 |
| Nordeste vai mais para Lula do que no 1º turno | 54% → 72% | 77% → 96% | 0.626 → 0.497 |
| Nordeste vai mais para Flávio do que no 1º turno | 61% → 84% | 82% → 96% | 0.568 → 0.434 |
| Sudeste vai mais para Lula do que no 1º turno | 35% → 67% | 51% → 88% | 0.947 → 0.641 |
| Sudeste vai mais para Flávio do que no 1º turno | 34% → 63% | 54% → 83% | 0.956 → 0.664 |
| **Todos** | **59% → 77%** | **77% → 93%** | **0.608 → 0.493** (dif. -0.115 ± 0.014) |

## Regra de adoção
✘ (a) CRPS menor em 1 de 3 anos reais; pior com significância em 2
✔ (b) faixa de 80% nas eleições reais: 88%, 80%, 91% (≥ 72%); no simulador: 77% (72–90%)
✔ (d) tempo: atual 16.52 ms, motor 2 19.99 ms (1.21×; limite 2×)
(c) V1/V5: testes/resultados-motor2.md.

(394 s.)
