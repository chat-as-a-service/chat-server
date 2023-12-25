/* eslint-disable import/first */
import 'dotenv/config';
import './infrastructure/datadog';
import { type CustomSocket } from './types/socket';
import express from 'express';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { postgresqlDataSource } from './infrastructure/database';
import { Message } from './entity/message.entity';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { ApplicationRepository } from './repository/application.repository';
import ChannelHandler from './event-handler/channel.handler';
import MessageHandler from './event-handler/message.handler';
import ReactionHandler from './event-handler/reaction.handler';
import UserHandler from './event-handler/user.handler';
import { kafkaConsumer, kafkaInit, kafkaProducer } from './infrastructure/kafka';
import AttachmentHandler from './event-handler/attachment.handler';
import { redisClient, redisInit } from './infrastructure/redis';
import { createTerminus, type TerminusOptions } from '@godaddy/terminus';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import { ProfilingIntegration } from '@sentry/profiling-node';
import * as Sentry from '@sentry/node';

process.env.TZ = 'Etc/UTC';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DefaultEventsMap = Record<string, (...args: any[]) => void>;
if (process.env.SENTRY_DSN != null) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}

postgresqlDataSource
  .initialize()
  .then(() => {
    console.log('Database initialized');
  })
  .catch(err => {
    console.error('Error initializing database', err);
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;

(async () => {
  void kafkaInit();
  await redisInit();

  await redisClient.sAdd('bad-words', ['shit', 'poop']);

  const app = express();
  const server = createServer(app);
  io = new Server(server, {
    cors: {
      origin: '*',
    },
    adapter: createAdapter(redisClient),
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const dj = jwt.decode(token);
      const decodedToken = dj as JwtPayload;

      const application = await ApplicationRepository.findByUuid(
        decodedToken.application_uuid,
      );
      if (application == null) {
        next(
          new Error(
            `Application ${decodedToken.application_uuid} does not exist`,
          ),
        );
        return;
      }
      const t = jwt.verify(token, application.masterApiToken, {
        algorithms: ['HS256'],
      });

      const verifiedToken = t as JwtPayload;
      const customTypedSocket = socket as CustomSocket;
      customTypedSocket.username = verifiedToken.username;
      customTypedSocket.application_uuid = verifiedToken.application_uuid;
      customTypedSocket.application_id = application.id;

      console.log('Authenticated');
    } catch (err) {
      console.error(err);
      next(new Error('Authentication error'));
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    ChannelHandler(io, socket);
    MessageHandler(io, socket);
    ReactionHandler(io, socket);
    UserHandler(io, socket);
    AttachmentHandler(io, socket);
    const customTypedSocket = socket as CustomSocket;
    console.log(
      `user ${customTypedSocket.username} (app: ${customTypedSocket.application_uuid}) connected`,
    );
    socket.emit('connectAck', {});

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('listMessageThreads', async (messageUuid: string, ack) => {
      const messageThreads = await postgresqlDataSource
        .createQueryBuilder(Message, 'message')
        .leftJoinAndSelect('message.parentMessage', 'parentMessage')
        .where('parentMessage.uuid = :messageUuid', { messageUuid })
        .leftJoinAndSelect('message.reactions', 'reaction')
        .orderBy('message.createdAt', 'ASC')
        .getMany();

      ack(messageThreads);
    });

    socket.on('leaveChannel', async (channelId: string) => {
      await socket.leave(channelId);
      console.log('Left channel', channelId);
    });
  });

  async function onSignal(): Promise<unknown> {
    console.log('server is starting cleanup because it has received SIGTERM');
    return await Promise.all([
      postgresqlDataSource.destroy(),
      redisClient.disconnect(),
      kafkaProducer.disconnect(),
      kafkaConsumer.disconnect(),
    ]);
  }

  async function onShutdown(): Promise<void> {
    await postgresqlDataSource.destroy();
    await redisClient.disconnect();
    await kafkaProducer.disconnect();
    await kafkaConsumer.disconnect();
    console.log('cleanup finished, server is shutting down');
  }

  async function healthCheck(): Promise<void> {
    // `state.isShuttingDown` (boolean) shows whether the server is shutting down or not
    await postgresqlDataSource.query('SELECT 1');
    if(!redisClient.isOpen){
      throw new Error('Redis is not connected');
    }
  }

  const options: TerminusOptions = {
    // health check options
    healthChecks: {
      '/health': healthCheck,
    },

    timeout: 1000,
    onSignal,
    onShutdown,
  };

  createTerminus(server, options);
  server.listen(4000, '0.0.0.0', () => {
    console.log('server running at http://0.0.0.0:4000');
  });
})().catch(err => {
  console.error(err);
});
