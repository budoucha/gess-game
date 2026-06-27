"use strict";
/* ====================================================================
   Gess — コアルール + 盤描画 + 入力
   盤の内部表現: 22x22 配列 (index 0..21)。有効マスは 2..19 (18x18)。
   1,20 は盤外マージン(石は置けないが、駒の中心としては選択/通過できる)。
   北 = 行インデックスが大きい方向。黒は下(行2-4)、白は上(行17-19)。
   ==================================================================== */

const LO = 2, HI = 19;
const onBoard = (i, j) => i >= LO && i <= HI && j >= LO && j <= HI;
const other = c => (c === 'B' ? 'W' : 'B');
const colorName = c => (c === 'B' ? '黒' : '白');
// 北,北東,東,南東,南,南西,西,北西 (行+ = 北)
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function emptyBoard() {
  const b = [];
  for (let i = 0; i < 22; i++) b.push(new Array(22).fill(null));
  return b;
}
function cloneBoard(b) { return b.map(r => r.slice()); }

/* ---- 正準的な開始配置 (Wikipedia / 標準実装に一致, 各色43石) ---- */
function setupBoard() {
  const b = emptyBoard();
  const backA = ".o.o.oooooooo.o.o."; // 行 2,4 / 17,19
  const backB = "ooo.o.oooo.o.o.ooo"; // 行 3 / 18 (l列が空=リング中心)
  const pawns = ".o.".repeat(6);      // 行 7 / 14
  const put = (row, pat, color) => {
    for (let k = 0; k < 18; k++) if (pat[k] === 'o') b[row][k + 2] = color;
  };
  put(2, backA, 'B'); put(3, backB, 'B'); put(4, backA, 'B'); put(7, pawns, 'B');
  put(19, backA, 'W'); put(18, backB, 'W'); put(17, backA, 'W'); put(14, pawns, 'W');
  return b;
}

/* ---- 駒(3x3フットプリント)の解析 ---- */
function analyze(bd, ci, cj, color) {
  let opponentInside = false, surrounding = false;
  const stones = [];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const i = ci + di, j = cj + dj;
      if (!onBoard(i, j)) continue;
      const v = bd[i][j];
      if (v === null) continue;
      if (v !== color) { opponentInside = true; }
      else {
        stones.push({ di, dj });
        if (!(di === 0 && dj === 0)) surrounding = true;
      }
    }
  }
  if (opponentInside || !surrounding) return { valid: false };
  const hasCenter = onBoard(ci, cj) && bd[ci][cj] === color;
  const dirs = DIRS.filter(([di, dj]) => {
    const i = ci + di, j = cj + dj;
    return onBoard(i, j) && bd[i][j] === color;
  });
  return { valid: true, hasCenter, dirs, stones, color };
}

function footprintTouchesBoard(ci, cj) {
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      if (onBoard(ci + di, cj + dj)) return true;
  return false;
}

/* 擬似合法手(リング自滅の判定は別途) */
function pseudoMoves(bd, ci, cj, piece) {
  const moves = [];
  const ownSet = new Set(piece.stones.map(s => (ci + s.di) + "," + (cj + s.dj)));
  const maxDist = piece.hasCenter ? 18 : 3;
  for (const [di, dj] of piece.dirs) {
    for (let d = 1; d <= maxDist; d++) {
      const ni = ci + di * d, nj = cj + dj * d;
      if (!footprintTouchesBoard(ni, nj)) break;
      let collide = false;
      for (let a = -1; a <= 1 && !collide; a++) {
        for (let b = -1; b <= 1; b++) {
          const ii = ni + a, jj = nj + b;
          if (!onBoard(ii, jj)) continue;
          if (bd[ii][jj] !== null && !ownSet.has(ii + "," + jj)) { collide = true; break; }
        }
      }
      moves.push({ i: ni, j: nj, capture: collide });
      if (collide) break;
    }
  }
  return moves;
}

/* 着手を盤に適用(破壊的)。捕獲数を返す。 */
function applyMove(bd, from, stones, to, color) {
  for (const s of stones) {
    const i = from.i + s.di, j = from.j + s.dj;
    if (onBoard(i, j)) bd[i][j] = null;
  }
  let captured = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const i = to.i + a, j = to.j + b;
    if (onBoard(i, j) && bd[i][j] !== null) { bd[i][j] = null; captured++; }
  }
  for (const s of stones) {
    const i = to.i + s.di, j = to.j + s.dj;
    if (onBoard(i, j)) bd[i][j] = color;
  }
  return captured;
}

function hasRing(bd, color) {
  for (let i = LO + 1; i <= HI - 1; i++)
    for (let j = LO + 1; j <= HI - 1; j++) {
      if (bd[i][j] !== null) continue;
      let ok = true;
      for (const [di, dj] of DIRS) if (bd[i + di][j + dj] !== color) { ok = false; break; }
      if (ok) return true;
    }
  return false;
}
function countRings(bd, color) {
  let n = 0;
  for (let i = LO + 1; i <= HI - 1; i++)
    for (let j = LO + 1; j <= HI - 1; j++) {
      if (bd[i][j] !== null) continue;
      let ok = true;
      for (const [di, dj] of DIRS) if (bd[i + di][j + dj] !== color) { ok = false; break; }
      if (ok) n++;
    }
  return n;
}
function countStones(bd, color) {
  let n = 0;
  for (let i = LO; i <= HI; i++) for (let j = LO; j <= HI; j++) if (bd[i][j] === color) n++;
  return n;
}

/* リング規則(Gess/Wikipedia版): 自分のリングを壊す手も「合法」。
   リングの有無は手番終了時の勝敗としてのみ評価する(performMove参照)。
   したがって擬似手はそのまま合法手になる。 */

/* ある中心の駒の合法手(UI用) */
function legalMovesForPiece(bd, ci, cj, piece) {
  return pseudoMoves(bd, ci, cj, piece);
}

/* zugzwang判定: 指定色に「自リングを保てる手」が1つでもあるか。
   無ければグローバル zugzwang (どの手を指しても自リング消滅で負け)。 */
function hasSafeMove(bd, color) {
  for (let ci = 1; ci <= 20; ci++) {
    for (let cj = 1; cj <= 20; cj++) {
      const p = analyze(bd, ci, cj, color);
      if (!p.valid) continue;
      for (const m of pseudoMoves(bd, ci, cj, p)) {
        const nb = cloneBoard(bd);
        applyMove(nb, { i: ci, j: cj }, p.stones, { i: m.i, j: m.j }, color);
        if (hasRing(nb, color)) return true;
      }
    }
  }
  return false;
}

/* 全合法手(AI用)。リング自滅手も合法(指すと負けるだけ)なので除外しない。 */
function genAllMoves(bd, color) {
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

/* ====================================================================
   ゲーム状態 + UI
   ==================================================================== */
const G = {
  board: null, current: 'B', captures: { B: 0, W: 0 },
  selected: null, pieceInfo: null, legalMoves: [],
  history: [], gameOver: false,
  mode: 'pvp',          // 'pvp' | 'cpu' | 'tutorial'
  aiColor: 'W', difficulty: 'normal', aiThinking: false,
  hints: [],            // チュートリアル用ハイライト(中心) [{i,j}]
  pulseCells: null,     // チュートリアルで緑パルス強調するマス [{i,j}]
  frames: null,         // チュートリアルで表示する3×3枠 [{i,j}](中心)
  checkCells: null,     // 選択クイズで見つけた駒の印 [{i,j}]
  onMoveMade: null,     // チュートリアル用フック(着手後)
  onSelect: null,       // チュートリアル用フック(駒選択を試みた時)
  lock: false,          // チュートリアルで入力を制限
};

const boardEl = document.getElementById('board');
const thinkingEl = document.getElementById('thinking');

function fileLabel(j) { return String.fromCharCode(96 + j); } // 2->'b' .. 19->'s'

function clearSelection() { G.selected = null; G.pieceInfo = null; G.legalMoves = []; }

function pushHistory() {
  G.history.push({
    board: cloneBoard(G.board), current: G.current,
    captures: { B: G.captures.B, W: G.captures.W }, gameOver: G.gameOver,
  });
  if (G.history.length > 400) G.history.shift();
}

function aiTurnNow() {
  return G.mode === 'cpu' && !G.gameOver && G.current === G.aiColor;
}

function onCellClick(i, j) {
  if (G.gameOver || G.aiThinking || G.lock) return;
  if (aiTurnNow()) return;
  if (G.selected) {
    const m = G.legalMoves.find(mv => mv.i === i && mv.j === j);
    if (m) { performMove({ i: G.selected.i, j: G.selected.j }, { i, j }, G.pieceInfo.stones, G.current); return; }
    if (i === G.selected.i && j === G.selected.j) {
      if (G.mode === 'tutorial') return;   // チュートリアル中は選択を保持
      clearSelection(); render(); return;
    }
  }
  const piece = analyze(G.board, i, j, G.current);
  if (!piece.valid) {
    notifySelect(i, j, false);
    if (G.mode === 'tutorial') return;     // チュートリアル中は誤クリックで選択解除しない
    clearSelection(); render(); return;
  }
  G.selected = { i, j };
  G.pieceInfo = piece;
  // ルール上は自リング喪失手も合法だが、UIでは事故防止のため非表示にする。
  // (自分にリングがあるときに限り、自リングが崩れる手を除外)
  const all = legalMovesForPiece(G.board, i, j, piece);
  const hadRing = hasRing(G.board, G.current);
  G.legalMoves = hadRing ? all.filter(m => {
    const nb = cloneBoard(G.board);
    applyMove(nb, { i, j }, piece.stones, { i: m.i, j: m.j }, G.current);
    return hasRing(nb, G.current);
  }) : all;
  render();
  notifySelect(i, j, true);
}
function notifySelect(i, j, valid) { if (typeof G.onSelect === 'function') G.onSelect({ i, j, valid }); }

function performMove(from, to, stones, color) {
  pushHistory();
  const captured = applyMove(G.board, from, stones, to, color);
  G.captures[color] += captured;
  clearSelection();

  const opp = other(color);

  // チュートリアルは独自の進行・メッセージで管理する(勝敗バナーは出さない)
  if (G.mode === 'tutorial') {
    G.current = opp;
    render();
    maybeNotifyMove(from, to, color);
    return;
  }

  // 手番終了時の勝敗判定(Gess/Wikipedia版):
  //  - 相手にリングが無く自分に有る           → 自分の勝ち
  //  - 自分にリングが無い(片方・双方どちらでも) → 動かした自分の負け
  const moverHasRing = hasRing(G.board, color);
  const oppHasRing = hasRing(G.board, opp);
  if (!moverHasRing || !oppHasRing) {
    const moverWins = moverHasRing && !oppHasRing;
    const winner = moverWins ? color : opp;
    let reason;
    if (moverWins) reason = "相手のリングをすべて破壊しました。";
    else if (!moverHasRing && !oppHasRing) reason = "双方のリングが同時に消えたため、動かした側の負けです。";
    else reason = colorName(color) + " が自分の最後のリングを失いました。";
    finish(winner, reason);
    maybeNotifyMove(from, to, color);
    return;
  }
  G.current = opp;

  // グローバル zugzwang: 相手にリングはあるが「リングを保てる手」が1つも無い場合、
  // 相手は何を指してもリング喪失で負ける。UIデッドロック回避のため即座に finish。
  if (G.mode !== 'tutorial' && !hasSafeMove(G.board, opp)) {
    finish(color, colorName(opp) + " はリングを守れる手がありません。");
    maybeNotifyMove(from, to, color);
    return;
  }

  render();
  maybeNotifyMove(from, to, color);

  if (aiTurnNow()) scheduleAI();
}

function maybeNotifyMove(from, to, color) {
  if (typeof G.onMoveMade === 'function') G.onMoveMade({ from, to, color });
}

function finish(winner, reason) {
  G.gameOver = true;
  render();
  const b = document.getElementById('banner');
  b.textContent = colorName(winner) + " の勝ち！ " + (reason || "");
  b.classList.add('show');
}

function scheduleAI() {
  G.aiThinking = true;
  thinkingEl.classList.add('show');
  render();
  setTimeout(() => {
    const mv = aiChooseMove(G.board, G.aiColor, G.difficulty);
    G.aiThinking = false;
    thinkingEl.classList.remove('show');
    if (!mv) { render(); return; }   // 指せない(理論上ほぼ無い)
    performMove(mv.from, mv.to, mv.stones, G.aiColor);
  }, 250);
}

function undo() {
  if (G.aiThinking) return;
  // CPU戦では人間の手 + AIの手の2手分戻す
  const steps = (G.mode === 'cpu') ? 2 : 1;
  for (let s = 0; s < steps && G.history.length; s++) {
    const h = G.history.pop();
    G.board = h.board; G.current = h.current; G.captures = h.captures; G.gameOver = h.gameOver;
  }
  clearSelection();
  document.getElementById('banner').classList.remove('show');
  render();
}

function newGame() {
  G.board = setupBoard();
  G.current = 'B';
  G.captures = { B: 0, W: 0 };
  G.history = [];
  G.gameOver = false;
  G.aiThinking = false;
  G.hints = [];
  G.pulseCells = null;
  G.frames = null;
  G.checkCells = null;
  G.lock = false;
  G.onMoveMade = null;
  G.onSelect = null;
  if (typeof hideCoach === 'function') hideCoach();
  clearSelection();
  thinkingEl.classList.remove('show');
  document.getElementById('banner').classList.remove('show');
  render();
  if (aiTurnNow()) scheduleAI();
}

/* ---- 描画 ---- */
function render() {
  const fp = new Set();
  if (G.selected && G.pieceInfo)
    for (const s of G.pieceInfo.stones) fp.add((G.selected.i + s.di) + "," + (G.selected.j + s.dj));
  const legalMap = new Map();
  for (const m of G.legalMoves) legalMap.set(m.i + "," + m.j, m);
  const hintSet = new Set((G.hints || []).map(h => h.i + "," + h.j));
  const pulseSet = new Set();
  if (G.pulseCells) for (const c of G.pulseCells) pulseSet.add(c.i + "," + c.j);
  const checkSet = new Set((G.checkCells || []).map(c => c.i + "," + c.j));

  let html = "";
  for (let i = 20; i >= 1; i--) {
    for (let j = 1; j <= 20; j++) {
      const ob = onBoard(i, j);
      const cls = ["cell"];
      if (ob) { cls.push("onboard"); if ((i + j) % 2 === 0) cls.push("alt"); }
      else cls.push("margin");
      cls.push("selectable");
      const key = i + "," + j;
      if (G.selected && i === G.selected.i && j === G.selected.j) cls.push("center-mark");
      if (fp.has(key)) cls.push("footprint");
      if (hintSet.has(key)) cls.push("hint");
      if (pulseSet.has(key)) cls.push("coach-target");
      const lm = legalMap.get(key);
      if (lm) cls.push("legal");

      let inner = "";
      if (ob && G.board[i][j]) inner = `<div class="stone ${G.board[i][j]}"></div>`;
      else if (!ob) {
        if ((i === 1 || i === 20) && j >= LO && j <= HI) inner = fileLabel(j);
        else if ((j === 1 || j === 20) && i >= LO && i <= HI) inner = String(i);
      }
      if (lm) inner += `<div class="dot ${lm.capture ? 'capture' : ''}"></div>`;
      if (checkSet.has(key)) inner += `<div class="check">✓</div>`;
      html += `<div class="${cls.join(' ')}" data-i="${i}" data-j="${j}">${inner}</div>`;
    }
  }
  // 3×3枠(駒の範囲)。絶対配置でグリッドに重ねる(セル配置に干渉しない)。bad=赤(駒でない)。
  for (const f of (G.frames || [])) {
    html += `<div class="frame3${f.bad ? ' bad' : ''}${f.cls ? ' ' + f.cls : ''}" style="left:calc((${f.j} - 2) * var(--cell)); top:calc((19 - ${f.i}) * var(--cell)); width:calc(3 * var(--cell)); height:calc(3 * var(--cell));"></div>`;
  }
  boardEl.innerHTML = html;
  boardEl.appendChild(hoverFrameEl);
  updateHoverFrame();

  document.getElementById('turnChip').className = "chip " + G.current;
  let turnLabel = colorName(G.current);
  if (G.mode === 'cpu') turnLabel += (G.current === G.aiColor ? "（CPU）" : "（あなた）");
  if (G.aiThinking) turnLabel += " — 考え中…";
  document.getElementById('turnText').textContent = turnLabel;
  document.getElementById('capB').textContent = G.captures.B;
  document.getElementById('capW').textContent = G.captures.W;
  document.getElementById('undoBtn').disabled = G.history.length === 0 || G.aiThinking;
}

/* ---- ホバー時の3×3駒範囲ガイド ---- */
const hoverFrameEl = document.createElement('div');
hoverFrameEl.className = 'frame3 frame3-hover hidden';
hoverFrameEl.style.width = 'calc(3 * var(--cell))';
hoverFrameEl.style.height = 'calc(3 * var(--cell))';
let hoverCell = null;

function hoverFrameSuppressed() {
  return G.mode === 'tutorial' || G.gameOver || G.aiThinking || G.lock || aiTurnNow();
}

function updateHoverFrame() {
  if (!hoverCell || hoverFrameSuppressed()) {
    hoverFrameEl.classList.add('hidden');
    return;
  }
  const { i, j } = hoverCell;
  hoverFrameEl.style.left = `calc((${j} - 2) * var(--cell))`;
  hoverFrameEl.style.top = `calc((19 - ${i}) * var(--cell))`;
  let valid;
  if (G.selected) {
    valid = (i === G.selected.i && j === G.selected.j) ||
            G.legalMoves.some(m => m.i === i && m.j === j);
  } else {
    valid = analyze(G.board, i, j, G.current).valid;
  }
  hoverFrameEl.classList.toggle('bad', !valid);
  hoverFrameEl.classList.remove('hidden');
}

boardEl.addEventListener('mousemove', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const i = +cell.dataset.i, j = +cell.dataset.j;
  if (hoverCell && hoverCell.i === i && hoverCell.j === j) return;
  hoverCell = { i, j };
  updateHoverFrame();
});
boardEl.addEventListener('mouseleave', () => {
  hoverCell = null;
  updateHoverFrame();
});

/* ---- 入力配線 ---- */
boardEl.addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  onCellClick(+cell.dataset.i, +cell.dataset.j);
});
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('tutorialBtn').addEventListener('click', () => startTutorial());

// 「新しい対局」ボタン: モード選択パネルを表示(対局はまだ始めない)
document.getElementById('newBtn').addEventListener('click', () => {
  if (G.mode === 'tutorial') exitTutorial();
  showModePicker(false);
});

// モード選択時: CPU設定の表示切替のみ(対局は開始しない)
document.getElementById('modeSel').addEventListener('change', updateCpuOptsVisibility);

// 「対局開始」ボタン: 選択中の設定で newGame
document.getElementById('startGameBtn').addEventListener('click', () => {
  G.mode = document.getElementById('modeSel').value;
  G.aiColor = document.getElementById('colorSel').value === 'B' ? 'W' : 'B';
  G.difficulty = document.getElementById('diffSel').value;
  hideModePicker();
  newGame();
});

// 「キャンセル」: 進行中の対局へ戻る(初回起動時は表示されない)
document.getElementById('cancelModeBtn').addEventListener('click', hideModePicker);

function updateCpuOptsVisibility() {
  const m = document.getElementById('modeSel').value;
  document.getElementById('cpuOpts').classList.toggle('hidden', m !== 'cpu');
}

function showModePicker(initial) {
  updateCpuOptsVisibility();
  document.getElementById('modePicker').classList.remove('hidden');
  // 初回起動時(まだ対局が無い)は「キャンセル」を隠す
  document.getElementById('cancelModeBtn').classList.toggle('hidden', !!initial);
  document.getElementById('newBtn').disabled = true;
  document.getElementById('undoBtn').disabled = true;
  G.lock = true;  // 盤クリックを無効化
}

function hideModePicker() {
  document.getElementById('modePicker').classList.add('hidden');
  document.getElementById('newBtn').disabled = false;
  G.lock = false;
  render();
}

// 起動: 初期盤面を描画してからモード選択パネルを開く
G.board = setupBoard();
G.current = 'B';
G.mode = 'pvp';
G.aiColor = 'W';
G.difficulty = 'normal';
G.captures = { B: 0, W: 0 };
render();
showModePicker(true);
