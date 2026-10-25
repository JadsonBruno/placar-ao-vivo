# Resultados da validação (gerado por testes/validacao.mjs, MOTOR=2)

## 6.1 Dados batem com o TSE
✔ 1º turno 2026: Lula 53879538, Flávio 56104503
✔ 2º turno 2022: Lula 60345999, Bolsonaro 58206354
✔ 1º turno 2022: Lula 57259504, Bolsonaro 51072345
✔ média nacional da base ponderada pelos válidos esperados do 2º turno = 48.726 (prompt: 48,726)

Base do teste: 1º turno 2022 → 1º turno 2026 com ajuste uniforme erra em média 1.70 pt por estado (no prompt, 1º → 2º turno de 2022: 0,51). Final real do 1º turno 2026 em votos de 2 candidatos: Lula 48.99.
No teste do 1º turno uso σε = 2.12 (o erro desse prior é maior que o do 2º turno); no 2º turno de 2026 o motor usa σε = 0.65.

## 6.2 Por estado: parciais estaduais das 17h52 do 1º turno de 2026
Parcial por estado reconstruída do Mix Vale (o artigo dá só o % do líder; o % do outro é estimado supondo que os demais candidatos tinham na parcial a mesma fatia do final — ver README).
- modelo (k calibrado): erro médio por estado 1.87 pt; o final real cai no intervalo de 80% em 22/28 (78.6%) e no de 95% em 28/28 (100.0%); nacional 50.32 [47.58–53.08], real 48.99
- w(f) = f: erro médio por estado 1.94 pt; o final real cai no intervalo de 80% em 21/28 (75.0%) e no de 95% em 27/28 (96.4%); nacional 50.74 [47.95–53.55], real 48.99
- w(f) = 0 (só ajuste uniforme): erro médio por estado 2.09 pt; o final real cai no intervalo de 80% em 23/28 (82.1%) e no de 95% em 26/28 (92.9%); nacional 50.89 [48.03–53.77], real 48.99

Ruído da parcial do estado em relação ao final do estado (pontos), modelo × observado:
- f 0–5%: 7 estados, RMS observado 4.32, modelo 4.82
- f 5–15%: 9 estados, RMS observado 5.28, modelo 4.56
- f 15–40%: 9 estados, RMS observado 3.46, modelo 3.90
- f 40–100%: 3 estados, RMS observado 3.16, modelo 2.46
- faixas do prompt (outro momento da noite): 40–80% erro abs. médio 1,7 → RMS ≈ 2,1, modelo em f=0,6: 2.31; ≥80%: 0,6 → RMS ≈ 0,75, modelo em f=0,9: 0.74

## 6.3 Noite sintética do 1º turno de 2026
Semente 3. Ruído de cada estado sorteado de N(0, 4.5); viés comum ajustado à curva medida: b = 0.25. Curva nacional reproduzida × medida:
| hora | % seções medido | % sintético | Lula 2c medido | Lula 2c sintético |
|---|---|---|---|---|
| 17h27 | 1.5 | 3.3 | 46.17 | 43.26 |
| 17h52 | 7.6 | 9.2 | 44.71 | 44.26 |
| 18h16 | 21.96 | 19.4 | 44.42 | 45.76 |
| 18h50 | 41 | 41.1 | 45.12 | 46.61 |
| 19h06 | 64.81 | 53.3 | 46.01 | 47.06 |
| 19h45 | 84.96 | 79.2 | 47.29 | 48.25 |
| 20h11 | 88.46 | 87.4 | 47.61 | 48.52 |
| 20h21 | 90.61 | 89.4 | 47.82 | 48.54 |
| 20h41 | 92.58 | 92.3 | 48.02 | 48.62 |
| 20h55 | 96.44 | 94.5 | 48.41 | 48.68 |
| 21h12 | 98.97 | 96.6 | 48.76 | 48.83 |
| 21h30 | 99.37 | 98.7 | 48.84 | 48.92 |
| 21h52 | 99.69 | 99.5 | 48.90 | 48.95 |
| 22h51 | 99.95 | 99.9 | 48.97 | 48.98 |

Motor sobre a noite sintética (prior = 1º turno 2022 + ajuste; alvo = 50.84, de propósito 1,85 acima do real, como erraram as pesquisas; real = 48.99):
| hora | % seções | parcial nacional | extrapolação ingênua | projeção | 80% | 95% | P(Lula > 50) | rótulo |
|---|---|---|---|---|---|---|---|---|
| 17h10 | 1.5 | 42.63 | 42.63 | 49.24 | 47.03–51.38 | 45.73–52.49 | 33.4% | Flávio levemente favorável |
| 17h20 | 2.4 | 43.24 | 43.24 | 49.31 | 47.17–51.40 | 45.92–52.48 | 34.4% | Flávio levemente favorável |
| 17h30 | 3.8 | 43.27 | 43.27 | 49.42 | 47.38–51.42 | 46.20–52.47 | 36.1% | Flávio levemente favorável |
| 17h40 | 5.9 | 43.54 | 43.54 | 49.44 | 47.45–51.38 | 46.32–52.40 | 36.1% | Flávio levemente favorável |
| 17h50 | 8.6 | 44.10 | 44.10 | 49.63 | 47.76–51.47 | 46.71–52.45 | 40.2% | Flávio levemente favorável |
| 18h00 | 12.2 | 44.80 | 44.80 | 49.61 | 47.86–51.34 | 46.90–52.25 | 39.0% | Flávio levemente favorável |
| 18h20 | 21.6 | 46.03 | 46.03 | 49.35 | 47.79–50.90 | 46.95–51.71 | 29.7% | Flávio favorável |
| 18h40 | 34.5 | 46.43 | 46.43 | 49.20 | 47.88–50.51 | 47.17–51.20 | 21.8% | Flávio favorável |
| 19h00 | 48.6 | 46.85 | 46.85 | 48.76 | 47.63–49.88 | 47.03–50.47 | 7.8% | Flávio muito favorável |
| 19h20 | 62.9 | 47.93 | 47.93 | 48.61 | 47.68–49.54 | 47.19–50.03 | 2.7% | Flávio muito favorável |
| 19h40 | 77.2 | 48.16 | 48.16 | 48.60 | 47.89–49.30 | 47.52–49.68 | 0.5% | Flávio muito favorável |
| 20h00 | 84.3 | 48.46 | 48.46 | 48.65 | 48.11–49.19 | 47.83–49.48 | 0.1% | Flávio muito favorável |
| 20h20 | 89.3 | 48.53 | 48.53 | 48.72 | 48.32–49.11 | 48.11–49.32 | 0.0% | Flávio muito favorável |
| 20h40 | 92.2 | 48.62 | 48.62 | 48.75 | 48.43–49.06 | 48.26–49.23 | 0.0% | Flávio muito favorável |
| 21h00 | 95.1 | 48.71 | 48.71 | 48.80 | 48.58–49.03 | 48.46–49.15 | 0.0% | Flávio muito favorável |
| 21h20 | 97.7 | 48.88 | 48.88 | 48.87 | 48.74–49.00 | 48.67–49.07 | -0.0% | Flávio muito favorável |
| 21h40 | 99.2 | 48.94 | 48.94 | 48.94 | 48.89–48.99 | 48.87–49.01 | 0.0% | Flávio muito favorável |
| 22h00 | 99.6 | 48.96 | 48.96 | 48.96 | 48.93–48.99 | 48.92–49.00 | -0.0% | Flávio muito favorável |
| 22h20 | 99.8 | 48.97 | 48.97 | 48.97 | 48.95–48.99 | 48.95–49.00 | 0.0% | Flávio muito favorável |
| 22h40 | 99.9 | 48.98 | 48.98 | 48.98 | 48.97–48.99 | 48.96–48.99 | -0.0% | Flávio muito favorável |
| 23h00 | 99.9 | 48.98 | 48.98 | 48.98 | 48.97–48.99 | 48.97–48.99 | -0.0% | Flávio muito favorável |
✔ converge: projeção final 48.98 × real 48.99
✔ intervalo de 95% contém o real em 36/36 momentos da noite; 80% em 30/36
✔ no começo da noite (< 30% apurado) os intervalos de 95% não ficam estreitos: menor largura 4.37 pt
✔ antes de 30% apurado, o motor erra no máximo 0.64 pt; a parcial nacional crua erra até 6.36 pt
✔ trocas de favorito "de verdade" (de ≥ 70% para um lado a ≥ 70% para o outro): 0; cruzou 50% 0 vez(es), sempre passando por "indefinido"
✔ com o prior errado para o outro lado (47.14): termina em 48.98, 0 troca(s) de favorito

## 6.4 2º turno de 2022 na checagem simples (5.3)
Final estimado = parcial − Δ(X), com as duas curvas. Resultado real: Lula 50,90.
✔ 15.34% apurado, parcial 48.32: faixa 50.90–52.75
✔ 50.9% apurado, parcial 49.7: faixa 50.90–53.20
✔ 67.76% apurado, parcial 50.01: faixa 50.90–52.80
✔ 98.91% apurado, parcial 50.83: faixa 50.90–51.03
Ressalva: a curva de 2022 foi medida nesses mesmos pontos, então ela sempre acerta 2022 (teste circular); o que o teste mostra é que a faixa entre as duas curvas contém o real.

## 6.5 Simetria
✔ trocar os rótulos espelha as saídas: maior diferença 3.8e-13 (5 cenários aleatórios)

## Conferência: mistura analítica × Monte Carlo de 20 mil sorteios
- com o motor 2, esta conferência fica em testes/fase2.md (modelo novo contra sorteios do próprio modelo)

**Todas as verificações passaram.**
