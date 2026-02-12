import { env } from "env";
import { WiseApi } from "./wise-api";

export const wise = new WiseApi(env.WISE_API_TOKEN);
export type { WiseBalance, WiseProfile, WiseRate, WiseTransfer } from "./wise-api";
