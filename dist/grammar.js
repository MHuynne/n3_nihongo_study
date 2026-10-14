'use strict';

(() => {
  const baseRender = render;
  const baseEdit = edit;
  const baseNormalizeRows = normalizeRows;
  const baseQuizHTML = quizHTML;
  const baseFiltered = filtered;
  const baseGo = go;
  let activeDeckFolder = '';
  let activeDeckName = '';
  let activeStudySet = null;
  let flashcardSets = [];

  menus.push(['grammar', '文', 'Ngữ pháp']);
  menus.push(['sets', '▦', 'Bộ flashcard']);

  normalizeRows = function (rows, name) {
    if (!rows.length) return { items: [], skipped: 0 };
    const normalize = (value) => String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
    const aliases = {
      bai: ['bai', 'bài', 'bài học', 'lesson'],
      loai: ['loai', 'loại', 'phân môn', 'category'],
      tieng_nhat: ['tieng_nhat', 'tiếng nhật', 'term', 'từ', 'mẫu ngữ pháp'],
      cach_doc: ['cach_doc', 'cách đọc', 'reading', 'furigana'],
      han_viet: ['han_viet', 'hán việt', 'hanviet'],
      nghia: ['nghia', 'nghĩa', 'meaning', 'giải thích'],
      vi_du: ['vi_du', 'ví dụ', 'example', 'câu ví dụ'],
      dich_vi_du: ['dich_vi_du', 'dịch ví dụ', 'translation'],
      structure: ['cong_thuc', 'công thức', 'structure', 'formula'],
      usage: ['cach_dung', 'cách dùng', 'usage'],
      context: ['ngu_canh', 'ngữ cảnh', 'context'],
      jlpt_note: ['luu_y_jlpt', 'lưu ý jlpt', 'jlpt_note', 'jlpt note'],
      study_note: ['ghi_chu_vo', 'ghi chú vở', 'study_note', 'ghi chú'],
      deck_folder: ['thu_muc', 'thư mục', 'folder', 'chủ đề'],
      deck_name: ['bo_flashcard', 'bộ flashcard', 'deck', 'tên bộ', 'ten_bo']
    };
    const header = rows[0].map(normalize);
    const columns = Object.fromEntries(
      Object.entries(aliases).map(([key, names]) => [key, header.findIndex((value) => names.includes(value))])
    );
    if (columns.tieng_nhat < 0 || columns.nghia < 0) {
      return { items: [], skipped: rows.length - 1 };
    }

    const items = [];
    let skipped = 0;
    for (const row of rows.slice(1)) {
      const value = (key) => columns[key] < 0 ? '' : String(row[columns[key]] ?? '').trim();
      if (!row.some((cell) => String(cell || '').trim())) continue;
      const term = value('tieng_nhat');
      const meaning = value('nghia');
      const category = value('loai') || cats[0];
      if (!term || !meaning || !cats.includes(category)) {
        skipped++;
        continue;
      }
      items.push({
        id: crypto.randomUUID(),
        term,
        meaning,
        reading: value('cach_doc'),
        hanviet: value('han_viet'),
        lesson: value('bai') || name,
        category,
        example: value('vi_du'),
        translation: value('dich_vi_du'),
        structure: value('structure'),
        usage: value('usage'),
        context: value('context'),
        jlpt_note: value('jlpt_note'),
        study_note: value('study_note'),
        deck_folder: value('deck_folder') || activeDeckFolder,
        deck_name: value('deck_name') || activeDeckName
      });
    }
    return { items, skipped };
  };

  function grammarItems() {
    return data.filter((item) =>
      item.category === 'Ngữ pháp' &&
      (!lesson || item.lesson === lesson) &&
      (!query || [item.term, item.meaning, item.example, item.usage].join(' ').toLowerCase().includes(query.toLowerCase()))
    );
  }

  function grammarPage() {
    const items = grammarItems();
    return `<div class="filters">
      <select onchange="lesson=this.value;render()">
        <option value="">Tất cả bài ngữ pháp</option>
        ${[...new Set(data.filter((item) => item.category === 'Ngữ pháp').map((item) => item.lesson))]
          .map((itemLesson) => `<option value="${esc(itemLesson)}" ${lesson === itemLesson ? 'selected' : ''}>${esc(itemLesson)}</option>`).join('')}
      </select>
      <input type="search" placeholder="Tìm mẫu, cách dùng, ví dụ…" value="${esc(query)}"
        onchange="query=this.value;render()">
      <button onclick="category='Ngữ pháp';go('quiz')">Tạo quiz ngữ pháp →</button>
      <button onclick="go('import')">＋ Nhập mẫu từ XLSX</button>
    </div>
    <p>${items.length} mẫu ngữ pháp</p>
    ${items.length ? items.map((item) => `<article class="card grammar-card">
      <div class="row between"><div><span class="badge">${esc(item.lesson)}</span>
        <h2 class="jp">${esc(item.term)}</h2></div>
        <button onclick="edit('${item.id}')">Sửa bài</button>
      </div>
      <p><b>Ý nghĩa:</b> ${esc(item.meaning)}</p>
      ${item.structure ? `<p><b>Công thức:</b> <span class="jp">${esc(item.structure)}</span></p>` : ''}
      ${item.usage ? `<p><b>Cách dùng:</b> ${esc(item.usage)}</p>` : ''}
      ${item.context ? `<p><b>Ngữ cảnh:</b> ${esc(item.context)}</p>` : ''}
      ${item.example ? `<p><b>Ví dụ:</b> <span class="jp">${esc(item.example)}</span></p>` : ''}
      ${item.translation ? `<p><b>Dịch:</b> ${esc(item.translation)}</p>` : ''}
      ${item.jlpt_note ? `<p class="notice"><b>Lưu ý JLPT:</b> ${esc(item.jlpt_note)}</p>` : ''}
      <form onsubmit="saveGrammarNote(event,'${item.id}')">
        <label>Ghi chép của bạn (lưu cùng tài khoản)
          <textarea name="study_note" maxlength="4000" placeholder="Chép lại công thức, cách chia và mẹo phân biệt…">${esc(item.study_note)}</textarea>
        </label>
        <p class="row"><button class="primary">Lưu ghi chép</button>
          <button type="button" onclick="startGrammarCards('${item.id}')">Học flashcard</button>
          <button type="button" onclick="startGrammarQuiz('${item.id}')">Quiz bài này</button></p>
      </form>
    </article>`).join('') : '<div class="empty">Chưa có mẫu ngữ pháp phù hợp. Hãy nhập XLSX/CSV có cột loai là “Ngữ pháp”.</div>'}
    <div class="notice">Tài liệu JLPT này là ghi chú tự học từ nội dung bạn nhập, không phải đề thi hay đáp án chính thức.</div>`;
  }

  function rebuildFlashcardSets() {
    const sets = new Map();
    for (const item of data) {
      const folder = item.deck_folder || 'Chưa xếp bộ';
      const name = item.deck_name || 'Thẻ cũ / chưa xếp';
      const key = `${folder}\u0000${name}`;
      if (!sets.has(key)) sets.set(key, { folder, name, items: [] });
      sets.get(key).items.push(item);
    }
    flashcardSets = [...sets.values()];
  }

  function flashcardSetsPage() {
    rebuildFlashcardSets();
    const folders = new Map();
    for (const set of flashcardSets) {
      if (!folders.has(set.folder)) folders.set(set.folder, []);
      folders.get(set.folder).push(set);
    }
    return `<section class="card">
      <span class="badge">TẠO BỘ FLASHCARD</span>
      <h2>Nhập file và xếp thẻ vào thư mục</h2>
      <p>Đặt tên chủ đề/thư mục và tên bộ thẻ. Một file XLSX có thể tạo riêng một bộ; nhập lại vào cùng tên để bổ sung thẻ.</p>
      <form id="flashcard-set-form">
        <div class="formgrid">
          <label>Thư mục / chủ đề
            <input id="flashcard-folder" required maxlength="120" placeholder="Ví dụ: Ngữ pháp N3" value="${esc(activeDeckFolder)}">
          </label>
          <label>Tên bộ flashcard
            <input id="flashcard-deck" required maxlength="120" placeholder="Ví dụ: Bài 01 · Mẫu câu" value="${esc(activeDeckName)}">
          </label>
        </div>
        <p><label>Chọn file XLSX / CSV / TSV
          <input id="flashcard-file" type="file" accept=".xlsx,.csv,.tsv" required
            onchange="loadFlashcardSetFile(this.files[0])">
        </label></p>
      </form>
      <div id="preview"></div>
      <p class="muted">File dùng cột từ mẫu Excel hiện tại. Có thể thêm cột thu_muc/folder và bo_flashcard/deck; nếu để trống các cột này thì tên ở biểu mẫu được dùng. Có thể đặt loại là “Ngữ pháp” để nhập bộ thẻ ngữ pháp.</p>
      <a class="button" href="Mau_nhap_N3.xlsx" download>↓ Tải mẫu XLSX</a>
    </section>
    ${folders.size ? [...folders.entries()].map(([folder, sets]) => `<section class="deck-folder">
      <h2>📁 ${esc(folder)}</h2>
      <div class="grid">${sets.map((set) => {
        const index = flashcardSets.indexOf(set);
        return `<article class="card">
          <span class="badge">${set.items.length} thẻ</span>
          <h3>${esc(set.name)}</h3>
          <p>${esc([...new Set(set.items.map((item) => item.category))].join(' · '))}</p>
          <button class="primary" onclick="startFlashcardSet(${index})">Học bộ này →</button>
        </article>`;
      }).join('')}</div>
    </section>`).join('') : '<div class="empty">Chưa có bộ flashcard. Đặt tên thư mục và bộ ở trên rồi chọn file để bắt đầu.</div>'}`;
  }

  window.loadFlashcardSetFile = function (file) {
    const folder = $('#flashcard-folder').value.trim();
    const name = $('#flashcard-deck').value.trim();
    if (!folder || !name) return toast('Nhập tên thư mục và tên bộ flashcard trước.');
    activeDeckFolder = folder;
    activeDeckName = name;
    return loadFile(file);
  };

  window.startFlashcardSet = function (index) {
    rebuildFlashcardSets();
    const selected = flashcardSets[index];
    if (!selected) return toast('Không tìm thấy bộ flashcard.');
    activeStudySet = { folder: selected.folder, name: selected.name };
    lesson = '';
    category = '';
    query = '';
    onlyWeak = false;
    deck = selected.items;
    idx = 0;
    flipped = false;
    view = 'flash';
    render();
  };

  go = function (nextView) {
    if (nextView !== 'flash') activeStudySet = null;
    baseGo(nextView);
  };

  filtered = function () {
    const items = baseFiltered();
    if (!activeStudySet) return items;
    return items.filter((item) =>
      (item.deck_folder || 'Chưa xếp bộ') === activeStudySet.folder &&
      (item.deck_name || 'Thẻ cũ / chưa xếp') === activeStudySet.name
    );
  };

  function grammarFlashBack() {
    const card = document.querySelector('.flash');
    const item = deck[idx];
    if (!card || !flipped || item?.category !== 'Ngữ pháp') return;
    const extra = document.createElement('section');
    extra.className = 'grammar-back';
    const fields = [
      ['Công thức', item.structure],
      ['Cách dùng', item.usage],
      ['Ngữ cảnh', item.context],
      ['Lưu ý JLPT', item.jlpt_note],
      ['Ghi chép', item.study_note]
    ];
    extra.innerHTML = fields.filter(([, value]) => value)
      .map(([label, value]) => `<p><b>${label}:</b> ${esc(value)}</p>`).join('');
    if (extra.childElementCount) card.append(extra);
  }

  render = function () {
    if (view === 'sets') {
      $('#nav').innerHTML = menus.map(([key, icon, title]) =>
        `<button class="${key === view ? 'active' : ''}" onclick="go('${key}')">${icon} &nbsp; ${title}</button>`
      ).join('');
      $('#title').textContent = 'Bộ flashcard';
      $('#app').innerHTML = flashcardSetsPage();
      return;
    }
    if (view === 'grammar') {
      $('#nav').innerHTML = menus.map(([key, icon, title]) =>
        `<button class="${key === view ? 'active' : ''}" onclick="go('${key}')">${icon} &nbsp; ${title}</button>`
      ).join('');
      $('#title').textContent = 'Học ngữ pháp N3';
      $('#app').innerHTML = grammarPage();
      return;
    }
    baseRender();
    if (view === 'flash') grammarFlashBack();
    if (view === 'quiz' && !quiz && category === 'Ngữ pháp') {
      const row = document.querySelector('#qmode')?.parentElement;
      if (row) {
        const button = document.createElement('button');
        button.className = 'primary';
        button.textContent = 'Quiz: ví dụ → mẫu ngữ pháp';
        button.onclick = () => startGrammarQuiz();
        row.append(button);
      }
    }
  };

  edit = function (id) {
    const item = data.find((entry) => entry.id === id);
    if (item?.category !== 'Ngữ pháp') return baseEdit(id);
    $('#app').innerHTML = `<div class="card"><h2>Soạn bài ngữ pháp</h2>
      <form id="grammar-edit"><div class="formgrid">
        <label>Mẫu ngữ pháp<input name="term" required maxlength="500" value="${esc(item.term)}"></label>
        <label>Ý nghĩa / giải thích<input name="meaning" required maxlength="4000" value="${esc(item.meaning)}"></label>
        <label>Bài học<input name="lesson" required maxlength="200" value="${esc(item.lesson)}"></label>
        <label>Cách đọc<input name="reading" maxlength="4000" value="${esc(item.reading)}"></label>
        <label>Công thức chia<textarea name="structure" maxlength="4000">${esc(item.structure)}</textarea></label>
        <label>Cách dùng<textarea name="usage" maxlength="4000">${esc(item.usage)}</textarea></label>
        <label>Ngữ cảnh phù hợp<textarea name="context" maxlength="4000">${esc(item.context)}</textarea></label>
        <label>Ví dụ tiếng Nhật<textarea name="example" maxlength="4000">${esc(item.example)}</textarea></label>
        <label>Dịch ví dụ<textarea name="translation" maxlength="4000">${esc(item.translation)}</textarea></label>
        <label>Lưu ý khi thi JLPT<textarea name="jlpt_note" maxlength="4000">${esc(item.jlpt_note)}</textarea></label>
        <label>Ghi chép để chép vào vở<textarea name="study_note" maxlength="4000">${esc(item.study_note)}</textarea></label>
      </div><p><button class="primary">Lưu bài học</button>
        <button type="button" onclick="go('grammar')">Hủy</button></p></form></div>`;
    $('#grammar-edit').onsubmit = (event) => {
      event.preventDefault();
      Object.assign(item, Object.fromEntries(new FormData(event.currentTarget)));
      save();
      go('grammar');
      toast('Đã lưu bài ngữ pháp.');
    };
  };

  window.saveGrammarNote = function (event, id) {
    event.preventDefault();
    const item = data.find((entry) => entry.id === id);
    if (!item) return toast('Không tìm thấy mẫu ngữ pháp.');
    item.study_note = new FormData(event.currentTarget).get('study_note') || '';
    save();
    toast('Đã lưu ghi chép ngữ pháp.');
  };

  window.startGrammarCards = function (id) {
    const item = data.find((entry) => entry.id === id);
    if (!item) return toast('Không tìm thấy mẫu ngữ pháp.');
    category = 'Ngữ pháp';
    lesson = item.lesson;
    view = 'flash';
    onlyWeak = false;
    deck = data.filter((entry) => entry.category === 'Ngữ pháp' && entry.lesson === item.lesson);
    idx = deck.findIndex((entry) => entry.id === id);
    flipped = false;
    render();
  };

  window.startGrammarQuiz = function (id = '') {
    const selected = data.find((item) => item.id === id);
    const pool = grammarItems().filter((item) =>
      item.example && (!selected || item.lesson === selected.lesson)
    );
    if (pool.length < 2 || new Set(pool.map((item) => item.term)).size < 2) {
      return toast('Quiz cần ít nhất 2 mẫu ngữ pháp khác nhau, mỗi mẫu có ví dụ tiếng Nhật.');
    }
    quiz = {
      mode: 'grammar',
      field: 'term',
      pool,
      items: shuffle(pool).slice(0, Math.min(pool.length, 10)),
      pos: 0,
      score: 0,
      wrong: [],
      answered: false,
      finished: false,
      timed: false
    };
    prepareQ();
    view = 'quiz';
    render();
  };

  quizHTML = function () {
    if (!quiz || quiz.mode !== 'grammar') return baseQuizHTML();
    if (quiz.finished) {
      return `<div class="card center"><span class="badge">QUIZ NGỮ PHÁP</span>
        <h2>${quiz.score} / ${quiz.items.length} câu đúng</h2>
        <p>${quiz.wrong.length} câu cần ôn lại.</p>
        <button class="primary" onclick="retryWrong()">Làm lại câu sai</button>
        <button onclick="go('grammar')">Về bài ngữ pháp</button></div>
        ${quiz.wrong.map((item) => `<div class="card"><b>${esc(item.term)}</b>
          <p class="jp">${esc(item.example)}</p><p>${esc(item.meaning)}</p>
          <p>${esc(item.jlpt_note)}</p></div>`).join('')}`;
    }
    const item = quiz.items[quiz.pos];
    return `<div class="row between"><p>Quiz ngữ pháp · câu ${quiz.pos + 1}/${quiz.items.length}</p>
      <span>${quiz.score} đúng</span></div>
      <div class="progress"><div style="width:${quiz.pos / quiz.items.length * 100}%"></div></div>
      <div class="card"><small>ĐỌC VÍ DỤ, CHỌN MẪU NGỮ PHÁP</small>
        <h2 class="jp">${esc(item.example)}</h2><p>${esc(item.translation)}</p>
        ${quiz.options.map((option, index) => `<button class="answer ${
          quiz.answered ? (option === item.term ? 'correct' : quiz.chosen === index ? 'wrong' : '') : ''
        }" ${quiz.answered ? 'disabled' : ''} onclick="answer(${index})">
          ${String.fromCharCode(65 + index)}. ${esc(option)}</button>`).join('')}
        ${quiz.answered ? `<p><b>${quiz.correct ? 'Chính xác!' : 'Cần ôn lại.'}</b>
          <span class="jp">${esc(item.structure)}</span><br>${esc(item.usage)}<br>
          ${esc(item.context)}<br>${esc(item.jlpt_note)}</p>
          <button class="primary" onclick="nextQ()">${quiz.pos + 1 === quiz.items.length ? 'Xem kết quả' : 'Câu tiếp →'}</button>` : ''}
      </div>`;
  };

  const importHTMLBase = importHTML;
  importHTML = function () {
    return importHTMLBase().replace(
      'Cột: bai, loai, tieng_nhat, cach_doc, han_viet, nghia, vi_du, dich_vi_du.',
      'Cột: bai, loai, tieng_nhat, cach_doc, han_viet, nghia, vi_du, dich_vi_du, cong_thuc, cach_dung, ngu_canh, luu_y_jlpt, ghi_chu_vo.'
    ).replace(
      'Cần tiếng Nhật và nghĩa.',
      'Đặt loai=Ngữ pháp và nhập một mẫu mỗi dòng; các cột công thức/cách dùng/ngữ cảnh/lưu ý JLPT/ghi chú vở là tùy chọn. Cần tiếng Nhật và nghĩa.'
    ).replace(
      '<p><input type="file"',
      '<p><button type="button" onclick="downloadGrammarTemplate()">↓ Tải mẫu nhập ngữ pháp CSV</button></p><p><input type="file"'
    );
  };

  const baseCommitImport = commitImport;
  commitImport = function () {
    if (!activeDeckName) return baseCommitImport();
    const keys = new Set(data.map((item) =>
      [item.deck_folder, item.deck_name, item.lesson, item.category, item.term].join('\0')
    ));
    let added = 0;
    for (const item of pending) {
      item.deck_folder = item.deck_folder || activeDeckFolder;
      item.deck_name = item.deck_name || activeDeckName;
      const key = [item.deck_folder, item.deck_name, item.lesson, item.category, item.term].join('\0');
      if (keys.has(key)) continue;
      data.push(item);
      keys.add(key);
      added++;
    }
    pending = [];
    save();
    activeDeckName = '';
    activeDeckFolder = '';
    view = 'sets';
    render();
    toast(`Đã thêm ${added} thẻ vào bộ flashcard; bỏ qua thẻ trùng trong cùng bộ.`);
  };

  window.downloadGrammarTemplate = function () {
    const rows = [
      ['bai', 'loai', 'tieng_nhat', 'cach_doc', 'han_viet', 'nghia', 'vi_du', 'dich_vi_du', 'cong_thuc', 'cach_dung', 'ngu_canh', 'luu_y_jlpt', 'ghi_chu_vo'],
      ['Bài ngữ pháp mẫu', 'Ngữ pháp', '〜ことにする', '', '', 'Quyết định tự mình sẽ làm việc gì', '毎日、日本語を勉強することにしました。', 'Tôi đã quyết định học tiếng Nhật mỗi ngày.', 'Vる / Vない + ことにする', 'Diễn tả quyết định hoặc lựa chọn do chính người nói đưa ra.', 'Dùng khi nói về kế hoạch, thói quen hoặc quyết tâm của bản thân.', 'Phân biệt ことにする (tự quyết định) với ことになる (được quyết định / kết quả thành ra).', 'Ghi mẫu câu và tự đặt thêm một ví dụ.']
    ];
    const csv = rows.map((row) => row.map((cell) =>
      `"${String(cell).replaceAll('"', '""')}"`
    ).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mau_nhap_ngu_phap_n3.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importHTMLWithGrammar = importHTML;
  importHTML = function () {
    return importHTMLWithGrammar().replace(
      'Cột: bai, loai, tieng_nhat, cach_doc, han_viet, nghia, vi_du, dich_vi_du, cong_thuc, cach_dung, ngu_canh, luu_y_jlpt, ghi_chu_vo.',
      'Cột: bai, loai, tieng_nhat, cach_doc, han_viet, nghia, vi_du, dich_vi_du, cong_thuc, cach_dung, ngu_canh, luu_y_jlpt, ghi_chu_vo, thu_muc, bo_flashcard.'
    );
  };

  render();
})();
