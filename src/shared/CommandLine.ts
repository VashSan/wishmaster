
export interface IArgument {
    name: string;
    values: string[];
}

export interface ICommandLine {
    parse(args: string[]): IArgument[];
    option(aliases: string): ICommandLine;
}

export class CommandLine implements ICommandLine {

    private readonly validOptions: string[] = [];

    parse(args: string[]): IArgument[] {
        if (args.length == 0) {
            return [];
        }

        let parsing = true;
        let tokenIndex = 0;
        let command: IArgument | null = null;
        let allCommands: IArgument[] = [];
        do {
            const token = args[tokenIndex];

            if (token.startsWith("-")) {
                if (token.length > 1) {
                    const commandName = token.substr(1);
                    if (this.canAddCommand(commandName)) {
                        command = { name: commandName, values: [] };
                        allCommands.push(command);
                        tokenIndex++;
                    } else {
                        throw Error("Invalid command line");
                    }
                }
            } else {
                if (command == null) {
                    throw Error("Invalid command line");
                } else {
                    command.values.push(token);
                    tokenIndex++;
                }
            }

            if (tokenIndex >= args.length) {
                parsing = false;
            }
        } while (parsing);

        return allCommands;
    }

    option(alias: string): ICommandLine {
        if (alias.startsWith("-")) {
            alias = alias.substr(1);
        }
        this.validOptions.push(alias.toLowerCase());

        return this;
    }

    private canAddCommand(commandName: string): boolean {
        const index = this.validOptions.indexOf(commandName.toLowerCase());
        this.validOptions.splice(index, 1);
        return index >= 0;
    }

}

export default CommandLine;