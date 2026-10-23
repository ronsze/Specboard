import { config } from "dotenv";

config({ path: ".env" });
process.env.DATABASE_URL = "postgresql://specboard:specboard@localhost:5433/specboard_test";
process.env.SPEC_RETRY_BASE_MS = "0";
process.env.SPEC_WRITER = "fake";
