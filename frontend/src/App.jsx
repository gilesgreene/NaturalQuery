import { useState } from 'react';
import { Search, Database, Code, Activity, AlertCircle } from 'lucide-react';

function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error fetching query:", error);
      setResult({ error: "Failed to connect to the backend server." });
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
