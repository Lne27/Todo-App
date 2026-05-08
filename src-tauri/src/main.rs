#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Single instance check (Windows only)
    #[cfg(target_os = "windows")]
    {
        if todo_app_lib::autostart::is_already_running() {
            // Another instance is already running, bring it to foreground
            // For now, just exit silently
            std::process::exit(0);
        }
    }

    todo_app_lib::run();
}
