const pool = require('../config/database');
const bcrypt = require('bcrypt');

async function addUsers() {
  try {
    console.log('Updating test users in database...');
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);
    
    await pool.query(`
      UPDATE main.użytkownicy 
      SET hasło = $1 
      WHERE nazwa = 'admin'
    `, [adminPassword]);
    
    await pool.query(`
      UPDATE main.użytkownicy 
      SET hasło = $1 
      WHERE nazwa = 'user'
    `, [userPassword]);
    
    console.log('User passwords updated successfully with hashed passwords!');
    
    const result = await pool.query('SELECT nazwa, czy_admin FROM main.użytkownicy');
    console.log('Current users:');
    result.rows.forEach(user => {
      console.log(`  - ${user.nazwa} (admin: ${user.czy_admin})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  }
}

addUsers();
