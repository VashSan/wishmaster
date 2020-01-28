import { Stomt } from "./Stomt";
import { mock } from "jest-mock-extended";
import { Context } from "../shared";

test('construction with no init', () => {
    const context = mock<Context>({ config: { stomt: null } });

    expect(() => new Stomt(context)).not.toThrow();
});