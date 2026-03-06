import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationGoalsController } from './organization-goals.controller';
import { OrganizationGoalsService } from './organization-goals.service';

describe('OrganizationGoalsController', () => {
  let controller: OrganizationGoalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationGoalsController],
      providers: [OrganizationGoalsService],
    }).compile();

    controller = module.get<OrganizationGoalsController>(OrganizationGoalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
