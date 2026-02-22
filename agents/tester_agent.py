"""
Agent 2 - 测试Agent (TesterAgent)
负责测试功能、发现UI问题和逻辑缺陷
"""

import requests
import time
from typing import Dict, List, Any, Callable, Optional
from dataclasses import dataclass
from enum import Enum


class TestCategory(Enum):
    """测试类别"""
    FUNCTIONAL = "functional"    # 功能测试
    UI = "ui"                    # UI测试
    PERFORMANCE = "performance"  # 性能测试
    EDGE_CASE = "edge_case"      # 边界测试
    USABILITY = "usability"      # 可用性测试


@dataclass
class TestFinding:
    """测试发现"""
    category: str
    severity: str  # critical, high, medium, low
    title: str
    description: str
    reproduction: str
    expected: str
    actual: str
    suggestion: str


class TesterAgent:
    """
    测试Agent - 发现系统问题
    职责：
    1. 测试所有API端点
    2. 测试UI交互流程
    3. 测试边界条件
    4. 收集性能数据
    5. 生成测试报告
    """
    
    def __init__(self, base_url: str = "http://localhost:8765", 
                 logger: Any = None, callback: Callable = None):
        self.base_url = base_url
        self.logger = logger
        self.callback = callback or (lambda *args: None)
        self.findings: List[TestFinding] = []
        self.test_results: List[Dict] = []
    
    def _log_finding(self, finding: TestFinding):
        """记录测试发现"""
        if self.logger:
            from .logger_agent import LogType
            self.logger.log(
                agent_name="TesterAgent",
                log_type=LogType.FINDING,
                title=finding.title,
                detail=f"{finding.description}\n严重程度: {finding.severity}",
                data={
                    "category": finding.category,
                    "severity": finding.severity,
                    "reproduction": finding.reproduction,
                    "expected": finding.expected,
                    "actual": finding.actual,
                    "suggestion": finding.suggestion
                },
                severity=finding.severity if finding.severity in ["error", "critical"] else "warning"
            )
        self.callback("tester", "finding", finding.title, finding.severity)
    
    def _api_call(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """调用API"""
        url = f"{self.base_url}{endpoint}"
        try:
            start = time.time()
            if method == "GET":
                response = requests.get(url, timeout=10)
            else:
                response = requests.post(
                    url, json=data or {}, 
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
            duration = (time.time() - start) * 1000
            
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "duration_ms": duration,
                "data": response.json() if response.status_code == 200 else None,
                "error": response.text if response.status_code != 200 else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "duration_ms": 0
            }
    
    def test_api_connectivity(self) -> List[TestFinding]:
        """测试API连通性"""
        findings = []
        
        # 测试基本连通
        result = self._api_call("GET", "/api/repo/info")
        
        if not result["success"] and "Connection" in str(result.get("error", "")):
            findings.append(TestFinding(
                category=TestCategory.FUNCTIONAL.value,
                severity="critical",
                title="后端服务无法连接",
                description="无法连接到后端API服务",
                reproduction="访问 /api/repo/info",
                expected="返回200状态码",
                actual=f"连接失败: {result.get('error')}",
                suggestion="确保后端服务已启动 (python main.py)"
            ))
        elif result["duration_ms"] > 2000:
            findings.append(TestFinding(
                category=TestCategory.PERFORMANCE.value,
                severity="medium",
                title="API响应缓慢",
                description=f"API响应时间超过2秒 ({result['duration_ms']:.0f}ms)",
                reproduction="访问 /api/repo/info",
                expected="响应时间 < 500ms",
                actual=f"响应时间 {result['duration_ms']:.0f}ms",
                suggestion="检查服务器性能，考虑添加缓存"
            ))
        
        for f in findings:
            self._log_finding(f)
        return findings
    
    def test_workflow_without_repo(self) -> List[TestFinding]:
        """测试未连接仓库时的行为"""
        findings = []
        
        # 测试未连接时调用状态API
        endpoints_to_test = [
            ("/api/status", "GET"),
            ("/api/branches", "GET"),
            ("/api/log", "GET"),
        ]
        
        for endpoint, method in endpoints_to_test:
            result = self._api_call(method, endpoint)
            if result["success"]:
                findings.append(TestFinding(
                    category=TestCategory.FUNCTIONAL.value,
                    severity="high",
                    title=f"{endpoint} 未验证仓库连接",
                    description="API在未连接仓库时返回成功，应该返回错误",
                    reproduction=f"在未连接仓库时调用 {endpoint}",
                    expected="返回400错误，提示未连接仓库",
                    actual="返回200成功",
                    suggestion="添加仓库连接状态验证中间件"
                ))
        
        for f in findings:
            self._log_finding(f)
        return findings
    
    def test_branch_operations(self, test_repo: str) -> List[TestFinding]:
        """测试分支操作"""
        findings = []
        
        # 先连接仓库
        self._api_call("POST", "/api/repo/open", {"path": test_repo})
        
        # 测试创建非法分支名
        invalid_names = [
            "branch with spaces",
            "branch~with~tilde",
            "branch^with^caret",
            "branch:with:colon",
        ]
        
        for name in invalid_names:
            result = self._api_call("POST", "/api/branches/create", {
                "name": name,
                "source": None
            })
            if result["success"]:
                findings.append(TestFinding(
                    category=TestCategory.EDGE_CASE.value,
                    severity="medium",
                    title=f"允许创建非法分支名: '{name}'",
                    description="系统允许创建包含非法字符的分支名",
                    reproduction=f"尝试创建分支 '{name}'",
                    expected="返回错误，拒绝非法分支名",
                    actual="分支创建成功",
                    suggestion="在前端和后端添加分支名验证"
                ))
        
        for f in findings:
            self._log_finding(f)
        return findings
    
    def test_backup_operations(self, test_repo: str) -> List[TestFinding]:
        """测试备份操作"""
        findings = []
        
        self._api_call("POST", "/api/repo/open", {"path": test_repo})
        
        # 测试重复创建同名备份
        tag_name = "test-duplicate-tag"
        
        # 第一次创建
        r1 = self._api_call("POST", "/api/backup/create", {
            "tag_name": tag_name,
            "message": "First"
        })
        
        if r1["success"]:
            # 第二次创建同名
            r2 = self._api_call("POST", "/api/backup/create", {
                "tag_name": tag_name,
                "message": "Second"
            })
            
            if r2["success"]:
                findings.append(TestFinding(
                    category=TestCategory.FUNCTIONAL.value,
                    severity="high",
                    title="允许创建重复备份标签",
                    description="同一个标签名可以创建多次，会覆盖原有标签",
                    reproduction="连续两次创建同名备份标签",
                    expected="第二次返回错误，提示标签已存在",
                    actual="第二次也成功，覆盖了第一次的备份",
                    suggestion="添加标签存在性检查，或添加确认覆盖提示"
                ))
            
            # 清理
            self._api_call("POST", "/api/backup/delete", {"tag_name": tag_name})
        
        for f in findings:
            self._log_finding(f)
        return findings
    
    def test_ui_issues(self) -> List[TestFinding]:
        """测试UI问题（基于代码分析）"""
        findings = []
        
        # 这些是基于代码静态分析发现的问题
        ui_issues = [
            TestFinding(
                category=TestCategory.UI.value,
                severity="medium",
                title="没有加载状态指示",
                description="执行Git操作时没有显示加载动画或进度指示",
                reproduction="点击'提交'或'创建分支'按钮",
                expected="显示加载状态，防止重复点击",
                actual="没有视觉反馈，用户可以重复点击",
                suggestion="添加全局加载状态管理，按钮添加loading样式"
            ),
            TestFinding(
                category=TestCategory.UI.value,
                severity="medium",
                title="缺少操作确认提示",
                description="危险操作（如删除分支、强制还原）没有二次确认",
                reproduction="点击删除分支按钮",
                expected="弹出确认对话框，说明后果",
                actual="直接执行操作",
                suggestion="为危险操作添加确认弹窗"
            ),
            TestFinding(
                category=TestCategory.USABILITY.value,
                severity="low",
                title="没有操作历史记录",
                description="用户无法查看之前的操作记录",
                reproduction="执行多个操作后",
                expected="有一个面板显示操作历史",
                actual="只能看到Toast通知，过后消失",
                suggestion="添加操作历史面板或日志查看器"
            ),
            TestFinding(
                category=TestCategory.USABILITY.value,
                severity="medium",
                title="文件差异预览缺失",
                description="无法查看文件修改的具体内容",
                reproduction="在'仓库状态'页面查看修改的文件",
                expected="可以点击查看文件diff",
                actual="只显示文件名和状态",
                suggestion="添加文件diff预览功能，使用diff库渲染"
            ),
            TestFinding(
                category=TestCategory.FUNCTIONAL.value,
                severity="high",
                title="缺少Pull/Push功能",
                description="无法与远程仓库同步代码",
                reproduction="连接到带远程的仓库",
                expected="有Pull和Push按钮",
                actual="只有本地操作功能",
                suggestion="添加远程操作API和UI"
            ),
        ]
        
        findings.extend(ui_issues)
        
        for f in findings:
            self._log_finding(f)
        return findings
    
    def run_all_tests(self, test_repo: str = None) -> Dict[str, Any]:
        """运行所有测试"""
        self.findings = []
        
        # 1. 基础连通性测试
        self.findings.extend(self.test_api_connectivity())
        
        # 2. 未连接仓库测试
        self.findings.extend(self.test_workflow_without_repo())
        
        # 3. 有仓库的测试
        if test_repo:
            self.findings.extend(self.test_branch_operations(test_repo))
            self.findings.extend(self.test_backup_operations(test_repo))
        
        # 4. UI问题（静态分析）
        self.findings.extend(self.test_ui_issues())
        
        # 生成摘要
        summary = {
            "total_findings": len(self.findings),
            "by_severity": {
                "critical": len([f for f in self.findings if f.severity == "critical"]),
                "high": len([f for f in self.findings if f.severity == "high"]),
                "medium": len([f for f in self.findings if f.severity == "medium"]),
                "low": len([f for f in self.findings if f.severity == "low"]),
            },
            "by_category": {
                "functional": len([f for f in self.findings if f.category == TestCategory.FUNCTIONAL.value]),
                "ui": len([f for f in self.findings if f.category == TestCategory.UI.value]),
                "performance": len([f for f in self.findings if f.category == TestCategory.PERFORMANCE.value]),
                "edge_case": len([f for f in self.findings if f.category == TestCategory.EDGE_CASE.value]),
                "usability": len([f for f in self.findings if f.category == TestCategory.USABILITY.value]),
            },
            "findings": self.findings
        }
        
        return summary
    
    def get_summary_for_improver(self) -> Dict[str, Any]:
        """生成给ImproverAgent的摘要"""
        ui_issues = [f for f in self.findings if f.category == TestCategory.UI.value]
        functional_issues = [f for f in self.findings if f.category == TestCategory.FUNCTIONAL.value]
        
        return {
            "ui_issues_count": len(ui_issues),
            "functional_issues_count": len(functional_issues),
            "high_priority_issues": [
                {"title": f.title, "suggestion": f.suggestion}
                for f in self.findings if f.severity in ["critical", "high"]
            ],
            "recommended_features": [
                f.suggestion for f in self.findings 
                if "建议" in f.suggestion or "添加" in f.suggestion
            ]
        }
