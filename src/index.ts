import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { postgresqlDataSource } from './database';
import { Message } from './entity/message.entity';
process.env.TZ = 'Etc/UTC';

postgresqlDataSource
  .initialize()
  .then(() => {
    console.log('Database initialized');
  })
  .catch(err => {
    console.error('Error initializing database', err);
  });

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket: Socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('message', async msg => {
    console.log('message: ' + msg);
    io.emit('message', msg);
    const newMessage = new Message();
    newMessage.userId = 1;
    newMessage.channelId = 1;
    newMessage.message = msg;
    newMessage.createdBy = 'test';
    newMessage.updatedBy = 'test';

    await postgresqlDataSource.getRepository(Message).insert(newMessage);
  });
});

server.listen(4000, () => {
  console.log('server running at http://localhost:4000');
});
