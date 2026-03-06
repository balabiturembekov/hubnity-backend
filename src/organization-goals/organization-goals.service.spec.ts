import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationGoalsService } from './organization-goals.service';

describe('OrganizationGoalsService', () => {
  let service: OrganizationGoalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationGoalsService],
    }).compile();

    service = module.get<OrganizationGoalsService>(OrganizationGoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
