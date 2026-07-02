# Deal Intelligence Engine

Backend-first module for evidence-backed analysis of businesses, real estate, franchises, digital businesses, debt notes, equipment-heavy opportunities, and other wealth-building assets.

## Headless API
- `POST /api/deal-intel/deals` — intake raw listing text, create canonical deal/asset/source document, extract initial canonical facts.
- `POST /api/deal-intel/deals/:dealId/analyze` — run financial, valuation, risk, scenario, score, recommendation, and report generation services.
- `GET /api/deal-intel/deals/:dealId/brief` — return a Deal Intelligence Brief with ready-to-render visual payload JSON.
- `GET /api/deal-intel/deals/:dealId/facts` — return current canonical facts only.
- `POST /api/deal-intel/deals/:dealId/documents` — attach pasted/source documents.
- `POST /api/deal-intel/deals/:dealId/research` — queue background research runs.
- `GET /api/deal-intel/integrations/:dealId/empireos` — EmpireOS summary contract.
- `GET /api/deal-intel/integrations/:dealId/dealflow` — DealFlow execution contract.

## Source-of-truth rules
`deal_intel_canonical_facts` owns current deal facts. The partial unique index in migration `0019_deal_intelligence_engine.sql` allows only one active fact per `deal_id`/`asset_id`/`fact_key`; older facts must be superseded instead of silently overwritten.

## No UI yet
This module intentionally ships API, schema, analysis services, research tracking tables, and tests before visual pages.
