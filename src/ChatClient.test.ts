import * as IRC from "irc";
import { mock } from "jest-mock-extended"
import { TwitchChatClient, IChatClient, IMessage } from "./ChatClient";

interface IWithArgs {
    args: any[];
};

function createIrcMock() {
    return mock<IRC.Client>();
}


function createMockedClient(client: IRC.Client): IChatClient {
    return new TwitchChatClient("server", "loing", "password", client);
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
        messageCallback("me", "#you", "1 2");
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
