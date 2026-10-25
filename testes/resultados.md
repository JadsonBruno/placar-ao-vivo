# Resultados da validação (gerado por testes/validacao.mjs)

## 6.1 Dados batem com o TSE
✔ 1º turno 2026: Lula 53879538, Flávio 56104503
✔ 2º turno 2022: Lula 60345999, Bolsonaro 58206354
✔ 1º turno 2022: Lula 57259504, Bolsonaro 51072345
✔ média nacional da base ponderada pelos válidos esperados do 2º turno = 48.726 (prompt: 48,726)

Base do teste: 1º turno 2022 → 1º turno 2026 com ajuste uniforme erra em média 1.70 pt por estado (no prompt, 1º → 2º turno de 2022: 0,51). Final real do 1º turno 2026 em votos de 2 candidatos: Lula 48.99.
No teste do 1º turno uso σε = 2.12 (o erro desse prior é maior que o do 2º turno); no 2º turno de 2026 o motor usa σε = 0.65.

## 6.2 Por estado: parciais estaduais das 17h52 do 1º turno de 2026
Parcial por estado reconstruída do Mix Vale (o artigo dá só o % do líder; o % do outro é estimado supondo que os demais candidatos tinham na parcial a mesma fatia do final — ver README).
- modelo (k calibrado): erro médio por estado 1.92 pt; o final real cai no intervalo de 80% em 19/28 (67.9%) e no de 95% em 27/28 (96.4%); nacional 50.54 [47.87–53.24], real 48.99
- w(f) = f: erro médio por estado 2.02 pt; o final real cai no intervalo de 80% em 18/28 (64.3%) e no de 95% em 27/28 (96.4%); nacional 50.98 [48.27–53.73], real 48.99
- w(f) = 0 (só ajuste uniforme): erro médio por estado 2.21 pt; o final real cai no intervalo de 80% em 19/28 (67.9%) e no de 95% em 26/28 (92.9%); nacional 51.14 [48.36–53.95], real 48.99

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
| 17h10 | 1.5 | 42.63 | 42.63 | 49.38 | 47.21–51.48 | 45.93–52.56 | 36.2% | Flávio levemente favorável |
| 17h20 | 2.4 | 43.24 | 43.24 | 49.44 | 47.33–51.49 | 46.10–52.55 | 37.1% | Flávio levemente favorável |
| 17h30 | 3.8 | 43.27 | 43.27 | 49.52 | 47.51–51.49 | 46.35–52.52 | 38.5% | Flávio levemente favorável |
| 17h40 | 5.9 | 43.54 | 43.54 | 49.54 | 47.59–51.45 | 46.48–52.45 | 38.5% | Flávio levemente favorável |
| 17h50 | 8.6 | 44.10 | 44.10 | 49.75 | 47.92–51.55 | 46.90–52.51 | 43.4% | Flávio levemente favorável |
| 18h00 | 12.2 | 44.80 | 44.80 | 49.75 | 48.05–51.43 | 47.12–52.32 | 42.9% | Flávio levemente favorável |
| 18h20 | 21.6 | 46.03 | 46.03 | 49.50 | 48.00–51.00 | 47.18–51.78 | 33.7% | Flávio levemente favorável |
| 18h40 | 34.5 | 46.43 | 46.43 | 49.35 | 48.09–50.60 | 47.41–51.26 | 25.4% | Flávio favorável |
| 19h00 | 48.6 | 46.85 | 46.85 | 48.88 | 47.81–49.95 | 47.23–50.52 | 9.0% | Flávio muito favorável |
| 19h20 | 62.9 | 47.93 | 47.93 | 48.71 | 47.82–49.60 | 47.35–50.07 | 3.1% | Flávio muito favorável |
| 19h40 | 77.2 | 48.16 | 48.16 | 48.65 | 47.96–49.34 | 47.60–49.70 | 0.6% | Flávio muito favorável |
| 20h00 | 84.3 | 48.46 | 48.46 | 48.69 | 48.15–49.22 | 47.87–49.50 | 0.1% | Flávio muito favorável |
| 20h20 | 89.3 | 48.53 | 48.53 | 48.73 | 48.34–49.12 | 48.13–49.33 | 0.0% | Flávio muito favorável |
| 20h40 | 92.2 | 48.62 | 48.62 | 48.75 | 48.44–49.07 | 48.28–49.23 | 0.0% | Flávio muito favorável |
| 21h00 | 95.1 | 48.71 | 48.71 | 48.81 | 48.58–49.03 | 48.46–49.15 | 0.0% | Flávio muito favorável |
| 21h20 | 97.7 | 48.88 | 48.88 | 48.87 | 48.74–49.00 | 48.67–49.07 | 0.0% | Flávio muito favorável |
| 21h40 | 99.2 | 48.94 | 48.94 | 48.94 | 48.89–48.99 | 48.87–49.01 | 0.0% | Flávio muito favorável |
| 22h00 | 99.6 | 48.96 | 48.96 | 48.96 | 48.93–48.99 | 48.92–49.00 | -0.0% | Flávio muito favorável |
| 22h20 | 99.8 | 48.97 | 48.97 | 48.97 | 48.95–48.99 | 48.95–49.00 | 0.0% | Flávio muito favorável |
| 22h40 | 99.9 | 48.98 | 48.98 | 48.98 | 48.97–48.99 | 48.96–48.99 | -0.0% | Flávio muito favorável |
| 23h00 | 99.9 | 48.98 | 48.98 | 48.98 | 48.97–48.99 | 48.97–48.99 | 0.0% | Flávio muito favorável |
✔ converge: projeção final 48.98 × real 48.99
✔ intervalo de 95% contém o real em 36/36 momentos da noite; 80% em 31/36
✔ no começo da noite (< 30% apurado) os intervalos de 95% não ficam estreitos: menor largura 4.21 pt
✔ antes de 30% apurado, o motor erra no máximo 0.76 pt; a parcial nacional crua erra até 6.36 pt
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
✔ trocar os rótulos espelha as saídas: maior diferença 2.4e-13 (5 cenários aleatórios)

## Conferência: mistura analítica × Monte Carlo de 20 mil sorteios
- 18h16 sintético: analítico média 49.55, 80% 48.00–51.09, P(A) 35.7%; Monte Carlo média 49.54, 80% 48.00–51.07, P(A) 34.9%

**Todas as verificações passaram.**
