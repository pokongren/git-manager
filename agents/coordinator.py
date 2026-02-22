"""
协调器 (AgentCoordinator)
协调4个Agent协同工作，完成测试-记录-改进的闭环
"""

import asyncio
import json
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime


class AgentCoordinator:
    """
    协调器 - 多Agent系统的中央控制器
    职责：
    1. 初始化和管理所有Agent
    2. 定义工作流和依赖关系
    3. 调度Agent执行顺序
    4. 传递数据和状态
    5. 生成最终报告
    """
    
    def __init__(self, base_url: str = "http://localhost:8765", 
                 project_root: str = "..",
                 progress_callback: Callable = None):
        self.base_url = base_url
        self.project_root = project_root
        self.progress_callback = progress_callback or print
        
        # 延迟导入，避免循环依赖
        from .logger_agent import LoggerAgent
        from .worker_agent import WorkerAgent
        from .tester_agent import TesterAgent
        from .improver_agent import ImproverAgent
        
        # 初始化LoggerAgent（最先初始化，其他Agent依赖它）
        self.logger = LoggerAgent(log_dir=f"{project_root}/logs")
        
        # 初始化其他Agent
        self.worker = WorkerAgent(
            base_url=base_url,
            logger=self.logger,
            callback=self._agent_callback
        )
        
        self.tester = TesterAgent(
            base_url=base_url,
            logger=self.logger,
            callback=self._agent_callback
        )
        
        self.improver = ImproverAgent(
            project_root=project_root,
            logger=self.logger
        )
        
        self.results = {
            "worker": None,
            "tester": None,
            "improver": None
        }
    
    def _agent_callback(self, agent_type: str, action: str, message: str, status: Any):
        """Agent状态回调"""
        self.progress_callback({
            "agent": agent_type,
            "action": action,
            "message": message,
            "status": status,
            "timestamp": datetime.now().isoformat()
        })
    
    def _log(self, title: str, detail: str):
        """记录协调器日志"""
        from .logger_agent import LogType
        self.logger.log(
            agent_name="Coordinator",
            log_type=LogType.DECISION,
            title=title,
            detail=detail,
            data={}
        )
    
    def run_full_workflow(self, test_repo: str) -> Dict[str, Any]:
        """
        运行完整工作流：
        Phase 1: WorkerAgent 执行操作
        Phase 2: TesterAgent 测试发现问题
        Phase 3: ImproverAgent 生成改进方案
        Phase 4: 生成报告
        """
        self._log("开始完整工作流", f"测试仓库: {test_repo}")
        
        # ===== Phase 1: WorkerAgent =====
        self._log("Phase 1", "WorkerAgent开始执行Git操作序列")
        print("\n" + "="*60)
        print("Phase 1: WorkerAgent - 执行Git操作")
        print("="*60)
        
        worker_results = self.worker.execute_full_workflow(test_repo)
        self.results["worker"] = {
            "success": all(r.success for r in worker_results),
            "total_steps": len(worker_results),
            "success_count": sum(1 for r in worker_results if r.success),
            "failed_count": sum(1 for r in worker_results if not r.success),
            "steps": [
                {
                    "step": r.step,
                    "success": r.success,
                    "message": r.message,
                    "duration_ms": r.duration_ms
                }
                for r in worker_results
            ]
        }
        
        print(f"\nWorker完成: {self.results['worker']['success_count']}/{self.results['worker']['total_steps']} 成功")
        
        # ===== Phase 2: TesterAgent =====
        self._log("Phase 2", "TesterAgent开始测试系统")
        print("\n" + "="*60)
        print("🧪 Phase 2: TesterAgent - 测试发现问题")
        print("="*60)
        
        tester_summary = self.tester.run_all_tests(test_repo)
        self.results["tester"] = tester_summary
        
        print(f"\n测试结果:")
        print(f"   发现问题: {tester_summary['total_findings']} 个")
        print(f"   - 严重: {tester_summary['by_severity']['critical']} 个")
        print(f"   - 高: {tester_summary['by_severity']['high']} 个")
        print(f"   - 中: {tester_summary['by_severity']['medium']} 个")
        print(f"   - 低: {tester_summary['by_severity']['low']} 个")
        
        # ===== Phase 3: ImproverAgent =====
        self._log("Phase 3", "ImproverAgent分析并生成改进方案")
        print("\n" + "="*60)
        print("✨ Phase 3: ImproverAgent - 生成改进方案")
        print("="*60)
        
        logger_summary = self.logger.get_summary_for_improver()
        tester_summary_for_improver = self.tester.get_summary_for_improver()
        
        improvement_tasks = self.improver.analyze_and_generate(
            logger_summary,
            tester_summary_for_improver
        )
        
        self.results["improver"] = {
            "tasks_generated": len(improvement_tasks),
            "tasks": [
                {
                    "priority": t.priority,
                    "category": t.category,
                    "title": t.title,
                    "description": t.description[:100] + "..." if len(t.description) > 100 else t.description
                }
                for t in improvement_tasks
            ]
        }
        
        print(f"\n生成改进任务: {len(improvement_tasks)} 个")
        for task in improvement_tasks:
            priority_icon = "🔴" if task.priority == 1 else "🟠" if task.priority == 2 else "🟡"
            print(f"   [{task.category}] {task.title}")
        
        # ===== Phase 4: 生成报告 =====
        self._log("Phase 4", "生成最终报告")
        print("\n" + "="*60)
        print("📄 Phase 4: 生成报告")
        print("="*60)
        
        # 生成各种报告
        logger_report = self.logger.generate_report()
        improvement_report = self.improver.generate_improvement_report()
        patch_file = self.improver.apply_improvements()  # 生成补丁文件
        
        print(f"\n报告文件:")
        print(f"   - 操作日志: {self.logger._log_file}")
        print(f"   - 测试报告: {self.logger._report_file}")
        print(f"   - 改进方案: {improvement_report}")
        print(f"   - 代码补丁: {patch_file}")
        
        # 最终摘要
        final_report = {
            "session_id": self.logger.current_session,
            "timestamp": datetime.now().isoformat(),
            "test_repo": test_repo,
            "phases": {
                "worker": self.results["worker"],
                "tester": self.results["tester"],
                "improver": self.results["improver"]
            },
            "files": {
                "log": self.logger._log_file,
                "report": self.logger._report_file,
                "improvements": improvement_report,
                "patch": patch_file
            },
            "summary": {
                "total_operations": self.results["worker"]["total_steps"],
                "success_rate": f"{(self.results['worker']['success_count'] / self.results['worker']['total_steps'] * 100):.1f}%" if self.results["worker"]["total_steps"] > 0 else "N/A",
                "issues_found": self.results["tester"]["total_findings"],
                "improvements_proposed": self.results["improver"]["tasks_generated"]
            }
        }
        
        # 保存最终报告
        summary_file = f"{self.project_root}/logs/session_{self.logger.current_session}_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(final_report, f, ensure_ascii=False, indent=2)
        
        print(f"\n" + "="*60)
        print("✅ 多Agent工作流完成!")
        print("="*60)
        print(f"\n摘要:")
        print(f"   操作成功率: {final_report['summary']['success_rate']}")
        print(f"   发现问题: {final_report['summary']['issues_found']} 个")
        print(f"   改进建议: {final_report['summary']['improvements_proposed']} 个")
        print(f"\n所有报告已保存到 logs/ 目录")
        
        return final_report
    
    def run_test_only(self, test_repo: str = None) -> Dict:
        """仅运行测试阶段"""
        print("\n" + "="*60)
        print("仅运行测试模式")
        print("="*60)
        
        return self.tester.run_all_tests(test_repo)
    
    def run_worker_only(self, test_repo: str) -> List:
        """仅运行工作流阶段"""
        print("\n" + "="*60)
        print("仅运行工作流模式")
        print("="*60)
        
        return self.worker.execute_full_workflow(test_repo)
    
    def get_realtime_status(self) -> Dict:
        """获取实时状态"""
        return {
            "logger": {
                "total_logs": len(self.logger.logs),
                "errors": len(self.logger.get_errors()),
                "findings": len(self.logger.get_findings())
            },
            "worker": self.worker.get_summary() if hasattr(self.worker, 'get_summary') else {},
            "tester": {
                "total_findings": len(self.tester.findings) if hasattr(self.tester, 'findings') else 0
            },
            "improver": {
                "tasks_generated": len(self.improver.tasks) if hasattr(self.improver, 'tasks') else 0
            }
        }
