# File Transformation APIs Documentation

## Overview
The file transformation APIs provide advanced image processing capabilities with transformation tracking, history, and statistics. These endpoints allow users to perform various image transformations, track their progress, and manage transformation operations.

## Authentication
All endpoints require authentication using a Bearer token.

## Rate Limiting
Transformation endpoints are rate-limited to 50 requests per 15 minutes per IP address.

## Endpoints

### 1. Basic Transform
`GET /v1/transform`

Transform an image with basic operations like resize and format conversion.

#### Query Parameters
- `fileId` (string, required): ID of the file to transform
- `width` (number, optional): Target width in pixels
- `height` (number, optional): Target height in pixels
- `format` (string, optional): Target format (jpeg, png, webp, avif)

#### Example
```bash
GET /v1/transform?fileId=123&width=800&height=600&format=webp
```

### 2. Advanced Image Transform
`POST /v1/transform/image`

Perform advanced image transformations with multiple operations.

#### Request Body
```json
{
  "fileId": "123",
  "operations": [
    {
      "type": "resize",
      "params": {
        "width": 800,
        "height": 600,
        "fit": "cover"
      }
    },
    {
      "type": "rotate",
      "params": {
        "angle": 90
      }
    },
    {
      "type": "grayscale"
    }
  ]
}
```

#### Supported Operations
- `resize`: Resize image
  - Parameters: width, height, fit (cover, contain, fill, inside, outside)
- `rotate`: Rotate image
  - Parameters: angle (degrees)
- `flip`: Flip image vertically
- `flop`: Flip image horizontally
- `grayscale`: Convert to grayscale
- `blur`: Apply Gaussian blur
  - Parameters: sigma (blur strength)

### 3. Transformation History
`GET /v1/transform/history/:fileId`

Get transformation history for a specific file.

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 50)

### 4. Transformation Status
`GET /v1/transform/status/:transformationId`

Check the status of a specific transformation.

### 5. Transformation Statistics
`GET /v1/transform/stats`

Get user's transformation statistics.

#### Response Example
```json
{
  "total": 100,
  "completed": 80,
  "failed": 5,
  "pending": 15,
  "metrics": {
    "totalOriginalSize": 50000000,
    "totalTransformedSize": 30000000,
    "averageDuration": 1500
  }
}
```

## Error Codes
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Missing or invalid token
- `403`: Forbidden - Rate limit exceeded
- `404`: Not Found - File or transformation not found
- `500`: Internal Server Error

## Best Practices
1. Monitor transformation status for long-running operations
2. Use appropriate image formats for different use cases:
   - JPEG: Photos and complex images
   - PNG: Images with transparency
   - WebP: Modern web browsers (better compression)
   - AVIF: Next-gen format with superior compression

3. Consider rate limits when performing bulk operations
4. Use transformation history to track changes and optimize workflows
5. Monitor statistics to optimize resource usage

## Examples

### Basic Image Resize
```bash
curl -X GET \
  'http://api.example.com/v1/transform?fileId=123&width=800&height=600' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Advanced Transformation
```bash
curl -X POST \
  'http://api.example.com/v1/transform/image' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "fileId": "123",
    "operations": [
      {
        "type": "resize",
        "params": {
          "width": 800,
          "height": 600
        }
      },
      {
        "type": "grayscale"
      }
    ]
  }'
```

### Check Transformation Status
```bash
curl -X GET \
  'http://api.example.com/v1/transform/status/transform_123' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```