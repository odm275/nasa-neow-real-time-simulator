import Fastify, { FastifyInstance } from "fastify";
import env from "@fastify/env";
import { config } from "../config";

declare module "Fastify" {
  interface FastifyInstance {
    config: {
      // this should be same as the confKey in options
      // specify your typing here
      NASA_NEOW_API_KEY: string;
    };
  }
}

const options = {
  schema: {
    type: "object",
    required: ["PORT", "NASA_NEOW_API_KEY"],
    properties: {
      PORT: {
        type: "number",
        default: 3000,
      },
      NASA_NEOW_API_KEY: {
        type: "string",
      },
    },
  },
  dotenv: true, // This will load .env file
};

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

async function apiRoutes(fastify: FastifyInstance) {
  fastify.get("/", (req, res) => {
    return { message: "Hello World" };
  });
  fastify.get("/neow", async (req, res) => {
    const searchParams = new URLSearchParams(config.neoWUrl);
    searchParams.append("api_key", fastify.config.NASA_NEOW_API_KEY);
    searchParams.append("start_date", "2024-08-01");
    searchParams.append("end_date", "2024-08-01");

    const url = `${config.neoWUrl}?${searchParams.toString()}`;
    const resp = await fetch(url);
    const data = await resp.json();
    return data;
  });
}

async function main() {
  await fastify.register(env, options);
  await fastify.register(apiRoutes, { prefix: "/api" });
  await fastify.listen({ port: 3000, host: "0.0.0.0" });
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    await fastify.close();
    process.exit(0);
  });
});

main();
