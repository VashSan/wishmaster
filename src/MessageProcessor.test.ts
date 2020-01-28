import { MessageProcessor } from "./MessageProcessor";
import { Context } from "./shared";
import { mock } from "jest-mock-extended";
import { IChatClient } from "./ChatClient";

test('construction', () => {
    let context = mock<Context>();
    let irc = mock<IChatClient>();

    expect(() => new MessageProcessor(context, irc)).not.toThrowError();
});