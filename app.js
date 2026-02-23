/**
 * Research Library - Dynamic content loader with multi-discipline support
 */
let config = null;
let currentDiscipline = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load config');
        config = await response.json();
        
        // Set site title
        if (config.site) {
            document.getElementById('site-title').textContent = config.site.title || '';
            document.title = config.site.title || 'Research Library';
        }
        
        // Render discipline navigation
        renderNav();
        
        // Determine initial discipline from URL hash or default to first
        const hash = location.hash.replace('#', '');
        const initialDiscipline = config.disciplines.find(d => d.id === hash) || config.disciplines[0];
        
        initTagFilter();
        switchDiscipline(initialDiscipline.id);
        initModal();
        
        // Handle browser back/forward
        window.addEventListener('hashchange', () => {
            const newHash = location.hash.replace('#', '');
            const discipline = config.disciplines.find(d => d.id === newHash);
            if (discipline && discipline.id !== currentDiscipline?.id) {
                switchDiscipline(discipline.id);
            }
        });
    } catch (error) {
        console.error('Error loading config:', error);
        showError();
    }
});

// ===== Navigation =====
function renderNav() {
    const nav = document.getElementById('discipline-nav');
    if (!config.disciplines || config.disciplines.length <= 1) {
        nav.style.display = 'none';
        return;
    }
    
    nav.innerHTML = config.disciplines.map(d => {
        const totalCount = (d.articles ? d.articles.length : 0) + (d.externalLinks ? d.externalLinks.length : 0);
        return `
            <button class="discipline-btn" data-discipline="${d.id}" onclick="switchDiscipline('${d.id}')">
                <span class="discipline-icon">${d.icon || '📚'}</span>
                <span class="discipline-name">${escapeHtml(d.name)}</span>
                <span class="discipline-count">${totalCount}</span>
            </button>
        `;
    }).join('');
}

function switchDiscipline(id) {
    const discipline = config.disciplines.find(d => d.id === id);
    if (!discipline) return;
    
    currentDiscipline = discipline;
    
    // Update URL hash without triggering hashchange
    history.replaceState(null, '', '#' + id);
    
    // Update active nav button
    document.querySelectorAll('.discipline-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.discipline === id);
    });
    
    // Update subtitle
    document.getElementById('site-subtitle').textContent = discipline.subtitle || '';
    
    // Clear filters
    clearAllFilters();
    
    // Render content for this discipline
    renderPage();
}

// Helper: get all items (articles + externalLinks) for tag operations
function getAllItems() {
    const articles = currentDiscipline?.articles || [];
    const externalLinks = currentDiscipline?.externalLinks || [];
    return [...articles, ...externalLinks];
}

function renderPage() {
    if (!currentDiscipline) return;
    
    const articles = currentDiscipline.articles || [];
    const externalLinks = currentDiscipline.externalLinks || [];
    const hasAnyContent = articles.length || externalLinks.length;
    
    // Anchor navigation to external section
    let anchorNav = document.getElementById('anchor-nav');
    if (!anchorNav) {
        anchorNav = document.createElement('div');
        anchorNav.id = 'anchor-nav';
        anchorNav.className = 'anchor-nav';
        const tagCloud = document.getElementById('tag-cloud');
        tagCloud.parentNode.insertBefore(anchorNav, tagCloud);
    }
    if (externalLinks.length) {
        anchorNav.style.display = '';
        anchorNav.innerHTML = `<a href="#external-section" class="anchor-link anchor-link-external">🌐 Статьи, обзоры и видео <span class="anchor-count">${externalLinks.length}</span> ↓</a>`;
    } else {
        anchorNav.style.display = 'none';
    }

    // Tag cloud
    if (hasAnyContent) {
        document.getElementById('tag-cloud').style.display = '';
        renderTagCloud();
    } else {
        document.getElementById('tag-cloud').style.display = 'none';
    }

    // Articles table (PDFs)
    if (articles.length) {
        const tbody = document.getElementById('articles-body');
        tbody.innerHTML = articles.map(article => renderArticleRow(article)).join('');
        document.querySelector('.table-wrapper').style.display = '';
    } else {
        document.querySelector('.table-wrapper').style.display = 'none';
    }

    // External links table
    if (externalLinks.length) {
        document.getElementById('external-section').style.display = '';
        document.getElementById('external-table-wrapper').style.display = '';
        const extBody = document.getElementById('external-body');
        extBody.innerHTML = externalLinks.map(item => renderExternalRow(item)).join('');
    } else {
        document.getElementById('external-section').style.display = 'none';
        document.getElementById('external-table-wrapper').style.display = 'none';
    }

    // Init expand for all descriptions (both tables)
    if (hasAnyContent) {
        initDescriptionExpand();
    } else {
        showEmptyState();
    }
}

function renderArticleRow(article) {
    const pdfPath = (currentDiscipline.pdfBasePath || './') + article.pdf;
    const tags = article.tags || {};
    
    return `
        <tr data-id="${article.id}">
            <td class="col-pdf">
                <button class="pdf-btn" onclick="openPdf('${pdfPath}')" title="Открыть PDF">
                    📄
                </button>
            </td>
            <td class="col-title">
                <div class="article-title">${escapeHtml(article.title)}</div>
                <div class="article-description">${parseMarkdown(article.description)}</div>
                <div class="expand-hint">▼ Показать полностью</div>
            </td>
            <td class="col-tags">
                <div class="tags-combined">
                    ${renderTagGroup(tags.companies, 'companies')}
                    ${renderTagGroup(tags.researchType, 'research')}
                    ${renderTagGroup(tags.problem, 'problem')}
                    ${renderTagGroup(tags.application, 'application')}
                    ${renderTagGroup(tags.technologies, 'tech')}
                    ${renderTagGroup(tags.additional, 'additional')}
                </div>
            </td>
        </tr>
    `;
}

function renderExternalRow(item) {
    let icon, btnClass, tooltip;
    if (item.type === 'video') {
        icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21"/></svg>';
        btnClass = 'link-btn-video';
        tooltip = 'Открыть видео';
    } else if (item.type === 'pdf') {
        icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>';
        btnClass = 'link-btn-pdf';
        tooltip = 'Открыть PDF';
    } else {
        icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        btnClass = 'link-btn-article';
        tooltip = 'Открыть статью';
    }
    const tags = item.tags || {};
    
    // PDF type uses local file + modal, others use external URL
    let btnHtml;
    if (item.type === 'pdf') {
        const pdfPath = (currentDiscipline.pdfBasePath || './') + item.pdf;
        btnHtml = `<button class="link-btn ${btnClass}" onclick="openPdf('${pdfPath}')" title="${tooltip}">${icon}</button>`;
    } else {
        btnHtml = `<a class="link-btn ${btnClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="${tooltip}">${icon}</a>`;
    }

    return `
        <tr data-id="${item.id}">
            <td class="col-pdf">
                ${btnHtml}
            </td>
            <td class="col-title">
                <div class="article-title">${escapeHtml(item.title)}</div>
                <div class="article-description">${parseMarkdown(item.description)}</div>
                <div class="expand-hint">▼ Показать полностью</div>
            </td>
            <td class="col-tags">
                <div class="tags-combined">
                    ${renderTagGroup(tags.companies, 'companies')}
                    ${renderTagGroup(tags.researchType, 'research')}
                    ${renderTagGroup(tags.problem, 'problem')}
                    ${renderTagGroup(tags.application, 'application')}
                    ${renderTagGroup(tags.technologies, 'tech')}
                    ${renderTagGroup(tags.additional, 'additional')}
                </div>
            </td>
        </tr>
    `;
}

function renderTagGroup(tagArray, className) {
    if (!tagArray || !tagArray.length) return '';
    
    const filteredTags = tagArray.filter(tag => tag && tag.trim() !== '' && tag.trim() !== '—' && tag.trim() !== '-');
    if (!filteredTags.length) return '';
    
    return `<div class="tag-group">${filteredTags.map(tag => 
        `<span class="tag tag-${className}">${escapeHtml(tag)}</span>`
    ).join('')}</div>`;
}

function initDescriptionExpand() {
    const descriptions = document.querySelectorAll('.article-description');
    
    descriptions.forEach(desc => {
        const lineHeight = parseFloat(getComputedStyle(desc).lineHeight);
        const maxHeight = lineHeight * 8;
        
        if (desc.scrollHeight > maxHeight + 10) {
            desc.classList.add('expandable');
        }
    });

    document.querySelectorAll('.expand-hint').forEach(hint => {
        hint.addEventListener('click', (e) => {
            e.stopPropagation();
            const desc = hint.previousElementSibling;
            const isExpanded = desc.classList.toggle('expanded');
            hint.textContent = isExpanded ? '▲ Скрыть' : '▼ Показать полностью';
        });
    });
}

// ===== Tag Cloud =====
const TAG_GROUPS = [
    { key: 'companies', label: 'Компании', className: 'companies' },
    { key: 'researchType', label: 'Тип исследования', className: 'research' },
    { key: 'problem', label: 'Проблема', className: 'problem' },
    { key: 'application', label: 'Применение', className: 'application' },
    { key: 'technologies', label: 'Технологии', className: 'tech' },
    { key: 'additional', label: 'Дополнительно', className: 'additional' }
];

function collectTagStats() {
    const stats = {};
    const allItems = getAllItems();
    
    TAG_GROUPS.forEach(group => {
        stats[group.key] = {};
    });
    
    allItems.forEach(item => {
        const tags = item.tags || {};
        TAG_GROUPS.forEach(group => {
            const tagArray = tags[group.key] || [];
            tagArray.forEach(tag => {
                if (tag && tag.trim() && tag.trim() !== '-' && tag.trim() !== '—') {
                    const cleanTag = tag.trim();
                    stats[group.key][cleanTag] = (stats[group.key][cleanTag] || 0) + 1;
                }
            });
        });
    });
    
    return stats;
}

function renderTagCloud() {
    const stats = collectTagStats();
    const container = document.getElementById('tag-cloud-groups');
    
    container.innerHTML = TAG_GROUPS.map(group => {
        const groupStats = stats[group.key];
        const sortedTags = Object.entries(groupStats)
            .sort((a, b) => {
                if (b[1] !== a[1]) return b[1] - a[1];
                return a[0].localeCompare(b[0]);
            })
            .map(([tag, count]) => ({ tag, count }));
        
        if (sortedTags.length === 0) return '';
        
        const needsCollapse = sortedTags.length > 12;
        
        return `
            <div class="tag-cloud-row ${needsCollapse ? 'collapsed' : ''}" data-group="${group.key}">
                <span class="tag-cloud-label">${group.label}:</span>
                <div class="tag-cloud-tags">
                    ${sortedTags.map(({ tag, count }) => `
                        <span class="tag tag-${group.className}" data-tag="${escapeHtml(tag)}" data-group="${group.key}">
                            ${escapeHtml(tag)}<span class="tag-count">${count}</span>
                        </span>
                    `).join('')}
                </div>
                ${needsCollapse ? `<button class="tag-expand-btn" onclick="toggleTagGroup(this)">+${sortedTags.length - 12} ещё</button>` : ''}
            </div>
        `;
    }).join('');
}

function toggleTagGroup(btn) {
    const row = btn.closest('.tag-cloud-row');
    const isCollapsed = row.classList.toggle('collapsed');
    const stats = collectTagStats();
    const groupKey = row.dataset.group;
    const totalTags = Object.keys(stats[groupKey]).length;
    btn.textContent = isCollapsed ? `+${totalTags - 12} ещё` : 'Свернуть';
}

// Multi-tag filter
let activeFilters = {};

function initTagFilter() {
    const resetBtn = document.getElementById('reset-filter');
    
    document.getElementById('tag-cloud-groups').addEventListener('click', (e) => {
        const tagEl = e.target.closest('.tag');
        if (!tagEl) return;
        
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        
        toggleTagFilter(tagValue, groupKey, tagEl);
    });
    
    resetBtn.addEventListener('click', clearAllFilters);
}

function toggleTagFilter(tagValue, groupKey, tagEl) {
    if (!activeFilters[groupKey]) {
        activeFilters[groupKey] = new Set();
    }
    
    if (activeFilters[groupKey].has(tagValue)) {
        activeFilters[groupKey].delete(tagValue);
        tagEl.classList.remove('active');
        
        if (activeFilters[groupKey].size === 0) {
            delete activeFilters[groupKey];
        }
    } else {
        activeFilters[groupKey].add(tagValue);
        tagEl.classList.add('active');
    }
    
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    document.getElementById('reset-filter').style.display = hasActiveFilters ? 'block' : 'none';
    
    updateFilterCount();
    applyMultiFilter();
}

function updateFilterCount() {
    const resetBtn = document.getElementById('reset-filter');
    const totalActive = Object.values(activeFilters).reduce((sum, set) => sum + set.size, 0);
    
    if (totalActive > 0) {
        resetBtn.textContent = `Сбросить фильтр (${totalActive})`;
    }
}

function applyMultiFilter() {
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    const allItems = getAllItems();
    
    // Filter both tables
    const allRows = document.querySelectorAll('#articles-body tr, #external-body tr');
    
    allRows.forEach(row => {
        if (!hasActiveFilters) {
            row.classList.remove('hidden');
            return;
        }
        
        const itemId = parseInt(row.dataset.id);
        const item = allItems.find(a => a.id === itemId);
        
        if (!item) {
            row.classList.add('hidden');
            return;
        }
        
        const tags = item.tags || {};
        
        let matchesAllGroups = true;
        
        for (const [groupKey, selectedTags] of Object.entries(activeFilters)) {
            const articleTags = tags[groupKey] || [];
            const matchesGroup = [...selectedTags].every(selectedTag => 
                articleTags.some(t => t && t.trim() === selectedTag)
            );
            
            if (!matchesGroup) {
                matchesAllGroups = false;
                break;
            }
        }
        
        row.classList.toggle('hidden', !matchesAllGroups);
    });
    
    updateVisibleCount();
    updateTagAvailability();
    updateAnchorCount();
}

function updateVisibleCount() {
    const totalRows = document.querySelectorAll('#articles-body tr, #external-body tr').length;
    const visibleRows = document.querySelectorAll('#articles-body tr:not(.hidden), #external-body tr:not(.hidden)').length;
    
    const subtitle = document.getElementById('site-subtitle');
    const originalSubtitle = currentDiscipline?.subtitle || '';
    
    if (Object.keys(activeFilters).length > 0) {
        subtitle.textContent = `${originalSubtitle} — показано ${visibleRows} из ${totalRows}`;
    } else {
        subtitle.textContent = originalSubtitle;
    }
}

function clearAllFilters() {
    activeFilters = {};
    
    document.querySelectorAll('.tag-cloud .tag').forEach(t => {
        t.classList.remove('active');
        t.classList.remove('disabled');
    });
    
    document.getElementById('reset-filter').style.display = 'none';
    
    document.querySelectorAll('#articles-body tr, #external-body tr').forEach(row => {
        row.classList.remove('hidden');
    });
    
    const subtitle = document.getElementById('site-subtitle');
    subtitle.textContent = currentDiscipline?.subtitle || '';
    updateAnchorCount();
}

function updateAnchorCount() {
    const anchorNav = document.getElementById('anchor-nav');
    if (!anchorNav) return;
    const countEl = anchorNav.querySelector('.anchor-count');
    if (!countEl) return;

    const visibleExternal = document.querySelectorAll('#external-body tr:not(.hidden)').length;
    const totalExternal = document.querySelectorAll('#external-body tr').length;

    if (Object.keys(activeFilters).length > 0) {
        countEl.textContent = `${visibleExternal}/${totalExternal}`;
    } else {
        countEl.textContent = totalExternal;
    }
}

function updateTagAvailability() {
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    
    if (!hasActiveFilters) {
        restoreOriginalCounts();
        document.querySelectorAll('.tag-cloud .tag').forEach(t => {
            t.classList.remove('disabled');
        });
        return;
    }
    
    document.querySelectorAll('.tag-cloud .tag').forEach(tagEl => {
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        const countEl = tagEl.querySelector('.tag-count');
        
        if (activeFilters[groupKey]?.has(tagValue)) {
            tagEl.classList.remove('disabled');
            if (countEl) {
                const currentCount = countArticlesWithTagInCurrent(tagValue, groupKey);
                countEl.textContent = currentCount;
            }
            return;
        }
        
        const potentialCount = countArticlesWithTag(tagValue, groupKey);
        
        if (countEl) {
            countEl.textContent = potentialCount;
        }
        
        tagEl.classList.toggle('disabled', potentialCount === 0);
    });
}

function restoreOriginalCounts() {
    const stats = collectTagStats();
    
    document.querySelectorAll('.tag-cloud .tag').forEach(tagEl => {
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        const countEl = tagEl.querySelector('.tag-count');
        
        if (countEl && stats[groupKey] && stats[groupKey][tagValue]) {
            countEl.textContent = stats[groupKey][tagValue];
        }
    });
}

function countArticlesWithTagInCurrent(tagValue, groupKey) {
    let count = 0;
    const allItems = getAllItems();
    document.querySelectorAll('#articles-body tr:not(.hidden), #external-body tr:not(.hidden)').forEach(row => {
        const itemId = parseInt(row.dataset.id);
        const item = allItems.find(a => a.id === itemId);
        if (!item) return;
        
        const tags = item.tags || {};
        const groupTags = tags[groupKey] || [];
        if (groupTags.some(t => t && t.trim() === tagValue)) {
            count++;
        }
    });
    return count;
}

function countArticlesWithTag(tagValue, groupKey) {
    const testFilters = {};
    for (const [key, tags] of Object.entries(activeFilters)) {
        testFilters[key] = new Set(tags);
    }
    
    if (!testFilters[groupKey]) {
        testFilters[groupKey] = new Set();
    }
    testFilters[groupKey].add(tagValue);
    
    let count = 0;
    const allItems = getAllItems();
    allItems.forEach(item => {
        const tags = item.tags || {};
        
        let matchesAll = true;
        for (const [filterGroup, selectedTags] of Object.entries(testFilters)) {
            const articleTags = tags[filterGroup] || [];
            const matchesGroup = [...selectedTags].every(selectedTag => 
                articleTags.some(t => t && t.trim() === selectedTag)
            );
            
            if (!matchesGroup) {
                matchesAll = false;
                break;
            }
        }
        
        if (matchesAll) count++;
    });
    
    return count;
}

// PDF Modal
function initModal() {
    const modal = document.getElementById('pdf-modal');
    const closeBtn = document.getElementById('modal-close');
    
    closeBtn.addEventListener('click', closePdf);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePdf();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePdf();
    });
}

function openPdf(pdfPath) {
    const modal = document.getElementById('pdf-modal');
    const viewer = document.getElementById('pdf-viewer');
    
    viewer.src = pdfPath;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePdf() {
    const modal = document.getElementById('pdf-modal');
    const viewer = document.getElementById('pdf-viewer');
    
    modal.classList.remove('active');
    viewer.src = '';
    document.body.style.overflow = '';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseMarkdown(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    html = html.replace(/\\n\\n/g, '</p><p>');
    html = html.replace(/\\n/g, '<br>');
    
    if (html.includes('</p><p>')) {
        html = '<p>' + html + '</p>';
    }
    
    return html;
}

function showEmptyState() {
    document.getElementById('articles-body').innerHTML = `
        <tr>
            <td colspan="3">
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <p>Нет статей в этом разделе. Добавьте статьи в config.json</p>
                </div>
            </td>
        </tr>
    `;
}

function showError() {
    document.querySelector('.container').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <p>Ошибка загрузки config.json</p>
        </div>
    `;
}

// ===== Scroll to Top =====
function initScrollToTop() {
    const btn = document.getElementById('scroll-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    });

    btn.addEventListener('click', () => {
        const tagCloud = document.getElementById('tag-cloud');
        if (tagCloud) {
            tagCloud.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

document.addEventListener('DOMContentLoaded', initScrollToTop);
