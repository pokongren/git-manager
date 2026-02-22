"""
Agent 3 - 记录Agent (LoggerAgent)
负责记录所有操作、问题和决策
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class LogType(Enum):
    OPERATION = "operation"      # 用户/Agent操作
    ERROR = "error"              # 错误异常
    DECISION = "decision"        # 决策记录
    FINDING = "finding"          # 测试发现
    IMPROVEMENT = "improvement"  # UI改进建议


@dataclass
class LogEntry:
    """日志条目"""
    timestamp: str
    agent_name: str
    log_type: str
    title: str
    detail: str
    data: Dict[str, Any]
    severity: str = "info"  # info, warning, error, critical


class LoggerAgent:
    """
    记录Agent - 系统的记忆中枢
    职责：
    1. 记录所有Agent的操作
    2. 记录发现的错误和问题
    3. 维护决策历史
    4. 生成报告供其他Agent使用
    """
    
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = log_dir
        self.logs: List[LogEntry] = []
        self.current_session = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 确保日志目录存在
        os.makedirs(log_dir, exist_ok=True)
        
        self._log_file = os.path.join(log_dir, f"session_{self.current_session}.json")
        self._report_file = os.path.join(log_dir, f"report_{self.current_session}.md")
        
        self.log("LoggerAgent", LogType.OPERATION, "系统初始化", "记录Agent启动", {})
    
    def log(self, agent_name: str, log_type: LogType, title: str, 
            detail: str = "", data: Dict[str, Any] = None, severity: str = "info"):
        """记录一条日志"""
        entry = LogEntry(
            timestamp=datetime.now().isoformat(),
            agent_name=agent_name,
            log_type=log_type.value,
            title=title,
            detail=detail,
            data=data or {},
            severity=severity
        )
        self.logs.append(entry)
        self._save_log(entry)
        return entry
    
    def _save_log(self, entry: LogEntry):
        """保存单条日志到文件"""
        with open(self._log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(asdict(entry), ensure_ascii=False) + '\n')
    
    def get_logs(self, log_type: Optional[LogType] = None, 
                 agent_name: Optional[str] = None) -> List[LogEntry]:
        """获取日志，支持过滤"""
        result = self.logs
        if log_type:
            result = [l for l in result if l.log_type == log_type.value]
        if agent_name:
            result = [l for l in result if l.agent_name == agent_name]
        return result
    
    def get_errors(self) -> List[LogEntry]:
        """获取所有错误"""
        return [l for l in self.logs if l.log_type == LogType.ERROR.value]
    
    def get_findings(self) -> List[LogEntry]:
        """获取所有测试发现"""
        return [l for l in self.logs if l.log_type == LogType.FINDING.value]
    
    def generate_report(self) -> str:
        """生成Markdown格式的报告"""
        report = f"""# Git UI 多Agent测试报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**会话ID**: {self.current_session}

## 统计摘要

| 类型 | 数量 |
|------|------|
| 操作记录 | {len([l for l in self.logs if l.log_type == LogType.OPERATION.value])} |
| 错误异常 | {len([l for l in self.logs if l.log_type == LogType.ERROR.value])} |
| 测试发现 | {len([l for l in self.logs if l.log_type == LogType.FINDING.value])} |
| 改进建议 | {len([l for l in self.logs if l.log_type == LogType.IMPROVEMENT.value])} |

## 详细记录

"""
        
        for log in self.logs:
            icon = {
                "operation": "🔧",
                "error": "❌",
                "decision": "🤔",
                "finding": "🔍",
                "improvement": "✨"
            }.get(log.log_type, "📝")
            
            report += f"""### {icon} [{log.log_type.upper()}] {log.title}

- **Agent**: {log.agent_name}
- **时间**: {log.timestamp}
- **严重程度**: {log.severity}
- **详情**: {log.detail}

"""
            if log.data:
                report += f"**附加数据**: \n```json\n{json.dumps(log.data, ensure_ascii=False, indent=2)}\n```\n\n"
        
        # 保存报告
        with open(self._report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return report
    
    def get_summary_for_improver(self) -> Dict[str, Any]:
        """为ImproverAgent生成摘要数据"""
        errors = self.get_errors()
        findings = self.get_findings()
        
        return {
            "total_errors": len(errors),
            "total_findings": len(findings),
            "error_categories": self._categorize_errors(errors),
            "ui_issues": [f for f in findings if "ui" in f.detail.lower() or "界面" in f.detail],
            "function_issues": [f for f in findings if "function" in f.detail.lower() or "功能" in f.detail],
            "log_file": self._log_file
        }
    
    def _categorize_errors(self, errors: List[LogEntry]) -> Dict[str, List[LogEntry]]:
        """按类别分类错误"""
        categories = {
            "backup": [],
            "branch": [],
            "commit": [],
            "restore": [],
            "stash": [],
            "connection": [],
            "other": []
        }
        
        for error in errors:
            detail_lower = error.detail.lower()
            if any(k in detail_lower for k in ["backup", "备份", "tag"]):
                categories["backup"].append(error)
            elif any(k in detail_lower for k in ["branch", "分支"]):
                categories["branch"].append(error)
            elif any(k in detail_lower for k in ["commit", "提交"]):
                categories["commit"].append(error)
            elif any(k in detail_lower for k in ["restore", "还原"]):
                categories["restore"].append(error)
            elif any(k in detail_lower for k in ["stash", "暂存"]):
                categories["stash"].append(error)
            elif any(k in detail_lower for k in ["connect", "连接"]):
                categories["connection"].append(error)
            else:
                categories["other"].append(error)
        
        return categories
