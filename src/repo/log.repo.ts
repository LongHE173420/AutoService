import { mysqlPool } from "../config/database";

export async function ensureLogRow(fileName: string, filePath: string): Promise<number> {
  const conn = await mysqlPool.getConnection();
  try {
    const [r] = await conn.query<any>(
      `
      INSERT INTO tbl_log (file_name, file_path)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `,
      [fileName, filePath]
    );
    return Number(r.insertId);
  } finally {
    conn.release();
  }
}
