import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('trả trạng thái dịch vụ ổn định', () => {
    const response = new AppController().health();
    expect(response.success).toBe(true);
    expect(response.data.service).toBe('Titan Gym API');
    expect(response.data.status).toBe('ok');
  });
});
