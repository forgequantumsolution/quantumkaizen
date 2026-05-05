import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

const tables = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
`);
console.log('--- TABLES ---');
console.log(tables.rows.map(r => r.table_name).join('\n') || '(none)');

async function safeCount(t) {
  try {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    return rows[0].n;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

console.log('\n--- COUNTS ---');
for (const t of ['User', 'Department', 'Role']) {
  console.log(`${t}: ${await safeCount(t)}`);
}

async function safeDump(table, cols) {
  try {
    const { rows } = await client.query(`SELECT ${cols} FROM "${table}" ORDER BY "createdAt" ASC`);
    return rows;
  } catch (e) {
    return [{ ERROR: e.message }];
  }
}

console.log('\n--- USERS ---');
console.table(await safeDump('User', '"id","email","name","isActive","departmentId","roleId","createdAt"'));

console.log('\n--- DEPARTMENTS ---');
console.table(await safeDump('Department', '"id","name"'));

console.log('\n--- ROLES ---');
console.table(await safeDump('Role', '"id","name"'));

await client.end();
