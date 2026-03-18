import * as SQLite from 'expo-sqlite';

async function checkAdmin() {
  const db = await SQLite.openDatabaseAsync('Sujata.db');
  const result = await db.getFirstAsync('SELECT username, password FROM Users WHERE role = "Admin"');
  console.log('Admin Credentials:', result);
}

checkAdmin();
