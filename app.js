/**
 * Research Library - Dynamic content loader
 */
let config = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load config');
        config = await response.json();
        renderPage();
        initModal();
    } catch (error) {
        console.error('Error loading config:', error);
        showError();
    }
});

function renderPage() {
    // Site title
    if (config.site) {
        document.getElementById('site-title').textContent = config.site.title || '';
        document.getElementById('site-subtitle').textContent = config.site.subtitle || '';
        document.title = config.site.title || 'Research Library';
    }

    // Tag cloud
    if (config.articles && config.articles.length) {
        renderTagCloud();
    }

    // Articles table
    if (config.articles && config.articles.length) {
        const tbody = document.getElementById('articles-body');
        tbody.innerHTML = config.articles.map(article => renderArticleRow(article)).join('');
        initDescriptionExpand();
        initTagFilter();
    } else {
        showEmptyState();
    }
}

function renderArticleRow(article) {
    const pdfPath = (config.pdfBasePath || './') + article.pdf;
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

function renderTagGroup(tagArray, className) {
    // Filter out empty arrays and "-" tags
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
        // Check if text overflows (more than 8 lines)
        const lineHeight = parseFloat(getComputedStyle(desc).lineHeight);
        const maxHeight = lineHeight * 8;
        
        if (desc.scrollHeight > maxHeight + 10) {
            desc.classList.add('expandable');
        }
    });

    // Toggle expand on hint click
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
    
    TAG_GROUPS.forEach(group => {
        stats[group.key] = {};
    });
    
    config.articles.forEach(article => {
        const tags = article.tags || {};
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
                // Sort by count descending, then alphabetically
                if (b[1] !== a[1]) return b[1] - a[1];
                return a[0].localeCompare(b[0]);
            })
            .map(([tag, count]) => ({ tag, count }));
        
        if (sortedTags.length === 0) return '';
        
        const needsCollapse = sortedTags.length > 12; // Roughly 2 rows
        
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

let activeFilter = null;

function initTagFilter() {
    const resetBtn = document.getElementById('reset-filter');
    
    // Click on tag cloud tags
    document.getElementById('tag-cloud-groups').addEventListener('click', (e) => {
        const tagEl = e.target.closest('.tag');
        if (!tagEl) return;
        
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        
        // Toggle filter
        if (activeFilter && activeFilter.tag === tagValue && activeFilter.group === groupKey) {
            clearFilter();
        } else {
            applyFilter(tagValue, groupKey, tagEl);
        }
    });
    
    // Reset button
    resetBtn.addEventListener('click', clearFilter);
}

function applyFilter(tagValue, groupKey, tagEl) {
    activeFilter = { tag: tagValue, group: groupKey };
    
    // Highlight active tag
    document.querySelectorAll('.tag-cloud .tag').forEach(t => t.classList.remove('active'));
    tagEl.classList.add('active');
    
    // Show reset button
    document.getElementById('reset-filter').style.display = 'block';
    
    // Filter table rows
    const rows = document.querySelectorAll('#articles-body tr');
    rows.forEach(row => {
        const articleId = parseInt(row.dataset.id);
        const article = config.articles.find(a => a.id === articleId);
        
        if (article) {
            const tags = article.tags || {};
            const groupTags = tags[groupKey] || [];
            const hasTag = groupTags.some(t => t && t.trim() === tagValue);
            
            row.classList.toggle('hidden', !hasTag);
        }
    });
}

function clearFilter() {
    activeFilter = null;
    
    // Remove active state from tags
    document.querySelectorAll('.tag-cloud .tag').forEach(t => t.classList.remove('active'));
    
    // Hide reset button
    document.getElementById('reset-filter').style.display = 'none';
    
    // Show all rows
    document.querySelectorAll('#articles-body tr').forEach(row => {
        row.classList.remove('hidden');
    });
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
    
    // Use browser's built-in PDF viewer
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

/**
 * Simple markdown parser for descriptions
 * Supports: **bold**, *italic*, \n for line breaks
 */
function parseMarkdown(text) {
    if (!text) return '';
    
    // First escape HTML
    let html = escapeHtml(text);
    
    // Convert markdown to HTML
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Line breaks: \n\n for paragraphs, \n for <br>
    html = html.replace(/\\n\\n/g, '</p><p>');
    html = html.replace(/\\n/g, '<br>');
    
    // Wrap in paragraph if contains paragraph breaks
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
                    <p>Нет статей. Добавьте статьи в config.json</p>
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
