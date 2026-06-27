"use strict";
/* ====================================================================
   Gess インタラクティブ・チュートリアル
   実際の盤・ルールを使い、シナリオを設定して操作を学ぶ。
   移動ステップは「①駒を選ぶ → ②行き先を選ぶ」の2段階。
   ==================================================================== */

function boardFrom(list) {
  const b = emptyBoard();
  for (const s of list) b[s.i][s.j] = s.c;
  return b;
}
// 中心(ci,cj)を「プラス型」(直線駒)で配置
function plus(ci, cj, c) {
  return [{ i: ci, j: cj, c }, { i: ci + 1, j: cj, c }, { i: ci - 1, j: cj, c },
          { i: ci, j: cj + 1, c }, { i: ci, j: cj - 1, c }];
}
// 中心(ci,cj)を「全9マス」(クイーン)で配置
function block(ci, cj, c) {
  const out = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) out.push({ i: ci + di, j: cj + dj, c });
  return out;
}
// リング(中央空・周囲8)
function ring(ci, cj, c) {
  const out = [];
  for (const [di, dj] of DIRS) out.push({ i: ci + di, j: cj + dj, c });
  return out;
}
// ビショップ型(中央+斜め4方向)
function bishopShape(ci, cj, c) {
  return [{ i: ci, j: cj, c },
          { i: ci + 1, j: cj + 1, c }, { i: ci + 1, j: cj - 1, c },
          { i: ci - 1, j: cj + 1, c }, { i: ci - 1, j: cj - 1, c }];
}
// 指定色の石の連結成分(8近傍)を Set("i,j") の配列で返す
function stoneGroups(bd, color) {
  const seen = new Set(), groups = [];
  for (let i = LO; i <= HI; i++) for (let j = LO; j <= HI; j++) {
    if (bd[i][j] !== color || seen.has(i + ',' + j)) continue;
    const group = new Set(), stack = [[i, j]];
    seen.add(i + ',' + j);
    while (stack.length) {
      const [ci, cj] = stack.pop();
      group.add(ci + ',' + cj);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const ni = ci + di, nj = cj + dj, k = ni + ',' + nj;
        if (onBoard(ni, nj) && bd[ni][nj] === color && !seen.has(k)) {
          seen.add(k); stack.push([ni, nj]);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}
// 「すべての石を3×3で囲める」有効な中心(キー"i,j")を全列挙
function framesEnclosingAll(bd, color) {
  const stones = [];
  for (let i = LO; i <= HI; i++) for (let j = LO; j <= HI; j++) if (bd[i][j] === color) stones.push([i, j]);
  const centers = [];
  for (let ci = 1; ci <= 20; ci++) for (let cj = 1; cj <= 20; cj++) {
    if (!analyze(bd, ci, cj, color).valid) continue;
    if (stones.every(([si, sj]) => Math.abs(si - ci) <= 1 && Math.abs(sj - cj) <= 1)) {
      centers.push(ci + ',' + cj);
    }
  }
  return centers;
}
// どれかの有効な駒(3×3)に入りうる石(キー"i,j")の集合 = 選択可能な石
function coverableStones(bd, color) {
  const set = new Set();
  for (let ci = 1; ci <= 20; ci++) for (let cj = 1; cj <= 20; cj++) {
    const p = analyze(bd, ci, cj, color);
    if (!p.valid) continue;
    for (const s of p.stones) set.add((ci + s.di) + ',' + (cj + s.dj));
  }
  return set;
}
// 石(キー配列)が8近傍で1つに繋がっているか
function stonesConnected(keys) {
  if (keys.length <= 1) return true;
  const set = new Set(keys), seen = new Set([keys[0]]), stack = [keys[0]];
  while (stack.length) {
    const [ci, cj] = stack.pop().split(',').map(Number);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const k = (ci + di) + ',' + (cj + dj);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
    }
  }
  return seen.size === set.size;
}

/* ---- コーチマーク(吹き出し) ---- */
const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));
const cellEl = (i, j) => document.querySelector(`#board .cell[data-i="${i}"][data-j="${j}"]`);
let coachMarks = []; // [{ getEl, text, prefer }]

function positionBubble(c, el, mark) {
  const r = el.getBoundingClientRect();
  c.querySelector('.coach-text').innerHTML = mark.text;
  c.className = 'coach show top' + (mark.noArrow ? ' no-arrow' : '');
  const cr = c.getBoundingClientRect();
  const gap = 12 + (mark.offset || 0);
  let place = (mark.prefer && mark.prefer !== 'auto')
    ? mark.prefer
    : (r.top < cr.height + gap + 8 ? 'bottom' : 'top');
  if (place === 'bottom' && r.bottom + cr.height + gap + 2 > window.innerHeight) place = 'top';
  if (place === 'top' && r.top - cr.height - gap - 2 < 0) place = 'bottom';
  c.className = 'coach show ' + place + (mark.noArrow ? ' no-arrow' : '');
  let left = clamp(8, r.left + r.width / 2 - cr.width / 2, window.innerWidth - cr.width - 8);
  let top = place === 'bottom' ? r.bottom + gap : r.top - cr.height - gap;
  top = clamp(8, top, window.innerHeight - cr.height - 8);
  c.style.left = left + 'px';
  c.style.top = top + 'px';
  const arrow = c.querySelector('.coach-arrow');
  arrow.style.left = clamp(12, (r.left + r.width / 2) - left, cr.width - 12) + 'px';
}

function renderCoach() {
  const layer = document.getElementById('coachLayer');
  layer.innerHTML = '';
  for (const mark of coachMarks) {
    const el = mark.getEl();
    if (!el) continue;
    const c = document.createElement('div');
    c.innerHTML = '<span class="coach-text"></span><span class="coach-arrow"></span>';
    layer.appendChild(c);
    positionBubble(c, el, mark);
  }
}
function setCoach(getEl, text, prefer) { coachMarks = [{ getEl, text, prefer: prefer || 'auto' }]; renderCoach(); }
function setCoachMarks(list) { coachMarks = list; renderCoach(); }
function hideCoach() { coachMarks = []; renderCoach(); }
const cellMarks = (arr) => arr.map(cc => ({ getEl: () => cellEl(cc.i, cc.j), text: cc.text, prefer: cc.prefer || 'auto', offset: cc.offset || 0, noArrow: !!cc.noArrow }));
window.addEventListener('resize', () => { if (G.mode === 'tutorial') renderCoach(); });
window.addEventListener('scroll', () => { if (G.mode === 'tutorial') renderCoach(); }, true);

// ゴールを満たす着手先を探す(②で指す行き先)。選択中の駒の合法手から探す。
function findSolvingTarget(step) {
  if (!G.selected || !G.pieceInfo) return null;
  const from = G.selected, stones = G.pieceInfo.stones;
  for (const m of G.legalMoves) {
    const nb = cloneBoard(G.board);
    applyMove(nb, from, stones, { i: m.i, j: m.j }, G.current);
    const saved = G.board; G.board = nb;
    const ok = step.goal();
    G.board = saved;
    if (ok) return { i: m.i, j: m.j };
  }
  return null;
}

function demoSelect(i, j, color) {
  const p = analyze(G.board, i, j, color);
  if (!p.valid) return;
  G.selected = { i, j };
  G.pieceInfo = p;
  G.legalMoves = legalMovesForPiece(G.board, i, j, p);
}

const TUTORIAL = [
  {
    title: "Gess へようこそ",
    interactive: false,
    html: `Gess は囲碁盤で遊ぶチェス系ゲーム。これが開始配置です（各色43石）。<br><br>
      目的は相手の <b>リング</b> をすべて壊すこと。まずは駒の仕組みから学びましょう。`,
    pulseCells: [{ i: 3, j: 12 }, { i: 18, j: 12 }],
    coachCells: [
      { i: 3, j: 12, text: "これがリングです（黒）", prefer: "top" },
      { i: 18, j: 12, text: "これがリングです（白）", prefer: "bottom" },
    ],
    setup() { G.board = setupBoard(); },
    goalText: "中央付近に1つずつあるのが「リング」。これを全部壊されたら負けです。",
  },
  {
    title: "駒 = 3×3 の範囲",
    interactive: false,
    html: `Gess の「駒」は1個の石ではなく、盤上の <b>任意の3×3の範囲</b>（青い枠）です。<br>
      枠の中の石が <b>すべて自分の色</b> で、中央の周り8マスに <b>最低1個</b> あれば駒になります。<br><br>
      下のように、<b>数個でも・全部埋まっていても・真ん中が空でも</b> 駒です。`,
    frames: [{ i: 15, j: 10 }, { i: 6, j: 5 }, { i: 6, j: 10 }, { i: 6, j: 15 }],
    coachCells: [
      { i: 15, j: 10, text: "この3×3が1つの駒", prefer: "auto", offset: 30 },
      { i: 6, j: 5, text: "数個でもOK", prefer: "auto", offset: 30 },
      { i: 6, j: 10, text: "全部でもOK", prefer: "auto", offset: 30 },
      { i: 6, j: 15, text: "真ん中が空でもOK", prefer: "auto", offset: 30 },
    ],
    setup() {
      G.board = boardFrom([
        ...plus(15, 10, 'B'),                          // 上方: 代表的な駒
        { i: 6, j: 5, c: 'B' }, { i: 6, j: 6, c: 'B' }, // 数個
        ...block(6, 10, 'B'),                          // 全部
        ...ring(6, 15, 'B'),                           // 真ん中が空
      ]);
    },
    goalText: "数個でも・全部でも・真ん中が空でも、3×3の範囲が「1つの駒」です。",
  },
  {
    title: "駒にできない / 一部を囲む",
    interactive: false,
    html: `<b>相手の色が1個でも混ざる</b> と、その3×3は駒にできません（上の赤い枠）。<br><br>
      また、石が <b>3×3より大きく広がっている</b> ときは、その <b>一部だけを3×3で囲って</b> 駒として使えます（下の青い枠）。`,
    frames: [{ i: 15, j: 9, bad: true }, { i: 7, j: 6 }],
    coachCells: [
      { i: 15, j: 9, text: "白が交じると駒ではない", prefer: "auto", offset: 30 },
      { i: 7, j: 6, text: "一部だけ囲んで<br>駒にできる", prefer: "auto", offset: 30 },
    ],
    setup() {
      G.board = boardFrom([
        // 上方: 白が交じる3×3(駒にできない)
        ...block(15, 9, 'B'), { i: 14, j: 8, c: 'W' },
        // 下方: 横壁＋歯抜けの黒石(3×3より大きく、まばらに広がる)
        { i: 7, j: 4, c: 'B' }, { i: 7, j: 5, c: 'B' }, { i: 7, j: 6, c: 'B' },
        { i: 7, j: 7, c: 'B' }, { i: 7, j: 8, c: 'B' }, { i: 7, j: 9, c: 'B' }, // 横壁
        { i: 6, j: 5, c: 'B' }, { i: 6, j: 8, c: 'B' },                         // 上に歯抜け
        { i: 8, j: 6, c: 'B' }, { i: 8, j: 9, c: 'B' },                         // 下に歯抜け
        { i: 5, j: 7, c: 'B' },                                                 // さらに上
      ]);
    },
    goalText: "白が交じると駒にできない。大きな石並びは一部を3×3で囲めば駒。",
  },
  {
    title: "同じ石でも囲み方は何通りも",
    interactive: true,
    kind: 'frameall',
    html: `「駒」は3×3の <b>囲み方</b> しだい。<b>同じ石でも、中心をどこに置くかで何通りもの駒になります。</b><br>
      ただし <b>白が入る囲み方は使えません</b>（白で1通りふさがれています）。<br><br>
      🎯 <b>4つの石を「全部囲める」囲み方を、全通り見つけよう！</b>（中心の置き方を変えてクリック。選ぶたびに色違いの枠が残ります）`,
    coachCells: [{ i: 10, j: 15, text: "石を4つ囲める駒を<br>すべて探そう", prefer: "auto", noArrow: true }],
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        { i: 10, j: 10, c: 'B' }, { i: 10, j: 11, c: 'B' },
        { i: 11, j: 10, c: 'B' }, { i: 11, j: 11, c: 'B' },
        { i: 9, j: 9, c: 'W' }, // 石(10,10)の斜め。これを含む囲み方(中心10,10)は使えない
      ]);
    },
    goalText: "4つの石を全部囲める囲み方を、全通り見つけよう。白が入る向きは使えません。",
  },
  {
    title: "選べる石を、すべて駒にしよう",
    interactive: true,
    kind: 'coverall',
    html: `白が近くにあると囲み方が限られます。この中に <b>1つだけ、白に囲まれてどう囲んでも選べない黒石</b> があります。<br>
      それ以外の黒石を <b>すべて、どれかの駒（3×3）に含める</b> まで選び続けよう。<br>
      （離れた石も、つながっていなくても同じ3×3に入れて取れます）<br><br>
      🎯 <b>選べる黒石を、全部いずれかの駒に入れよう！</b>`,
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        // 3×3より大きく広がる黒の塊(L字)
        { i: 9, j: 5, c: 'B' }, { i: 10, j: 5, c: 'B' }, { i: 11, j: 5, c: 'B' },
        { i: 11, j: 6, c: 'B' }, { i: 11, j: 7, c: 'B' }, { i: 11, j: 8, c: 'B' },
        // 飛び石B(j11): h11と一緒でなければ取れない(下のk11の白で制限)
        { i: 11, j: 10, c: 'B' },
        // 飛び石C: 離れた1個
        { i: 6, j: 12, c: 'B' },
        // 白石: 黒の近くで駒づくりを邪魔する
        { i: 10, j: 6, c: 'W' }, { i: 9, j: 7, c: 'W' }, { i: 12, j: 7, c: 'W' },
        { i: 10, j: 11, c: 'W' }, { i: 7, j: 12, c: 'W' },
        { i: 11, j: 11, c: 'W' },   // k11: j11はh11を含む駒でしか取れなくなる
      ]);
    },
    goalText: "白に囲まれた1石以外の黒を、すべてどれかの駒に含めよう。",
  },
  {
    title: "方向 — 石のある向きに動く",
    interactive: true,
    pieceCell: { i: 6, j: 9 },
    html: `中央の <b>周囲8マスのうち石がある向き</b> にだけ動けます。<br>
      この駒は上下左右に石があるので <b>直線</b> に動けます。<b>斜めには石が無いので斜めには進めません</b>（選ぶと動ける向きだけ青い点が出ます）。<br><br>
      🎯 <b>①駒を選び ②北（上）の白石を捕獲しよう。</b>`,
    setup() {
      G.board = boardFrom([...plus(6, 9, 'B'), { i: 12, j: 9, c: 'W' }]);
      G.current = 'B';
      G.hints = [{ i: 12, j: 9 }];
    },
    goalText: "①光る駒を選択 → ②赤い丸（北の白石）をクリック。",
    coachText: "②ここをクリック！<br>北の白石を捕獲",
    goal() { return countStones(G.board, 'W') === 0; },
  },
  {
    title: "距離 — 中央の石で決まる",
    interactive: true,
    pieceCell: { i: 8, j: 4 },
    askCell: { i: 14, j: 10 },
    askText: "この石を取れる駒は？<br>駒を選んでみよう",
    html: `中央に石が <b>ある</b> 駒は <b>何マスでも</b>、中央が <b>空</b> の駒は <b>最大3マス</b> しか動けません。<br>
      盤には <b>左（中央に石）</b> と <b>右（中央が空）</b> の2つの駒があります。<br><br>
      🎯 <b>上の白石を取れるのはどっち？</b> 駒を選んで確かめ、白石を捕獲しよう。`,
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        ...block(8, 4, 'B'),                                    // 左: 中央に石(無制限)
        { i: 9, j: 17, c: 'B' }, { i: 9, j: 15, c: 'B' },       // 右: 中央が空のX(最大3)
        { i: 7, j: 17, c: 'B' }, { i: 7, j: 15, c: 'B' },
        { i: 14, j: 10, c: 'W' },                               // 上方・左右中央: 両駒の斜め先
      ]);
      G.hints = [{ i: 14, j: 10 }];
    },
    goalText: "上の白石を取れる駒を選んで、捕獲しよう。",
    coachText: "②ここをクリック！<br>斜めに一気に移動して捕獲",
    goal() { return countStones(G.board, 'W') === 0; },
  },
  {
    title: "捕獲 — まとめて取れる",
    interactive: true,
    pieceCell: { i: 5, j: 9 },
    html: `進路上で他の石に3×3が重なると、そこで <b>停止し</b>、重なった石を <b>すべて捕獲</b> します（自分の石も巻き込むので注意）。<br><br>
      🎯 <b>①駒を選び ②1手で白石3つを同時に捕獲しよう。</b>`,
    setup() {
      G.board = boardFrom([
        ...block(5, 9, 'B'),
        { i: 10, j: 8, c: 'W' }, { i: 10, j: 9, c: 'W' }, { i: 10, j: 10, c: 'W' },
      ]);
      G.current = 'B';
      G.hints = [{ i: 10, j: 8 }, { i: 10, j: 9 }, { i: 10, j: 10 }];
    },
    goalText: "①光る駒を選択 → ②白石3つに重なる行き先をクリック。",
    coachText: "②ここをクリック！<br>白石3つをまとめて捕獲",
    goal() { return countStones(G.board, 'W') === 0; },
  },
  {
    title: "空きマスでも取れる・自分の石も巻き込む",
    interactive: true,
    pieceCell: { i: 6, j: 9 },
    html: `捕獲は3×3の <b>範囲全体</b> で起こります。<br>
      ・駒の <b>石が無い部分（空きマス）</b> でも、その上に来た相手の石は取れます。<br>
      ・範囲に入った <b>自分の石も巻き込まれて</b> 取られます。<br><br>
      🎯 <b>①駒を選び ②北へ動かして白石を取ろう。</b>（右の自分の石も一緒に消えます）`,
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        ...plus(6, 9, 'B'),         // プラス型(四隅は空き)
        { i: 9, j: 8, c: 'W' },     // 左上の空きマスで取る相手の石
        { i: 9, j: 10, c: 'B' },    // 右上の空きマスで巻き込まれる自分の石
      ]);
      G.hints = [{ i: 9, j: 8 }, { i: 9, j: 10 }];
    },
    goalText: "①光る駒を選択 → ②北の白石に重なる行き先をクリック。",
    coachText: "②ここをクリック！<br>空きマスで白を取る＋自分の石も消える",
    goal() { return countStones(G.board, 'W') === 0; },
  },
  {
    title: "リングと勝利",
    interactive: true,
    pieceCell: { i: 7, j: 10 },
    html: `<b>リング</b> = 中央が空で周囲8マスが埋まった駒。<br>
      リングを <b>すべて失った側が負け</b> です。<br><br>
      🎯 <b>①下の黒い直線駒を選び ②北へ動かして白リングを壊そう！</b>`,
    setup() {
      G.board = boardFrom([
        ...ring(11, 10, 'W'),   // 壊す対象の白リング
        ...ring(4, 4, 'B'),     // 黒のリング(参考)
        ...plus(7, 10, 'B'),    // 攻撃用の黒い直線駒
      ]);
      G.current = 'B';
      G.hints = [{ i: 11, j: 10 }];
    },
    goalText: "①光る駒を選択 → ②リングの石に重なる行き先をクリック。",
    coachText: "②ここをクリック！<br>白リングを壊して勝利",
    goal() { return !hasRing(G.board, 'W'); },
  },
  {
    title: "リングは崩さず動かす",
    interactive: true,
    kind: 'ringlesson',
    html: `自分の <b>最後のリングが無くなる手</b> は、指せば <b>その手番で負け</b>。<br>
      <b>ルール上は合法ですが、UIでは事故防止のため青丸を出しません。</b><br><br>
      ・リングの石を <b>一部だけ</b> 含む駒は、動かすとリングが崩れて負けるので <b>青丸が出ません</b>。<br>
      ・でも <b>リング全体（中央が空の駒）</b> なら、リングごと崩さず動けます。さらに <b>動かして相手のリングを崩す</b> こともできます！<br><br>
      🎯 <b>①リングの石を含む駒（青丸が出ない）→ ②リング全体 の順に選び、白のリングを崩そう。</b>`,
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        ...ring(9, 9, 'B'),    // 黒の唯一のリング
        ...ring(9, 14, 'W'),   // 白のリング(1列左に。黒リングが東へ動いて崩せる)
      ]);
    },
    goalText: "①リングの石を含む駒（青丸が出ない）→ ②リング全体で白のリングを崩そう！",
  },
  {
    title: "リングは複数持てる — 片方を犠牲にして攻める",
    interactive: true,
    pieceCells: [{ i: 4, j: 5 }, { i: 6, j: 5 }],
    html: `<b>リングは複数持てます。</b>残っているリングが1つでもあれば負けません。<br>
      だから片方のリングを <b>あえて崩して</b> 動かし、相手のリングを攻撃する戦術もアリです（もう片方が安全なら大丈夫）。<br><br>
      黒のリングは <b>2つ</b>：左下と右上。左下リングの一部を攻撃駒として使えます（<b>光る2か所のどちらでもOK</b>）。<br><br>
      🎯 <b>①攻撃駒（光る所のどちらか）を選び ②白リングに重ねて崩そう。</b> 左下リングは犠牲になりますが右上が残ります。`,
    setup() {
      G.current = 'B';
      G.board = boardFrom([
        ...ring(5, 5, 'B'),        // 黒リング1: 犠牲にする側
        ...ring(15, 15, 'B'),      // 黒リング2: 安全に残す側
        ...ring(5, 11, 'W'),       // 白リング: 攻撃対象
      ]);
      G.hints = [{ i: 5, j: 11 }];
    },
    goalText: "①光る駒のどちらかを選択 → ②白リングに重なる行き先をクリック。",
    coachText: "②ここへ動かして<br>白リングを崩そう！",
    goal() { return !hasRing(G.board, 'W'); },
  },
  {
    title: "準備完了！",
    interactive: false,
    html: `これで基本はバッチリ。<br><br>
      ・駒 = 3×3の自分の石だけ<br>
      ・まず駒を選び、次に行き先を選ぶ<br>
      ・周囲の石がある向きに動く<br>
      ・中央に石→無制限 / 空→最大3マス<br>
      ・重なった石はまとめて捕獲<br>
      ・盤の外に出た石は消える<br>
      ・自分の最後のリングを失う手は指すと負け（UIでは選べません）<br>
      ・リングを全部失ったら負け<br><br>
      「対局を始める」で実戦へ！`,
    setup() { G.board = setupBoard(); },
    goalText: "右下のボタンから対局・CPU戦へ。",
  },
];

const TS = { step: 0, done: false };

function startTutorial() {
  G.mode = 'tutorial';
  G.gameOver = false;
  G.aiThinking = false;
  G.history = [];
  document.getElementById('mainPanel').classList.add('hidden');
  document.getElementById('tutorialPanel').classList.remove('hidden');
  document.getElementById('thinking').classList.remove('show');
  document.getElementById('banner').classList.remove('show');
  G.onMoveMade = onTutorialMove;
  G.onSelect = onTutorialSelect;
  showStep(0);
}

function exitTutorial() {
  G.onMoveMade = null;
  G.onSelect = null;
  G.hints = [];
  G.pulseCells = null;
  G.frames = null;
  G.checkCells = null;
  G.lock = false;
  G.mode = document.getElementById('modeSel').value; // チュートリアルモードを解除
  document.getElementById('banner').classList.remove('show');
  hideCoach();
  clearSelection();
  document.getElementById('tutorialPanel').classList.add('hidden');
  document.getElementById('mainPanel').classList.remove('hidden');
}

function showStep(n) {
  TS.step = n;
  TS.done = false;
  const step = TUTORIAL[n];
  clearSelection();
  G.gameOver = false;
  G.hints = [];
  G.pulseCells = null;
  TS.found = new Set();
  document.getElementById('banner').classList.remove('show');
  step.setup();
  G.frames = step.frames || null;
  G.checkCells = null;
  TS.foundMarks = [];
  TS.framings = [];
  TS.groups = (step.kind === 'select') ? stoneGroups(G.board, G.current) : null;
  TS.allCenters = (step.kind === 'frameall') ? framesEnclosingAll(G.board, G.current) : null;
  TS.coverable = (step.kind === 'coverall') ? coverableStones(G.board, G.current) : null;
  TS.covered = new Set();
  TS.ringStuckSeen = false;
  TS.ringMoveSeen = false;
  TS.lastPiece = null;
  G.lock = !step.interactive;
  render();

  document.getElementById('tStepNum').textContent = `ステップ ${n + 1} / ${TUTORIAL.length}`;
  document.getElementById('tTitle').textContent = step.title;
  document.getElementById('tText').innerHTML = step.html;
  const goalBox = document.getElementById('tGoal');
  goalBox.textContent = step.goalText || "";
  goalBox.classList.remove('done');
  goalBox.classList.toggle('hidden', !step.goalText);

  const prog = document.getElementById('tProgress');
  prog.innerHTML = TUTORIAL.map((_, k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('');

  document.getElementById('tPrev').disabled = n === 0;
  const next = document.getElementById('tNext');
  const isLast = n === TUTORIAL.length - 1;
  next.classList.toggle('hidden', isLast);
  document.getElementById('tFinish').classList.toggle('hidden', !isLast);
  next.disabled = step.interactive ? true : false;

  updateTutorialCoach();
}

// 現在のステップ・選択状態に応じて吹き出しとパルスを更新
function updateTutorialCoach() {
  const step = TUTORIAL[TS.step];

  // 説明ステップ / 選択ステップ / 囲み方ステップ: 固定の吹き出し
  if (!step.interactive || step.kind === 'select' || step.kind === 'frameall' || step.kind === 'coverall') {
    G.pulseCells = step.pulseCells || null;
    render();
    if (step.coachCells) setCoachMarks(cellMarks(step.coachCells));
    else hideCoach();
    return;
  }

  // リング学習ステップ: 初期表示(①リングの石を含む駒を選ぶ)
  if (step.kind === 'ringlesson') {
    G.pulseCells = [{ i: 8, j: 8 }];
    render();
    const gb = document.getElementById('tGoal');
    gb.classList.remove('done', 'hidden');
    gb.textContent = "①まず、リングの石を含む駒（光っている所）を選んでみよう。";
    setCoach(() => cellEl(8, 8), "①この駒を選ぶと？", 'auto');
    return;
  }

  // 移動ステップ: 2段階。パネルの指示も段階に同期。
  const pieces = step.pieceCells || (step.pieceCell ? [step.pieceCell] : []);
  const matched = G.selected && pieces.some(p => p.i === G.selected.i && p.j === G.selected.j);
  const pc = pieces[0];
  const multi = pieces.length > 1;
  const gb = document.getElementById('tGoal');
  gb.classList.remove('done', 'hidden');
  if (!G.selected) {
    // ① 駒を選ぶ。askCell があれば「この石を取れる駒は？」と問いかける(答えの駒は示さない)
    if (step.askCell) {
      G.pulseCells = [step.askCell];
      render();
      gb.textContent = "この白石を取れる駒は？ 駒を選んで確かめよう。";
      setCoach(() => cellEl(step.askCell.i, step.askCell.j), step.askText || "この石を取れる駒は？", 'auto');
    } else if (multi) {
      G.pulseCells = pieces;
      render();
      gb.textContent = "① 光る駒のどちらかをクリックして選ぼう。";
      setCoachMarks(pieces.map((p, idx) => ({
        getEl: () => cellEl(p.i, p.j),
        text: idx === 0 ? "①どちらでもOK<br>クリックして選択" : "①こちらでもOK",
        prefer: 'bottom',
      })));
    } else {
      G.pulseCells = [pc];
      render();
      gb.textContent = "① まず光る駒をクリックして選ぼう。";
      setCoach(() => cellEl(pc.i, pc.j), "①この駒をクリックして<br>選択しよう", 'bottom');
    }
  } else if (matched) {
    TS.lastPiece = { i: G.selected.i, j: G.selected.j };
    // ② 行き先を選ぶ
    const dest = findSolvingTarget(step);
    G.pulseCells = dest ? [dest] : null;
    render();
    gb.textContent = "② 光るマス（行き先）をクリックしよう！";
    if (dest) {
      let prefer = 'auto';
      if (G.hints && G.hints.length) {
        const avg = G.hints.reduce((s, h) => s + h.i, 0) / G.hints.length;
        prefer = avg > dest.i ? 'bottom' : 'top';
      }
      setCoach(() => cellEl(dest.i, dest.j), step.coachText || "②ここへ動かそう", prefer);
    } else hideCoach();
  } else {
    // 別の駒を選んでしまった
    if (step.askCell) {
      // パズル形式: 答えの駒は示さず、白石への問いかけを続ける
      G.pulseCells = [step.askCell];
      render();
      gb.textContent = "この駒では届かないみたい。別の駒を選んでみよう。";
      setCoach(() => cellEl(step.askCell.i, step.askCell.j), "この石に届く駒は<br>どっち？", 'auto');
    } else {
      G.pulseCells = pieces;
      render();
      gb.textContent = multi
        ? "その駒では解けません。光る駒のどちらかを選ぼう。"
        : "その駒では解けません。光る駒を選ぼう。";
      setCoach(() => cellEl(pc.i, pc.j), "その駒では解けません。<br>光る駒を選ぼう", 'bottom');
    }
  }
}

// 駒選択を試みたとき
function onTutorialSelect(info) {
  const step = TUTORIAL[TS.step];
  if (!step.interactive) return;
  if (step.kind === 'select') {
    const gb = document.getElementById('tGoal');
    if (!info.valid) { gb.textContent = selectReason(info.i, info.j); return; }
    G.legalMoves = []; // 選択クイズでは動かさない
    // 選んだ3×3の自石が、どの黒のかたまり(連結成分)に重なるか
    const stones = G.pieceInfo
      ? G.pieceInfo.stones.map(s => (G.selected.i + s.di) + ',' + (G.selected.j + s.dj))
      : [];
    let newlyFound = 0;
    TS.groups.forEach((grp, k) => {
      if (TS.found.has(k)) return;
      if (stones.some(p => grp.has(p))) { TS.found.add(k); newlyFound++; }
    });
    if (newlyFound === 0) { gb.textContent = "そのかたまりはもう選びました。"; render(); return; }
    TS.foundMarks.push({ i: info.i, j: info.j });
    G.checkCells = TS.foundMarks.slice();
    const remaining = TS.groups.length - TS.found.size;
    if (remaining === 0) {
      TS.done = true;
      G.lock = true;
      gb.textContent = "✓ 全部のかたまりを選べました！ 離れた石も、白を避ければ、それぞれ駒にできます。";
      gb.classList.add('done');
      document.getElementById('tNext').disabled = false;
      hideCoach();
    } else if (newlyFound >= 2) {
      gb.textContent = `○ まとめて${newlyFound}個！ 離れた石も同じ3×3なら1つの駒。残り ${remaining} 個。`;
    } else {
      gb.textContent = `○ 正解！ 残り ${remaining} 個。`;
    }
    render();
    return;
  }
  if (step.kind === 'coverall') {
    const gb = document.getElementById('tGoal');
    if (!info.valid) { gb.textContent = selectReason(info.i, info.j); return; }
    G.legalMoves = [];
    const stones = G.pieceInfo.stones.map(s => (G.selected.i + s.di) + ',' + (G.selected.j + s.dj));
    let added = 0;
    for (const p of stones) if (TS.coverable.has(p) && !TS.covered.has(p)) { TS.covered.add(p); added++; }
    G.checkCells = [...TS.covered].map(k => { const [i, j] = k.split(',').map(Number); return { i, j }; });
    if (added === 0) { gb.textContent = "その石はもう駒にしたよ。まだ✓の付いていない石を含む囲み方を探そう。"; render(); return; }
    const remaining = TS.coverable.size - TS.covered.size;
    const disc = !stonesConnected(stones) ? "（離れた石も同じ3×3なら1つの駒！）" : "";
    if (remaining === 0) {
      TS.done = true;
      G.lock = true;
      gb.textContent = "✓ 選べる石を全部、駒にできた！ 残った1石は白に囲まれ、どう囲んでも白が入るので選べません。";
      gb.classList.add('done');
      document.getElementById('tNext').disabled = false;
      hideCoach();
    } else {
      gb.textContent = `○ あと ${remaining} 個の石！ ${disc}`;
    }
    render();
    return;
  }
  if (step.kind === 'frameall') {
    const gb = document.getElementById('tGoal');
    if (!info.valid) { gb.textContent = selectReason(info.i, info.j); return; }
    G.legalMoves = [];
    const key = info.i + ',' + info.j;
    if (!TS.allCenters.includes(key)) {
      gb.textContent = "おしい！ 4つの石を全部囲める中心を探そう。";
      render(); return;
    }
    if (TS.framings.includes(key)) { gb.textContent = "その囲み方はもう見つけたよ。中心を変えてみよう。"; render(); return; }
    TS.framings.push(key);
    const colors = ['', 'c2', 'c3', 'c4'];
    G.frames = TS.framings.map((k, idx) => {
      const [fi, fj] = k.split(',').map(Number);
      return { i: fi, j: fj, cls: colors[idx % colors.length] };
    });
    const remaining = TS.allCenters.length - TS.framings.length;
    if (remaining === 0) {
      TS.done = true;
      G.lock = true;
      gb.textContent = "✓ 全通り見つけた！ 同じ石でも囲み方は何通りも。白が入る1通りは使えないので3通りでした。";
      gb.classList.add('done');
      document.getElementById('tNext').disabled = false;
      hideCoach();
    } else {
      gb.textContent = `○ ${TS.framings.length}通り目！ 残り ${remaining} 通り。`;
    }
    render();
    return;
  }
  if (step.kind === 'ringlesson') {
    const gb = document.getElementById('tGoal');
    if (!info.valid) { gb.textContent = selectReason(info.i, info.j); return; }
    const isRing = (info.i === 9 && info.j === 9); // リング全体(中央の空マス)を中心に選択
    if (!isRing && !TS.ringMoveSeen) {
      // リングの石を一部含む駒: UIは安全のため青丸を出さない(動かすと最後のリングが崩れて負けるため)
      TS.ringStuckSeen = true;
      G.legalMoves = []; // 念のためフィルタ済みの空配列を保証
      G.pulseCells = [{ i: 9, j: 9 }];
      gb.textContent = "動かすと最後のリングが崩れるので、UIでは青丸が出ません。②リング全体（中央の空マス）を選ぼう。";
      render();
      setCoachMarks([
        { getEl: () => cellEl(info.i, info.j), text: "動かすと負けるので<br>青丸が出ない", prefer: 'bottom' },
        { getEl: () => cellEl(9, 9), text: "②リング全体を選ぼう", prefer: 'top' },
      ]);
      return;
    }
    // リング全体(中央の空マス)を選択 → リングごと崩さず動かせる。白リングを崩す手へ誘導。
    TS.ringMoveSeen = true;
    const dest = ringWinDest();
    G.pulseCells = dest ? [dest] : null;
    gb.textContent = "リング全体は崩れずに動ける！ この駒で白のリングに重ねて崩そう。";
    render(); // 青丸(G.legalMoves)は残して動かせるようにする
    if (dest) setCoach(() => cellEl(dest.i, dest.j), "ここへ動かして<br>白リングを崩そう！", 'auto');
    else hideCoach();
    return;
  }
  // 移動ステップ: 段階を進める
  updateTutorialCoach();
}

// なぜ選べないかの説明
function selectReason(i, j) {
  let own = 0, opp = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const ii = i + di, jj = j + dj;
    if (!onBoard(ii, jj)) continue;
    const v = G.board[ii][jj];
    if (v === G.current) own++;
    else if (v) opp++;
  }
  if (own > 0 && opp > 0) return "✗ 3×3に白が入っています。白を含まないように囲めば、その黒も選べます。";
  if (own === 0 && opp > 0) return "✗ それは相手の石。自分の色の駒しか選べません。";
  if (own === 0 && opp === 0) return "✗ 石がありません。石のある場所を選びましょう。";
  return "✗ 中央だけでは駒になりません。石の『となり』を中心にして囲んでみよう。";
}

// 黒リング(9,9)を動かして白リングを崩せる行き先を探す
function ringWinDest() {
  const p = analyze(G.board, 9, 9, 'B');
  if (!p.valid) return null;
  for (const m of legalMovesForPiece(G.board, 9, 9, p)) {
    const nb = cloneBoard(G.board);
    applyMove(nb, { i: 9, j: 9 }, p.stones, { i: m.i, j: m.j }, 'B');
    if (!hasRing(nb, 'W')) return { i: m.i, j: m.j };
  }
  return null;
}

// リング学習ステップ②: 盤を戻してリングを選択済みにし、白リング破壊へ再誘導
function resetRingLessonPhase2() {
  const step = TUTORIAL[TS.step];
  clearSelection();
  G.gameOver = false;
  G.hints = [];
  G.pulseCells = null;
  document.getElementById('banner').classList.remove('show');
  step.setup();
  G.frames = null;
  G.checkCells = null;
  G.lock = false;
  TS.ringStuckSeen = true;
  TS.ringMoveSeen = true;
  demoSelect(9, 9, 'B');
  const dest = ringWinDest();
  G.pulseCells = dest ? [dest] : null;
  document.getElementById('tGoal').textContent = "リング全体を、白のリングに重ねて崩そう！";
  render();
  if (dest) setCoach(() => cellEl(dest.i, dest.j), "ここへ動かして<br>白リングを崩そう！", 'auto');
}

// 着手したとき(移動ステップ)
function onTutorialMove() {
  const step = TUTORIAL[TS.step];
  if (!step.interactive || step.kind === 'select' || step.kind === 'frameall' || step.kind === 'coverall') return;
  if (step.kind === 'ringlesson') {
    const gb = document.getElementById('tGoal');
    // UIフィルタで自リング喪失手は出ないので、ここに来た時点で黒リングは生き残っているはず。
    if (!hasRing(G.board, 'W')) {
      // 白リングを崩した(勝ち)
      TS.done = true;
      G.lock = true;
      gb.textContent = "✓ リング全体は崩れずに動ける！ しかも相手のリングを崩して勝てる！";
      gb.classList.add('done');
      document.getElementById('tNext').disabled = false;
      hideCoach();
      render();
    } else {
      // 動かせたが白リングは無事 → 白リングを崩す手へ再誘導
      gb.textContent = "リングは動かせたね！ 今度は白のリングに重ねて崩そう…";
      G.lock = true;
      setTimeout(resetRingLessonPhase2, 800);
    }
    return;
  }
  if (step.goal()) {
    TS.done = true;
    const goalBox = document.getElementById('tGoal');
    goalBox.textContent = "✓ できました！ 「次へ」で進みましょう。";
    goalBox.classList.add('done');
    document.getElementById('tNext').disabled = false;
    G.lock = true;
    G.pulseCells = null;
    hideCoach();
    render();
  } else {
    const goalBox = document.getElementById('tGoal');
    goalBox.textContent = "おしい！ 光るマスに動かしてみよう。やり直します…";
    G.lock = true;
    setTimeout(softRetry, 800);
  }
}

// 誤った着手のあと: 盤を初期化しつつ駒は選択済み(②)に戻す(選択からやり直さない)
function softRetry() {
  const step = TUTORIAL[TS.step];
  clearSelection();
  G.gameOver = false;
  G.hints = [];
  G.pulseCells = null;
  document.getElementById('banner').classList.remove('show');
  step.setup();
  G.frames = step.frames || null;
  G.checkCells = null;
  G.lock = false;
  const piece = TS.lastPiece || step.pieceCell || (step.pieceCells && step.pieceCells[0]);
  if (piece) demoSelect(piece.i, piece.j, G.current);
  render();
  updateTutorialCoach();
}

document.getElementById('tPrev').addEventListener('click', () => { if (TS.step > 0) showStep(TS.step - 1); });
document.getElementById('tNext').addEventListener('click', () => { if (TS.step < TUTORIAL.length - 1) showStep(TS.step + 1); });
document.getElementById('tFinish').addEventListener('click', () => { exitTutorial(); showModePicker(true); });
document.getElementById('tQuit').addEventListener('click', () => { exitTutorial(); showModePicker(true); });
