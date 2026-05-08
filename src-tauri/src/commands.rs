use tauri::State;
use crate::db::Database;
use crate::models::{TodoItem, NewTodo, UpdateTodo};

#[tauri::command]
pub fn get_todos(db: State<Database>) -> Vec<TodoItem> {
    db.get_all_todos()
}

#[tauri::command]
pub fn add_todo(db: State<Database>, new: NewTodo) -> i64 {
    db.add_todo(new)
}

#[tauri::command]
pub fn update_todo(db: State<Database>, u: UpdateTodo) {
    db.update_todo(u);
}

#[tauri::command]
pub fn delete_todo(db: State<Database>, id: i64) {
    db.delete_todo(id);
}

#[tauri::command]
pub fn get_categories() -> Vec<String> {
    vec![
        "工作".into(),
        "生活".into(),
        "学习".into(),
        "健康".into(),
        "其他".into(),
    ]
}
