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


  // Group all classes by weekday.
  const scheduleBody = document.getElementById('scheduleBody');
  const schedule = Array.isArray(window.SCHEDULE) ? window.SCHEDULE : [];
  const weekdayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const weekdayOrder = [...weekdayNames];
  const dayGroups = new Map(weekdayOrder.map(day => [day, []]));

  function addScheduleOccurrences(value, subject) {
    String(value ?? '').split(/[،,]/).forEach(part => {
      const cleaned = part.trim();
      const match = cleaned.match(/^([^:]+):\s*(.+)$/);
      let day;
      let time;

      if (match && dayGroups.has(match[1].trim())) {
        day = match[1].trim();
        time = match[2].trim();
      } else {
        day = addScheduleOccurrences.lastDay;
        time = cleaned;
      }

      if (!day || !dayGroups.has(day)) return;
      addScheduleOccurrences.lastDay = day;
      dayGroups.get(day).push({ subject, time });
    });
  }

  schedule.forEach(row => {
    addScheduleOccurrences.lastDay = null;
    addScheduleOccurrences(row.time, row.subject);

    if (row.repeat && row.repeat !== '—') {
      addScheduleOccurrences.lastDay = null;
      addScheduleOccurrences(row.repeat, row.subject);
    }
  });

  function timeSortValue(value) {
    const match = String(value).match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return Number.MAX_SAFE_INTEGER;

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);

    // Treat 1:00 and 2:00 as afternoon times in this timetable.
    if (hour >= 1 && hour <= 5) hour += 12;

    return hour * 60 + minute;
  }

  if (!document.getElementById('schedule-day-card-styles')) {
    const styles = document.createElement('style');
    styles.id = 'schedule-day-card-styles';
    styles.textContent = `
      .schedule-table {
        width: 100% !important;
        min-width: 0 !important;
      }
      .schedule-table thead {
        display: none !important;
      }
      .schedule-table tbody {
        display: block !important;
        width: 100% !important;
      }
      #scheduleBody tr.schedule-day-row {
        display: block !important;
        width: 100% !important;
      }
      #scheduleBody tr.schedule-day-row > td {
        display: block !important;
        width: 100% !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }
      #scheduleBody .schedule-day-card {
        margin: 0 0 12px;
        padding: 15px 17px;
        border: 1px solid var(--border, #e5e0d4);
        border-radius: 13px;
        background: var(--card, #fffdf8);
        text-align: right;
      }
      #scheduleBody .schedule-day-card.is-marked {
        border-color: #899568;
        background: rgba(120, 134, 76, .09);
        box-shadow: 0 0 0 2px rgba(120, 134, 76, .10);
      }
      #scheduleBody .schedule-day-title {
        display: flex;
        align-items: center;
        gap: 9px;
        margin: 0 0 11px;
        color: var(--text, #38382f);
        font-size: 17px;
        font-weight: 700;
      }
      #scheduleBody .schedule-day-dot {
        width: 9px;
        height: 9px;
        flex: 0 0 9px;
        border-radius: 50%;
        background: #899568;
        box-shadow: 0 0 0 4px rgba(137, 149, 104, .16);
      }
      #scheduleBody .schedule-class-list {
        display: grid;
        gap: 0;
      }
      #scheduleBody .schedule-class-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 9px 0;
        border-top: 1px solid var(--border, #e5e0d4);
      }
      #scheduleBody .schedule-class-item:first-child {
        border-top: 0;
      }
      #scheduleBody .schedule-class-subject {
        color: var(--text, #38382f);
        font-weight: 600;
      }
      #scheduleBody .schedule-class-time {
        flex: 0 0 auto;
        color: var(--muted, #777568);
        font-size: .94em;
        white-space: nowrap;
      }
      @media (max-width: 650px) {
        .table-wrap {
          overflow: visible !important;
        }
        #scheduleBody .schedule-day-card {
          padding: 13px 14px;
        }
        #scheduleBody .schedule-class-item {
          align-items: flex-start;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  function getMarkedDay() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (now.getHours() >= 15) {
      target.setDate(target.getDate() + 1);
    }

    // Skip days without classes, including holidays.
    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(target);
      candidate.setDate(target.getDate() + offset);
      const dayName = weekdayNames[candidate.getDay()];

      if ((dayGroups.get(dayName) || []).length) {
        return dayName;
      }
    }

    return null;
  }

  function renderScheduleByDay() {
    if (!scheduleBody) return;

    const markedDay = getMarkedDay();

    scheduleBody.innerHTML = weekdayOrder
      .filter(day => dayGroups.get(day).length)
      .map(day => {
        const bySubject = new Map();

        dayGroups.get(day).forEach(item => {
          if (!bySubject.has(item.subject)) {
            bySubject.set(item.subject, []);
          }
          bySubject.get(item.subject).push(item.time);
        });

        const classes = Array.from(bySubject, ([subject, times]) => ({
          subject,
          time: times
            .sort((a, b) => timeSortValue(a) - timeSortValue(b))
            .join('، ')
        })).sort((a, b) => timeSortValue(a.time) - timeSortValue(b.time));

        const marked = day === markedDay;

        return `
          <tr class="schedule-day-row">
            <td colspan="3">
              <section class="schedule-day-card ${marked ? 'is-marked' : ''}">
                <h3 class="schedule-day-title">
                  ${marked ? '<span class="schedule-day-dot" aria-hidden="true"></span>' : ''}
                  ${safe(day)}
                </h3>
                <div class="schedule-class-list">
                  ${classes.map(item => `
                    <div class="schedule-class-item">
                      <span class="schedule-class-subject">${safe(item.subject)}</span>
                      <span class="schedule-class-time">${safe(item.time)}</span>
                    </div>
                  `).join('')}
                </div>
              </section>
            </td>
          </tr>`;
      }).join('');
  }

  renderScheduleByDay();

  let lastMarkedDay = getMarkedDay();

  window.setInterval(() => {
    const currentMarkedDay = getMarkedDay();

    if (currentMarkedDay !== lastMarkedDay) {
      lastMarkedDay = currentMarkedDay;
      renderScheduleByDay();
    }
  }, 60 * 1000);

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