import pkg from 'pg';
const { Pool } = pkg;
import csv from 'csv-parser';
import { Readable } from 'stream';
import fs from 'fs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Function to initialize the database with some tables and data
export async function initDb() {
    if (!process.env.DATABASE_URL) {
        console.warn('DATABASE_URL not set. Skipping database initialization.');
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT,
                price REAL,
                stock_quantity INTEGER
            );

            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                sale_date DATE,
                amount REAL
            );
        `);

        // Seed if empty
        const existing = await client.query('SELECT * FROM products LIMIT 1');
        if (existing.rows.length === 0) {
            await client.query(`
                INSERT INTO products (name, category, price, stock_quantity) VALUES 
                ('Laptop', 'Electronics', 999.99, 50),
                ('Desk Chair', 'Furniture', 150.00, 20),
                ('Monitor', 'Electronics', 250.00, 30),
                ('Coffee Maker', 'Appliances', 80.00, 15);

                INSERT INTO sales (product_id, sale_date, amount) VALUES 
                (1, '2026-04-20', 999.99),
                (3, '2026-04-21', 250.00);
            `);
            console.log('Database seeded with initial data.');
        }
    } finally {
        client.release();
    }
}

// Function to create a table from CSV file on disk using streaming
export async function createTableFromCSV(filePath, tableName) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
        
        let headersCreated = false;
        let headers = [];
        let chunk = [];
        
        const stream = fs.createReadStream(filePath).pipe(csv({
            mapHeaders: ({ header }) => header.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        }));
        
        for await (const row of stream) {
            if (!headersCreated) {
                headers = Object.keys(row);
                const columns = headers.map(h => `"${h}" TEXT`).join(', ');
                await client.query(`CREATE TABLE "${tableName}" (${columns})`);
                headersCreated = true;
            }
            
            chunk.push(row);
            
            if (chunk.length >= 1000) {
                await insertChunk(client, tableName, headers, chunk);
                chunk = [];
            }
        }
        
        if (chunk.length > 0) {
            await insertChunk(client, tableName, headers, chunk);
        }
        
        await client.query('COMMIT');
        console.log(`Table ${tableName} created from stream`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        // Delete the temp file to save disk space
        fs.unlink(filePath, () => {});
    }
}

async function insertChunk(client, tableName, headers, chunk) {
    const placeholders = [];
    const values = [];
    const colNames = headers.map(h => `"${h}"`).join(', ');
    
    chunk.forEach((row, rowIndex) => {
        const rowPlaceholders = [];
        headers.forEach((h, colIndex) => {
            rowPlaceholders.push(`$${rowIndex * headers.length + colIndex + 1}`);
            values.push(row[h] ?? null);
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });
    
    await client.query(
        `INSERT INTO "${tableName}" (${colNames}) VALUES ${placeholders.join(', ')}`,
        values
    );
}

// Gets schema information to feed into the AI prompt
export async function getSchemaInfo() {
    const query = `
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    `;
    
    const result = await pool.query(query);
    const schema = {};
    
    for (const row of result.rows) {
        if (!schema[row.table_name]) {
            schema[row.table_name] = [];
        }
        schema[row.table_name].push(row.column_name);
    }
    
    let schemaDescription = '';
    for (const [tableName, columns] of Object.entries(schema)) {
        schemaDescription += `Table: ${tableName}, Columns: ${columns.join(', ')}\n`;
    }
    
    return schemaDescription;
}

// Runs a raw SQL string and returns results as an array
export async function runQuery(sql) {
    const queryString = typeof sql === 'string'
        ? sql.replace(/\`\`\`sql/g, '').replace(/\`\`\`/g, '').trim()
        : sql;

    try {
        const result = await pool.query(queryString);
        return result.rows;
    } catch (error) {
        console.error('Database Query Error:', error.message);
        throw new Error(`SQL Error: ${error.message}`);
    }
}