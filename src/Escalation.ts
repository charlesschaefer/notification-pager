import { Notifier } from "./Notifier";


export interface EscalationLevel {
    level: number
    targets: Notifier[]
}

export interface EscalationPolicy {
    levels: EscalationLevel[]

    /**
     * Returns the first escalation level
     */
    getFirstEscalationLevel(): EscalationLevel;

    /**
     * Returns the next escalation level or null if current is the last one
     * @param current 
     */
    getNextEscalationLevel(current: EscalationLevel): EscalationLevel | null;
}