import Fastify, { FastifyInstance } from "fastify";
import env from "@fastify/env";
import { config } from "../config";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Static, Type } from "@sinclair/typebox";
import fastifyRedis from "@fastify/redis";
import dayjs from "dayjs";
declare module "fastify" {
  interface FastifyInstance {
    config: {
      PORT: number;
      NASA_NEOW_API_KEY: string;
      UPSTASH_REDIS_URL: string;
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
      UPSTASH_REDIS_URL: {
        type: "string",
        default: "add a key to your .env please",
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

  fastify.get("/neow", async (req, res) => {
    const { redis } = fastify;
    const dayToQuery = dayjs().format("YYYY-MM-DD");

    const cacheKey = `neow:${dayToQuery}:${dayToQuery}`;

    try {
      let cacheData = await redis.get(cacheKey);
      if (cacheData) {
        return JSON.parse(cacheData);
      }

      const searchParams = new URLSearchParams(config.neoWUrl);
      searchParams.append("api_key", fastify.config.NASA_NEOW_API_KEY);
      searchParams.append("start_date", dayToQuery);
      searchParams.append("end_date", dayToQuery);

      const url = `${config.neoWUrl}?${searchParams.toString()}`;
      const resp = await fetch(url);
      const data = await resp.json();
      await redis.set(cacheKey, JSON.stringify(data), "EX", 86400);

      return data;
    } catch (e) {
      fastify.log.error(e, "Error in /neow route");
      throw e; // Let Fastify handle the error response
    }
  });
}

async function main() {
  try {
    await fastify.register(env, options);
    await fastify.register(apiRoutes, { prefix: "/api" });
    await fastify.register(fastifyRedis, {
      url: fastify.config.UPSTASH_REDIS_URL,
    });
    await fastify.listen({ port: fastify.config.PORT, host: "0.0.0.0" });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    await fastify.close();
    process.exit(0);
  });
});

main();
