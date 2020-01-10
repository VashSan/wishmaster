export interface IEmailAccess {
    address: string;
    host: string;
    port: number;
    tls: boolean;
    login: string;
    password: string;
}

export interface IStaticAnswer {
    trigger: string;
    answer: string;
}

export interface IStomtConfig {
    applicationId: string;
    baseUrl: string;
}

export interface ISongRequestConfig {
    spotify: ISpotifyConfig;
}

export interface ISpotifyConfig {
    listenPort: number;
    secretKey: string;
    clientId: string;
    scopes: string[];
    redirectUri: string;
}


