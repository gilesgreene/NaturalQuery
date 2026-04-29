import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { generateSQL } from './ai.js';
import { runQuery, getSchemaInfo, initDb, createTableFromCSV } from './database.js';

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// Initialize the database on startup
initDb().then(() => console.log("Database ready")).catch(console.error);

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const tableName = 'uploaded_data';
        await createTableFromCSV(req.file.buffer, tableName);
        res.json({ success: true, message: 'File uploaded and processed successfully' });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/query', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const schemaInfo = await getSchemaInfo();
        const generatedSql = await generateSQL(query, schemaInfo);

        console.log("AI Generated SQL:", generatedSql);

        const results = await runQuery(generatedSql);

        res.json({
            success: true,
            sql: generatedSql,
            results: results
        });

    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});

export default app;