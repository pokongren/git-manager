/**
 * Git 管理工具 - 前端交互逻辑
 * 处理所有与后端 API 的通信以及 UI 状态管理
 */

const API_BASE = '';

// ==================== 工具函数 ====================

/**
 * 封装 API 请求，统一处理错误
 * @param {string} url - API 路径
 * @param {object} options - fetch 选项
 * @returns {Promise<object>} 响应 JSON
 */
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || '请求失败');
        }

        return data;
    } catch (error) {
        if (error.message === 'Failed to fetch') {
            throw new Error('无法连接到服务器，请确认后端已启动');
        }
        throw error;
    }
}

/**
 * 显示 Toast 通知
 * @param {string} message - 通知文本
 * @param {'success'|'error'|'info'} type - 通知类型
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    // NOTE: 3 秒后自动移除，带淡出动画
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 格式化日期字符串为更友好的格式
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return `${diffMin} 分钟前`;
        if (diffHour < 24) return `${diffHour} 小时前`;
        if (diffDay < 7) return `${diffDay} 天前`;

        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

// ==================== 导航切换 ====================

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const panelId = item.dataset.panel;
        if (!panelId) return;

        // 更新导航选中状态
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // 切换面板显示
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`panel-${panelId}`);
        if (panel) {
            panel.classList.remove('active');
            // NOTE: 触发重排以重新播放动画
            void panel.offsetWidth;
            panel.classList.add('active');
        }

        // 切换到对应面板时加载数据
        const loaders = {
            status: loadStatus,
            branches: loadBranchTree,
            backup: () => { loadTags(); loadStashes(); },
            history: loadHistory,
            remote: loadRemoteInfo,
        };
        if (loaders[panelId]) loaders[panelId]();
    });
});

// ==================== 仓库连接 ====================

/**
 * 调用后端打开系统原生文件夹选择对话框
 * NOTE: 通过后端的 tkinter 弹出文件选择窗口，避免浏览器安全限制
 */
async function browseFolderDialog() {
    const browseBtn = document.getElementById('btn-browse');
    // 按钮加载态，防止重复点击
    browseBtn.disabled = true;
    const originalContent = browseBtn.innerHTML;
    browseBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        选择中…
    `;

    try {
        const result = await apiRequest('/api/dialog/browse-folder');
        if (result.success && result.path) {
            document.getElementById('repo-path-input').value = result.path;
            // NOTE: 选好文件夹后自动聚焦「连接」按钮，用户直接回车即可
            document.getElementById('btn-connect').focus();
        }
    } catch (error) {
        showToast('无法打开文件夹选择对话框：' + error.message, 'error');
    } finally {
        browseBtn.disabled = false;
        browseBtn.innerHTML = originalContent;
    }
}

/**
 * 连接到指定路径的 Git 仓库
 */
async function connectRepo() {
    const input = document.getElementById('repo-path-input');
    const path = input.value.trim();

    if (!path) {
        showToast('请输入仓库路径', 'error');
        return;
    }

    try {
        const data = await apiRequest('/api/repo/open', {
            method: 'POST',
            body: JSON.stringify({ path }),
        });
        showToast(data.message, 'success');
        // NOTE: 连接成功后保存到最近仓库列表
        saveRecentRepo(path);
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 刷新仓库信息并更新 UI
 */
async function refreshRepoInfo() {
    try {
        const info = await apiRequest('/api/repo/info');

        const dot = document.querySelector('.repo-dot');
        const display = document.getElementById('repo-path-display');
        const branchBadge = document.getElementById('current-branch-badge');
        const branchName = document.getElementById('current-branch-name');
        const infoCard = document.getElementById('repo-info-card');

        if (info.connected) {
            dot.classList.add('connected');
            display.textContent = info.path;

            branchBadge.style.display = 'flex';
            branchName.textContent = info.current_branch || 'HEAD';

            // 更新连接信息卡片
            infoCard.style.display = 'block';
            document.getElementById('info-root').textContent = info.root || '-';
            document.getElementById('info-branch').textContent = info.current_branch || '-';
            document.getElementById('info-remote').textContent = info.remotes ? info.remotes.split('\n')[0] : '无';
        } else {
            dot.classList.remove('connected');
            display.textContent = '未连接仓库';
            branchBadge.style.display = 'none';
            infoCard.style.display = 'none';
        }
    } catch (error) {
        // NOTE: 静默失败，不影响用户体验
        console.error('刷新仓库信息失败:', error);
    }
}

// NOTE: 回车键快速连接仓库
document.getElementById('repo-path-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectRepo();
});

// ==================== 仓库状态 ====================

// NOTE: 保存当前文件列表数据，供勾选和暂存使用
let currentStatusFiles = [];

/**
 * 获取文件的状态类型
 * @param {string} statusText - 状态描述文本
 * @returns {string} CSS 类名
 */
function getStatusClass(statusText) {
    if (statusText.includes('修改')) return 'modified';
    if (statusText.includes('新增')) return 'added';
    if (statusText.includes('删除')) return 'deleted';
    return 'untracked';
}

/**
 * 加载当前仓库的工作区状态
 */
async function loadStatus() {
    try {
        const data = await apiRequest('/api/status');
        const cleanMsg = document.getElementById('status-clean-msg');
        const filesContainer = document.getElementById('status-files-container');
        const fileList = document.getElementById('status-file-list');
        const helpTip = document.getElementById('status-help-tip');
        const conflictWarning = document.getElementById('status-conflict-warning');

        // Check if merging
        if (data.is_merging) {
            if (conflictWarning) conflictWarning.style.display = 'flex';
        } else {
            if (conflictWarning) conflictWarning.style.display = 'none';
        }

        if (data.clean) {
            cleanMsg.style.display = 'flex';
            filesContainer.style.display = 'none';
            helpTip.style.display = 'none';
            currentStatusFiles = [];
        } else {
            cleanMsg.style.display = 'none';
            filesContainer.style.display = 'block';
            helpTip.style.display = 'flex';

            currentStatusFiles = data.files.map(f => ({
                ...f,
                selected: false,
                statusText: f.working || f.index || '未知',
            }));

            renderStatusStats();
            renderFileList();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 渲染文件变更统计条
 */
function renderStatusStats() {
    const stats = document.getElementById('status-stats');
    const counts = { modified: 0, added: 0, deleted: 0, untracked: 0 };
    const labels = { modified: '已修改', added: '新增', deleted: '已删除', untracked: '未跟踪' };

    currentStatusFiles.forEach(f => {
        const cls = getStatusClass(f.statusText);
        counts[cls] = (counts[cls] || 0) + 1;
    });

    // NOTE: 只显示数量 > 0 的类型
    stats.innerHTML = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([type, count]) =>
            `<span class="stat-item ${type}">${labels[type]} ${count} 个文件</span>`
        ).join('') +
        `<span class="stat-item" style="background:var(--bg-tertiary);color:var(--color-text-secondary);">共 ${currentStatusFiles.length} 个变更</span>`;
}

/**
 * 渲染文件列表（带复选框）
 */
function renderFileList() {
    const fileList = document.getElementById('status-file-list');

    fileList.innerHTML = currentStatusFiles.map((file, i) => {
        const statusClass = getStatusClass(file.statusText);
        return `
            <div class="file-item ${file.selected ? 'selected' : ''}"
                 style="animation-delay: ${i * 30}ms"
                 onclick="toggleFileSelect(${i})" id="file-item-${i}">
                <input type="checkbox" ${file.selected ? 'checked' : ''} 
                       onclick="event.stopPropagation(); toggleFileSelect(${i})">
                <span class="file-status ${statusClass}">${file.statusText}</span>
                <span class="file-path">${escapeHtml(file.path)}</span>
                <button class="btn btn-sm btn-ghost file-diff-btn" onclick="event.stopPropagation(); showFileDiff('${escapeAttr(file.path)}')"
                    title="查看 Diff">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    updateSelectedCount();
}

/**
 * 切换单个文件的选中状态
 * @param {number} index - 文件在列表中的索引
 */
function toggleFileSelect(index) {
    currentStatusFiles[index].selected = !currentStatusFiles[index].selected;
    const item = document.getElementById(`file-item-${index}`);
    const checkbox = item.querySelector('input[type="checkbox"]');

    if (currentStatusFiles[index].selected) {
        item.classList.add('selected');
        checkbox.checked = true;
    } else {
        item.classList.remove('selected');
        checkbox.checked = false;
    }

    updateSelectedCount();
    updateSelectAllCheckbox();
}

/**
 * 全选 / 取消全选
 */
function toggleSelectAll() {
    const checkbox = document.getElementById('select-all-checkbox');
    const selectAll = checkbox.checked;

    currentStatusFiles.forEach((f, i) => {
        f.selected = selectAll;
        const item = document.getElementById(`file-item-${i}`);
        if (item) {
            const cb = item.querySelector('input[type="checkbox"]');
            cb.checked = selectAll;
            if (selectAll) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        }
    });

    updateSelectedCount();
}

/**
 * 更新"全选"复选框的状态（全选 / 半选 / 未选）
 */
function updateSelectAllCheckbox() {
    const checkbox = document.getElementById('select-all-checkbox');
    const selectedCount = currentStatusFiles.filter(f => f.selected).length;
    const total = currentStatusFiles.length;

    checkbox.checked = selectedCount === total && total > 0;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < total;
}

/**
 * 更新已选文件数量显示
 */
function updateSelectedCount() {
    const count = currentStatusFiles.filter(f => f.selected).length;
    document.getElementById('selected-count').textContent = count;
}

/**
 * 暂存选中的文件
 */
async function stageSelected() {
    const selectedFiles = currentStatusFiles.filter(f => f.selected).map(f => f.path);

    if (selectedFiles.length === 0) {
        showToast('请先勾选要暂存的文件', 'error');
        return;
    }

    try {
        await apiRequest('/api/stage', {
            method: 'POST',
            body: JSON.stringify({ message: '', files: selectedFiles }),
        });
        showToast(`已暂存 ${selectedFiles.length} 个文件`, 'success');
        loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 暂存所有更改
 */
async function stageAll() {
    try {
        await apiRequest('/api/stage', {
            method: 'POST',
            body: JSON.stringify({ message: '' }),
        });
        showToast('所有文件已暂存', 'success');
        loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 提交当前暂存的更改
 */
async function commitChanges() {
    const msgInput = document.getElementById('commit-msg-input');
    const message = msgInput.value.trim();

    if (!message) {
        showToast('请输入提交信息', 'error');
        return;
    }

    try {
        await apiRequest('/api/commit', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
        showToast('提交成功', 'success');
        msgInput.value = '';
        // NOTE: 提交成功后重置类型选择器
        document.getElementById('commit-type-select').selectedIndex = 0;
        loadStatus();
        refreshRepoInfo(); // Also refresh info to update ahead/behind if needed
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 中止并放弃当前的合并
 */
async function abortMerge() {
    showConfirmModal(
        '中止合并',
        '确定要放弃当前的合并操作吗？未被 Git 保存的本地更改将会丢失。',
        async () => {
            try {
                await apiRequest('/api/merge/abort', { method: 'POST' });
                showToast('合并已中止', 'success');
                loadStatus();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

/**
 * 选择提交类型后，自动将前缀填入提交信息输入框
 * NOTE: 如果输入框里已有其他类型前缀，会自动替换
 */
function applyCommitType() {
    const select = document.getElementById('commit-type-select');
    const input = document.getElementById('commit-msg-input');
    const prefix = select.value;

    if (!prefix) return;

    // 移除已有的类型前缀（如 "feat: "、"fix: " 等）
    const knownPrefixes = ['feat: ', 'fix: ', 'docs: ', 'style: ', 'refactor: ', 'perf: ', 'chore: ', 'data: '];
    let currentMsg = input.value;
    for (const p of knownPrefixes) {
        if (currentMsg.startsWith(p)) {
            currentMsg = currentMsg.substring(p.length);
            break;
        }
    }

    input.value = prefix + currentMsg;
    input.focus();
}

// ==================== 分支管理 ====================

/**
 * 加载并渲染分支关系树
 * NOTE: 从 /api/branch-tree 获取结构化数据，绘制主干+分支的可视化树
 * NOTE: 同时获取备份标签数据，在头部卡片显示备份快捷入口
 */
async function loadBranchTree() {
    try {
        // NOTE: 并行请求分支树和备份标签数据
        const [data, tagData] = await Promise.all([
            apiRequest('/api/branch-tree'),
            apiRequest('/api/tags').catch(() => ({ tags: [] })),
        ]);
        const container = document.getElementById('branch-tree');
        const backupCount = tagData.tags ? tagData.tags.length : 0;

        if (!data.main_commits || data.main_commits.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>暂无提交记录</h3><p>该仓库还没有任何提交</p></div>';
            return;
        }

        // NOTE: 将分支按分叉点分组，以便在正确的主干提交位置插入分支
        const branchesByBase = {};
        data.branches.forEach((b, idx) => {
            const base = b.merge_base || '';
            if (!branchesByBase[base]) branchesByBase[base] = [];
            branchesByBase[base].push({ ...b, colorIdx: idx % 6 });
        });

        let html = '<div class="tree-trunk">';

        // NOTE: 渲染主干头部（当前状态 + 备份快捷入口）
        const headCommit = data.main_commits[0];
        const isMainCurrent = data.current_branch === data.main_branch;
        html += `
            <div class="tree-node tree-head-node">
                <div class="tree-head ${isMainCurrent ? 'is-current' : ''}">
                    <div class="tree-head-main">
                        <span class="tree-badge">${escapeHtml(data.main_branch)}</span>
                        ${isMainCurrent ? '<span class="tree-status">● 当前</span>' : ''}
                        <span class="tree-hash">${headCommit.short_hash}</span>
                        <span class="tree-msg">${escapeHtml(headCommit.message)}</span>
                    </div>
                    <div class="tree-head-actions">
                        ${backupCount > 0 ? `
                        <button class="btn btn-sm btn-outline backup-shortcut" onclick="navigateToBackup()" title="查看备份还原点">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                            </svg>
                            ⏱ ${backupCount} 个备份点
                        </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline" onclick="quickCreateBackup()" title="快速创建备份">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            + 备份
                        </button>
                    </div>
                </div>
            </div>
        `;

        // NOTE: 找不到分叉点（即在最新提交上)的分支，直接放在头部下方
        const topBranches = branchesByBase[''] || [];
        // HACK: 如果分支的 merge_base 等于最新提交，也算顶部分支
        const headHash = headCommit.short_hash;
        const headFullHash = headCommit.hash.substring(0, 7);

        data.branches.forEach((b, idx) => {
            if (b.merge_base === headHash || b.merge_base === headFullHash) {
                if (!topBranches.find(tb => tb.name === b.name)) {
                    topBranches.push({ ...b, colorIdx: idx % 6 });
                }
            }
        });

        topBranches.forEach(b => {
            html += renderBranchNode(b, data.main_branch);
        });

        // NOTE: 渲染主干的提交历史，在对应位置插入分支
        for (let i = 1; i < data.main_commits.length; i++) {
            const commit = data.main_commits[i];
            const commitShort = commit.hash.substring(0, 7);

            html += `
                <div class="tree-node">
                    <div class="tree-commit">
                        <span class="commit-hash">${commit.short_hash}</span>
                        <span class="commit-msg">${escapeHtml(commit.message)}</span>
                        <span class="commit-date">${formatShortDate(commit.date)}</span>
                    </div>
                </div>
            `;

            // NOTE: 在提交节点后渲染从此处分叉的分支
            const branchesHere = branchesByBase[commitShort] || branchesByBase[commit.short_hash] || [];
            // 也检查完整 hash 前7位
            const branchesHere2 = branchesByBase[commitShort] ? [] : (branchesByBase[commit.hash.substring(0, 7)] || []);
            [...branchesHere, ...branchesHere2].forEach(b => {
                // 排除已经在顶部渲染过的
                if (!topBranches.find(tb => tb.name === b.name)) {
                    html += renderBranchNode(b, data.main_branch);
                }
            });
        }

        // NOTE: 如果还有未匹配到分叉点的分支，放在最底部
        const renderedNames = new Set(topBranches.map(b => b.name));
        data.main_commits.forEach(c => {
            const k1 = c.hash.substring(0, 7);
            const k2 = c.short_hash;
            (branchesByBase[k1] || []).forEach(b => renderedNames.add(b.name));
            (branchesByBase[k2] || []).forEach(b => renderedNames.add(b.name));
        });

        data.branches.forEach((b, idx) => {
            if (!renderedNames.has(b.name)) {
                html += renderBranchNode({ ...b, colorIdx: idx % 6 }, data.main_branch);
            }
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 渲染一个分支节点（从主干分叉出去的卡片）
 * @param {Object} branch - 分支数据
 * @param {string} mainBranch - 主干分支名称
 * @returns {string} HTML
 */
function renderBranchNode(branch, mainBranch) {
    const isCurrent = branch.current;
    const aheadText = branch.ahead > 0 ? `领先 ${branch.ahead} 个提交` : '';
    const behindText = branch.behind > 0 ? `落后 ${branch.behind} 个提交` : '';

    return `
        <div class="tree-node is-branch">
            <div class="tree-branch" data-color="${branch.colorIdx}">
                <div class="branch-card ${isCurrent ? 'is-current' : ''}">
                    <div class="b-header">
                        <span class="b-name" ondblclick="inlineRenameBranch(this, '${escapeAttr(branch.name)}')" title="双击重命名">
                            ${escapeHtml(branch.name)}
                            ${isCurrent ? ' <span style="color:var(--color-success);">● 当前</span>' : ''}
                        </span>
                        <span class="b-meta b-meta-editable" ondblclick="inlineEditDescription(this, '${escapeAttr(branch.name)}', '${escapeAttr(branch.description || '')}')" title="双击编辑备注">
                            <span>${branch.hash}</span>
                            ${branch.message ? `<span>— ${escapeHtml(branch.message)}</span>` : ''}
                        </span>
                    </div>
                    ${branch.description ? `
                        <div class="b-description" ondblclick="inlineEditDescription(this, '${escapeAttr(branch.name)}', '${escapeAttr(branch.description)}')" title="双击编辑备注">
                            <span class="b-desc-icon">📝</span>
                            <span>${escapeHtml(branch.description)}</span>
                        </div>
                    ` : ''}
                    ${branch.diff_summary ? `
                        <div class="b-diff-summary">
                            <span class="b-desc-icon">📊</span>
                            <span>${escapeHtml(branch.diff_summary)}</span>
                        </div>
                    ` : ''}
                    <div class="b-meta">
                        ${aheadText ? `<span class="b-stat ahead">↑ ${aheadText}</span>` : ''}
                        ${behindText ? `<span class="b-stat behind">↓ ${behindText}</span>` : ''}
                    </div>
                    <div class="b-actions">
                        <button class="btn btn-sm btn-ghost" onclick="showEditBranch('${escapeAttr(branch.name)}', '${escapeAttr(branch.description || '')}')" title="编辑分支">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        ${!isCurrent ? `
                            <button class="btn btn-sm btn-outline" onclick="switchBranch('${escapeAttr(branch.name)}')">切换</button>
                            <button class="btn btn-sm btn-outline" onclick="mergeBranch('${escapeAttr(branch.name)}')">合并到 ${escapeHtml(mainBranch)}</button>
                        ` : ''}
                        <button class="btn btn-sm btn-ghost" onclick="confirmDeleteBranch('${escapeAttr(branch.name)}')" title="删除分支">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 格式化日期为简短格式
 * @param {string} dateStr - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatShortDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays}天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

        return `${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
        return '';
    }
}

async function showCreateBranch() {
    document.getElementById('create-branch-form').style.display = 'block';
    // 拉取所有分支填充下拉菜单
    try {
        const data = await apiRequest('/api/branches');
        const select = document.getElementById('new-branch-source');
        const current = select.value;
        select.innerHTML = '<option value="">默认基于当前分支</option>';
        (data.branches || []).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.name;
            opt.textContent = b.name + (b.is_current ? '  ✦ 当前' : '');
            if (b.is_current) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (_) {
        // 拉取失败时保持默认选项即可
    }
}

function hideCreateBranch() {
    document.getElementById('create-branch-form').style.display = 'none';
    document.getElementById('new-branch-name').value = '';
    document.getElementById('new-branch-source').selectedIndex = 0;
}

/**
 * 创建新分支
 */
async function createBranch() {
    const name = document.getElementById('new-branch-name').value.trim();
    const source = document.getElementById('new-branch-source').value.trim();

    if (!name) {
        showToast('请输入分支名称', 'error');
        return;
    }

    try {
        await apiRequest('/api/branches/create', {
            method: 'POST',
            body: JSON.stringify({ name, source: source || null }),
        });
        showToast(`分支 '${name}' 创建成功`, 'success');
        hideCreateBranch();
        loadBranchTree();
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 切换到指定分支
 * @param {string} name - 分支名
 */
async function switchBranch(name) {
    try {
        await apiRequest('/api/branches/switch', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
        showToast(`已切换到分支 '${name}'`, 'success');
        loadBranchTree();
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 合并指定分支到当前分支
 * @param {string} name - 要合并的分支名
 */
async function mergeBranch(name) {
    showConfirmModal(
        '合并分支',
        `确定要将分支 "${name}" 合并到当前分支吗？`,
        async () => {
            try {
                await apiRequest('/api/branches/merge', {
                    method: 'POST',
                    body: JSON.stringify({ source_branch: name }),
                });
                showToast(`分支 '${name}' 合并成功`, 'success');
                loadBranchTree();
                refreshRepoInfo();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

/**
 * 确认删除分支
 * @param {string} name - 分支名
 */
function confirmDeleteBranch(name) {
    showConfirmModal(
        '删除分支',
        `确定要删除分支 "${name}" 吗？此操作不可撤销。`,
        async () => {
            try {
                await apiRequest('/api/branches/delete', {
                    method: 'POST',
                    body: JSON.stringify({ name }),
                });
                showToast(`分支 '${name}' 已删除`, 'success');
                loadBranchTree();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

/**
 * 显示编辑分支弹窗（重命名 + 修改备注）
 * @param {string} name - 当前分支名
 * @param {string} description - 当前备注
 */
function showEditBranch(name, description) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');

    document.getElementById('modal-title').textContent = '✏️ 编辑分支';
    document.getElementById('modal-message').innerHTML = `
        <div class="edit-branch-form">
            <div class="input-group">
                <label>分支名称</label>
                <input type="text" id="edit-branch-name" value="${escapeAttr(name)}" spellcheck="false">
            </div>
            <div class="input-group">
                <label>分支备注 <span style="color:var(--color-muted);font-weight:400;">（描述这个分支的用途）</span></label>
                <input type="text" id="edit-branch-desc" value="${escapeAttr(description)}" placeholder="例如：新增拓扑分支功能" spellcheck="false">
            </div>
        </div>
    `;
    overlay.style.display = 'flex';

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const newBtn = confirmBtn.cloneNode(true);
    newBtn.textContent = '保存';
    newBtn.className = 'btn btn-primary';
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    // NOTE: 存储原始名称用于判断是否需要重命名
    newBtn.dataset.originalName = name;
    newBtn.addEventListener('click', async () => {
        await saveEditBranch(name);
    });
}

/**
 * 保存编辑分支的修改（重命名和/或备注）
 * NOTE: 先处理重命名，再保存备注，最后刷新分支树
 * @param {string} originalName - 原始分支名
 */
async function saveEditBranch(originalName) {
    const newName = document.getElementById('edit-branch-name').value.trim();
    const newDesc = document.getElementById('edit-branch-desc').value.trim();

    if (!newName) {
        showToast('分支名称不能为空', 'error');
        return;
    }

    closeModal();

    try {
        let currentName = originalName;

        // NOTE: 如果名称变了，先执行重命名
        if (newName !== originalName) {
            await apiRequest('/api/branches/rename', {
                method: 'POST',
                body: JSON.stringify({ old_name: originalName, new_name: newName }),
            });
            showToast(`分支已重命名: '${originalName}' → '${newName}'`, 'success');
            currentName = newName;
        }

        // NOTE: 保存备注
        await apiRequest('/api/branches/description', {
            method: 'POST',
            body: JSON.stringify({ name: currentName, description: newDesc }),
        });
        if (newName === originalName) {
            showToast('分支备注已更新', 'success');
        }

        loadBranchTree();
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 双击分支名称，原地变成可编辑输入框
 * NOTE: 回车或失焦保存，ESC 取消
 * @param {HTMLElement} el - 被双击的 b-name 元素
 * @param {string} currentName - 当前分支名
 */
function inlineRenameBranch(el, currentName) {
    // NOTE: 防止重复触发
    if (el.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'inline-rename-input';
    input.spellcheck = false;

    // 清空元素内容，替换为输入框
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let saved = false;

    /**
     * 执行重命名保存
     */
    async function doSave() {
        if (saved) return;
        saved = true;
        const newName = input.value.trim();

        if (!newName || newName === currentName) {
            // NOTE: 没有变化，直接恢复原始显示
            loadBranchTree();
            return;
        }

        try {
            await apiRequest('/api/branches/rename', {
                method: 'POST',
                body: JSON.stringify({ old_name: currentName, new_name: newName }),
            });
            showToast(`分支已重命名: '${currentName}' → '${newName}'`, 'success');
            loadBranchTree();
            refreshRepoInfo();
        } catch (error) {
            showToast(error.message, 'error');
            loadBranchTree();
        }
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            saved = true;
            loadBranchTree();
        }
    });

    input.addEventListener('blur', doSave);
}

/**
 * 双击编辑分支备注（行内编辑）
 * NOTE: 原地变成输入框，回车/失焦保存，ESC 取消
 * @param {HTMLElement} el - 被双击的元素
 * @param {string} branchName - 分支名
 * @param {string} currentDesc - 当前备注
 */
function inlineEditDescription(el, branchName, currentDesc) {
    // NOTE: 防止重复触发
    if (el.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentDesc;
    input.className = 'inline-rename-input';
    input.style.width = '100%';
    input.placeholder = '输入分支备注，如：新增拓扑分支功能';
    input.spellcheck = false;

    el.innerHTML = '📝 ';
    el.appendChild(input);
    input.focus();
    input.select();

    let saved = false;

    async function doSave() {
        if (saved) return;
        saved = true;
        const newDesc = input.value.trim();

        // NOTE: 没变化则跳过
        if (newDesc === currentDesc) {
            loadBranchTree();
            return;
        }

        try {
            await apiRequest('/api/branches/description', {
                method: 'POST',
                body: JSON.stringify({ name: branchName, description: newDesc }),
            });
            showToast(newDesc ? '分支备注已更新' : '分支备注已清除', 'success');
            loadBranchTree();
        } catch (error) {
            showToast(error.message, 'error');
            loadBranchTree();
        }
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            saved = true;
            loadBranchTree();
        }
    });

    input.addEventListener('blur', doSave);
}

// ==================== 备份与还原 ====================

// NOTE: 缓存当前分支名，避免 restoreTo 每次额外请求
let _cachedCurrentBranch = '';

/**
 * 从分支面板跳转到备份还原面板
 * NOTE: 模拟点击导航按钮，触发面板切换
 */
function navigateToBackup() {
    const navBtn = document.querySelector('[data-panel="backup"]');
    if (navBtn) navBtn.click();
}

/**
 * 在分支面板快速创建备份
 * NOTE: 自动生成备份名称，省去用户输入步骤
 */
async function quickCreateBackup() {
    const now = new Date();
    // NOTE: 加上时分防止同一天多次备份名称重复
    const tagName = `backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const message = `快速备份 ${now.toLocaleString('zh-CN')}`;

    try {
        await apiRequest('/api/backup/create', {
            method: 'POST',
            body: JSON.stringify({ tag_name: tagName, message }),
        });
        showToast(`备份点 '${tagName}' 创建成功`, 'success');
        // NOTE: 刷新分支树以更新备份角标计数
        loadBranchTree();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 加载所有标签（备份点）
 * NOTE: 按分支分组显示，当前分支置顶，旧备份归入"未分类"
 */
async function loadTags() {
    try {
        const [data, repoInfo] = await Promise.all([
            apiRequest('/api/tags'),
            apiRequest('/api/repo/info').catch(() => null),
        ]);
        const list = document.getElementById('tag-list');
        const empty = document.getElementById('backup-empty');
        const currentBranch = repoInfo ? repoInfo.current_branch : '未知';
        _cachedCurrentBranch = currentBranch;

        // NOTE: 渲染分支上下文提示和安全警告
        const contextContainer = document.getElementById('backup-context-area');
        if (contextContainer) {
            contextContainer.innerHTML = `
                <div class="backup-context">
                    <div class="backup-branch-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
                        </svg>
                        当前分支：<strong>${escapeHtml(currentBranch)}</strong>
                    </div>
                    <div class="backup-warning">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        还原操作将回退 <strong>${escapeHtml(currentBranch)}</strong> 分支的历史记录，请谨慎操作
                    </div>
                </div>
            `;
        }

        if (data.tags.length === 0) {
            empty.style.display = 'flex';
            list.innerHTML = '';
            return;
        }

        empty.style.display = 'none';

        // NOTE: 按 branch 字段分组
        const groups = {};
        data.tags.forEach(tag => {
            const branch = tag.branch || '未分类';
            if (!groups[branch]) groups[branch] = [];
            groups[branch].push(tag);
        });

        // NOTE: 排序分组：当前分支置顶，其余按字母排序，未分类放最后
        const groupNames = Object.keys(groups).sort((a, b) => {
            if (a === currentBranch) return -1;
            if (b === currentBranch) return 1;
            if (a === '未分类') return 1;
            if (b === '未分类') return -1;
            return a.localeCompare(b);
        });

        let html = '';
        groupNames.forEach((branchName, groupIdx) => {
            const tags = groups[branchName];
            const isCurrent = branchName === currentBranch;
            const isUncategorized = branchName === '未分类';
            // NOTE: 当前分支默认展开，其他默认折叠
            const isExpanded = isCurrent;

            html += `
                <div class="backup-group ${isCurrent ? 'is-current' : ''}" style="animation-delay: ${groupIdx * 60}ms">
                    <div class="backup-group-header" onclick="toggleBackupGroup(this)">
                        <div class="backup-group-title">
                            <svg class="backup-group-chevron ${isExpanded ? 'expanded' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                            ${isUncategorized
                    ? '<span class="backup-group-icon">📦</span>'
                    : '<span class="backup-group-icon">🌿</span>'
                }
                            <span class="backup-group-name">${escapeHtml(branchName)}</span>
                            ${isCurrent ? '<span class="backup-group-current">当前</span>' : ''}
                        </div>
                        <span class="backup-group-count">${tags.length} 个备份</span>
                    </div>
                    <div class="backup-group-body" style="display: ${isExpanded ? 'block' : 'none'}">
            `;

            tags.forEach((tag, i) => {
                html += `
                    <div class="tag-item" style="animation-delay: ${i * 40}ms">
                        <div class="tag-info">
                            <div class="tag-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17 21 17 13 7 13 7 21"/>
                                </svg>
                            </div>
                            <div class="tag-details">
                                <div class="tag-name">${escapeHtml(tag.name)}</div>
                                <div class="tag-meta">
                                    <span>${tag.hash}</span>
                                    ${tag.date ? `<span>${formatDate(tag.date)}</span>` : ''}
                                    ${tag.message ? `<span>${escapeHtml(tag.message)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="tag-actions">
                            <button class="btn btn-sm btn-outline" onclick="createBranchFromTag('${escapeAttr(tag.name)}')" title="基于此备份创建新分支">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                                转为分支
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="restoreTo('${escapeAttr(tag.name)}')">还原</button>
                            <button class="btn btn-sm btn-ghost" onclick="confirmDeleteTag('${escapeAttr(tag.name)}')" title="删除">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        list.innerHTML = html;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 折叠/展开备份分组
 * @param {HTMLElement} header - 分组标题元素
 */
function toggleBackupGroup(header) {
    const body = header.nextElementSibling;
    const chevron = header.querySelector('.backup-group-chevron');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        chevron.classList.add('expanded');
    } else {
        body.style.display = 'none';
        chevron.classList.remove('expanded');
    }
}

/**
 * 从备份标签创建新分支
 * NOTE: 先弹窗让用户输入分支名，然后基于该标签创建分支
 * @param {string} tagName - 备份标签名
 */
function createBranchFromTag(tagName) {
    // NOTE: 用简单的 prompt 弹窗获取分支名，默认使用标签名作为前缀
    const defaultName = `branch-${tagName}`;
    const branchName = prompt(`基于备份 "${tagName}" 创建新分支\n\n请输入分支名称：`, defaultName);

    if (!branchName || !branchName.trim()) return;

    showConfirmModal(
        '从备份创建分支',
        `将基于备份 "${tagName}" 创建新分支 "${branchName.trim()}"，并自动切换到新分支。确定吗？`,
        async () => {
            try {
                await apiRequest('/api/branches/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: branchName.trim(),
                        source: tagName,
                    }),
                });
                showToast(`已从备份 "${tagName}" 创建分支 "${branchName.trim()}"`, 'success');
                refreshRepoInfo();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

function showCreateBackup() {
    document.getElementById('create-backup-form').style.display = 'block';
}

function hideCreateBackup() {
    document.getElementById('create-backup-form').style.display = 'none';
    document.getElementById('backup-tag-name').value = '';
    document.getElementById('backup-message').value = '';
}

/**
 * 创建新的备份点
 */
async function createBackup() {
    const tagName = document.getElementById('backup-tag-name').value.trim();
    const message = document.getElementById('backup-message').value.trim();

    if (!tagName) {
        showToast('请输入备份标签名', 'error');
        return;
    }

    try {
        await apiRequest('/api/backup/create', {
            method: 'POST',
            body: JSON.stringify({ tag_name: tagName, message: message || null }),
        });
        showToast(`备份点 '${tagName}' 创建成功`, 'success');
        hideCreateBackup();
        loadTags();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 还原到指定标签/提交
 * @param {string} target - 还原目标
 */
async function restoreTo(target) {
    // NOTE: 使用缓存的分支名，避免额外网络请求
    const branchName = _cachedCurrentBranch || '当前分支';

    showConfirmModal(
        '⚠️ 还原确认',
        `即将把 <strong>${branchName}</strong> 分支回退到备份点 "${target}"。<br><br>` +
        `<span style="color:var(--color-danger)">⚠ 此操作不可撤销！回退点之后的提交记录将被清除。</span><br><br>` +
        `建议：还原前先点击"+ 备份"保存当前状态，以便日后找回。`,
        async () => {
            try {
                await apiRequest('/api/restore', {
                    method: 'POST',
                    body: JSON.stringify({ target }),
                });
                showToast(`已将 ${branchName} 还原到 '${target}'`, 'success');
                refreshRepoInfo();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

/**
 * 确认删除备份标签
 * @param {string} name - 标签名
 */
function confirmDeleteTag(name) {
    showConfirmModal(
        '删除备份',
        `确定要删除备份点 "${name}" 吗？`,
        async () => {
            try {
                await apiRequest('/api/backup/delete', {
                    method: 'POST',
                    body: JSON.stringify({ tag_name: name }),
                });
                showToast(`备份点 '${name}' 已删除`, 'success');
                loadTags();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    );
}

// ==================== Stash 操作 ====================

/**
 * 暂存当前更改到 stash
 */
async function stashSave() {
    try {
        await apiRequest('/api/stash/save', { method: 'POST' });
        showToast('当前更改已暂存到 stash', 'success');
        loadStashes();
        loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 恢复 stash 中最近的更改
 */
async function stashPop() {
    try {
        await apiRequest('/api/stash/pop', { method: 'POST' });
        showToast('Stash 已恢复', 'success');
        loadStashes();
        loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 加载 stash 列表
 */
async function loadStashes() {
    try {
        const data = await apiRequest('/api/stash/list');
        const list = document.getElementById('stash-list');

        if (data.stashes.length === 0) {
            list.innerHTML = '<div style="padding:12px;color:var(--color-muted);font-size:0.85rem;">暂无 stash 记录</div>';
            return;
        }

        list.innerHTML = data.stashes.map(s =>
            `<div class="stash-item">${escapeHtml(s)}</div>`
        ).join('');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== 提交历史 ====================

/**
 * 加载提交历史记录
 */
async function loadHistory() {
    try {
        const data = await apiRequest('/api/log?limit=80');
        const list = document.getElementById('commit-list');

        if (data.commits.length === 0) {
            list.innerHTML = '<div class="empty-state"><h3>暂无提交记录</h3></div>';
            return;
        }

        // NOTE: 缓存提交数据供搜索过滤使用
        window._commitCache = data.commits;

        list.innerHTML = data.commits.map((commit, i) => {
            // NOTE: 解析 refs 字符串为带样式的标签
            let refsHtml = '';
            if (commit.refs) {
                const refs = commit.refs.split(',').map(r => r.trim()).filter(Boolean);
                refsHtml = '<div class="commit-refs">' + refs.map(ref => {
                    let className = 'branch';
                    if (ref.startsWith('tag:')) className = 'tag';
                    else if (ref === 'HEAD') className = 'head';
                    return `<span class="ref-badge ${className}">${escapeHtml(ref)}</span>`;
                }).join('') + '</div>';
            }

            return `
                <div class="commit-item" style="animation-delay: ${i * 20}ms" onclick="showCommitDiff('${escapeAttr(commit.hash)}')">
                    <div class="commit-body">
                        <div class="commit-message">${escapeHtml(commit.message)}</div>
                        <div class="commit-meta">
                            <span class="commit-hash" onclick="event.stopPropagation(); copyHash('${escapeAttr(commit.hash)}', this)" title="点击复制完整哈希">
                                ${commit.short_hash}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:3px;opacity:0.5">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </span>
                            <span>${escapeHtml(commit.author)}</span>
                            <span>${formatDate(commit.date)}</span>
                            ${refsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // NOTE: 重新应用当前的搜索过滤条件
        filterHistory();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 复制提交哈希到剪贴板
 * @param {string} hash - 完整哈希
 * @param {HTMLElement} el - 触发元素
 */
async function copyHash(hash, el) {
    try {
        await navigator.clipboard.writeText(hash);
        // NOTE: 短暂变色反馈复制成功
        el.classList.add('copied');
        showToast('已复制哈希: ' + hash.substring(0, 7) + '...', 'success');
        setTimeout(() => el.classList.remove('copied'), 1500);
    } catch {
        showToast('复制失败，请手动复制', 'error');
    }
}

/**
 * 搜索过滤提交历史
 * NOTE: 纯前端实现，匹配 message、author、short_hash
 */
let _filterTimeout = null;
function filterHistory() {
    clearTimeout(_filterTimeout);
    _filterTimeout = setTimeout(() => {
        const query = document.getElementById('history-search-input').value.trim().toLowerCase();
        const items = document.querySelectorAll('#commit-list .commit-item');
        const commits = window._commitCache || [];

        items.forEach((item, i) => {
            if (!query) {
                item.style.display = '';
                return;
            }
            const commit = commits[i];
            if (!commit) { item.style.display = 'none'; return; }

            const match = commit.message.toLowerCase().includes(query)
                || commit.author.toLowerCase().includes(query)
                || commit.short_hash.toLowerCase().includes(query)
                || commit.hash.toLowerCase().includes(query);
            item.style.display = match ? '' : 'none';
        });
    }, 200); // 200ms 防抖，优化连续输入造成的频繁 DOM 渲染
}

// ==================== 弹窗 ====================

/**
 * 显示确认弹窗
 * @param {string} title - 弹窗标题
 * @param {string} message - 弹窗内容
 * @param {Function} onConfirm - 确认回调
 */
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-overlay').style.display = 'flex';

    const confirmBtn = document.getElementById('modal-confirm-btn');
    // NOTE: 克隆按钮节点以移除旧的事件监听器
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', async () => {
        closeModal();
        await onConfirm();
    });
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// NOTE: 点击遮罩层关闭弹窗
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ESC 键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ==================== 安全工具 ====================

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} str - 原字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * 转义用于 HTML 属性的字符串
 * @param {string} str - 原字符串
 * @returns {string} 转义后的字符串
 */
function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ==================== 远程同步 (GitHub) ====================

/**
 * 加载当前关联的远程仓库列表
 */
async function loadRemoteInfo() {
    try {
        const data = await apiRequest('/api/remote/list');
        const container = document.getElementById('remote-list-container');

        if (!data.remotes || data.remotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>暂无关联的远程仓库</p>
                </div>`;
            return;
        }

        container.innerHTML = data.remotes.map(r => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-muted);">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 500; color: var(--color-primary);">${escapeHtml(r.name)}</span>
                    <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-text-secondary);">${escapeHtml(r.url)}</span>
                </div>
            </div>
        `).join('');

        // 默认将推送到远程别名填入表单中
        const nameInput = document.getElementById('push-remote-select');
        if (data.remotes.length > 0 && nameInput) {
            nameInput.value = data.remotes[0].name;
        }

        // 刷新一次仓库信息，以更新推送时的当前分支值
        const info = await apiRequest('/api/repo/info');
        if (info && info.current_branch) {
            document.getElementById('push-branch-select').value = info.current_branch;
            const pushAllBranchEl = document.getElementById('push-all-branch');
            if (pushAllBranchEl) { pushAllBranchEl.value = info.current_branch; }
        }

        // NOTE: 自动加载同步状态指示器
        loadSyncStatus();

    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showAddRemote() {
    document.getElementById('create-remote-form').style.display = 'block';
}

function hideAddRemote() {
    document.getElementById('create-remote-form').style.display = 'none';
    document.getElementById('remote-name-input').value = 'origin';
    document.getElementById('remote-url-input').value = '';
}

/**
 * 添加或修改远程仓库
 */
async function addRemote() {
    const name = document.getElementById('remote-name-input').value.trim();
    const url = document.getElementById('remote-url-input').value.trim();

    if (!name || !url) {
        showToast('请输入远程别名和 URL', 'error');
        return;
    }

    try {
        const result = await apiRequest('/api/remote/add', {
            method: 'POST',
            body: JSON.stringify({ name, url }),
        });
        showToast(result.message, 'success');
        hideAddRemote();
        loadRemoteInfo();
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 推送由于可能耗时较长，增加防止重复点击的状态提示
 */
async function pushToRemote() {
    const remote = document.getElementById('push-remote-select').value.trim();
    const branch = document.getElementById('push-branch-select').value.trim();

    if (!remote || !branch) {
        showToast('远程别名和分支名不能为空', 'error');
        return;
    }

    const btn = document.getElementById('btn-push-remote');
    const originalContent = btn.innerHTML;

    // 按钮变成 Loading 状态
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        正在推送到远程...
    `;

    try {
        const result = await apiRequest('/api/push', {
            method: 'POST',
            body: JSON.stringify({ remote_name: remote, branch_name: branch }),
        });
        showToast(result.message, 'success');
        savePushHistory(remote, branch);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

/**
 * 获取远程更新 (Fetch)
 */
async function fetchRemote() {
    const btn = document.getElementById('btn-fetch-remote');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 获取中...`;
    }

    try {
        const result = await apiRequest('/api/remote/fetch', { method: 'POST' });
        showToast(result.message, 'success');
        loadBranchTree();
        refreshRepoInfo();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 获取 (Fetch)`;
        }
    }
}

/**
 * 拉取远程更新 (Pull)
 */
async function pullRemote() {
    const btn = document.getElementById('btn-pull-remote');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 拉取中...`;
    }

    try {
        const result = await apiRequest('/api/remote/pull', { method: 'POST' });
        showToast(result.message, 'success');
        loadBranchTree();
        refreshRepoInfo();
        loadStatus();
    } catch (error) {
        // 如果出错，跳转到状态面板以方便解决冲突
        showToast(error.message, 'error');
        loadStatus();
        const navBtn = document.querySelector('[data-panel="status"]');
        if (navBtn) navBtn.click();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> 拉取 (Pull)`;
        }
    }
}

// ==================== 用户设置 ====================

/**
 * 显示用户设置弹窗
 */
async function showUserConfig() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');

    document.getElementById('modal-title').textContent = '👤 配置当前仓库用户信息';
    document.getElementById('modal-message').innerHTML = `
        <div class="edit-branch-form">
            <div class="input-group">
                <label>用户名 (user.name)</label>
                <input type="text" id="config-user-name" spellcheck="false" placeholder="例如：John Doe">
            </div>
            <div class="input-group">
                <label>邮箱 (user.email)</label>
                <input type="text" id="config-user-email" spellcheck="false" placeholder="例如：john@example.com">
            </div>
            <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 8px;">
                提示：这仅会修改当前仓库的配置。留空则会取消当前仓库配置而使用全局配置。
            </div>
        </div>
    `;
    overlay.style.display = 'flex';

    // 尝试加载当前配置
    try {
        const data = await apiRequest('/api/config/user');
        if (data) {
            document.getElementById('config-user-name').value = data.name;
            document.getElementById('config-user-email').value = data.email;
        }
    } catch (e) {
        // 忽略加载错误
    }

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const newBtn = confirmBtn.cloneNode(true);
    newBtn.textContent = '保存';
    newBtn.className = 'btn btn-primary';
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', async () => {
        closeModal();
        await saveUserConfig();
    });
}

/**
 * 保存用户设置
 */
async function saveUserConfig() {
    const name = document.getElementById('config-user-name').value.trim();
    const email = document.getElementById('config-user-email').value.trim();

    try {
        await apiRequest('/api/config/user', {
            method: 'POST',
            body: JSON.stringify({ name, email }),
        });
        showToast('用户信息保存成功', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== 最近仓库列表 ====================

// NOTE: 使用 localStorage 存储最近打开的仓库路径，最多保存5个
const RECENT_REPOS_KEY = 'git-manager-recent-repos';
const MAX_RECENT_REPOS = 5;

/**
 * 保存仓库路径到最近列表
 * @param {string} path - 仓库路径
 */
function saveRecentRepo(path) {
    let repos = JSON.parse(localStorage.getItem(RECENT_REPOS_KEY) || '[]');
    // NOTE: 移除已存在的相同路径，然后置顶
    repos = repos.filter(r => r !== path);
    repos.unshift(path);
    repos = repos.slice(0, MAX_RECENT_REPOS);
    localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
    renderRecentRepos();
}

/**
 * 渲染最近仓库列表
 */
function renderRecentRepos() {
    const repos = JSON.parse(localStorage.getItem(RECENT_REPOS_KEY) || '[]');
    const section = document.getElementById('recent-repos-section');
    const list = document.getElementById('recent-repos-list');

    if (repos.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = repos.map(repo => {
        // NOTE: 取路径最后一级目录名作为显示名
        const name = repo.split(/[\\/]/).filter(Boolean).pop() || repo;
        return `
            <div class="recent-repo-item" onclick="document.getElementById('repo-path-input').value='${escapeAttr(repo)}'; connectRepo();" title="${escapeHtml(repo)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div class="recent-repo-info">
                    <span class="recent-repo-name">${escapeHtml(name)}</span>
                    <span class="recent-repo-path">${escapeHtml(repo)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== 撤销暂存 ====================

/**
 * 撤销全部暂存
 * NOTE: 将所有已 git add 的文件移回工作区
 */
async function unstageAll() {
    try {
        await apiRequest('/api/unstage', { method: 'POST', body: JSON.stringify({}) });
        showToast('已撤销全部暂存', 'success');
        loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== Diff 查看器 ====================

/**
 * 打开文件 Diff 查看器
 * @param {string} filePath - 文件路径
 */
async function showFileDiff(filePath) {
    const overlay = document.getElementById('diff-viewer-overlay');
    const content = document.getElementById('diff-viewer-content');
    const filename = document.getElementById('diff-viewer-filename');
    const commitInfo = document.getElementById('diff-commit-info');
    const fileList = document.getElementById('diff-file-list');

    filename.textContent = filePath;
    commitInfo.style.display = 'none';
    fileList.style.display = 'none';
    content.innerHTML = '<div class="diff-loading">加载中...</div>';
    overlay.style.display = 'flex';

    try {
        const data = await apiRequest(`/api/diff/file?path=${encodeURIComponent(filePath)}`);
        if (!data.has_diff) {
            content.innerHTML = '<div class="diff-empty">没有变更内容</div>';
            return;
        }

        let diffText = data.staged_diff || data.unstaged_diff || data.untracked_content || '';
        content.innerHTML = renderDiffHtml(diffText);
    } catch (error) {
        content.innerHTML = `<div class="diff-error">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

/**
 * 打开提交 Diff 查看器
 * @param {string} hash - 提交哈希
 */
async function showCommitDiff(hash) {
    const overlay = document.getElementById('diff-viewer-overlay');
    const content = document.getElementById('diff-viewer-content');
    const filename = document.getElementById('diff-viewer-filename');
    const commitInfoEl = document.getElementById('diff-commit-info');
    const fileListEl = document.getElementById('diff-file-list');

    filename.textContent = '提交详情';
    content.innerHTML = '<div class="diff-loading">加载中...</div>';
    commitInfoEl.style.display = 'none';
    fileListEl.style.display = 'none';
    overlay.style.display = 'flex';

    try {
        const data = await apiRequest(`/api/diff/commit?hash=${encodeURIComponent(hash)}`);

        // NOTE: 渲染提交基本信息
        if (data.commit && data.commit.hash) {
            commitInfoEl.style.display = 'block';
            commitInfoEl.innerHTML = `
                <div class="diff-commit-row">
                    <span class="diff-commit-label">提交</span>
                    <span class="commit-hash" onclick="copyHash('${escapeAttr(data.commit.hash)}', this)" title="点击复制">
                        ${escapeHtml(data.commit.short_hash)}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:3px;opacity:0.5">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </span>
                </div>
                <div class="diff-commit-row">
                    <span class="diff-commit-label">作者</span>
                    <span>${escapeHtml(data.commit.author)}</span>
                </div>
                <div class="diff-commit-row">
                    <span class="diff-commit-label">日期</span>
                    <span>${formatDate(data.commit.date)}</span>
                </div>
                <div class="diff-commit-row">
                    <span class="diff-commit-label">信息</span>
                    <span>${escapeHtml(data.commit.message)}</span>
                </div>
            `;
            filename.textContent = data.commit.message;
        }

        // NOTE: 渲染变更文件列表
        if (data.changed_files && data.changed_files.length > 0) {
            fileListEl.style.display = 'block';
            fileListEl.innerHTML = `
                <div class="diff-file-list-header">${data.changed_files.length} 个文件变更</div>
                ${data.changed_files.map(f => {
                const statusCls = f.status === '新增' ? 'added' : f.status === '已删除' ? 'deleted' : 'modified';
                return `<div class="diff-file-item">
                        <span class="file-status ${statusCls}">${f.status}</span>
                        <span>${escapeHtml(f.path)}</span>
                    </div>`;
            }).join('')}
            `;
        }

        // NOTE: 渲染 diff 内容
        if (data.diff) {
            content.innerHTML = renderDiffHtml(data.diff);
        } else {
            content.innerHTML = '<div class="diff-empty">没有 diff 内容（可能是初始提交）</div>';
        }
    } catch (error) {
        content.innerHTML = `<div class="diff-error">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

/**
 * 将 diff 文本渲染为语法高亮的 HTML
 * NOTE: 解析 unified diff 格式，为每行添加行号和颜色标记
 * @param {string} diffText - 原始 diff 文本
 * @returns {string} HTML 字符串
 */
function renderDiffHtml(diffText) {
    if (!diffText) return '<div class="diff-empty">无变更内容</div>';

    const lines = diffText.split('\n');
    let html = '<div class="diff-table">';
    let oldLine = 0;
    let newLine = 0;
    let currentFile = '';

    lines.forEach(line => {
        // NOTE: 解析文件头
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.+)$/);
            if (match) currentFile = match[1];
            html += `<div class="diff-file-header">${escapeHtml(line)}</div>`;
            return;
        }
        if (line.startsWith('---') || line.startsWith('+++')) {
            html += `<div class="diff-line diff-meta"><span class="diff-line-content">${escapeHtml(line)}</span></div>`;
            return;
        }

        // NOTE: 解析 hunk 头 @@ -x,y +a,b @@
        const hunkMatch = line.match(/^@@\s+-?(\d+)(?:,\d+)?\s+\+?(\d+)(?:,\d+)?\s+@@(.*)/);
        if (hunkMatch) {
            oldLine = parseInt(hunkMatch[1], 10);
            newLine = parseInt(hunkMatch[2], 10);
            html += `<div class="diff-line diff-hunk"><span class="diff-line-content">${escapeHtml(line)}</span></div>`;
            return;
        }

        // NOTE: 渲染增删改行
        let lineClass = '';
        let oldNum = '';
        let newNum = '';

        if (line.startsWith('+')) {
            lineClass = 'diff-add';
            newNum = newLine++;
            oldNum = '';
        } else if (line.startsWith('-')) {
            lineClass = 'diff-del';
            oldNum = oldLine++;
            newNum = '';
        } else {
            lineClass = 'diff-context';
            oldNum = oldLine++;
            newNum = newLine++;
        }

        html += `<div class="diff-line ${lineClass}">`
            + `<span class="diff-gutter diff-gutter-old">${oldNum}</span>`
            + `<span class="diff-gutter diff-gutter-new">${newNum}</span>`
            + `<span class="diff-line-content">${escapeHtml(line)}</span>`
            + `</div>`;
    });

    html += '</div>';
    return html;
}

/**
 * 关闭 Diff 查看器
 */
function closeDiffViewer() {
    document.getElementById('diff-viewer-overlay').style.display = 'none';
}

// NOTE: ESC 键和点击遮罩关闭 diff 查看器
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDiffViewer();
});
document.getElementById('diff-viewer-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDiffViewer();
});

// ==================== 远程同步状态指示器 ====================

/**
 * 加载远程同步状态
 * NOTE: 调用已有的 /api/remote/sync-status 接口
 */
async function loadSyncStatus() {
    const panel = document.getElementById('sync-status-panel');
    const list = document.getElementById('sync-status-list');

    try {
        const data = await apiRequest('/api/remote/sync-status');

        if (!data.branches || data.branches.length === 0) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        list.innerHTML = data.branches.map(b => {
            // NOTE: 根据同步状态选择不同标记样式
            const statusConfig = {
                synced: { icon: '✅', cls: 'synced', text: '已同步' },
                ahead: { icon: '⬆️', cls: 'ahead', text: `领先 ${b.ahead} 个提交` },
                behind: { icon: '⬇️', cls: 'behind', text: `落后 ${b.behind} 个提交` },
                diverged: { icon: '⚠️', cls: 'diverged', text: `领先 ${b.ahead} / 落后 ${b.behind}` },
            };
            const s = statusConfig[b.status] || statusConfig.synced;

            return `
                <div class="sync-status-item ${s.cls} ${b.is_current ? 'is-current' : ''}">
                    <span class="sync-branch">${b.is_current ? '●' : ''} ${escapeHtml(b.branch)}</span>
                    <span class="sync-badge ${s.cls}">${s.icon} ${s.text}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        // NOTE: 静默失败，不干扰用户
        panel.style.display = 'none';
    }
}


// ==================== 一键全部上传 ====================

/**
 * 一键全部上传：自动执行 暂存 → 提交 → 推送 三步流程
 * NOTE: 调用 /api/push/all 接口，无需手动暂存，适合快速保存并上传
 */
async function pushAll() {
    const msgInput = document.getElementById('push-all-commit-msg');
    const remoteName = document.getElementById('push-all-remote').value.trim() || 'origin';
    const branchName = document.getElementById('push-all-branch').value.trim() || document.getElementById('info-branch').textContent || 'main';
    const commitMessage = msgInput.value.trim();

    if (!commitMessage) {
        showToast('请先填写提交说明（必填）', 'error');
        msgInput.focus();
        msgInput.style.boxShadow = '0 0 0 2px var(--color-danger)';
        setTimeout(() => msgInput.style.boxShadow = '', 2000);
        msgInput.focus();
        return;
    }

    const btn = document.getElementById('btn-push-all');
    const originalContent = btn.innerHTML;
    // NOTE: 推送可能较慢，设置加载态防止重复点击
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        上传中，请稍候...
    `;

    try {
        const data = await apiRequest('/api/push/all', {
            method: 'POST',
            body: JSON.stringify({
                commit_message: commitMessage,
                remote_name: remoteName,
                branch_name: branchName,
            }),
        });
        showToast(data.message, 'success');
        // NOTE: 上传成功后清空提交信息，方便下次使用
        // NOTE: 上传成功后清空提交信息，方便下次使用
        savePushHistory(remoteName, branchName);
        msgInput.value = '';
        loadRemoteInfo();
    } catch (error) {
        showToast('上传失败：' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// ==================== 多选分支批量推送 ====================

/**
 * 加载本地分支列表并渲染为勾选框
 * NOTE: 自动勾选当前所在分支，远程分支（origin/xxx）不显示
 */
async function loadBranchesForPush() {
    const container = document.getElementById('branch-push-list');
    container.innerHTML = '<span style="color:var(--color-text-secondary);font-size:0.85rem;">加载中...</span>';

    try {
        const data = await apiRequest('/api/branches');
        // NOTE: 只显示本地分支，排除 origin/ 开头的远程分支
        const localBranches = (data.branches || []).filter(b => !b.remote);

        if (localBranches.length === 0) {
            container.innerHTML = '<span style="color:var(--color-text-secondary);font-size:0.85rem;">暂无本地分支</span>';
            return;
        }

        container.innerHTML = localBranches.map(b => `
            <label style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;
                background:var(--bg-card);border-radius:20px;cursor:pointer;
                border:1px solid ${b.current ? 'var(--color-success)' : 'var(--border-muted)'};
                font-size:0.82rem;">
                <input type="checkbox" class="branch-push-checkbox" value="${escapeAttr(b.name)}"
                    ${b.current ? 'checked' : ''}>
                <span style="color:${b.current ? 'var(--color-success)' : 'var(--color-text)'}">
                    ${b.current ? '● ' : ''}${escapeHtml(b.name)}
                </span>
            </label>
        `).join('');
    } catch (error) {
        container.innerHTML = `<span style="color:var(--color-danger);font-size:0.85rem;">加载失败: ${escapeHtml(error.message)}</span>`;
    }
}

/**
 * 全选/取消全选 分支列表
 */
function selectAllBranchesForPush() {
    const checkboxes = document.querySelectorAll('.branch-push-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => { cb.checked = !allChecked; });
}

/**
 * 推送用户勾选的所有本地分支到远程
 */
async function pushSelectedBranches() {
    const checkboxes = document.querySelectorAll('.branch-push-checkbox:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    const remoteName = document.getElementById('push-branches-remote').value.trim() || 'origin';
    const resultEl = document.getElementById('push-branches-result');

    if (selected.length === 0) {
        showToast('请先勾选至少一个分支', 'error');
        return;
    }

    const btn = document.getElementById('btn-push-branches');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        推送中 (${selected.length} 个分支)...
    `;
    resultEl.style.display = 'none';

    try {
        const data = await apiRequest('/api/push/branches', {
            method: 'POST',
            body: JSON.stringify({ branches: selected, remote_name: remoteName }),
        });

        // NOTE: 分享成功后保存remote但这里有多分支，只保存remote
        if (data.success) {
            savePushHistory(remoteName, null);
        }
        
        // NOTE: 渲染每个分支的推送结果
        const resultsHtml = data.results.map(r => `
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border-muted);">
                <span style="color:${r.success ? 'var(--color-success)' : 'var(--color-danger)'}">
                    ${r.success ? '✅' : '❌'}
                </span>
                <span style="font-weight:500;">${escapeHtml(r.branch)}</span>
                <span style="color:var(--color-text-secondary);font-size:0.8rem;margin-left:auto;">
                    ${r.success ? (r.output || '推送成功') : (r.error || '推送失败')}
                </span>
            </div>
        `).join('');

        resultEl.innerHTML = `
            <div style="font-weight:600;margin-bottom:8px;color:${data.success ? 'var(--color-success)' : 'var(--color-warning)'}">
                ${data.message}
            </div>
            ${resultsHtml}
        `;
        resultEl.style.display = 'block';
        showToast(data.message, data.success ? 'success' : 'info');
    } catch (error) {
        showToast('推送失败：' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}



// NOTE: 页面加载完成后刷新仓库信息和最近仓库列表
refreshRepoInfo();
renderRecentRepos();
// NOTE: 加载多选推送的分支列表
loadBranchesForPush();

// ==================== 推送历史记录（下拉菜单） ====================
const PUSH_HISTORY_KEY = 'git-manager-push-history';

function savePushHistory(remote, branch) {
    if (!remote && !branch) return;
    let history = JSON.parse(localStorage.getItem(PUSH_HISTORY_KEY) || '{"remotes":[], "branches":[]}');
    if (remote && !history.remotes.includes(remote)) {
        history.remotes.unshift(remote);
        history.remotes = history.remotes.slice(0, 10);
    }
    if (branch && !history.branches.includes(branch)) {
        history.branches.unshift(branch);
        history.branches = history.branches.slice(0, 15);
    }
    localStorage.setItem(PUSH_HISTORY_KEY, JSON.stringify(history));
    renderPushHistoryDataLists(); 
}

function renderPushHistoryDataLists() {
    let history = JSON.parse(localStorage.getItem(PUSH_HISTORY_KEY) || '{"remotes":["origin"], "branches":["main", "master"]}');
    const remoteList = document.getElementById('history-remotes');
    if (remoteList) remoteList.innerHTML = history.remotes.map(r => `<option value="${escapeAttr(r)}">`).join('');
    const branchList = document.getElementById('history-branches');
    if (branchList) branchList.innerHTML = history.branches.map(b => `<option value="${escapeAttr(b)}">`).join('');
}

renderPushHistoryDataLists();
