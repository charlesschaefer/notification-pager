import { NotifierType } from "./enuns";


export interface Notifier {
    notifierType: NotifierType
    notifierAddress: String

    notify(message: String): void;
}
