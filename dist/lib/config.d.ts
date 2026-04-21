export interface PaConfig {
    serverUrl: string;
    apiKey: string;
}
export declare function loadConfig(configDir?: string): PaConfig;
export declare function saveConfig(config: PaConfig, configDir?: string): void;
export declare function setConfigValue(key: string, value: string, configDir?: string): void;
export declare function maskApiKey(key: string): string;
