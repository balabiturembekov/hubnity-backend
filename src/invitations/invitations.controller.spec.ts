import { Test, TestingModule } from "@nestjs/testing";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";
import { PrismaService } from "@/prisma/prisma.service";

describe("InvitationsController", () => {
  let controller: InvitationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        InvitationsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<InvitationsController>(InvitationsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
