import { createErrorResponse } from '../../src/utils/errorResponse';

describe('Error Response Utility', () => {
  test('should create an error response with only an error message', () => {
    const response = createErrorResponse('Some error');
    expect(response).toEqual({ error: 'Some error' });
  });

  test('should create an error response with an error message and details', () => {
    const response = createErrorResponse('Validation error', 'Invalid input', { field: 'email' });
    expect(response).toEqual({
      error: 'Validation error',
      message: 'Invalid input',
      details: { field: 'email' },
    });
  });

  test('should create an error response with an error message and no details', () => {
    const response = createErrorResponse('Server error', 'Unexpected issue');
    expect(response).toEqual({
      error: 'Server error',
      message: 'Unexpected issue',
    });
  });
});
