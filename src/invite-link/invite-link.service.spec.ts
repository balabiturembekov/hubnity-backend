import { Test, TestingModule } from '@nestjs/testing';
import { InviteLinkService } from './invite-link.service';

describe('InviteLinkService', () => {
  let service: InviteLinkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InviteLinkService],
    }).compile();

    service = module.get<InviteLinkService>(InviteLinkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
