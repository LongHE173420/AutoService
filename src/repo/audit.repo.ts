import { mysqlPool } from "../config/database";

export async function findUserIdByPhone(phone: string): Promise<number | null> {
  const conn = await mysqlPool.getConnection();
  try {
    const [rows] = await conn.query<any[]>(
      `SELECT id FROM users WHERE phone = ? LIMIT 1`,
      [phone]
    );
    return rows?.[0]?.id ? Number(rows[0].id) : null;
  } finally {
    conn.release();
  }
}

export async function insertUserAction(params: {
  userId: number | null;
  actionName: string;
  detail?: string | null;
  logId: number | null;
}) {
  const conn = await mysqlPool.getConnection();
  try {
    await conn.query(
      `INSERT INTO user_action (userId, action_name, detail, log_id) VALUES (?,?,?,?)`,
      [params.userId, params.actionName, params.detail ?? null, params.logId]
    );
  } finally {
    conn.release();
  }
}

export async function insertAuthStatus(params: {
  action: "REGISTER" | "LOGIN";
  phone: string;
  deviceId: string;
  userId: number | null;
  status: 0 | 1; 
  detail?: string | null;
  logId: number | null;
}) {
  const conn = await mysqlPool.getConnection();
  try {
    await conn.query(
      `
      INSERT INTO auth_status (action, phone, deviceId, userId, status, detail, log_id)
      VALUES (?,?,?,?,?,?,?)
      `,
      [
        params.action,
        params.phone,
        params.deviceId,
        params.userId,
        params.status,
        params.detail ?? null,
        params.logId,
      ]
    );
  } finally {
    conn.release();
  }
}

export async function getLastLoginSuccessAt(userId: number): Promise<Date | null> {
  const conn = await mysqlPool.getConnection();
  try {
    const [rows] = await conn.query<any[]>(
      `
      SELECT createdAt FROM auth_status
      WHERE action='LOGIN' AND userId=? AND status=1
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [userId]
    );
    return rows?.[0]?.createdAt ? new Date(rows[0].createdAt) : null;
  } finally {
    conn.release();
  }
}
