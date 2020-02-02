import { IgnoreDuringTimeout, Seconds } from "./";

describe('seconds', () => {
    test('milliseconds', () => {
        let result = new Seconds(1).inMilliseconds();
        expect(result).toBe(1000);
    });
});

describe('IgnoreDuringTimeout', () => {
    test('handler is invoked', () => {
        // Arrange
        let handlerWasInvoked = false;
        let handler = new IgnoreDuringTimeout(new Seconds(0.5), null, () => {
            handlerWasInvoked = true;
        });

        // Act
        handler.handle();

        // Assert
        expect(handlerWasInvoked).toBe(true);
    });

    test('handler can be invoked after expiration', (done) => {
        // Arrange
        let handlerInvokeCount = 0;
        let handler = new IgnoreDuringTimeout(new Seconds(0.5), null, () => {
            handlerInvokeCount += 1;
        });

        // Act
        handler.handle();
        handler.handle(); // will be ignored

        setTimeout(() => {
            handler.handle(); // will be invoked again

            // Assert
            expect(handlerInvokeCount).toBe(2);
            done();
        }, new Seconds(0.6).inMilliseconds());

    });

});