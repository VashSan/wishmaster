import * as IRC from "irc";
import { mock } from "jest-mock-extended"
import { ChatClient, IChatClient } from "./ChatClient";

//jest.mock("irc");

function createIrcMock() {
    return mock<IRC.Client>();
}


function createMockedClient(client: IRC.Client): IChatClient {
    return new ChatClient("server", "loing", "password", client);
}

test('construction', () => {
    function createDefaultClient(): IChatClient {
        return new ChatClient("server", "loing", "password");
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