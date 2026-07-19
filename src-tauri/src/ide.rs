use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;

use crate::settings::{self, SettingsState};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedIde {
    pub name: String,
    pub path: String,
}

/// 通用:带超时捕获输出跑外部命令(CREATE_NO_WINDOW,轮询 try_wait)。
pub fn run_command_capture(
    cmd: &str,
    args: &[&str],
    cwd: Option<&Path>,
    timeout: Duration,
) -> Result<(bool, i64, String, String), String> {
    let mut c = Command::new(cmd);
    c.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(d) = cwd {
        c.current_dir(d);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = c.spawn().map_err(|e| e.to_string())?;

    let mut out_reader = child.stdout.take();
    let mut err_reader = child.stderr.take();
    let out_handle = std::thread::spawn(move || {
        use std::io::Read;
        let mut s = String::new();
        if let Some(r) = out_reader.as_mut() {
            let _ = r.read_to_string(&mut s);
        }
        s
    });
    let err_handle = std::thread::spawn(move || {
        use std::io::Read;
        let mut s = String::new();
        if let Some(r) = err_reader.as_mut() {
            let _ = r.read_to_string(&mut s);
        }
        s
    });

    let deadline = Instant::now() + timeout;
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break Some(st),
            Ok(None) => {
                if Instant::now() > deadline {
                    timed_out = true;
                    let _ = child.kill();
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(_) => {
                let _ = child.kill();
                break child.wait().ok();
            }
        }
    };
    let stdout = out_handle.join().unwrap_or_default();
    let mut stderr = err_handle.join().unwrap_or_default();
    if timed_out {
        stderr.push_str("\n[超时,已 kill]");
    }
    let (success, code) = match status {
        Some(st) => (st.success() && !timed_out, st.code().map(i64::from).unwrap_or(-1)),
        None => (false, -1),
    };
    Ok((success, code, stdout, stderr))
}

/// 按 Name + AppID 关键字识别 IDE 类型(镜像旧 classifyIdeName:VS Code 先于 VS)。
fn classify_ide_name(name: &str, app_id: &str) -> Option<&'static str> {
    let lower = format!("{name} {app_id}").to_lowercase();
    if lower.contains("cursor") {
        Some("Cursor")
    } else if lower.contains("rider") {
        Some("Rider")
    } else if lower.contains("visual studio code") || lower.contains("vscode") {
        Some("VSCode")
    } else if lower.contains("visual studio") && !lower.contains("code") {
        Some("VS")
    } else {
        None
    }
}

fn env_dir(var: &str, default: &str) -> String {
    std::env::var(var).unwrap_or_else(|_| default.to_string())
}

fn local_app_data() -> String {
    std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        Path::new(&home).join("AppData").join("Local").to_string_lossy().into_owned()
    })
}

/// 主链路:PowerShell Get-StartApps(5s 超时;只接 .exe AppID,过滤 UWP)。失败返空不阻塞。
fn detect_via_start_apps() -> Vec<DetectedIde> {
    let Ok((success, _, stdout, _)) = run_command_capture(
        "powershell.exe",
        &["-NoProfile", "-NonInteractive", "-Command", "Get-StartApps | ConvertTo-Json -Compress"],
        None,
        Duration::from_secs(5),
    ) else {
        return vec![];
    };
    if !success || stdout.trim().is_empty() {
        return vec![];
    }
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) else {
        return vec![];
    };
    let list: Vec<serde_json::Value> = match parsed {
        serde_json::Value::Array(a) => a,
        v => vec![v],
    };
    let mut out = vec![];
    for app in list {
        let (Some(name), Some(app_id)) = (
            app.get("Name").and_then(|v| v.as_str()),
            app.get("AppID").and_then(|v| v.as_str()),
        ) else {
            continue;
        };
        if !app_id.to_lowercase().ends_with(".exe") {
            continue;
        }
        if let Some(kind) = classify_ide_name(name, app_id) {
            out.push(DetectedIde { name: kind.to_string(), path: app_id.to_string() });
        }
    }
    out
}

/// 降级链路:硬编码标准路径扫描(镜像旧 detectViaHardcodedPaths,每类取首个命中)。
fn detect_via_hardcoded_paths() -> Vec<DetectedIde> {
    let mut found = vec![];
    let lad = local_app_data();
    let pf = env_dir("ProgramFiles", r"C:\Program Files");
    let pfx86 = env_dir("ProgramFiles(x86)", r"C:\Program Files (x86)");

    let cursor: Vec<PathBuf> = vec![
        Path::new(&pf).join("cursor").join("Cursor.exe"),
        Path::new(&pf).join("Cursor").join("Cursor.exe"),
        Path::new(&pfx86).join("cursor").join("Cursor.exe"),
        Path::new(&lad).join("Programs").join("cursor").join("Cursor.exe"),
        Path::new(&lad).join("Programs").join("Cursor").join("Cursor.exe"),
    ];
    if let Some(p) = cursor.into_iter().find(|p| p.is_file()) {
        found.push(DetectedIde { name: "Cursor".into(), path: p.to_string_lossy().into_owned() });
    }

    // Rider:Toolbox apps/Rider/ch-0/<version>/bin/rider64.exe 取最新;再独立安装位
    let toolbox_root = Path::new(&lad).join("JetBrains").join("Toolbox").join("apps").join("Rider").join("ch-0");
    let mut rider: Option<PathBuf> = None;
    if let Ok(rd) = std::fs::read_dir(&toolbox_root) {
        let mut versions: Vec<String> =
            rd.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        versions.sort();
        versions.reverse();
        for v in versions {
            let candidate = toolbox_root.join(v).join("bin").join("rider64.exe");
            if candidate.is_file() {
                rider = Some(candidate);
                break;
            }
        }
    }
    if rider.is_none() {
        rider = [
            Path::new(&pf).join("JetBrains").join("Rider").join("bin").join("rider64.exe"),
            Path::new(&pfx86).join("JetBrains").join("Rider").join("bin").join("rider64.exe"),
        ]
        .into_iter()
        .find(|p| p.is_file());
    }
    if let Some(p) = rider {
        found.push(DetectedIde { name: "Rider".into(), path: p.to_string_lossy().into_owned() });
    }

    let mut vs: Option<PathBuf> = None;
    'vs: for root in [&pf, &pfx86] {
        for year in ["2022", "2019"] {
            for ed in ["Community", "Professional", "Enterprise"] {
                let c = Path::new(root)
                    .join("Microsoft Visual Studio")
                    .join(year)
                    .join(ed)
                    .join("Common7")
                    .join("IDE")
                    .join("devenv.exe");
                if c.is_file() {
                    vs = Some(c);
                    break 'vs;
                }
            }
        }
    }
    if let Some(p) = vs {
        found.push(DetectedIde { name: "VS".into(), path: p.to_string_lossy().into_owned() });
    }

    let vscode: Vec<PathBuf> = vec![
        Path::new(&lad).join("Programs").join("Microsoft VS Code").join("Code.exe"),
        Path::new(&pf).join("Microsoft VS Code").join("Code.exe"),
    ];
    if let Some(p) = vscode.into_iter().find(|p| p.is_file()) {
        found.push(DetectedIde { name: "VSCode".into(), path: p.to_string_lossy().into_owned() });
    }

    found
}

/// 检测全部 IDE:主链 Get-StartApps + 降级硬编码,按 path(小写)去重合并。
#[tauri::command]
pub async fn ide_detect_all() -> Result<Vec<DetectedIde>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut found = detect_via_start_apps();
        for ide in detect_via_hardcoded_paths() {
            let dupe = found.iter().any(|f| f.path.to_lowercase() == ide.path.to_lowercase());
            if !dupe {
                found.push(ide);
            }
        }
        found
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ide_get_preferred(state: State<'_, SettingsState>) -> Result<Option<String>, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.preferred_ide_path.clone())
}

#[tauri::command]
pub fn ide_set_preferred(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
    path: Option<String>,
) -> Result<(), String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.preferred_ide_path = path;
    settings::save(&app, &s)
}

/// 启动 IDE 打开目标(目录 / .sln / .cs);子进程独立存活,不随 ModForge 退出。
#[tauri::command]
pub fn ide_launch(ide_path: String, target_path: String) -> Result<(), String> {
    let mut c = Command::new(&ide_path);
    c.arg(&target_path).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    c.spawn().map_err(|e| format!("启动 IDE 失败:{e}"))?;
    Ok(())
}
