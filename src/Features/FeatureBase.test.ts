import { FeatureBase } from "./FeatureBase";
import { Configuration } from "../shared";
import { mock } from "jest-mock-extended";
import { IFeatureResponse } from "../MessageProcessor";

class FeatureBaseImpl extends FeatureBase {
    constructor(config: Configuration) {
        super(config);
    }

    public invokeCreateResponse(text: string): IFeatureResponse {
        return this.createResponse(text);

    }

    public invokeSendResponse(response: IFeatureResponse) {
        this.sendResponse(response);
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