import type { DrillholeStatus, SampleStatus } from '@corechain/domain';

import type { Tone } from '@/components/ui/status-pill';

/** The colour a hole's status pill is drawn in. */
export function statusTone(status: DrillholeStatus): Tone {
  switch (status) {
    case 'drilling':
      return 'accent';
    case 'complete':
      return 'warning';
    case 'logged':
      return 'success';
    default:
      return 'neutral';
  }
}

/** "drilling" -> "Drilling". */
export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** The colour a sample's status pill is drawn in. */
export function sampleStatusTone(status: SampleStatus): Tone {
  switch (status) {
    case 'bagged':
      return 'accent';
    case 'dispatched':
      return 'success';
    default:
      return 'neutral';
  }
}
