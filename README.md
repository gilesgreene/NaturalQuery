# NaturalQuery

A natural language to SQL query interface with file upload support.

## Features
- Query databases using natural language
- Upload CSV files for custom data analysis
- AI-powered SQL generation using Hugging Face (free, no API key required)
- Modern web interface

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Backend
cd backend
npm install
cp .env.example .env  # Add your API keys if needed
npm start

# Frontend
cd frontend
npm install
npm run dev
```

## Deployment

### Frontend (Netlify/Vercel)
1. Push to GitHub
2. Connect repository to Netlify/Vercel
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Deploy

### Backend (Railway/Render)
1. Push to GitHub
2. Connect to Railway (railway.app)
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables if needed
6. Deploy

### Database
- Uses SQLite (file-based)
- Data persists on Railway with persistent disks
- Uploaded files are stored temporarily

## Usage
1. Upload a CSV file (optional)
2. Enter natural language queries like:
   - "Show me all products"
   - "What are the sales figures"
   - "Find expensive items"
3. Get SQL queries and results instantly

## AI Model
Uses keyword-based SQL generation (no external APIs required). The app includes Hugging Face integration as a bonus, but falls back to reliable keyword matching for all queries.