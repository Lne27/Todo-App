#[cfg(target_os = "windows")]
mod imp {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use tauri::AppHandle;
    use tauri::Emitter;
    use tauri::Manager;
    use windows::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, WTSUnRegisterSessionNotification,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, GetWindowLongPtrW,
        PostQuitMessage, SetWindowLongPtrW, TranslateMessage, CW_USEDEFAULT, CS_HREDRAW,
        CS_VREDRAW, GWLP_USERDATA, HWND_MESSAGE, MSG, WM_DESTROY, WNDCLASSEXW,
        WINDOW_STYLE, WS_EX_NOACTIVATE,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::core::PCWSTR;

    const NOTIFY_FOR_THIS_SESSION: u32 = 0;
    const WM_WTSSESSION_CHANGE: u32 = 0x02B1;
    const WTS_SESSION_UNLOCK: u32 = 0x8;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    struct SessionCtx {
        app: AppHandle,
    }

    pub fn start(app: AppHandle) {
        std::thread::spawn(move || {
            let class_name = to_wide("TodoSessionMonitor");

            let hinstance = match unsafe { GetModuleHandleW(None) } {
                Ok(h) => h,
                Err(e) => {
                    eprintln!("GetModuleHandleW failed: {:?}", e);
                    return;
                }
            };

            let wnd_class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(wnd_proc),
                hInstance: hinstance.into(),
                lpszClassName: PCWSTR::from_raw(class_name.as_ptr()),
                ..Default::default()
            };

            if unsafe { windows::Win32::UI::WindowsAndMessaging::RegisterClassExW(&wnd_class) }
                == 0
            {
                eprintln!("RegisterClassExW failed");
                return;
            }

            let hwnd = match unsafe {
                CreateWindowExW(
                    WS_EX_NOACTIVATE,
                    PCWSTR::from_raw(class_name.as_ptr()),
                    PCWSTR::null(),
                    WINDOW_STYLE(0),
                    CW_USEDEFAULT,
                    CW_USEDEFAULT,
                    CW_USEDEFAULT,
                    CW_USEDEFAULT,
                    Some(HWND_MESSAGE),
                    None,
                    Some(hinstance.into()),
                    None,
                )
            } {
                Ok(h) => h,
                Err(e) => {
                    eprintln!("CreateWindowExW failed: {:?}", e);
                    return;
                }
            };

            let ctx = Box::new(SessionCtx { app });
            unsafe { SetWindowLongPtrW(hwnd, GWLP_USERDATA, Box::into_raw(ctx) as isize) };

            if let Err(e) = unsafe { WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) }
            {
                eprintln!("WTSRegisterSessionNotification failed: {:?}", e);
            }

            let mut msg = MSG::default();
            loop {
                let ret = unsafe { GetMessageW(&mut msg, Some(hwnd), 0, 0) };
                if ret.0 <= 0 {
                    break;
                }
                unsafe {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }

            unsafe {
                let _ = WTSUnRegisterSessionNotification(hwnd);
            }
        });
    }

    unsafe extern "system" fn wnd_proc(
        hwnd: windows::Win32::Foundation::HWND,
        msg: u32,
        wparam: windows::Win32::Foundation::WPARAM,
        lparam: windows::Win32::Foundation::LPARAM,
    ) -> windows::Win32::Foundation::LRESULT {
        if msg == WM_WTSSESSION_CHANGE {
            if wparam.0 as u32 == WTS_SESSION_UNLOCK {
                let ctx_ptr =
                    unsafe { GetWindowLongPtrW(hwnd, GWLP_USERDATA) } as *mut SessionCtx;
                if !ctx_ptr.is_null() {
                    let ctx = unsafe { &*ctx_ptr };
                    if let Some(window) = ctx.app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                        let _ = ctx.app.emit("tray-show", ());
                    }
                }
            }
            return windows::Win32::Foundation::LRESULT(0);
        }

        if msg == WM_DESTROY {
            let ctx_ptr = unsafe { GetWindowLongPtrW(hwnd, GWLP_USERDATA) } as *mut SessionCtx;
            if !ctx_ptr.is_null() {
                unsafe {
                    drop(Box::from_raw(ctx_ptr));
                }
            }
            unsafe { PostQuitMessage(0) };
            return windows::Win32::Foundation::LRESULT(0);
        }

        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use tauri::AppHandle;
    pub fn start(_app: AppHandle) {}
}

pub use imp::start;
