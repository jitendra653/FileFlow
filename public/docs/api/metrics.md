# API Documentation: GET /metrics

## Description
The `/metrics` endpoint exposes application performance metrics in a format compatible with Prometheus. These metrics can be used to monitor the application's health, performance, and resource usage.

## Endpoint
`GET /metrics`

## Metrics Exposed
### HTTP Request Durations
- **Metric Name**: `http_request_duration_seconds`
- **Description**: Measures the duration of HTTP requests in seconds.
- **Labels**:
  - `method`: HTTP method (e.g., `GET`, `POST`).
  - `route`: Route path (e.g., `/v1/files/generate-token`).
  - `status_code`: HTTP status code (e.g., `200`, `404`).
- **Buckets**: `[0.1, 0.5, 1, 1.5]` seconds.

### Rate Limiter Metrics
- **Metric Name**: `rate_limiter_throttled_requests_total`
- **Description**: Counts the total number of requests throttled by the rate limiter.

### Default System Metrics
- **Metric Name**: Various (e.g., `process_cpu_seconds_total`, `process_resident_memory_bytes`).
- **Description**: Default metrics collected by Prometheus, such as CPU and memory usage.

## Example Response
```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/metrics",status_code="200",le="0.1"} 5
http_request_duration_seconds_bucket{method="GET",route="/metrics",status_code="200",le="0.5"} 10
...
# HELP rate_limiter_throttled_requests_total Total number of throttled requests
# TYPE rate_limiter_throttled_requests_total counter
rate_limiter_throttled_requests_total 3
...
```

## Usage Example
### Querying the Metrics
```bash
curl -X GET http://example.com/metrics
```

### Integrating with Prometheus
Add the following job to your Prometheus configuration:
```yaml
scrape_configs:
  - job_name: 'my_application'
    static_configs:
      - targets: ['example.com:80']
```

## Notes
- The `/metrics` endpoint is read-only and does not require authentication.
- Ensure the endpoint is accessible only to trusted systems in production environments.
