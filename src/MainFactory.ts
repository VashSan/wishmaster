import { IFeature, IConfiguration, IContext, Configuration } from "./shared";
import { Alerts } from "./Features/Alerts";
import { Bets } from "./Features/Bets";
import { StaticAnswers } from "./Features/StaticAnswers";
import { Stomt } from "./Features/Stomt";
import { SongRequest } from "./Features/SongRequest";
import { UrlFilter } from "./Features/UrlFilter";
import Harvest from "./Features/Harvest";

export interface IMainFactory {
    createHarvest(): IFeature;
    createUrlFilter(): IFeature;
    createAlerts(): IFeature;
    createBets(): IFeature;
    createSongRequest(): IFeature;
    createConfiguration(): IConfiguration;
    createStaticAnswers(): IFeature;
    setContext(context: IContext): void;
}

export class MainFactory implements IMainFactory {
    createHarvest(): IFeature {
        return new Harvest(this.getContext());
    }
    createConfiguration(): IConfiguration {
        return new Configuration();
    }
    createBets(): IFeature {
        return new Bets(this.getContext());
    }
    createSongRequest(): IFeature {
        const sr = new SongRequest(this.getContext());
        sr.connect();
        return sr;
    }
    createStaticAnswers(): IFeature {
        return new StaticAnswers(this.getContext());
    }
    createAlerts(): IFeature {
        return new Alerts(this.getContext());
    }
    createUrlFilter(): IFeature {
        return new UrlFilter(this.getContext());
    }
    private context: IContext | undefined;
    setContext(context: IContext) {
        this.context = context;
    }
    private getContext(): IContext {
        if (this.context) {
            return this.context;
        }
        throw new Error("Context is not initialitzed");
    }
}