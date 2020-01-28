import { Stomt } from "./Stomt";
import { mock } from "jest-mock-extended";
import { IConfiguration, IContext } from "../shared";

test('construction with no init', () => {
    const config = mock<IConfiguration>();
    config.getStomt.mockReturnValue(null);

    const context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);

    expect(() => new Stomt(context)).not.toThrow();
});