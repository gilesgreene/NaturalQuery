import { useState } from 'react';
import { Search, Database, Code, Activity, AlertCircle, Upload, FileText } from 'lucide-react';

function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (selectedFile) => {
    if (!selectedFile || selectedFile.type !== 'text/csv') {
      alert('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Upload failed: ${response.status}`);
      }
      await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    handleFileUpload(e.target.files[0]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Server error: ${response.status}`);
      }
      setResult(await response.json());
    } catch (error) {
      console.error('Error fetching query:', error);
      setResult({ error: error.message || "Failed to connect to the backend server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>NaturalQuery</h1>
        <p className="subtitle">Translate your data into insights.</p>
      </header>

      {/* Upload bubble — fully inline styled to guarantee centering */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        marginBottom: '28px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '36px 24px',
          borderRadius: '24px',
          background: 'rgba(67, 97, 238, 0.08)',
          border: '1.5px dashed rgba(99, 82, 217, 0.6)',
        }}>

          {/* Icon */}
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(67, 97, 238, 0.15)',
            border: '1px solid rgba(99, 82, 217, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7c6fe0',
            flexShrink: 0,
          }}>
            <Upload size={22} />
          </div>

          {/* Labels */}
          <div>
            <h3 style={{ margin: '0 0 6px', color: '#e8e4ff', fontSize: '1.05rem', fontWeight: 600 }}>
              Upload your CSV
            </h3>
            <p style={{ margin: 0, color: 'rgba(180,160,255,0.55)', fontSize: '0.85rem' }}>
              Drop a file or click to browse
            </p>
          </div>

          {/* File picker button */}
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: '#4361ee',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.95rem',
            boxShadow: '0 4px 14px rgba(67,97,238,0.35)',
            userSelect: 'none',
          }}>
            <FileText size={15} />
            Choose File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>

          {file && !uploading && (
            <p style={{
              margin: 0,
              color: '#6feaaa',
              fontSize: '0.88rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <FileText size={13} />
              {file.name}
            </p>
          )}

          {uploading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(180,160,255,0.8)',
              fontSize: '0.9rem',
            }}>
              <Activity className="spinning" size={16} />
              <span>Uploading...</span>
            </div>
          )}
        </div>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="e.g. Show me all users who signed up this year…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="search-btn" disabled={loading || !question.trim()}>
          {loading ? <div className="loader" /> : <Search size={17} />}
          {loading ? 'Processing…' : 'Ask AI'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="result-section">
          {result.error ? (
            <div className="error-message">
              <AlertCircle size={17} />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              {result.sql && (
                <div>
                  <h3 className="section-title"><Code size={14} /> Generated SQL</h3>
                  <div className="sql-code">{result.sql}</div>
                </div>
              )}

              {result.explanation && (
                <div className="explanation">{result.explanation}</div>
              )}

              <div>
                <h3 className="section-title"><Database size={14} /> Query Results</h3>
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
                  <p style={{ color: 'rgba(180,160,255,0.5)', margin: 0, fontSize: '0.9rem' }}>
                    No data returned for this query.
                  </p>
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
