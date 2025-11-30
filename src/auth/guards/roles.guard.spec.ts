import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    get: jest.fn(),
  };

  const createMockExecutionContext = (user?: any, handler?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: () => handler || (() => {}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no roles are required', () => {
    mockReflector.get.mockReturnValue(undefined);
    const context = createMockExecutionContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if user has required role', () => {
    const requiredRoles = ['OWNER', 'ADMIN'];
    const user = { role: 'OWNER' };

    mockReflector.get.mockReturnValue(requiredRoles);
    const context = createMockExecutionContext(user);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access if user does not have required role', () => {
    const requiredRoles = ['OWNER', 'ADMIN'];
    const user = { role: 'EMPLOYEE' };

    mockReflector.get.mockReturnValue(requiredRoles);
    const context = createMockExecutionContext(user);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should deny access if user is missing', () => {
    const requiredRoles = ['OWNER'];

    mockReflector.get.mockReturnValue(requiredRoles);
    const context = createMockExecutionContext(null);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should deny access if user has no role', () => {
    const requiredRoles = ['OWNER'];
    const user = {};

    mockReflector.get.mockReturnValue(requiredRoles);
    const context = createMockExecutionContext(user);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });
});

