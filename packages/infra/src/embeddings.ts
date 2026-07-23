import type {
  EmbeddingProvider,
} from "@atlas/domain";

export interface OllamaEmbeddingOptions {
  baseUrl: string;
  model: string;
  dimensions: number;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly baseUrl: string;

  constructor(options: OllamaEmbeddingOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.model = options.model;
    this.dimensions = options.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ollama embed failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as { embeddings?: number[][] };
    if (!data.embeddings || data.embeddings.length !== texts.length) {
      throw new Error("Ollama embed returned unexpected embeddings payload");
    }

    for (const vector of data.embeddings) {
      if (vector.length !== this.dimensions) {
        throw new Error(
          `Embedding dim mismatch: expected ${this.dimensions}, got ${vector.length}`,
        );
      }
    }

    return data.embeddings;
  }

  async ping(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama ping failed (${response.status})`);
    }
    const data = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const names = (data.models ?? []).map((m) => m.name ?? m.model ?? "");
    const wanted = this.model;
    const wantedBase = wanted.split(":")[0];
    const found = names.some((n) => {
      if (n === wanted) return true;
      return n.split(":")[0] === wantedBase;
    });
    if (!found) {
      throw new Error(`Ollama model not found: ${this.model}`);
    }
  }
}
