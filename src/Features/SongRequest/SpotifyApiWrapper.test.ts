import { SpotifyApiWrapper } from "./SpotifyApiWrapper";
import { ICanReply } from "../SongRequest";
import { mock, MockProxy } from "jest-mock-extended";
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger } from "psst-log";

let logger: MockProxy<ILogger> & ILogger = mock<ILogger>();
let chat: MockProxy<ICanReply> & ICanReply = mock<ICanReply>();
let api: MockProxy<SpotifyWebApi> & SpotifyWebApi = mock<SpotifyWebApi>();

beforeEach(() => {
    chat = mock<ICanReply>();
    api = mock<SpotifyWebApi>();
    logger = mock<ILogger>();
});

test('construction', () => {

    expect(() => { new SpotifyApiWrapper(chat, api, logger) }).not.toThrow();
});