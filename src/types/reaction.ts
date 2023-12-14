import { User } from './user';

export interface ReactionPayload {
  channel_uuid: string;
  message_uuid: string;
  reaction: string;
}


export interface ReactionType {
  reaction: string;
  user: User;
  created_at: number;
}

export interface UpdateMessageReactionPayload {
  message_uuid: string;
  reactions: ReactionType[]
}