# API Documentation: POST /v1/files/generate-token

## Description
Generates a temporary token for downloading a file. The token can be used to access the file via the `/v1/files/download` endpoint.

## Endpoint
`POST /v1/files/generate-token`

## Authentication
This endpoint requires authentication. Include a valid JWT in the `Authorization` header.

## Rate Limiting
- **Limit**: 10 requests per minute per IP.
- **Response**: If the limit is exceeded, the server responds with a `429 Too Many Requests` status and the following message:
  ```json
  { "error": "Too many requests, please try again later." }
  ```

## Request Parameters
### Query Parameters
| Name            | Type   | Required | Description                                      |
|-----------------|--------|----------|--------------------------------------------------|
| `responseFormat`| string | No       | Specifies the response format. Possible values: |
|                 |        |          | - `full` (default): Returns token, URL, and expiry timestamp. |
|                 |        |          | - `token`: Returns only the token.              |
|                 |        |          | - `url`: Returns only the download URL.         |

### Body Parameters
| Name      | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| `fileId`  | string | Yes      | The ID of the file for which the token is generated. |
| `expiresIn` | string | No       | Token expiration time (e.g., `5m`, `1h`). Defaults to `5m`. |

## Responses
### Success
#### Status: `200 OK`
- **Response Format**: Depends on the `responseFormat` query parameter.

#### Example (Full Response):
```json
{
  "token": "<JWT_TOKEN>",
  "url": "http://example.com/v1/files/download?token=<JWT_TOKEN>",
  "expiresAt": "2025-09-13T12:00:00.000Z"
}
```

#### Example (Token Only):
```json
{
  "token": "<JWT_TOKEN>"
}
```

#### Example (URL Only):
```json
{
  "url": "http://example.com/v1/files/download?token=<JWT_TOKEN>"
}
```

### Errors
| Status Code | Message                                   | Description                                      |
|-------------|-------------------------------------------|--------------------------------------------------|
| `400`       | `{ "error": "Missing fileId" }`         | The `fileId` parameter is missing.              |
| `404`       | `{ "error": "File not found" }`        | The specified file does not exist.              |
| `403`       | `{ "error": "Forbidden" }`             | The user is not authorized to access the file.  |
| `429`       | `{ "error": "Too many requests, please try again later." }` | Rate limit exceeded. |
| `500`       | `{ "error": "Internal server error" }` | An unexpected error occurred.                   |

## Examples
### Request (Full Response)
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "fileId": "file123", "expiresIn": "10m" }' \
  "http://example.com/v1/files/generate-token?responseFormat=full"
```

### Request (Token Only)
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "fileId": "file123" }' \
  "http://example.com/v1/files/generate-token?responseFormat=token"
```

### Request (URL Only)
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "fileId": "file123" }' \
  "http://example.com/v1/files/generate-token?responseFormat=url"
```
