import { Email } from "./Email";

test('construction', () => {
    expect(() => new Email()).not.toThrow();
});