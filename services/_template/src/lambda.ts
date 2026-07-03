// Must be first: registers Reflect.metadata before any decorated class loads,
// so the design:paramtypes metadata (emitted by nest build / tsc) is stored and
// NestJS DI can resolve constructor injection.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { ExpressAdapter } from "@nestjs/platform-express";
import { ExpressAdapter as Adapter } from "@nestjs/platform-express";
import serverlessExpress from "@codegenie/serverless-express";
import express from "express";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { AppModule } from "./app.module";

// The construct fronts this Lambda with an API Gateway HTTP API (v2 payloads).
// Promise-style only: the void/callback arm of aws-lambda's Handler type is for
// callback-era handlers and only muddies the signature here.
type HttpHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

// Cache the bootstrapped server across warm invocations. Re-bootstrapping on
// every call balloons cold-start latency and memory (CLAUDE.md gotcha #5).
let cached: HttpHandler | undefined;

async function bootstrapServer(): Promise<HttpHandler> {
  const expressApp = express();
  const adapter: ExpressAdapter = new Adapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // CORS for browser clients (the web preview, an admin surface). Reflects the
  // request origin unless CORS_ORIGIN is set (comma-separated allowlist).
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  });
  await app.init();
  const se = serverlessExpress<APIGatewayProxyEventV2, APIGatewayProxyResultV2>({
    app: expressApp,
  });
  // Invoked without a callback, serverless-express always returns the result
  // promise; the cast drops the void arm its callback-style signature carries.
  return (event, context) =>
    se(event, context, () => undefined) as Promise<APIGatewayProxyResultV2>;
}

export const handler: HttpHandler = async (event, context) => {
  cached ??= await bootstrapServer();
  return cached(event, context);
};
