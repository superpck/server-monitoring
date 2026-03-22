import { ChangeDetectionStrategy, Component, OnInit, VERSION } from '@angular/core';
import config from '../../configs/config';
import { PkIcon } from '../../shares/pk-icon';
import packageJson from '../../../../package.json';

function stripRange(v: string) { return v.replace(/^[\^~>=]+/, ''); }

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
  protected readonly tsVersion = stripRange(packageJson.devDependencies['typescript']);
  protected readonly echartsVersion = stripRange(packageJson.dependencies['echarts']);
  protected readonly ngxEchartsVersion = stripRange(packageJson.dependencies['ngx-echarts']);

  ngOnInit(): void {
  }
}
