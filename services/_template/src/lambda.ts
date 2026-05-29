import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { ExpressAdapter } from "@nestjs/platform-express";
import { ExpressAdapter as Adapter } from "@nestjs/platform-express";
import serverlessExpress from "@codegenie/serverless-express";
import express from "express";
import type { Handler } from "aws-lambda";
import { AppModule } from "./app.module";

// Cache the bootstrapped server across warm invocations. Re-bootstrapping on
// every call balloons cold-start latency and memory (CLAUDE.md gotcha #5).
let cached: Handler | undefined;

async function bootstrapServer(): Promise<Handler> {
  const expressApp = express();
  const adapter: ExpressAdapter = new Adapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cached ??= await bootstrapServer();
  return cached(event, context, callback);
};
