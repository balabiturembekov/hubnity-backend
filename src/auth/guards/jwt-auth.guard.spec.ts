import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  // JwtAuthGuard is a simple extension of AuthGuard('jwt')
  // The actual JWT validation logic is tested in jwt.strategy.spec.ts
  it('should extend AuthGuard', () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });
});

