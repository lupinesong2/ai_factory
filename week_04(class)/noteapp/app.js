const API = '/api/notes';

// DOM 요소
const noteList = document.getElementById('note-list');
const editorPlaceholder = document.getElementById('editor-placeholder');
const editorForm = document.getElementById('editor-form');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const btnNew = document.getElementById('btn-new');
const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');

let currentNoteId = null;

// 메모 목록 불러오기
async function loadNotes() {
  const res = await fetch(API);
  const notes = await res.json();

  noteList.innerHTML = '';
  notes.forEach(note => {
    const li = document.createElement('li');
    li.dataset.id = note.id;
    if (note.id === currentNoteId) li.classList.add('active');

    const date = new Date(note.updated_at || note.created_at);
    const dateStr = date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    li.innerHTML = `
      <div class="note-item-title">${note.title || '제목 없음'}</div>
      <div class="note-item-date">${dateStr}</div>
    `;

    li.addEventListener('click', () => selectNote(note));
    noteList.appendChild(li);
  });
}

// 메모 선택
function selectNote(note) {
  currentNoteId = note.id;
  noteTitle.value = note.title || '';
  noteContent.value = note.content || '';
  editorPlaceholder.style.display = 'none';
  editorForm.style.display = 'flex';

  document.querySelectorAll('.note-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === note.id);
  });
}

// 새 메모
btnNew.addEventListener('click', () => {
  currentNoteId = null;
  noteTitle.value = '';
  noteContent.value = '';
  editorPlaceholder.style.display = 'none';
  editorForm.style.display = 'flex';
  noteTitle.focus();

  document.querySelectorAll('.note-list li').forEach(li => li.classList.remove('active'));
});

// 저장
btnSave.addEventListener('click', async () => {
  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title && !content) return;

  if (currentNoteId) {
    await fetch(`${API}/${currentNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
  } else {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    currentNoteId = data.id;
  }

  await loadNotes();
});

// 삭제
btnDelete.addEventListener('click', async () => {
  if (!currentNoteId) return;
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;

  await fetch(`${API}/${currentNoteId}`, { method: 'DELETE' });

  currentNoteId = null;
  editorForm.style.display = 'none';
  editorPlaceholder.style.display = 'flex';
  noteTitle.value = '';
  noteContent.value = '';

  await loadNotes();
});

// 초기 로드
loadNotes();
