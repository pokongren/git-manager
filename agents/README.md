# Git UI 多Agent测试与完善系统

一个自动化测试和改进 Git UI 的多Agent协作系统。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentCoordinator                         │
│                      (协调器)                                │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  WorkerAgent │ TesterAgent │ LoggerAgent │  ImproverAgent  │
│   (工作Agent) │ (测试Agent) │  (记录Agent) │   (完善Agent)    │
├─────────────┼─────────────┼─────────────┼─────────────────┤
│ 执行Git操作  │  发现问题    │  记录日志    │  生成改进方案    │
│ - 连接仓库   │ - API测试   │ - 操作记录   │ - 代码补丁      │
│ - 创建分支   │ - UI检查    │ - 错误记录   │ - 优化建议      │
│ - 备份还原   │ - 边界测试   │ - 决策历史   │ - 功能增强      │
└─────────────┴─────────────┴─────────────┴─────────────────┘
```

## 4个Agent职责

### 🤖 Agent 1: WorkerAgent (工作Agent)
**职责**: 执行完整的Git工作流

- 连接仓库
- 检查状态
- 暂存提交
- 创建/切换分支
- 创建备份标签
- 还原备份

**工作流**:
```
连接 → 检查状态 → 提交更改 → 创建分支 → 切换分支 → 创建备份 → 还原测试
```

---

### 🧪 Agent 2: TesterAgent (测试Agent)
**职责**: 发现系统问题和缺陷

**测试类型**:
1. **功能测试** - API端点是否正常
2. **UI测试** - 界面交互问题
3. **性能测试** - 响应时间
4. **边界测试** - 非法输入处理
5. **可用性测试** - 用户体验问题

**自动发现的问题示例**:
- 未连接仓库时API仍返回成功
- 允许创建非法分支名
- 缺少加载状态指示
- 危险操作无确认
- 缺少Pull/Push功能

---

### 📝 Agent 3: LoggerAgent (记录Agent)
**职责**: 系统的记忆中枢

- 记录所有Agent的操作
- 记录错误和异常
- 记录测试发现
- 生成Markdown报告
- 为其他Agent提供数据

**输出文件**:
- `logs/session_YYYYMMDD_HHMMSS.json` - 详细日志
- `logs/report_YYYYMMDD_HHMMSS.md` - 测试报告

---

### ✨ Agent 4: ImproverAgent (完善Agent)
**职责**: 根据问题自动生成改进方案

**改进类型**:
1. **API改进** - 后端代码补丁
2. **UI改进** - 前端界面优化
3. **功能增强** - 新功能实现

**自动生成的改进代码**:
- 仓库连接验证装饰器
- 分支名合法性验证
- 全局加载状态管理
- 操作历史面板
- 远程操作功能(Pull/Push)

---

## 使用方法

### 1. 启动后端服务

```bash
cd git-manager/backend
python main.py
```

### 2. 运行多Agent系统

#### 完整工作流（推荐）

```bash
cd git-manager
python -m agents.main --repo "F:\地铁"
```

这将执行：
1. WorkerAgent 执行Git操作
2. TesterAgent 测试发现问题
3. LoggerAgent 记录所有信息
4. ImproverAgent 生成改进方案
5. 生成完整报告

#### 仅测试模式

```bash
python -m agents.main --repo "F:\地铁" --mode test
```

#### 仅执行工作流

```bash
python -m agents.main --repo "F:\地铁" --mode worker
```

---

## 输出文件

运行后会在 `logs/` 目录生成：

```
logs/
├── session_20250217_235045.json      # 详细日志（JSON）
├── report_20250217_235045.md         # 测试报告（Markdown）
├── session_20250217_235045_summary.json  # 执行摘要
└── improvements/
    ├── improvements_20250217_235045.md   # 改进方案
    └── patch_20250217_235045.md          # 代码补丁
```

---

## 代码结构

```
git-manager/agents/
├── __init__.py          # 模块初始化
├── coordinator.py       # 协调器 - 中央控制
├── worker_agent.py      # Agent 1 - 工作Agent
├── tester_agent.py      # Agent 2 - 测试Agent
├── logger_agent.py      # Agent 3 - 记录Agent
├── improver_agent.py    # Agent 4 - 完善Agent
├── main.py              # 命令行入口
└── README.md            # 本文档
```

---

## 扩展Agent

你可以轻松添加新的Agent：

```python
# 在 coordinator.py 中
from .my_new_agent import MyNewAgent

class AgentCoordinator:
    def __init__(self, ...):
        # ... 其他Agent
        self.my_new_agent = MyNewAgent(logger=self.logger)
    
    def run_full_workflow(self, test_repo: str):
        # ... 其他阶段
        
        # 新Agent阶段
        self.my_new_agent.do_something()
```

---

## 示例输出

### 工作Agent输出

```
🔧 [WORKER] connect_repo: 正在连接仓库: F:
🔧 [WORKER] check_status: 检查仓库状态
🔧 [WORKER] commit: 提交成功
🔧 [WORKER] create_branch: 分支创建成功: agent-test-1234567890
✅ Worker完成: 7/8 成功
```

### 测试Agent输出

```
🧪 Phase 2: TesterAgent - 测试发现问题

📊 测试结果:
   发现问题: 8 个
   - 严重: 0 个
   - 高: 2 个
   - 中: 4 个
   - 低: 2 个
```

### 完善Agent输出

```
✨ Phase 3: ImproverAgent - 生成改进方案

🔧 生成改进任务: 5 个
   🔴 [api] 添加仓库连接验证装饰器
   🟠 [api] 添加分支名合法性验证
   🟠 [ui] 添加全局加载状态管理
   🟡 [ui] 添加操作历史面板
   🟡 [feature] 添加远程仓库操作功能
```

---

## 集成到Git UI

要让Web界面显示Agent状态，可以：

1. 添加WebSocket实时推送
2. 添加Agent面板到前端
3. 显示操作历史和实时日志

详见 `improvements/` 目录下自动生成的UI改进代码。

---

## 注意事项

1. **确保后端已启动** - 运行前确认 `python main.py` 已启动
2. **测试仓库安全** - 在测试仓库上运行，避免影响生产代码
3. **查看报告** - 运行后检查 `logs/` 目录的详细报告
4. **谨慎应用补丁** - 自动生成的代码需要人工审核后再应用
