use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::project::ProjectInfo;

/// 全部持久化设置(决策 3-A:单 settings.json,合并旧 electron-store 双文件
/// modforge-binding.json { bound/recent/lastScanRoot/preferredIdePath } 与
/// modforge-devenv.json { modSdkPath })。落盘于 app_config_dir(identifier 目录)。
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub bound: Option<ProjectInfo>,
    pub recent: Vec<ProjectInfo>,
    pub last_scan_root: Option<String>,
    pub preferred_ide_path: Option<String>,
    pub mod_sdk_path: Option<String>,
}

pub struct SettingsState(pub Mutex<Settings>);

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

/// 启动加载:文件不存在或解析失败一律回 Default(与旧 electron-store defaults 语义一致)。
pub fn load(app: &tauri::AppHandle) -> Settings {
    let Ok(path) = settings_path(app) else {
        return Settings::default();
    };
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

pub fn save(app: &tauri::AppHandle, s: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}
