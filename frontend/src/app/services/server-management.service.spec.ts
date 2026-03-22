import { TestBed } from '@angular/core/testing';

import { ServerManagementService } from './server-management.service';

describe('ServerManagementService', () => {
  let service: ServerManagementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServerManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
