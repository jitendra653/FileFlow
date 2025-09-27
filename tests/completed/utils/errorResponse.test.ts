import { createErrorResponse, ErrorType } from '../../../src/utils/errorResponse';

describe('Error Response Utility', () => {

  test('should create an error response with only an error message', () => {
    const response = createErrorResponse({
      code: 'GENERIC_ERROR',
      message: 'Some error',
      type: ErrorType.SERVER_ERROR
    });
    expect(response.error.message).toBe('Some error');
    expect(response.error.code).toBe('GENERIC_ERROR');
    expect(response.error.type).toBe(ErrorType.SERVER_ERROR);
  });


  test('should create an error response with an error message and details', () => {
    const response = createErrorResponse({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      type: ErrorType.VALIDATION,
      details: [{ field: 'email', code: 'INVALID_FIELD', message: 'Invalid input' }]
    });
    expect(response.error.message).toBe('Invalid input');
    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.type).toBe(ErrorType.VALIDATION);
    expect(response.error.details?.[0].field).toBe('email');
  });


  test('should create an error response with an error message and no details', () => {
    const response = createErrorResponse({
      code: 'SERVER_ERROR',
      message: 'Unexpected issue',
      type: ErrorType.SERVER_ERROR
    });
    expect(response.error.message).toBe('Unexpected issue');
    expect(response.error.code).toBe('SERVER_ERROR');
    expect(response.error.type).toBe(ErrorType.SERVER_ERROR);
  });
});
