# Document Intelligence

EmpireOS document intelligence extracts or accepts normalized text from PDF, DOCX, TXT, and Markdown inputs before any deeper AI reasoning.

## Pipeline

1. Validate input through owner-only universal input routes.
2. Normalize text with `file-ingestion.service.ts` and block high-risk secrets before provider calls.
3. Run deterministic document analysis in `document-intelligence.service.ts`.
4. Save a compact `document_analysis` or `research_needed` artifact.
5. Create approval-gated action drafts for bills, job descriptions, credit reports, and real estate/deal documents.
6. Use `POST /api/ai/agent/run` with `inputArtifactIds` for deeper reasoning.

## High-stakes handling

Legal, credit, finance, trading, loan, and deal documents are marked for deep/research review rather than pretending to provide final current advice.
