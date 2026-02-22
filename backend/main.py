"""
Git 管理工具后端服务
提供 Git 操作的 REST API，包括仓库状态、分支管理、提交历史、备份还原等功能
"""

import subprocess
import os
import sys
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Git 管理工具", version="1.0.0")

# NOTE: 允许跨域访问，开发模式下开放所有来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 当前工作仓库路径，默认为空
CURRENT_REPO_PATH: Optional[str] = None


class RepoPathRequest(BaseModel):
    """仓库路径请求"""
    path: str


class BranchRequest(BaseModel):
    """分支操作请求"""
    name: str
    source: Optional[str] = None


class MergeRequest(BaseModel):
    """合并分支请求"""
    source_branch: str


class BackupRequest(BaseModel):
    """备份请求"""
    tag_name: str
    message: Optional[str] = None


class RestoreRequest(BaseModel):
    """还原请求"""
    target: str


class CommitRequest(BaseModel):
    """提交请求"""
    message: str
    files: Optional[list[str]] = None


class RemoteRequest(BaseModel):
    """远程仓库请求"""
    name: str = "origin"
    url: str


class PushRequest(BaseModel):
    """推送请求"""
    remote_name: str = "origin"
    branch_name: str


def run_git_command(args: list[str], cwd: Optional[str] = None, timeout: int = 30) -> dict:
    """
    执行 Git 命令并返回结果
    @param args: Git 命令参数列表
    @param cwd: 工作目录
    @param timeout: 默认超时时间（秒）
    @returns: 包含 success, output, error 的字典
    """
    work_dir = cwd or CURRENT_REPO_PATH
    if not work_dir:
        raise HTTPException(status_code=400, detail="未设置仓库路径")

    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        return {
            "success": result.returncode == 0,
            "output": result.stdout.strip(),
            "error": result.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        logger.error("Git command timed out: git %s", " ".join(args))
        raise HTTPException(status_code=408, detail="Git 命令执行超时")
    except FileNotFoundError:
        logger.error("Git not found in PATH")
        raise HTTPException(status_code=500, detail="未找到 Git 可执行文件")


# ==================== 文件夹选择对话框 ====================

@app.get("/api/dialog/browse-folder")
def browse_folder():
    """
    调用 tkinter 子进程弹出系统文件夹选择对话框（全平台通用）
    NOTE: 使用独立子进程运行，避免 tkinter 与 asyncio 的线程冲突
    """
    try:
        # 用子进程运行 tkinter，避免在 Win32 上与 FastAPI 的事件循环冲突
        py_script = (
            "import tkinter as tk\n"
            "from tkinter import filedialog\n"
            "root = tk.Tk()\n"
            "root.withdraw()\n"
            "root.wm_attributes('-topmost', 1)\n"
            "path = filedialog.askdirectory(title='选择 Git 仓库目录')\n"
            "root.destroy()\n"
            "print(path if path else '', end='')\n"
        )

        result = subprocess.run(
            [sys.executable, "-c", py_script],
            capture_output=True,
            text=True,
            timeout=120,
            encoding="utf-8",
            errors="replace",
        )

        folder_path = result.stdout.strip().replace("/", "\\")
        logger.info("文件夹选择结果: '%s'", folder_path)

        if folder_path:
            return {"success": True, "path": folder_path}
        return {"success": False, "path": ""}

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="文件夹选择超时")
    except Exception as e:
        logger.error("文件夹选择对话框失败: %s", e)
        raise HTTPException(status_code=500, detail=f"无法打开文件夹选择对话框：{e}")


# ==================== 仓库管理 ====================

@app.post("/api/repo/open")
def open_repo(req: RepoPathRequest):
    """打开一个 Git 仓库"""
    global CURRENT_REPO_PATH
    path = req.path.strip()

    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="路径不存在或不是目录")

    # NOTE: 验证该目录是否是一个有效的 Git 仓库
    result = run_git_command(["rev-parse", "--git-dir"], cwd=path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail="该目录不是有效的 Git 仓库")

    CURRENT_REPO_PATH = path
    logger.info("打开仓库: %s", path)
    return {"success": True, "path": path}


@app.get("/api/repo/info")
def get_repo_info():
    """获取当前仓库信息"""
    if not CURRENT_REPO_PATH:
        return {"connected": False}

    result = run_git_command(["rev-parse", "--show-toplevel"])
    remote_result = run_git_command(["remote", "-v"])
    branch_result = run_git_command(["branch", "--show-current"])

    return {
        "connected": True,
        "path": CURRENT_REPO_PATH,
        "root": result["output"] if result["success"] else "",
        "current_branch": branch_result["output"] if branch_result["success"] else "",
        "remotes": remote_result["output"] if remote_result["success"] else "",
    }


# ==================== 远程同步管理 ====================

@app.get("/api/remote/list")
def list_remotes():
    """获取所有远程仓库列表"""
    result = run_git_command(["remote", "-v"])
    if not result["success"]:
        return {"remotes": []}

    remotes = []
    lines = result["output"].split("\n")
    # 解析 "origin https://github.com/... (fetch)"
    seen = set()
    for line in lines:
        if line.strip():
            parts = line.split()
            if len(parts) >= 2:
                name = parts[0]
                url = parts[1]
                if name not in seen:
                    seen.add(name)
                    remotes.append({"name": name, "url": url})
                    
    return {"remotes": remotes}


@app.post("/api/remote/add")
def add_remote(req: RemoteRequest):
    """添加或修改远程仓库"""
    # 检查是否已存在同名 remote
    check_result = run_git_command(["remote"])
    
    if req.name in check_result["output"].split("\n"):
        # 如果存在，则更新 set-url
        result = run_git_command(["remote", "set-url", req.name, req.url])
        action = "更新"
    else:
        # 不存在则 add
        result = run_git_command(["remote", "add", req.name, req.url])
        action = "添加"
        
    if not result["success"]:
        raise HTTPException(status_code=400, detail=f"{action}远程仓库失败: {result['error']}")
        
    return {"success": True, "message": f"成功{action}远程仓库 '{req.name}'"}


@app.post("/api/push")
def push_to_remote(req: PushRequest):
    """推送到远程仓库"""
    # push 可能较慢，适当延长超时至 120 秒
    result = run_git_command(["push", "-u", req.remote_name, req.branch_name], timeout=120)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=f"推送失败: {result['error']}")
        
    return {"success": True, "message": f"已成功推送到 {req.remote_name}/{req.branch_name}", "output": result["output"]}


# ==================== 状态查看 ====================

@app.get("/api/status")
def get_status():
    """获取仓库状态"""
    result = run_git_command(["status", "--porcelain=v1"])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    files = []
    for line in result["output"].split("\n"):
        if line.strip():
            status_code = line[:2]
            filepath = line[3:]
            # NOTE: 解析 Git 状态码为可读描述
            status_map = {
                "M": "已修改", "A": "新增", "D": "已删除",
                "R": "重命名", "C": "复制", "U": "冲突", "?": "未跟踪",
            }
            index_status = status_map.get(status_code[0].strip(), "")
            work_status = status_map.get(status_code[1].strip(), "")
            files.append({
                "path": filepath,
                "index": index_status,
                "working": work_status,
                "raw": status_code,
            })

    return {"files": files, "clean": len(files) == 0}


# ==================== 分支管理 ====================

@app.get("/api/branches")
def list_branches():
    """列出所有分支"""
    result = run_git_command(["branch", "-a", "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso)|%(subject)"])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    current_result = run_git_command(["branch", "--show-current"])
    current_branch = current_result["output"] if current_result["success"] else ""

    branches = []
    for line in result["output"].split("\n"):
        if line.strip():
            parts = line.split("|", 3)
            if len(parts) >= 1:
                name = parts[0].strip()
                branches.append({
                    "name": name,
                    "hash": parts[1] if len(parts) > 1 else "",
                    "date": parts[2] if len(parts) > 2 else "",
                    "message": parts[3] if len(parts) > 3 else "",
                    "current": name == current_branch,
                    "remote": name.startswith("origin/"),
                })

    return {"branches": branches, "current": current_branch}


@app.get("/api/branch-tree")
def get_branch_tree():
    """
    获取分支树结构化数据
    返回主干提交历史和各分支的分叉关系，用于前端绘制可视化分支树
    """
    # NOTE: 获取当前分支
    current_result = run_git_command(["branch", "--show-current"])
    current_branch = current_result["output"] if current_result["success"] else ""

    # NOTE: 识别主干分支名称（优先 master，其次 main）
    main_branch = "master"
    check_master = run_git_command(["rev-parse", "--verify", "master"])
    if not check_master["success"]:
        check_main = run_git_command(["rev-parse", "--verify", "main"])
        if check_main["success"]:
            main_branch = "main"
        else:
            main_branch = current_branch or "master"

    # NOTE: 获取主干最近的提交记录
    main_log = run_git_command([
        "log", main_branch, "-20",
        "--format=%H|%h|%s|%ci",
    ])
    main_commits = []
    if main_log["success"]:
        for line in main_log["output"].split("\n"):
            if line.strip():
                parts = line.split("|", 3)
                if len(parts) >= 3:
                    main_commits.append({
                        "hash": parts[0],
                        "short_hash": parts[1],
                        "message": parts[2],
                        "date": parts[3] if len(parts) > 3 else "",
                    })

    # NOTE: 获取所有本地分支
    branch_result = run_git_command([
        "branch", "--format=%(refname:short)|%(objectname:short)|%(subject)",
    ])
    branch_list = []
    if branch_result["success"]:
        for line in branch_result["output"].split("\n"):
            if line.strip():
                parts = line.split("|", 2)
                if len(parts) >= 1:
                    b_name = parts[0].strip()
                    if b_name == main_branch:
                        continue
                    b_info = {
                        "name": b_name,
                        "hash": parts[1] if len(parts) > 1 else "",
                        "message": parts[2] if len(parts) > 2 else "",
                        "current": b_name == current_branch,
                        "ahead": 0,
                        "behind": 0,
                        "merge_base": "",
                    }
                    # NOTE: 计算分支相对主干的领先/落后提交数和分叉点
                    ab_result = run_git_command([
                        "rev-list", "--left-right", "--count",
                        f"{main_branch}...{b_name}",
                    ])
                    if ab_result["success"]:
                        ab_parts = ab_result["output"].split()
                        if len(ab_parts) == 2:
                            b_info["behind"] = int(ab_parts[0])
                            b_info["ahead"] = int(ab_parts[1])

                    mb_result = run_git_command([
                        "merge-base", main_branch, b_name,
                    ])
                    if mb_result["success"]:
                        b_info["merge_base"] = mb_result["output"][:7]

                    branch_list.append(b_info)

    return {
        "main_branch": main_branch,
        "current_branch": current_branch,
        "main_commits": main_commits,
        "branches": branch_list,
    }


@app.post("/api/branches/create")
def create_branch(req: BranchRequest):
    """创建新分支"""
    args = ["checkout", "-b", req.name]
    if req.source:
        args.append(req.source)

    result = run_git_command(args)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"分支 '{req.name}' 已创建并切换"}


@app.post("/api/branches/switch")
def switch_branch(req: BranchRequest):
    """切换分支"""
    result = run_git_command(["checkout", req.name])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"已切换到分支 '{req.name}'"}


@app.post("/api/branches/delete")
def delete_branch(req: BranchRequest):
    """删除分支"""
    result = run_git_command(["branch", "-d", req.name])
    if not result["success"]:
        # NOTE: 尝试强制删除未合并的分支
        result = run_git_command(["branch", "-D", req.name])
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"分支 '{req.name}' 已删除"}


@app.post("/api/branches/merge")
def merge_branch(req: MergeRequest):
    """合并分支到当前分支"""
    result = run_git_command(["merge", req.source_branch])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"分支 '{req.source_branch}' 已合并到当前分支"}


# ==================== 提交历史 ====================

@app.get("/api/log")
def get_log(limit: int = Query(default=50, ge=1, le=200)):
    """获取提交历史"""
    result = run_git_command([
        "log", f"-{limit}",
        "--format=%H|%h|%an|%ae|%ai|%s|%D",
    ])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    commits = []
    for line in result["output"].split("\n"):
        if line.strip():
            parts = line.split("|", 6)
            if len(parts) >= 6:
                commits.append({
                    "hash": parts[0],
                    "short_hash": parts[1],
                    "author": parts[2],
                    "email": parts[3],
                    "date": parts[4],
                    "message": parts[5],
                    "refs": parts[6] if len(parts) > 6 else "",
                })

    return {"commits": commits}


# ==================== 备份与还原 ====================

@app.get("/api/tags")
def list_tags():
    """
    列出所有标签（备份点）
    NOTE: 解析 message 中的 [branch:xxx] 元数据，返回 branch 字段用于前端分组
    """
    import re
    result = run_git_command([
        "tag", "-l", "--format=%(refname:short)|%(objectname:short)|%(creatordate:iso)|%(subject)",
    ])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    tags = []
    for line in result["output"].split("\n"):
        if line.strip():
            parts = line.split("|", 3)
            raw_message = parts[3] if len(parts) > 3 else ""

            # NOTE: 解析 [branch:xxx] 元数据
            branch = ""
            display_message = raw_message
            branch_match = re.match(r"^\[branch:(.+?)\]\s*(.*)", raw_message)
            if branch_match:
                branch = branch_match.group(1)
                display_message = branch_match.group(2)

            tags.append({
                "name": parts[0] if len(parts) > 0 else "",
                "hash": parts[1] if len(parts) > 1 else "",
                "date": parts[2] if len(parts) > 2 else "",
                "message": display_message,
                "branch": branch,
            })

    return {"tags": tags}


@app.post("/api/backup/create")
def create_backup(req: BackupRequest):
    """
    创建备份（打标签）
    NOTE: 自动在 tag message 中注入 [branch:xxx] 元数据，记录备份所在分支
    """
    # NOTE: 获取当前分支名用于嵌入元数据
    branch_result = run_git_command(["rev-parse", "--abbrev-ref", "HEAD"])
    current_branch = branch_result["output"].strip() if branch_result["success"] else "unknown"

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user_message = req.message if req.message else f"备份于 {timestamp}"
    # NOTE: 在 message 前面注入分支元数据
    full_message = f"[branch:{current_branch}] {user_message}"

    args = ["tag", "-a", req.tag_name, "-m", full_message]
    result = run_git_command(args)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"备份点 '{req.tag_name}' 已创建"}


@app.post("/api/backup/delete")
def delete_backup(req: BackupRequest):
    """删除备份点（标签）"""
    result = run_git_command(["tag", "-d", req.tag_name])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"备份点 '{req.tag_name}' 已删除"}


@app.post("/api/restore")
def restore(req: RestoreRequest):
    """还原到指定的提交或标签"""
    # NOTE: 使用 checkout 进入分离头指针状态来还原
    result = run_git_command(["checkout", req.target])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"已还原到 '{req.target}'"}


# ==================== 文件操作 ====================

@app.post("/api/stage")
def stage_files(req: CommitRequest):
    """暂存文件"""
    if req.files:
        result = run_git_command(["add"] + req.files)
    else:
        result = run_git_command(["add", "-A"])

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": "文件已暂存"}


@app.post("/api/commit")
def commit(req: CommitRequest):
    """提交更改"""
    result = run_git_command(["commit", "-m", req.message])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": "提交成功", "output": result["output"]}


@app.post("/api/stash/save")
def stash_save():
    """暂存当前更改（stash）"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    result = run_git_command(["stash", "push", "-m", f"自动暂存 {timestamp}"])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": "当前更改已暂存"}


@app.post("/api/stash/pop")
def stash_pop():
    """恢复暂存的更改"""
    result = run_git_command(["stash", "pop"])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": "暂存的更改已恢复"}


@app.get("/api/stash/list")
def stash_list():
    """列出所有 stash"""
    result = run_git_command(["stash", "list"])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    stashes = []
    for line in result["output"].split("\n"):
        if line.strip():
            stashes.append(line.strip())

    return {"stashes": stashes}


# ==================== 静态文件服务 ====================

from pathlib import Path

# NOTE: 使用 Path.resolve() 获取绝对路径，避免以模块方式启动时路径错误
FRONTEND_DIR = str(Path(__file__).resolve().parent.parent / "frontend")
logger.info("前端静态文件目录: %s", FRONTEND_DIR)


@app.get("/")
def serve_index():
    """服务前端首页"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.isfile(index_path):
        raise HTTPException(status_code=500, detail=f"找不到前端文件: {index_path}")
    return FileResponse(index_path)


# NOTE: 静态文件挂载放在最后，避免覆盖 API 路由
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
else:
    logger.error("前端目录不存在: %s", FRONTEND_DIR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
