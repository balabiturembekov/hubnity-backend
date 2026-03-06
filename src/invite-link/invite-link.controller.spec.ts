import { Test, TestingModule } from '@nestjs/testing';
import { InviteLinkController } from './invite-link.controller';
import { InviteLinkService } from './invite-link.service';

describe('InviteLinkController', () => {
  let controller: InviteLinkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InviteLinkController],
      providers: [InviteLinkService],
    }).compile();

    controller = module.get<InviteLinkController>(InviteLinkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
