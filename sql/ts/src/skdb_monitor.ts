// sknpm: Cannot be multiline for package sources
// prettier-ignore
import type { Monitor } from "#skmonitor/sk_monitor_monitor.js";
// prettier-ignore
import type { Collector } from "#skmonitor/sk_monitor.js";

export function build(monitor: Monitor) {
  const tracer = monitor.createTracers([]).create();
  const collectors: Collector[] = [];
  collectors.push(tracer.add);
  // TODO Metrics
  return collectors;
}
