use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Emitter;

/// 单 Mod 最长 5 分钟(镜像旧 DOTNET_TIMEOUT_MS)。
const DOTNET_TIMEOUT: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BuildStatus {
    Pending,
    Running,
    Success,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildLogChunk {
    pub ts: u64,
    pub mod_id: Option<String>,
    pub level: &'static str, // info | ok | warn | err | prompt
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildTask {
    pub id: String,
    pub root_mod_id: String,
    pub mod_ids: Vec<String>,
    pub status: BuildStatus,
    pub completed_count: usize,
    pub current_mod_id: Option<String>,
    pub started_at: u64,
    pub ended_at: Option<u64>,
    pub logs: Vec<BuildLogChunk>,
    pub failed_at: Option<String>,
    pub failure_reason: Option<String>,
}

/// TS 端按拓扑闭包算好的待编译项(决策 1:图/闭包归前端)。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildModRef {
    pub mod_id: String,
    pub mod_dir: String,
    pub mod_dir_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBuildReply {
    pub task_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Default)]
pub struct BuildState {
    task: Arc<Mutex<Option<BuildTask>>>,
    cancel: Arc<AtomicBool>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn emit_log(
    app: &tauri::AppHandle,
    task: &Arc<Mutex<Option<BuildTask>>>,
    mod_id: Option<&str>,
    level: &'static str,
    text: String,
) {
    let chunk = BuildLogChunk {
        ts: now_ms(),
        mod_id: mod_id.map(str::to_string),
        level,
        text,
    };
    if let Ok(mut guard) = task.lock() {
        if let Some(t) = guard.as_mut() {
            t.logs.push(chunk.clone());
        }
    }
    let _ = app.emit("build://log-chunk", &chunk);
}

fn emit_state(app: &tauri::AppHandle, task: &Arc<Mutex<Option<BuildTask>>>) {
    let snapshot = task.lock().ok().and_then(|g| g.clone());
    if let Some(t) = snapshot {
        let _ = app.emit("build://state-changed", &t);
    }
}

/// 解析可用 dotnet(镜像旧 resolveDotnetExecutable:先扫 PATH,再兜底常见安装位)。
fn resolve_dotnet_executable() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "dotnet.exe" } else { "dotnet" };

    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let full = dir.join(exe);
            if full.is_file() {
                return Some(full);
            }
        }
    }

    let mut candidates: Vec<PathBuf> = vec![];
    if cfg!(windows) {
        let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
        let pfx86 = std::env::var("ProgramFiles(x86)")
            .unwrap_or_else(|_| r"C:\Program Files (x86)".into());
        candidates.push(Path::new(&pf).join("dotnet").join(exe));
        candidates.push(Path::new(&pfx86).join("dotnet").join(exe));
        if let Ok(lad) = std::env::var("LOCALAPPDATA") {
            candidates.push(Path::new(&lad).join("Microsoft").join("dotnet").join(exe));
        }
    } else {
        for c in [
            "/usr/local/share/dotnet/dotnet",
            "/usr/local/bin/dotnet",
            "/usr/bin/dotnet",
            "/opt/homebrew/bin/dotnet",
        ] {
            candidates.push(PathBuf::from(c));
        }
        if let Ok(home) = std::env::var("HOME") {
            candidates.push(Path::new(&home).join(".dotnet").join("dotnet"));
        }
    }
    candidates.into_iter().find(|c| c.is_file())
}

/// 按文本关键字分级(镜像旧 classifyLogLevel)。
fn classify_log_level(text: &str) -> &'static str {
    let lower = text.to_lowercase();
    if lower.contains("error") {
        "err"
    } else if lower.contains("warning") {
        "warn"
    } else if lower.contains("build succeeded") || lower.contains("compile complete") {
        "ok"
    } else {
        "info"
    }
}

fn format_bytes(n: u64) -> String {
    if n < 1024 {
        format!("{n} B")
    } else if n < 1024 * 1024 {
        format!("{:.1} KB", n as f64 / 1024.0)
    } else {
        format!("{:.2} MB", n as f64 / 1024.0 / 1024.0)
    }
}

fn finish_task(
    app: &tauri::AppHandle,
    task: &Arc<Mutex<Option<BuildTask>>>,
    cancel: &Arc<AtomicBool>,
    status: BuildStatus,
    failed_at: Option<String>,
    reason: Option<String>,
) {
    if let Ok(mut guard) = task.lock() {
        if let Some(t) = guard.as_mut() {
            t.status = status;
            t.ended_at = Some(now_ms());
            t.current_mod_id = None;
            t.failed_at = failed_at;
            t.failure_reason = reason;
        }
    }
    emit_state(app, task);
    cancel.store(false, Ordering::SeqCst);
}

/// 单 Mod 编译:spawn dotnet build,stdout/stderr 逐行流式推送,5 分钟超时 kill。
fn compile_single_mod(
    app: &tauri::AppHandle,
    task: &Arc<Mutex<Option<BuildTask>>>,
    mod_id: &str,
    mod_dir_path: &str,
    mod_dir: &str,
    dotnet: &Path,
) -> bool {
    let src_dir = Path::new(mod_dir_path).join("src");
    let csproj = src_dir.join(format!("{mod_dir}.csproj"));

    let mut cmd = Command::new(dotnet);
    cmd.arg("build")
        .arg(&csproj)
        .args(["-c", "Release", "--nologo"])
        .current_dir(&src_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW,避免闪黑窗
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            emit_log(app, task, Some(mod_id), "err", format!("spawn dotnet 失败:{e}(请确认 PATH 中含 dotnet)"));
            return false;
        }
    };

    // stdout / stderr 读线程:逐行 trim 非空推送
    let mut readers = vec![];
    if let Some(out) = child.stdout.take() {
        let (app2, task2, id2) = (app.clone(), task.clone(), mod_id.to_string());
        readers.push(std::thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let text = line.trim().to_string();
                if !text.is_empty() {
                    let level = classify_log_level(&text);
                    emit_log(&app2, &task2, Some(&id2), level, text);
                }
            }
        }));
    }
    if let Some(err) = child.stderr.take() {
        let (app2, task2, id2) = (app.clone(), task.clone(), mod_id.to_string());
        readers.push(std::thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                let text = line.trim().to_string();
                if !text.is_empty() {
                    emit_log(&app2, &task2, Some(&id2), "err", text);
                }
            }
        }));
    }

    // 轮询等待 + 超时 kill(当前 Mod 编完即停语义由外层循环把关)
    let deadline = Instant::now() + DOTNET_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st,
            Ok(None) => {
                if Instant::now() > deadline {
                    emit_log(app, task, Some(mod_id), "err", format!("编译超时({}s),kill 进程", DOTNET_TIMEOUT.as_secs()));
                    let _ = child.kill();
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(e) => {
                emit_log(app, task, Some(mod_id), "err", format!("等待 dotnet 进程失败:{e}"));
                let _ = child.kill();
                break match child.wait() {
                    Ok(st) => st,
                    Err(_) => return false,
                };
            }
        }
    };
    for r in readers {
        let _ = r.join();
    }

    if status.success() {
        emit_log(app, task, Some(mod_id), "ok", "✓ dotnet build exit 0".into());
        true
    } else {
        let code = status.code().map(|c| c.to_string()).unwrap_or_else(|| "null".into());
        emit_log(app, task, Some(mod_id), "err", format!("✗ dotnet build exit {code}"));
        false
    }
}

/// 启动编译(镜像旧 startBuild;快照校验/hasError 拒编/闭包与拓扑过滤已在 TS 端完成,
/// 此处接收算好的有序 mods)。异步跑在独立线程,不阻塞 invoke 返回。
#[tauri::command]
pub fn build_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuildState>,
    root_mod_id: String,
    mods: Vec<BuildModRef>,
) -> Result<StartBuildReply, String> {
    {
        let guard = state.task.lock().map_err(|e| e.to_string())?;
        if let Some(t) = guard.as_ref() {
            if t.status == BuildStatus::Running {
                return Ok(StartBuildReply {
                    task_id: String::new(),
                    error: Some("已有编译任务进行中".into()),
                });
            }
        }
    }
    if mods.is_empty() {
        return Ok(StartBuildReply {
            task_id: String::new(),
            error: Some(format!("Mod Id \"{root_mod_id}\" 不在工程内")),
        });
    }

    let Some(dotnet) = resolve_dotnet_executable() else {
        return Ok(StartBuildReply {
            task_id: String::new(),
            error: Some(
                "未找到 dotnet SDK。请安装 .NET SDK(https://dotnet.microsoft.com/download),\
                 并确保 dotnet 在 PATH 中,或安装到默认目录(Windows:C:\u{5c}Program Files\u{5c}dotnet\u{5c})后重启 ModForge。"
                    .into(),
            ),
        });
    };

    let task_id = format!("task-{}", now_ms());
    let order: Vec<String> = mods.iter().map(|m| m.mod_id.clone()).collect();
    {
        let mut guard = state.task.lock().map_err(|e| e.to_string())?;
        *guard = Some(BuildTask {
            id: task_id.clone(),
            root_mod_id: root_mod_id.clone(),
            mod_ids: order.clone(),
            status: BuildStatus::Pending,
            completed_count: 0,
            current_mod_id: None,
            started_at: now_ms(),
            ended_at: None,
            logs: vec![],
            failed_at: None,
            failure_reason: None,
        });
    }
    state.cancel.store(false, Ordering::SeqCst);

    let task = state.task.clone();
    let cancel = state.cancel.clone();
    emit_log(&app, &task, None, "info", format!("按拓扑序编译 {} Mod:{}", mods.len(), order.join(" → ")));
    emit_log(&app, &task, None, "info", format!("dotnet:{}", dotnet.display()));
    if let Ok(mut guard) = task.lock() {
        if let Some(t) = guard.as_mut() {
            t.status = BuildStatus::Running;
        }
    }
    emit_state(&app, &task);

    std::thread::spawn(move || run_task(app, task, cancel, mods, dotnet));

    Ok(StartBuildReply { task_id, error: None })
}

fn run_task(
    app: tauri::AppHandle,
    task: Arc<Mutex<Option<BuildTask>>>,
    cancel: Arc<AtomicBool>,
    mods: Vec<BuildModRef>,
    dotnet: PathBuf,
) {
    let total = mods.len();
    for (i, m) in mods.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            emit_log(&app, &task, None, "warn", "编译已取消(已完成 Mod 的 dll 保留)".into());
            finish_task(&app, &task, &cancel, BuildStatus::Cancelled, None, Some("用户取消".into()));
            return;
        }

        if let Ok(mut guard) = task.lock() {
            if let Some(t) = guard.as_mut() {
                t.current_mod_id = Some(m.mod_id.clone());
            }
        }
        emit_state(&app, &task);
        emit_log(&app, &task, None, "prompt", format!("[{}/{}] 编译 {}({})...", i + 1, total, m.mod_id, m.mod_dir));

        if !compile_single_mod(&app, &task, &m.mod_id, &m.mod_dir_path, &m.mod_dir, &dotnet) {
            finish_task(&app, &task, &cancel, BuildStatus::Failed, Some(m.mod_id.clone()), Some("dotnet build 失败".into()));
            return;
        }

        // dll 部署位置:<Mod>/<modDir>Behaviour.dll(csproj OutputPath=..、Loader 扫描的最终位置)
        let dll_name = format!("{}Behaviour.dll", m.mod_dir);
        let deployed = Path::new(&m.mod_dir_path).join(&dll_name);
        match std::fs::metadata(&deployed) {
            Ok(meta) => {
                emit_log(&app, &task, Some(&m.mod_id), "ok", format!("✓ 部署 {dll_name}({})", format_bytes(meta.len())));
            }
            Err(e) => {
                emit_log(
                    &app,
                    &task,
                    Some(&m.mod_id),
                    "err",
                    format!("dll 未在预期位置生成:{}({e});请检查该 Mod csproj 的 <OutputPath> 是否为 ..{}", deployed.display(), '\u{5c}'),
                );
                finish_task(&app, &task, &cancel, BuildStatus::Failed, Some(m.mod_id.clone()), Some("dll 未生成".into()));
                return;
            }
        }

        if let Ok(mut guard) = task.lock() {
            if let Some(t) = guard.as_mut() {
                t.completed_count = i + 1;
            }
        }
        emit_state(&app, &task);
    }

    emit_log(&app, &task, None, "ok", format!("✓ 全部 {total} Mod 编译+部署完成"));
    emit_log(&app, &task, None, "prompt", "Unity 端 ModBehaviourProjectSession 会检测 dll hash 变化并弹「请重启」提示".into());
    finish_task(&app, &task, &cancel, BuildStatus::Success, None, None);
}

/// 请求取消:当前 Mod 编完后停止后续(已编 dll 保留)。
#[tauri::command]
pub fn build_cancel(app: tauri::AppHandle, state: tauri::State<'_, BuildState>) -> Result<(), String> {
    let running = {
        let guard = state.task.lock().map_err(|e| e.to_string())?;
        matches!(guard.as_ref(), Some(t) if t.status == BuildStatus::Running)
    };
    if running {
        state.cancel.store(true, Ordering::SeqCst);
        emit_log(&app, &state.task, None, "warn", "已请求取消;当前 Mod 编完后即停止后续。".into());
    }
    Ok(())
}

#[tauri::command]
pub fn build_get_current_task(state: tauri::State<'_, BuildState>) -> Result<Option<BuildTask>, String> {
    Ok(state.task.lock().map_err(|e| e.to_string())?.clone())
}
