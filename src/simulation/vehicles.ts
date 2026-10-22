import { SIM_CONFIG, effectiveRatePerApproach } from "./config";
import { Rng } from "./rng";
import type { Direction, Scenario, SignalLightState, Vehicle, VehicleType } from "./types";
import { DIRECTIONS } from "./types";

export interface RemovedVehicle {
  id: number;
  waitTime: number;
  isEmergency: boolean;
}

/**
 * Generates, moves and removes vehicles. Movement is a simple safe-following
 * model: every vehicle keeps at least `gap + headway * speed` distance from
 * the one in front and brakes along a kinematic curve, so queues form
 * naturally and vehicles never pass a red or yellow light.
 */
export class VehicleManager {
  vehicles: Vehicle[] = [];
  totalGenerated = 0;
  /** Every arrival opportunity, counted before any grid-full rejection. */
  arrivalDemand = 0;
  emergencySpawned = 0;
  /** Safety counter: times a vehicle entered the intersection on a non-green light. */
  crossedOnRed = 0;

  private nextId = 1;
  private spawnRng: Rng;
  private varianceRng: Rng;
  private nextSpawnAt: Record<Direction, number>;
  private ratePerMinute: number;
  scenario: Scenario;

  constructor(spawnSeed: number, varianceSeed: number, scenario: Scenario, ratePerMinute: number) {
    this.spawnRng = new Rng(spawnSeed);
    this.varianceRng = new Rng(varianceSeed);
    this.scenario = scenario;
    this.ratePerMinute = ratePerMinute;
    this.nextSpawnAt = { N: 1.2, S: 2.1, E: 0.6, W: 1.6 };
  }

  setScenario(scenario: Scenario): void {
    this.scenario = scenario;
  }

  setRate(ratePerMinute: number): void {
    this.ratePerMinute = ratePerMinute;
  }

  tick(dt: number, time: number, lights: Record<Direction, SignalLightState>): RemovedVehicle[] {
    const removed: RemovedVehicle[] = [];
    const rate = effectiveRatePerApproach(this.ratePerMinute, this.scenario);

    for (const dir of DIRECTIONS) {
      if (time >= this.nextSpawnAt[dir]) {
        this.arrivalDemand++;
        this.nextSpawnAt[dir] = time + this.spawnRng.exponential(rate);
        this.spawn(dir, time);
      }
    }

    for (const dir of DIRECTIONS) {
      const green = lights[dir] === "green";
      const list = this.vehicles.filter((v) => v.dir === dir).sort((a, b) => a.pos - b.pos);
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const ahead = i > 0 ? list[i - 1] : null;
        const inside = v.pos < 0;
        const permitted = green || inside;
        const followGap = v.gap + v.speed * SIM_CONFIG.followTimeHeadway;
        let limit: number;
        if (ahead) {
          limit = ahead.pos + followGap;
        } else {
          limit = permitted ? -SIM_CONFIG.exitLength : 0;
        }
        if (!permitted) limit = Math.max(limit, 0);

        const distance = Math.max(0, v.pos - limit);
        const brakeSpeed = Math.sqrt(2 * SIM_CONFIG.decel * distance);
        const target = Math.min(v.cruise, brakeSpeed);
        if (target < v.speed) {
          v.speed = Math.max(target, v.speed - SIM_CONFIG.decel * dt);
        } else {
          v.speed = Math.min(target, v.speed + SIM_CONFIG.accel * dt);
        }

        const before = v.pos;
        v.pos = Math.max(limit, v.pos - v.speed * dt);
        if (before >= 0 && v.pos < 0 && !green) this.crossedOnRed++;

        v.stopped = v.speed < 2;
        if (v.stopped) v.waitingTime += dt;

        if (v.pos <= -SIM_CONFIG.exitLength) {
          removed.push({ id: v.id, waitTime: v.waitingTime, isEmergency: v.isEmergency });
        }
      }
    }

    if (removed.length > 0) {
      const gone = new Set(removed.map((r) => r.id));
      this.vehicles = this.vehicles.filter((v) => !gone.has(v.id));
    }
    return removed;
  }

  private spawn(dir: Direction, time: number, forceType?: VehicleType, ignoreOccupancy = false): Vehicle | null {
    const spawnPos = SIM_CONFIG.roadLength;
    if (!ignoreOccupancy && this.vehicles.some((v) => v.dir === dir && v.pos > spawnPos - 30)) {
      return null; // grid full — the arrival is rejected
    }
    const isBus =
      forceType === undefined &&
      this.spawnRng.chance(this.scenario === "peak" ? SIM_CONFIG.peakBusProbability : SIM_CONFIG.normalBusProbability);
    const type: VehicleType = forceType ?? (isBus ? "bus" : "car");
    const cruiseBase =
      type === "bus" ? SIM_CONFIG.busCruise : type === "emergency" ? SIM_CONFIG.emergencyCruise : SIM_CONFIG.carCruise;
    const vehicle: Vehicle = {
      id: this.nextId++,
      dir,
      type,
      isEmergency: type === "emergency",
      pos: spawnPos,
      speed: cruiseBase * 0.5,
      cruise: cruiseBase * (0.92 + this.varianceRng.next() * 0.16),
      length: type === "bus" ? SIM_CONFIG.busLength : type === "emergency" ? SIM_CONFIG.emergencyLength : SIM_CONFIG.carLength,
      gap: type === "bus" ? SIM_CONFIG.busGap : type === "emergency" ? SIM_CONFIG.emergencyGap : SIM_CONFIG.carGap,
      waitingTime: 0,
      stopped: false,
      spawnTime: time,
    };
    this.vehicles.push(vehicle);
    this.totalGenerated++;
    return vehicle;
  }

  spawnEmergency(dir: Direction, time: number): Vehicle {
    this.emergencySpawned++;
    return this.spawn(dir, time, "emergency", true)!;
  }
}
