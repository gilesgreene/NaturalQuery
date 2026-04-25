import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import csv from 'csv-parser';

// Helper to open the database connection
export async function openDb() {
    return open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
}

// Function to initialize the database with some tables and data
export async function initDb() {
    const db = await openDb();

    // Create sample tables for testing
    await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL,
      stock_quantity INTEGER
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      sale_date DATE,
      amount REAL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

    // Optional: Check if products table is empty and seed it
    const products = await db.all('SELECT * FROM products LIMIT 1');
    if (products.length === 0) {
        await db.exec(`
      INSERT INTO products (name, category, price, stock_quantity) VALUES 
      ('Laptop', 'Electronics', 999.99, 50),
      ('Desk Chair', 'Furniture', 150.00, 20),
      ('Monitor', 'Electronics', 250.00, 30),
      ('Coffee Maker', 'Appliances', 80.00, 15);
      
      INSERT INTO sales (product_id, sale_date, amount) VALUES 
      (1, '2026-04-20', 999.99),
      (3, '2026-04-21', 250.00);
    `);
        console.log("Database seeded with initial data.");
    }
}

// Function to create a table from CSV file
export async function createTableFromCSV(filePath, tableName) {
    return new Promise((resolve, reject) => {
        const db = openDb();
        const rows = [];
        let headers = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headerList) => {
                headers = headerList;
            })
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', async () => {
                try {
                    const dbInstance = await db;
                    
                    // Drop table if exists
                    await dbInstance.exec(`DROP TABLE IF EXISTS ${tableName}`);
                    
                    // Create table with columns from headers
                    const columns = headers.map(header => `${header} TEXT`).join(', ');
                    await dbInstance.exec(`CREATE TABLE ${tableName} (${columns})`);
                    
                    // Insert data
                    for (const row of rows) {
                        const values = headers.map(header => row[header] || '').map(val => `'${val.replace(/'/g, "''")}'`).join(', ');
                        await dbInstance.exec(`INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${values})`);
                    }
                    
                    console.log(`Table ${tableName} created with ${rows.length} rows`);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

/**
 * Gets the schema information to feed into the AI prompt.
 */
export async function getSchemaInfo() {
    const db = await openDb();
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    let schemaDescription = "";

    for (const table of tables) {
        if (table.name === 'sqlite_sequence') continue;
        const columns = await db.all(`PRAGMA table_info(${table.name})`);
        const colNames = columns.map(c => c.name).join(", ");
        schemaDescription += `Table: ${table.name}, Columns: ${colNames}\n`;
    }
    return schemaDescription;
}

/**
 * Runs a raw SQL string and returns the results as an array.
 */
export async function runQuery(sql) {
    const db = await openDb();

    // Clean the SQL string (strip potential AI-generated markdown)
    const queryString = typeof sql === 'string'
        ? sql.replace(/```sql/g, "").replace(/```/g, "").trim()
        : sql;

    try {
        const results = await db.all(queryString);
        return results;
    } catch (error) {
        console.error("Database Query Error:", error.message);
        throw new Error(`SQL Error: ${error.message}`);
    }
}