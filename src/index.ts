import Fastify, { FastifyInstance } from "fastify";
import env from "@fastify/env";
import { config } from "../config";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Static, Type } from "@sinclair/typebox";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      PORT: number;
      NASA_NEOW_API_KEY: string;
      REDIS_URL: string;
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
      REDIS_URL: {
        type: "string",
        default: "redis://localhost:6379",
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
}).withTypeProvider<TypeBoxTypeProvider>();

const QueryStringSchema = Type.Object({
  start_date: Type.String(),
  end_date: Type.String(),
});
type QueryStringType = Static<typeof QueryStringSchema>;

async function apiRoutes(fastify: FastifyInstance) {
  fastify.get("/", (req, res) => {
    return { message: "Hello World" };
  });

  fastify.get<{ Querystring: QueryStringType }>(
    "/neow",
    {
      schema: {
        querystring: QueryStringSchema,
      },
    },
    async (req, res) => {
      const { start_date } = req.query;

      const searchParams = new URLSearchParams(config.neoWUrl);
      searchParams.append("api_key", fastify.config.NASA_NEOW_API_KEY);
      searchParams.append("start_date", "2024-08-01");
      searchParams.append("end_date", "2024-08-01");

      const url = `${config.neoWUrl}?${searchParams.toString()}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return data;
    }
  );
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
