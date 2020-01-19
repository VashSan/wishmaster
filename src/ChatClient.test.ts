import * as IRC from "irc";
import { mock } from "jest-mock-extended"
import { ILogger } from "psst-log";
import { TwitchChatClient, IChatClient, IMessage } from "./ChatClient";

interface IWithArgs {
    args: any[];
};

function createIrcMock() {
    return mock<IRC.Client>();
}


function createMockedClient(client: IRC.Client): IChatClient {
    return new TwitchChatClient("server", "loing", "password", client, mock<ILogger>());
}

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
    let ircMock = createIrcMock();
    let errorCallback: (arg: IWithArgs) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "error") { errorCallback = cb; }
        return ircMock;
    });
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
    let ircMock = createIrcMock();
    let errorCallback: (arg: IWithArgs) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "error") { errorCallback = cb; }
        return ircMock;
    });
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
});

test('message callback set and invoked', () => {
    // Arrange
    let ircMock = createIrcMock();
    let messageCallback: (...arg: any[]) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "message") { messageCallback = cb; }
        return ircMock;
    });
    ircMock.connect.mockImplementation((retryCount, cb) => {
        messageCallback("me", "#you", "1 2", null);
    });
    let client = createMockedClient(ircMock);

    // Act
    let onMessageInvoked = false;
    let theMessage: IMessage = { from: "", channel: "", text: "", tags: null };
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
    let ircMock = createIrcMock();
    let unhandledMessageCallback: (...arg: any[]) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "raw") { unhandledMessageCallback = cb; }
        return ircMock;
    });
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
    let ircMock = createIrcMock();
    let unhandledMessageCallback: (...arg: any[]) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "raw") { unhandledMessageCallback = cb; }
        return ircMock;
    });
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

    let ircMock = createIrcMock();
    let unhandledMessageCallback: (...arg: any[]) => void;
    ircMock.addListener.mockImplementation((name, cb): IRC.Client => {
        if (name == "raw") { unhandledMessageCallback = cb; }
        return ircMock;
    });
    ircMock.connect.mockImplementation((retryCount, cb) => {
        unhandledMessageCallback(rawMsg);
    });
    let client = createMockedClient(ircMock);

    // Act
    let onMessageInvoked = false;
    let theMessage: IMessage = { from: "", channel: "", text: "", tags: null };
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
    expect(theMessage.tags).not.toBe(null);
    expect(theMessage.tags?.getTagValue('display-name')).toBe('Vash1080');
});