"""
Agent 4 - 完善Agent (ImproverAgent)
根据记录和测试发现，自动生成UI改进代码
"""

import os
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ImprovementTask:
    """改进任务"""
    priority: int  # 1-5，1最高
    category: str  # ui, api, feature
    title: str
    description: str
    affected_files: List[str]
    code_changes: Dict[str, str]  # file_path -> new_code
    reason: str


class ImproverAgent:
    """
    完善Agent - 根据问题自动生成改进方案
    职责：
    1. 分析LoggerAgent的记录
    2. 分析TesterAgent的发现
    3. 生成UI改进代码
    4. 创建改进任务列表
    5. 输出可执行的代码补丁
    """
    
    def __init__(self, project_root: str = "..", logger: Any = None):
        self.project_root = project_root
        self.logger = logger
        self.tasks: List[ImprovementTask] = []
        self.improvements_dir = os.path.join(project_root, "improvements")
        os.makedirs(self.improvements_dir, exist_ok=True)
    
    def _log(self, title: str, detail: str, data: Dict = None):
        """记录日志"""
        if self.logger:
            from .logger_agent import LogType
            self.logger.log(
                agent_name="ImproverAgent",
                log_type=LogType.IMPROVEMENT,
                title=title,
                detail=detail,
                data=data or {}
            )
    
    def analyze_and_generate(self, logger_summary: Dict, tester_summary: Dict) -> List[ImprovementTask]:
        """
        分析记录并生成改进任务
        """
        self.tasks = []
        
        # 1. 根据错误生成API改进
        if logger_summary.get("total_errors", 0) > 0:
            self._generate_api_improvements(logger_summary.get("error_categories", {}))
        
        # 2. 根据UI问题生成UI改进
        if tester_summary.get("ui_issues_count", 0) > 0:
            self._generate_ui_improvements(tester_summary.get("high_priority_issues", []))
        
        # 3. 生成功能性改进
        if tester_summary.get("functional_issues_count", 0) > 0:
            self._generate_feature_improvements(tester_summary.get("recommended_features", []))
        
        self._log(
            "改进分析完成",
            f"生成了 {len(self.tasks)} 个改进任务",
            {"tasks_count": len(self.tasks)}
        )
        
        return self.tasks
    
    def _generate_api_improvements(self, error_categories: Dict):
        """生成后端API改进"""
        
        # 改进1: 添加仓库连接验证中间件
        if error_categories.get("connection"):
            task = ImprovementTask(
                priority=1,
                category="api",
                title="添加仓库连接验证装饰器",
                description="为需要仓库的API端点添加统一的连接验证",
                affected_files=["backend/main.py"],
                code_changes={
                    "backend/main.py": self._generate_repo_required_decorator()
                },
                reason="防止未连接仓库时调用API导致错误"
            )
            self.tasks.append(task)
        
        # 改进2: 添加分支名验证
        if error_categories.get("branch"):
            task = ImprovementTask(
                priority=2,
                category="api",
                title="添加分支名合法性验证",
                description="验证分支名是否符合Git规范",
                affected_files=["backend/main.py"],
                code_changes={
                    "backend/main.py": self._generate_branch_name_validator()
                },
                reason="防止创建包含非法字符的分支名"
            )
            self.tasks.append(task)
        
        # 改进3: 添加标签存在性检查
        if error_categories.get("backup"):
            task = ImprovementTask(
                priority=2,
                category="api",
                title="添加备份标签存在性检查",
                description="创建备份前检查标签是否已存在",
                affected_files=["backend/main.py"],
                code_changes={
                    "backend/main.py": self._generate_tag_exists_check()
                },
                reason="防止意外覆盖已有备份标签"
            )
            self.tasks.append(task)
    
    def _generate_ui_improvements(self, high_priority_issues: List[Dict]):
        """生成前端UI改进"""
        
        # 改进1: 添加全局加载状态
        task = ImprovementTask(
            priority=1,
            category="ui",
            title="添加全局加载状态管理",
            description="显示加载遮罩，防止操作中的重复提交",
            affected_files=["frontend/app.js", "frontend/style.css", "frontend/index.html"],
            code_changes={
                "frontend/app.js": self._generate_loading_js(),
                "frontend/style.css": self._generate_loading_css(),
                "frontend/index.html": self._generate_loading_html()
            },
            reason="提升用户体验，防止重复操作"
        )
        self.tasks.append(task)
        
        # 改进2: 添加操作历史面板
        task = ImprovementTask(
            priority=3,
            category="ui",
            title="添加操作历史面板",
            description="显示最近的操作记录，方便用户查看",
            affected_files=["frontend/app.js", "frontend/style.css", "frontend/index.html"],
            code_changes={
                "frontend/app.js": self._generate_history_panel_js(),
                "frontend/style.css": self._generate_history_panel_css(),
                "frontend/index.html": self._generate_history_panel_html()
            },
            reason="用户可以查看操作记录，方便追踪"
        )
        self.tasks.append(task)
        
        # 改进3: 增强确认弹窗
        task = ImprovementTask(
            priority=2,
            category="ui",
            title="增强危险操作确认",
            description="为删除、还原等操作添加更详细的确认提示",
            affected_files=["frontend/app.js", "frontend/index.html"],
            code_changes={
                "frontend/app.js": self._generate_enhanced_modal_js(),
                "frontend/index.html": self._generate_enhanced_modal_html()
            },
            reason="防止误操作导致数据丢失"
        )
        self.tasks.append(task)
    
    def _generate_feature_improvements(self, recommended_features: List[str]):
        """生成功能改进建议"""
        
        # 检查是否提到Pull/Push
        if any("Pull" in f or "Push" in f or "远程" in f for f in recommended_features):
            task = ImprovementTask(
                priority=2,
                category="feature",
                title="添加远程仓库操作功能",
                description="实现Pull和Push功能，支持远程同步",
                affected_files=["backend/main.py", "frontend/app.js", "frontend/index.html"],
                code_changes={
                    "backend/main.py": self._generate_remote_operations_api(),
                    "frontend/app.js": self._generate_remote_operations_js(),
                    "frontend/index.html": self._generate_remote_operations_html()
                },
                reason="支持与远程仓库同步，完整的Git工作流"
            )
            self.tasks.append(task)
    
    # ============ 代码生成模板 ============
    
    def _generate_repo_required_decorator(self) -> str:
        return '''
# 添加在文件开头，导入之后
from functools import wraps

def require_repo(func):
    """验证仓库连接的装饰器"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not CURRENT_REPO_PATH:
            raise HTTPException(status_code=400, detail="请先连接Git仓库")
        return func(*args, **kwargs)
    return wrapper

# 使用示例：
# @app.get("/api/status")
# @require_repo
# def get_status():
#     ...
'''
    
    def _generate_branch_name_validator(self) -> str:
        return '''
import re

def validate_branch_name(name: str) -> bool:
    """验证分支名是否合法"""
    # Git分支名规则：不能以/结尾，不能包含..，不能包含空格等
    if not name or name.endswith('/') or name.endswith('.'):
        return False
    if '..' in name or ' ' in name or '~' in name or '^' in name or ':' in name:
        return False
    if name.startswith('.') or name.startswith('-'):
        return False
    # 检查是否以.lock结尾
    if name.endswith('.lock'):
        return False
    return True

# 在 create_branch 函数中使用：
# if not validate_branch_name(req.name):
#     raise HTTPException(status_code=400, detail="分支名包含非法字符")
'''
    
    def _generate_tag_exists_check(self) -> str:
        return '''
# 在 create_backup 函数中添加检查
@app.post("/api/backup/create")
def create_backup(req: BackupRequest):
    """创建备份（打标签）"""
    # 检查标签是否已存在
    check_result = run_git_command(["tag", "-l", req.tag_name])
    if check_result["success"] and check_result["output"].strip():
        raise HTTPException(status_code=400, detail=f"备份标签 '{req.tag_name}' 已存在")
    
    # ... 原有代码
'''
    
    def _generate_loading_js(self) -> str:
        return '''
// 添加到 app.js 开头
let isLoading = false;

function showLoading(message = '处理中...') {
    isLoading = true;
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    isLoading = false;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// 修改 apiRequest 函数
async function apiRequest(url, options = {}) {
    if (isLoading) return Promise.reject(new Error('操作进行中，请稍候'));
    showLoading();
    try {
        // ... 原有代码
    } finally {
        hideLoading();
    }
}
'''
    
    def _generate_loading_css(self) -> str:
        return '''
/* 加载遮罩 */
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.8);
    z-index: 400;
    display: none;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
}

.loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-default);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    color: var(--color-text);
    font-size: 0.95rem;
}
'''
    
    def _generate_loading_html(self) -> str:
        return '''
<!-- 添加到 body 结尾，toast-container 之后 -->
<div class="loading-overlay" id="loading-overlay">
    <div class="loading-content">
        <div class="loading-spinner"></div>
        <span class="loading-text" id="loading-text">处理中...</span>
    </div>
</div>
'''
    
    def _generate_history_panel_js(self) -> str:
        return '''
// 操作历史管理
let operationHistory = [];

function addToHistory(operation, result, message) {
    operationHistory.unshift({
        time: new Date().toLocaleString('zh-CN'),
        operation,
        result,
        message
    });
    // 只保留最近20条
    operationHistory = operationHistory.slice(0, 20);
    renderHistoryPanel();
}

function renderHistoryPanel() {
    const list = document.getElementById('history-list');
    if (!list) return;
    
    if (operationHistory.length === 0) {
        list.innerHTML = '<div class="history-empty">暂无操作记录</div>';
        return;
    }
    
    list.innerHTML = operationHistory.map(item => `
        <div class="history-item ${item.result}">
            <span class="history-time">${item.time}</span>
            <span class="history-op">${item.operation}</span>
            <span class="history-result ${item.result}">${item.result === 'success' ? '✓' : '✗'}</span>
            <span class="history-msg">${item.message}</span>
        </div>
    `).join('');
}

// 修改原有函数，添加历史记录
function showToast(message, type = 'info') {
    // ... 原有代码
    addToHistory(type, type === 'success' ? 'success' : 'error', message);
}
'''
    
    def _generate_history_panel_css(self) -> str:
        return '''
/* 历史面板 */
.history-panel {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 350px;
    max-height: 400px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 150;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.history-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.history-header h4 {
    font-size: 0.9rem;
    font-weight: 600;
}

.history-list {
    overflow-y: auto;
    max-height: 300px;
    padding: 8px;
}

.history-item {
    display: grid;
    grid-template-columns: auto auto 20px 1fr;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    margin-bottom: 4px;
}

.history-item:hover {
    background: var(--bg-hover);
}

.history-time {
    color: var(--color-muted);
    font-family: var(--font-mono);
}

.history-result.success {
    color: var(--color-success);
}

.history-result.error {
    color: var(--color-danger);
}
'''
    
    def _generate_history_panel_html(self) -> str:
        return '''
<!-- 添加到 body 结尾 -->
<div class="history-panel" id="history-panel">
    <div class="history-header">
        <h4>操作历史</h4>
        <button class="btn btn-sm btn-ghost" onclick="operationHistory=[];renderHistoryPanel();">清空</button>
    </div>
    <div class="history-list" id="history-list">
        <div class="history-empty">暂无操作记录</div>
    </div>
</div>
'''
    
    def _generate_enhanced_modal_js(self) -> str:
        return '''
// 增强的确认弹窗
function showDangerModal(title, message, dangerDetails, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = `
        <p>${message}</p>
        <div class="danger-details">${dangerDetails}</div>
    `;
    
    // 添加危险样式
    const modal = document.getElementById('modal');
    modal.classList.add('danger-modal');
    
    document.getElementById('modal-overlay').style.display = 'flex';
    
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.classList.add('btn-danger');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', async () => {
        closeModal();
        await onConfirm();
        modal.classList.remove('danger-modal');
    });
}

// 使用示例：
// confirmDeleteBranch 修改为：
function confirmDeleteBranch(name) {
    showDangerModal(
        '删除分支',
        `确定要删除分支 "${name}" 吗？`,
        '<strong>⚠️ 警告：</strong>此操作不可撤销。未合并的更改将会丢失。建议先合并或备份。',
        async () => { /* 删除逻辑 */ }
    );
}
'''
    
    def _generate_enhanced_modal_html(self) -> str:
        return '''
<!-- 模态框样式增强 -->
<style>
.modal.danger-modal {
    border: 2px solid var(--color-danger);
}

.danger-details {
    margin-top: 12px;
    padding: 12px;
    background: var(--color-danger-bg);
    border-radius: var(--radius-md);
    color: var(--color-danger);
    font-size: 0.88rem;
}
</style>
'''
    
    def _generate_remote_operations_api(self) -> str:
        return '''
# 远程操作API

@app.post("/api/remote/pull")
def pull_from_remote(branch: str = Query(default=None)):
    """从远程拉取代码"""
    args = ["pull", "origin"]
    if branch:
        args.append(branch)
    
    result = run_git_command(args)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {"success": True, "message": "拉取成功", "output": result["output"]}

@app.post("/api/remote/push")
def push_to_remote(branch: str = Query(default=None)):
    """推送到远程"""
    args = ["push", "origin"]
    if branch:
        args.append(branch)
    
    result = run_git_command(args)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {"success": True, "message": "推送成功", "output": result["output"]}

@app.get("/api/remote/status")
def get_remote_status():
    """获取与远程的同步状态"""
    # 获取当前分支
    branch_result = run_git_command(["branch", "--show-current"])
    current_branch = branch_result["output"] if branch_result["success"] else ""
    
    # 检查是否有未推送的提交
    ahead_result = run_git_command(["rev-list", "--count", f"origin/{current_branch}..{current_branch}"])
    ahead = int(ahead_result["output"]) if ahead_result["success"] else 0
    
    # 检查是否有未拉取的提交
    behind_result = run_git_command(["rev-list", "--count", f"{current_branch}..origin/{current_branch}"])
    behind = int(behind_result["output"]) if behind_result["success"] else 0
    
    return {
        "branch": current_branch,
        "ahead": ahead,      # 本地领先远程的提交数
        "behind": behind,    # 远程领先本地的提交数
        "synced": ahead == 0 and behind == 0
    }
'''
    
    def _generate_remote_operations_js(self) -> str:
        return '''
// 远程操作函数

async function pullFromRemote(branch = null) {
    showLoading('正在拉取...');
    try {
        const url = branch ? `/api/remote/pull?branch=${encodeURIComponent(branch)}` : '/api/remote/pull';
        const result = await apiRequest(url, { method: 'POST' });
        showToast('拉取成功', 'success');
        loadStatus();
        loadHistory();
        return result;
    } catch (error) {
        showToast(`拉取失败: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function pushToRemote(branch = null) {
    showLoading('正在推送...');
    try {
        const url = branch ? `/api/remote/push?branch=${encodeURIComponent(branch)}` : '/api/remote/push';
        const result = await apiRequest(url, { method: 'POST' });
        showToast('推送成功', 'success');
        return result;
    } catch (error) {
        showToast(`推送失败: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function checkRemoteStatus() {
    try {
        const result = await apiRequest('/api/remote/status');
        updateRemoteStatusUI(result);
        return result;
    } catch (error) {
        console.error('检查远程状态失败:', error);
    }
}

function updateRemoteStatusUI(status) {
    const indicator = document.getElementById('remote-sync-indicator');
    if (!indicator) return;
    
    if (status.synced) {
        indicator.innerHTML = '✓ 已同步';
        indicator.className = 'sync-status synced';
    } else if (status.ahead > 0 && status.behind > 0) {
        indicator.innerHTML = `⇅ 领先${status.ahead}，落后${status.behind}`;
        indicator.className = 'sync-status diverged';
    } else if (status.ahead > 0) {
        indicator.innerHTML = `↑ ${status.ahead}个提交待推送`;
        indicator.className = 'sync-status ahead';
    } else if (status.behind > 0) {
        indicator.innerHTML = `↓ ${status.behind}个提交待拉取`;
        indicator.className = 'sync-status behind';
    }
}
'''
    
    def _generate_remote_operations_html(self) -> str:
        return '''
<!-- 在顶部导航栏添加远程状态 -->
<div class="header-right">
    <div id="remote-sync-indicator" class="sync-status">检查中...</div>
    <button class="btn btn-sm btn-outline" onclick="pullFromRemote()">⬇ Pull</button>
    <button class="btn btn-sm btn-primary" onclick="pushToRemote()">⬆ Push</button>
    <!-- 原有分支徽章 -->
</div>
'''
    
    def generate_improvement_report(self) -> str:
        """生成改进报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = os.path.join(self.improvements_dir, f"improvements_{timestamp}.md")
        
        content = f"""# UI 改进报告

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 改进任务列表

"""
        
        for i, task in enumerate(self.tasks, 1):
            content += f"""### {i}. [{task.category.upper()}] {task.title}

**优先级**: {'⭐' * (6 - task.priority)}  
**描述**: {task.description}  
**原因**: {task.reason}

**影响文件**:
"""
            for f in task.affected_files:
                content += f"- `{f}`\n"
            
            content += "\n**建议代码变更**:\n\n```python\n"
            for file_path, code in task.code_changes.items():
                content += f"# {file_path}\n{code}\n\n"
            content += "```\n\n---\n\n"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return report_file
    
    def apply_improvements(self, task_indices: List[int] = None):
        """
        应用改进（生成补丁文件）
        """
        tasks_to_apply = self.tasks if task_indices is None else [self.tasks[i] for i in task_indices]
        
        patch_content = "# 改进补丁\n\n"
        
        for task in tasks_to_apply:
            patch_content += f"## {task.title}\n\n"
            for file_path, code in task.code_changes.items():
                full_path = os.path.join(self.project_root, file_path)
                patch_content += f"### 文件: {file_path}\n\n"
                patch_content += f"```\n{code}\n```\n\n"
                
                # 如果需要，可以实际写入文件（谨慎使用）
                # with open(full_path, 'a', encoding='utf-8') as f:
                #     f.write(f"\n\n{code}\n")
        
        patch_file = os.path.join(self.improvements_dir, f"patch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        with open(patch_file, 'w', encoding='utf-8') as f:
            f.write(patch_content)
        
        return patch_file
