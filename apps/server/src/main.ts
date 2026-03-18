import { AppModule } from './app.module.js';

export async function bootstrap(): Promise<AppModule> {
  return new AppModule();
}
