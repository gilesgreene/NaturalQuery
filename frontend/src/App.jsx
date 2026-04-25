import { useState } from 'react';
import { Search, Database, Code, Activity, AlertCircle } from 'lucide-react';

function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      alert('File uploaded successfully! You can now query your data.');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // 1. Point to port 3001 (where your Express server is listening)
      // 2. Use '/query' instead of '/api/query'
      const response = await fetch('http://localhost:3001/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }) // Backend expects { query }
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      // Based on your server.js, the backend returns: 
      // { results: [...], sql: "SELECT..." }
      setResult(data);

    } catch (error) {
      console.error("Error fetching query:", error);
      setResult({ error: "Failed to connect to the backend server. Make sure it's running on port 3001." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>NaturalQuery</h1>
        <p className="subtitle">Translate your intent into database insights.</p>
      </header>

      <div className="upload-container">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ marginBottom: '20px' }}
        />
        {uploading && <p>Uploading...</p>}
      </div>

      <form onSubmit={handleSearch} className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="e.g., Show me all users who signed up this year..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="search-btn" disabled={loading || !question.trim()}>
          {loading ? <div className="loader" /> : <Search />}
          {loading ? 'Processing...' : 'Ask AI'}
        </button>
      </form>

      {result && (
        <div className="result-section glass-card">
          {result.error ? (
            <div className="error-message">
              <AlertCircle />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              {result.sql && (
                <div>
                  <h3 className="section-title"><Code size={18} /> Generated SQL</h3>
                  <div className="sql-code">{result.sql}</div>
                </div>
              )}

              {result.explanation && (
                <div className="explanation">
                  {result.explanation}
                </div>
              )}

              <div>
                <h3 className="section-title"><Database size={18} /> Query Results</h3>
                {result.results && result.results.length > 0 ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {Object.keys(result.results[0]).map(key => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.results.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((val, j) => (
                              <td key={j}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No data returned for this query.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
