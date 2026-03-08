// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            db::db_test_connection,
            db::db_import_schema,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
