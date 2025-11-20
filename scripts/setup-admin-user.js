const { pool } = require('../config/supabase');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupAdminUser() {
  try {
    console.log('🔧 Setting up admin user in users table...\n');
    
    const adminEmail = 'admin@ogabook.com';
    const adminPassword = 'holiday100@';
    const adminUsername = 'admin';

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [adminEmail, adminUsername]
    );

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    if (existingUser.rows.length > 0) {
      // Update existing user
      const user = existingUser.rows[0];
      console.log(`📝 Found existing user: ${user.email || user.username}`);
      
      await pool.query(
        `UPDATE users 
         SET email = $1, 
             username = $2, 
             password_hash = $3, 
             role = $4,
             is_active = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [adminEmail, adminUsername, hashedPassword, 'admin', true, user.id]
      );
      
      console.log(`✅ Updated admin user:`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Role: admin`);
      console.log(`   Password: Updated\n`);
    } else {
      // Create new user
      console.log('➕ Creating new admin user...');
      
      const result = await pool.query(
        `INSERT INTO users (
          email, 
          username, 
          password_hash, 
          first_name, 
          last_name, 
          role, 
          is_active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, email, username, role`,
        [adminEmail, adminUsername, hashedPassword, 'Admin', 'User', 'admin', true]
      );

      const newUser = result.rows[0];
      console.log(`✅ Created admin user:`);
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Username: ${newUser.username}`);
      console.log(`   Role: ${newUser.role}\n`);
    }

    console.log('🎉 Admin user setup complete!');
    console.log(`\nYou can now login with:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

setupAdminUser();

