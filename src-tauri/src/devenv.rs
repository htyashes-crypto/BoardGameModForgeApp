use std::path::Path;
use std::time::Duration;

use serde::Serialize;
use tauri::{Emitter, Manager, State};

use crate::ide::run_command_capture;
use crate::settings::{self, SettingsState};

pub const GITHUB_REPO_URL: &str = "https://github.com/htyashes-crypto/BoardGameModSDK.git";
pub const GITHUB_BROWSE_URL: &str = "https://github.com/htyashes-crypto/BoardGameModSDK";

/// git 命令 30 分钟兜底超时(clone 大仓库可能慢,镜像旧值)。
const GIT_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub ok: bool,
    pub code: &'static str, // OK | PATH_NOT_FOUND | PATH_NOT_DIR | MISSING_MANIFEST | INVALID_MANIFEST | MISSING_LIB
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevEnvSnapshot {
    pub mod_sdk_path: Option<String>,
    pub validation: Option<ValidationResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SdkBindings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_sdk_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub output: String,
}

fn read_manifest_stamps(sdk_path: &str) -> Option<(Option<String>, Option<String>)> {
    let manifest_path = Path::new(sdk_path).join("manifest.json");
    let text = std::fs::read_to_string(manifest_path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    Some((
        v.get("sdkVersion").and_then(|x| x.as_str()).map(str::to_string),
        v.get("sourceContentHash").and_then(|x| x.as_str()).map(str::to_string),
    ))
}

/// 校验 ModSDK 目录(镜像旧 validateModSdkPath:错误码与文案逐字对齐)。
pub fn validate(path: &str) -> ValidationResult {
    let fail = |code: &'static str, message: String| ValidationResult {
        ok: false,
        code,
        message,
        sdk_version: None,
        content_hash: None,
    };
    if path.is_empty() {
        return fail("PATH_NOT_FOUND", "路径为空".into());
    }
    let p = Path::new(path);
    if !p.exists() {
        return fail("PATH_NOT_FOUND", format!("路径不存在:{path}"));
    }
    if !p.is_dir() {
        return fail("PATH_NOT_DIR", format!("不是目录:{path}"));
    }
    let manifest_path = p.join("manifest.json");
    if !manifest_path.exists() {
        return fail(
            "MISSING_MANIFEST",
            format!(
                "manifest.json 不存在:{}(确认这是 BoardGameModSDK 目录,不是包含它的父目录)",
                manifest_path.display()
            ),
        );
    }
    let lib_dir = p.join("Lib");
    if !lib_dir.exists() {
        return fail("MISSING_LIB", format!("Lib/ 目录不存在:{}", lib_dir.display()));
    }
    let text = match std::fs::read_to_string(&manifest_path) {
        Ok(t) => t,
        Err(e) => return fail("INVALID_MANIFEST", format!("manifest.json 解析失败:{e}")),
    };
    let parsed: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => return fail("INVALID_MANIFEST", format!("manifest.json 解析失败:{e}")),
    };
    let sdk_version = parsed.get("sdkVersion").and_then(|x| x.as_str()).map(str::to_string);
    let content_hash = parsed.get("sourceContentHash").and_then(|x| x.as_str()).map(str::to_string);
    let suffix = sdk_version.as_deref().map(|v| format!("(v{v})")).unwrap_or_default();
    ValidationResult {
        ok: true,
        code: "OK",
        message: format!("ModSDK 路径有效{suffix}"),
        sdk_version,
        content_hash,
    }
}

fn snapshot_from(mod_sdk_path: Option<String>) -> DevEnvSnapshot {
    let validation = mod_sdk_path.as_deref().map(validate);
    DevEnvSnapshot { mod_sdk_path, validation }
}

#[tauri::command]
pub fn devenv_get_snapshot(state: State<'_, SettingsState>) -> Result<DevEnvSnapshot, String> {
    let path = state.0.lock().map_err(|e| e.to_string())?.mod_sdk_path.clone();
    Ok(snapshot_from(path))
}

#[tauri::command]
pub fn devenv_validate_mod_sdk_path(path: String) -> ValidationResult {
    validate(&path)
}

#[tauri::command]
pub fn devenv_set_mod_sdk_path(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
    path: Option<String>,
) -> Result<DevEnvSnapshot, String> {
    let mut s = state.0.lock().map_err(|e| e.to_string())?;
    s.mod_sdk_path = path.clone();
    settings::save(&app, &s)?;
    Ok(snapshot_from(path))
}

/// 供创建 Mod 时读 sdkVersion + sourceContentHash 印章(TS 端写进 mod.json.sdkBindings)。
#[tauri::command]
pub fn devenv_get_sdk_bindings(state: State<'_, SettingsState>) -> Result<Option<SdkBindings>, String> {
    let path = state.0.lock().map_err(|e| e.to_string())?.mod_sdk_path.clone();
    let Some(path) = path else { return Ok(None) };
    Ok(read_manifest_stamps(&path).map(|(sdk_version, content_hash)| SdkBindings {
        sdk_version,
        content_hash,
    }))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubUrls {
    pub repo_url: &'static str,
    pub browse_url: &'static str,
}

#[tauri::command]
pub fn devenv_get_github_urls() -> GithubUrls {
    GithubUrls { repo_url: GITHUB_REPO_URL, browse_url: GITHUB_BROWSE_URL }
}

/// 从 GitHub clone/pull BoardGameModSDK(镜像旧 downloadFromGitHub 三分支 + 文案;
/// 进度经 devenv://download-log 事件推送;成功后自动 set 为当前 ModSdkPath——旧 ipc 胶水语义)。
#[tauri::command]
pub async fn devenv_download_from_github(
    app: tauri::AppHandle,
    target_dir: String,
) -> Result<DownloadResult, String> {
    let result = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || download_blocking(&app, &target_dir)
    })
    .await
    .map_err(|e| e.to_string())?;

    if result.success {
        if let Some(p) = result.mod_sdk_path.clone() {
            let state = app.state::<SettingsState>();
            let mut s = state.0.lock().map_err(|e| e.to_string())?;
            s.mod_sdk_path = Some(p);
            settings::save(&app, &s)?;
        }
    }
    Ok(result)
}

fn download_blocking(app: &tauri::AppHandle, target_dir: &str) -> DownloadResult {
    fn push_log(app: &tauri::AppHandle, buf: &mut Vec<String>, line: &str) {
        buf.push(line.to_string());
        let _ = app.emit("devenv://download-log", line.to_string());
    }
    let mut output_buf: Vec<String> = vec![];

    if target_dir.is_empty() {
        return DownloadResult {
            success: false,
            mod_sdk_path: None,
            error: Some("targetDir 为空".into()),
            output: String::new(),
        };
    }
    let fail = |error: String, output_buf: &[String]| DownloadResult {
        success: false,
        mod_sdk_path: None,
        error: Some(error),
        output: output_buf.join("\n"),
    };

    push_log(app, &mut output_buf, "> 检测 git 可用性...");
    let git_check = run_command_capture("git", &["--version"], None, GIT_TIMEOUT);
    match &git_check {
        Ok((true, _, stdout, _)) => push_log(app, &mut output_buf, stdout.trim()),
        _ => {
            return fail(
                "本机未检测到 git。请先安装 Git for Windows(https://git-scm.com/download/win),装完重启 ModForge。".into(),
                &output_buf,
            )
        }
    }

    let target = Path::new(target_dir);
    if target.exists() && target.join(".git").exists() {
        push_log(app, &mut output_buf, &format!("> 检测到已有 git 仓库:{target_dir}"));
        push_log(app, &mut output_buf, "> 执行 git pull(增量更新)...");
        match run_command_capture("git", &["pull"], Some(target), GIT_TIMEOUT) {
            Ok((success, code, stdout, stderr)) => {
                push_log(app, &mut output_buf, &stdout);
                push_log(app, &mut output_buf, &stderr);
                if !success {
                    return fail(format!("git pull 失败(exit {code})"), &output_buf);
                }
                push_log(app, &mut output_buf, "> 增量更新完成");
                return DownloadResult {
                    success: true,
                    mod_sdk_path: Some(target_dir.to_string()),
                    error: None,
                    output: output_buf.join("\n"),
                };
            }
            Err(e) => return fail(format!("git pull 失败({e})"), &output_buf),
        }
    }

    if target.exists() {
        return fail(
            format!("目标目录已存在但不是 git 仓库:{target_dir}。请选空目录或删除后重试。"),
            &output_buf,
        );
    }

    push_log(app, &mut output_buf, &format!("> 执行 git clone {GITHUB_REPO_URL} {target_dir}"));
    match run_command_capture("git", &["clone", GITHUB_REPO_URL, target_dir], None, GIT_TIMEOUT) {
        Ok((success, code, stdout, stderr)) => {
            push_log(app, &mut output_buf, &stdout);
            push_log(app, &mut output_buf, &stderr);
            if !success {
                return fail(format!("git clone 失败(exit {code})"), &output_buf);
            }
            push_log(app, &mut output_buf, "> Clone 完成");
            DownloadResult {
                success: true,
                mod_sdk_path: Some(target_dir.to_string()),
                error: None,
                output: output_buf.join("\n"),
            }
        }
        Err(e) => fail(format!("git clone 失败({e})"), &output_buf),
    }
}
