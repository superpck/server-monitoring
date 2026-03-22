import { ChangeDetectionStrategy, Component, OnInit, VERSION } from '@angular/core';
import config from '../../configs/config';
import { PkIcon } from '../../shares/pk-icon';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  imports: [PkIcon],
  styleUrl: './about.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About implements OnInit {
  protected readonly appName = config.appName;
  protected readonly version = config.version;
  protected readonly subVersion = config.subVersion;
  protected readonly angularVersion = VERSION.full;

  ngOnInit(): void {
  }
}
