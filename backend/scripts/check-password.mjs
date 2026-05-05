import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT email, "passwordHash", "isActive", "departmentId", "roleId" FROM "User" WHERE email = $1`,
  ['test@forgequantum.com'],
);

if (rows.length === 0) {
  console.log('NOT FOUND');
} else {
  const u = rows[0];
  const ok = await bcrypt.compare('Admin123', u.passwordHash);
  console.log('email:        ', u.email);
  console.log('isActive:     ', u.isActive);
  console.log('departmentId: ', u.departmentId);
  console.log('roleId:       ', u.roleId);
  console.log('hash prefix:  ', u.passwordHash.slice(0, 7));
  console.log('Admin123 ok:  ', ok);
}

await client.end();
