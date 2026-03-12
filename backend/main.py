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


class BranchRenameRequest(BaseModel):
    """分支重命名请求"""
    old_name: str
    new_name: str


class BranchDescriptionRequest(BaseModel):
    """分支备注请求"""
    name: str
    description: str = ""


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


class ConfigRequest(BaseModel):
    """配置请求"""
    name: str = ""
    email: str = ""


class UnstageRequest(BaseModel):
    """撤销暂存请求"""
    files: Optional[list[str]] = None


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


class PushAllRequest(BaseModel):
    """一键全部上传请求"""
    commit_message: str
    remote_name: str = "origin"
    branch_name: str = "main"


@app.post("/api/push/all")
def push_all(req: PushAllRequest):
    """
    一键全部上传：暂存所有文件 → 提交 → 推送
    NOTE: 适合快速保存并上传所有本地修改，跳过逐个选文件的步骤
    """
    if not req.commit_message.strip():
        raise HTTPException(status_code=400, detail="提交信息不能为空")

    # 第一步：暂存全部文件
    add_result = run_git_command(["add", "."])
    if not add_result["success"]:
        raise HTTPException(status_code=400, detail=f"暂存失败: {add_result['error']}")

    # 检查是否有内容可提交（防止空提交报错）
    status_result = run_git_command(["status", "--porcelain"])
    staged_result = run_git_command(["diff", "--cached", "--name-only"])

    # 第二步：提交（如果有已暂存的内容）
    commit_output = ""
    if staged_result["success"] and staged_result["output"].strip():
        commit_result = run_git_command(["commit", "-m", req.commit_message])
        if not commit_result["success"]:
            raise HTTPException(status_code=400, detail=f"提交失败: {commit_result['error']}")
        commit_output = commit_result["output"]
    else:
        commit_output = "没有新的变更需要提交"

    # 第三步：推送
    push_result = run_git_command(
        ["push", "-u", req.remote_name, req.branch_name],
        timeout=120
    )
    if not push_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=f"提交成功，但推送失败：{push_result['error']}"
        )

    return {
        "success": True,
        "message": f"✅ 全部上传成功！已推送到 {req.remote_name}/{req.branch_name}",
        "commit_output": commit_output,
        "push_output": push_result["output"],
    }


class PushBranchesRequest(BaseModel):
    """多分支推送请求"""
    branches: list[str]
    remote_name: str = "origin"


@app.post("/api/push/branches")
def push_branches(req: PushBranchesRequest):
    """
    批量推送多个指定分支到远程仓库
    NOTE: 依次推送每个分支，记录各分支的成功/失败状态，全部完成后返回汇总
    """
    if not req.branches:
        raise HTTPException(status_code=400, detail="请至少选择一个分支")

    results = []
    success_count = 0
    fail_count = 0

    for branch in req.branches:
        branch = branch.strip()
        if not branch:
            continue
        result = run_git_command(
            ["push", "-u", req.remote_name, f"{branch}:{branch}"],
            timeout=120,
        )
        if result["success"]:
            success_count += 1
            results.append({"branch": branch, "success": True, "output": result["output"]})
        else:
            fail_count += 1
            results.append({"branch": branch, "success": False, "error": result["error"]})

    overall_success = fail_count == 0
    message = f"推送完成：共 {len(results)} 个分支，成功 {success_count} 个"
    if fail_count > 0:
        message += f"，失败 {fail_count} 个"

    return {
        "success": overall_success,
        "message": message,
        "results": results,
    }

@app.post("/api/remote/fetch")
def fetch_remote():
    """获取远程更新"""
    result = run_git_command(["fetch", "--all"], timeout=120)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=f"获取失败: {result['error']}")
        
    return {"success": True, "message": "已获取远程更新", "output": result["output"]}


@app.post("/api/remote/pull")
def pull_remote():
    """拉取远程更新并合并"""
    result = run_git_command(["pull"], timeout=120)
    if not result["success"]:
        # NOTE: 返回更详细的错误，以便前端判断是否冲突
        raise HTTPException(status_code=400, detail=f"拉取失败: {result['error']}\n请检查是否发生冲突。")
        
    return {"success": True, "message": "拉取成功", "output": result["output"]}


# ==================== 状态查看 ====================

@app.get("/api/status")
def get_status():
    """获取仓库状态"""
    result = run_git_command(["status", "--porcelain=v1"])
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    # NOTE: 检查是否处于合并冲突状态
    is_merging = False
    if CURRENT_REPO_PATH:
        merge_head_path = os.path.join(CURRENT_REPO_PATH, ".git", "MERGE_HEAD")
        is_merging = os.path.exists(merge_head_path)

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

    return {"files": files, "clean": len(files) == 0, "is_merging": is_merging}


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
                        "description": "",
                        "diff_summary": "",
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

                    # NOTE: 读取分支自定义备注
                    desc_result = run_git_command([
                        "config", f"branch.{b_name}.description",
                    ])
                    if desc_result["success"] and desc_result["output"]:
                        b_info["description"] = desc_result["output"]

                    # NOTE: 自动生成代码变更摘要（仅对有领先提交的分支）
                    if b_info["ahead"] > 0:
                        diff_result = run_git_command([
                            "diff", "--stat", f"{main_branch}...{b_name}",
                        ])
                        if diff_result["success"] and diff_result["output"]:
                            b_info["diff_summary"] = _parse_diff_stat(diff_result["output"])

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


@app.post("/api/branches/rename")
def rename_branch(req: BranchRenameRequest):
    """
    重命名分支
    NOTE: 使用 git branch -m 完成重命名，同时迁移 description 配置
    """
    result = run_git_command(["branch", "-m", req.old_name, req.new_name])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    # NOTE: 迁移旧分支的 description 到新分支名下
    old_desc = run_git_command(["config", f"branch.{req.old_name}.description"])
    if old_desc["success"] and old_desc["output"]:
        run_git_command(["config", f"branch.{req.new_name}.description", old_desc["output"]])
        run_git_command(["config", "--unset", f"branch.{req.old_name}.description"])

    return {"success": True, "message": f"分支已重命名: '{req.old_name}' → '{req.new_name}'"}


@app.get("/api/branches/description")
def get_branch_description(name: str = Query(...)):
    """读取分支备注"""
    result = run_git_command(["config", f"branch.{name}.description"])
    return {"name": name, "description": result["output"] if result["success"] else ""}


@app.post("/api/branches/description")
def set_branch_description(req: BranchDescriptionRequest):
    """
    设置分支备注
    NOTE: 利用 Git 原生的 branch.xxx.description 配置项，持久化存储
    """
    if req.description.strip():
        result = run_git_command(["config", f"branch.{req.name}.description", req.description])
    else:
        # NOTE: 空描述时删除配置项
        result = run_git_command(["config", "--unset", f"branch.{req.name}.description"])
        # --unset 在 key 不存在时会失败，这是正常的
        return {"success": True, "message": "备注已清除"}

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": f"分支 '{req.name}' 的备注已更新"}


@app.post("/api/merge/abort")
def abort_merge():
    """中止合并，恢复到合并前的状态"""
    result = run_git_command(["merge", "--abort"])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {"success": True, "message": "合并已中止"}


def _parse_diff_stat(stat_output: str) -> str:
    """
    解析 git diff --stat 的输出，生成简洁的中文摘要
    例如: "修改了 3 个 .ts 文件, 1 个 .css 文件（+150 / -20 行）"
    """
    import re
    lines = stat_output.strip().split("\n")
    if not lines:
        return ""

    # NOTE: 最后一行是汇总行，如 "3 files changed, 150 insertions(+), 20 deletions(-)"
    summary_line = lines[-1].strip()

    # 统计文件后缀
    ext_counts: dict[str, int] = {}
    for line in lines[:-1]:
        match = re.match(r"^\s*(.+?)\s+\|\s+\d+", line)
        if match:
            filepath = match.group(1).strip()
            ext = filepath.rsplit(".", 1)[-1] if "." in filepath else "其他"
            ext_counts[f".{ext}"] = ext_counts.get(f".{ext}", 0) + 1

    # 解析增删行数
    insertions = 0
    deletions = 0
    ins_match = re.search(r"(\d+) insertion", summary_line)
    del_match = re.search(r"(\d+) deletion", summary_line)
    if ins_match:
        insertions = int(ins_match.group(1))
    if del_match:
        deletions = int(del_match.group(1))

    # 组装摘要
    ext_parts = [f"{count} 个 {ext} 文件" for ext, count in sorted(ext_counts.items(), key=lambda x: -x[1])[:3]]
    ext_text = "、".join(ext_parts) if ext_parts else "文件"

    return f"修改了 {ext_text}（+{insertions} / -{deletions} 行）"


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


# ==================== Diff 查看 ====================


@app.get("/api/diff/file")
def get_file_diff(path: str = Query(..., description="文件路径")):
    """
    获取单个文件的工作区 diff
    NOTE: 先尝试 staged diff（已暂存），再尝试 unstaged diff（未暂存），两者合并返回
    """
    # NOTE: 已暂存的变更
    staged_result = run_git_command(["diff", "--cached", "--", path])
    # NOTE: 未暂存的变更
    unstaged_result = run_git_command(["diff", "--", path])
    # NOTE: 未跟踪文件直接读取内容
    untracked_content = ""
    if (not staged_result["success"] or not staged_result["output"]) and \
       (not unstaged_result["success"] or not unstaged_result["output"]):
        # 可能是未跟踪的新文件，尝试读取文件内容
        if CURRENT_REPO_PATH:
            full_path = os.path.join(CURRENT_REPO_PATH, path)
            if os.path.isfile(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    # NOTE: 为未跟踪文件生成伪 diff 输出
                    lines = content.split("\n")
                    diff_lines = [f"+{line}" for line in lines]
                    untracked_content = f"--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{len(lines)} @@\n" + "\n".join(diff_lines)
                except Exception:
                    pass

    staged_diff = staged_result["output"] if staged_result["success"] else ""
    unstaged_diff = unstaged_result["output"] if unstaged_result["success"] else ""

    return {
        "path": path,
        "staged_diff": staged_diff,
        "unstaged_diff": unstaged_diff,
        "untracked_content": untracked_content,
        "has_diff": bool(staged_diff or unstaged_diff or untracked_content),
    }


@app.get("/api/diff/commit")
def get_commit_diff(hash: str = Query(..., description="提交哈希")):
    """
    获取指定提交的 diff 详情
    NOTE: 返回该提交相对于其父提交的完整变更内容
    """
    # NOTE: 获取提交的基本信息
    info_result = run_git_command([
        "show", "--no-patch",
        "--format=%H|%h|%an|%ae|%ai|%s",
        hash,
    ])
    commit_info = {}
    if info_result["success"] and info_result["output"]:
        parts = info_result["output"].split("|", 5)
        if len(parts) >= 6:
            commit_info = {
                "hash": parts[0],
                "short_hash": parts[1],
                "author": parts[2],
                "email": parts[3],
                "date": parts[4],
                "message": parts[5],
            }

    # NOTE: 获取变更文件列表统计
    stat_result = run_git_command(["diff", "--stat", f"{hash}~1..{hash}"])
    stat_text = stat_result["output"] if stat_result["success"] else ""

    # NOTE: 获取完整 diff 内容
    diff_result = run_git_command(["diff", f"{hash}~1..{hash}"], timeout=60)
    diff_text = diff_result["output"] if diff_result["success"] else ""

    # NOTE: 获取变更文件列表
    files_result = run_git_command(["diff", "--name-status", f"{hash}~1..{hash}"])
    changed_files = []
    if files_result["success"] and files_result["output"]:
        for line in files_result["output"].split("\n"):
            if line.strip():
                parts = line.split("\t", 1)
                if len(parts) >= 2:
                    status_map = {
                        "M": "已修改", "A": "新增", "D": "已删除",
                        "R": "重命名", "C": "复制",
                    }
                    changed_files.append({
                        "status": status_map.get(parts[0].strip(), parts[0].strip()),
                        "path": parts[1].strip(),
                    })

    return {
        "commit": commit_info,
        "stat": stat_text,
        "diff": diff_text,
        "changed_files": changed_files,
    }


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


@app.post("/api/unstage")
def unstage_files(req: UnstageRequest):
    """
    撤销暂存（将文件从暂存区移回工作区）
    NOTE: 使用 git reset HEAD 将已 add 的文件移出暂存区
    """
    if req.files:
        result = run_git_command(["reset", "HEAD"] + req.files)
    else:
        result = run_git_command(["reset", "HEAD"])

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"success": True, "message": "已撤销暂存"}


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


# ==================== 用户配置 ====================

@app.get("/api/config/user")
def get_user_config():
    """获取当前用户配置"""
    name_result = run_git_command(["config", "user.name"])
    email_result = run_git_command(["config", "user.email"])
    
    return {
        "name": name_result["output"] if name_result["success"] else "",
        "email": email_result["output"] if email_result["success"] else ""
    }


@app.post("/api/config/user")
def set_user_config(req: ConfigRequest):
    """设置当前仓库用户配置"""
    if req.name.strip():
        run_git_command(["config", "user.name", req.name.strip()])
    else:
        run_git_command(["config", "--unset", "user.name"])
        
    if req.email.strip():
        run_git_command(["config", "user.email", req.email.strip()])
    else:
        run_git_command(["config", "--unset", "user.email"])
        
    return {"success": True, "message": "用户身份信息已更新"}


# ==================== 团队协作 API ====================

@app.get("/api/contributors")
def list_contributors():
    """
    获取所有贡献者列表，按提交数排序
    NOTE: 使用 git shortlog 统计每人提交数和邮箱，用于团队协作面板
    """
    result = run_git_command(["shortlog", "-sne", "--all"])
    if not result["success"]:
        return {"contributors": []}

    contributors = []
    for line in result["output"].split("\n"):
        line = line.strip()
        if not line:
            continue
        # 格式: "  42\tAuthorName <email@example.com>"
        import re
        match = re.match(r"^\s*(\d+)\s+(.+?)\s+<(.+?)>$", line)
        if match:
            contributors.append({
                "commits": int(match.group(1)),
                "name": match.group(2).strip(),
                "email": match.group(3).strip(),
            })

    # NOTE: 按提交数降序排列
    contributors.sort(key=lambda x: x["commits"], reverse=True)
    return {"contributors": contributors, "total": len(contributors)}


@app.get("/api/branches/protection")
def check_branch_protection():
    """
    检查当前分支是否为受保护的主分支
    NOTE: 多人协作时应避免直接在 master/main 上提交，引导用户创建功能分支
    """
    current_result = run_git_command(["branch", "--show-current"])
    current_branch = current_result["output"].strip() if current_result["success"] else ""

    # NOTE: 受保护的分支名列表
    protected_branches = ["master", "main", "develop", "release"]
    is_protected = current_branch.lower() in protected_branches

    return {
        "current_branch": current_branch,
        "is_protected": is_protected,
        "protected_branches": protected_branches,
        "warning": f"当前在受保护分支 '{current_branch}' 上，建议创建功能分支后再提交"
        if is_protected else "",
    }


@app.get("/api/remote/sync-status")
def get_sync_status():
    """
    获取本地分支与远程分支的同步状态
    NOTE: 比较所有有远程跟踪的本地分支，返回领先/落后提交数
    """
    # 先 fetch 一下获取最新远程状态（静默，不合并）
    run_git_command(["fetch", "--all", "--quiet"], timeout=60)

    current_result = run_git_command(["branch", "--show-current"])
    current_branch = current_result["output"].strip() if current_result["success"] else ""

    branches_status = []

    # NOTE: 获取所有有远程跟踪分支的本地分支
    branch_list_result = run_git_command(["branch", "--format=%(refname:short)"])
    if not branch_list_result["success"]:
        return {"branches": [], "current_branch": current_branch}

    for line in branch_list_result["output"].split("\n"):
        branch_name = line.strip()
        if not branch_name:
            continue

        # NOTE: 查找对应的远程跟踪分支
        tracking_result = run_git_command([
            "rev-parse", "--abbrev-ref", f"{branch_name}@{{upstream}}",
        ])
        if not tracking_result["success"]:
            continue

        remote_branch = tracking_result["output"].strip()

        # NOTE: 计算领先/落后提交数
        count_result = run_git_command([
            "rev-list", "--left-right", "--count",
            f"{branch_name}...{remote_branch}",
        ])
        if count_result["success"]:
            parts = count_result["output"].split()
            if len(parts) == 2:
                ahead = int(parts[0])
                behind = int(parts[1])
                status = "synced"
                if ahead > 0 and behind > 0:
                    status = "diverged"
                elif ahead > 0:
                    status = "ahead"
                elif behind > 0:
                    status = "behind"

                branches_status.append({
                    "branch": branch_name,
                    "remote_branch": remote_branch,
                    "ahead": ahead,
                    "behind": behind,
                    "status": status,
                    "is_current": branch_name == current_branch,
                })

    return {
        "branches": branches_status,
        "current_branch": current_branch,
    }


@app.get("/api/conflicts")
def detect_conflicts():
    """
    检测当前工作区中的冲突文件
    NOTE: 用于合并冲突时提示团队成员需要手动解决的文件列表
    """
    # NOTE: 检查是否处于合并中
    is_merging = False
    if CURRENT_REPO_PATH:
        merge_head_path = os.path.join(CURRENT_REPO_PATH, ".git", "MERGE_HEAD")
        is_merging = os.path.exists(merge_head_path)

    conflict_files = []
    if is_merging:
        result = run_git_command(["diff", "--name-only", "--diff-filter=U"])
        if result["success"] and result["output"]:
            for f in result["output"].split("\n"):
                if f.strip():
                    conflict_files.append(f.strip())

    return {
        "is_merging": is_merging,
        "conflict_files": conflict_files,
        "count": len(conflict_files),
    }


@app.get("/api/activity/recent")
def get_recent_activity():
    """
    获取最近活动概览，按作者分组
    NOTE: 显示最近 7 天每位贡献者的提交活动，帮助团队了解他人进展
    """
    # NOTE: 获取最近 7 天所有分支的提交
    result = run_git_command([
        "log", "--all", "--since=7.days",
        "--format=%H|%h|%an|%ae|%ai|%s",
        "--no-merges",
    ])
    if not result["success"]:
        return {"activities": [], "authors": {}}

    activities = []
    author_stats: dict[str, dict] = {}

    for line in result["output"].split("\n"):
        if not line.strip():
            continue
        parts = line.split("|", 5)
        if len(parts) < 6:
            continue

        author_name = parts[2]
        author_email = parts[3]

        activity = {
            "hash": parts[0],
            "short_hash": parts[1],
            "author": author_name,
            "email": author_email,
            "date": parts[4],
            "message": parts[5],
        }
        activities.append(activity)

        # NOTE: 按作者聚合统计
        author_key = author_email
        if author_key not in author_stats:
            author_stats[author_key] = {
                "name": author_name,
                "email": author_email,
                "commit_count": 0,
                "latest_date": "",
                "latest_message": "",
            }
        author_stats[author_key]["commit_count"] += 1
        if not author_stats[author_key]["latest_date"] or parts[4] > author_stats[author_key]["latest_date"]:
            author_stats[author_key]["latest_date"] = parts[4]
            author_stats[author_key]["latest_message"] = parts[5]

    return {
        "activities": activities[:50],  # NOTE: 限制返回条数避免数据过大
        "authors": author_stats,
        "total_commits": len(activities),
    }


@app.get("/api/blame-summary")
def get_blame_summary():
    """
    获取代码贡献者的文件修改分布统计
    NOTE: 统计每位作者最近修改的文件分布，帮助了解团队成员各自负责的模块
    """
    # NOTE: 获取所有作者最近的文件修改分布
    result = run_git_command([
        "log", "--all", "-100", "--name-only",
        "--format=COMMIT_BY:%an",
        "--no-merges",
    ])
    if not result["success"]:
        return {"authors": {}}

    author_files: dict[str, dict[str, int]] = {}
    current_author = ""

    for line in result["output"].split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("COMMIT_BY:"):
            current_author = line[10:]
            if current_author not in author_files:
                author_files[current_author] = {}
        elif current_author:
            # NOTE: 按文件扩展名分组，展示作者擅长的技术领域
            ext = line.rsplit(".", 1)[-1] if "." in line else "其他"
            ext_key = f".{ext}"
            author_files[current_author][ext_key] = author_files[current_author].get(ext_key, 0) + 1

    # NOTE: 将每位作者的文件类型按数量排序
    summary = {}
    for author, files in author_files.items():
        sorted_files = sorted(files.items(), key=lambda x: -x[1])[:5]
        summary[author] = {
            "file_types": [{"ext": ext, "count": count} for ext, count in sorted_files],
            "total_files": sum(files.values()),
        }

    return {"authors": summary}


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
