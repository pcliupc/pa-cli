export interface ApiClientOptions {
    serverUrl: string;
    apiKey: string;
    fetch?: typeof globalThis.fetch;
}
export declare class ApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
export declare class PaApiClient {
    private readonly serverUrl;
    private readonly apiKey;
    private readonly fetchFn;
    constructor(options: ApiClientOptions);
    private headers;
    private buildUrl;
    private handleResponse;
    getJson<T = unknown>(apiPath: string): Promise<T>;
    delete(apiPath: string): Promise<void>;
    postMultipart<T = unknown>(apiPath: string, formData: FormData): Promise<T>;
    downloadFile(apiPath: string, outputPath: string): Promise<void>;
}
