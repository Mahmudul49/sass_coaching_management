// Load env for standalone scripts. Next.js loads .env.local automatically at
// runtime, but tsx scripts don't — so we load .env.local first, then .env.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
