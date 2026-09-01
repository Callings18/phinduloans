import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:8081",
    ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host.endsWith(".up.railway.app") || host.endsWith(".railway.app")) {
          callback(null, true);
          return;
        }
        if (host === "phindu.com" || host === "www.phindu.com" || host === "office.phindu.com" || host === "app.phindu.com") {
          callback(null, true);
          return;
        }
      } catch {
        /* ignore */
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Phinduloans API")
    .setDescription("REST API for Phinduloans (strangler migration from Supabase)")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ?? "3000";
  await app.listen(port);
  new Logger("Bootstrap").log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
