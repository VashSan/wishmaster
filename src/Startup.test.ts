import Startup from "./Startup";

test('construction', ()=>{
    expect(()=>new Startup()).not.toThrow();
});