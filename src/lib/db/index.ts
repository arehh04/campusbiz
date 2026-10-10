import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const file = process.env.DATABASE_PATH || "./data/campusbiz.db";
  const inMemory = file === ":memory:";
  if (!inMemory) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const conn = new Database(file);
  if (!inMemory) conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  for (const sql of SCHEMA_SQL) conn.exec(sql);
  db = conn;
  return conn;
}

export function resetDbForTests(): void {
  db?.close();
  db = null;
}
