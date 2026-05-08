pub mod autostart;
mod commands;
mod db;
mod models;
mod reminder;
mod session;
mod tray;

use db::Database;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db: Arc<Database> = Arc::new(Database::new(
        dirs_next().unwrap_or_else(|| std::path::PathBuf::from(".")),
    ));

    let db_for_reminder = db.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            commands::get_todos,
            commands::add_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::get_categories,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Register auto-start on first run (best-effort)
            #[cfg(target_os = "windows")]
            {
                if let Err(e) = autostart::enable_autostart() {
                    eprintln!("autostart register warning: {}", e);
                }
            }

            // Create system tray
            tray::create_tray(&handle).expect("Failed to create tray");

            // Start session unlock monitor
            session::start(handle.clone());

            // Start reminder thread
            reminder::start_reminder_thread(handle, db_for_reminder);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn dirs_next() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("TodoReminder"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::data_dir().map(|p| p.join("TodoReminder"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::data_dir().map(|p| p.join("todo-reminder"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    None
}
