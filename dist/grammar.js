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
  let activeCourseId = '';
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
    if (columns.tieng_nhat < 0 && columns.nghia < 0) {
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
      if ((!term && !meaning) || !cats.includes(category)) {
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
    <section class="card lesson-create grammar-create">
      <span class="badge">SOẠN BÀI NGỮ PHÁP</span>
      <h2>＋ Tạo mẫu ngữ pháp</h2>
      <p class="muted">Nhập mẫu hoặc ý nghĩa; công thức, ngữ cảnh và ví dụ có thể bổ sung riêng.</p>
      <form id="create-grammar-form">
        <div class="formgrid">
          <label>Bài / chủ đề<input name="lesson" required maxlength="200" placeholder="Ví dụ: Bài 01 · Quyết định"></label>
          <label>Mẫu ngữ pháp<input name="term" maxlength="500" placeholder="Ví dụ: 〜ことにする"></label>
          <label>Ý nghĩa / giải thích<textarea name="meaning" maxlength="4000" placeholder="Tự quyết định sẽ làm việc gì"></textarea></label>
          <label>Công thức<textarea name="structure" maxlength="4000" placeholder="Vる / Vない + ことにする"></textarea></label>
          <label>Cách dùng<textarea name="usage" maxlength="4000"></textarea></label>
          <label>Ngữ cảnh phù hợp<textarea name="context" maxlength="4000"></textarea></label>
          <label>Ví dụ tiếng Nhật<textarea name="example" maxlength="4000"></textarea></label>
          <label>Dịch ví dụ<textarea name="translation" maxlength="4000"></textarea></label>
          <label>Lưu ý khi thi JLPT<textarea name="jlpt_note" maxlength="4000"></textarea></label>
          <label>Ghi chép để chép vào vở<textarea name="study_note" maxlength="4000"></textarea></label>
        </div>
        <button class="primary">Lưu mẫu ngữ pháp</button>
      </form>
    </section>
    <p>${items.length} mẫu ngữ pháp</p>
    ${items.length ? `<div class="grammar-grid">${items.map((item) => `<article class="card grammar-card">
      <div class="row between"><div><span class="badge">${esc(item.lesson)}</span>
        <h2 class="jp">${esc(item.term || item.meaning)}</h2></div>
        <button onclick="edit('${item.id}')">Sửa bài</button>
      </div>
      ${item.term ? `<p><b>Mẫu:</b> <span class="jp">${esc(item.term)}</span></p>` : ''}
      ${item.meaning ? `<p><b>Ý nghĩa:</b> ${esc(item.meaning)}</p>` : ''}
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
          <button type="button" onclick="startGrammarQuiz('${item.id}')">Quiz bài này</button>
          <button type="button" class="danger" onclick="deleteStudyCard('${item.id}')">Xóa mẫu</button></p>
      </form>
    </article>`).join('')}</div>` : '<div class="empty">Chưa có mẫu ngữ pháp phù hợp. Tạo mẫu ở trên hoặc nhập XLSX/CSV có cột loai là “Ngữ pháp”.</div>'}
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
    for (const course of lessons) {
      const key = `${course.topic}\u0000${course.name}`;
      if (!sets.has(key)) sets.set(key, { folder: course.topic, name: course.name, items: [] });
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
        const course = lessons.find((entry) => entry.topic === set.folder && entry.name === set.name);
        return `<article class="card">
          <span class="badge">${set.items.length} thẻ</span>
          <h3>${esc(set.name)}</h3>
          ${course ? `<p>${esc(course.description || '')}</p>
            <small>Ngày tạo: ${new Date(course.created_at).toLocaleDateString('vi-VN')}</small>` : ''}
          <p>${esc([...new Set(set.items.map((item) => item.category))].join(' · '))}</p>
          ${course ? `<p><button onclick="openStudyLesson('${course.id}')">Mở bài học</button></p>` : ''}
          <button class="primary" ${set.items.length ? `onclick="startFlashcardSet(${index})"` : 'disabled'}>Học bộ này →</button>
          <button class="danger" onclick="deleteFlashcardSet(${index})">Xóa bộ</button>
        </article>`;
      }).join('')}</div>
    </section>`).join('') : '<div class="empty">Chưa có bộ flashcard. Đặt tên thư mục và bộ ở trên rồi chọn file để bắt đầu.</div>'}`;
  }

  function lessonCards(course) {
    return data.filter((item) =>
      (item.deck_folder || '') === course.topic &&
      (item.deck_name || '') === course.name
    );
  }

  function organizeLegacyStudyCards() {
    const known = new Set(lessons.map((course) => `${course.topic}\u0000${course.name}`));
    let changed = false;
    for (const item of data) {
      const topic = String(item.deck_folder || '').trim() || item.category || 'Flashcard cũ';
      const name = String(item.deck_name || '').trim() || item.lesson || 'Bộ từ đã soạn';
      if (item.deck_folder !== topic || item.deck_name !== name || item.lesson !== name) {
        item.deck_folder = topic;
        item.deck_name = name;
        item.lesson = name;
        changed = true;
      }
      const key = `${topic}\u0000${name}`;
      if (!known.has(key)) {
        lessons.push({
          id: crypto.randomUUID().replace(/-/g, '_'),
          topic,
          name,
          created_at: new Date().toISOString(),
          description: 'Bài học được tự tạo để sắp xếp flashcard đã có.'
        });
        known.add(key);
        changed = true;
      }
    }
    if (changed) save();
  }

  function lessonsPage() {
    const grouped = new Map();
    for (const course of lessons) {
      if (!grouped.has(course.topic)) grouped.set(course.topic, []);
      grouped.get(course.topic).push(course);
    }
    return `<section class="lesson-hero">
      <div><span class="badge">KHO BÀI HỌC</span>
        <h2>Từ vựng của bạn, sắp xếp theo từng chủ đề</h2>
        <p>Tạo bài học, thêm thẻ bằng biểu mẫu hoặc Excel, rồi ôn đúng bộ đã tạo.</p>
      </div>
      <div class="lesson-hero-mark" aria-hidden="true">語彙</div>
    </section>
    <section class="card lesson-create">
      <h2>＋ Tạo bài học mới</h2>
      <form id="create-lesson-form">
        <div class="formgrid">
          <label>Chủ đề / thư mục
            <input name="topic" required maxlength="120" placeholder="Ví dụ: Đời sống hằng ngày">
          </label>
          <label>Tên bài học
            <input name="name" required maxlength="120" placeholder="Ví dụ: Bài 01 · Ở nhà hàng">
          </label>
        </div>
        <label>Mô tả nội dung từ vựng (không bắt buộc)
          <textarea name="description" maxlength="2000" placeholder="Món ăn, gọi món, thanh toán…"></textarea>
        </label>
        <button class="primary">Tạo bài học và thêm flashcard →</button>
      </form>
    </section>
    ${grouped.size ? `<section class="lesson-topic">
      <header class="topic-heading"><div><span class="badge">BÀI HỌC</span><h2>📚 Các bài của bạn</h2></div>
        <small>${lessons.length} bài học trong ${grouped.size} chủ đề</small>
      </header>
      <div class="lesson-grid">${[...grouped.entries()].flatMap(([topic, courses]) =>
        courses.map((course, index) => {
        const count = lessonCards(course).length;
        return `<article class="card lesson-tile" style="--tile-index:${index % 6}">
          <div class="lesson-tile-top"><span class="badge">${esc(topic)}</span>
            <span class="lesson-number">${String(index + 1).padStart(2, '0')}</span></div>
          <small>${count} flashcard</small>
          <h3>${esc(course.name)}</h3>
          <p class="lesson-description">${esc(course.description || 'Chưa thêm mô tả cho bài học này.')}</p>
          <small>Đã tạo ${esc(new Date(course.created_at).toLocaleDateString('vi-VN'))}</small>
          <div class="row lesson-actions">
            <button class="primary" onclick="openStudyLesson('${course.id}')">Mở bài học →</button>
            ${count ? `<button onclick="studyCourse('${course.id}')">Học ${count} thẻ</button>` : ''}
            <button class="danger" onclick="deleteStudyLesson('${course.id}')">Xóa bài</button>
          </div>
        </article>`;
      })).join('')}</div>
    </section>` : `<div class="empty lesson-empty">
      <div class="lesson-empty-mark">✦</div><h3>Chưa có bài học nào</h3>
      <p>Tạo chủ đề đầu tiên ở trên, rồi thêm thẻ học thủ công hoặc nhập file Excel.</p>
    </div>`}
    <section class="legacy-lessons">
      <h2>Flashcard chưa xếp vào bài học</h2>
      <p class="muted">Các thẻ cũ được giữ nguyên. Chúng vẫn có trong mục Flashcard và Bộ flashcard.</p>
      <span class="badge">${data.filter((item) => !item.deck_name).length} thẻ chưa xếp</span>
      <button onclick="go('sets')">Xem tất cả bộ flashcard →</button>
    </section>`;
  }

  function lessonDetailPage(course) {
    const cards = lessonCards(course);
    return `<button class="back-button" onclick="backToStudyLessons()">← Quay lại kho bài học</button>
      <section class="lesson-detail-hero">
        <div><span class="badge">${esc(course.topic)}</span>
          <h2>${esc(course.name)}</h2>
          <p>${esc(course.description || 'Bài học từ vựng và flashcard do bạn tạo.')}</p>
          <small>Ngày tạo: ${esc(new Date(course.created_at).toLocaleDateString('vi-VN'))} · ${cards.length} flashcard</small>
        </div>
        <div class="row">
          <button onclick="editStudyLesson('${course.id}')">Sửa thông tin bài</button>
          ${cards.length ? `<button class="primary" onclick="studyCourse('${course.id}')">Học flashcard →</button>` : ''}
          <button class="danger" onclick="deleteStudyLesson('${course.id}')">Xóa bài học</button>
        </div>
      </section>
      <div class="lesson-content-grid">
        <section class="card lesson-add-card">
          <span class="badge">TẠO FLASHCARD</span><h3>Thêm thẻ bằng biểu mẫu</h3>
          <form id="add-lesson-card">
            <label>Từ / cụm từ tiếng Nhật<input name="term" maxlength="500" placeholder="例：予約する"></label>
            <div class="formgrid">
              <label>Cách đọc<input name="reading" maxlength="4000"></label>
              <label>Phân môn<select name="category">${cats.map((itemCategory) =>
                `<option>${esc(itemCategory)}</option>`).join('')}</select></label>
            </div>
            <label>Nghĩa / giải thích<textarea name="meaning" maxlength="4000"></textarea></label>
            <p class="muted">Chỉ cần nhập từ tiếng Nhật hoặc nghĩa / giải thích; có thể nhập cả hai.</p>
            <label>Ví dụ tiếng Nhật<textarea name="example" maxlength="4000"></textarea></label>
            <label>Dịch ví dụ<textarea name="translation" maxlength="4000"></textarea></label>
            <button class="primary">Lưu flashcard</button>
          </form>
        </section>
        <section class="card lesson-import-card">
          <span class="badge">NHẬP NHIỀU THẺ</span><h3>Thêm từ file Excel</h3>
          <p>Chọn XLSX, CSV hoặc TSV. Các thẻ sẽ tự vào bài học <b>${esc(course.name)}</b>.</p>
          <label class="file-drop">
            <span class="file-drop-icon">↥</span>
            <span><b>Chọn file để nhập</b><small> XLSX · CSV · TSV · tối đa 10 MB</small></span>
            <input type="file" accept=".xlsx,.csv,.tsv" onchange="loadCourseFile('${course.id}',this.files[0])">
          </label>
          <div id="preview"></div>
          <small>Cần ít nhất một trong hai cột tieng_nhat hoặc nghia; mỗi dòng chỉ cần có từ tiếng Nhật hoặc nghĩa.</small>
        </section>
      </div>
      <section class="lesson-card-list">
        <div class="row between"><div><span class="badge">NỘI DUNG BÀI</span><h2>Flashcard trong bài</h2></div>
          <span class="badge">${cards.length} thẻ</span></div>
        ${cards.length ? `<div class="lesson-word-grid">${cards.map((item) => `<article class="card word-tile">
          <span class="badge">${esc(item.category)}</span><h3 class="jp">${esc(item.term || item.meaning)}</h3>
          ${item.reading ? `<p class="muted">${esc(item.reading)}</p>` : ''}
          <p>${esc(item.meaning)}</p>
          ${item.example ? `<p class="jp word-example">${esc(item.example)}</p>` : ''}
          <div class="row"><button onclick="edit('${item.id}')">Sửa thẻ</button>
            <button onclick="studyOneCard('${item.id}')">Học thẻ</button>
            <button class="danger" onclick="deleteStudyCard('${item.id}')">Xóa thẻ</button></div>
        </article>`).join('')}</div>` : `<div class="empty"><p>Bài học đang trống.</p>
          <p>Thêm thẻ bằng biểu mẫu hoặc nhập Excel ở trên.</p></div>`}
      </section>`;
  }

  function createStudyLesson(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const topic = String(values.topic || '').trim();
    const name = String(values.name || '').trim();
    if (!topic || !name) return toast('Nhập chủ đề và tên bài học.');
    const duplicate = lessons.some((course) =>
      course.topic.toLocaleLowerCase() === topic.toLocaleLowerCase() &&
      course.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (duplicate) return toast('Bài này đã có trong chủ đề đó.');
    const course = {
      id: crypto.randomUUID().replace(/-/g, '_'),
      topic,
      name,
      created_at: new Date().toISOString(),
      description: String(values.description || '').trim()
    };
    lessons.push(course);
    save();
    openStudyLesson(course.id);
    toast('Đã tạo bài học. Thêm thẻ ngay bằng biểu mẫu hoặc Excel.');
  }

  function createGrammarPattern(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const term = String(values.term || '').trim();
    const meaning = String(values.meaning || '').trim();
    const itemLesson = String(values.lesson || '').trim();
    if (!itemLesson) return toast('Nhập tên bài / chủ đề ngữ pháp.');
    if (!term && !meaning) return toast('Nhập mẫu ngữ pháp hoặc ý nghĩa / giải thích.');
    data.push({
      id: crypto.randomUUID().replace(/-/g, '_'),
      term,
      meaning,
      lesson: itemLesson,
      category: 'Ngữ pháp',
      reading: '',
      hanviet: '',
      example: String(values.example || '').trim(),
      translation: String(values.translation || '').trim(),
      structure: String(values.structure || '').trim(),
      usage: String(values.usage || '').trim(),
      context: String(values.context || '').trim(),
      jlpt_note: String(values.jlpt_note || '').trim(),
      study_note: String(values.study_note || '').trim(),
      deck_folder: 'Ngữ pháp',
      deck_name: itemLesson
    });
    save();
    event.currentTarget.reset();
    lesson = itemLesson;
    query = '';
    render();
    toast('Đã lưu mẫu ngữ pháp vào flashcard.');
  }

  function deleteStudyCard(id) {
    const item = data.find((entry) => entry.id === id);
    if (!item) return toast('Không tìm thấy flashcard.');
    if (!confirm(`Xóa "${item.term || item.meaning}"? Tiến độ ôn của thẻ này cũng sẽ bị xóa.`)) return;
    data = data.filter((entry) => entry.id !== id);
    delete state[id];
    deck = deck.filter((entry) => entry.id !== id);
    save();
    render();
    toast('Đã xóa flashcard.');
  }

  function deleteStudyLesson(id) {
    const course = lessons.find((entry) => entry.id === id);
    if (!course) return toast('Không tìm thấy bài học.');
    const removedCards = data.filter((item) =>
      item.deck_folder === course.topic && item.deck_name === course.name
    );
    if (!confirm(`Xóa bài "${course.name}" và ${removedCards.length} flashcard bên trong? Tiến độ ôn của các thẻ này cũng sẽ bị xóa.`)) return;
    const removedIds = new Set(removedCards.map((item) => item.id));
    data = data.filter((item) => !removedIds.has(item.id));
    for (const cardId of removedIds) delete state[cardId];
    lessons = lessons.filter((entry) => entry.id !== id);
    deck = deck.filter((item) => !removedIds.has(item.id));
    if (activeCourseId === id) activeCourseId = '';
    if (activeStudySet?.folder === course.topic && activeStudySet?.name === course.name) activeStudySet = null;
    save();
    view = 'library';
    render();
    toast(`Đã xóa bài học và ${removedCards.length} flashcard.`);
  }

  function deleteFlashcardSet(setIndex) {
    const set = flashcardSets[setIndex];
    if (!set) return toast('Không tìm thấy bộ flashcard.');
    const { folder, name } = set;
    const removedCards = data.filter((item) =>
      (item.deck_folder || 'Chưa xếp bộ') === folder &&
      (item.deck_name || 'Thẻ cũ / chưa xếp') === name
    );
    const course = lessons.find((entry) => entry.topic === folder && entry.name === name);
    if (!removedCards.length && !course) return toast('Không tìm thấy bộ flashcard.');
    if (!confirm(`Xóa bộ "${name}" và ${removedCards.length} flashcard bên trong? Tiến độ ôn của các thẻ này cũng sẽ bị xóa.`)) return;
    const removedIds = new Set(removedCards.map((item) => item.id));
    data = data.filter((item) => !removedIds.has(item.id));
    for (const cardId of removedIds) delete state[cardId];
    lessons = lessons.filter((entry) => !(entry.topic === folder && entry.name === name));
    deck = deck.filter((item) => !removedIds.has(item.id));
    if (activeCourseId === course?.id) activeCourseId = '';
    if (activeStudySet?.folder === folder && activeStudySet?.name === name) activeStudySet = null;
    save();
    render();
    toast(`Đã xóa bộ flashcard và ${removedCards.length} thẻ.`);
  }

  function openStudyLesson(id) {
    activeCourseId = id;
    const course = lessons.find((entry) => entry.id === id);
    if (!course) return toast('Không tìm thấy bài học.');
    view = 'lessonDetail';
    render();
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function backToStudyLessons() {
    activeCourseId = '';
    go('library');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function editStudyLesson(id) {
    const course = lessons.find((entry) => entry.id === id);
    if (!course) return toast('Không tìm thấy bài học.');
    $('#app').innerHTML = `<button class="back-button" onclick="openStudyLesson('${id}')">← Quay lại bài học</button>
      <section class="card lesson-edit-form"><span class="badge">CHỈNH SỬA BÀI HỌC</span>
        <h2>${esc(course.name)}</h2><form id="edit-study-lesson">
          <div class="formgrid">
            <label>Chủ đề<input name="topic" required maxlength="120" value="${esc(course.topic)}"></label>
            <label>Tên bài học<input name="name" required maxlength="120" value="${esc(course.name)}"></label>
          </div>
          <label>Mô tả<textarea name="description" maxlength="2000">${esc(course.description)}</textarea></label>
          <button class="primary">Lưu thay đổi</button>
        </form></section>`;
    $('#edit-study-lesson').onsubmit = (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const topic = String(values.topic || '').trim();
      const name = String(values.name || '').trim();
      if (lessons.some((other) => other.id !== id &&
        other.topic.toLocaleLowerCase() === topic.toLocaleLowerCase() &&
        other.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        return toast('Bài này đã có trong chủ đề đó.');
      }
      const oldTopic = course.topic;
      const oldName = course.name;
      Object.assign(course, { topic, name, description: String(values.description || '').trim() });
      for (const item of data) {
        if (item.deck_folder === oldTopic && item.deck_name === oldName) {
          item.deck_folder = topic;
          item.deck_name = name;
          item.lesson = name;
        }
      }
      save();
      openStudyLesson(id);
      toast('Đã cập nhật bài học và các flashcard liên quan.');
    };
  }

  function addStudyCard(event, id) {
    event.preventDefault();
    const course = lessons.find((entry) => entry.id === id);
    if (!course) return toast('Không tìm thấy bài học.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const term = String(values.term || '').trim();
    const meaning = String(values.meaning || '').trim();
    if (!term && !meaning) return toast('Nhập từ tiếng Nhật hoặc nghĩa / giải thích để tạo flashcard.');
    data.push({
      id: crypto.randomUUID().replace(/-/g, '_'),
      term,
      meaning,
      reading: String(values.reading || '').trim(),
      hanviet: '',
      lesson: course.name,
      category: values.category,
      example: String(values.example || '').trim(),
      translation: String(values.translation || '').trim(),
      structure: '',
      usage: '',
      context: '',
      jlpt_note: '',
      study_note: '',
      deck_folder: course.topic,
      deck_name: course.name
    });
    save();
    openStudyLesson(course.id);
    toast('Đã thêm flashcard vào bài học.');
  }

  function loadCourseFile(id, file) {
    const course = lessons.find((entry) => entry.id === id);
    if (!course || !file) return;
    activeCourseId = course.id;
    activeDeckFolder = course.topic;
    activeDeckName = course.name;
    return loadFile(file);
  }

  function studyCourse(id) {
    const course = lessons.find((entry) => entry.id === id);
    if (!course) return toast('Không tìm thấy bài học.');
    activeStudySet = { folder: course.topic, name: course.name };
    lesson = '';
    category = '';
    query = '';
    onlyWeak = false;
    deck = lessonCards(course);
    if (!deck.length) return toast('Bài học chưa có flashcard để ôn.');
    idx = 0;
    flipped = false;
    view = 'flash';
    render();
  }

  function studyOneCard(id) {
    const item = data.find((entry) => entry.id === id);
    if (!item) return toast('Không tìm thấy flashcard.');
    activeStudySet = null;
    lesson = '';
    category = '';
    query = '';
    onlyWeak = false;
    deck = [item];
    idx = 0;
    flipped = false;
    view = 'flash';
    render();
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
    if (nextView !== 'lessonDetail') activeCourseId = '';
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
    if (view === 'library') {
      $('#nav').innerHTML = menus.map(([key, icon, title]) =>
        `<button class="${key === view ? 'active' : ''}" onclick="go('${key}')">${icon} &nbsp; ${title}</button>`
      ).join('');
      $('#title').textContent = 'Kho bài học';
      $('#app').innerHTML = lessonsPage();
      $('#create-lesson-form').onsubmit = createStudyLesson;
      return;
    }
    if (view === 'lessonDetail') {
      const course = lessons.find((entry) => entry.id === activeCourseId);
      if (!course) {
        view = 'library';
        return render();
      }
      $('#nav').innerHTML = menus.map(([key, icon, title]) =>
        `<button class="${key === view ? 'active' : ''}" onclick="go('${key}')">${icon} &nbsp; ${title}</button>`
      ).join('');
      $('#title').textContent = course.name;
      $('#app').innerHTML = lessonDetailPage(course);
      $('#add-lesson-card').onsubmit = (event) => addStudyCard(event, course.id);
      return;
    }
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
      $('#create-grammar-form').onsubmit = createGrammarPattern;
      return;
    }
    baseRender();
    if (view === 'library' || view === 'weak') {
      const visibleItems = filtered();
      document.querySelectorAll('.tablewrap tbody tr').forEach((row, index) => {
        const item = visibleItems[index];
        if (!item) return;
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'danger';
        removeButton.textContent = 'Xóa';
        removeButton.addEventListener('click', () => deleteStudyCard(item.id));
        row.lastElementChild?.append(' ', removeButton);
      });
    }
    if (view === 'flash') grammarFlashBack();
    if (view === 'flash') document.querySelector('.flash')?.classList.add('flash-animate');
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
        <label>Mẫu ngữ pháp<input name="term" maxlength="500" value="${esc(item.term)}"></label>
        <label>Ý nghĩa / giải thích<input name="meaning" maxlength="4000" value="${esc(item.meaning)}"></label>
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
      const values = Object.fromEntries(new FormData(event.currentTarget));
      if (!String(values.term || '').trim() && !String(values.meaning || '').trim()) {
        return toast('Nhập mẫu ngữ pháp hoặc ý nghĩa / giải thích.');
      }
      Object.assign(item, values);
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
      'Mỗi dòng cần ít nhất từ tiếng Nhật hoặc nghĩa; các cột công thức/cách dùng/ngữ cảnh/lưu ý JLPT/ghi chú vở là tùy chọn.'
    ).replace(
      '<p><input type="file"',
      '<p><button type="button" onclick="downloadGrammarTemplate()">↓ Tải mẫu nhập ngữ pháp CSV</button></p><p><input type="file"'
    );
  };

  const baseCommitImport = commitImport;
  commitImport = function () {
    if (!activeDeckName) return baseCommitImport();
    const keys = new Set(data.map((item) =>
      [item.deck_folder, item.deck_name, item.lesson, item.category, item.term, item.meaning].join('\0')
    ));
    let added = 0;
    for (const item of pending) {
      item.deck_folder = item.deck_folder || activeDeckFolder;
      item.deck_name = item.deck_name || activeDeckName;
      const key = [item.deck_folder, item.deck_name, item.lesson, item.category, item.term, item.meaning].join('\0');
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
    ).replace(
      'Dữ liệu được lưu trên trình duyệt hiện tại, chưa đồng bộ giữa các thiết bị.',
      'Dữ liệu flashcard và tiến độ được đồng bộ với tài khoản của bạn.'
    );
  };

  window.openStudyLesson = openStudyLesson;
  window.backToStudyLessons = backToStudyLessons;
  window.editStudyLesson = editStudyLesson;
  window.studyCourse = studyCourse;
  window.studyOneCard = studyOneCard;
  window.loadCourseFile = loadCourseFile;
  window.createStudyLesson = createStudyLesson;
  window.addStudyCard = addStudyCard;
  window.organizeLegacyStudyCards = organizeLegacyStudyCards;
  window.deleteStudyCard = deleteStudyCard;
  window.deleteStudyLesson = deleteStudyLesson;
  window.deleteFlashcardSet = deleteFlashcardSet;

  const originalCommitImport = commitImport;
  commitImport = function () {
    if (!activeCourseId) {
      const result = originalCommitImport();
      organizeLegacyStudyCards();
      render();
      return result;
    }
    const course = lessons.find((entry) => entry.id === activeCourseId);
    if (!course) return toast('Không tìm thấy bài học để nhập flashcard.');
    const keys = new Set(data.map((item) =>
      [item.deck_folder || '', item.deck_name || '', item.category, item.term, item.meaning].join('\0')
    ));
    let added = 0;
    for (const item of pending) {
      item.deck_folder = course.topic;
      item.deck_name = course.name;
      item.lesson = course.name;
      const key = [item.deck_folder, item.deck_name, item.category, item.term, item.meaning].join('\0');
      if (keys.has(key)) continue;
      data.push(item);
      keys.add(key);
      added++;
    }
    pending = [];
    save();
    activeDeckFolder = '';
    activeDeckName = '';
    openStudyLesson(course.id);
    toast(`Đã thêm ${added} flashcard vào bài học; thẻ trùng được bỏ qua.`);
  };

  const brand = document.querySelector('.brand');
  brand?.addEventListener('click', (event) => {
    event.preventDefault();
    activeCourseId = '';
    activeStudySet = null;
    go('home');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  });

  organizeLegacyStudyCards();
  render();
})();
