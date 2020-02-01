import { execFile } from "child_process"

export interface IMediaPlayer {
    playAudio(file: string): void;
}


export class MediaPlayer implements IMediaPlayer {
    playAudio(file: string): void {
        let player = "C:\\Program Files\\Windows Media Player\\wmplayer.exe";
        execFile(player, [file]);
    }

}

export default MediaPlayer;