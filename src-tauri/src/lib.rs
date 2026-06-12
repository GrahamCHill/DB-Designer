// DB Designer - Tauri Shell
// Copyright (C) 2026 DB Designer Authors
// Licensed under GNU GPL v3 with generated content exception (see LICENSE).

mod app_updates;
mod db;

#[tauri::command]
fn save_export_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, bytes).map_err(|err| err.to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(app_updates::init())
        .manage(app_updates::PendingUpdate(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            save_export_file,
            app_updates::fetch_update,
            app_updates::install_update,
            app_updates::restart_app,
            db::db_test_connection,
            db::db_import_schema,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

