#!/usr/bin/env python3
"""
多Agent系统主程序
运行: python -m agents.main --repo "F:\地铁"
"""

import argparse
import sys
import os

# 确保可以导入agents模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.coordinator import AgentCoordinator


def print_progress(data: dict):
    """打印Agent进度"""
    agent = data.get("agent", "unknown")
    action = data.get("action", "")
    message = data.get("message", "")
    status = data.get("status", True)
    
    icons = {
        "worker": "[W]",
        "tester": "[T]",
        "logger": "[L]",
        "improver": "[I]",
        "coordinator": "[C]"
    }
    
    icon = icons.get(agent, "[A]")
    status_icon = "[OK]" if status else "[FAIL]"
    
    print(f"{icon} [{agent.upper()}] {action}: {message} {status_icon}")


def main():
    parser = argparse.ArgumentParser(description="Git UI 多Agent测试与改进系统")
    parser.add_argument(
        "--repo", 
        required=True,
        help="要测试的Git仓库路径，例如: F:\\地铁"
    )
    parser.add_argument(
        "--mode",
        choices=["full", "test", "worker"],
        default="full",
        help="运行模式: full=完整流程, test=仅测试, worker=仅执行工作流"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8765",
        help="Git UI后端地址"
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="项目根目录路径"
    )
    
    args = parser.parse_args()
    
    # 确定项目根目录
    if args.project_root:
        project_root = args.project_root
    else:
        # 默认是当前agents目录的父目录
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    print("="*70)
    print("Git UI 多Agent测试与改进系统")
    print("="*70)
    print(f"\n配置:")
    print(f"   测试仓库: {args.repo}")
    print(f"   运行模式: {args.mode}")
    print(f"   后端地址: {args.url}")
    print(f"   项目根目录: {project_root}")
    print()
    
    # 初始化协调器
    coordinator = AgentCoordinator(
        base_url=args.url,
        project_root=project_root,
        progress_callback=print_progress
    )
    
    try:
        if args.mode == "full":
            # 运行完整工作流
            result = coordinator.run_full_workflow(args.repo)
            
            print("\n" + "="*70)
            print("最终报告")
            print("="*70)
            print(f"\n会话ID: {result['session_id']}")
            print(f"测试仓库: {result['test_repo']}")
            print(f"\n操作统计:")
            print(f"   总步骤: {result['summary']['total_operations']}")
            print(f"   成功率: {result['summary']['success_rate']}")
            print(f"\n质量分析:")
            print(f"   发现问题: {result['summary']['issues_found']} 个")
            print(f"   改进建议: {result['summary']['improvements_proposed']} 个")
            print(f"\n生成的文件:")
            for file_type, file_path in result['files'].items():
                print(f"   - {file_type}: {file_path}")
            
        elif args.mode == "test":
            # 仅测试
            result = coordinator.run_test_only(args.repo)
            
            print("\n测试结果:")
            print(f"   发现问题: {result['total_findings']} 个")
            print("\n按严重程度:")
            for severity, count in result['by_severity'].items():
                if count > 0:
                    print(f"   {severity}: {count} 个")
            print("\n按类别:")
            for category, count in result['by_category'].items():
                if count > 0:
                    print(f"   {category}: {count} 个")
            
            # 打印详细发现
            if result['findings']:
                print("\n详细发现:")
                for i, finding in enumerate(result['findings'][:10], 1):  # 只显示前10个
                    severity_icon = "🔴" if finding.severity == "critical" else "🟠" if finding.severity == "high" else "🟡"
                    print(f"\n{i}. {severity_icon} [{finding.category}] {finding.title}")
                    print(f"   描述: {finding.description}")
                    print(f"   建议: {finding.suggestion}")
        
        elif args.mode == "worker":
            # 仅执行工作流
            results = coordinator.run_worker_only(args.repo)
            
            print("\n工作流执行结果:")
            for r in results:
                icon = "✓" if r.success else "✗"
                print(f"   {icon} {r.step}: {r.message} ({r.duration_ms}ms)")
            
            success_count = sum(1 for r in results if r.success)
            print(f"\n总计: {success_count}/{len(results)} 成功")
        
        print("\n完成!")
        return 0
        
    except KeyboardInterrupt:
        print("\n\n用户中断")
        return 1
    except Exception as e:
        print(f"\n\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
