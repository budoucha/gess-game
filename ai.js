"use strict";
/* ====================================================================
   Gess CPU
   easy   : ほぼランダム(勝ち手があれば取る、捕獲を少し優先)
   normal : 1手読みで評価値最大
   hard   : 候補上位に対して相手の最善応手まで読む(浅い2手読み)
   ==================================================================== */

const CENTER = 10.5;

function evaluate(bd, me) {
  const opp = other(me);
  const meR = countRings(bd, me), oppR = countRings(bd, opp);
  if (meR === 0) return -1e6;   // 自分のリングが無い=負け(最優先で回避)
  if (oppR === 0) return 1e6;   // 自分は残り相手だけ全滅=勝ち
  const mat = countStones(bd, me) - countStones(bd, opp);
  let center = 0;
  for (let i = LO; i <= HI; i++) for (let j = LO; j <= HI; j++) {
    const v = bd[i][j];
    if (!v) continue;
    const w = Math.max(0, 8 - (Math.abs(i - CENTER) + Math.abs(j - CENTER)));
    center += (v === me ? w : -w);
  }
  return (meR - oppR) * 220 + mat * 12 + center * 0.6;
}

function resultBoard(bd, mv, color) {
  const nb = cloneBoard(bd);
  applyMove(nb, mv.from, mv.stones, mv.to, color);
  return nb;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function aiChooseMove(bd, me, difficulty) {
  const moves = genAllMoves(bd, me);
  if (!moves.length) return null;

  // 即勝ち手(相手の最後のリングを取り、自分のリングは残る)があれば必ず取る
  for (const mv of moves) {
    const nb = resultBoard(bd, mv, me);
    if (!hasRing(nb, other(me)) && hasRing(nb, me)) return mv;
  }

  // 自分のリングを失う手(=その手番で負け)は候補から除外。安全手が無ければ仕方なく全手から。
  const safe = moves.filter(mv => hasRing(resultBoard(bd, mv, me), me));
  const pool = safe.length ? safe : moves;

  if (difficulty === 'easy') {
    const caps = pool.filter(m => m.capture);
    const p = (caps.length && Math.random() < 0.6) ? caps : pool;
    return shuffle(p)[0];
  }

  // 1手読み評価
  const scored = pool.map(mv => ({ mv, s: evaluate(resultBoard(bd, mv, me), me) }));
  scored.sort((a, b) => b.s - a.s);

  if (difficulty === 'normal') {
    // 同点上位からランダムに選び単調さを避ける
    const best = scored[0].s;
    const top = scored.filter(x => x.s >= best - 1);
    return shuffle(top)[0].mv;
  }

  // hard: 上位候補について相手の最善応手を読む(2手読み)
  const K = Math.min(6, scored.length);
  let bestMv = scored[0].mv, bestVal = -Infinity;
  for (let k = 0; k < K; k++) {
    const mv = scored[k].mv;
    const after = resultBoard(bd, mv, me);
    if (!hasRing(after, other(me)) && hasRing(after, me)) return mv; // 念のため
    // 相手の応手(擬似手で十分・高速化)。相手は我々の評価値を最小化。
    let worst = Infinity;
    const oppMoves = genAllMovesFast(after, other(me));
    for (const om of oppMoves) {
      const nb = resultBoard(after, om, other(me));
      const v = evaluate(nb, me);
      if (v < worst) worst = v;
      if (worst <= -1e6) break; // 相手に即負けされる手は最悪
    }
    if (worst > bestVal) { bestVal = worst; bestMv = mv; }
  }
  return bestMv;
}

/* 高速版: リング自滅フィルタを省いた擬似全手(相手応手の探索用) */
function genAllMovesFast(bd, color) {
  const moves = [];
  for (let ci = 1; ci <= 20; ci++) {
    for (let cj = 1; cj <= 20; cj++) {
      const piece = analyze(bd, ci, cj, color);
      if (!piece.valid) continue;
      for (const m of pseudoMoves(bd, ci, cj, piece)) {
        moves.push({ from: { i: ci, j: cj }, to: { i: m.i, j: m.j }, capture: m.capture, stones: piece.stones });
      }
    }
  }
  return moves;
}
