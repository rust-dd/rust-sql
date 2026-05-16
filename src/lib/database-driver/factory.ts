import type { DriverType } from "@/types";
import type { DatabaseDriver } from "./index";
import { PostgreSQLDriver } from "./pgsql";

export class DriverFactory {
  private static drivers: Map<DriverType, DatabaseDriver> = new Map([
    ["PGSQL", new PostgreSQLDriver()],
  ]);

  static getDriver(driverType: DriverType): DatabaseDriver {
    const driver = this.drivers.get(driverType);
    if (!driver) {
      throw new Error(`Driver ${driverType} not found`);
    }
    return driver;
  }

  static getSupportedDrivers(): DriverType[] {
    return Array.from(this.drivers.keys());
  }
}

export interface DriverConfig {
  name: string;
  defaultPort: string;
}

export const DRIVER_CONFIGS: Record<DriverType, DriverConfig> = {
  PGSQL: { name: "PostgreSQL", defaultPort: "5432" },
};

export type { DriverType };
