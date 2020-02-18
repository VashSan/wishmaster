
import { mock, MockProxy } from "jest-mock-extended";
import { IContext, IConfiguration, Seconds, IMediaPlayer } from "../../shared";
import { StaticAnswers } from "../StaticAnswers";
import { ILogger } from "psst-log";

let logger: MockProxy<ILogger> & ILogger;
let config: MockProxy<IConfiguration> & IConfiguration;
let context: MockProxy<IContext> & IContext;
let mediaPlayer: MockProxy<IMediaPlayer> & IMediaPlayer;

const someMessage = { channel: "#c", from: "someguy", text: "!x" };

beforeEach(() => {
    logger = mock<ILogger>();
    mediaPlayer = mock<IMediaPlayer>();

    config = mock<IConfiguration>();
    config.getStaticAnswers.mockReturnValue([]);
    config.getStaticAnswersGlobalTimeout.mockReturnValue(0);

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getMediaPlayer.mockReturnValue(mediaPlayer);
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

test('respects empty timeout', (done) => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "text" }]);

    const impl = new StaticAnswers(context, logger);

    let callbackInvokedTimes = 0;
    impl.setup(() => callbackInvokedTimes += 1);

    impl.act(someMessage);
    impl.act(someMessage);
    impl.act(someMessage);

    setTimeout(() => {
        expect(callbackInvokedTimes).toBe(3);
        done();
    }, new Seconds(0.1).inMilliseconds());

});

test('respects global timeout', (done) => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "text" }]);

    const impl = new StaticAnswers(context, logger);

    let callbackInvokedTimes = 0;
    impl.setup(() => callbackInvokedTimes += 1);

    impl.act(someMessage);
    impl.act(someMessage);
    impl.act(someMessage);

    setTimeout(() => {
        expect(callbackInvokedTimes).toBe(3);
        done();
    }, new Seconds(0.1).inMilliseconds());

});

test('respects timeout', (done) => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "text" }]);
    config.getStaticAnswersGlobalTimeout.mockReturnValue(0.2);

    const impl = new StaticAnswers(context, logger);

    let callbackInvokedTimes = 0;
    impl.setup(() => callbackInvokedTimes += 1);

    impl.act(someMessage);
    impl.act(someMessage);

    setTimeout(() => {
        impl.act(someMessage);
        expect(callbackInvokedTimes).toBe(2);
        done();
    }, new Seconds(0.3).inMilliseconds());
});

test('sound', () => {
    config.getStaticAnswers.mockReturnValue([{ trigger: "!x", "answer": "", soundFile: "x" }]);

    const impl = new StaticAnswers(context, logger);

    impl.act(someMessage);

    expect(mediaPlayer.playAudio).toBeCalledWith("x");
});