
import { mock } from "jest-mock-extended";
import { Context } from "../shared";
import { StaticAnswers } from "./StaticAnswers";

test('construction with no init', () => {
    let context = mock<Context>({ config: {  } });
    expect( () => new StaticAnswers(context)).not.toThrow();
});