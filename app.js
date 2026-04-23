let currentId   = null;
let currentMode = 'original';

/* ---- ストレージ ---- */
function getAll() {
  return JSON.parse(localStorage.getItem('memorize_texts') || '{}');
}
function setAll(data) {
  localStorage.setItem('memorize_texts', JSON.stringify(data));
}

/* ---- サイドバー描画 ---- */
function renderSidebar() {
  const saved = getAll();
  const el    = document.getElementById('thread-list');
  const keys  = Object.keys(saved).sort((a, b) => b - a);

  if (keys.length === 0) {
    el.innerHTML = '<div class="empty-sidebar">まだテキストがありません。<br>「＋ 新しいテキストを追加」から登録してください。</div>';
    return;
  }

  el.innerHTML = keys.map(id => {
    const item    = saved[id];
    const preview = item.text.replace(/\n/g, ' ').slice(0, 30) + (item.text.length > 30 ? '…' : '');
    return `<div class="thread-row" data-id="${id}">
      <div class="thread-delete-bg">
        <button class="thread-delete-btn" onclick="confirmDeleteFromSwipe('${id}')">
          <span>🗑</span><span>削除</span>
        </button>
      </div>
      <div class="thread-item${id === currentId ? ' active' : ''}" onclick="onThreadItemClick(event,'${id}')">
        <div class="thread-title">${esc(item.title)}</div>
        <div class="thread-preview">${esc(preview)}</div>
      </div>
    </div>`;
  }).join('');

  if (window.innerWidth <= 768) {
    initSwipeDelete();
    showSwipeDeleteHint();
  }
}

/* ---- スレッドアイテムクリック（スワイプ中は閉じるだけ） ---- */
function onThreadItemClick(e, id) {
  const row = e.currentTarget.closest('.thread-row');
  if (row && row.classList.contains('swiped')) {
    resetSwipedRow(row);
    return;
  }
  selectText(id);
}

/* ---- スワイプ削除：タッチイベント設定 ---- */
function initSwipeDelete() {
  document.querySelectorAll('.thread-row').forEach(row => {
    const item = row.querySelector('.thread-item');
    if (!item) return;
    let startX = 0, startY = 0, tracking = false, moved = false;

    item.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      moved = false;
      item.style.transition = 'none'; // ドラッグ中はアニメ無効
    }, { passive: true });

    item.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      // 縦スクロールと判断したら追跡終了
      if (!moved && dy > Math.abs(dx) && dy > 6) { tracking = false; snapRow(row); return; }
      if (Math.abs(dx) > 4) moved = true;
      // 現在の状態（開/閉）を基点にして移動量を加算し -72〜0 にクランプ
      const base = row.classList.contains('swiped') ? -72 : 0;
      item.style.transform = `translateX(${Math.max(-72, Math.min(0, base + dx))}px)`;
    }, { passive: true });

    item.addEventListener('touchend', e => {
      if (!tracking) return;
      tracking = false;
      if (!moved) { snapRow(row); return; } // 動いていない＝タップ → 現状維持（onclickに任せる）
      const dx = e.changedTouches[0].clientX - startX;
      if (row.classList.contains('swiped')) {
        // 開いている状態から右に20px以上スワイプ → 閉じる
        if (dx >= 20) resetSwipedRow(row); else openSwipedRow(row);
      } else {
        // 閉じている状態から左に30px以上スワイプ → 開く
        if (dx <= -30) openSwipedRow(row); else resetSwipedRow(row);
      }
    }, { passive: true });
  });

  /* サイドバー内の任意の場所をタッチしたら、他の開いている行を閉じる */
  document.getElementById('sidebar').addEventListener('touchstart', e => {
    const touchedRow = e.target.closest('.thread-row');
    document.querySelectorAll('.thread-row.swiped').forEach(r => {
      if (r !== touchedRow) resetSwipedRow(r);
    });
  }, { passive: true });
}

function openSwipedRow(row) {
  const item = row.querySelector('.thread-item');
  row.classList.add('swiped');
  item.style.transition = 'transform 0.2s ease';
  item.style.transform = 'translateX(-72px)';
}

function resetSwipedRow(row) {
  const item = row.querySelector('.thread-item');
  row.classList.remove('swiped');
  item.style.transition = 'transform 0.2s ease';
  item.style.transform = '';
}

function snapRow(row) {
  if (row.classList.contains('swiped')) openSwipedRow(row);
  else resetSwipedRow(row);
}

/* ---- 初回スワイプ削除ヒント ---- */
function showSwipeDeleteHint() {
  if (localStorage.getItem('swipe_delete_hinted')) return;
  const firstRow = document.querySelector('.thread-row');
  if (!firstRow) return;
  localStorage.setItem('swipe_delete_hinted', '1');
  setTimeout(() => {
    openSwipedRow(firstRow);
    setTimeout(() => resetSwipedRow(firstRow), 1200);
  }, 800);
}

/* ---- スワイプ削除確認 ---- */
function confirmDeleteFromSwipe(id) {
  const saved = getAll();
  const title = saved[id]?.title || 'このテキスト';
  if (!confirm(`「${title}」を削除しますか？\nこの操作は元に戻せません。`)) {
    const row = document.querySelector(`.thread-row[data-id="${id}"]`);
    if (row) resetSwipedRow(row);
    return;
  }
  delete saved[id];
  setAll(saved);
  if (currentId === id) {
    currentId = null;
    showForm();
  } else {
    renderSidebar();
  }
}

/* ---- 保存 ---- */
function saveText() {
  const title = document.getElementById('titleInput').value.trim();
  const text  = document.getElementById('textInput').value.trim();
  if (!title || !text) { alert('タイトルとテキストを入力してください'); return; }

  const saved = getAll();
  const id    = currentId && saved[currentId] ? currentId : Date.now().toString();
  saved[id]   = { id, title, text };
  setAll(saved);

  document.getElementById('titleInput').value = '';
  document.getElementById('textInput').value  = '';

  currentId = id;
  renderSidebar();
  selectText(id);
}

/* ---- テキスト選択 ---- */
function selectText(id) {
  currentId   = id;
  currentMode = 'original';
  document.querySelectorAll('.btn-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === 'original'));
  document.getElementById('view-form').style.display     = 'none';
  document.getElementById('view-practice').style.display = 'flex';

  const saved = getAll();
  document.getElementById('practice-title-text').textContent = saved[id].title;
  renderSidebar();
  renderText();
  closeSidebar();
}

/* ---- モバイル：サイドバー開閉 ---- */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen  = sidebar.classList.toggle('sidebar-open');
  overlay.classList.toggle('show', isOpen);
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('sidebar-open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ---- モバイル：スワイプジェスチャー ---- */
;(function() {
  /* ---- サイドバー：左端スワイプで開く ---- */
  let startX = 0, startY = 0, maySwipe = false;
  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    maySwipe = startX < 36; // 左端から開始した場合のみ追跡
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!maySwipe) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dy > 80) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('sidebar-open') && dx > 56) toggleSidebar();
    maySwipe = false;
  }, { passive: true });

  /* ---- オーバーレイ：タップのみ閉じる（スワイプは閉じない） ---- */
  const overlay = document.getElementById('sidebar-overlay');
  let ovX = 0, ovY = 0;
  overlay.addEventListener('touchstart', e => {
    ovX = e.touches[0].clientX;
    ovY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = Math.abs(e.changedTouches[0].clientX - ovX);
    const dy = Math.abs(e.changedTouches[0].clientY - ovY);
    if (dx < 12 && dy < 12) toggleSidebar(); // 小さい動き＝タップとみなして閉じる
  }, { passive: true });
})();

/* ---- 初回起動時：エッジハンドルを一瞬点灯してスワイプを示唆 ---- */
if (!localStorage.getItem('swipe_hinted') && window.innerWidth <= 768) {
  setTimeout(() => {
    const btn = document.getElementById('btn-hamburger');
    if (!btn) return;
    btn.style.transition = 'opacity 0.4s';
    btn.style.opacity = '0.9';
    setTimeout(() => {
      btn.style.opacity = '';
      localStorage.setItem('swipe_hinted', '1');
    }, 1800);
  }, 600);
}

/* ---- フォーム表示 ---- */
function showForm() {
  currentId = null;
  document.getElementById('titleInput').value = '';
  document.getElementById('textInput').value  = '';
  document.getElementById('view-form').style.display     = 'flex';
  document.getElementById('view-practice').style.display = 'none';
  closeSidebar();
  renderSidebar();
}

/* ---- 編集 ---- */
function editCurrent() {
  const saved = getAll();
  const item  = saved[currentId];
  if (!item) return;
  document.getElementById('titleInput').value = item.title;
  document.getElementById('textInput').value  = item.text;
  document.getElementById('view-form').style.display     = 'flex';
  document.getElementById('view-practice').style.display = 'none';
  document.body.classList.remove('reveal-mode'); // フローティングバーを隠す
  closeSidebar();
}

/* ---- 削除 ---- */
function deleteCurrent() {
  if (!confirm('このテキストを削除しますか？')) return;
  const saved = getAll();
  delete saved[currentId];
  setAll(saved);
  currentId = null;
  renderSidebar();
  showForm();
}

/* ---- モードバー 表示/非表示トグル ---- */
let modeBarVisible = true;

function toggleModeBar() {
  modeBarVisible = !modeBarVisible;
  applyModeBarVisibility();
}

function applyModeBarVisibility() {
  document.getElementById('mode-bar').style.display = modeBarVisible ? '' : 'none';
  const btn = document.getElementById('btn-modebar-toggle');
  if (!btn) return;
  btn.classList.toggle('bar-hidden', !modeBarVisible);
  btn.textContent = modeBarVisible ? '▴ モード' : '▾ モード';
  btn.title = modeBarVisible ? 'モードバーを隠す' : 'モードバーを表示';
}

/* ---- モード切り替え ---- */
function setMode(btn) {
  currentMode = btn.dataset.mode;
  document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const isTyping = currentMode === 'typing';
  document.getElementById('typing-bar').style.display   = isTyping ? 'flex' : 'none';
  document.getElementById('btn-rewind').style.display   = isTyping ? 'none' : '';
  document.getElementById('btn-forward').style.display  = isTyping ? 'none' : '';
  document.body.classList.toggle('typing-mode', isTyping);
  document.body.classList.toggle('reveal-mode', ['word','sentence','first'].includes(currentMode));
  // テストモード時はモードバーを自動で隠し、他のモードでは自動で表示する
  modeBarVisible = !isTyping;
  applyModeBarVisibility();
  renderText();
}

/* mousedownハンドラ：テストモード中はpreventDefaultしない（inputにフォーカスさせる） */
function handleBodyMousedown(e) {
  if (currentMode === 'typing') return;
  e.preventDefault();
}

/* ---- テキスト描画 ---- */
function renderText() {
  const saved = getAll();
  const text  = saved[currentId]?.text || '';
  const el    = document.getElementById('text-display');
  const hint  = document.getElementById('practice-hint');

  if (currentMode === 'typing') {
    renderTyping(text);
    return;
  }

  if (currentMode === 'original') {
    hint.textContent = '';
    el.innerHTML = text.split('\n').map(line =>
      isSection(line)
        ? renderSectionLabel(line)
        : `<div class="text-line"><span class="line-inner">${esc(line) || '&nbsp;'}</span></div>`
    ).join('');
    addLineAnchors(); buildToc();
    return;
  }

  hint.textContent = '画面をクリックすると上から順に開示されます';

  const tokens = buildTokens(text, currentMode);

  const lines = [[]];
  tokens.forEach((t, i) => {
    if (t.type === 'br') { lines.push([]); return; }
    lines[lines.length - 1].push({ ...t, idx: i });
  });

  el.innerHTML = lines.map(line => {
    if (line.length === 1 && line[0].type === 'section') {
      return renderSectionLabel('[' + line[0].value + ']');
    }
    const inner = line.map(t => {
      if (t.type === 'space') return esc(t.value);
      if (t.type === 'hint') return `<span class="token hint">${esc(t.value)}</span>`;
      if (t.type === 'word-hint') {
        const hiddenPart = t.rest
          ? `<span class="token hidden" data-idx="${t.idx}">${esc(t.rest)}</span>`
          : '';
        return `<span class="word-group"><span class="token hint">${esc(t.hint)}</span>${hiddenPart}</span>`;
      }
      return `<span class="token hidden" data-idx="${t.idx}">${esc(t.value)}</span>`;
    }).join('');
    return `<div class="text-line"><span class="line-inner">${inner || '&nbsp;'}</span></div>`;
  }).join('');

  markNextReveal();
  addLineAnchors(); buildToc();
}

/* ---- トークン生成 ---- */
function isSection(line) {
  return /^\[.+\]$/.test(line.trim());
}

function sectionName(line) {
  return line.trim().slice(1, -1);
}

function renderSectionLabel(line) {
  const name = sectionName(line);
  return `<div class="section-label" id="toc-anchor-${name}">
    <span class="section-badge">${esc(name)}</span>
    <span class="section-line"></span>
    <button class="btn-section-jump" onclick="jumpToSection(event, this)" data-section="${esc(name)}">ここから</button>
  </div>`;
}

function buildTokens(text, mode) {
  const tokens = [];

  if (mode === 'sentence') {
    text.split('\n').forEach((line, li) => {
      if (li > 0) tokens.push({ type: 'br' });
      if (isSection(line)) {
        tokens.push({ type: 'section', value: sectionName(line) });
      } else if (line.trim()) {
        tokens.push({ type: 'hide', value: line });
      }
    });
    return tokens;
  }

  if (mode === 'word') {
    text.split('\n').forEach((line, li) => {
      if (li > 0) tokens.push({ type: 'br' });
      if (isSection(line)) { tokens.push({ type: 'section', value: sectionName(line) }); return; }
      segmentLine(line).forEach(seg => {
        if (!seg.isWord) {
          tokens.push({ type: 'space', value: seg.value });
        } else {
          tokens.push({ type: 'hide', value: seg.value });
        }
      });
    });
    return tokens;
  }

  if (mode === 'first') {
    text.split('\n').forEach((line, li) => {
      if (li > 0) tokens.push({ type: 'br' });
      if (isSection(line)) { tokens.push({ type: 'section', value: sectionName(line) }); return; }
      if (!line.trim()) return;
      tokens.push({ type: 'word-hint', hint: line[0], rest: line.slice(1) });
    });
    return tokens;
  }

  return tokens;
}

/* ---- 単語分割（isWordフラグ付き） ---- */
const _segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('ja', { granularity: 'word' })
  : null;

function segmentLine(line) {
  if (_segmenter) {
    return [..._segmenter.segment(line)].map(seg => ({
      value:  seg.segment,
      isWord: seg.isWordLike || /^\d+$/.test(seg.segment),
    }));
  }
  return (line.match(/[a-zA-Z0-9]+|[\u3000-\u9fff\uff00-\uffef\u30a0-\u30ff\u3040-\u309f]+|[\s　]+|./g) || [])
    .map(v => ({ value: v, isWord: !v.match(/^[\s　\W]+$/) }));
}

function splitWords(line) {
  return segmentLine(line).map(s => s.value);
}

/* ---- 次に開示する要素をハイライト ---- */
function markNextReveal() {
  document.querySelectorAll('.token.hidden').forEach(el => el.classList.remove('next-reveal'));
  const next = document.querySelector('.token.hidden');
  if (next) next.classList.add('next-reveal');
  updateRewindBtn();
  if (['word', 'sentence', 'first'].includes(currentMode)) updateTocActive();
}

/* ---- トークン直接クリック→そこまでジャンプ ---- */
function jumpToToken(targetEl) {
  const all = [...document.querySelectorAll('.token.hidden')];
  const idx = all.indexOf(targetEl);
  if (idx < 0) return;
  all.slice(0, idx).forEach(el => {
    el.classList.remove('hidden', 'next-reveal');
    el.classList.add('revealed');
  });
  markNextReveal();
  scrollToNext();
}

/* ---- クリック／キーで順番開示 ---- */
function revealNext(e) {
  const t = e?.target;
  if (t?.classList.contains('token') && t.classList.contains('revealed')) {
    const all = [...document.querySelectorAll('.token.revealed')];
    const idx = all.indexOf(t);
    all.slice(idx).forEach(el => {
      el.classList.remove('revealed');
      el.classList.add('hidden');
    });
    markNextReveal();
    return;
  }
  if (t?.classList.contains('token') && t.classList.contains('hidden')) {
    jumpToToken(t);
    return;
  }
  const next = document.querySelector('.token.hidden');
  if (!next) return;
  next.classList.remove('hidden', 'next-reveal');
  next.classList.add('revealed');
  markNextReveal();
  scrollToNext();
}

/* ---- 進むボタン（1つ順番開示） ---- */
function forwardOne(e) {
  e.stopPropagation();
  const next = document.querySelector('.token.hidden');
  if (!next) return;
  next.classList.remove('hidden', 'next-reveal');
  next.classList.add('revealed');
  markNextReveal();
  scrollToNext();
  updateRewindBtn();
}

function scrollToNext() {
  const next = document.querySelector('.token.hidden.next-reveal');
  const body = document.getElementById('practice-body');
  if (!next || !body) return;
  const bodyRect = body.getBoundingClientRect();
  const nextRect = next.getBoundingClientRect();
  const targetY  = body.scrollTop + (nextRect.top - bodyRect.top) - body.clientHeight / 2;
  body.scrollTo({ top: targetY, behavior: 'smooth' });
}

/* テストモード用：指定行を practice-body 内で中央にスクロール */
function scrollLineToCenter(lineEl) {
  const body = document.getElementById('practice-body');
  if (!lineEl || !body) return;
  const bodyRect = body.getBoundingClientRect();
  const lineRect = lineEl.getBoundingClientRect();
  // モバイルは上1/4に配置（キーボードと被らないよう）、デスクトップは中央
  const ratio   = window.innerWidth <= 768 ? 0.06 : 0.5;
  const targetY = body.scrollTop + (lineRect.top - bodyRect.top) - body.clientHeight * ratio;
  body.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
}

/* ---- 1つ戻す ---- */
function rewindOne(e) {
  if (e) e.stopPropagation();
  const all  = [...document.querySelectorAll('.token.revealed')];
  const last = all[all.length - 1];
  if (!last) return;
  last.classList.remove('revealed');
  last.classList.add('hidden');
  markNextReveal();
  scrollToNext();
}

function updateRewindBtn() {
  const btn = document.getElementById('btn-rewind');
  if (!btn) return;
  btn.disabled = !document.querySelector('.token.revealed');
}

document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  const isPractice = document.getElementById('view-practice').style.display !== 'none';
  if (!isPractice || currentMode === 'original' || currentMode === 'typing') return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    revealNext();
  } else if (e.code === 'Backspace') {
    e.preventDefault();
    rewindOne(null);
  }
});

/* ---- セクション挿入（編集フォーム用） ---- */
function insertSection() {
  const ta    = document.getElementById('textInput');
  const pos   = ta.selectionStart;
  const text  = ta.value;
  const label = '[セクション名]';
  const before = pos > 0 && text[pos - 1] !== '\n' ? '\n' : '';
  const after  = pos < text.length && text[pos] !== '\n' ? '\n' : '';
  const insert = before + label + after;
  ta.value = text.slice(0, pos) + insert + text.slice(pos);
  const selectStart = pos + before.length + 1;
  const selectEnd   = selectStart + 'セクション名'.length;
  ta.focus();
  ta.setSelectionRange(selectStart, selectEnd);
}

/* ---- セクションジャンプ ---- */
function jumpToSection(e, btn) {
  e.stopPropagation();
  const sectionEl = btn.closest('.section-label');
  let next = sectionEl?.nextElementSibling;

  while (next) {
    const revealed = next.querySelector('.token.revealed');
    if (revealed) {
      const all = [...document.querySelectorAll('.token.revealed')];
      const idx = all.indexOf(revealed);
      all.slice(idx).forEach(el => {
        el.classList.remove('revealed');
        el.classList.add('hidden');
      });
      markNextReveal();
      return;
    }
    const hidden = next.querySelector('.token.hidden');
    if (hidden) { jumpToToken(hidden); return; }
    next = next.nextElementSibling;
  }
}

/* ========== テストモード ========== */
let typingSub      = 'seq';
let typingDone     = {};
let currentTypingIdx = 0;

function setTypingSub(btn) {
  typingSub = btn.dataset.sub;
  document.querySelectorAll('.btn-submode').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderText();
}

/* 文字数表示トグル */
let showCharCount = true;
function toggleCharCount(btn) {
  showCharCount = !showCharCount;
  document.body.classList.toggle('hide-charcount', !showCharCount);
  btn.classList.toggle('active', showCharCount);
  btn.textContent = showCharCount ? '文字数 表示' : '文字数 非表示';
}

/* ---- モバイル下部バー（隠しモード用） ---- */
function mobileBack(e) {
  rewindOne(e);
}

function mobileForward(e) {
  revealNext({ target: document.getElementById('practice-body') });
}

/* 文字数ラベル更新（現在入力数/目標文字数） */
function updateCharCount(idx, currentLen, totalLen) {
  const el = document.getElementById(`ccount-${idx}`);
  if (!el) return;
  el.textContent = `${currentLen}/${totalLen}文字`;
  el.classList.toggle('at-limit', currentLen >= totalLen);
}

function renderTyping(text) {
  const el   = document.getElementById('text-display');
  const hint = document.getElementById('practice-hint');
  typingDone = {};
  currentTypingIdx = 0;
  hint.innerHTML = typingSub === 'seq'
    ? '💡 入力して <kbd>次へ →</kbd> または <kbd>Enter 長押し</kbd> で確定 ／ 空欄で <kbd>BS 長押し</kbd> または <kbd>← 戻る</kbd> で前の行に戻れます'
    : '💡 全ての行を入力したら下の <kbd>答え合わせをする</kbd> を押してください';

  let lineIdx = 0;
  let html = text.split('\n').map(rawLine => {
    if (isSection(rawLine)) return renderSectionLabel(rawLine);
    if (!rawLine.trim()) return `<div style="height:0.8em"></div>`;
    const idx    = lineIdx++;
    const hidden = typingSub === 'seq' && idx > 0;
    const total  = rawLine.replace(/[\s　]/g, '').length;
    return `<div class="text-line typing-line" id="tline-${idx}" ${hidden ? 'style="display:none"' : ''}>
      <div class="typing-content">
        <div class="typing-original">${esc(rawLine)}</div>
        <div class="typing-input-row">
          <input class="typing-input" id="tinput-${idx}" type="text"
            placeholder="ここに入力…" autocomplete="off" spellcheck="false"
            data-original="${esc(rawLine)}" data-idx="${idx}" data-total="${total}">
          <span class="char-count" id="ccount-${idx}">0/${total}文字</span>
        </div>
        ${typingSub === 'seq' ? `
          <div class="typing-btns">
            ${idx > 0 ? `<button class="btn-back-line" onclick="backLine(${idx})">← 戻る</button>` : '<span class="typing-btn-spacer"></span>'}
            <button class="btn-next-line" id="tbtn-${idx}" onclick="submitLine(${idx})">次へ →</button>
          </div>
        ` : ''}
        <div class="typing-feedback" id="tfb-${idx}"></div>
      </div>
    </div>`;
  }).join('');

  if (typingSub === 'free') {
    html += `<div style="text-align:center;margin-top:20px;">
      <button id="free-action-btn" class="btn-save" style="width:auto;padding:10px 32px;" onclick="checkAllAnswers()">答え合わせをする</button>
    </div>`;
  }

  el.innerHTML = html;
  addLineAnchors(); buildToc();

  /* イベントリスナー設定 */
  document.querySelectorAll('.typing-input').forEach(input => {
    let holdTimer = null;
    let bsTimer   = null;
    const total   = +input.dataset.total;

    /* フォーカス時に入力欄を画面上寄りに配置 */
    input.addEventListener('focus', () => {
      requestAnimationFrame(() => {
        scrollLineToCenter(document.getElementById(`tline-${input.dataset.idx}`));
        updateTocActive();
      });
    });

    /* リアルタイム文字数更新（スペース除外） */
    input.addEventListener('input', () => {
      updateCharCount(+input.dataset.idx, input.value.replace(/[\s　]/g, '').length, total);
    });

    /* Enter長押し（600ms）で確定 */
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        if (typingSub !== 'seq') return;
        const btn = document.getElementById(`tbtn-${input.dataset.idx}`);
        if (btn) btn.classList.add('holding');
        holdTimer = setTimeout(() => {
          holdTimer = null;
          submitLine(+input.dataset.idx);
        }, 600);
        return;
      }
      /* Backspace長押し（600ms）で前行に戻る（入力が空の時のみ） */
      if (e.key === 'Backspace' && typingSub === 'seq') {
        if (input.value !== '') return;
        if (bsTimer) return;
        const idx = +input.dataset.idx;
        if (idx <= 0) return;
        const backBtn = document.getElementById(`tline-${idx}`)?.querySelector('.btn-back-line');
        if (backBtn) backBtn.classList.add('holding');
        bsTimer = setTimeout(() => {
          bsTimer = null;
          if (backBtn) backBtn.classList.remove('holding');
          backLine(idx);
        }, 600);
      }
    });

    input.addEventListener('keyup', e => {
      if (e.key === 'Enter') {
        clearTimeout(holdTimer);
        holdTimer = null;
        const btn = document.getElementById(`tbtn-${input.dataset.idx}`);
        if (btn) btn.classList.remove('holding');
      }
      if (e.key === 'Backspace') {
        clearTimeout(bsTimer);
        bsTimer = null;
        const idx = +input.dataset.idx;
        const backBtn = document.getElementById(`tline-${idx}`)?.querySelector('.btn-back-line');
        if (backBtn) backBtn.classList.remove('holding');
      }
    });
  });

  document.getElementById('tinput-0')?.focus({ preventScroll: true });
  updateTypingScore();
}

/* 単語列を取得（Intl.Segmenter使用） */
function getWords(text) {
  if (_segmenter) {
    return [..._segmenter.segment(text)]
      .filter(s => s.isWordLike)
      .map(s => s.segment);
  }
  return text.split(/[\s　]+/).filter(Boolean);
}

/* 1行確定（順番入力） */
function submitLine(idx) {
  const input = document.getElementById(`tinput-${idx}`);
  if (!input) return;
  typingDone[idx] = true;
  currentTypingIdx = idx + 1;
  updateFeedback(idx, input.dataset.original, input.value, true);
  document.querySelector(`#tline-${idx} .typing-original`)?.classList.add('revealed');
  const btn = document.getElementById(`tbtn-${idx}`);
  if (btn) { btn.style.display = 'none'; btn.classList.remove('holding'); }
  const backBtn = document.querySelector(`#tline-${idx} .btn-back-line`);
  if (backBtn) backBtn.style.display = 'none';
  updateTypingScore();
  const nextLine  = document.getElementById(`tline-${idx + 1}`);
  const nextInput = document.getElementById(`tinput-${idx + 1}`);
  if (nextLine) {
    nextLine.style.display = '';
    nextInput?.focus({ preventScroll: true });
    requestAnimationFrame(() => { scrollLineToCenter(nextLine); updateTocActive(); });
  } else {
    requestAnimationFrame(updateTocActive);
  }
}

/* 1行戻る（順番入力） */
function backLine(idx) {
  if (idx <= 0) return;
  currentTypingIdx = idx - 1;
  document.getElementById(`tline-${idx}`)?.style && (document.getElementById(`tline-${idx}`).style.display = 'none');
  const prevInput = document.getElementById(`tinput-${idx - 1}`);
  const prevLine  = document.getElementById(`tline-${idx - 1}`);
  if (!prevInput || !prevLine) return;
  delete typingDone[idx - 1];
  document.getElementById(`tfb-${idx - 1}`).innerHTML = '';
  prevInput.classList.remove('line-correct', 'line-wrong');
  document.querySelector(`#tline-${idx - 1} .typing-original`)?.classList.remove('revealed');
  const btn = document.getElementById(`tbtn-${idx - 1}`);
  if (btn) btn.style.display = '';
  const backBtn = document.querySelector(`#tline-${idx - 1} .btn-back-line`);
  if (backBtn) backBtn.style.display = '';
  /* 文字数表示を現在値に合わせて更新 */
  updateCharCount(idx - 1, prevInput.value.replace(/[\s　]/g, '').length, +prevInput.dataset.total);
  prevInput.focus({ preventScroll: true });
  const len = prevInput.value.length;
  prevInput.setSelectionRange(len, len);
  requestAnimationFrame(() => { scrollLineToCenter(prevLine); updateTocActive(); });
  updateTypingScore();
}

/* 自由入力：まとめて答え合わせ */
function checkAllAnswers() {
  document.querySelectorAll('.typing-input').forEach(input => {
    const idx = +input.dataset.idx;
    typingDone[idx] = true;
    updateFeedback(idx, input.dataset.original, input.value, true);
    document.querySelector(`#tline-${idx} .typing-original`)?.classList.add('revealed');
  });
  updateTypingScore();
  document.getElementById('practice-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  const btn = document.getElementById('free-action-btn');
  if (btn) { btn.textContent = 'もう一回'; btn.onclick = retryFreeMode; }
}

/* 自由入力：やり直し */
function retryFreeMode() {
  typingDone = {};
  document.querySelectorAll('.typing-input').forEach(input => {
    const idx = +input.dataset.idx;
    input.value = '';
    input.classList.remove('line-correct', 'line-wrong');
    document.getElementById(`tfb-${idx}`).innerHTML = '';
    document.querySelector(`#tline-${idx} .typing-original`)?.classList.remove('revealed');
    updateCharCount(idx, 0, +input.dataset.total);
  });
  updateTypingScore();
  const btn = document.getElementById('free-action-btn');
  if (btn) { btn.textContent = '答え合わせをする'; btn.onclick = checkAllAnswers; }
  document.querySelector('.typing-input')?.focus({ preventScroll: true });
}

/* フィードバック表示 */
function updateFeedback(idx, original, input, finalized = false) {
  const fbEl    = document.getElementById(`tfb-${idx}`);
  const inputEl = document.getElementById(`tinput-${idx}`);
  if (!fbEl) return;

  const origWords  = getWords(original);
  const inputWords = getWords(input);

  let html = '';
  let allCorrect = true;

  origWords.forEach((ow, i) => {
    const iw = inputWords[i];
    if (iw === undefined) {
      html += `<span class="tw tw-pending">${esc(ow)}</span>`;
      allCorrect = false;
    } else if (iw === ow) {
      html += `<span class="tw tw-correct">${esc(ow)}</span>`;
    } else {
      html += `<span class="tw tw-wrong" title="入力: ${esc(iw)}">${esc(ow)}</span>`;
      allCorrect = false;
    }
  });

  inputWords.slice(origWords.length).forEach(iw => {
    html += `<span class="tw tw-extra">${esc(iw)}</span>`;
    allCorrect = false;
  });

  fbEl.innerHTML = html;

  if (inputEl && finalized) {
    inputEl.classList.toggle('line-correct', allCorrect);
    inputEl.classList.toggle('line-wrong', !allCorrect);
  }
}

/* スコア更新 */
function updateTypingScore() {
  const scoreEl = document.getElementById('typing-score');
  if (!scoreEl) return;
  const inputs = [...document.querySelectorAll('.typing-input')];
  if (!inputs.length) { scoreEl.textContent = ''; return; }

  let correct = 0, total = 0;
  inputs.forEach(input => {
    const origWords  = getWords(input.dataset.original || '');
    const inputWords = getWords(input.value);
    total   += origWords.length;
    origWords.forEach((ow, i) => { if (inputWords[i] === ow) correct++; });
  });

  const pct = total ? Math.round(correct / total * 100) : 0;
  scoreEl.innerHTML = `<span class="score-num">${correct}/${total}語</span> 正解 (${pct}%)`;
}

/* ========== セッション目次（TOC） ========== */

/* 全 .text-line に data-toc-anchor を付番 */
function addLineAnchors() {
  let i = 0;
  document.querySelectorAll('#text-display .text-line').forEach(el => {
    el.dataset.tocAnchor = i++;
  });
}

function buildToc() {
  const tocEl = document.getElementById('toc-panel');
  if (!tocEl) return;

  const saved = getAll();
  const text  = saved[currentId]?.text || '';
  const lines = text.split('\n');
  const hasSections = lines.some(l => isSection(l));

  /* TOC項目を構築 */
  const items = [{ label: '▲ 先頭', anchor: '__top__', cls: 'toc-top' }];

  if (hasSections) {
    lines.forEach(line => {
      if (!isSection(line)) return;
      const name = sectionName(line);
      items.push({ label: name, anchor: `toc-anchor-${name}`, cls: 'toc-section', useId: true });
    });
  } else {
    const total = document.querySelectorAll('#text-display .text-line').length;
    const step  = total <= 15 ? 5 : total <= 40 ? 10 : 20;
    for (let i = 0; i < total; i += step) {
      const end = Math.min(i + step - 1, total - 1);
      items.push({ label: `${i + 1}〜${end + 1}行`, anchor: String(i), cls: 'toc-lines' });
    }
  }

  tocEl.innerHTML = items.map(it =>
    `<div class="toc-item ${it.cls}" data-anchor="${esc(it.anchor)}">${esc(it.label)}</div>`
  ).join('');

  /* クリックでジャンプ */
  tocEl.querySelectorAll('.toc-item').forEach(el => {
    el.addEventListener('click', () => {
      const anchor = el.dataset.anchor;
      const body   = document.getElementById('practice-body');
      if (!body) return;
      if (anchor === '__top__') { body.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const target = document.getElementById(anchor)
        ?? document.querySelector(`#text-display .text-line[data-toc-anchor="${anchor}"]`);
      if (!target) return;
      const bodyRect   = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      body.scrollTo({ top: body.scrollTop + (targetRect.top - bodyRect.top) - 24, behavior: 'smooth' });
    });
  });

  /* スクロール追跡 */
  const body = document.getElementById('practice-body');
  if (body) {
    body.addEventListener('scroll', updateTocActive); // 同一関数は重複登録されない
    requestAnimationFrame(updateTocActive);
  }
}

function updateTocActive() {
  const tocEl = document.getElementById('toc-panel');
  const body  = document.getElementById('practice-body');
  if (!tocEl || !body) return;

  let activeAnchor = '__top__';

  if (currentMode === 'typing' && typingSub === 'free') {
    /* 自由入力：フォーカス中の入力欄が属するセクションをアクティブに */
    const focused = document.activeElement;
    const currentLine = focused?.classList.contains('typing-input')
      ? focused.closest('.typing-line') : null;
    if (currentLine) {
      let node = currentLine.previousElementSibling;
      while (node) {
        if (node.classList.contains('section-label') && node.id) {
          activeAnchor = node.id;
          break;
        }
        node = node.previousElementSibling;
      }
    }
  } else if (currentMode === 'typing' && typingSub === 'seq') {
    /* 順番入力：現在表示中の入力行が属するセクションをアクティブに */
    let currentLine = null;
    for (const el of document.querySelectorAll('.typing-line')) {
      if (el.style.display !== 'none') currentLine = el; // 最後の表示中行が現在の入力欄
    }
    if (currentLine) {
      let node = currentLine.previousElementSibling;
      while (node) {
        if (node.classList.contains('section-label') && node.id) {
          activeAnchor = node.id;
          break;
        }
        node = node.previousElementSibling;
      }
    }
  } else if (['word', 'sentence', 'first'].includes(currentMode)) {
    /* 隠しモード：次に開示されるトークンが属するセクションをアクティブに */
    const nextToken = document.querySelector('.token.next-reveal');
    if (nextToken) {
      const textLine = nextToken.closest('.text-line');
      if (textLine) {
        let node = textLine.previousElementSibling;
        while (node) {
          if (node.classList.contains('section-label') && node.id) {
            activeAnchor = node.id;
            break;
          }
          node = node.previousElementSibling;
        }
      }
    } else {
      // 全部開示済み → 最後のセクションをアクティブに
      const lastItem = tocEl.querySelector('.toc-item:not(.toc-top):last-child');
      if (lastItem) activeAnchor = lastItem.dataset.anchor;
    }
  } else {
    /* 通常モード：スクロール位置ベース */
    const refY = body.getBoundingClientRect().top + 80;

    tocEl.querySelectorAll('.toc-item:not(.toc-top)').forEach(el => {
      const anchor = el.dataset.anchor;
      const target = document.getElementById(anchor)
        ?? document.querySelector(`#text-display .text-line[data-toc-anchor="${anchor}"]`);
      if (target && target.getBoundingClientRect().top <= refY) activeAnchor = anchor;
    });

    /* スクロール最下部では最終セクションをアクティブに */
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 16;
    if (atBottom) {
      const lastItem = tocEl.querySelector('.toc-item:not(.toc-top):last-child');
      if (lastItem) activeAnchor = lastItem.dataset.anchor;
    }
  }

  let foundActive = false;
  tocEl.querySelectorAll('.toc-item').forEach(el => {
    const isActive = el.dataset.anchor === activeAnchor;
    const isTop    = el.classList.contains('toc-top');
    el.classList.remove('toc-active', 'toc-passed');
    if (isActive) {
      el.classList.add('toc-active');
      foundActive = true;
    } else if (!foundActive && !isTop) {
      el.classList.add('toc-passed');
    }
  });

  /* アクティブ項目をTOCパネル内で見える位置にスクロール */
  const activeEl = tocEl.querySelector('.toc-item.toc-active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- テーマ ---- */
function setTheme(theme) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('memorize_theme', theme);
  document.querySelectorAll('.swatch').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === theme)
  );
}

/* ---- デフォルトサンプル（初回起動時のみ挿入） ---- */
function insertDefaultSample() {
  const saved = getAll();
  if (Object.keys(saved).length > 0) return;
  saved['1000000000000'] = {
    title: '芭蕉の俳句（サンプル）',
    text: [
      '[春]',
      '古池や 蛙飛び込む 水の音',
      '山路来て 何やらゆかし すみれ草',
      '',
      '[夏]',
      '夏草や 兵どもが 夢の跡',
      '閑かさや 岩にしみ入る 蝉の声',
      '',
      '[秋]',
      '荒海や 佐渡に横たふ 天の河',
      'この道や 行く人なしに 秋の暮れ',
      '',
      '[冬]',
      '旅に病んで 夢は枯野を かけ廻る',
    ].join('\n')
  };
  setAll(saved);
}

/* ---- モードバーのテストボタンをわずかにチラ見えさせる（モバイルのみ） ---- */
function initModeBarPeek() {
  if (window.innerWidth > 768) return;
  const bar = document.getElementById('mode-bar');
  const testBtn = bar?.querySelector('[data-mode="typing"]');
  if (!bar || !testBtn) return;
  requestAnimationFrame(() => {
    const barRect  = bar.getBoundingClientRect();
    const btnRect  = testBtn.getBoundingClientRect();
    const overflow = btnRect.right - barRect.right; // テスト右端がバーからはみ出す量
    if (overflow > 0) bar.scrollLeft = Math.max(0, overflow - 20); // 20px チラ見えになる位置
  });
}

/* ---- 初期化 ---- */
const savedTheme = localStorage.getItem('memorize_theme') || 'default';
setTheme(savedTheme);
const isFirstLaunch = Object.keys(getAll()).length === 0;
insertDefaultSample();
renderSidebar();
if (isFirstLaunch) selectText('1000000000000');
initModeBarPeek();
