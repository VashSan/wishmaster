import { execFile } from "child_process"
import { IConfiguration } from "./Configuration";
import FileSystem, { IFileSystem } from "./FileSystem";

export interface IMediaPlayer {
    play(sound: Sound): void
    playAudio(file: string): void;
}

export enum Sound {
    Bell
}

export class MediaPlayer implements IMediaPlayer {
    private soundMap: Map<Sound, string> = new Map<Sound, string>();
    private arguments: string[];
    private executable: string;
    private soundsPath: string;
    private readonly fs: IFileSystem;

    constructor(config: IConfiguration, fs?: IFileSystem) {
        if (fs) {
            this.fs = fs;
        } else {
            this.fs = new FileSystem();
        }

        this.executable = config.getMediaPlayer();
        this.arguments = config.getMediaPlayerArgs();

        this.soundsPath = this.fs.joinPaths(config.getRootPath(), "sounds");
        this.soundMap.set(Sound.Bell, "bell.wav");
    }

    playAudio(file: string): void {
        let args: string[] = [];
        this.arguments.forEach((a) => {
            let argItem = a.replace('{0}', file);
            args.push(argItem);
        });
        execFile(this.executable, args);
    }

    play(sound: Sound): void {
        let soundFile = this.soundMap.get(sound);
        if (soundFile) {
            let fullSoundPath = this.fs.joinPaths(this.soundsPath, soundFile);
            this.playAudio(fullSoundPath);
        }
    }
}

export default MediaPlayer;