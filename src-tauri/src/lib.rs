use std::fs;
use std::process::Command as StdCommand;
use std::time::{SystemTime, UNIX_EPOCH};
use base64::{engine::general_purpose, Engine as _};
use tauri::Manager;

// Rust command: run automation action via Node.js
#[tauri::command]
async fn run_automation(
    app: tauri::AppHandle,
    action: String,
    payload: String,
) -> Result<String, String> {
    // Try to find bundled automation script first.
    // Tauri may place resources as either resource/automation/index.js
    // or directly as resource/index.js depending on bundle layout.
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let cwd = std::env::current_dir().unwrap_or_default();
    let candidates = [
        resource_dir.join("automation").join("index.js"),
        resource_dir.join("index.js"),
        cwd.join("automation").join("index.js"),
        cwd.join("..").join("automation").join("index.js"),
    ];

    let script = candidates
        .iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| {
            let attempted = candidates
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" | ");
            format!("Không tìm thấy automation/index.js. Đã thử: {}", attempted)
        })?;

    // Spawn node process
    let output = StdCommand::new("node")
        .arg(&script)
        .arg(&action)
        .arg(&payload)
        .env("NODE_PATH", find_node_modules())
        .output()
        .map_err(|e| format!("Không thể chạy node: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stderr.is_empty() {
        eprintln!("[automation stderr] {}", stderr);
    }

    Ok(stdout)
}

// Find node_modules path for automation dependencies
fn find_node_modules() -> String {
    let paths = [
        // Relative to working directory
        std::env::current_dir()
            .unwrap_or_default()
            .join("automation")
            .join("node_modules"),
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
        .map_err(|_| "Node.js không được cài đặt. Vui lòng cài Node.js từ https://nodejs.org".to_string())?;

    let node_version = String::from_utf8_lossy(&node_check.stdout).trim().to_string();

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
    fs::create_dir_all(&image_dir)
        .map_err(|e| format!("Không thể tạo thư mục ảnh AI: {}", e))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Lỗi thời gian hệ thống: {}", e))?
        .as_millis();
    let file_path = image_dir.join(format!("ai-image-{}.{}", timestamp, cleaned_ext));

    fs::write(&file_path, image_bytes)
        .map_err(|e| format!("Không thể lưu ảnh AI: {}", e))?;

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
