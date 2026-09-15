# API Contract Template

**Endpoint**: `POST /endpointName`  
**Worker file**: `worker/src/index.js`  
**Model**: <!-- haiku-3.5 | sonnet-4.5 — set in wrangler.toml, reference by var name -->  
**Auth**: Firebase ID token in `Authorization: Bearer <token>` header (required)

---

## Request

```json
{
  "field1": "string — description",
  "field2": "number — description"
}
```

## Response (200 OK)

```json
{
  "result": "string — description",
  "meta": {}
}
```

## Error Responses

| Status | When |
|--------|------|
| 400 | Missing required fields |
| 401 | Missing or invalid auth token |
| 500 | Worker / LLM error |

---

## Notes

<!-- Any rate-limiting, prompt engineering notes, or side effects (e.g. writes to Firestore) -->
