// Flue mounts HTTP through app.ts; native Cron handlers belong to cloudflare.ts.
import { SurveyStore } from './storage.ts';
import { SurveyService, telegramSender } from './service.ts';
import type { POCEnv } from './app.ts';

export default {
  async scheduled(_event:unknown,env:POCEnv) {
    await new SurveyService(new SurveyStore(env.DB),telegramSender(env.TELEGRAM_BOT_TOKEN,env.TELEGRAM_WEBHOOK_SECRET_TOKEN,env.TELEGRAM_ALLOWED_USER_IDS)).tick(new Date());
  },
};
