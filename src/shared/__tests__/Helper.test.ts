import { IgnoreDuringTimeout, Seconds, Generate } from "..";
import "../custom-matcher";
import { Hours, Minutes } from "../Helper";

describe('seconds', () => {
    test('milliseconds', () => {
        let result = new Seconds(1).inMilliseconds();
        expect(result).toBe(1000);
    });
});

describe('minutes', () => {
    test('milliseconds', () => {
        let result = new Minutes(1).inMilliseconds();
        expect(result).toBe(60000);
    });
});

describe('hours', () => {
    test('milliseconds', () => {
        let result = new Hours(1).inMilliseconds();
        expect(result).toBe(3600000);
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

    test('handler timeout can be overridden', (done) => {
        // Arrange
        let handlerInvokeCount = 0;
        let handler = new IgnoreDuringTimeout(new Seconds(0.3), null, () => {
            handlerInvokeCount += 1;
        });

        // Act
        handler.handle();
        handler.handle(true); // will be overridden

        setTimeout(() => {
            handler.handle(); 

            // Assert
            expect(handlerInvokeCount).toBe(3);
            done();
        }, new Seconds(0.4).inMilliseconds());

    });

});

describe('Generate', () => {
    test('RandomString', () => {

        const numberOfTests = 100;
        const lengthOfSubject = 10;

        let results: string[] = [];
        for (let i = 0; i < numberOfTests; i++) {
            const randomString = Generate.RandomString(lengthOfSubject);
            results.push(randomString);
        }

        expect(results).toBeDistinct();
    });

    test('Base64', () => {
        const result = Generate.Base64("Wishmaster");
        expect(result).toBe("V2lzaG1hc3Rlcg==");
    });
});