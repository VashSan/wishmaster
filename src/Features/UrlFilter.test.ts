import { mock } from "jest-mock-extended";
import { UrlFilter } from "./UrlFilter";
import { Context, Configuration } from "../shared";
import { ResponseCallback } from "../MessageProcessor";
import { Tags } from "../ChatClient";
import { ILogger } from "psst-log";

let context = mock<Context>({ config: { urlWhiteList: ["twitch.tv"] } });
let logger = mock<ILogger>();

test('construction', () => {
    expect(() => { new UrlFilter(context) }).not.toThrow();
    expect(() => { new UrlFilter(context, mock<ILogger>()) }).not.toThrow();
});

test('mods are not timed out', () => {
    let filter = new UrlFilter(context, logger);

    let timeoutSent = false;
    let cb: ResponseCallback = (error, response) => {
        timeoutSent = timeoutSent || response.message.text.startsWith("/timeout");
    };
    filter.setup(cb.bind(filter));

    let message = { text: "http://someweirdsite.com", from: "goodguy", channel: "#channel", tags: new Tags("@mod=1") };
    filter.act(message);

    expect(timeoutSent).toBe(false);
});

test('users are timed out', () => {
    let filter = new UrlFilter(context, logger);

    let timeoutSent = false;
    let cb: ResponseCallback = (error, response) => {
        timeoutSent = timeoutSent || response.message.text.startsWith("/timeout");
    };
    filter.setup(cb.bind(filter));

    let message = { text: "http://someweirdsite.com", from: "badguy", channel: "#channel", tags: new Tags("@mod=0") };
    filter.act(message);

    expect(timeoutSent).toBe(true);
});

test('Whitelisted domains are ignored', () => {
    let filter = new UrlFilter(context, logger);

    let timeoutSent = false;
    let cb: ResponseCallback = (error, response) => {
        timeoutSent = timeoutSent || response.message.text.startsWith("/timeout");
    };
    filter.setup(cb.bind(filter));

    let message = { text: "https://twitch.tv/vash1080", from: "badguy", channel: "#channel", tags: new Tags("@mod=0") };
    filter.act(message);

    expect(timeoutSent).toBe(false);
});
