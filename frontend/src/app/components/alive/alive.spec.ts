import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Alive } from './alive';

describe('Alive', () => {
  let component: Alive;
  let fixture: ComponentFixture<Alive>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alive]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Alive);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
