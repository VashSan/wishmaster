import { execFile } from "child_process"

export interface IMediaPlayer {
    playAudio(file: string): void;
}


export class MediaPlayer implements IMediaPlayer {
    private arguments: string[];
    private executable: string;

    constructor(executable: string, args: string[]) {
        this.executable = executable;
        this.arguments = args;
    }
    playAudio(file: string): void {
        let args: string[] = [];
        this.arguments.forEach((a) => {
            let argItem = a.replace('{0}', file);
            args.push(argItem);
        });
        execFile(this.executable, args);
    }

}

export default MediaPlayer;