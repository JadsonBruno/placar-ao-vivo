# Placar ao Vivo — projeção do 2º turno de 2026 durante a apuração

**Página:** https://jadsonbruno.github.io/placar-ao-vivo/ (abre no celular; demonstração: `?simulado=1`)

É uma página estática: o navegador de quem abre consulta o TSE diretamente e roda o motor de projeção ali mesmo.
Não há servidor. Ela mostra, de forma simétrica para os dois candidatos (13 Lula, 22 Flávio Bolsonaro):
- quem está mais favorecido;
- a chance de vitória de cada um;
- a projeção final de cada um, com intervalos de 80% e 95%;
- a parcial do TSE;
- uma checagem com o ritmo das apurações passadas;
- a tabela por estado;
- avisos;
- entrada manual, para o caso de o TSE cair.

Isto é uma projeção estatística, não um resultado oficial.

## O que foi verificado (24 e 25/10/2026)

| Item | Situação |
|---|---|
| Código do 2º turno presidencial de 2026 | **6258**, lido da configuração oficial `resultados.tse.jus.br/oficial/comum/config/ele-c.json` (pleito 3221, 25/10/2026). O 1º turno é 6257. |
| Arquivo por UF | `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.json` (`br` = nacional, `zz` = exterior). **O caminho de 2022 (`dados-simplificados/...-r.json`) não existe mais.** Os arquivos do 2º turno já estão publicados, zerados. |
| Campos do JSON | Conferidos num arquivo real: `s.st`/`s.ts` (seções), `v.vv` (válidos), `e.te`/`e.est` (eleitores total / em seções totalizadas), candidatos em `carg[0].agr[].par[].cand[]` com `n`, `vap`, `pvap`. Números: **13 = LULA, 22 = FLAVIO BOLSONARO**. |
| CORS | O TSE responde com `Access-Control-Allow-Origin` igual ao Origin de quem pede (testado com dois domínios), então dá para buscar direto do navegador. |
| Totais | Batem exatamente: 1º turno de 2026 (Lula 53.879.538, Flávio 56.104.503); 2º turno de 2022 (60.345.999 × 58.206.354); 1º turno de 2022 (57.259.504 × 51.072.345). Média nacional da base = 48,726. |
| Dados por estado | `dados/estados.csv`, gerado por `scripts/montar-dados.mjs` só a partir do TSE: arquivos oficiais de 2026 e dados abertos de 2022 (`votacao_partido_munzona_2022` e `detalhe_votacao_munzona_2022`). Os votos dos candidatos batem com a tabela do prompt; os **votos válidos do 1º turno de 2026** do arquivo final do TSE diferem do prompt em até 0,02% por estado (usei os do TSE). O prompt chegou cortado em SE; as linhas SE, TO e ZZ vêm do TSE. |
| Horário de votação | 8h às 17h de Brasília: **não verifiquei** em fonte oficial nesta sessão. |
| Parciais estaduais (seção 8.3 do prompt) | **Não chegaram** (o prompt foi cortado). Usei a foto das 17h52 do 1º turno de 2026 (Mix Vale). Como o artigo só dá o % do líder em cada estado, o % do outro candidato é **estimado** supondo que os demais candidatos tinham na parcial a mesma fatia do final. Também usei as faixas-resumo que vieram no prompt. |

## Motor (seção 5 do prompt)

Para cada estado: `F_uf = base_uf + s + ε_uf` e a parcial `p_uf = F_uf + (1−f)·b + (1−f)^0,8·u_uf`.
- `base_uf` = Lula ÷ (Lula + Flávio) no 1º turno de 2026.
- `s` = ajuste nacional. O ponto de partida vem das pesquisas, com caudas t(4) cuja escala reproduz o intervalo de 90% de cada versão: a versão B reproduz exatamente P(Lula) = 37,4%.
- `b` = viés comum de ordem: as primeiras seções de todos os estados puxam juntas.
- `u_uf` = viés de ordem próprio do estado.

O peso da parcial de cada estado, `w(f) = σε² / (σε² + (1−f)^1,6·σu²)`, sai do próprio modelo e vai a 1 quando o estado termina.

Na página, o cálculo roda num Web Worker (`docs/calculo.js`): os botões respondem na hora e os números mostram um esqueleto até o resultado chegar (≈ 10–40 ms no computador). A grade é adaptativa: uma passada grossa acha onde está a massa da posterior, e uma fina calcula só ali.

O cálculo é **semi-analítico**. A posterior de (s, b) é calculada numa grade, e o nacional é uma mistura de normais. Isso equivale a infinitos sorteios e espelha os dois candidatos exatamente. Comparado com um Monte Carlo de 20 mil sorteios no mesmo caso, dá média 49,55 × 49,54 e P 35,7% × 34,9%.

### Números calibrados

| Parâmetro | Valor | De onde |
|---|---|---|
| σε (desvio próprio do estado) | 0,65 pt | teste do prompt em 2022 (erro médio 0,51) |
| σu (ruído da parcial do estado) | 4,5 pt | 17h52 do 1º turno de 2026 + faixas do prompt; o modelo dá 4,8 / 4,6 / 3,9 / 2,5 pt para f em 0–5 / 5–15 / 15–40 / ≥40%, contra 4,3 / 5,3 / 3,5 / 3,2 observados; em f = 0,6 e 0,9, 2,3 e 0,74 contra ≈2,1 e ≈0,75 das faixas do prompt |
| γ (queda do ruído com f) | 0,8 | mesma calibração |
| σb (viés comum de ordem) | 2 pt | testei 2, 3 e 4 em 4 noites sintéticas: 2 teve o menor erro por estado e cobertura de 95% completa |

Comparação de `w(f)` na parcial das 17h52 (prior = 1º turno de 2022 + ajuste):
- motor: erro médio por estado de 1,92 pt;
- `w(f) = f`: 2,02 pt;
- `w = 0`: 2,21 pt.

## Resultados dos testes (`node testes/validacao.mjs`; detalhes em `testes/resultados.md`)

- **6.1 Dados:** todos os totais batem.
- **6.2 Por estado (17h52 do 1º turno de 2026):** o final real cai no intervalo de 80% em 19/28 estados e no de 95% em 27/28.
- **6.3 Noite sintética** (ordem real dos estados, curva nacional medida):
  - a projeção converge (48,98 × real 48,99);
  - o intervalo de 95% contém o real em 36/36 momentos da noite;
  - antes de 30% apurado, o motor erra no máximo 0,8 pt; a parcial crua erra até 6,4 pt;
  - nenhuma troca "de verdade" de favorito;
  - repeti com o ponto de partida errado para os dois lados, e as conclusões se mantêm.
- **6.4 2º turno de 2022 na checagem simples:** a faixa entre as duas curvas contém 50,90 nas 4 parciais. A curva de 2022 acerta 2022 por construção.
- **6.5 Simetria:** trocar os rótulos espelha as saídas, com diferença máxima de 3e-13.

## Simulador de cenários (`node testes/simulador.mjs`; detalhes em `testes/simulador.md`)

A demonstração sorteia o resultado final de cada estado com `cenario()` em `src/simulado.mjs`.

**Dados.** `scripts/montar-historico.mjs` lê os dados abertos do TSE de 2014, 2018 e 2022 e grava `dados/historico.json`. Os totais nacionais do PT e do adversário conferem nos 6 turnos.

**Como cada resultado é sorteado:**
- **Ponto de partida:** o 1º turno de 2026 do estado, em escala logit.
- **Desvios de região e de estado:** medidos na passagem do 1º para o 2º turno de 2014, 2018 e 2022.
  - Como medir: por ponto de voto em "outros candidatos" do 1º turno, reescalado para os 7,8% de 2026.
  - Tamanho: 0,039 por região e 0,040 por estado, em logit.
- **Abstenção por região e por estado:** ±2,4% e ±1,5% nos votos válidos.
- **Nacional:** um deslocamento único faz o país bater a previsão escolhida (±1,5 pontos de erro das pesquisas).
- **Limites:** nenhum estado sai da faixa histórica do PT (2º turnos de 2014, 2018 e 2022 e 1º turno de 2026), com 5 pontos de folga para cada lado. Quem sai é sorteado de novo.

**Cenários.** Há 10, e cada um que favorece um lado tem o seu espelho:
- sem surpresa;
- empate;
- abstenção no Sul × no Nordeste;
- pesquisas subestimam um ou outro;
- Nordeste ou Sudeste se movem para um ou outro.

O "aleatório" sorteia entre eles com a mesma chance. Com previsão de empate, a média dá 50,00% e Lula vence 50,2% das vezes.

**Medição do motor (sem alterá-lo).**
- **Cobertura geral:** nas apurações desse simulador, a faixa de 80% do motor contém o resultado sorteado 59% das vezes, e a de 95%, 77%.
- **Onde ela mais erra:** nos cenários de deslocamento regional (Sudeste: 35%).
- **Por quê:** o motor supõe que os estados se movem juntos, com ±0,65 ponto, enquanto o histórico mostra regiões se movendo em bloco. Ajustar isso é a fase 2.

## Estrutura

- `docs/`: a página publicada (GitHub Pages). Gere de novo com `node scripts/montar-web.mjs`; teste localmente com `node scripts/servir-web.mjs` e abra http://localhost:8090.
- `src/motor.mjs`, `src/tse.mjs`, `src/simulado.mjs`: motor, leitor do TSE e apuração sintética.
- `dados/estados.csv`: dados por estado. `scripts/montar-dados.mjs` monta e confere esse arquivo.
- `testes/validacao.mjs`: seção 6.
- `PROGRESSO.md`: diário de bordo.
