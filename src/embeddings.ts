import OpenAI from "openai";
import { env } from "./env";
import { logger } from "./logger";

export interface DocumentWithEmbedding {
  id: string;
  content: string;
  embedding: number[];
}

export interface SimilarityResult {
  id: string;
  content: string;
  similarity: number;
}

export class EmbeddingsService {
  private readonly openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  private readonly model = "text-embedding-3-small";

  async createEmbedding(text: string): Promise<number[]> {
    logger.debug({ textLength: text.length }, "Creating embedding");

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) throw new Error("No embedding returned from OpenAI");

    logger.debug({ embeddingDimension: embedding.length }, "Embedding created");
    return embedding;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Vectors must have the same length");

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  findMostSimilar(queryEmbedding: number[], documents: DocumentWithEmbedding[], topK = 5): SimilarityResult[] {
    const results = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }
}

export const embeddingsService = new EmbeddingsService();
