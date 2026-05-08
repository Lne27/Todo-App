#[cfg(target_os = "windows")]
mod imp {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCreateKeyExW, RegSetValueExW, RegDeleteValueW, HKEY_CURRENT_USER,
        REG_SZ, KEY_WRITE, REG_OPTION_NON_VOLATILE,
    };
    use windows::Win32::System::Threading::CreateMutexW;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APP_NAME: &str = "TODO-Reminder";

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    /// Register auto-start for current user
    pub fn enable_autostart() -> Result<(), String> {
        unsafe {
            let key_name = to_wide(RUN_KEY);
            let mut hkey = std::mem::zeroed();

            let result = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_name.as_ptr()),
                Some(0),
                None,
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut hkey,
                None,
            );
            if result.is_err() {
                return Err(format!("RegCreateKeyExW failed: {:?}", result));
            }

            let exe_path = std::env::current_exe()
                .map_err(|e| format!("current_exe: {}", e))?;
            let exe_str = exe_path.to_string_lossy();
            let value_wide = to_wide(&exe_str);
            let value_bytes: &[u8] = std::slice::from_raw_parts(
                value_wide.as_ptr() as *const u8,
                value_wide.len() * 2,
            );

            let result = RegSetValueExW(
                hkey,
                PCWSTR::from_raw(to_wide(APP_NAME).as_ptr()),
                Some(0),
                REG_SZ,
                Some(value_bytes),
            );
            let _ = windows::Win32::System::Registry::RegCloseKey(hkey);

            if result.is_err() {
                return Err(format!("RegSetValueExW failed: {:?}", result));
            }
            Ok(())
        }
    }

    pub fn disable_autostart() -> Result<(), String> {
        unsafe {
            let key_name = to_wide(RUN_KEY);
            let mut hkey = std::mem::zeroed();

            let result = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_name.as_ptr()),
                Some(0),
                None,
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut hkey,
                None,
            );
            if result.is_err() {
                return Err(format!("RegCreateKeyExW failed: {:?}", result));
            }

            let _ = RegDeleteValueW(hkey, PCWSTR::from_raw(to_wide(APP_NAME).as_ptr()));
            let _ = windows::Win32::System::Registry::RegCloseKey(hkey);
            Ok(())
        }
    }

    pub fn is_already_running() -> bool {
        unsafe {
            let name = to_wide(&format!("Local\\{}-Singleton", APP_NAME));
            let _handle = CreateMutexW(
                None,
                true,
                PCWSTR::from_raw(name.as_ptr()),
            );
            GetLastError() == ERROR_ALREADY_EXISTS
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn enable_autostart() -> Result<(), String> { Ok(()) }
    pub fn disable_autostart() -> Result<(), String> { Ok(()) }
    pub fn is_already_running() -> bool { false }
}

pub use imp::*;
