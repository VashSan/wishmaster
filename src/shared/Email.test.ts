import { EmailAccess } from "./Email";
import { mock } from "jest-mock-extended";
import { IConfiguration } from ".";
import { ILogger } from "psst-log";


test('construction', () => {
    let config = mock<IConfiguration>();
    config.getEmail.mockReturnValue(null);
    let logger = mock<ILogger>();
    expect(() => new EmailAccess(config, logger)).not.toThrow();
    //expect(logger.warn).toBeCalledTimes(1); moved to connect method
});