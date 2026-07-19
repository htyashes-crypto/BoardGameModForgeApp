use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};

/// 工程级 Mod 容器目录名常量,与框架侧 `ProjectModBehaviourLoader.ProjectDirName` 对齐。
pub const MOD_BEHAVIOUR_PROJECT_DIR: &str = "ModBehaviourProject";

/// 扫到的一个 [ModObjectBehaviour] 类元信息(镜像旧 BehaviourMeta;sourceFile 用 '/' 分隔)。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviourMeta {
    pub class_name: String,
    pub behaviour_id: Option<String>,
    pub display_name: Option<String>,
    pub category: Option<String>,
    pub source_file: String,
}

/// 单 Mod 的**原始**扫描结果:manifest 校验/错误文案归 TS 端(plan-3 决策 1 扩展),
/// Rust 只交 mod.json 原文 + dll 元信息 + Behaviour 提取。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModRawInfo {
    pub mod_dir: String,
    pub mod_dir_path: String,
    pub manifest_path: String,
    /// mod.json 原文;None = 读取失败(TS 端据此报「未找到 mod.json」)。
    pub mod_json_text: Option<String>,
    pub has_dll: bool,
    pub dll_path: Option<String>,
    pub dll_size: u64,
    pub dll_sha256: Option<String>,
    pub dll_mtime: Option<u64>,
    pub behaviours: Vec<BehaviourMeta>,
}

/// 镜像旧 mod:scanProject:接桌游工程根,内部 join ModBehaviourProject/。
#[tauri::command]
pub fn mod_scan_project_raw(project_path: String) -> Result<Vec<ModRawInfo>, String> {
    let mod_root = Path::new(&project_path).join(MOD_BEHAVIOUR_PROJECT_DIR);
    Ok(scan_mod_root(&mod_root))
}

/// 扫 mod 根目录(镜像旧 scanModRoot):根不存在 → 空;跳 . 前缀;
/// **没有 mod.json 的子目录是支撑目录(Shared/Generated 等)静默跳过**,不视为 Mod。
pub fn scan_mod_root(mod_root: &Path) -> Vec<ModRawInfo> {
    let mut out = vec![];
    let Ok(rd) = fs::read_dir(mod_root) else {
        return out;
    };
    let mut names: Vec<String> = rd
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    // readdir 顺序平台相关,排序保证快照稳定(NTFS 本就近似字典序)
    names.sort();
    for name in names {
        if name.starts_with('.') {
            continue;
        }
        let mod_dir_path = mod_root.join(&name);
        if !mod_dir_path.is_dir() {
            continue;
        }
        let manifest_path = mod_dir_path.join("mod.json");
        if !manifest_path.is_file() {
            continue;
        }
        out.push(scan_single_mod(&name, &mod_dir_path));
    }
    out
}

fn scan_single_mod(mod_dir: &str, mod_dir_path: &Path) -> ModRawInfo {
    let manifest_path = mod_dir_path.join("mod.json");
    let mod_json_text = fs::read_to_string(&manifest_path).ok();

    // dll:取 mod 根下第一个 .dll(镜像旧实现:不约束命名,HelloMod 用 HelloModBehaviour.dll)
    let mut has_dll = false;
    let mut dll_path: Option<String> = None;
    let mut dll_size = 0u64;
    let mut dll_sha256: Option<String> = None;
    let mut dll_mtime: Option<u64> = None;
    if let Ok(rd) = fs::read_dir(mod_dir_path) {
        let mut files: Vec<String> = rd
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        files.sort();
        for f in files {
            if !f.to_lowercase().ends_with(".dll") {
                continue;
            }
            let full = mod_dir_path.join(&f);
            let Ok(meta) = fs::metadata(&full) else { continue };
            if !meta.is_file() {
                continue;
            }
            has_dll = true;
            dll_size = meta.len();
            dll_mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);
            dll_sha256 = fs::read(&full)
                .ok()
                .map(|bytes| format!("{:x}", Sha256::digest(&bytes)));
            dll_path = Some(full.to_string_lossy().into_owned());
            break;
        }
    }

    let behaviours = scan_behaviours(&mod_dir_path.join("src"));

    ModRawInfo {
        mod_dir: mod_dir.to_string(),
        mod_dir_path: mod_dir_path.to_string_lossy().into_owned(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        mod_json_text,
        has_dll,
        dll_path,
        dll_size,
        dll_sha256,
        dll_mtime,
        behaviours,
    }
}

/// 递归扫 src/ 全部 *.cs 提取 [ModObjectBehaviour] 类(镜像旧 scanBehaviours:
/// 递归跳过 . 前缀与 obj/bin;常量引用 resolve;引号感知平衡括号取参)。
fn scan_behaviours(src_dir: &Path) -> Vec<BehaviourMeta> {
    let mut out = vec![];
    let mut rel_files = vec![];
    collect_cs_files(src_dir, "", &mut rel_files);
    if rel_files.is_empty() {
        return out;
    }

    let mut texts: Vec<(String, String)> = vec![];
    for rel in rel_files {
        if let Ok(text) = fs::read_to_string(src_dir.join(&rel)) {
            texts.push((rel, text));
        }
    }
    let const_map = build_const_string_map(texts.iter().map(|(_, t)| t.as_str()));

    let attr_start = Regex::new(r"\[ModObjectBehaviour\s*\(").unwrap();
    let class_after = Regex::new(r"(?s)^\s*\].*?\bclass\s+(\w+)").unwrap();
    let display_name_re = Regex::new(r#"\bDisplayName\s*=\s*"([^"]*)""#).unwrap();
    let category_re = Regex::new(r#"\bCategory\s*=\s*"([^"]*)""#).unwrap();

    for (rel, text) in &texts {
        let mut pos = 0usize;
        while let Some(m) = attr_start.find_at(text, pos) {
            let open_idx = m.end() - 1; // 指向 '('
            let Some((inner, close_idx)) = read_balanced_paren(text, open_idx) else {
                pos = m.end();
                continue;
            };
            // ']' 必须紧跟 ')' 之后,再非贪婪到 class 声明
            if let Some(cm) = class_after.captures(&text[close_idx + 1..]) {
                out.push(BehaviourMeta {
                    class_name: cm[1].to_string(),
                    behaviour_id: resolve_behaviour_id(&inner, &const_map),
                    display_name: display_name_re.captures(&inner).map(|c| c[1].to_string()),
                    category: category_re.captures(&inner).map(|c| c[1].to_string()),
                    source_file: rel.clone(),
                });
            }
            pos = close_idx; // 镜像旧 lastIndex = closeIdx,跳过已消费参数区
        }
    }
    out
}

/// 递归收集 .cs 相对路径('/' 分隔);跳过隐藏目录与 obj/bin(MSBuild 产物)。
fn collect_cs_files(dir: &Path, rel_base: &str, out: &mut Vec<String>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for e in entries {
        let name = e.file_name().to_string_lossy().into_owned();
        let rel = if rel_base.is_empty() {
            name.clone()
        } else {
            format!("{rel_base}/{name}")
        };
        let path = e.path();
        if path.is_dir() {
            if name.starts_with('.') || name == "obj" || name == "bin" {
                continue;
            }
            collect_cs_files(&path, &rel, out);
        } else if path.is_file() && name.ends_with(".cs") {
            out.push(rel);
        }
    }
}

/// 全部 .cs 文本提取 `const string X = "..."` 等,建 字段名→值 映射(同名取首个)。
fn build_const_string_map<'a>(texts: impl Iterator<Item = &'a str>) -> HashMap<String, String> {
    let re =
        Regex::new(r#"\b(?:const|static\s+readonly|readonly\s+static)\s+string\s+(\w+)\s*=\s*"([^"]*)""#)
            .unwrap();
    let mut map = HashMap::new();
    for t in texts {
        for c in re.captures_iter(t) {
            map.entry(c[1].to_string()).or_insert_with(|| c[2].to_string());
        }
    }
    map
}

/// 从 open_idx 指向的 '(' 起,引号 + 转义 + 嵌套括号感知地读到配对 ')'。
/// 字节级扫描:比较目标全为 ASCII,UTF-8 连续字节不会误判。
fn read_balanced_paren(text: &str, open_idx: usize) -> Option<(String, usize)> {
    let bytes = text.as_bytes();
    let mut depth = 0i32;
    let mut in_str = false;
    let mut i = open_idx;
    while i < bytes.len() {
        let c = bytes[i];
        if in_str {
            if c == b'\\' {
                i += 2; // 跳过转义字符
                continue;
            }
            if c == b'"' {
                in_str = false;
            }
        } else if c == b'"' {
            in_str = true;
        } else if c == b'(' {
            depth += 1;
        } else if c == b')' {
            depth -= 1;
            if depth == 0 {
                return Some((text[open_idx + 1..i].to_string(), i));
            }
        }
        i += 1;
    }
    None
}

/// 解析 BehaviourId:首个位置参数,字面量直取,常量引用经映射 resolve,均失败 None。
fn resolve_behaviour_id(args: &str, const_map: &HashMap<String, String>) -> Option<String> {
    let first = first_positional_arg(args)?;
    let lit = Regex::new(r#"(?s)^@?"(.*?)"$"#).unwrap();
    if let Some(c) = lit.captures(&first) {
        return Some(c[1].to_string());
    }
    let ident = first.split('.').next_back().unwrap_or("").trim().to_string();
    if Regex::new(r"^\w+$").unwrap().is_match(&ident) {
        return const_map.get(&ident).cloned();
    }
    None
}

/// 取 attribute 参数文本的首个位置参数(引号 + 括号感知,到第一个顶层逗号为止)。
fn first_positional_arg(args: &str) -> Option<String> {
    let bytes = args.as_bytes();
    let mut in_str = false;
    let mut depth = 0i32;
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if in_str {
            if c == b'\\' {
                i += 2;
                continue;
            }
            if c == b'"' {
                in_str = false;
            }
        } else if c == b'"' {
            in_str = true;
        } else if c == b'(' || c == b'[' {
            depth += 1;
        } else if c == b')' || c == b']' {
            depth -= 1;
        } else if c == b',' && depth == 0 {
            let s = args[..i].trim().to_string();
            return if s.is_empty() { None } else { Some(s) };
        }
        i += 1;
    }
    let s = args.trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn balanced_paren_ignores_paren_inside_string() {
        let s = r#"("a)b", X = 1) tail"#;
        let (inner, close) = read_balanced_paren(s, 0).unwrap();
        assert_eq!(inner, r#""a)b", X = 1"#);
        assert_eq!(&s[close..close + 1], ")");
    }

    #[test]
    fn first_positional_arg_stops_at_top_level_comma() {
        assert_eq!(
            first_positional_arg(r#"MyConsts.RollId, DisplayName = "掷骰(带括号)""#).as_deref(),
            Some("MyConsts.RollId")
        );
        assert_eq!(
            first_positional_arg(r#""a,b", Category = "C""#).as_deref(),
            Some(r#""a,b""#)
        );
    }

    #[test]
    fn const_map_and_resolve() {
        let texts = [
            r#"public const string RollId = "com.x.roll";"#,
            r#"static readonly string Other = "v2";"#,
        ];
        let map = build_const_string_map(texts.iter().copied());
        assert_eq!(map.get("RollId").map(String::as_str), Some("com.x.roll"));
        assert_eq!(
            resolve_behaviour_id(r#""com.a.b", Category = "C""#, &map).as_deref(),
            Some("com.a.b")
        );
        assert_eq!(
            resolve_behaviour_id("MyConsts.RollId, X = 1", &map).as_deref(),
            Some("com.x.roll")
        );
        assert_eq!(resolve_behaviour_id("Unknown.Ref", &map), None);
    }

    #[test]
    fn scan_behaviours_recursive_multiline_and_skips_obj() {
        let root = std::env::temp_dir().join(format!("mf_scan_test_{}", std::process::id()));
        let src = root.join("src");
        fs::create_dir_all(src.join("Behaviours")).unwrap();
        fs::create_dir_all(src.join("obj")).unwrap();
        fs::write(
            src.join("Consts.cs"),
            r#"public static class C { public const string RainId = "mod.rain"; }"#,
        )
        .unwrap();
        fs::write(
            src.join("Behaviours").join("RainBehaviour.cs"),
            "[ModObjectBehaviour(\n    C.RainId,\n    DisplayName = \"雨(测)\",\n    Category = \"Weather\")]\npublic sealed class RainBehaviour : ModObjectBehaviour {}",
        )
        .unwrap();
        fs::write(src.join("obj").join("Decoy.cs"), "[ModObjectBehaviour(\"x\")] class DecoyBehaviour {}").unwrap();

        let got = scan_behaviours(&src);
        fs::remove_dir_all(&root).unwrap();

        assert_eq!(got.len(), 1);
        let b = &got[0];
        assert_eq!(b.class_name, "RainBehaviour");
        assert_eq!(b.behaviour_id.as_deref(), Some("mod.rain"));
        assert_eq!(b.display_name.as_deref(), Some("雨(测)"));
        assert_eq!(b.category.as_deref(), Some("Weather"));
        assert_eq!(b.source_file, "Behaviours/RainBehaviour.cs");
    }
}
