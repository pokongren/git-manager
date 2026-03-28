/**
 * Git 管理工具 - API 封装层
 * 统一处理所有与后端 REST API 的通信
 */

const API_BASE = ''

/**
 * 封装 API 请求，统一处理错误
 * @param url API 路径
 * @param options fetch 选项
 * @returns 响应 JSON
 */
export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || '请求失败')
    }

    return data as T
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to fetch') {
      throw new Error('无法连接到服务器，请确认后端已启动')
    }
    throw error
  }
}

// ==================== 仓库管理 ====================

export interface RepoInfo {
  connected: boolean
  path?: string
  root?: string
  current_branch?: string
  remotes?: string
}

export function openRepo(path: string) {
  return apiRequest('/api/repo/open', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

export function cloneRepo(url: string, path: string) {
  return apiRequest<{ success: boolean; message: string; path: string }>('/api/repo/clone', {
    method: 'POST',
    body: JSON.stringify({ url, path }),
  })
}

export function getRepoInfo() {
  return apiRequest<RepoInfo>('/api/repo/info')
}

export function browseFolderDialog() {
  return apiRequest<{ success: boolean; path: string }>('/api/dialog/browse-folder')
}

// ==================== 状态管理 ====================

export interface StatusFile {
  path: string
  index: string
  working: string
  raw: string
}

export interface StatusData {
  files: StatusFile[]
  clean: boolean
  is_merging: boolean
}

export function getStatus() {
  return apiRequest<StatusData>('/api/status')
}

export function stageFiles(files?: string[]) {
  return apiRequest('/api/stage', {
    method: 'POST',
    body: JSON.stringify({ message: '', files }),
  })
}

export function unstageFiles(files?: string[]) {
  return apiRequest('/api/unstage', {
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}

export function commitChanges(message: string) {
  return apiRequest('/api/commit', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function abortMerge() {
  return apiRequest('/api/merge/abort', { method: 'POST' })
}

// ==================== 分支管理 ====================

export interface BranchInfo {
  name: string
  hash: string
  date: string
  message: string
  current: boolean
  remote: boolean
}

export interface BranchTreeData {
  main_branch: string
  main_branch_size?: string
  current_branch: string
  main_commits: {
    hash: string
    short_hash: string
    message: string
    date: string
  }[]
  branches: {
    name: string
    hash: string
    message: string
    date: string
    author: string
    current: boolean
    ahead: number
    behind: number
    merge_base: string
    description: string
    diff_summary: string
    size?: string
  }[]
  remote_branches: {
    name: string
    local_name: string
    hash: string
    message: string
    date: string
    has_local: boolean
    size?: string
  }[]
}

export function getBranchTree() {
  return apiRequest<BranchTreeData>('/api/branch-tree')
}

export function createBranch(name: string, source?: string) {
  return apiRequest('/api/branches/create', {
    method: 'POST',
    body: JSON.stringify({ name, source: source || undefined }),
  })
}

export function switchBranch(name: string) {
  return apiRequest('/api/branches/switch', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function deleteBranch(name: string) {
  return apiRequest('/api/branches/delete', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function mergeBranch(sourceBranch: string) {
  return apiRequest('/api/branches/merge', {
    method: 'POST',
    body: JSON.stringify({ source_branch: sourceBranch }),
  })
}

export function renameBranch(oldName: string, newName: string) {
  return apiRequest('/api/branches/rename', {
    method: 'POST',
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  })
}

export function setBranchDescription(name: string, description: string) {
  return apiRequest('/api/branches/description', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
}

// ==================== 备份管理 ====================

export interface TagInfo {
  name: string
  hash: string
  message: string
  date: string
}

export function getTags() {
  return apiRequest<{ tags: TagInfo[] }>('/api/tags')
}

export function createBackup(tagName: string, message?: string) {
  return apiRequest('/api/backup/create', {
    method: 'POST',
    body: JSON.stringify({ tag_name: tagName, message }),
  })
}

export function deleteTag(tagName: string) {
  return apiRequest('/api/backup/delete', {
    method: 'POST',
    body: JSON.stringify({ tag_name: tagName }),
  })
}

export function restoreToTag(target: string) {
  return apiRequest('/api/restore', {
    method: 'POST',
    body: JSON.stringify({ target }),
  })
}

export interface StashInfo {
  index: number
  message: string
}

/**
 * NOTE: 后端返回的 stashes 是字符串列表，前端需要解析
 */
export async function getStashes(): Promise<{ stashes: StashInfo[] }> {
  const data = await apiRequest<{ stashes: string[] }>('/api/stash/list')
  const stashes: StashInfo[] = (data.stashes || []).map((line, i) => {
    // 格式: "stash@{0}: On branch-name: message"
    const match = line.match(/^stash@\{(\d+)\}:\s*(.*)$/)
    return {
      index: match ? parseInt(match[1]) : i,
      message: match ? match[2] : line,
    }
  })
  return { stashes }
}

export function stashSave() {
  return apiRequest('/api/stash/save', { method: 'POST' })
}

export function stashPop() {
  return apiRequest('/api/stash/pop', { method: 'POST' })
}

export function stashDrop(index: number) {
  return apiRequest('/api/stash/drop', {
    method: 'POST',
    body: JSON.stringify({ index }),
  })
}

// ==================== 提交历史 ====================

export interface CommitInfo {
  hash: string
  short_hash: string
  author: string
  date: string
  message: string
}

export function getHistory() {
  return apiRequest<{ commits: CommitInfo[] }>('/api/log')
}

/**
 * NOTE: 后端返回 { commit, stat, diff, changed_files } 格式
 */
export interface CommitDiffData {
  commit: Record<string, string>
  stat: string
  diff: string
  changed_files: { status: string; path: string }[]
}

export function getCommitDiff(hash: string) {
  return apiRequest<CommitDiffData>(`/api/diff/commit?hash=${encodeURIComponent(hash)}`)
}

/**
 * NOTE: 后端返回 staged_diff / unstaged_diff / untracked_content 三个字段
 */
export interface FileDiffData {
  path: string
  staged_diff: string
  unstaged_diff: string
  untracked_content: string
  has_diff: boolean
}

export function getFileDiff(filepath: string) {
  return apiRequest<FileDiffData>(`/api/diff/file?path=${encodeURIComponent(filepath)}`)
}

// ==================== 远程同步 ====================

export interface RemoteInfo {
  name: string
  url: string
}

export function listRemotes() {
  return apiRequest<{ remotes: RemoteInfo[] }>('/api/remote/list')
}

export function addRemote(name: string, url: string) {
  return apiRequest('/api/remote/add', {
    method: 'POST',
    body: JSON.stringify({ name, url }),
  })
}

export function fetchRemote() {
  return apiRequest('/api/remote/fetch', { method: 'POST' })
}

export function fetchPreview() {
  return apiRequest<{
    success: boolean
    current_branch: string
    behind: number
    ahead: number
    incoming_commits: { hash: string; author: string; date: string; message: string }[]
    message: string
  }>('/api/remote/fetch-preview', { method: 'POST' })
}

export function pullRemote(remoteName?: string, branchName?: string) {
  return apiRequest('/api/remote/pull', {
    method: 'POST',
    body: JSON.stringify({
      remote_name: remoteName || 'origin',
      branch_name: branchName || null,
    }),
  })
}

export function pushToRemote(remoteName: string, branchName: string) {
  return apiRequest('/api/push', {
    method: 'POST',
    body: JSON.stringify({ remote_name: remoteName, branch_name: branchName }),
  })
}

export function pushAll(commitMessage: string, remoteName: string, branchName: string) {
  return apiRequest<{ success: boolean; message: string }>('/api/push/all', {
    method: 'POST',
    body: JSON.stringify({
      commit_message: commitMessage,
      remote_name: remoteName,
      branch_name: branchName,
    }),
  })
}

export function pushBranches(branches: string[], remoteName: string) {
  return apiRequest<{
    success: boolean
    message: string
    results: { branch: string; success: boolean; output?: string; error?: string }[]
  }>('/api/push/branches', {
    method: 'POST',
    body: JSON.stringify({ branches, remote_name: remoteName }),
  })
}

// ==================== 用户配置 ====================

export function getUserConfig() {
  return apiRequest<{ name: string; email: string }>('/api/config/user')
}

export function setUserConfig(name: string, email: string) {
  return apiRequest('/api/config/user', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  })
}

// ==================== 同步状态 ====================

export function getSyncStatus() {
  return apiRequest<{
    branches: {
      name: string
      ahead: number
      behind: number
      remote_branch: string
    }[]
  }>('/api/remote/sync-status')
}

// ==================== 分支列表（用于推送选择） ====================

export function getBranches() {
  return apiRequest<{ branches: BranchInfo[]; current: string }>('/api/branches')
}

// ==================== .gitignore 文件类型管理 ====================

export interface FileTypeGroup {
  id: string
  name: string
  icon: string
  description: string
  patterns: string[]
  is_ignored: boolean
  file_count: number
  total_size: string
  total_size_bytes: number
}

export interface FileTypesData {
  groups: FileTypeGroup[]
  gitignore_exists: boolean
}

export function getFileTypes() {
  return apiRequest<FileTypesData>('/api/gitignore/file-types')
}

export function updateGitignore(ignoredGroups: string[]) {
  return apiRequest<{ success: boolean; message: string }>('/api/gitignore/update', {
    method: 'POST',
    body: JSON.stringify({ ignored_groups: ignoredGroups }),
  })
}

export function getGitignoreRaw() {
  return apiRequest<{ exists: boolean; content: string; path: string }>('/api/gitignore/raw')
}

