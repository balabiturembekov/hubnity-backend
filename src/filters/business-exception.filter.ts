import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  BusinessException,
  EntityNotFoundException,
  PermissionDeniedException,
  ValidationException,
  DuplicateEntityException,
  InvalidOperationException,
} from "../exceptions/business.exception";

@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: BusinessException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = "INTERNAL_ERROR";

    if (exception instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      errorCode = "NOT_FOUND";
    } else if (exception instanceof PermissionDeniedException) {
      status = HttpStatus.FORBIDDEN;
      errorCode = "FORBIDDEN";
    } else if (exception instanceof ValidationException) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = "VALIDATION_ERROR";
    } else if (exception instanceof DuplicateEntityException) {
      status = HttpStatus.CONFLICT;
      errorCode = "DUPLICATE";
    } else if (exception instanceof InvalidOperationException) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = "INVALID_OPERATION";
    }

    response.status(status).json({
      statusCode: status,
      error: errorCode,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
