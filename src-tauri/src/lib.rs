use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::process::Command as StdCommand;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

// Rust command: run automation action via Node.js
#[tauri::command]
async fn run_automation(
    app: tauri::AppHandle,
    action: String,
    payload: String,
) -> Result<String, String> {
    // Try to find bundled automation script first.
    // On Windows NSIS builds, Tauri v2 places resources under `_up_` next to the exe:
    //   C:\Program Files\AutoPost FB AI Pro\_up_\automation\index.js
    // In dev, it may still be available from the project working directory.
    let script_path = find_automation_script(&app).ok_or_else(|| {
        let attempted = automation_script_candidates(&app)
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" | ");
        format!("Không tìm thấy automation/index.js. Đã thử: {}", attempted)
    })?;

    let automation_dir = script_path
        .parent()
        .ok_or_else(|| "Không xác định được thư mục automation".to_string())?
        .to_path_buf();

    let node_bin = find_node_binary().ok_or_else(|| {
        "Không thể chạy node: máy chưa cài Node.js hoặc Node.js chưa có trong PATH. Vui lòng cài Node.js LTS từ https://nodejs.org rồi mở lại app."
            .to_string()
    })?;

    // Spawn node process from the automation directory so local dependencies resolve correctly.
    let output = StdCommand::new(&node_bin)
        .arg(&script_path)
        .arg(&action)
        .arg(&payload)
        .current_dir(&automation_dir)
        .env("NODE_PATH", find_node_modules(&automation_dir))
        .output()
        .map_err(|e| format!("Không thể chạy node tại {}: {}", node_bin.to_string_lossy(), e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stderr.is_empty() {
        eprintln!("[automation stderr] {}", stderr);
    }

    Ok(stdout)
}

fn automation_script_candidates(app: &tauri::AppHandle) -> Vec<std::path::PathBuf> {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let cwd = std::env::current_dir().unwrap_or_default();
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_default();

    vec![
        resource_dir.join("automation").join("index.js"),
        resource_dir
            .join("_up_")
            .join("automation")
            .join("index.js"),
        resource_dir.join("index.js"),
        exe_dir.join("automation").join("index.js"),
        exe_dir.join("_up_").join("automation").join("index.js"),
        cwd.join("automation").join("index.js"),
        cwd.join("_up_").join("automation").join("index.js"),
        cwd.join("..").join("automation").join("index.js"),
    ]
}

fn find_automation_script(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    automation_script_candidates(app)
        .into_iter()
        .find(|p| p.exists())
}

fn find_node_binary() -> Option<std::path::PathBuf> {
    let mut candidates = vec![std::path::PathBuf::from("node")];

    #[cfg(target_os = "windows")]
    {
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            candidates.push(
                std::path::PathBuf::from(program_files)
                    .join("nodejs")
                    .join("node.exe"),
            );
        }
        if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
            candidates.push(
                std::path::PathBuf::from(program_files_x86)
                    .join("nodejs")
                    .join("node.exe"),
            );
        }
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            candidates.push(
                std::path::PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("nodejs")
                    .join("node.exe"),
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        candidates.push(std::path::PathBuf::from("/usr/local/bin/node"));
        candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/node"));
        candidates.push(std::path::PathBuf::from("/usr/bin/node"));
    }

    candidates.into_iter().find(|candidate| {
        if candidate.components().count() > 1 && !candidate.exists() {
            return false;
        }

        StdCommand::new(candidate)
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    })
}

// Find node_modules path for automation dependencies
fn find_node_modules(automation_dir: &std::path::Path) -> String {
    let paths = [
        automation_dir.join("node_modules"),
        // Home directory fallback
        dirs::home_dir()
            .unwrap_or_default()
            .join(".autopost-automation")
            .join("node_modules"),
    ];

    for path in &paths {
        if path.exists() {
            return path.to_string_lossy().to_string();
        }
    }

    String::new()
}

// Command: check if node and playwright are available
#[tauri::command]
async fn check_dependencies() -> Result<String, String> {
    // Check node
    let node_check = StdCommand::new("node")
        .arg("--version")
        .output()
        .map_err(|_| {
            "Node.js không được cài đặt. Vui lòng cài Node.js từ https://nodejs.org".to_string()
        })?;

    let node_version = String::from_utf8_lossy(&node_check.stdout)
        .trim()
        .to_string();

    // Check if automation node_modules exist
    let automation_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("automation")
        .join("node_modules");

    let has_deps = automation_dir.exists();

    Ok(format!(
        "{{\"node\":\"{}\",\"hasDeps\":{}}}",
        node_version, has_deps
    ))
}

// Command: install automation dependencies
#[tauri::command]
async fn install_automation_deps() -> Result<String, String> {
    let automation_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("automation");

    if !automation_dir.exists() {
        return Err("Thư mục automation không tồn tại".to_string());
    }

    let output = StdCommand::new("npm")
        .arg("install")
        .current_dir(&automation_dir)
        .output()
        .map_err(|e| format!("Không thể chạy npm install: {}", e))?;

    if output.status.success() {
        Ok("Đã cài đặt dependencies thành công".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Lỗi cài đặt: {}", stderr))
    }
}

// Command: save generated AI image to a real local file path for automation upload
#[tauri::command]
async fn save_generated_image(
    app: tauri::AppHandle,
    base64_data: String,
    ext: String,
) -> Result<String, String> {
    let cleaned_ext = match ext.trim_start_matches('.').to_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg".to_string(),
        "webp" => "webp".to_string(),
        _ => "png".to_string(),
    };

    let image_bytes = general_purpose::STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Không thể đọc dữ liệu ảnh AI: {}", e))?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không tìm thấy thư mục app data: {}", e))?;

    let image_dir = app_data_dir.join("generated-images");
    fs::create_dir_all(&image_dir).map_err(|e| format!("Không thể tạo thư mục ảnh AI: {}", e))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Lỗi thời gian hệ thống: {}", e))?
        .as_millis();
    let file_path = image_dir.join(format!("ai-image-{}.{}", timestamp, cleaned_ext));

    fs::write(&file_path, image_bytes).map_err(|e| format!("Không thể lưu ảnh AI: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_automation,
            check_dependencies,
            install_automation_deps,
            save_generated_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
