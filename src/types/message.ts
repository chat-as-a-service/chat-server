import { type User } from './user';
import { ReactionType } from './reaction';
import { AttachmentEntity, AttachmentResponse } from './attachment';

export interface ReplyMessageRequest {
  parentMessageUuid: string;
  message: string;
}

export type MentionType = 'USERS' | 'CHANNEL';

export interface MessageType {
  uuid: string;
  message: string;
  user: User;
  channel_uuid: string;
  thread_info?: ThreadInfo;
  reactions: ReactionType[];
  mention_type?: MentionType;
  mentioned_users: User[];
  og_tag?: OpenGraphTag;
  attachments: AttachmentResponse[];
  parent_message_uuid?: string;
  created_at: number;
  updated_at: number;
}

export interface OpenGraphTag {
  url: string;
  title: string;
  description?: string;
  image?: string;
  image_width?: number;
  image_height?: number;
  image_alt?: string;
}

export interface ThreadInfo {
  reply_count: number;
  most_replies: User[];
  last_replied_at: number;
  updated_at: number;
}

export interface CreateMessagePayload {
  message: string;
  channel_uuid: string;
  mention_type?: MentionType;
  mentioned_usernames: string[];
  parent_message_uuid?: string;
  attachments: AttachmentEntity[];
}

export interface NewMessageResponse {
  uuid: string;
  user: User;
  message: string;
  channel_uuid: string;
  parent_message_uuid?: string;
}

export interface CreateMessageReplyPayload {
  parent_message_uuid: string;
  channel_uuid: string;
  message: string;
}

export interface CreateMessageReplyResponse {
  parent_message_uuid: string;
  channel_uuid: string;
  reply_message: MessageType;
}

export interface ListThreadPayload {
  channel_uuid: string;
  message_uuid: string;
}

export interface SearchMessagesPayload {
  channel_uuid: string;
  search_string: string;
}

export interface DeleteMessagePayload {
  message_uuid: string;
  channel_uuid: string;
}

export interface EditMessagePayload {
  channel_uuid: string;
  message_uuid: string;
  new_message: string;
}

export interface TypingIndicatorPayload {
    channel_uuid: string;
}

export interface LoadNextMessagesPayload {
  channel_uuid: string;
  last_message_uuid: string;
}
export interface LoadNextMessagesResponse {
  messages: MessageType[];
  has_next: boolean;
}
export interface LoadPreviousMessagesPayload {
  channel_uuid: string;
  first_message_uuid?: string;
  first_message_ts?: number;
}
export interface LoadPreviousMessagesResponse {
  messages: MessageType[];
  has_previous: boolean;
}

export interface GetMessagePayload {
    channel_uuid: string;
    message_uuid: string;
}