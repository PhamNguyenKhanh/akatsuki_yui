import { config as loadDotenv } from "dotenv";
import { applyIsolatedTestDatabaseEnv } from "../lib/test-db-isolation";

export default async function globalSetup() {
  loadDotenv({ quiet: true });
  applyIsolatedTestDatabaseEnv(process.env);
}
