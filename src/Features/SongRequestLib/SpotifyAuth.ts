import * as request from "request";
import * as cookieParser from "cookie-parser";
import * as querystring from "querystring";
import * as express from "express";
import * as open from "open";
import { ISpotifyConfig, Generate, IFileSystem, Seconds } from "../../shared";

export interface IWebAuth {
    /**
     * Open the authentication 'app'
     */
    authenticate(authCallback: () => void): void;

    /**
     * Get a valid token to authenticate the app against.
     */
    getAccessToken(): IAccessToken;

    /**
     * Force a refresh of the token
     */
    refreshAccessToken(token?: string): Promise<ITokenAndExpiry>;
}

export interface IAccessToken {
    toString(): string;
}

export interface IUpdateableAccessToken extends IAccessToken {
    setRefreshedToken(tokenObj: ITokenAndExpiry): void;
}

interface ITokenAndExpiry {
    token: string;
    expires: Date;
}

class AccessToken implements IUpdateableAccessToken {
    private expiryThreshold: Seconds = new Seconds(60);
    private token: string;
    private expires: Date;
    private auth: IWebAuth;
    private refreshTimeout: NodeJS.Timer | undefined;

    constructor(tokenObj: ITokenAndExpiry, auth: IWebAuth, expiryThreshold?: Seconds) {
        this.token = tokenObj.token;
        this.expires = this.getExpiryDate(tokenObj.expires);
        this.auth = auth;
        if (expiryThreshold) {
            this.expiryThreshold = expiryThreshold;
        }
    }

    public setRefreshedToken(tokenObj: ITokenAndExpiry): void {
        this.clearUpdateTimer();
        this.token = tokenObj.token;
        this.expires = this.getExpiryDate(tokenObj.expires);
        this.setUpdateTimer();
    }

    private setUpdateTimer() {
        const alertTime = this.expires.getTime() - this.expiryThreshold.inMilliseconds();

        const now = Date.now();
        let timeout = alertTime - now;
        if (alertTime < now) {
            timeout = 0;
        }

        this.refreshTimeout = setTimeout(() => {
            this.auth.refreshAccessToken().then((token: ITokenAndExpiry) => {
                this.setRefreshedToken(token);
            });
        }, timeout);
    }

    private clearUpdateTimer() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
    }

    private getExpiryDate(expires: Date | undefined): Date {
        if (expires) {
            return expires;
        }
        let expiresIn = Date.now() + this.expiryThreshold.inMilliseconds();
        return new Date(expiresIn);
    }

    public toString = (): string => {
        return this.token;
    }
}

export class SpotifyAuth implements IWebAuth {
    private readonly stateKey = 'spotify_auth_state';

    private readonly refresh = "refresh_token";
    private readonly redirect = "callback";
    private readonly login = "login";

    private readonly app: express.Application;
    private readonly config: ISpotifyConfig;
    private readonly fs: IFileSystem;
    private readonly tokenFile: string;

    private accessToken: IUpdateableAccessToken;

    private refreshToken: string = "";

    private isStarting: boolean = false;
    private onAuthentication: (() => void) | null = null;


    constructor(config: ISpotifyConfig, tokenFile: string, fs: IFileSystem, ex?: express.Application, token?: IUpdateableAccessToken) {
        this.config = config;
        this.tokenFile = tokenFile; this.app = express();
        this.fs = fs;

        if (token) {
            this.accessToken = token;
        } else {
            this.accessToken = new AccessToken({ token: "", expires: new Date() }, this);
        }

        if (ex) {
            this.app = ex;
        } else {
            this.app = express();
        }
    }

    public authenticate(onAuthentication: () => void) {
        this.onAuthentication = onAuthentication;

        this.startServer()
            .then(() => {
                if (this.fs.exists(this.tokenFile)) {
                    // We have an access token already? 
                    // Then Use it without forcing to open the browser
                    this.refreshToken = this.fs.readAll(this.tokenFile);
                    this.refreshAccessToken(this.refreshToken).then((newToken) => {
                        this.accessToken.setRefreshedToken(newToken);
                        onAuthentication();
                    });
                } else {
                    // Else the user needs to log on to spotify once
                    open(this.getBaseUrl());
                }
            })
            .catch(() => {
                this.isStarting = false;
            });
    }

    public getAccessToken(): IAccessToken {
        return this.accessToken;
    }

    private getBaseUrl() {
        const c = this.config;
        const url = `${c.authProtocol}://${c.authHost}:${c.authPort}`;
        return url;
    }

    private getRedirectUrl() {
        return `${this.getBaseUrl()}/${this.redirect}`;
    }

    private startServer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.isStarting) {
                reject("Call me once only");
                return;
            }
            this.isStarting = true;
            this.initHttpServer();
            this.defineLoginRedirect();
            this.defineCallbackAddress();
            this.defineRefreshToken();

            this.app.listen(this.config.authPort, (args) => {
                resolve();
            });
        });
    }

    private persistRefreshToken() {
        this.fs.writeAll(this.tokenFile, this.refreshToken);
    }

    private getEncodedClientIdAndKey(): string {
        const merged = this.config.clientId + ':' + this.config.secretKey;
        const encoded = Generate.Base64(merged);
        return encoded;
    }

    /** configures the app instance */
    private initHttpServer() {
        this.app
            .use(express.static('./public/spotifyauth'))
            .use(cookieParser());
    }

    /** requests authorization from spotify */
    private defineLoginRedirect() {
        this.app.get('/' + this.login, (req, res) => {
            var state = Generate.RandomString(16);
            res.cookie(this.stateKey, state);

            var scope = this.config.scopes.join(" ");
            res.redirect('https://accounts.spotify.com/authorize?' +
                querystring.stringify({
                    response_type: 'code',
                    client_id: this.config.clientId,
                    scope: scope,
                    redirect_uri: this.getRedirectUrl(),
                    state: state
                }));
        });
    }

    /** The callback address for spotify */
    private defineCallbackAddress() {
        this.app.get('/' + this.redirect, (req, res) => {
            // your application requests refresh and access tokens
            // after checking the state parameter
            var code = req.query.code || null;
            var state = req.query.state || null;
            var storedState = req.cookies ? req.cookies[this.stateKey] : null;
            if (state === null || state !== storedState) {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'state_mismatch'
                    }));
            } else {
                res.clearCookie(this.stateKey);
                var authOptions = {
                    url: 'https://accounts.spotify.com/api/token',
                    form: {
                        code: code,
                        redirect_uri: this.getRedirectUrl(),
                        grant_type: 'authorization_code'
                    },
                    headers: {
                        'Authorization': 'Basic ' + this.getEncodedClientIdAndKey()
                    },
                    json: true
                };
                request.post(authOptions, (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                        this.refreshToken = body.refresh_token;
                        this.persistRefreshToken();

                        let newToken = this.createTokenAndExpiry(body.access_token, body.expires_in);
                        this.accessToken.setRefreshedToken(newToken);

                        if (this.onAuthentication != null) {
                            this.onAuthentication();
                        }
                        // var options = {
                        //     url: 'https://api.spotify.com/v1/me',
                        //     headers: { 'Authorization': 'Bearer ' + this.accessToken },
                        //     json: true
                        // };
                        // // use the access token to access the Spotify Web API
                        // request.get(options, function (error, response, body) {
                        //     console.log(body);
                        // });
                        // we can also pass the token to the browser to make requests from there
                        res.redirect('/#' +
                            querystring.stringify({
                                access_token: this.accessToken,
                                refresh_token: this.refreshToken
                            }));
                    }
                    else {
                        res.redirect('/#' +
                            querystring.stringify({
                                error: 'invalid_token'
                            }));
                    }
                });
            }
        });
    }

    /** requesting access token from refresh token */
    private defineRefreshToken() {
        this.app.get('/' + this.refresh, (req, res) => {

            var refresh_token = req.query.refresh_token;
            this.refreshAccessToken(refresh_token)
                .then(() => {
                    res.send({
                        'access_token': this.accessToken
                    });
                })
                .catch((reason) => {
                    res.redirect('/#' +
                        querystring.stringify({
                            error: reason
                        }));
                });

        });
    }


    public refreshAccessToken(token?: string): Promise<ITokenAndExpiry> {
        let currentRefreshToken = this.refreshToken;
        if (token) {
            currentRefreshToken = token;
        }

        return new Promise<ITokenAndExpiry>((resolve, reject) => {
            var authOptions = {
                url: 'https://accounts.spotify.com/api/token',
                headers: { 'Authorization': 'Basic ' + this.getEncodedClientIdAndKey() },
                form: {
                    grant_type: 'refresh_token',
                    refresh_token: currentRefreshToken
                },
                json: true
            };
            request.post(authOptions, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    let newToken = this.createTokenAndExpiry(body.access_token, body.expires_in);
                    resolve(newToken);
                } else {
                    reject(`Status ${response.statusCode}: ${error}`);
                }
            });
        });

    }

    private createTokenAndExpiry(token: string, expiresInSeconds: number): ITokenAndExpiry {
        const expires = new Seconds(expiresInSeconds);
        const absoluteExpiryTime = Date.now() + expires.inMilliseconds();
        const expiryDate = new Date(absoluteExpiryTime);
        let newToken = { token: token, expires: expiryDate };
        return newToken;
    }
}