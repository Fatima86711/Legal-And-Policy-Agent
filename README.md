# Legal Document Summarization Agent
### A Multi-Agent AI System for Legal Document Analysis, Summarization, and Policy Interpretation

**University of Engineering and Technology, Taxila**
Faculty of Telecommunication and Information Engineering — Software Engineering Department
Course: Artificial Intelligence (AI) | Instructor: Dr. Kanwal Yousaf | Session: 2023

---

## Group Members

| Name | Registration No. |
|------|-----------------|
| Aneesa Ashfaq | 23-SE-13 |
| Fatima Zafar | 23-SE-39 |

---

## Abstract

Legal documents such as contracts, rental agreements, court notices, and employment agreements are written in highly specialized language that is inaccessible to ordinary citizens, particularly in developing countries like Pakistan where legal literacy is extremely low. This project presents a multi-agent AI system for legal document analysis that accepts PDF or plain text legal documents as input and produces simplified, structured, and actionable outputs through a Retrieval-Augmented Generation (RAG) pipeline grounded in user-uploaded documents. The system adapts the Orchestrator-Workers pattern described in Anthropic (2024) to the legal domain, implementing three specialized agents: a Coordinator Agent for task orchestration, a Document Retrieval Agent for semantic chunk retrieval from ChromaDB, and a Legal Explainer Agent for structured response generation using Cohere Command-R. The system handles six distinct task types — document summarization, legal terminology explanation, key information extraction, risk assessment, document type classification, and conversational Q&A — with responses drawn exclusively from the uploaded document, preventing hallucination. OCR support via Tesseract enables processing of scanned legal PDFs. The complete system is deployed as a full-stack web application with a React frontend and FastAPI backend, providing both a document upload panel and an interactive chat interface accessible to non-technical users.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Multi-Agent Pipeline](#multi-agent-pipeline)
4. [Technology Stack](#technology-stack)
5. [Complex Engineering Problem Mapping](#complex-engineering-problem-mapping)
6. [Repository Structure](#repository-structure)
7. [Setup and Installation](#setup-and-installation)
8. [Usage Guide](#usage-guide)
9. [API Reference](#api-reference)
10. [Example Interactions](#example-interactions)
11. [Experiments and Results](#experiments-and-results)
12. [Limitations and Future Work](#limitations-and-future-work)
13. [References](#references)

---

## Project Overview

### Problem Statement

Legal documents are drafted by trained professionals using precise legal terminology, Latin phrases, and structured clauses that carry very specific meanings within the judicial system. While this precision is necessary for legal validity, it creates a massive communication gap between the legal system and ordinary citizens. This gap is particularly severe in Pakistan, where a significant majority of people sign contracts, rental agreements, property deeds, and loan documents without understanding what they contain or what they are legally committing to. The consequences range from financial loss to wrongful legal obligations in extreme cases.

Even in developed countries, surveys have consistently shown that ordinary individuals find legal documents confusing, intimidating, and inaccessible. Existing AI tools that address this problem are either expensive commercial products, require technical knowledge to operate, are designed for Western legal systems, or provide only a single type of output such as summarization alone. No widely accessible, free, and user-friendly tool exists specifically for legal document understanding targeted at the Pakistani general public.

### Solution

A task-oriented multi-agent AI system that accepts any legal document as input and produces clear, simplified, and structured outputs that any ordinary person can understand without a legal background. The system additionally allows users to interact through a conversational chat interface to ask follow-up questions about any part of the uploaded document. Every response is grounded exclusively in the uploaded document using RAG, ensuring that the agent's output is directly traceable to the actual content of the user's document rather than fabricated from general model knowledge.

### Key Capabilities

- **Document Summarization** — Concise plain-language summary identifying document type, all parties, key dates, and monetary values
- **Legal Term Explanation** — Identification and clarification of complex legal terminology with practical examples, informed by the plain-language research of Manor and Li (2019)
- **Key Information Extraction** — Parties, dates, monetary amounts, obligations, and deadlines extracted and presented clearly
- **Risk Assessment** — Highlighting potentially unfair or dangerous clauses from the user's perspective with an overall risk rating (Low / Medium / High) and suggested questions for a lawyer
- **Document Type Classification** — Automatic detection of the type of legal document provided
- **Conversational Q&A** — Interactive chat for follow-up questions about any part of the uploaded document
- **OCR Support** — Processes scanned (image-based) legal PDFs through Tesseract at 300 DPI
- **Graceful Degradation** — Explicitly acknowledges when uploaded documents do not contain sufficient information rather than fabricating an answer

### Target Users

- General public — individuals receiving contracts, notices, or agreements who cannot afford legal review
- Small business owners — dealing with vendor agreements, employee contracts, and lease documents
- Students and researchers — requiring analysis of legal texts for academic purposes
- Paralegals and junior lawyers — needing rapid summaries of lengthy documents to save time
- Real estate buyers and tenants — handling property sale deeds and rental agreements

---

## System Architecture

The system is organized into six main components arranged in a two-path pipeline — an ingestion path for document upload and a query path for user interaction.

```
╔══════════════════════════════════════════════════════════════════╗
║                   REACT FRONTEND                                 ║
║        Document Upload Panel  ·  Chat Panel                      ║
║        Tailwind CSS · Zustand State · react-dropzone             ║
╚═══════════════════════╦══════════════════════════════════════════╝
                        ║ REST API (JSON / multipart form-data)
              ┌─────────╩─────────┐
              │                   │
       POST /documents      POST /chat/query
              │                   │
              ▼                   ▼
╔═════════════════════════════════════════════════════════════════╗
║                    FASTAPI BACKEND                              ║
║              main.py · routers/ · CORS middleware               ║
╚══════════════╦══════════════════╦══════════════════════════════╝
               │                  │
    ┌──────────▼──────┐    ┌──────▼───────────────────────────┐
    │ INGESTION        │    │ COORDINATOR AGENT                │
    │ PIPELINE         │    │ agents/coordinator.py            │
    │                  │    │ Validate → Classify → Orchestrate│
    │ 1. pdfplumber    │    └──────────┬────────────┬──────────┘
    │    text extract  │               │            │
    │ 2. OCR fallback  │               ▼            ▼
    │    (Tesseract)   │    ┌──────────────┐ ┌─────────────────┐
    │ 3. LangChain     │    │  RETRIEVAL   │ │  EXPLAINER      │
    │    text split    │    │  AGENT       │ │  AGENT          │
    │ 4. Cohere embed  │    │              │ │                 │
    │    (search_doc)  │    │ embed query  │ │ select template │
    │ 5. ChromaDB      │    │ query Chroma │ │ fill prompt     │
    │    store chunks  │    │ rerank       │ │ call Cohere LLM │
    └────────┬─────────┘    │ deduplicate  │ │ validate output │
             │              └──────┬───────┘ └────────┬────────┘
             ▼                    └─────────┬──────────┘
    ┌─────────────────┐                    │ structured response
    │  CHROMADB        │◄───────────────────┘
    │  Vector Store    │
    │  cosine similarity│
    │  metadata stored  │
    └─────────────────┘
```

### Agent Roles and Responsibilities

**Coordinator Agent** (`agents/coordinator.py`) — The central orchestrator implementing the Orchestrator-Workers pattern from Anthropic (2024). It receives raw user queries, validates them, classifies them into task types using Cohere Command-R at `temperature=0.0`, selects task-specific retrieval configuration, and sequentially dispatches to the Retrieval Agent and Explainer Agent.

**Document Retrieval Agent** (`agents/retrieval_agent.py`) — Performs semantic search over ChromaDB. Preprocesses the query, expands it with legal synonyms, generates embeddings via Cohere Embed v3 with `input_type="search_query"`, retrieves top-k chunks by cosine similarity, applies secondary reranking, deduplicates overlapping chunks, and returns structured results.

**Legal Explainer Agent** (`agents/explainer_agent.py`) — Selects the appropriate prompt template (Summarization, Risk Assessment, or Term Explanation), fills it with the query and formatted `[Source N]` context block, calls Cohere Command-R, validates response structure, and returns a standardized dict. All templates prohibit fabricated citations and require a legal disclaimer.

---

## Multi-Agent Pipeline

### Query Processing Flow

```
User submits query via Chat Panel
              │
              ▼
┌─────────────────────────┐
│   COORDINATOR AGENT     │
│   validate_query()      │──── invalid ──► return error to UI
└──────────┬──────────────┘
           │ valid
           ▼
┌─────────────────────────┐    ┌──────────────────────────────┐
│   classify()            │◄───│  ROUTING PROMPT TEMPLATE     │
│   Cohere Command-R      │    │  Few-shot examples           │
│   temp=0.0, tokens=20   │    │  RETRIEVAL / EXPLANATION /   │
└──────────┬──────────────┘    │  COMPARISON / UNKNOWN        │
           │                   └──────────────────────────────┘
   ┌───────┴──────────────────────────────────┐
   │                                          │
   ▼                                          ▼
RETRIEVAL / EXPLANATION / COMPARISON       UNKNOWN
   │                                          │
   ▼                                          ▼
┌────────────────────┐               Static off-topic response
│  RETRIEVAL AGENT   │               (no LLM call, zero tokens)
│                    │
│ 1. preprocess()    │
│ 2. expand_query()  │◄── legal synonym dictionary
│ 3. embed_query()   │◄── Cohere Embed v3 (search_query)
│ 4. query ChromaDB  │
│ 5. rerank()        │◄── keyword + section header bonuses
│ 6. deduplicate()   │
└──────────┬─────────┘
           │ {chunks, sources, has_results, top_score}
           ▼
┌──────────────────────────────────────────────────────────────┐
│  EXPLAINER AGENT — explain()                                 │
│                                                              │
│  has_results = True?                                         │
│     YES → select template (SUMMARIZATION / RISK / TERM)     │
│            fill [Source 1], [Source 2]... context block      │
│            call Cohere Command-R (temp=0.2–0.3)              │
│            validate response structure                       │
│     NO  → fill NO_RESULTS fallback template (temp=0.1)      │
└────────────────────────────┬─────────────────────────────────┘
                             │ standardized response dict
                             ▼
             FastAPI router → React Chat Panel
             Markdown render + source citation pills
```

### Document Ingestion Pipeline

```
User uploads PDF or TXT
              │
              ▼
┌─────────────────────────┐
│  is_scanned_pdf()?      │── text-based ──► pdfplumber extract
│  PyMuPDF: <50 chars     │── scanned ─────► Tesseract OCR 300 DPI
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  clean_text()           │  Remove artifacts, page numbers,
│                         │  non-printable chars, whitespace
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  chunk_pages()          │  LangChain RecursiveCharacterTextSplitter
│                         │  chunk_size=800, overlap=150
│                         │  Separators: \n\n → \n → ". " → " " → ""
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  embed_chunks()         │  Cohere Embed v3 (search_document)
│                         │  Batch size ≤ 90 chunks per API call
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  store_chunks()         │  ChromaDB PersistentClient
│                         │  Collection: legal_documents
│                         │  Metadata: filename, section, page
└─────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Justification |
|---|---|---|
| Language | Python 3.10+ | Rich NLP ecosystem, async support |
| LLM API | Cohere Command-R | Strong instruction following on RAG tasks, free developer tier (Cohere Inc., 2024) |
| Embedding Model | Cohere Embed v3 (embed-english-v3.0) | Separate document and query embedding types improve retrieval accuracy |
| Vector Database | ChromaDB | Local persistent storage, cosine similarity, metadata filtering, no cloud required |
| Document Processing | LangChain + pdfplumber | Structured chunking; pdfplumber handles complex PDF layouts better for legal documents |
| OCR Engine | Tesseract + pdf2image | Scanned legal PDF support at 300 DPI |
| Backend Framework | FastAPI | Async REST API, automatic Swagger documentation |
| Frontend | React + Vite | Component-based UI with fast development server |
| Styling | Tailwind CSS | Utility-first responsive design |
| State Management | Zustand + persist | Lightweight global state with localStorage persistence |
| File Upload | react-dropzone | Drag-and-drop with MIME type validation |
| Markdown Rendering | react-markdown | Renders structured LLM responses correctly |

---

## Complex Engineering Problem Mapping

This project satisfies WP3 and WP5 attributes of Complex Engineering Problems as required by the assessment rubric.

### WP3 — Depth of Knowledge Required

This system requires simultaneous competency across multiple engineering and scientific domains. These include Natural Language Processing for embedding-based semantic retrieval, demonstrated by the domain-specific pre-training research in Chalkidis et al. (2020) showing that legal-specific training significantly improves NLP task performance, and the broader LLM legal reasoning capabilities confirmed in Bommarito and Katz (2022); distributed data systems for ChromaDB vector store design and cosine similarity search; software architecture for multi-agent design following the Orchestrator-Workers pattern from Anthropic (2024); prompt engineering for legal tasks, informed by Manor and Li (2019) who found that legal simplification requires restructuring complex sentence constructions rather than vocabulary substitution alone; and legal domain knowledge for constructing templates that reflect the epistemic standards of legal analysis. The chunk size, overlap, similarity threshold, and reranking heuristics all require knowledge at the intersection of NLP, information retrieval, and legal text structure — no single field's literature covers this combination.

### WP5 — Extent of Applicable Codes

The system must process legal documents spanning multiple document types, regulatory frameworks, and formatting conventions. The chunking pipeline engineering decisions — separator priority lists, minimum chunk lengths, section header detection for Article, Section, Clause, Part, Chapter, Schedule, and Rule markers — are directly necessitated by the structural variety across different legal codes. A Pakistani rental agreement, a GDPR text, a court notice, and an employment contract use different heading conventions, clause numbering schemes, and document structures. The risk assessment template is specifically designed to address Pakistani legal context, where identifying one-sided clauses requires understanding common patterns in Pakistani contractual practice. The ContractNLI work of Zheng et al. (2021) confirms that understanding contractual obligations benefits from structured reasoning, which informs the structured section format of this system's risk template.

---

## Repository Structure

```
legal-policy-agent/
│
├── backend/
│   ├── agents/
│   │   ├── coordinator.py          # Validation, classification, orchestration
│   │   ├── retrieval_agent.py      # Semantic search, reranking, deduplication
│   │   └── explainer_agent.py      # Template selection, LLM generation, validation
│   │
│   ├── pipeline/
│   │   ├── ingestion.py            # Load → Clean → Chunk → Embed → Store
│   │   ├── ocr.py                  # Tesseract OCR for scanned PDFs
│   │   └── formatter.py            # Output formatting utilities
│   │
│   ├── prompts/
│   │   └── templates.py            # Summarization, Risk Assessment, Term Explanation
│   │                               # templates + context block builder
│   ├── routers/
│   │   ├── chat.py                 # POST /chat/query, /classify, /test, /health
│   │   └── documents.py            # POST /upload, GET /, DELETE /{filename}, stats
│   │
│   ├── core/
│   │   ├── config.py               # All settings loaded from .env
│   │   ├── cohere_client.py        # Cohere client: generate_response, embed_query
│   │   └── chroma_client.py        # ChromaDB client: CRUD, query, list, stats
│   │
│   ├── models/
│   │   ├── request_models.py       # Pydantic ChatRequest
│   │   └── response_models.py      # Pydantic ChatResponse
│   │
│   ├── vectorstore/                # ChromaDB persistent storage (git-ignored)
│   ├── data/raw/                   # Uploaded PDFs and TXT files (git-ignored)
│   ├── main.py                     # FastAPI app, CORS, middleware, lifespan
│   ├── requirements.txt
│   └── .env                        # API keys (git-ignored)
│
├── frontend/
│   ├── src/
│   │   ├── api/index.js            # All backend API calls
│   │   ├── store/chatStore.js      # Zustand global state + localStorage persist
│   │   ├── hooks/
│   │   │   ├── useChat.js          # sendMessage, retryLastMessage, sendExampleQuery
│   │   │   └── useDocuments.js     # upload, remove, loadDocuments
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.jsx       # Message list, welcome screen
│   │   │   │   ├── ChatInput.jsx        # Auto-resize textarea, char counter
│   │   │   │   ├── MessageBubble.jsx    # Markdown render, task badge, metadata
│   │   │   │   └── SourceCitation.jsx   # Source document pills
│   │   │   ├── documents/
│   │   │   │   ├── DocumentUpload.jsx   # Drag-drop zone, progress indicator
│   │   │   │   └── DocumentList.jsx     # Document cards with delete
│   │   │   └── layout/
│   │   │       ├── MainLayout.jsx       # Two-column resizable layout
│   │   │       ├── Header.jsx           # Status, KB stats, clear chat
│   │   │       └── Sidebar.jsx          # Stats bar, upload, document list
│   │   ├── pages/Home.jsx
│   │   └── utils/helpers.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Setup and Installation

### Prerequisites

```bash
python --version    # 3.10 or higher
node --version      # 18 or higher
npm --version
git --version
```

You will also need a free Cohere API key from [cohere.com](https://cohere.com).

### Step 1 — Clone the Repository

```bash
git clone https://github.com/[your-username]/legal-policy-agent.git
cd legal-policy-agent
```

### Step 2 — Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Step 3 — Environment Configuration

Create `backend/.env`:

```env
COHERE_API_KEY=your_cohere_api_key_here
COHERE_MODEL=command-r
EMBEDDING_MODEL=embed-english-v3.0
CHROMA_PERSIST_DIR=./vectorstore
APP_ENV=development

# For scanned PDF support only
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
POPPLER_PATH=C:\poppler\Library\bin
```

### Step 4 — Tesseract OCR (Scanned PDFs Only)

Download the Tesseract installer from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) and install it. Download Poppler from [oschwartz10612/poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases), extract it, and update both paths in your `.env`.

Verify:
```bash
where tesseract
```

### Step 5 — Start the Backend

```bash
uvicorn main:app --reload
```

Expected output:
```
✅ Cohere client initialized successfully.
✅ ChromaDB client initialized successfully.
✅ Collection 'legal_documents' ready. Total chunks stored: 0
✅ Backend is ready.
📡 API docs: http://127.0.0.1:8000/docs
```

### Step 6 — Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Usage Guide

### Uploading a Legal Document

1. Open `http://localhost:5173`
2. Find the **Upload a legal document** zone in the left sidebar
3. Drag and drop a PDF or `.txt` file, or click to browse
4. Watch the five-stage progress indicator in real time
5. The document appears in the list with its chunk count and file size

**Supported:** PDF (text-based and scanned), plain text (.txt) | **Max size:** 20MB

### Querying the System

Type your question in the chat input and press **Enter**. Use **Shift+Enter** for a new line without submitting. The system automatically detects which task type applies:

| Task | Example Query |
|---|---|
| Summarization | "Give me a plain-language summary of this document" |
| Risk Assessment | "What are the risky clauses I should be worried about?" |
| Term Explanation | "What does 'force majeure' mean in this agreement?" |
| Key Information | "Who are the parties and what are the key dates?" |
| Comparison | "How does this contract differ from a standard agreement?" |
| Q&A | "Can I terminate this agreement early without a penalty?" |

### Interpreting Responses

Every response includes a **colored task type badge**, **structured sections** with headings appropriate to the task, **source citation pills** showing which document was referenced, a **metadata bar** showing chunks used and relevance score, and a **disclaimer** that the response is informational only and not legal advice.

### Managing Documents

Delete any document by clicking the trash icon on its card and confirming. The document is removed from both ChromaDB and disk. Documents persist across browser refreshes because ChromaDB stores data on disk and Zustand persists the document list to localStorage.

---

## API Reference

Full interactive documentation at `http://127.0.0.1:8000/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | System info and route map |
| `POST` | `/chat/query` | Full multi-agent pipeline |
| `POST` | `/chat/classify` | Classification only, no generation |
| `POST` | `/chat/test` | Full pipeline with diagnostic fields |
| `GET` | `/chat/health` | Backend connectivity check |
| `POST` | `/documents/upload` | Upload and ingest a document |
| `GET` | `/documents/` | List all ingested documents |
| `GET` | `/documents/stats/summary` | Knowledge base statistics |
| `DELETE` | `/documents/{filename}` | Delete from ChromaDB and disk |

**Example request:**
```json
POST /chat/query
{
  "query": "What are my obligations as a tenant under this rental agreement?"
}
```

**Example response:**
```json
{
  "query": "What are my obligations as a tenant...",
  "response": "**Legal Analysis**\n\nClause 5 states that the tenant must...[Source 1]...",
  "task_type": "RETRIEVAL",
  "sources": ["rental_agreement.pdf"],
  "chunks_used": 4,
  "top_score": 0.89,
  "used_fallback": false,
  "is_valid": true,
  "processing_time_ms": 2870.3
}
```

---

## Example Interactions

### Example 1 — Document Summarization

**Query:** "Give me a plain-language summary of this employment contract"

**Response excerpt:**
```
**Document Type**
Employment Contract

**Parties Involved**
Employer: XYZ Pvt. Ltd. [Source 1]
Employee: The undersigned individual

**Key Dates**
Start Date: 1st January 2025 [Source 2]
Probation Period: 3 months

**Plain-Language Summary**
This agreement commits you to working 40 hours per week,
maintaining confidentiality of company information, and
giving 30 days written notice before resignation. [Source 3]

**Disclaimer**
This summary is for informational purposes only and does
not constitute legal advice.
```

---

### Example 2 — Risk Assessment

**Query:** "What are the risky or unfair clauses in this contract?"

**Response excerpt:**
```
**Overall Risk Rating: MEDIUM**

**Clause 1 — Non-Compete Restriction (High Risk)**
Clause 8 prevents you from working in the same industry
anywhere in Pakistan for 2 years after leaving. [Source 2]
This is unusually broad and may not be enforceable.

**Clause 2 — Unilateral Salary Deductions (Medium Risk)**
The employer can deduct amounts for damages at their
sole discretion without specifying a review process. [Source 4]

**Questions to Ask a Lawyer Before Signing**
1. Is a 2-year non-compete clause enforceable in Pakistan?
2. What process applies before any salary deduction is made?
```

---

### Example 3 — Legal Term Explanation

**Query:** "What does 'force majeure' mean in this agreement?"

**Response excerpt:**
```
**Plain Language Definition**
Force majeure means "acts of God" — events completely outside
anyone's control that make it impossible to fulfil a contract. [Source 1]

**Formal Legal Definition**
An unforeseeable circumstance that prevents a party from
fulfilling a contractual obligation, typically releasing both
parties from liability for non-performance.

**Practical Example**
If a factory fire caused by a natural disaster prevents your
employer from paying salaries, they may invoke force majeure
to temporarily suspend that obligation.

**Related Terms**
Act of God, impossibility of performance, frustration of contract
```

---

### Example 4 — Graceful Degradation

**Query:** "What does this contract say about intellectual property?" (no IP clause in document)

**Response:**
```
The uploaded document does not contain sufficient information
to answer this query. No clauses related to intellectual
property ownership were found in rental_agreement.pdf.

To get a complete answer, consider uploading a contract
version that includes an intellectual property section,
or consult a qualified legal professional.
```

---

## Experiments and Results

### Evaluation Setup

The system was evaluated using three different legal document types: a standard Pakistani rental agreement (8 pages, 54 chunks), an employment contract (12 pages, 87 chunks), and a vendor service agreement (6 pages, 41 chunks). A total of 15 test queries were submitted covering all task types. Evaluation criteria: correct task classification, retrieval relevance (top similarity score above 0.70), response structure compliance (expected section headers present), and graceful degradation behavior.

### Results Summary

| Task Type | Queries | Correct Classification | Avg Top Score | Structure Compliant | Fallback Correct |
|---|---|---|---|---|---|
| Summarization | 3 | 3/3 (100%) | 0.81 | 3/3 (100%) | N/A |
| Risk Assessment | 3 | 3/3 (100%) | 0.85 | 3/3 (100%) | N/A |
| Term Explanation | 3 | 3/3 (100%) | 0.78 | 3/3 (100%) | N/A |
| Comparative Analysis | 2 | 2/2 (100%) | 0.77 | 2/2 (100%) | N/A |
| Unknown / Off-topic | 2 | 2/2 (100%) | N/A | N/A | 2/2 (100%) |
| Out-of-document queries | 2 | N/A | 0.31 (below threshold) | N/A | 2/2 (100%) |
| **Total** | **15** | **13/13 (100%)** | **0.80** | **13/13 (100%)** | **4/4 (100%)** |

### Key Observations

**Classification Accuracy** — The few-shot routing prompt at `temperature=0.0` achieved 100% classification accuracy across all 15 test queries. Queries containing "summarize," "explain," "risky," or "compare" were routed correctly without ambiguity in every case.

**Query Expansion Impact** — A query using "unfair" (without expansion) retrieved 2 relevant chunks at an average score of 0.64. The same query expanded to "unfair unreasonable one-sided clause" retrieved 5 chunks at an average score of 0.85, demonstrating the practical benefit of the legal synonym dictionary.

**Risk Assessment Quality** — All 3 risk assessment responses correctly included the High / Medium / Low overall rating, listed specific clauses by number with source citations, and included the "Questions to Ask a Lawyer" section — directly serving the target user population of non-specialists.

**Graceful Degradation** — All 4 fallback cases triggered correctly. Zero hallucinated citations appeared in any fallback response. Every fallback response identified the specific limitation and suggested a corrective action.

**Processing Time** — Average end-to-end pipeline: 3.1 seconds (retrieval tasks), 2.7 seconds (explanation tasks), 4.3 seconds (comparison tasks). OCR ingestion of a 15-page scanned document completed in 47 seconds at 300 DPI.

---

## Limitations and Future Work

### Current Limitations

**English-only processing** — The system currently handles English-language legal documents only. Pakistani legal documents are frequently in Urdu or mixed Urdu-English. Extending OCR and embedding support to Urdu would dramatically expand utility for the target user population.

**Prompt-level citation enforcement only** — The system instructs the model to include `[Source N]` citations after every factual claim but does not enforce this at the post-processing level. Occasional paragraphs appear without inline citations. A post-generation parser validating citation density would fully close this gap.

**Single-document comparison limitation** — The Retrieval Agent does not explicitly target one document per subject in comparison queries. If one document dominates similarity scores, comparisons become one-sided.

**No real-time legal updates** — The knowledge base is bounded entirely by what the user uploads. Newly enacted legislation or recent court rulings are not accessible.

**OCR quality dependence** — Accuracy degrades for very low-resolution scans, handwritten annotations, or complex multi-column layouts common in old Pakistani legal documents.

### Future Work

**Urdu language support** — Integrating Urdu-capable OCR and a multilingual embedding model would extend the system to the full range of Pakistani legal document formats.

**Post-generation citation validation** — A formatter module that identifies uncited sentences and flags or removes them would achieve fully enforced mandatory citation across all task types.

**Risk clause database** — A structured database of known problematic clause patterns in Pakistani contracts would allow the Risk Assessment Agent to perform pattern-matching in addition to LLM-based identification.

**Multi-turn conversation context** — Incorporating previous chat messages in the retrieval query would enable accurate follow-up questions without re-specifying context.

---

## References

Anthropic. (2024). Building effective agents. Retrieved from https://www.anthropic.com/engineering/building-effective-agents

Bommarito, M., and Katz, D. M. (2022). GPT takes the bar exam. *arXiv preprint arXiv:2212.14402*.

Chalkidis, I., Fergadiotis, M., Malakasiotis, P., Aletras, N., and Androutsopoulos, I. (2020). LEGAL-BERT: The Muppets straight out of Law School. *Findings of the Association for Computational Linguistics: EMNLP 2020*, pp. 2898–2904.

Cohere Inc. (2024). Command R: A scalable LLM built for business. Retrieved from https://cohere.com/blog/command-r

Lewis, P., Perez, E., Piktus, A., et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. *Advances in Neural Information Processing Systems*, 33, 9459–9474.

Manor, L., and Li, J. J. (2019). Plain English summarization of contracts. *Proceedings of the Natural Legal Language Processing Workshop 2019*, pp. 1–11.

Yao, S., Zhao, J., Yu, D., et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models. *The Eleventh International Conference on Learning Representations*.

Zheng, K., Guha, N., Anderson, B. R., Henderson, P., Ho, D. E., and Manning, C. D. (2021). When does pretraining help? Assessing self-supervised learning for law and the CaseHOLD dataset. *Proceedings of the 18th International Conference on Artificial Intelligence and Law*, pp. 159–168.

---

## License

This project was developed as a semester project for the Artificial Intelligence course at UET Taxila, Software Engineering Department. For academic use only.

---

*Legal Document Summarization Agent — UET Taxila, Software Engineering Department*
*AI Assignment-2 (Project-Module-2) | Dr. Kanwal Yousaf | 23-SE-13 · 23-SE-39*
