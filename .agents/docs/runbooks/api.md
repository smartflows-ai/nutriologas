# API Runbook

> Maintained by the Docs agent. Updated on every new or changed worker endpoint.

---

## Base URL

```
Production:  https://presto-ai-worker.YOUR_SUBDOMAIN.workers.dev
Local dev:   http://localhost:8787
```

Set via `REACT_APP_AI_WORKER_URL` in `.env`.

---

## Authentication

All endpoints require:
```
Authorization: Bearer <Firebase ID token>
```

Token obtained via `auth.currentUser.getIdToken()`. Verified server-side in `worker/src/firebase-auth.js`.

---

## Endpoints

### POST /parseJD
Parses a raw job description text into structured position fields.

**Request**
```json
{ "jdText": "string" }
```
**Response**
```json
{
  "title": "string",
  "seniority": "string",
  "domain": "string",
  "techStack": ["string"],
  "softSkills": ["string"],
  "summary": "string"
}
```

---

### POST /generateQuestionBank
Generates interview questions and coding challenges for a position.

**Request**
```json
{ "position": { /* position doc */ } }
```
**Response**
```json
{
  "questions": [{ "text": "string", "category": "string" }],
  "challenges": [{ "type": "mcq|code|open", "prompt": "string" }]
}
```

---

### POST /analyzeCV
Pre-screens a candidate CV against a position.

**Request**
```json
{ "cvText": "string", "position": { /* position doc */ } }
```
**Response**
```json
{
  "summary": "string",
  "claimedTechStack": ["string"],
  "claimedExperience": { "yearsTotal": 0, "senioritySignals": "string" },
  "keyStrengths": ["string"],
  "redFlags": ["string"],
  "questionsToVerify": ["string"],
  "fitScore": 3,
  "fitRationale": "string"
}
```

---

### POST /liveSuggestion
Returns a real-time interview suggestion based on transcript context.

**Request**
```json
{
  "transcript": [{ "speaker": "interviewer|candidate", "text": "string" }],
  "askedTopics": ["string"],
  "cvClaims": ["string"]
}
```
**Response**
```json
{
  "suggestion": "string",
  "topic": "string",
  "priority": "high|medium|low",
  "reasoning": "string"
}
```

---

### POST /customPrompt
Free-text question from the interviewer to the AI co-pilot.

**Request**
```json
{ "question": "string", "transcript": [], "position": {} }
```
**Response**
```json
{ "answer": "string" }
```

---

### POST /evaluateSession
Full session evaluation (called at end of interview).

**Request**
```json
{
  "positionId": "string",
  "candidateName": "string",
  "transcript": [],
  "answers": {},
  "challenges": [],
  "cvAnalysis": {},
  "cvText": "string"
}
```
**Response**: Full evaluation JSON (see `spec.md §9`).

---

### POST /biasAudit
Audits an evaluation report for bias markers.

**Request**
```json
{ "report": {} }
```
**Response**
```json
{ "flags": [{ "type": "string", "description": "string", "severity": "string" }] }
```
