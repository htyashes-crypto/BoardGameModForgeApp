use std::fs;
use std::path::Path;

use regex::Regex;

use crate::mod_scan::MOD_BEHAVIOUR_PROJECT_DIR;

/// 模板渲染与业务校验(重名/依赖存在性/Id 唯一)在 TS 端完成(plan-3 决策 1 扩展 2,
/// 与旧版同引擎零字节漂移);本模块只承接**受约束的落盘**:
/// 路径由 Rust 按固定布局拼装,组件名过白名单正则,前端永远传不进任意路径。
const NAME_PATTERN: &str = r"^[A-Za-z][A-Za-z0-9_]*$";
const CLASS_NAME_PATTERN: &str = r"^[A-Z][A-Za-z0-9_]*$";

fn ensure_component(value: &str, pattern: &str, label: &str) -> Result<(), String> {
    if Regex::new(pattern).unwrap().is_match(value) {
        Ok(())
    } else {
        Err(format!("{label}格式非法:\"{value}\";要求 {pattern}"))
    }
}

/// 写出新 Mod 骨架:mod.json(Mod 根)+ src/<name>.csproj + <name>.sln(Mod 根,
/// IDE 窗口标题 = Mod 名);三份文本由 TS 端模板渲染。返回 modDirPath。
#[tauri::command]
pub fn mod_create_write(
    project_path: String,
    mod_name: String,
    mod_json_text: String,
    csproj_text: String,
    sln_text: String,
) -> Result<String, String> {
    ensure_component(&mod_name, NAME_PATTERN, "Mod 名")?;
    let mod_dir_path = Path::new(&project_path)
        .join(MOD_BEHAVIOUR_PROJECT_DIR)
        .join(&mod_name);
    let src_dir = mod_dir_path.join("src");
    fs::create_dir_all(&src_dir)
        .map_err(|e| format!("创建目录失败 {}:{e}", mod_dir_path.display()))?;

    let write = |path: &Path, text: &str| -> Result<(), String> {
        fs::write(path, text).map_err(|e| format!("写文件失败:{e}"))
    };
    write(&mod_dir_path.join("mod.json"), &mod_json_text)?;
    write(&src_dir.join(format!("{mod_name}.csproj")), &csproj_text)?;
    write(&mod_dir_path.join(format!("{mod_name}.sln")), &sln_text)?;

    Ok(mod_dir_path.to_string_lossy().into_owned())
}

/// 写出新 Behaviour .cs(文本由 TS 渲染;类名/Id 唯一等业务校验在 TS)。
/// Rust 侧复刻旧服务的落盘前置检查:src 目录存在、同名文件不存在。返回 .cs 绝对路径。
#[tauri::command]
pub fn behaviour_create_write(
    project_path: String,
    mod_dir: String,
    class_name: String,
    cs_text: String,
) -> Result<String, String> {
    ensure_component(&mod_dir, NAME_PATTERN, "Mod 目录名")?;
    ensure_component(&class_name, CLASS_NAME_PATTERN, "类名")?;
    let src_dir = Path::new(&project_path)
        .join(MOD_BEHAVIOUR_PROJECT_DIR)
        .join(&mod_dir)
        .join("src");
    if !src_dir.is_dir() {
        return Err(format!(
            "目标 Mod 的 src 目录不存在:{}(请先创建 Mod 工程)",
            src_dir.display()
        ));
    }
    let file_path = src_dir.join(format!("{class_name}.cs"));
    if file_path.is_file() {
        return Err(format!("同名文件已存在:{class_name}.cs"));
    }
    fs::write(&file_path, cs_text).map_err(|e| format!("写文件失败:{e}"))?;
    Ok(file_path.to_string_lossy().into_owned())
}

/// 删除 Mod 目录(决策 2-A:进回收站,可挽回;确认与反向依赖警告由前端 ConfirmModal 承担)。
#[tauri::command]
pub fn mod_delete(project_path: String, mod_dir_name: String) -> Result<(), String> {
    ensure_component(&mod_dir_name, NAME_PATTERN, "Mod 目录名")?;
    let mod_dir_path = Path::new(&project_path)
        .join(MOD_BEHAVIOUR_PROJECT_DIR)
        .join(&mod_dir_name);
    if !mod_dir_path.is_dir() {
        return Err(format!("Mod 目录不存在:{}", mod_dir_path.display()));
    }
    trash::delete(&mod_dir_path).map_err(|e| format!("删除目录失败:{e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn component_whitelist_rejects_traversal() {
        assert!(ensure_component("..", NAME_PATTERN, "x").is_err());
        assert!(ensure_component("a/b", NAME_PATTERN, "x").is_err());
        assert!(ensure_component("a\\b", NAME_PATTERN, "x").is_err());
        assert!(ensure_component("WeatherMod", NAME_PATTERN, "x").is_ok());
        assert!(ensure_component("rainTick", CLASS_NAME_PATTERN, "x").is_err());
        assert!(ensure_component("RainTickBehaviour", CLASS_NAME_PATTERN, "x").is_ok());
    }
}
