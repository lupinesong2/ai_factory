let editingId = null;

// DOM - 대시보드
const dashboardGrandTotal = document.getElementById('dashboard-grand-total');
const dashboardCategories = document.getElementById('dashboard-categories');

// DOM
const form = document.getElementById('entry-form');
const dateInput = document.getElementById('date');
const categoryInput = document.getElementById('category');
const nameInput = document.getElementById('item-name');
const amountInput = document.getElementById('amount');
const memoInput = document.getElementById('memo');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const filterCategory = document.getElementById('filter-category');
const tableBody = document.getElementById('table-body');
const totalAmountEl = document.getElementById('total-amount');
const entryCountEl = document.getElementById('entry-count');

// 오늘 날짜 기본값
dateInput.value = new Date().toISOString().slice(0, 10);

// 날짜 포맷 (ISO → YYYY-MM-DD)
function formatDate(isoString) {
  return isoString ? isoString.slice(0, 10) : '';
}

// 대시보드 렌더링
async function renderDashboard() {
  try {
    const res = await fetch('/api/summary');
    const data = await res.json();

    dashboardGrandTotal.textContent = data.grandTotal.toLocaleString() + '원';

    dashboardCategories.innerHTML = data.categories.map(c => {
      const pct = data.grandTotal > 0 ? (c.total / data.grandTotal * 100) : 0;
      return `
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <span class="chip chip-${c.category}">${c.category}</span>
            <span class="dashboard-card-count">${c.count}건</span>
          </div>
          <div class="dashboard-card-amount">${c.total.toLocaleString()}원</div>
          <div class="dashboard-card-bar">
            <div class="dashboard-card-bar-fill bar-${c.category}" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('대시보드 오류:', err);
  }
}

// 렌더링
async function render() {
  const filter = filterCategory.value;
  const query = filter === 'all' ? '' : `?category=${encodeURIComponent(filter)}`;

  try {
    const res = await fetch(`/api/entries${query}`);
    const data = await res.json();
    const entries = data.entries;

    tableBody.innerHTML = entries.map(e => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td><span class="chip chip-${e.category}">${e.category}</span></td>
        <td>${e.name}</td>
        <td>${Number(e.amount).toLocaleString()}</td>
        <td>${e.memo || ''}</td>
        <td class="action-btns">
          <button onclick="editEntry(${e.id})">수정</button>
          <button class="delete-btn" onclick="deleteEntry(${e.id})">삭제</button>
        </td>
      </tr>
    `).join('');

    totalAmountEl.textContent = data.total.toLocaleString() + '원';
    entryCountEl.textContent = data.count;

    renderDashboard();
  } catch (err) {
    console.error('렌더링 오류:', err);
  }
}

// 추가 / 수정 저장
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    date: dateInput.value,
    category: categoryInput.value,
    name: nameInput.value.trim(),
    amount: parseInt(amountInput.value),
    memo: memoInput.value.trim(),
  };

  try {
    if (editingId !== null) {
      await fetch(`/api/entries/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      editingId = null;
      submitBtn.textContent = '추가';
      cancelBtn.classList.add('hidden');
    } else {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    render();
  } catch (err) {
    console.error('저장 오류:', err);
  }
});

// 수정
async function editEntry(id) {
  const filter = filterCategory.value;
  const query = filter === 'all' ? '' : `?category=${encodeURIComponent(filter)}`;
  const res = await fetch(`/api/entries${query}`);
  const data = await res.json();
  const entry = data.entries.find(e => e.id === id);
  if (!entry) return;

  dateInput.value = formatDate(entry.date);
  categoryInput.value = entry.category;
  nameInput.value = entry.name;
  amountInput.value = entry.amount;
  memoInput.value = entry.memo || '';

  editingId = id;
  submitBtn.textContent = '저장';
  cancelBtn.classList.remove('hidden');
}

// 수정 취소
cancelBtn.addEventListener('click', () => {
  editingId = null;
  submitBtn.textContent = '추가';
  cancelBtn.classList.add('hidden');
  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
});

// 삭제
async function deleteEntry(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    render();
  } catch (err) {
    console.error('삭제 오류:', err);
  }
}

// 필터 변경
filterCategory.addEventListener('change', render);

// 초기 렌더링
render();
