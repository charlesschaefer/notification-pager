import { HealthStatus, AcknowledgeStatus, NotifierType } from "./enuns";
import { EscalationPolicy } from "./Escalation";
import { PagerServiceModel, PagerStorage } from "./Storage";
import { AcknowledgeTimer } from "./Timer";

export class Pager {
    
    private _escalationPolicy: EscalationPolicy;
    private _pagerStorage: PagerStorage;
    private _timer: AcknowledgeTimer;

    constructor(escalationPolicy: EscalationPolicy, pagerStorage: PagerStorage, timer: AcknowledgeTimer) {
        this._escalationPolicy = escalationPolicy;
        this._pagerStorage = pagerStorage;
        this._timer = timer;
    }

    private getService(serviceID: string): PagerServiceModel {
        let service: PagerServiceModel | null = this._pagerStorage.load(serviceID);
        if (!service) {
            service = {
                healthStatus: HealthStatus.HEALTHY,
                message: "",
                serviceID: serviceID,
                acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
                escalationLevel: this._escalationPolicy.getFirstEscalationLevel()
            } as PagerServiceModel;
        }
        return service;
    }

    public setServiceUnhealthy(serviceID: string, message: string) {
        let service = this.getService(serviceID);
        service.message = message;

        if (service.healthStatus == HealthStatus.UNHEALTHY) {
            this._pagerStorage.save(service);
            return;
        }

        service.healthStatus = HealthStatus.UNHEALTHY;

        this.saveAndNotify(service);
    }

    public setServiceHealthy(serviceID: string) {
        let service = this.getService(serviceID);
        service.healthStatus = HealthStatus.HEALTHY;

        this._pagerStorage.save(service);
    }

    public acknowledgeAlert(serviceID: string) {
        let service = this.getService(serviceID);
        service.acknowledgeStatus = AcknowledgeStatus.ACKNOWLEDGED;

        this._pagerStorage.save(service);
    }

    public acknowledgeTimedout(serviceID: string) {
        let service = this._pagerStorage.load(serviceID);

        if (!service) {
            throw new Error(`Could not find an open alert to the service ${serviceID}`);
        }

        // won't do nothing if the alert was acknowledged
        if (service.acknowledgeStatus == AcknowledgeStatus.ACKNOWLEDGED) {
            return;
        }

        // won't do anything if the service is already in a healthy state
        if (service.healthStatus == HealthStatus.HEALTHY) {
            return;
        }

        const nextEscalationLevel = this._escalationPolicy.getNextEscalationLevel(service.escalationLevel);
        if (!nextEscalationLevel) {
            console.log("Reached the last level of escalation. Doing nothing...");
            return;
        }
        service.escalationLevel = nextEscalationLevel;

        this.saveAndNotify(service);

    }

    private saveAndNotify(service: PagerServiceModel) {
        this._pagerStorage.save(service);

        service.escalationLevel.targets.forEach(target => {
            target.notify(service.message);
        });

        this._timer.setAcknowledgeTimer(service.serviceID);
    }

}
