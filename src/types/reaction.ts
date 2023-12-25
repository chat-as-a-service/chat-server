import { type ESUser, type User } from './user';

export interface ReactionPayload {
  channel_uuid: string;
  message_uuid: string;
  reaction: string;
  op: 'add' | 'delete';
}


export interface ReactionType {
  reaction: string;
  user: User;
  created_at: number;
}

export interface ESReaction {
  id: number;
  reaction: string;
  user: ESUser;
  created_at: number;
}

export interface UpdateMessageReactionPayload {
  message_uuid: string;
  reactions: ReactionType[]
}