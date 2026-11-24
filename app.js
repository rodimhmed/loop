(() => {
  const grid = document.getElementById('libraryGrid');
  const empty = document.getElementById('emptyState');
  const search = document.getElementById('searchInput');
  const crumbs = document.getElementById('breadcrumbs');
  const tree = window.LIBRARY_TREE || { name: "المحاضرات", path: "", folders: [], files: [] };
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  let current = tree;
  let pathStack = [tree];

  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  // Render the class timetable from schedule.js.
  const scheduleBody = document.getElementById('scheduleBody');
  const schedule = Array.isArray(window.SCHEDULE) ? window.SCHEDULE : [];
  if (scheduleBody) {
    scheduleBody.innerHTML = schedule.map(row => `
      <tr>
        <td>${safe(row.subject)}</td>
        <td>${safe(row.time)}</td>
        <td class="${row.repeat === '—' ? 'no-repeat' : ''}">${safe(row.repeat)}</td>
      </tr>`).join('');
  }

  function renderBreadcrumbs() {
    crumbs.innerHTML = pathStack.map((folder, i) => {
      const label = safe(folder.name || 'المحاضرات');
      return `<button type="button" class="crumb ${i === pathStack.length - 1 ? 'active' : ''}" data-index="${i}">${label}</button>`;
    }).join('<span class="crumb-sep">/</span>');
    crumbs.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        pathStack = pathStack.slice(0, index + 1);
        current = pathStack[pathStack.length - 1];
        render();
      });
    });
  }

  function render() {
    renderBreadcrumbs();
    const term = search.value.trim().toLocaleLowerCase('ar');
    const folders = current.folders || [];
    const files = (current.files || []).filter(file =>
      `${file.name || ''} ${file.subject || ''}`.toLocaleLowerCase('ar').includes(term)
    );
    const visibleFolders = term ? [] : folders;

    const folderCards = visibleFolders.map(folder => `
      <button class="folder-card" type="button" data-folder="${safe(folder.path)}">
        <span class="folder-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h5l2 2h7.4A1.8 1.8 0 0 1 21 8.8v9.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.2z"></path></svg></span>
        <span class="folder-name">${safe(folder.name)}</span>
        <span class="folder-hint">فتح المجلد</span>
      </button>`).join('');

    const fileCards = files.map(file => `
      <article class="lecture-card">
        <div class="card-top"><span class="pdf-icon">PDF</span><span class="file-type">ملف PDF</span></div>
        <h3>${safe(file.name)}</h3>
        <p>${safe(file.subject || 'محاضرة')}</p>
        <div class="card-actions">
          <a class="read-btn" href="${safe(file.url)}" target="_blank" rel="noopener noreferrer">قراءة</a>
          <a class="download-btn" href="${safe(file.url)}" download>تحميل</a>
        </div>
      </article>`).join('');

    grid.innerHTML = folderCards + fileCards;
    grid.hidden = !(folderCards || fileCards);
    empty.hidden = (visibleFolders.length + files.length) > 0;
    grid.querySelectorAll('[data-folder]').forEach(button => {
      button.addEventListener('click', () => {
        const target = findFolder(tree, button.dataset.folder);
        if (target) {
          current = target;
          pathStack.push(target);
          search.value = '';
          render();
        }
      });
    });
  }

  function findFolder(node, path) {
    if (node.path === path) return node;
    for (const folder of (node.folders || [])) {
      const found = findFolder(folder, path);
      if (found) return found;
    }
    return null;
  }

  search.addEventListener('input', () => {
    if (search.value.trim()) {
      // Search all nested folders and show matching PDFs as a flat result list.
      const all = [];
      collectFiles(tree, all);
      const term = search.value.trim().toLocaleLowerCase('ar');
      const matches = all.filter(file => `${file.name} ${file.subject || ''} ${file.folder || ''}`.toLocaleLowerCase('ar').includes(term));
      grid.innerHTML = matches.map(file => `
        <article class="lecture-card">
          <div class="card-top"><span class="pdf-icon">PDF</span><span class="file-type">${safe(file.folder || 'المحاضرات')}</span></div>
          <h3>${safe(file.name)}</h3><p>${safe(file.subject || 'محاضرة')}</p>
          <div class="card-actions"><a class="read-btn" href="${safe(file.url)}" target="_blank" rel="noopener noreferrer">قراءة</a><a class="download-btn" href="${safe(file.url)}" download>تحميل</a></div>
        </article>`).join('');
      crumbs.innerHTML = '<span class="crumb active">نتائج البحث في جميع المجلدات</span>';
      empty.hidden = matches.length > 0;
      grid.hidden = matches.length === 0;
      if (!matches.length) empty.querySelector('p').textContent = 'لا توجد نتائج مطابقة.';
    } else {
      current = pathStack[pathStack.length - 1];
      render();
    }
  });

  function collectFiles(node, out, folderName = '') {
    for (const file of (node.files || [])) out.push({...file, folder: folderName || node.name});
    for (const folder of (node.folders || [])) collectFiles(folder, out, folder.name);
  }

  render();
})();