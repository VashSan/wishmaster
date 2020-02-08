import * as express from "express";
import * as request from "request";
import * as cookieParser from "cookie-parser";
import * as querystring from "querystring";
import { ILogger, LogManager } from "psst-log";

import { IContext, IMessage, ISpotifyConfig } from "../shared";
import { FeatureBase } from "./FeatureBase";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

class SpotifyState {
    accessToken: string = "";
    refreshToken: string = "";
}

/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest {
    private readonly spotifyConfig: ISpotifyConfig;
    private readonly spotify: SpotifyState = new SpotifyState();
    private readonly logger: ILogger;
    private readonly app: express.Express;

    private isConnected: boolean = false;

    private get isSpotifyEnabled(): boolean {
        return this.spotifyConfig.listenPort > 0
            && this.spotifyConfig.clientId != ""
            && this.spotifyConfig.redirectUri != ""
            && this.spotifyConfig.scopes.length > 0
            && this.spotifyConfig.secretKey != "";
    }

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());

        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.spotifyConfig = {
            listenPort: 0,
            secretKey: "",
            clientId: "",
            scopes: [],
            redirectUri: ""
        };

        this.app = express();
        let songRequestConfig = this.config.getSongRequest();
        if (songRequestConfig != null) {
            this.spotifyConfig = songRequestConfig.spotify;
        }
    }

    public connect(): void {
        if (!this.isConnected && this.isSpotifyEnabled) {
            this.initServer();
        }
    }

    /** Enqueue the requested song to the playlist */
    public act(msg: IMessage): void {
        if (!this.isSpotifyEnabled) {
            return;
        }

        let response = this.createResponse('SongRequest Loopback' + msg.toString());
        this.sendResponse(response);
    }

    private initServer() {
        var that: SongRequest = this;
        let clientAndSecret = this.spotifyConfig.clientId + ':' + this.spotifyConfig.secretKey;
        var stateKey = 'spotify_auth_state';

        this.app.use(express.static('./public'))
            .use(cookieParser());

        this.app.get('/login', function (req, res) {

            var state = that.generateRandomString(16);
            res.cookie(stateKey, state);

            // your application requests authorization
            var scope = that.spotifyConfig.scopes.join(" ");
            res.redirect('https://accounts.spotify.com/authorize?' +
                querystring.stringify({
                    response_type: 'code',
                    client_id: that.spotifyConfig.clientId,
                    scope: scope,
                    redirect_uri: that.spotifyConfig.redirectUri,
                    state: state
                }));
        });

        this.app.get('/callback', function (req, res) {

            // your application requests refresh and access tokens
            // after checking the state parameter

            var code = req.query.code || null;
            var state = req.query.state || null;
            var storedState = req.cookies ? req.cookies[stateKey] : null;

            if (state === null || state !== storedState) {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'state_mismatch'
                    }));
            } else {
                res.clearCookie(stateKey);
                var authOptions = {
                    url: 'https://accounts.spotify.com/api/token',
                    form: {
                        code: code,
                        redirect_uri: that.spotifyConfig.redirectUri,
                        grant_type: 'authorization_code'
                    },
                    headers: {
                        'Authorization': 'Basic ' + (new Buffer(clientAndSecret).toString('base64'))
                    },
                    json: true
                };

                request.post(authOptions, function (error, response, body) {
                    if (!error && response.statusCode === 200) {

                        that.spotify.accessToken = body.access_token;
                        that.spotify.refreshToken = body.refresh_token;

                        var options = {
                            url: 'https://api.spotify.com/v1/me',
                            headers: { 'Authorization': 'Bearer ' + that.spotify.accessToken },
                            json: true
                        };

                        // use the access token to access the Spotify Web API
                        request.get(options, function (error, response, body) {
                            console.log(body);
                        });

                        // we can also pass the token to the browser to make requests from there
                        res.redirect('/#' +
                            querystring.stringify({
                                access_token: that.spotify.accessToken,
                                refresh_token: that.spotify.refreshToken
                            }));
                    } else {
                        res.redirect('/#' +
                            querystring.stringify({
                                error: 'invalid_token'
                            }));
                    }
                });
            }
        });

        this.app.get('/refresh_token', function (req, res) {

            // requesting access token from refresh token
            var refresh_token = req.query.refresh_token;
            var authOptions = {
                url: 'https://accounts.spotify.com/api/token',
                headers: { 'Authorization': 'Basic ' + (new Buffer(clientAndSecret).toString('base64')) },
                form: {
                    grant_type: 'refresh_token',
                    refresh_token: refresh_token
                },
                json: true
            };

            request.post(authOptions, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    that.spotify.accessToken = body.access_token;
                    res.send({
                        'access_token': that.spotify.accessToken
                    });
                }
            });
        });

        this.logger.info(`Songrequest listening on ${this.spotifyConfig.listenPort}`);
        this.app.listen(this.spotifyConfig.listenPort);
        this.isConnected = true;
    }

    /**
     * Generates a random string containing numbers and letters
     * @param  {number} length The length of the string
     * @return {string} The generated string
     */
    private generateRandomString(length: number): string {
        var text = '';
        var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    };
}
