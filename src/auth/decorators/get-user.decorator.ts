import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure user is authenticated (should be set by JwtAuthGuard)
    if (!user) {
      throw new UnauthorizedException("User not authenticated");
    }

    return data ? user[data] : user;
  },
);
