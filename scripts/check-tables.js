const { pool } = require('../config/supabase');
require('dotenv').config();

async function checkTables() {
  try {
    console.log('🔍 Connecting to database...\n');
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT 
        table_name,
        table_schema
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`📊 Found ${tablesResult.rows.length} tables in the database:\n`);
    console.log('='.repeat(80));

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      // Get row count
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}";`);
      const rowCount = countResult.rows[0].count;

      // Get columns
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      // Get primary keys
      const primaryKeysResult = await pool.query(`
        SELECT 
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY';
      `, [tableName]);

      const primaryKeys = primaryKeysResult.rows.map(row => row.column_name);

      console.log(`\n📋 Table: ${tableName}`);
      console.log(`   Rows: ${rowCount}`);
      console.log(`   Primary Key(s): ${primaryKeys.length > 0 ? primaryKeys.join(', ') : 'None'}`);
      console.log(`   Columns (${columnsResult.rows.length}):`);
      
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const pk = primaryKeys.includes(col.column_name) ? ' [PK]' : '';
        console.log(`      - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}${pk}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Database check complete!`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    await pool.end();
    process.exit(1);
  }
}

checkTables();

