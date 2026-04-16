import fs from "node:fs";
import path from "node:path";

export interface ApiClientOptions {
  serverUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class PaApiClient {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: ApiClientOptions) {
    this.serverUrl = options.serverUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private buildUrl(apiPath: string): string {
    return `${this.serverUrl}${apiPath}`;
  }

  private async handleResponse(response: Response): Promise<void> {
    if (response.ok) return;

    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "";
    }

    switch (response.status) {
      case 401:
        throw new ApiError(
          'Authentication failed. Run "pa config set apiKey <key>" to configure.',
          401,
        );
      case 403:
        throw new ApiError("Permission denied.", 403);
      case 404:
        throw new ApiError(
          `Resource not found. ${extractErrorMessage(body)}`,
          404,
        );
      case 409:
        throw new ApiError(
          `Resource already exists. Use --overwrite to replace. ${extractErrorMessage(body)}`,
          409,
        );
      default:
        throw new ApiError(
          `Server error (${response.status}). ${extractErrorMessage(body)}`,
          response.status,
        );
    }
  }

  async getJson<T = unknown>(apiPath: string): Promise<T> {
    try {
      const response = await this.fetchFn(this.buildUrl(apiPath), {
        method: "GET",
        headers: this.headers(),
      });
      await this.handleResponse(response);
      return (await response.json()) as T;
    } catch (err) {
      throw wrapNetworkError(err, this.serverUrl);
    }
  }

  async delete(apiPath: string): Promise<void> {
    try {
      const response = await this.fetchFn(this.buildUrl(apiPath), {
        method: "DELETE",
        headers: this.headers(),
      });
      await this.handleResponse(response);
    } catch (err) {
      throw wrapNetworkError(err, this.serverUrl);
    }
  }

  async postMultipart<T = unknown>(
    apiPath: string,
    formData: FormData,
  ): Promise<T> {
    try {
      const response = await this.fetchFn(this.buildUrl(apiPath), {
        method: "POST",
        headers: this.headers(),
        body: formData,
      });
      await this.handleResponse(response);
      return (await response.json()) as T;
    } catch (err) {
      throw wrapNetworkError(err, this.serverUrl);
    }
  }

  async downloadFile(apiPath: string, outputPath: string): Promise<void> {
    try {
      const response = await this.fetchFn(this.buildUrl(apiPath), {
        method: "GET",
        headers: this.headers(),
      });
      await this.handleResponse(response);

      const arrayBuffer = await response.arrayBuffer();
      const dir = path.dirname(outputPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    } catch (err) {
      throw wrapNetworkError(err, this.serverUrl);
    }
  }
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return "";
}

function wrapNetworkError(err: unknown, serverUrl: string): Error {
  if (err instanceof ApiError) return err;
  if (err instanceof TypeError && err.message === "fetch failed") {
    return new ApiError(
      `Cannot connect to server at ${serverUrl}. Run "pa config set serverUrl <url>" to configure.`,
      0,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}
