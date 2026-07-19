mod creation;
mod mod_build;
mod mod_scan;
mod project;
mod settings;

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    name: String,
    version: String,
    argv: Vec<String>,
}

/// 脚手架首条命令:应用名 / 版本 / 启动参数(--project 拉起链路后续消费 argv)。
#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    let pkg = app.package_info();
    AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
        argv: std::env::args().skip(1).collect(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();
            let mut s = settings::load(handle);
            // --project argv 自动绑定须在前端首个 invoke 前完成(桌游编辑器拉起链路)
            project::try_auto_bind_from_argv(handle, &mut s);
            app.manage(settings::SettingsState(std::sync::Mutex::new(s)));
            app.manage(mod_build::BuildState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            project::project_scan,
            project::project_scan_single,
            project::project_auto_detect_root,
            project::project_get_last_scan_root,
            project::project_get_snapshot,
            project::project_bind,
            project::project_unbind,
            mod_scan::mod_scan_project_raw,
            creation::mod_create_write,
            creation::behaviour_create_write,
            creation::mod_delete,
            mod_build::build_start,
            mod_build::build_cancel,
            mod_build::build_get_current_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
