import { env } from "env";
import { WiseApi } from "./wise-api";

export const wise = new WiseApi(env.WISE_API_TOKEN, env.WISE_PRIVATE_KEY);
export type { WiseBalance, WiseProfile, WiseRate, WiseTransaction, WiseTransfer } from "./wise-api";
