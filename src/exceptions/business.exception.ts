// exceptions/business.exception.ts
export abstract class BusinessException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundException extends BusinessException {
  constructor(entity: string, id: string) {
    super(`${entity} with ID ${id} not found`, "ENTITY_NOT_FOUND", 404);
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class PermissionDeniedException extends BusinessException {
  constructor(
    message: string = "You do not have permission to perform this action",
  ) {
    super(message, "PERMISSION_DENIED", 403);
  }
}

export class DuplicateEntityException extends BusinessException {
  constructor(entity: string, field: string, value: string) {
    super(
      `${entity} with ${field} "${value}" already exists`,
      "DUPLICATE_ENTITY",
      409,
    );
  }
}

export class InvalidOperationException extends BusinessException {
  constructor(message: string) {
    super(message, "INVALID_OPERATION", 400);
  }
}
