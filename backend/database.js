import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbInstance = null;

export async function getDb() {
    if (dbInstance) return dbInstance;
    
    // Open SQLite database (file-based or memory, we'll use a local file for persistence)
    dbInstance = await open({
        filename: join(__dirname, 'database.sqlite'),
        driver: sqlite3.cached.Database
    });
    
    return dbInstance;
}

export async function initializeDatabase() {
    const db = await getDb();
    
    // Create E-commerce schema
    await db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            signup_date DATE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            stock INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            order_date DATE NOT NULL,
            status TEXT NOT NULL,
            total DECIMAL(10, 2) NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_time DECIMAL(10, 2) NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Check if we need to seed the data
    const count = await db.get("SELECT COUNT(*) as count FROM customers");
    if (count.count === 0) {
        console.log("Seeding initial database...");
        await db.exec(`
            INSERT INTO customers (name, email, signup_date) VALUES 
            ('Alice Smith', 'alice@example.com', '2023-01-15'),
            ('Bob Jones', 'bob@example.com', '2023-02-20'),
            ('Charlie Brown', 'charlie@example.com', '2023-03-05');

            INSERT INTO products (name, category, price, stock) VALUES
            ('Laptop', 'Electronics', 1200.00, 50),
            ('Smartphone', 'Electronics', 800.00, 100),
            ('Desk Chair', 'Furniture', 150.00, 20),
            ('Coffee Mug', 'Kitchen', 15.00, 200),
            ('Headphones', 'Electronics', 200.00, 75);

            INSERT INTO orders (customer_id, order_date, status, total) VALUES
            (1, '2023-05-10', 'Delivered', 1215.00),
            (2, '2023-05-12', 'Pending', 800.00),
            (1, '2023-06-01', 'Delivered', 200.00),
            (3, '2023-06-05', 'Cancelled', 150.00);

            INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES
            (1, 1, 1, 1200.00),
            (1, 4, 1, 15.00),
            (2, 2, 1, 800.00),
            (3, 5, 1, 200.00),
            (4, 3, 1, 150.00);
        `);
    } else {
        console.log("Database already seeded. Skipping seed.");
    }
}

export async function runQuery(sql) {
    const db = await getDb();
    // Use all() to return multiple rows for SELECT statements
    return await db.all(sql);
}

export async function getSchemaDescription() {
    return \`
Tables:
1. customers (id, name, email, signup_date)
2. products (id, name, category, price, stock)
3. orders (id, customer_id, order_date, status, total)
4. order_items (id, order_id, product_id, quantity, price_at_time)

Relationships:
- orders.customer_id -> customers.id
- order_items.order_id -> orders.id
- order_items.product_id -> products.id
    \`;
}
