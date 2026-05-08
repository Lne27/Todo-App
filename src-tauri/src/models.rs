use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub title: String,
    pub category: String,
    pub priority: i32,       // 1=高 2=中 3=低
    pub due_date: Option<String>,
    pub completed: bool,
    pub sort_order: i32,
    pub reminded: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NewTodo {
    pub parent_id: Option<i64>,
    pub title: String,
    pub category: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTodo {
    pub id: i64,
    pub title: Option<String>,
    pub category: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
    pub completed: Option<bool>,
    pub parent_id: Option<Option<i64>>,  // None=不修改, Some(None)=移到根级
    pub sort_order: Option<i32>,
}
