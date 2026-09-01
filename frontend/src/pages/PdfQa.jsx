import { useState } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

export default function PdfQa() {
  const [file, setFile] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [chunkCount, setChunkCount] = useState(0)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/pdf-qa/upload', form)
      setSessionId(res.data.session_id)
      setChunkCount(res.data.chunk_count)
      setAnswer(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const ask = async (e) => {
    e.preventDefault()
    if (!sessionId || !question) return
    setAsking(true)
    setError('')
    try {
      const form = new FormData()
      form.append('session_id', sessionId)
      form.append('question', question)
      const res = await api.post('/pdf-qa/ask', form)
      setAnswer(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Question failed')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>PDF Doubt-Clearing</h2>
      <div className="card">
        <form onSubmit={upload}>
          <label>Upload chapter / notes PDF</label>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} required />
          <button disabled={uploading} type="submit">{uploading ? 'Processing...' : 'Upload & chunk'}</button>
        </form>
        {sessionId && <p style={{ color: '#22c58b', fontSize: 13 }}>Ready — {chunkCount} chunks indexed.</p>}
      </div>

      {sessionId && (
        <div className="card">
          <form onSubmit={ask}>
            <label>Ask a question about this document</label>
            <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Explain the second law mentioned in chapter 3" />
            {error && <div className="error-text">{error}</div>}
            <button disabled={asking} type="submit">{asking ? 'Thinking...' : 'Ask Genie'}</button>
          </form>
        </div>
      )}

      {answer && (
        <div className="card">
          <h2>Answer <GenieBadge mode={answer.mode} /></h2>
          <div className="answer-box">{answer.answer}</div>
          {answer.sources?.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#9aa1af', fontSize: 13 }}>Source chunks used</summary>
              {answer.sources.map((s, i) => (
                <div key={i} className="answer-box" style={{ marginTop: 8, fontSize: 13 }}>{s}</div>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  )
}
