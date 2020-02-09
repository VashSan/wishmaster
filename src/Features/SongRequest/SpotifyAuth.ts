import * as request from "request";
import * as cookieParser from "cookie-parser";
import * as querystring from "querystring";
import * as express from "express";
import { ISpotifyConfig, Generate, Hours } from "../../shared";
import * as open from "open";

export interface IWebAuth {
    /**
     * Open the authentication 'app'
     */
    authenticate(): void;

    /**
     * Get a valid token to authenticate the app against.
     */
    getAccessToken(): Promise<string>;
}

export class SpotifyAuth implements IWebAuth {
    private readonly stateKey = 'spotify_auth_state';

    private readonly refresh = "refresh_token";
    private readonly redirect = "callback";
    private readonly login = "login";

    private readonly app: express.Express;
    private readonly config: ISpotifyConfig;

    private accessTokenDate: Date = new Date(0);
    private accessToken: string = "";
    private refreshToken: string = "";


    constructor(config: ISpotifyConfig) {
        this.config = config;
        this.app = express();
        this.startServer();
    }

    public authenticate() {
        open(this.getBaseUrl());
    }

    public getAccessToken(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (this.isTokenExpired()) {
                this.refreshAccessToken(this.refreshToken)
                    .then(() => resolve(this.accessToken))
                    .catch((reason) => reject(reason));
            } else {
                resolve(this.accessToken);
            }
        });
    }

    private isTokenExpired(): boolean {
        return Date.now() >
            this.accessTokenDate.getTime() + new Hours(1).inMilliseconds();
    }

    private getBaseUrl() {
        const c = this.config;
        const url = `${c.authProtocol}://${c.authHost}:${c.authPort}`;
        return url;
    }

    private getRedirectUrl() {
        return `${this.getBaseUrl()}/${this.redirect}`;
    }

    private startServer() {
        this.initHttpServer();

        this.defineLoginRedirect();

        this.defineCallbackAddress();

        this.defineRefreshToken();

        this.app.listen(this.config.authPort);
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
                        this.accessToken = body.access_token;
                        this.refreshToken = body.refresh_token;
                        var options = {
                            url: 'https://api.spotify.com/v1/me',
                            headers: { 'Authorization': 'Bearer ' + this.accessToken },
                            json: true
                        };
                        // use the access token to access the Spotify Web API
                        request.get(options, function (error, response, body) {
                            console.log(body);
                        });
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


    private refreshAccessToken(currentRefreshToken: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
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
                    this.accessToken = body.access_token;
                    resolve();
                } else {
                    reject(`Status ${response.statusCode}: ${error}`);
                }
            });
        });

    }
}