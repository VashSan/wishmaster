import CommandLine, { IArgument } from "../CommandLine";

test('parse', () => {
    const result = new CommandLine()
        .option("x")
        .option("-y")
        .parse(["-x", "a", "-Y"]);

    const result1: IArgument = { name: "x", values: ["a"] };
    const result2: IArgument = { name: "Y", values: [] };

    expect(result).toContainEqual(result1);
    expect(result).toContainEqual(result2);
    expect(result.length).toBe(2);
});

test('parse wrong', () => {
    const result = new CommandLine()
        .option("x")
        .option("-y");

    expect(() => result.parse(["-z"])).toThrowError();
    expect(() => result.parse(["a", "-x"])).toThrowError();
});