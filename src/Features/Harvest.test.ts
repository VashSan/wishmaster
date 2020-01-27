
import { mock } from "jest-mock-extended";
import { Context } from "../shared";
import Harvest from "./Harvest";


test('construction with no init', () => {
    let context = mock<Context>({ config: {  } });
    expect( () => new Harvest(context)).not.toThrow();
});