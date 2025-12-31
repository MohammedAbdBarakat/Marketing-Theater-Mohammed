export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
export const API_MODE = (process.env.NEXT_PUBLIC_API_MODE || (API_BASE ? "remote" : "mock")) as "remote" | "mock";
// export const IS_REMOTE = false; // Forced Mock Mode for Verification
export const IS_REMOTE = API_MODE === "remote" && !!API_BASE;

