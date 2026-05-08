use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri::Manager;
use crate::db::Database;

pub fn start_reminder_thread(app: AppHandle, db: Arc<Database>) {
    std::thread::spawn(move || {
        // Initial delay to let app fully start and window materialize
        std::thread::sleep(Duration::from_secs(8));

        // Immediate check on startup
        check_and_notify(&app, &db);

        let mut last_check = Instant::now();

        loop {
            std::thread::sleep(Duration::from_secs(25));

            let elapsed = last_check.elapsed();
            let woke_from_sleep = elapsed > Duration::from_secs(80);

            if woke_from_sleep {
                check_and_notify(&app, &db);
            } else {
                let pending = db.get_pending_reminders();
                if !pending.is_empty() {
                    force_foreground(&app);
                    send_notifications(&app, &db, &pending);
                }
            }

            last_check = Instant::now();
        }
    });
}

fn check_and_notify(app: &AppHandle, db: &Database) {
    let pending = db.get_pending_reminders();
    if pending.is_empty() {
        return;
    }
    force_foreground(app);
    send_notifications(app, db, &pending);
}

fn force_foreground(app: &AppHandle) {
    // Tauri-level show/focus first
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{
                SetForegroundWindow, ShowWindow, BringWindowToTop,
                GetForegroundWindow, GetWindowThreadProcessId,
                SW_SHOW, SW_RESTORE,
            };
            use windows::Win32::System::Threading::{
                GetCurrentThreadId, AttachThreadInput,
            };

            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    // Ensure window is visible
                    let _ = ShowWindow(hwnd, SW_SHOW);
                    let _ = ShowWindow(hwnd, SW_RESTORE);

                    // Workaround SetForegroundWindow restriction:
                    // attach our thread to the foreground thread,
                    // then set foreground, then detach.
                    let fg = GetForegroundWindow();
                    if fg.0 != std::ptr::null_mut() {
                        let fg_thread_id = GetWindowThreadProcessId(fg, None);
                        let our_thread_id = GetCurrentThreadId();
                        if fg_thread_id != our_thread_id {
                            let _ = AttachThreadInput(our_thread_id, fg_thread_id, true);
                            let _ = BringWindowToTop(hwnd);
                            let _ = SetForegroundWindow(hwnd);
                            let _ = AttachThreadInput(our_thread_id, fg_thread_id, false);
                        } else {
                            // We're already foreground, just bring to top
                            let _ = BringWindowToTop(hwnd);
                        }
                    } else {
                        // No foreground window (just after unlock), free to set
                        let _ = BringWindowToTop(hwnd);
                        let _ = SetForegroundWindow(hwnd);
                    }
                }
            }
        }
    }

    // Keep display active
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Power::SetThreadExecutionState;
        use windows::Win32::System::Power::{ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED};
        unsafe {
            SetThreadExecutionState(ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED);
        }
    }

    // Let rendering settle
    std::thread::sleep(Duration::from_millis(200));
}

fn send_notifications(app: &AppHandle, db: &Database, pending: &[crate::models::TodoItem]) {
    for todo in pending {
        let title = "TODO 提醒";
        let body = if let Some(ref due) = todo.due_date {
            format!("「{}」\n截止：{}", todo.title, due)
        } else {
            todo.title.clone()
        };

        use tauri_plugin_notification::NotificationExt;
        if let Err(e) = app.notification()
            .builder()
            .title(title)
            .body(&body)
            .show()
        {
            eprintln!("Notification error: {:?}", e);
        }

        db.mark_reminded(todo.id);
    }

    // Reset power state
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Power::SetThreadExecutionState;
        use windows::Win32::System::Power::ES_CONTINUOUS;
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
}
