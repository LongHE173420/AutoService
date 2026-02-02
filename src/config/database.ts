import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: "localhost",   
  port: 3306,             
  user: "root",           
  password: "Long2002@", 
  database: "auth_service",     
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testDb() {
  const conn = await pool.getConnection();
  const [rows] = await conn.query("SELECT 1 AS ok");
  conn.release();
  console.log("DB test:", rows);
}
