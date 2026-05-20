import { join } from "node:path";

if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = join(process.cwd(), "data");
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(process.env.DATA_DIR, "whatsarr.db").replace(/\\/g, "/")}`;
}
