import { loadTestEnvFiles, validateTestDatabaseIsolation } from "../lib/test-db-isolation";

export default async function globalSetup() {
  loadTestEnvFiles();
  validateTestDatabaseIsolation(process.env);
}
