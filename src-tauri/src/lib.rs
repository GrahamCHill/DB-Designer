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
        .invoke_handler(tauri::generate_handler![
            save_export_file,
            db::db_test_connection,
            db::db_import_schema,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

