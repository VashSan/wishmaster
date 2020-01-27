import Bets from "./Bets";
import { Context } from "../shared";
import { mock } from "jest-mock-extended";

test('construction', ()=>{
    let context = mock<Context>();
    expect(()=> new Bets(context)).not.toThrow();
});