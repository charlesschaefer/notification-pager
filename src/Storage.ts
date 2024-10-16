import { AcknowledgeStatus, HealthStatus } from "./enuns";
import { EscalationLevel } from "./Escalation";


export abstract class PagerStorage {
    abstract save(item: PagerServiceModel): boolean;
    abstract load(serviceID: String): PagerServiceModel | null;
}

export interface PagerServiceModel {
    serviceID: string
    healthStatus: HealthStatus
    acknowledgeStatus: AcknowledgeStatus
    escalationLevel: EscalationLevel
    message: string
}