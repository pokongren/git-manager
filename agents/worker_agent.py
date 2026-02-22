"""
Agent 1 - 工作Agent (WorkerAgent)
负责执行完整的Git工作流程：备份、分支、还原等
"""

import requests
import time
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum


class WorkflowStep(Enum):
    """工作流步骤"""
    CONNECT_REPO = "connect_repo"
    CHECK_STATUS = "check_status"
    STAGE_FILES = "stage_files"
    COMMIT = "commit"
    CREATE_BRANCH = "create_branch"
    SWITCH_BRANCH = "switch_branch"
    CREATE_BACKUP = "create_backup"
    STASH_SAVE = "stash_save"
    STASH_POP = "stash_pop"
    RESTORE_BACKUP = "restore_backup"
    MERGE_BRANCH = "merge_branch"


@dataclass
class WorkflowResult:
    """工作流执行结果"""
    success: bool
    step: str
    message: str
    data: Dict[str, Any]
    duration_ms: int


class WorkerAgent:
    """
    工作Agent - 执行Git操作序列
    职责：
    1. 连接仓库
    2. 执行完整的备份流程
    3. 执行分支操作
    4. 执行还原操作
    5. 生成操作报告
    """
    
    def __init__(self, base_url: str = "http://localhost:8765", 
                 logger: Any = None, callback: Callable = None):
        self.base_url = base_url
        self.logger = logger
        self.callback = callback or (lambda *args: None)
        self.session = requests.Session()
        self.current_repo: Optional[str] = None
        self.workflow_history: List[WorkflowResult] = []
    
    def _log(self, step: str, message: str, data: Dict = None, success: bool = True):
        """记录操作日志"""
        if self.logger:
            from .logger_agent import LogType
            log_type = LogType.OPERATION if success else LogType.ERROR
            severity = "info" if success else "error"
            self.logger.log(
                agent_name="WorkerAgent",
                log_type=log_type,
                title=step,
                detail=message,
                data=data,
                severity=severity
            )
        self.callback("worker", step, message, success)
    
    def _api_call(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """调用后端API"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url, timeout=10)
            else:
                response = self.session.post(
                    url, 
                    json=data or {},
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
            
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {
                    "success": False, 
                    "error": response.json().get("detail", "未知错误"),
                    "status_code": response.status_code
                }
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "无法连接到后端服务"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def connect_repo(self, repo_path: str) -> WorkflowResult:
        """步骤1: 连接仓库"""
        start = time.time()
        self._log("connect_repo", f"正在连接仓库: {repo_path}")
        
        result = self._api_call("POST", "/api/repo/open", {"path": repo_path})
        
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            self.current_repo = repo_path
            self._log("connect_repo", "仓库连接成功", result["data"])
            return WorkflowResult(
                success=True,
                step="connect_repo",
                message=f"成功连接仓库: {repo_path}",
                data=result["data"],
                duration_ms=duration
            )
        else:
            self._log("connect_repo", f"连接失败: {result.get('error')}", result, False)
            return WorkflowResult(
                success=False,
                step="connect_repo",
                message=result.get("error", "连接失败"),
                data=result,
                duration_ms=duration
            )
    
    def check_status(self) -> WorkflowResult:
        """步骤2: 检查仓库状态"""
        start = time.time()
        self._log("check_status", "检查仓库状态")
        
        result = self._api_call("GET", "/api/status")
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            files = result["data"].get("files", [])
            clean = result["data"].get("clean", False)
            self._log("check_status", f"状态检查完成，文件变动: {len(files)}个，干净: {clean}")
            return WorkflowResult(
                success=True,
                step="check_status",
                message=f"工作区{'干净' if clean else f'有{len(files)}个文件变动'}",
                data=result["data"],
                duration_ms=duration
            )
        else:
            return WorkflowResult(
                success=False,
                step="check_status",
                message=result.get("error", "状态检查失败"),
                data=result,
                duration_ms=duration
            )
    
    def stage_and_commit(self, message: str = "自动提交") -> WorkflowResult:
        """步骤3: 暂存并提交所有更改"""
        start = time.time()
        self._log("stage_commit", f"准备提交，信息: {message}")
        
        # 先暂存
        stage_result = self._api_call("POST", "/api/stage", {})
        if not stage_result["success"]:
            duration = int((time.time() - start) * 1000)
            self._log("stage", f"暂存失败: {stage_result.get('error')}", stage_result, False)
            return WorkflowResult(
                success=False,
                step="stage",
                message=f"暂存失败: {stage_result.get('error')}",
                data=stage_result,
                duration_ms=duration
            )
        
        self._log("stage", "暂存成功")
        
        # 再提交
        commit_result = self._api_call("POST", "/api/commit", {"message": message})
        duration = int((time.time() - start) * 1000)
        
        if commit_result["success"]:
            self._log("commit", f"提交成功: {message}", commit_result["data"])
            return WorkflowResult(
                success=True,
                step="commit",
                message=f"提交成功: {message}",
                data=commit_result["data"],
                duration_ms=duration
            )
        else:
            self._log("commit", f"提交失败: {commit_result.get('error')}", commit_result, False)
            return WorkflowResult(
                success=False,
                step="commit",
                message=f"提交失败: {commit_result.get('error')}",
                data=commit_result,
                duration_ms=duration
            )
    
    def create_branch(self, branch_name: str, source: str = None) -> WorkflowResult:
        """步骤4: 创建分支"""
        start = time.time()
        self._log("create_branch", f"创建分支: {branch_name}, 基于: {source or '当前'}")
        
        result = self._api_call("POST", "/api/branches/create", {
            "name": branch_name,
            "source": source
        })
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            self._log("create_branch", f"分支创建成功: {branch_name}", result["data"])
            return WorkflowResult(
                success=True,
                step="create_branch",
                message=f"分支 '{branch_name}' 创建成功",
                data=result["data"],
                duration_ms=duration
            )
        else:
            self._log("create_branch", f"分支创建失败: {result.get('error')}", result, False)
            return WorkflowResult(
                success=False,
                step="create_branch",
                message=result.get("error", "创建失败"),
                data=result,
                duration_ms=duration
            )
    
    def switch_branch(self, branch_name: str) -> WorkflowResult:
        """步骤5: 切换分支"""
        start = time.time()
        self._log("switch_branch", f"切换到分支: {branch_name}")
        
        result = self._api_call("POST", "/api/branches/switch", {"name": branch_name})
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            self._log("switch_branch", f"切换成功: {branch_name}", result["data"])
            return WorkflowResult(
                success=True,
                step="switch_branch",
                message=f"已切换到分支 '{branch_name}'",
                data=result["data"],
                duration_ms=duration
            )
        else:
            return WorkflowResult(
                success=False,
                step="switch_branch",
                message=result.get("error", "切换失败"),
                data=result,
                duration_ms=duration
            )
    
    def create_backup(self, tag_name: str, message: str = None) -> WorkflowResult:
        """步骤6: 创建备份标签"""
        start = time.time()
        backup_message = message or f"备份于 {time.strftime('%Y-%m-%d %H:%M')}"
        self._log("create_backup", f"创建备份: {tag_name}")
        
        result = self._api_call("POST", "/api/backup/create", {
            "tag_name": tag_name,
            "message": backup_message
        })
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            self._log("create_backup", f"备份创建成功: {tag_name}", result["data"])
            return WorkflowResult(
                success=True,
                step="create_backup",
                message=f"备份点 '{tag_name}' 创建成功",
                data=result["data"],
                duration_ms=duration
            )
        else:
            self._log("create_backup", f"备份创建失败: {result.get('error')}", result, False)
            return WorkflowResult(
                success=False,
                step="create_backup",
                message=result.get("error", "备份失败"),
                data=result,
                duration_ms=duration
            )
    
    def restore_backup(self, target: str) -> WorkflowResult:
        """步骤7: 还原到备份"""
        start = time.time()
        self._log("restore_backup", f"还原到: {target}")
        
        result = self._api_call("POST", "/api/restore", {"target": target})
        duration = int((time.time() - start) * 1000)
        
        if result["success"]:
            self._log("restore_backup", f"还原成功: {target}", result["data"])
            return WorkflowResult(
                success=True,
                step="restore_backup",
                message=f"已还原到 '{target}'",
                data=result["data"],
                duration_ms=duration
            )
        else:
            self._log("restore_backup", f"还原失败: {result.get('error')}", result, False)
            return WorkflowResult(
                success=False,
                step="restore_backup",
                message=result.get("error", "还原失败"),
                data=result,
                duration_ms=duration
            )
    
    def execute_full_workflow(self, repo_path: str) -> List[WorkflowResult]:
        """
        执行完整的工作流程：
        1. 连接仓库
        2. 检查状态
        3. 提交更改
        4. 创建分支
        5. 在分支上创建备份
        6. 切换回主分支
        7. 还原测试
        """
        self._log("workflow", "开始执行完整工作流程")
        results = []
        
        # 1. 连接
        results.append(self.connect_repo(repo_path))
        if not results[-1].success:
            return results
        
        # 2. 检查状态
        status_result = self.check_status()
        results.append(status_result)
        
        # 3. 如果有更改则提交
        if not status_result.data.get("clean", False):
            results.append(self.stage_and_commit("WorkerAgent自动提交"))
        
        # 4. 创建测试分支
        test_branch = f"agent-test-{int(time.time())}"
        results.append(self.create_branch(test_branch))
        
        # 5. 切换到测试分支
        if results[-1].success:
            results.append(self.switch_branch(test_branch))
        
        # 6. 创建备份
        backup_tag = f"agent-backup-{int(time.time())}"
        results.append(self.create_backup(backup_tag, "Agent自动备份"))
        
        # 7. 切换回master
        results.append(self.switch_branch("master"))
        
        # 8. 还原测试（可选，仅在成功时执行）
        if results[-1].success:
            results.append(self.restore_backup(backup_tag))
        
        self.workflow_history.extend(results)
        self._log("workflow", f"工作流程完成，共{len(results)}步，成功{sum(1 for r in results if r.success)}步")
        
        return results
    
    def get_summary(self) -> Dict[str, Any]:
        """获取工作摘要"""
        total = len(self.workflow_history)
        successful = sum(1 for r in self.workflow_history if r.success)
        failed = total - successful
        
        return {
            "total_steps": total,
            "successful": successful,
            "failed": failed,
            "success_rate": f"{(successful/total*100):.1f}%" if total > 0 else "N/A",
            "current_repo": self.current_repo,
            "recent_operations": [
                {"step": r.step, "success": r.success, "message": r.message}
                for r in self.workflow_history[-5:]
            ]
        }
