import { MessageProcessor, IFeature, ResponseCallback } from "./MessageProcessor";
import { IContext, IConfiguration } from "./shared";
import { mock, MockProxy } from "jest-mock-extended";
import { IChatClient, IMessage } from "./ChatClient";
import { ILogger } from "psst-log";

describe('MessageProcessor', () => {

    const testChannel = "#test";
    const fromAlice = "alice";
    const fromBob = "bob";

    let context: MockProxy<IContext> & IContext;
    let config: MockProxy<IConfiguration> & IConfiguration;
    let logger: ILogger;
    let irc: MockProxy<IChatClient> & IChatClient;

    beforeEach(() => {
        config = mock<IConfiguration>();
        config.getChannel.mockReturnValue(testChannel);

        context = mock<IContext>();
        context.getConfiguration.mockReturnValue(config);

        logger = mock<ILogger>();
        irc = mock<IChatClient>();
    });

    function createMessageProcessor(): MessageProcessor {
        return new MessageProcessor(context, irc, logger);
    }

    test('construction', () => {
        expect(createMessageProcessor).not.toThrowError();
    });

    test('connect', () => {
        // Arrange
        let mp = createMessageProcessor();
        // Act
        mp.connect();
        // Assert
        expect(irc.connect).toHaveBeenCalledTimes(1);
    });

    describe('feature tests', () => {

        let feature: MockProxy<IFeature> & IFeature;
        let sendMessageToServer: ResponseCallback;
        let newMessageFromServer: (m: IMessage) => void;

        beforeEach(() => {
            irc.onMessage.mockImplementation((cb) => newMessageFromServer = cb);

            feature = mock<IFeature>();
            feature.getTrigger.mockReturnValue("!command");
            feature.setup.mockImplementation((cb) => sendMessageToServer = cb);
        });

        test('registerFeature', () => {
            // Arrange
            let mp = createMessageProcessor();
            // Act
            mp.registerFeature(feature);
            // Assert
            expect(feature.setup).toHaveBeenCalledTimes(1);
            expect(feature.getTrigger).toHaveBeenCalledTimes(1);
        });

        test('registerFeature', () => {
            // Arrange
            let mp = createMessageProcessor();
            // Act
            mp.registerFeature(feature);
            // Assert
            expect(feature.setup).toHaveBeenCalledTimes(1);
            expect(feature.getTrigger).toHaveBeenCalledTimes(1);
        });

        test('message send to server', () => {
            // Arrange
            let mp = createMessageProcessor();
            feature.getTrigger.mockReturnValue("xxx");
            mp.registerFeature(feature);

            // Act
            let response = { channel: testChannel, from: fromBob, text: "test" };
            sendMessageToServer(null, { message: response });

            // Assert
            expect(irc.send).toHaveBeenCalledTimes(1);
            expect(irc.send).toHaveBeenCalledWith(testChannel, "test");
        });

        test('defer too many messages', (done) => {
            // Arrange
            const msgLimit = 2;
            config.getMessageProcessorConfig.mockReturnValue({
                delayIntervalInMilliseconds: 400,
                maxNumberOfResponsesPerDelayInterval: 1,
                responseIntervalInMilliseconds: 200,
                responseLimitPerInterval: msgLimit
            });

            let mp = createMessageProcessor();
            feature.getTrigger.mockReturnValue("xxx");
            mp.registerFeature(feature);

            // Act
            mp.connect(); // to enable timers
            let response = { channel: testChannel, from: fromBob, text: "test" };
            for (let i = 0; i < msgLimit + 1; i++) {
                sendMessageToServer(null, { message: response });
            }

            // Assert
            expect(irc.send).toHaveBeenCalledTimes(msgLimit);
            setTimeout(() => {
                expect(irc.send).toHaveBeenCalledTimes(msgLimit + 1);
                done();
            }, 1000);
        });

        test('act is invoked on correct trigger', () => {
            // Arrange
            let mp = createMessageProcessor();
            feature.getTrigger.mockReturnValue("xxx");
            mp.registerFeature(feature);
            // Act
            let msg = { channel: testChannel, from: fromAlice, text: "!xxx test" };
            newMessageFromServer(msg);
            newMessageFromServer({ channel: testChannel, from: fromAlice, text: "test" });

            // Assert
            expect(feature.act).toHaveBeenCalledTimes(1);
            expect(feature.act).toHaveBeenCalledWith(msg);
        });

        test('act is invoked with universal trigger', () => {
            // Arrange
            let mp = createMessageProcessor();
            feature.getTrigger.mockReturnValue("");
            mp.registerFeature(feature);
            // Act
            let msg = { channel: testChannel, from: fromAlice, text: "!xxx test" };
            newMessageFromServer(msg);
            let msg2 = { channel: testChannel, from: fromAlice, text: "test" };
            newMessageFromServer(msg2);

            // Assert
            expect(feature.act).toHaveBeenCalledTimes(2);
            expect(feature.act).toHaveBeenCalledWith(msg);
            expect(feature.act).toHaveBeenCalledWith(msg2);
        });
    });

});
