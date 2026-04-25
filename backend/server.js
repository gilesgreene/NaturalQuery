import express from 'express';
import cors from 'cors';
import { initializeDatabase, runQuery } from './database.js';
import { generateSQL } from './ai.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize the database on startup
initializeDatabase().catch(err => console.error("Failed to initialize database:", err));

app.post('/api/query', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "Missing 'question' in request body." });
        }

        // 1. Convert natural language to SQL
        const { sql, explanation } = await generateSQL(question);
        
        // 2. Execute the generated SQL
        let results = [];
        let executionError = null;
        try {
            results = await runQuery(sql);
        } catch (dbErr) {
            executionError = dbErr.message;
        }

        // 3. Return the SQL, explanation, and results/error
        res.json({
            question,
            sql,
            explanation,
            results,
            error: executionError
        });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
