import { Seconds } from "./";
describe('seconds', () => {
    test('milliseconds', () => {
        let result = new Seconds(1).inMilliseconds();
        expect(result).toBe(1000);
    });
});