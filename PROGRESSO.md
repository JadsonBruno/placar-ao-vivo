# Progresso — Placar ao Vivo (2º turno de 25/10/2026)

Arquivo de retomada: se a sessão cair, leia isto primeiro e continue do primeiro item não feito.
Pedido original: projeção ao vivo do 2º turno presidencial (Lula × Flávio Bolsonaro) durante a apuração,
simétrica para os dois candidatos, motor por estado (seção 5 do prompt), validações da seção 6, README.
Pedido novo (24/10, 23h20): a página precisa ficar no GitHub Pages, responsiva para o celular (o usuário não
estará em casa). Decisão: HTML puro (sem Next.js). O TSE responde com CORS para qualquer origem
(testado: `Access-Control-Allow-Origin` reflete o Origin), então o navegador busca o TSE direto e o motor roda no
próprio navegador. Não precisa de servidor.

## Já feito (24/10, até ~23h20)
- Código do 2º turno presidencial de 2026 descoberto na configuração do TSE (`/oficial/comum/config/ele-c.json`):
  **6258** (pleito 3221, 25/10/2026). O 1º turno é 6257.
- Arquivo por UF: `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.json`
  (`br` = nacional, `zz` = exterior). O caminho antigo `dados-simplificados/...-r.json` de 2022 NÃO existe mais.
  Campos conferidos num arquivo real: `s.st/s.ts/s.pst`, `v.vv`, `e.te/e.est`, candidatos em
  `carg[0].agr[].par[].cand[]` com `n` (13 = LULA, 22 = FLAVIO BOLSONARO), `vap`, `pvap`.
- `dados/estados.csv|json`, gerados por `scripts/montar-dados.mjs` a partir das fontes do TSE em `fontes-tse/`
  (2026 1º turno: arquivos oficiais; 2022: dados abertos do TSE, `votacao_partido_munzona_2022` e
  `detalhe_votacao_munzona_2022`). Todos os totais batem com o prompt. A média ponderada da base dá 48,726.
  O prompt chegou cortado em SE; as linhas SE, TO e ZZ foram completadas com o TSE.
- `src/motor.mjs`: motor por estado. É semi-analítico (grade de s e b + mistura de normais) e simétrico
  (teste de troca de rótulos: diferença de 1e-13).
- `src/tse.mjs`: leitor defensivo + coletor educado (ETag, backoff). `src/simulado.mjs`: apuração sintética.
- `testes/validacao.mjs`: seções 6.1 a 6.5. Pendências:
  (a) a conferência com Monte Carlo quebrou por `Math.max(...array grande)`; trocar por um laço;
  (b) a cobertura do intervalo de 95% no fim da noite sintética falhou (16/36). O motor fica confiante
      demais quando o estado está quase todo apurado e as últimas seções são diferentes. Aumentar
      `sigmaB` (de 2 para 4) e a grade de b, ou revisar a forma do termo de viés; depois, rodar de novo.

## Falta (em ordem)
1. Corrigir o teste e recalibrar (itens a e b acima). Rodar `node testes/validacao.mjs` até passar e anotar no README.
2. Página estática em `web/` (`index.html` + `motor.js`, sem dependências), responsiva no celular:
   - no navegador, busca as 28 UFs + br do TSE a cada ~30 s (1 arquivo por vez, com ETag);
   - roda o motor e mostra, simetricamente:
     - rótulo de favorecimento, P(vitória) e projeção final com 80%/95% de cada candidato;
     - a parcial;
     - a checagem simples com as duas curvas;
     - a tabela por estado e os avisos (país < 30%; estado grande < 20%);
   - seletor de alvo (A, B, C, 50, livre);
   - entrada manual (por UF ou só nacional) se o TSE falhar;
   - histórico da noite no `localStorage` e gráfico;
   - modo demonstração (`?simulado=1`) com a apuração sintética.
3. Publicar em **https://jadsonbruno.github.io/placar/**:
   - clonar `https://github.com/JadsonBruno/JadsonBruno.github.io` (branch `master`, o Pages já serve as pastas dele);
   - copiar `web/` para a pasta `placar/`, fazer commit e push;
   - não mexer no que já existe lá (só há `coming-soon-page/`);
   - conferir a URL com curl. O MCP do GitHub está sem credencial, mas o `git push` deste PC funciona.
4. Servidor local (`servidor.mjs`), como plano B e gravador: modos `--ao-vivo`, `--replay pasta` e `--simulado`;
   grava em `dados/AAAA-MM-DD/HHMMSS_uf.json` e em `historico.csv`; SSE; entrada manual.
5. README com:
   - o que foi confirmado e o que não foi;
   - os números calibrados;
   - os resultados dos testes;
   - a URL publicada.
6. Teste final: abrir a página publicada (modo simulado), rodar no celular com 390 px e conferir que busca
   o TSE de verdade (os arquivos do 6258 já existem, zerados).

Prazo: tudo testado antes das 17h (Brasília) de 25/10. A votação vai das 8h às 17h.
