import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Observable, ReplaySubject } from "rxjs";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../settings/settings.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { MonthlyRecapService } from "./monthly-recap.service";

interface SseMessage {
  data: unknown;
}

const STATUS_INTERVAL_MS = 30_000;

@Injectable()
export class StatusService implements OnModuleInit, OnModuleDestroy {
  private readonly events = new ReplaySubject<SseMessage>(1);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly settings: SettingsService,
    private readonly whatsApp: WhatsAppService,
    private readonly notifications: NotificationsService,
    private readonly monthlyRecap: MonthlyRecapService
  ) {}

  async onModuleInit() {
    await this.publish();
    this.timer = setInterval(() => {
      void this.publish();
    }, STATUS_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  stream(): Observable<SseMessage> {
    return this.events.asObservable();
  }

  async getCurrentStatus() {
    const [services, whatsApp, jobs, monthlyRecap] = await Promise.all([
      this.settings.listServices(),
      this.whatsApp.getStatus(),
      this.notifications.listJobs(8),
      this.monthlyRecap.getLatestStatus()
    ]);

    return {
      generatedAt: new Date().toISOString(),
      whatsApp,
      integrations: services.map((service) => ({
        serviceKey: service.serviceKey,
        label: service.label,
        configured: Boolean(service.baseUrl || service.hasApiKey),
        updatedAt: service.updatedAt
      })),
      jobs,
      monthlyRecap
    };
  }

  private async publish() {
    this.events.next({ data: await this.getCurrentStatus() });
  }
}
