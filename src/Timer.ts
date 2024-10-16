
import { Pager } from "./Pager";

export abstract class AcknowledgeTimer {
    private _pager: Pager;

    constructor(pager: Pager) {
        this._pager = pager;
    }

    abstract setAcknowledgeTimer(serviceID: string): void;

}
