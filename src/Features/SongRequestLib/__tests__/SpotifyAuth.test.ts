import { ISpotifyConfig, IFileSystem, Seconds } from "../../../shared";
import { mock, MockProxy } from "jest-mock-extended";
import { SpotifyAuth, IUpdateableAccessToken, ITokenAndExpiry, AccessToken, IWebAuth } from "../SpotifyAuth";
import { mocked } from "ts-jest/utils";

jest.mock("express");
import express = require("express");

jest.mock("open");
import open = require("open");

jest.mock("request");
import request = require("request");
import { ILogger } from "psst-log";
import { IApiWrapper } from "../../SongRequest";

describe('AccessToken', () => {
    let token: MockProxy<ITokenAndExpiry> & ITokenAndExpiry;
    let auth: MockProxy<IWebAuth> & IWebAuth;
    let accessToken: AccessToken;

    beforeEach(() => {
        const api = mock<IApiWrapper>();
        token = mock<ITokenAndExpiry>();
        token.token = "token"
        auth = mock<IWebAuth>();
        accessToken = new AccessToken(token, auth, api, new Seconds(1));
    });

    afterEach(() => {
        accessToken.stopRefresh();
    });

    test('toString', () => {
        // Arrange

        // Act
        const actualToken = accessToken.toString();

        // Assert
        expect(actualToken).toBe("token");
    });

    test('setRefreshedToken', (done) => {
        // Arrange
        const t3 = mock<ITokenAndExpiry>();
        t3.expires = mock<Date>();
        t3.expires.getTime.mockReturnValue(Date.now() + new Seconds(0.2).inMilliseconds());
        t3.token = "token3";

        auth.refreshAccessToken.mockResolvedValue(t3);

        // Act
        const t2 = mock<ITokenAndExpiry>();
        t2.expires = mock<Date>();
        t2.token = "token2";
        accessToken.setRefreshedToken(t2);

        // Assert
        expect(accessToken.toString()).toBe("token2");
        setTimeout(() => {
            expect(accessToken.toString()).toBe("token3");
            done();
        }, new Seconds(0.15).inMilliseconds());
    });

});

describe('SpotifyAuth', () => {

    const token = "::token::";
    //let Express = mocked(express, true);
    let Open = mocked(open, true);
    let Request = mocked(request, true);

    let api: MockProxy<IApiWrapper> & IApiWrapper;
    let logger: MockProxy<ILogger> & ILogger;
    let config: MockProxy<ISpotifyConfig> & ISpotifyConfig;
    let fs: MockProxy<IFileSystem> & IFileSystem;
    let tokenMock: MockProxy<IUpdateableAccessToken> & IUpdateableAccessToken;

    const expressMock = {
        use: jest.fn().mockReturnThis(),
        get: jest.fn(),
        listen: jest.fn((port, handler) => {
            if (handler) {
                handler();
            }
        })
    } as any as express.Application;

    function createSpotifyAuth(): SpotifyAuth {
        return new SpotifyAuth(config, "", api, fs, expressMock, tokenMock, logger);
    }

    beforeEach(() => {
        api = mock<IApiWrapper>();
        tokenMock = mock<IUpdateableAccessToken>();
        config = mock<ISpotifyConfig>();
        fs = mock<IFileSystem>();
        fs.exists.mockReturnValue(true);
        fs.readAll.mockReturnValue(token);

        Request.post.mockReset();
        Request.post.mockImplementation((options, handler) => {
            let response = mock<request.Response>();
            response.statusCode = 200;
            if (handler) {
                handler(undefined, response, { access_token: "access_token" });
            }
            return mock<request.Request>();
        });
    });

    test('construction', () => {
        expect(() => createSpotifyAuth()).not.toThrow();
    });

    test('authenticate with token', (done) => {
        let auth = createSpotifyAuth();
        auth.authenticate(() => {
            // Assert
            expect(Open).toBeCalledTimes(0);
            done();
        });
    });

    test('authenticate without token', (done) => {
        config.authProtocol = "http";
        config.authPort = 666;
        config.authHost = "local.test";

        Open.mockImplementation((url) => {
            expect(url).toBe("http://local.test:666");
            done();
            return new Promise((resolve) => { resolve() });
        });

        fs.exists.mockReturnValue(false);
        let auth = createSpotifyAuth();
        auth.authenticate(() => { });
    });

    test('get /login', (done) => {
        const response = {
            cookie: jest.fn(),
            redirect: jest.fn()
        };

        expressMock.get = jest.fn().mockImplementation((redirect, callback) => {
            if (redirect == "/login") {
                callback(undefined, response);
            }
        });

        config.scopes = [];

        let auth = createSpotifyAuth();
        auth.authenticate(() => { });

        setTimeout(() => {
            expect(response.cookie).toHaveBeenCalledTimes(1);
            expect(response.redirect).toHaveBeenCalledTimes(1);
            done();
        }, new Seconds(0.1).inMilliseconds());
    });

    test('get /callback', (done) => {
        const request = {
            query: { code: "code", state: "state" },
            cookies: { spotify_auth_state: "state" }
        };

        const response = {
            //cookie: jest.fn(),
            redirect: jest.fn(),
            clearCookie: jest.fn()
        };

        expressMock.get = jest.fn().mockImplementation((redirect, callback) => {
            if (redirect == "/callback") {
                callback(request, response);
            }
        });

        config.scopes = [];

        let auth = createSpotifyAuth();
        auth.authenticate(() => { });

        setTimeout(() => {
            expect(response.clearCookie).toHaveBeenCalledTimes(1);
            expect(Request.post).toHaveBeenCalledTimes(2);
            done();
        }, new Seconds(0.1).inMilliseconds());
    });

    test('get /refresh', (done) => {
        const request = {
            query: { refresh_token: "refreshToken" },
        };

        const response = {
            send: jest.fn(),
            redirect: jest.fn()
        };

        expressMock.get = jest.fn().mockImplementation((redirect, callback) => {
            if (redirect == "/refresh_token") {
                callback(request, response);
            }
        });

        config.scopes = [];

        let auth = createSpotifyAuth();
        auth.authenticate(() => { });

        setTimeout(() => {
            expect(response.send).toHaveBeenCalledTimes(1);
            expect(response.redirect).toHaveBeenCalledTimes(0);
            done();
        }, new Seconds(0.1).inMilliseconds());
    });
});
