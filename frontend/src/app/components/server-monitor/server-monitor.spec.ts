import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerMonitor } from './server-monitor';

describe('ServerMonitor', () => {
  let component: ServerMonitor;
  let fixture: ComponentFixture<ServerMonitor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerMonitor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServerMonitor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
