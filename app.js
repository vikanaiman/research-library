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

// Multi-tag filter - stores active tags by group
let activeFilters = {}; // { groupKey: Set of tags }

function initTagFilter() {
    const resetBtn = document.getElementById('reset-filter');
    
    // Click on tag cloud tags
    document.getElementById('tag-cloud-groups').addEventListener('click', (e) => {
        const tagEl = e.target.closest('.tag');
        if (!tagEl) return;
        
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        
        toggleTagFilter(tagValue, groupKey, tagEl);
    });
    
    // Reset button
    resetBtn.addEventListener('click', clearAllFilters);
}

function toggleTagFilter(tagValue, groupKey, tagEl) {
    // Initialize set for group if not exists
    if (!activeFilters[groupKey]) {
        activeFilters[groupKey] = new Set();
    }
    
    // Toggle tag in the set
    if (activeFilters[groupKey].has(tagValue)) {
        activeFilters[groupKey].delete(tagValue);
        tagEl.classList.remove('active');
        
        // Clean up empty groups
        if (activeFilters[groupKey].size === 0) {
            delete activeFilters[groupKey];
        }
    } else {
        activeFilters[groupKey].add(tagValue);
        tagEl.classList.add('active');
    }
    
    // Update reset button visibility
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    document.getElementById('reset-filter').style.display = hasActiveFilters ? 'block' : 'none';
    
    // Update active filter count display
    updateFilterCount();
    
    // Apply filters to table
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
    const rows = document.querySelectorAll('#articles-body tr');
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    
    rows.forEach(row => {
        if (!hasActiveFilters) {
            row.classList.remove('hidden');
            return;
        }
        
        const articleId = parseInt(row.dataset.id);
        const article = config.articles.find(a => a.id === articleId);
        
        if (!article) {
            row.classList.add('hidden');
            return;
        }
        
        const tags = article.tags || {};
        
        // Article must match ALL active filter groups (AND between groups)
        // Within a group, article must match ALL selected tags (AND within group)
        let matchesAllGroups = true;
        
        for (const [groupKey, selectedTags] of Object.entries(activeFilters)) {
            const articleTags = tags[groupKey] || [];
            // Check that article has ALL selected tags in this group
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
    
    // Update visible count
    updateVisibleCount();
    
    // Update tag availability based on visible articles
    updateTagAvailability();
}

function updateVisibleCount() {
    const totalRows = document.querySelectorAll('#articles-body tr').length;
    const visibleRows = document.querySelectorAll('#articles-body tr:not(.hidden)').length;
    
    // Update subtitle with count if filtering
    const subtitle = document.getElementById('site-subtitle');
    const originalSubtitle = config.site?.subtitle || '';
    
    if (Object.keys(activeFilters).length > 0) {
        subtitle.textContent = `${originalSubtitle} — показано ${visibleRows} из ${totalRows}`;
    } else {
        subtitle.textContent = originalSubtitle;
    }
}

function clearAllFilters() {
    activeFilters = {};
    
    // Remove active and disabled states from all tags
    document.querySelectorAll('.tag-cloud .tag').forEach(t => {
        t.classList.remove('active');
        t.classList.remove('disabled');
    });
    
    // Hide reset button
    document.getElementById('reset-filter').style.display = 'none';
    
    // Show all rows
    document.querySelectorAll('#articles-body tr').forEach(row => {
        row.classList.remove('hidden');
    });
    
    // Restore original subtitle
    const subtitle = document.getElementById('site-subtitle');
    subtitle.textContent = config.site?.subtitle || '';
}

/**
 * Update tag availability - disable tags that would result in zero articles
 * and update counts to show how many articles would match
 */
function updateTagAvailability() {
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    
    // If no filters active, restore original counts and enable all tags
    if (!hasActiveFilters) {
        restoreOriginalCounts();
        document.querySelectorAll('.tag-cloud .tag').forEach(t => {
            t.classList.remove('disabled');
        });
        return;
    }
    
    // For each tag, calculate how many articles would match if selected
    document.querySelectorAll('.tag-cloud .tag').forEach(tagEl => {
        const tagValue = tagEl.dataset.tag;
        const groupKey = tagEl.dataset.group;
        const countEl = tagEl.querySelector('.tag-count');
        
        // If this tag is already active, show current visible count
        if (activeFilters[groupKey]?.has(tagValue)) {
            tagEl.classList.remove('disabled');
            if (countEl) {
                const currentCount = countArticlesWithTagInCurrent(tagValue, groupKey);
                countEl.textContent = currentCount;
            }
            return;
        }
        
        // Calculate how many articles would match if this tag is added
        const potentialCount = countArticlesWithTag(tagValue, groupKey);
        
        // Update the count display
        if (countEl) {
            countEl.textContent = potentialCount;
        }
        
        // Disable if zero results
        tagEl.classList.toggle('disabled', potentialCount === 0);
    });
}

/**
 * Restore original tag counts (total articles with each tag)
 */
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

/**
 * Count articles that currently have this tag (among visible articles)
 */
function countArticlesWithTagInCurrent(tagValue, groupKey) {
    let count = 0;
    document.querySelectorAll('#articles-body tr:not(.hidden)').forEach(row => {
        const articleId = parseInt(row.dataset.id);
        const article = config.articles.find(a => a.id === articleId);
        if (!article) return;
        
        const tags = article.tags || {};
        const groupTags = tags[groupKey] || [];
        if (groupTags.some(t => t && t.trim() === tagValue)) {
            count++;
        }
    });
    return count;
}

/**
 * Count how many articles would match if adding a tag to current filters
 */
function countArticlesWithTag(tagValue, groupKey) {
    // Create a copy of active filters with the new tag added
    const testFilters = {};
    for (const [key, tags] of Object.entries(activeFilters)) {
        testFilters[key] = new Set(tags);
    }
    
    if (!testFilters[groupKey]) {
        testFilters[groupKey] = new Set();
    }
    testFilters[groupKey].add(tagValue);
    
    // Count articles matching these filters
    let count = 0;
    config.articles.forEach(article => {
        const tags = article.tags || {};
        
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
