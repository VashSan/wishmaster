import { ISpotifyConfig, IFileSystem, Seconds } from "../../shared";
import { mock, MockProxy } from "jest-mock-extended";
import { SpotifyAuth, IUpdateableAccessToken, ITokenAndExpiry, AccessToken, IWebAuth } from "./SpotifyAuth";
import { mocked } from "ts-jest/utils";

jest.mock("express");
import express = require("express");

jest.mock("open");
import open = require("open");

jest.mock("request");
import request = require("request");
import ts = require("typescript");

describe('AccessToken', () => {
    let token: MockProxy<ITokenAndExpiry> & ITokenAndExpiry;
    let auth: MockProxy<IWebAuth> & IWebAuth;
    let accessToken: AccessToken;

    beforeEach(() => {
        token = mock<ITokenAndExpiry>();
        token.token = "token"
        auth = mock<IWebAuth>();
        accessToken = new AccessToken(token, auth, new Seconds(1));
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

    beforeEach(() => {
        tokenMock = mock<IUpdateableAccessToken>();
        config = mock<ISpotifyConfig>();
        fs = mock<IFileSystem>();
        fs.exists.mockReturnValue(true);
        fs.readAll.mockReturnValue(token);

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
        expect(() => new SpotifyAuth(config, "", fs, expressMock, tokenMock)).not.toThrow();
    });

    test('authenticate with token', (done) => {
        let auth = new SpotifyAuth(config, "", fs, expressMock, tokenMock);
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
        let auth = new SpotifyAuth(config, "", fs, expressMock, tokenMock);
        auth.authenticate(() => { });
    });
});
