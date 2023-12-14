import { createClient } from 'redis';

let redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST ?? 'localhost'}:${
    process.env.REDIS_PORT ?? '6379'
  }`,
}).on('error', err => {
  throw new Error('Redis Client Error', {
    cause: err,
  });
});

const redisInit = async (): Promise<void> => {
    redisClient = await redisClient.connect();
}

export {redisClient, redisInit}