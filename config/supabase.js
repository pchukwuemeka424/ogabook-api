const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://ldtayamrxisvypqzvldo.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkdGF5YW1yeGlzdnlwcXp2bGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzQyNjAsImV4cCI6MjA3OTAxMDI2MH0.HY9EiFX1hnWmLiOQ2rg0M_T6kdDz4YX6uHy7YHHH1zE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkdGF5YW1yeGlzdnlwcXp2bGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzQyNjAsImV4cCI6MjA3OTAxMDI2MH0.HY9EiFX1hnWmLiOQ2rg0M_T6kdDz4YX6uHy7YHHH1zE';

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// PostgreSQL Pool for direct database access
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Iz98HAD7jElqdiRk@db.ldtayamrxisvypqzvldo.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

module.exports = {
  supabase,
  pool
};

