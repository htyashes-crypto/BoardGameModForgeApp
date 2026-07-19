use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::settings::{self, Settings, SettingsState};

/// 桌游工程信息(镜像旧 main/types.ts ProjectInfo,serde camelCase 对齐前端字段)。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub has_mod_behaviour_project: bool,
    pub mod_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_opened_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBindingSnapshot {
    pub bound: Option<ProjectInfo>,
    pub recent: Vec<ProjectInfo>,
}

const MAX_RECENT: usize = 10;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 镜像旧 ProjectScanService.inspectModBehaviour:检测 ModBehaviourProject/ 并数一级子目录。
fn inspect_mod_behaviour(project_path: &Path) -> (bool, u32) {
    let mb = project_path.join("ModBehaviourProject");
    if !mb.is_dir() {
        return (false, 0);
    }
    let mut count = 0u32;
    if let Ok(rd) = fs::read_dir(&mb) {
        for e in rd.flatten() {
            if e.path().is_dir() {
                count += 1;
            }
        }
    }
    (true, count)
}

fn inspect_project(path: &Path) -> Option<ProjectInfo> {
    if !path.is_dir() {
        return None;
    }
    let name = path.file_name()?.to_string_lossy().into_owned();
    let (has_mb, mod_count) = inspect_mod_behaviour(path);
    Some(ProjectInfo {
        path: path.to_string_lossy().into_owned(),
        name,
        has_mod_behaviour_project: has_mb,
        mod_count,
        last_opened_at: None,
    })
}

/// 绑定进 settings(镜像旧 ProjectBindingService.bind:盖 ms 时间戳,recent 去重提队首,截 10)。
pub fn bind_into(s: &mut Settings, project: ProjectInfo) -> ProjectInfo {
    let stamped = ProjectInfo {
        last_opened_at: Some(now_ms()),
        ..project
    };
    s.bound = Some(stamped.clone());
    s.recent.retain(|p| p.path != stamped.path);
    s.recent.insert(0, stamped.clone());
    s.recent.truncate(MAX_RECENT);
    stamped
}

fn snapshot_of(s: &Settings) -> ProjectBindingSnapshot {
    ProjectBindingSnapshot {
        bound: s.bound.clone(),
        recent: s.recent.clone(),
    }
}

/// 启动期 --project <path> / --project=<path> 自动绑定(镜像旧 main/index.ts tryAutoBindFromArgv,
/// 供桌游编辑器拉起即绑定;在 setup 内、前端首个 invoke 前完成)。
pub fn try_auto_bind_from_argv(app: &tauri::AppHandle, s: &mut Settings) {
    let args: Vec<String> = std::env::args().collect();
    let mut project_path: Option<String> = None;
    for (i, arg) in args.iter().enumerate() {
        if arg == "--project" {
            if let Some(next) = args.get(i + 1) {
                project_path = Some(next.clone());
            }
            break;
        }
        if let Some(rest) = arg.strip_prefix("--project=") {
            project_path = Some(rest.to_string());
            break;
        }
    }
    let Some(raw) = project_path else { return };
    // 兼容部分启动器保留包裹引号的场景
    let cleaned = raw.trim_matches('"').to_string();
    let Some(info) = inspect_project(Path::new(&cleaned)) else {
        eprintln!("[ModForge] --project 指向路径无效,忽略: {cleaned}");
        return;
    };
    bind_into(s, info);
    if let Err(e) = settings::save(app, s) {
        eprintln!("[ModForge] --project auto-bind 持久化失败: {e}");
    }
}

/// 扫描根目录一级子目录出工程列表(镜像旧 scan:跳 . 前缀 / 失败返空 / 按名序);
/// 并镜像旧 project:scan 胶水 —— 非空 rootDir 顺带持久化为 lastScanRoot。
#[tauri::command]
pub fn project_scan(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
    root_dir: String,
) -> Result<Vec<ProjectInfo>, String> {
    if root_dir.is_empty() {
        return Ok(vec![]);
    }
    {
        let mut s = state.0.lock().map_err(|e| e.to_string())?;
        s.last_scan_root = Some(root_dir.clone());
        settings::save(&app, &s)?;
    }
    let Ok(rd) = fs::read_dir(&root_dir) else {
        return Ok(vec![]);
    };
    let mut results: Vec<ProjectInfo> = vec![];
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        if let Some(info) = inspect_project(&e.path()) {
            results.push(info);
        }
    }
    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

/// 单工程详情(前端 dialog 选目录后调用;镜像旧 scanSingle)。
#[tauri::command]
pub fn project_scan_single(path: String) -> Result<Option<ProjectInfo>, String> {
    if path.is_empty() {
        return Ok(None);
    }
    Ok(inspect_project(Path::new(&path)))
}

/// 自动探测扫描根:持久化 root 仍存在 → 用之;否则从 cwd 向上找「桌游工程文件/」。
/// 旧实现探 ../ 与 ../../(electron dev cwd=工程根);tauri dev cwd=src-tauri/ 深一级,
/// 故补 ../../../ 保持"能找到工程根同级/上级的桌游工程文件"这一行为不变。
#[tauri::command]
pub fn project_auto_detect_root(state: State<'_, SettingsState>) -> Result<Option<String>, String> {
    let saved = state.0.lock().map_err(|e| e.to_string())?.last_scan_root.clone();
    if let Some(root) = saved {
        if Path::new(&root).is_dir() {
            return Ok(Some(root));
        }
    }
    let Ok(cwd) = std::env::current_dir() else {
        return Ok(None);
    };
    for up in ["..", "../..", "../../.."] {
        let candidate: PathBuf = cwd.join(up).join("桌游工程文件");
        if candidate.is_dir() {
            return Ok(Some(candidate.to_string_lossy().into_owned()));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn project_get_last_scan_root(state: State<'_, SettingsState>) -> Result<Option<String>, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.last_scan_root.clone())
}

#[tauri::command]
pub fn project_get_snapshot(state: State<'_, SettingsState>) -> Result<ProjectBindingSnapshot, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?;
    Ok(snapshot_of(&s))
}

#[tauri::command]
pub fn project_bind(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
    project: ProjectInfo,
) -> Result<ProjectBindingSnapshot, String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    bind_into(&mut s, project);
    settings::save(&app, &s)?;
    Ok(snapshot_of(&s))
}

#[tauri::command]
pub fn project_unbind(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
) -> Result<ProjectBindingSnapshot, String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.bound = None;
    settings::save(&app, &s)?;
    Ok(snapshot_of(&s))
}
