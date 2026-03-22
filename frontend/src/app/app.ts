import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PkToastr } from './shares/pk-toastr';
import { PkAlert } from './shares/pk-alert';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PkToastr, PkAlert],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('frontend');
}
