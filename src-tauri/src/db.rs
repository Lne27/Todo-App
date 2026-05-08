use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;
use crate::models::{TodoItem, NewTodo, UpdateTodo};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("todos.db");
        let conn = Connection::open(&db_path).expect("Failed to open database");

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .expect("Failed to set pragmas");

        conn.execute(
            "CREATE TABLE IF NOT EXISTS todos (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id   INTEGER REFERENCES todos(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                category    TEXT NOT NULL DEFAULT '默认',
                priority    INTEGER NOT NULL DEFAULT 2,
                due_date    TEXT,
                completed   INTEGER NOT NULL DEFAULT 0,
                sort_order  INTEGER NOT NULL DEFAULT 0,
                reminded    INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            )",
            [],
        ).expect("Failed to create table");

        Self { conn: Mutex::new(conn) }
    }

    pub fn get_all_todos(&self) -> Vec<TodoItem> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, title, category, priority, due_date, completed, sort_order, reminded, created_at
             FROM todos ORDER BY sort_order, id"
        ).unwrap();
        let rows = stmt.query_map([], |row| {
            Ok(TodoItem {
                id: row.get(0)?, parent_id: row.get(1)?, title: row.get(2)?,
                category: row.get(3)?, priority: row.get(4)?, due_date: row.get(5)?,
                completed: row.get::<_, i32>(6)? != 0, sort_order: row.get(7)?,
                reminded: row.get::<_, i32>(8)? != 0, created_at: row.get(9)?,
            })
        }).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn add_todo(&self, new: NewTodo) -> i64 {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO todos (parent_id, title, category, priority, due_date) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new.parent_id, new.title, new.category.unwrap_or_else(|| "默认".into()), new.priority.unwrap_or(2), new.due_date],
        ).unwrap();
        conn.last_insert_rowid()
    }

    pub fn update_todo(&self, u: UpdateTodo) {
        let conn = self.conn.lock().unwrap();
        let mut sets = Vec::new();
        let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(t) = u.title { sets.push("title = ?"); vals.push(Box::new(t)); }
        if let Some(c) = u.category { sets.push("category = ?"); vals.push(Box::new(c)); }
        if let Some(p) = u.priority { sets.push("priority = ?"); vals.push(Box::new(p)); }
        if let Some(d) = u.due_date { sets.push("due_date = ?"); vals.push(Box::new(d)); }
        if let Some(c) = u.completed {
            sets.push("completed = ?"); vals.push(Box::new(c as i32));
            if c { sets.push("completed_at = datetime('now','localtime')"); }
        }
        if let Some(pid) = u.parent_id { sets.push("parent_id = ?"); vals.push(Box::new(pid)); }
        if let Some(so) = u.sort_order { sets.push("sort_order = ?"); vals.push(Box::new(so)); }

        if sets.is_empty() { return; }

        let sql = format!("UPDATE todos SET {} WHERE id = ?", sets.join(", "));
        vals.push(Box::new(u.id));
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice()).unwrap();
    }

    pub fn delete_todo(&self, id: i64) {
        let conn = self.conn.lock().unwrap();
        // Delete children recursively via CASCADE
        conn.execute("DELETE FROM todos WHERE id = ?1", params![id]).unwrap();
    }

    pub fn get_pending_reminders(&self) -> Vec<TodoItem> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, title, category, priority, due_date, completed, sort_order, reminded, created_at
             FROM todos
             WHERE completed = 0 AND reminded = 0 AND due_date IS NOT NULL
             AND datetime(due_date) <= datetime('now', 'localtime')
             ORDER BY due_date"
        ).unwrap();
        let rows = stmt.query_map([], |row| {
            Ok(TodoItem {
                id: row.get(0)?, parent_id: row.get(1)?, title: row.get(2)?,
                category: row.get(3)?, priority: row.get(4)?, due_date: row.get(5)?,
                completed: row.get::<_, i32>(6)? != 0, sort_order: row.get(7)?,
                reminded: row.get::<_, i32>(8)? != 0, created_at: row.get(9)?,
            })
        }).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn mark_reminded(&self, id: i64) {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE todos SET reminded = 1 WHERE id = ?1", params![id]).unwrap();
    }
}
