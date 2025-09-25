'use strict';

exports.config = {
  app_name: ['FileFlow Analytics'],
  license_key: 'YOUR_LICENSE_KEY_HERE', // This should be set via environment variable
  logging: {
    level: 'info',
    enabled: true,
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  distributed_tracing: {
    enabled: true
  },
  transaction_tracer: {
    record_sql: 'obfuscated',
    enabled: true,
    transaction_threshold: 'apdex_f'
  },
  slow_sql: {
    enabled: true
  },
  error_collector: {
    enabled: true,
    ignore_status_codes: [404, 401]
  }
};