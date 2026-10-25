// Web Worker: roda o motor fora da tela, para os toques nunca esperarem pelo cálculo.
import { projetar, definido, PARAMS, PARAMS_M2 } from "./motor.js?v=20261025j";

self.onmessage = (e) => {
  const { id, estados, parciais, alvo, nacionalSo, motor } = e.data;
  try {
    const t0 = performance.now();
    const r = projetar(estados, nacionalSo || parciais, alvo, motor === 2 ? PARAMS_M2 : PARAMS);
    self.postMessage({ id, r, def: definido(parciais), ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, erro: String(err && err.message ? err.message : err) });
  }
};
