import { FeatureBase } from "../FeatureBase";
import { Configuration, ITagReader } from "../../shared";
import { mock } from "jest-mock-extended";
import { IFeatureResponse } from "../../shared/MessageProcessor";
import { IMessage } from "../../shared/ChatClient";

class FeatureBaseImpl extends FeatureBase {
    constructor(config: Configuration) {
        super(config);
    }

    public getTrigger(): string {
        throw new Error("Method not implemented.");
    }

    public act(message: IMessage): void {
        throw new Error("Method not implemented.");
    }

    public invokeCreateResponse(text: string): IFeatureResponse {
        return this.createResponse(text);

    }

    public invokeSendResponse(response: IFeatureResponse) {
        this.sendResponse(response);
    }

    public isModOrBroadcaster(tags: ITagReader): boolean {
        return super.isModOrBroadcaster(tags);
    }
}

test('construction', () => {
    let config = mock<Configuration>();
    expect(() => new FeatureBaseImpl(config)).not.toThrow();
});

test('create response', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);

    // Act
    let result = impl.invokeCreateResponse('test');

    // Assert
    expect(result.message.text).toBe('test');
});

test('send response with setup', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);

    // Act
    let result = impl.invokeCreateResponse('test');

    // Assert
    expect(() => impl.invokeSendResponse(result)).not.toThrow();
});

test('send response without setup', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);
    let response = impl.invokeCreateResponse('test');
    let callbackInvoked = false;
    impl.setup(() => callbackInvoked = true);

    // Act
    expect(callbackInvoked).toBe(false);
    impl.invokeSendResponse(response);

    // Assert
    expect(callbackInvoked).toBe(true);
});

test('isModOrBroadcaster User', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);
    let tags = mock<ITagReader>();
    tags.isMod.mockReturnValue(false);
    tags.isBroadcaster.mockReturnValue(false);

    // Act
    const result = impl.isModOrBroadcaster(tags);

    // Assert
    expect(result).toBe(false);
});

test('isModOrBroadcaster Broadcaster', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);
    let tags = mock<ITagReader>();
    tags.isMod.mockReturnValue(false);
    tags.isBroadcaster.mockReturnValue(true);

    // Act
    const result = impl.isModOrBroadcaster(tags);

    // Assert
    expect(result).toBe(true);
});

test('isModOrBroadcaster Mod', () => {
    // Arrange
    let config = mock<Configuration>();
    let impl = new FeatureBaseImpl(config);
    let tags = mock<ITagReader>();
    tags.isMod.mockReturnValue(true);
    tags.isBroadcaster.mockReturnValue(false);

    // Act
    const result = impl.isModOrBroadcaster(tags);

    // Assert
    expect(result).toBe(true);
});