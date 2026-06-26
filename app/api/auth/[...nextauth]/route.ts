import { handlers } from "@/auth";

// Auth.js route handler — runs in the Node runtime (Mongo + bcrypt available).
export const { GET, POST } = handlers;
