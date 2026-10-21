import { useRef, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000/api";

export default function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  function selectFile(event) {
    const selected = event.target.files?.[0];
    setError("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setError("Please select a PDF file.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setFile(selected);
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }
    setUploading(true);
    setError("");
    setDocumentInfo(null);
    setMessages([]);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API}/upload`, formData, {
        timeout: 120000,
      });
      setDocumentInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
    }
  }

  async function sendQuestion(event) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || !documentInfo || asking) return;

    setMessages((previous) => [...previous, { role: "user", content: cleanQuestion }]);
    setQuestion("");
    setAsking(true);
    setError("");

    try {
      const response = await axios.post(`${API}/ask`, {
        document_id: documentInfo.document_id,
        question: cleanQuestion,
      }, { timeout: 90000 });

      setMessages((previous) => [...previous, {
        role: "assistant",
        content: response.data.answer,
        sources: response.data.sources || [],
      }]);
    } catch (err) {
      const message = err.response?.data?.detail || "Could not get an answer. Check the backend and try again.";
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: `Sorry — ${message}`,
        sources: [],
      }]);
    } finally {
      setAsking(false);
    }
  }

  function startNewDocument() {
    setFile(null);
    setDocumentInfo(null);
    setMessages([]);
    setQuestion("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DocuMind home">
          <span className="brand-icon">D</span>
          <span>Docu<span className="brand-accent">Mind</span></span>
        </a>
        <span className="topbar-label"><span className="status-dot" /> AI DOCUMENT ASSISTANT</span>
      </header>

      <main className="layout">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR DOCUMENT, UNDERSTOOD</div>
          <h1>Answers are<br /><span>in your documents.</span></h1>
          <p className="intro-copy">Upload a PDF, ask a question in plain English, and get grounded answers with page references.</p>
        </section>

        <section className="workspace">
          <aside className="sidebar">
            <div className="section-label">YOUR DOCUMENT</div>
            {!documentInfo ? (
              <form className="upload-form" onSubmit={uploadDocument}>
                <button className="dropzone" type="button" onClick={() => inputRef.current?.click()}>
                  <span className="upload-icon">↑</span>
                  <strong>{file ? file.name : "Choose a PDF file"}</strong>
                  <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Click to browse your files"}</span>
                  <span className="file-pill">PDF · MAX 10 MB</span>
                </button>
                <input ref={inputRef} className="hidden-input" type="file" accept=".pdf,application/pdf" onChange={selectFile} />
                <button className="primary-button full-button" type="submit" disabled={!file || uploading}>
                  {uploading ? <><span className="spinner" /> Processing PDF…</> : "Upload document →"}
                </button>
              </form>
            ) : (
              <div className="document-card">
                <div className="pdf-icon">PDF</div>
                <div className="document-details">
                  <strong title={documentInfo.filename}>{documentInfo.filename}</strong>
                  <span>{documentInfo.pages_with_text} pages with text</span>
                  <span className="ready-label"><span className="status-dot" /> READY TO CHAT</span>
                </div>
                <button className="icon-button" type="button" title="Upload another document" onClick={startNewDocument}>↻</button>
              </div>
            )}

            {error && <div className="error-box" role="alert">{error}</div>}

            <div className="sidebar-divider" />
            <div className="section-label">HOW IT WORKS</div>
            <div className="step"><span>01</span><div><strong>Upload a PDF</strong><p>We extract text page by page.</p></div></div>
            <div className="step"><span>02</span><div><strong>Ask naturally</strong><p>Type a question about your file.</p></div></div>
            <div className="step"><span>03</span><div><strong>Verify the source</strong><p>Check the cited page excerpts.</p></div></div>
            <div className="privacy-note"><span>✳</span><p>Answers are based on retrieved document content. Missing information is identified rather than guessed.</p></div>
          </aside>

          <section className="chat-panel">
            <div className="chat-header">
              <div><div className="section-label">CONVERSATION</div><h2>{documentInfo ? "Ask your document" : "Your AI workspace"}</h2></div>
              <span className={`connection-pill ${documentInfo ? "connected" : ""}`}><span className="status-dot" /> {documentInfo ? "DOCUMENT READY" : "AWAITING PDF"}</span>
            </div>

            <div className="chat-body">
              {!documentInfo && messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-art"><div className="art-sheet"><span /><span /><span /><i>?</i></div><div className="art-spark">✳</div></div>
                  <h3>Start with a document</h3>
                  <p>Upload a PDF from the panel to begin. Your document becomes searchable, so you can ask questions and inspect supporting excerpts.</p>
                  <div className="suggestion-grid">
                    <div><span>⌕</span><strong>Find key details</strong><small>“What are the main points?”</small></div>
                    <div><span>≡</span><strong>Summarize sections</strong><small>“Summarize the conclusion.”</small></div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="welcome-message">
                  <div className="assistant-avatar">✳</div>
                  <div className="message-content"><div className="message-meta">DOCUMIND <span>· READY</span></div><div className="bubble assistant-bubble">I've processed <strong>{documentInfo.filename}</strong>. Ask me a question about the document, and I'll show the source pages that may support the answer.</div>
                    <div className="prompt-chips">
                      {["Summarize this document", "What are the key points?", "What is the conclusion?"].map((prompt) =>
                        <button type="button" key={prompt} onClick={() => setQuestion(prompt)}>{prompt} ↗</button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {messages.map((message, index) => (
                    <div className={`message-row ${message.role}`} key={`${index}-${message.role}`}>
                      {message.role === "assistant" && <div className="assistant-avatar">✳</div>}
                      <div className="message-content">
                        <div className="message-meta">{message.role === "user" ? "YOU" : "DOCUMIND"} <span>· {message.role === "user" ? "QUESTION" : "ANSWER"}</span></div>
                        <div className={`bubble ${message.role === "user" ? "user-bubble" : "assistant-bubble"}`}>{message.content}</div>
                        {message.sources?.length > 0 && (
                          <details className="sources">
                            <summary>⌁ {message.sources.length} source excerpts</summary>
                            {message.sources.map((source, sourceIndex) => (
                              <div className="source-card" key={`${source.page}-${sourceIndex}`}>
                                <div className="source-heading"><span>PAGE {source.page}</span><span>SIMILARITY {source.similarity}</span></div>
                                <p>{source.excerpt}{source.excerpt.length >= 700 ? "…" : ""}</p>
                              </div>
                            ))}
                          </details>
                        )}
                      </div>
                      {message.role === "user" && <div className="user-avatar">YOU</div>}
                    </div>
                  ))}
                  {asking && <div className="message-row assistant"><div className="assistant-avatar">✳</div><div className="message-content"><div className="message-meta">DOCUMIND <span>· THINKING</span></div><div className="bubble assistant-bubble typing"><i /><i /><i /></div></div></div>}
                </div>
              )}
            </div>

            <form className="composer" onSubmit={sendQuestion}>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!documentInfo || asking} placeholder={documentInfo ? "Ask a question about your document…" : "Upload a PDF to start asking questions…"} aria-label="Your question" />
              <button className="send-button" type="submit" disabled={!documentInfo || !question.trim() || asking} aria-label="Send question">↑</button>
              <div className="composer-foot"><span>↳ Answers use document context and can be imperfect. Verify important details against the source.</span><span>POWERED BY AI</span></div>
            </form>
          </section>
        </section>
        <footer className="page-footer"><span>DOCUMIND © 2026</span><span>BUILT FOR DOCUMENT-BASED QUESTION ANSWERING</span></footer>
      </main>
    </div>
  );
}
