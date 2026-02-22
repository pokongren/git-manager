"""
多Agent协作系统 - Git UI 自动测试与完善
=====================================
包含4个Agent：
- WorkerAgent: 执行Git操作序列
- TesterAgent: 发现功能问题
- LoggerAgent: 记录操作和异常
- ImproverAgent: 根据记录完善UI
"""

from .coordinator import AgentCoordinator
from .worker_agent import WorkerAgent
from .tester_agent import TesterAgent
from .logger_agent import LoggerAgent
from .improver_agent import ImproverAgent

__all__ = [
    'AgentCoordinator',
    'WorkerAgent',
    'TesterAgent',
    'LoggerAgent',
    'ImproverAgent'
]
