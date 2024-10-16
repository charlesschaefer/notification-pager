
import { Pager } from '../src/Pager';
import { AcknowledgeStatus, HealthStatus, NotifierType } from '../src/enuns';
import { EscalationPolicy } from '../src/Escalation';
import { PagerStorage, PagerServiceModel } from '../src/Storage';
import { Notifier } from '../src/Notifier';
import { mock, Mock } from 'ts-jest-mocker';
import { AcknowledgeTimer } from 'app/Timer';

describe("Pager Service", () => {
    let level1EmailNotifier: Mock<Notifier> = mock<Notifier>();
    level1EmailNotifier.notifierType = NotifierType.EMAIL;
    level1EmailNotifier.notifierAddress = "john@example.com";
    level1EmailNotifier.notify = jest.fn();
    
    let level2EmailNotifier = mock<Notifier>();
    level2EmailNotifier.notifierType = NotifierType.EMAIL; 
    level2EmailNotifier.notifierAddress = "jane@example.com";
    level2EmailNotifier.notify = jest.fn();
    
    let level1SMSNotifier = mock<Notifier>();
    level1SMSNotifier.notifierType = NotifierType.SMS; 
    level1SMSNotifier.notifierAddress = "+1234567890";
    level1SMSNotifier.notify = jest.fn();

    let level2SMSNotifier = mock<Notifier>();
    level2SMSNotifier.notifierType = NotifierType.SMS; 
    level2SMSNotifier.notifierAddress = "+9876543210";
    level2SMSNotifier.notify = jest.fn();

    let escalationLevel1 = {
        level: 1,
        targets: [
            level1EmailNotifier,
            level1SMSNotifier
        ]
    };

    let escalationLevel2 = {
        level: 2,
        targets: [
            level2EmailNotifier,
            level2SMSNotifier
        ]
    };
    
    const escalationPolicy: EscalationPolicy = {
        levels: [
            escalationLevel1,
            escalationLevel2
        ],
        getFirstEscalationLevel: jest.fn().mockReturnValue(escalationLevel1),
        getNextEscalationLevel: jest.fn().mockReturnValue(escalationLevel2),
    };
    const pagerStorage: PagerStorage = {
        save: jest.fn(),
        load: jest.fn().mockReturnValue(null)
    };

    const timer = mock<AcknowledgeTimer>();
    timer.setAcknowledgeTimer = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Given a Monitored Service in a Healthy State,
     * when the Pager receives an Alert related to this Monitored Service,
     * then the Monitored Service becomes Unhealthy,
     * the Pager notifies all targets of the first level of the escalation policy,
     * and sets a 15-minutes acknowledgement delay
     */
    test("makes service unhealthy and notifies", () => {

        const pager = new Pager(escalationPolicy, pagerStorage, timer);
        pager.setServiceUnhealthy("service1", "Some message");

        expect(pagerStorage.save).toHaveBeenCalledWith({
            healthStatus: HealthStatus.UNHEALTHY,
            message: "Some message",
            serviceID: "service1",
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1
        });
        expect(level1EmailNotifier.notify).toHaveBeenCalledTimes(1);
        expect(level1SMSNotifier.notify).toHaveBeenCalledTimes(1);
        expect(timer.setAcknowledgeTimer).toHaveBeenCalledTimes(1);
    });

    /**
     * Given a Monitored Service in an Unhealthy State,
     * the corresponding Alert is not Acknowledged
     * and the last level has not been notified,
     * when the Pager receives the Acknowledgement Timeout,
     * then the Pager notifies all targets of the next level of the escalation policy
     * and sets a 15-minutes acknowledgement delay.
     */
    test("notifies next escalation policy after ack timeout", () => {
        pagerStorage.load = jest.fn().mockReturnValue({
            serviceID: "service1",
            healthStatus: HealthStatus.UNHEALTHY,
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1,
            message: "some message"
        });

        const pager = new Pager(escalationPolicy, pagerStorage, timer);
        pager.acknowledgeTimedout("service1");

        expect(pagerStorage.save).toHaveBeenCalledWith({
            healthStatus: HealthStatus.UNHEALTHY,
            message: "some message",
            serviceID: "service1",
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel2
        });
        expect(level2EmailNotifier.notify).toHaveBeenCalledTimes(1);
        expect(level2SMSNotifier.notify).toHaveBeenCalledTimes(1);
        expect(timer.setAcknowledgeTimer).toHaveBeenCalledTimes(1);

    });

    /**
     * Given a Monitored Service in an Unhealthy State
     * when the Pager receives the Acknowledgement
     * and later receives the Acknowledgement Timeout,
     * then the Pager doesn't notify any Target
     * and doesn't set an acknowledgement delay.
     */
    test("doesn't notify an acknowledged unhealthy service on timeout", () => {
        pagerStorage.load = jest.fn().mockReturnValue({
            serviceID: "service1",
            healthStatus: HealthStatus.UNHEALTHY,
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1,
            message: "some message"
        });

        const pager = new Pager(escalationPolicy, pagerStorage, timer);
        pager.acknowledgeAlert("service1");

        expect(pagerStorage.save).toHaveBeenCalledWith({
            healthStatus: HealthStatus.UNHEALTHY,
            message: "some message",
            serviceID: "service1",
            acknowledgeStatus: AcknowledgeStatus.ACKNOWLEDGED,
            escalationLevel: escalationLevel1
        });
        

        pager.acknowledgeTimedout("service1");
        expect(pagerStorage.save).toHaveBeenCalledTimes(1); // only the previous call

        expect(level1EmailNotifier.notify).toHaveBeenCalledTimes(0);
        expect(level1SMSNotifier.notify).toHaveBeenCalledTimes(0);
        expect(timer.setAcknowledgeTimer).toHaveBeenCalledTimes(0);
    });

    /**
     * Given a Monitored Service in an Unhealthy State,
     * when the Pager receives an Alert related to this Monitored Service,
     * then the Pager doesn’t notify any Target
     * and doesn’t set an acknowledgement delay
     */
    test("doesn't notify an unacknowledged unhealthy service when new alert is received", () => {
        pagerStorage.load = jest.fn().mockReturnValue({
            serviceID: "service1",
            healthStatus: HealthStatus.UNHEALTHY,
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1,
            message: "some message"
        });

        const pager = new Pager(escalationPolicy, pagerStorage, timer);
        pager.setServiceUnhealthy("service1", "some other message");

        expect(pagerStorage.save).toHaveBeenCalledWith({
            healthStatus: HealthStatus.UNHEALTHY,
            message: "some other message",
            serviceID: "service1",
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1
        });

        expect(level1EmailNotifier.notify).toHaveBeenCalledTimes(0);
        expect(level1SMSNotifier.notify).toHaveBeenCalledTimes(0);
        expect(timer.setAcknowledgeTimer).toHaveBeenCalledTimes(0);
    });

    /**
     * Given a Monitored Service in an Unhealthy State,
     * when the Pager receives a Healthy event related to this Monitored Service
     * and later receives the Acknowledgement Timeout,
     * then the Monitored Service becomes Healthy,
     * the Pager doesn’t notify any Target
     * and doesn’t set an acknowledgement delay
     */
    test("makes service healthy and cancel any notifications or escalation", () => {
        pagerStorage.load = jest.fn().mockReturnValue({
            serviceID: "service1",
            healthStatus: HealthStatus.UNHEALTHY,
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1,
            message: "some message"
        });

        const pager = new Pager(escalationPolicy, pagerStorage, timer);
        pager.setServiceHealthy("service1");

        expect(pagerStorage.save).toHaveBeenCalledWith({
            healthStatus: HealthStatus.HEALTHY,
            message: "some message",
            serviceID: "service1",
            acknowledgeStatus: AcknowledgeStatus.UNACKNOWLEDGED,
            escalationLevel: escalationLevel1
        });

        pager.acknowledgeTimedout("service1");
        expect(pagerStorage.save).toHaveBeenCalledTimes(1); // only the previous call

        expect(level1EmailNotifier.notify).toHaveBeenCalledTimes(0);
        expect(level1SMSNotifier.notify).toHaveBeenCalledTimes(0);
        expect(timer.setAcknowledgeTimer).toHaveBeenCalledTimes(0);
    });
});