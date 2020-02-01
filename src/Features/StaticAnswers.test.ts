
import { mock, MockProxy } from "jest-mock-extended";
import { IContext, IConfiguration } from "../shared";
import { StaticAnswers } from "./StaticAnswers";
import { ILogger } from "psst-log";
import { response } from "express";

let logger: MockProxy<ILogger> & ILogger;
let config: MockProxy<IConfiguration> & IConfiguration;
let context: MockProxy<IContext> & IContext;
const someMessage = { channel: "#c", from: "someguy", text: "!x" };

beforeEach(() => {
    logger = mock<ILogger>();

    config = mock<IConfiguration>();
    config.getStaticAnswers.mockReturnValue([]);

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
});

test('construction with no init', () => {
    expect(() => new StaticAnswers(context, logger)).not.toThrow();
});

test('does not randomly react', () => {
    const impl = new StaticAnswers(context, logger);

    let callbackInvoked = false;
    impl.setup(() => callbackInvoked = true);

    impl.act(someMessage);

    expect(callbackInvoked).toBe(false);
});

test('does react on trigger', () => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "z" }]);

    const impl = new StaticAnswers(context, logger);

    let responseText = "";
    impl.setup((err, response) => { responseText = response.message.text });

    impl.act(someMessage);

    expect(responseText).toBe("z");
});

test('does not send empty response', () => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "" }]);

    const impl = new StaticAnswers(context, logger);

    let callbackInvoked = false;
    impl.setup(() => callbackInvoked = true);

    impl.act(someMessage);

    expect(callbackInvoked).toBe(false);
});