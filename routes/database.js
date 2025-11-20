const express = require('express');
const router = express.Router();
const { pool } = require('../config/supabase');
const { authenticateAdmin } = require('../middleware/auth');

// Get all tables in the database
router.get('/tables', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        table_name,
        table_schema
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    res.json({
      success: true,
      tables: result.rows
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tables',
      error: error.message
    });
  }
});

// Get table structure (columns, types, constraints)
router.get('/tables/:tableName/structure', authenticateAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;

    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    // Get primary keys
    const primaryKeys = await pool.query(`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY';
    `, [tableName]);

    res.json({
      success: true,
      structure: {
        columns: result.rows,
        primaryKeys: primaryKeys.rows.map(row => row.column_name)
      }
    });
  } catch (error) {
    console.error('Error fetching table structure:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching table structure',
      error: error.message
    });
  }
});

// Get all rows from a table (with pagination)
router.get('/tables/:tableName/data', authenticateAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const searchColumn = req.query.searchColumn || '';

    console.log(`Fetching data from table: ${tableName}, page: ${page}, limit: ${limit}`);

    // Validate table name to prevent SQL injection
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1;
    `, [tableName]);

    if (tableCheck.rows.length === 0) {
      console.error(`Table not found: ${tableName}`);
      return res.status(404).json({
        success: false,
        message: `Table "${tableName}" not found`
      });
    }

    // Get primary key or id column for ordering
    const primaryKeyResult = await pool.query(`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
      LIMIT 1;
    `, [tableName]);

    // Check if id or created_at column exists for ordering
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name IN ('id', 'created_at')
      ORDER BY CASE column_name 
        WHEN 'created_at' THEN 1
        WHEN 'id' THEN 2
        ELSE 3
      END
      LIMIT 1;
    `, [tableName]);

    let orderColumn = 'id';
    if (primaryKeyResult.rows.length > 0) {
      orderColumn = primaryKeyResult.rows[0].column_name;
    } else if (columnsResult.rows.length > 0) {
      orderColumn = columnsResult.rows[0].column_name;
    }

    let query = `SELECT * FROM "${tableName}"`;
    let countQuery = `SELECT COUNT(*) FROM "${tableName}"`;
    const queryParams = [];

    // Add search filter if provided
    if (search && searchColumn) {
      query += ` WHERE "${searchColumn}"::text ILIKE $1`;
      countQuery += ` WHERE "${searchColumn}"::text ILIKE $1`;
      queryParams.push(`%${search}%`);
    }

    // Add ordering and pagination
    const paramOffset = queryParams.length;
    query += ` ORDER BY "${orderColumn}" DESC LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}`;
    queryParams.push(limit, offset);

    // Execute queries
    console.log(`Executing query: ${query}`);
    console.log(`Query params:`, queryParams);
    const dataResult = await pool.query(query, queryParams);
    console.log(`Query returned ${dataResult.rows.length} rows`);
    
    // Get count - use same search params if provided
    const countParams = search && searchColumn ? [queryParams[0]] : [];
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    console.log(`Total records: ${total}`);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching table data',
      error: error.message
    });
  }
});

// Get a single row by ID
router.get('/tables/:tableName/data/:id', authenticateAdmin, async (req, res) => {
  try {
    const { tableName, id } = req.params;

    // Get primary key column
    const primaryKeyResult = await pool.query(`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      LIMIT 1;
    `, [tableName]);

    if (primaryKeyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table does not have a primary key'
      });
    }

    const primaryKey = primaryKeyResult.rows[0].column_name;
    const result = await pool.query(
      `SELECT * FROM "${tableName}" WHERE "${primaryKey}" = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching record',
      error: error.message
    });
  }
});

// Create a new row
router.post('/tables/:tableName/data', authenticateAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const data = req.body;

    // Get table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1;
    `, [tableName]);

    if (columnsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    const columns = columnsResult.rows.map(row => row.column_name);
    const providedColumns = Object.keys(data).filter(key => columns.includes(key));
    
    if (providedColumns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid columns provided'
      });
    }

    const columnNames = providedColumns.map(col => `"${col}"`).join(', ');
    const placeholders = providedColumns.map((_, index) => `$${index + 1}`).join(', ');
    const values = providedColumns.map(col => data[col]);

    const result = await pool.query(
      `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating record',
      error: error.message
    });
  }
});

// Update a row
router.put('/tables/:tableName/data/:id', authenticateAdmin, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const data = req.body;

    // Get primary key column
    const primaryKeyResult = await pool.query(`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      LIMIT 1;
    `, [tableName]);

    if (primaryKeyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table does not have a primary key'
      });
    }

    const primaryKey = primaryKeyResult.rows[0].column_name;

    // Get table columns
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1;
    `, [tableName]);

    const columns = columnsResult.rows.map(row => row.column_name);
    const providedColumns = Object.keys(data).filter(key => 
      columns.includes(key) && key !== primaryKey
    );

    if (providedColumns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid columns to update'
      });
    }

    const setClause = providedColumns.map((col, index) => `"${col}" = $${index + 1}`).join(', ');
    const values = providedColumns.map(col => data[col]);
    values.push(id);

    const result = await pool.query(
      `UPDATE "${tableName}" SET ${setClause} WHERE "${primaryKey}" = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating record',
      error: error.message
    });
  }
});

// Delete a row
router.delete('/tables/:tableName/data/:id', authenticateAdmin, async (req, res) => {
  try {
    const { tableName, id } = req.params;

    // Get primary key column
    const primaryKeyResult = await pool.query(`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      LIMIT 1;
    `, [tableName]);

    if (primaryKeyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table does not have a primary key'
      });
    }

    const primaryKey = primaryKeyResult.rows[0].column_name;
    const result = await pool.query(
      `DELETE FROM "${tableName}" WHERE "${primaryKey}" = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Record deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting record',
      error: error.message
    });
  }
});

// Execute custom SQL query (use with caution)
router.post('/query', authenticateAdmin, async (req, res) => {
  try {
    const { query: sqlQuery } = req.body;

    if (!sqlQuery) {
      return res.status(400).json({
        success: false,
        message: 'SQL query is required'
      });
    }

    // Basic safety check - prevent dangerous operations
    const dangerousKeywords = ['DROP', 'TRUNCATE', 'DELETE FROM', 'ALTER TABLE', 'CREATE TABLE', 'DROP TABLE'];
    const upperQuery = sqlQuery.toUpperCase();
    
    if (dangerousKeywords.some(keyword => upperQuery.includes(keyword))) {
      return res.status(403).json({
        success: false,
        message: 'This operation is not allowed for security reasons'
      });
    }

    const result = await pool.query(sqlQuery);

    res.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing query',
      error: error.message
    });
  }
});

module.exports = router;

