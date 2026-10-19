import "reflect-metadata";
import "./runtime-env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { configureAgentHttp } from "./modules/agent/agent-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Installs the route-local relay parser before Nest registers its default 100 KiB parser.
  configureAgentHttp(app);
  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: allowedOrigin,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
