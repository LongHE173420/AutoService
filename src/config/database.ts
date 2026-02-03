import mysql from "mysql2/promise";
import { ENV } from "./env";

export const mysqlPool = mysql.createPool({
  host: ENV.MYSQL_HOST,
  port: ENV.MYSQL_PORT,
  user: ENV.MYSQL_USER,
  password: ENV.MYSQL_PASSWORD,
  database: ENV.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: ENV.MYSQL_CONN_LIMIT,
  queueLimit: 0
});

