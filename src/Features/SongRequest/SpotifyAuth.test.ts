import { ISpotifyConfig, IFileSystem } from "../../shared";
import { mock, MockProxy } from "jest-mock-extended";
import { SpotifyAuth } from "./SpotifyAuth";
import { mocked } from "ts-jest/utils";

jest.mock("express");
import express = require("express");

jest.mock("open");
import open = require("open");

jest.mock("request");
import request = require("request");

const token = "::token::";
//let Express = mocked(express, true);
let Open = mocked(open, true);
let Request = mocked(request, true);

let config: MockProxy<ISpotifyConfig> & ISpotifyConfig;
let fs: MockProxy<IFileSystem> & IFileSystem;

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
    expect(() => new SpotifyAuth(config, "", fs)).not.toThrow();
});

test('authenticate with token', (done) => {
    let auth = new SpotifyAuth(config, "", fs, expressMock);
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
        return new Promise(() => { });
    });

    fs.exists.mockReturnValue(false);
    let auth = new SpotifyAuth(config, "", fs, expressMock);
    auth.authenticate(() => { });
});