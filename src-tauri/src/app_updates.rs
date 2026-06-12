use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

const UPDATE_ENDPOINT: &str =
    "https://github.com/GrahamCHill/DB-Designer/releases/latest/download/latest.json";

pub struct PendingUpdate(pub Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    version: String,
    current_version: String,
    body: Option<String>,
    date: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    configured: bool,
    update: Option<UpdateMetadata>,
}

fn updater_pubkey() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_PUBLIC_KEY").map(str::trim).filter(|value| !value.is_empty())
}

fn build_updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    let Some(pubkey) = updater_pubkey() else {
        return Err("Updater signing key is not configured for this build.".into());
    };

    app.updater_builder()
        .pubkey(pubkey)
        .endpoints(vec![Url::parse(UPDATE_ENDPOINT).map_err(|err| err.to_string())?])
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn fetch_update(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<UpdateCheckResult, String> {
    let Some(_) = updater_pubkey() else {
        return Ok(UpdateCheckResult {
            configured: false,
            update: None,
        });
    };

    let update = build_updater(&app)?.check().await.map_err(|err| err.to_string())?;
    let update_metadata = update.as_ref().map(|release| UpdateMetadata {
        version: release.version.clone(),
        current_version: release.current_version.clone(),
        body: release.body.clone(),
        date: release.date.map(|value| value.to_string()),
    });

    *pending_update.0.lock().map_err(|_| "Updater state lock failed".to_string())? = update;

    Ok(UpdateCheckResult {
        configured: true,
        update: update_metadata,
    })
}

#[tauri::command]
pub async fn install_update(pending_update: State<'_, PendingUpdate>) -> Result<(), String> {
    let update = pending_update
        .0
        .lock()
        .map_err(|_| "Updater state lock failed".to_string())?
        .take()
        .ok_or_else(|| "No pending update is available to install.".to_string())?;

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R, tauri_plugin_updater::Config> {
    tauri_plugin_updater::Builder::new().build()
}
