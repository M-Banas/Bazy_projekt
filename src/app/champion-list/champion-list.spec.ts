import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionList } from './champion-list';

describe('ChampionList', () => {
  let component: ChampionList;
  let fixture: ComponentFixture<ChampionList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
