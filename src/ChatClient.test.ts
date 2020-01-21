import * as IRC from "irc";
import { mock, MockProxy } from "jest-mock-extended"
import { ILogger } from "psst-log";
import { TwitchChatClient, IChatClient, IMessage, Tags, ITaggedMessage, hasTags, Message } from "./ChatClient";

describe('Tags', () => {
    test('construction', () => {
        let testTags = '@test=test;x=1';
        let logger = mock<ILogger>();
        expect(() => new Tags(testTags)).not.toThrow();
        expect(() => new Tags(testTags, logger)).not.toThrow();
    });

    test('construction logs error when no tag string passed', () => {
        let testTags = 'no tag';
        let logger = mock<ILogger>();

        let tags = new Tags(testTags, logger)

        expect(logger.error).toBeCalledTimes(1);
    });
});

describe('TwitchChatClient', () => {
    interface IWithArgs {
        args: any[];
    };

    function createMockedClient(client: IRC.Client, logger?: ILogger): IChatClient {
        return new TwitchChatClient("server", "loing", "password", client, logger || mock<ILogger>());
    }

    function createIrcMock() {
        return mock<IRC.Client>();
    }

    let ircMock: MockProxy<IRC.Client> & IRC.Client;

    const unsetErrorCallback = () => { throw new Error("Unset error callback"); };
    let errorCallback: (arg: IWithArgs) => void = unsetErrorCallback;

    const unsetMessageCallback = () => { throw new Error("Unset message callback"); };
    let messageCallback: (...arg: any[]) => void = unsetMessageCallback;

    const unsetUnhandledMessageCallback = () => { throw new Error("Unset unhandled message callback"); };
    let unhandledMessageCallback: (...arg: any[]) => void = unsetUnhandledMessageCallback;

    beforeEach(() => {
        ircMock = createIrcMock();
        ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
            if (name == "error") { errorCallback = cb; }
            if (name == "message") { messageCallback = cb; }
            if (name == "raw") { unhandledMessageCallback = cb; }
            return ircMock;
        });
    });

    afterEach(() => {
        errorCallback = unsetErrorCallback;
        messageCallback = unsetMessageCallback;
        unhandledMessageCallback = unsetUnhandledMessageCallback;
    });

    test('construction', () => {
        function createDefaultClient(): IChatClient {
            return new TwitchChatClient("server", "loing", "password");
        }
        expect(createDefaultClient).not.toThrow();

        expect(() => createMockedClient(mock<IRC.Client>())).not.toThrow();
    });

    test('connection', () => {
        // Arrange
        let ircMock = createIrcMock();
        let client = createMockedClient(ircMock);

        // Act
        client.connect("#channel");

        // Assert
        expect(ircMock.connect).toBeCalledTimes(1);
    });

    test('send', () => {
        // Arrange
        let ircMock = createIrcMock();
        let client = createMockedClient(ircMock);

        // Act
        client.connect("#channel");
        client.send("#channel", "hi");

        // Assert
        expect(ircMock.say).toBeCalledTimes(1);
        expect(ircMock.send).toBeCalledTimes(0);
    });

    test('send command', () => {
        // Arrange
        let ircMock = createIrcMock();
        let client = createMockedClient(ircMock);

        // Act
        client.connect("#channel");
        client.send("PING", "1", true);

        // Assert
        expect(ircMock.say).toBeCalledTimes(0);
        expect(ircMock.send).toBeCalledTimes(1);
    });

    test('connection callback invoked', () => {
        // Arrange
        let ircMock = createIrcMock();
        ircMock.connect.mockImplementation((retryCount, cb) => {
            if (cb != undefined) cb(null);
        });
        let client = createMockedClient(ircMock);

        // Act
        let onConnectInvoked = false;
        client.onConnect(() => { onConnectInvoked = true });
        client.connect("#channel");

        // Assert
        expect(onConnectInvoked).toBe(true);
    });

    test('error callback set and invoked', () => {
        // Arrange
        ircMock.connect.mockImplementation((retryCount, cb) => {
            errorCallback({ args: ["1", "2"] });
        });
        let client = createMockedClient(ircMock);

        // Act
        let onErrorInvoked = false;
        let errorMessage: string = "";
        client.onError((message: string) => {
            errorMessage = message;
            onErrorInvoked = true
        });
        client.connect("#channel");

        // Assert
        expect(onErrorInvoked).toBe(true);
        expect(errorMessage).toBe("1 2");
    });

    test('whois error is skipped', () => {
        // Arrange
        ircMock.connect.mockImplementation((retryCount, cb) => {
            errorCallback({ args: ["vash1080", "WHOIS", "Unknown command."] });
        });
        let client = createMockedClient(ircMock);

        // Act
        let onErrorInvoked = false;
        let errorMessage: string = "";
        client.onError((message: string) => {
            errorMessage = message;
            onErrorInvoked = true
        });
        client.connect("#channel");

        // Assert
        expect(onErrorInvoked).toBe(false);
        expect(errorMessage).toBe("");
    });

    test('message callback set and invoked', () => {
        // Arrange
        ircMock.connect.mockImplementation((retryCount, cb) => {
            messageCallback("me", "#you", "1 2", null);
        });
        let client = createMockedClient(ircMock);

        // Act
        let onMessageInvoked = false;
        let theMessage: IMessage = { from: "", channel: "", text: "" };
        client.onMessage((message: IMessage) => {
            theMessage = message;
            onMessageInvoked = true;
        });
        client.connect("#channel");

        // Assert
        expect(onMessageInvoked).toBe(true);
        expect(theMessage.text).toBe("1 2");
        expect(theMessage.from).toBe("me");
        expect(theMessage.channel).toBe("#you");
    });

    test('unhandled messages are stored', () => {
        // Arrange
        let rawMessage = { command: "PING", rawCommand: "PING", commandType: "reply", args: ["1", "2"] };
        ircMock.connect.mockImplementation((retryCount, cb) => {
            unhandledMessageCallback(rawMessage);
        });
        let client = createMockedClient(ircMock);

        // Act
        client.connect("#channel");

        // Assert
        let tClient = client as TwitchChatClient;
        expect(tClient).not.toBeNull();
        expect(tClient.unhandledMessages.length).toBe(1);
        expect(tClient.unhandledMessages[0]).toEqual(expect.stringMatching(/[0-9]+ PING: 1 2/));
    });

    test('unhandled messages store is limited', () => {
        // Arrange
        let rawMessage = { command: "PING", rawCommand: "PING", commandType: "reply", args: ["1", "2"] };
        ircMock.connect.mockImplementation((retryCount, cb) => {
            for (let i = 0; i < tClient.maxUnhandledMessages + 1; i++) {
                unhandledMessageCallback(rawMessage);
            }
        });
        let client = createMockedClient(ircMock);
        let tClient = client as TwitchChatClient;

        // Act
        client.connect("#channel");

        // Assert
        expect(tClient).not.toBeNull();
        expect(tClient.unhandledMessages.length).toBe(tClient.minUnhandledMessages);
    });

    test('tagged message parsing', () => {
        let rawMsg = {
            args: ["vash1080!vash1080@vash1080.tmi.twitch.tv PRIVMSG #vash1080 :hi"],
            command: "@badge-info=;badges=broadcaster/1;color=#AF8008;display-name=Vash1080;emotes=;flags=;id=a4631c5e-dfa5-40f0-b877-3fbe9543c27f;mod=0;room-id=87693901;subscriber=0;tmi-sent-ts=1579460682839;turbo=0;user-id=87693901;user-type=",
            rawCommand: "@badge-info=;badges=broadcaster/1;color=#AF8008;display-name=Vash1080;emotes=;flags=;id=a4631c5e-dfa5-40f0-b877-3fbe9543c27f;mod=0;room-id=87693901;subscriber=0;tmi-sent-ts=1579460682839;turbo=0;user-id=87693901;user-type=",
            commandType: "normal"
        };

        ircMock.connect.mockImplementation((retryCount, cb) => {
            unhandledMessageCallback(rawMsg);
        });
        let client = createMockedClient(ircMock);

        // Act
        let onMessageInvoked = false;
        let theMessage: IMessage = { from: "", channel: "", text: "" };
        client.onMessage((message: IMessage) => {
            theMessage = message;
            onMessageInvoked = true;
        });
        client.connect("#vash1080");

        // Assert
        expect(onMessageInvoked).toBe(true);
        expect(theMessage).not.toBeNull();
        expect(theMessage).not.toBeUndefined();
        expect(theMessage.from).toBe('vash1080');
        expect(theMessage.channel).toBe('#vash1080');
        expect(theMessage.text).toBe('hi');

        let taggedMessage = theMessage as ITaggedMessage;
        expect(taggedMessage.tags).not.toBe(null);
        expect(taggedMessage.tags?.get('display-name')).toBe('Vash1080');  
    });

    test('Unhandled command is logged as error', () => {
        // Arrange
        let rawMessage = { command: "XXX", rawCommand: "XXX", commandType: "reply", args: ["1", "2"] };
        ircMock.connect.mockImplementation((retryCount, cb) => {
            unhandledMessageCallback(rawMessage);
        });
        let logger = mock<ILogger>();
        let client = createMockedClient(ircMock, logger);

        // Act
        client.connect("#channel");

        // Assert
        expect(logger.error).toBeCalledTimes(1);
    });

    test('Unknown command is logged as error', () => {
        // Arrange
        let rawMessage = { command: "421", rawCommand: "421", commandType: "reply", args: ["1", "2"] };
        ircMock.connect.mockImplementation((retryCount, cb) => {
            unhandledMessageCallback(rawMessage);
        });
        let logger = mock<ILogger>();
        let client = createMockedClient(ircMock, logger);

        // Act
        client.connect("#channel");

        // Assert
        expect(logger.error).toBeCalledTimes(1);
    });

    test('Message of the day is parsed', () => {
        // Arrange
        let rawMessage1 = { command: "372", rawCommand: "372", commandType: "reply", args: ["This", "is"] };
        let rawMessage2 = { command: "372", rawCommand: "372", commandType: "reply", args: ["a", "message"] };
        ircMock.connect.mockImplementation((retryCount, cb) => {
            unhandledMessageCallback(rawMessage1);
            unhandledMessageCallback(rawMessage2);
        });
        let logger = mock<ILogger>();
        let client = createMockedClient(ircMock, logger);

        // Act
        client.connect("#channel");

        // Assert
        let tClient = client as TwitchChatClient;
        expect(tClient.messageOfTheDay).toBe("This is\na message\n");
    });
});