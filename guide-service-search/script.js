const data = window.SERVICE_DATA || [];
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const resetBtn = document.getElementById('resetBtn');
const tbody = document.getElementById('serviceTableBody');
const visibleCount = document.getElementById('visibleCount');
const emptyState = document.getElementById('emptyState');

function escapeHtml(value='') { return String(value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const filtered = data.filter(item => {
    const keywordOK = item['서비스명'].toLowerCase().includes(keyword);
    const categoryOK = category === 'all' || item['안내분야'] === category;
    return keywordOK && categoryOK;
  });
  tbody.innerHTML = filtered.map(item => `<tr>
    <td>${escapeHtml(item['서비스명'])}</td>
    <td><span class="badge">${escapeHtml(item['안내분야'])}</span></td>
    <td>${escapeHtml(item['소관기관'])}</td>
    <td class="online">${escapeHtml(item['온라인안내'])}</td>
    <td>${escapeHtml(item['콜센터'])}</td>
  </tr>`).join('');
  visibleCount.textContent = `현재 표시 ${filtered.length}건`;
  emptyState.hidden = filtered.length !== 0;
}
searchInput.addEventListener('input', render);
categoryFilter.addEventListener('change', render);
resetBtn.addEventListener('click', () => { searchInput.value=''; categoryFilter.value='all'; render(); searchInput.focus(); });
render();