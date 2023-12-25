import { type Socket } from 'socket.io';
import type { CreateMessagePayload, MessageType } from './message';
import type { CustomResponse } from './common';

export interface CustomSocket extends Socket {
  username: string;
  application_uuid: string;
  application_id: number;
}


export interface ClientToServerEvents {
  hello: () => void;
  newMessage: (msg: CreateMessagePayload,
               ack: (res: CustomResponse<MessageType>) => void) => void
}

export interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}