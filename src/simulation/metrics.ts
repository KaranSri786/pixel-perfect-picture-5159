import type { Direction, MetricsSample } from "./types";

/** Collects per-second performance samples and lifetime totals. */
export class MetricsEngine {
  history: MetricsSample[] = [];
  served = 0;
  totalWaitServed = 0;
  emergencyServedWaits: number[] = [];
  maxQueueSeen = 0;

  private accumulator = 0;
  private static readonly MAX_HISTORY = 1200;

  recordRemoval(waitTime: number, isEmergency: boolean): void {
    this.served++;
    this.totalWaitServed += waitTime;
    if (isEmergency) this.emergencyServedWaits.push(waitTime);
  }

  sample(
    dt: number,
    time: number,
    data: {
      stoppedAvgWait: number;
      queues: Record<Direction, number>;
      totalQueue: number;
      density: number;
      emergencyWaiting: number;
      emergencyAvgWait: number;
    },
  ): void {
    this.accumulator += dt;
    while (this.accumulator >= 1 - 1e-9) {
      this.accumulator -= 1;
      const overallAvgWait = this.served > 0 ? this.totalWaitServed / this.served : data.stoppedAvgWait;
      this.maxQueueSeen = Math.max(this.maxQueueSeen, data.totalQueue);
      const throughput = time > 0 ? this.served / (time / 60) : 0;
      this.history.push({
        t: Math.round(time * 10) / 10,
        served: this.served,
        overallAvgWait,
        throughput,
        maxQueue: this.maxQueueSeen,
        stoppedAvgWait: data.stoppedAvgWait,
        queueN: data.queues.N,
        queueS: data.queues.S,
        queueE: data.queues.E,
        queueW: data.queues.W,
        totalQueue: data.totalQueue,
        density: data.density,
        emergencyWaiting: data.emergencyWaiting,
        emergencyAvgWait: data.emergencyAvgWait,
      });
      if (this.history.length > MetricsEngine.MAX_HISTORY) {
        this.history.splice(0, this.history.length - MetricsEngine.MAX_HISTORY);
      }
    }
  }
}
