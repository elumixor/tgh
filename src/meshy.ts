import { env } from "./env";

const MESHY_API_BASE = "https://api.meshy.ai";

export interface MeshyTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
    mtl?: string;
    pre_remeshed_glb?: string;
  };
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  thumbnail_url?: string;
  created_at: number;
  started_at?: number;
  finished_at?: number;
  error?: string;
}

export interface CreateImageTo3DParams {
  image_url: string;
  enable_pbr?: boolean;
  should_remesh?: boolean;
  should_texture?: boolean;
  target_polycount?: number;
  topology?: "quad" | "triangle";
  ai_model?: "meshy-4" | "meshy-5" | "latest";
}

export class MeshyClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    if (!apiKey && !env.MESHY_API_KEY) {
      throw new Error("MESHY_API_KEY is required");
    }
    this.apiKey = apiKey || env.MESHY_API_KEY;
  }

  async createImageTo3D(params: CreateImageTo3DParams): Promise<string> {
    const response = await fetch(`${MESHY_API_BASE}/openapi/v1/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        enable_pbr: params.enable_pbr ?? true,
        topology: params.topology ?? "triangle",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meshy API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { result: string };
    return data.result;
  }

  async getTask(taskId: string): Promise<MeshyTask> {
    const response = await fetch(`${MESHY_API_BASE}/openapi/v1/image-to-3d/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meshy API error: ${response.status} ${error}`);
    }

    return (await response.json()) as MeshyTask;
  }

  async pollTask(taskId: string, onProgress?: (task: MeshyTask) => void): Promise<MeshyTask> {
    while (true) {
      const task = await this.getTask(taskId);

      if (onProgress) {
        onProgress(task);
      }

      if (task.status === "SUCCEEDED" || task.status === "FAILED" || task.status === "CANCELED") {
        return task;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  async downloadFile(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
