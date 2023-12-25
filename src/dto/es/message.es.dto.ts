import { type MentionType } from '../../types/message';

export interface ESMessageOGTag {
  url: string;
  title: string;
  description?: string;
  image?: string;
  image_width?: number;
  image_height?: number;
  image_alt?: string;
}

export interface ESMessage {
  id: number;
  uuid: string;
  message: string;
  application_uuid: string;
  user: {
    id: number;
    username: string;
    nickname: string;
  };
  channel: {
    id: number;
    uuid: string;
    name: string;
  };
  reactions: Array<{
    id: number;
    reaction: string;
    user: {
      id: number;
      username: string;
      nickname: string;
    };
    created_at: number;
  }>;
  mention_type?: MentionType;
  mentioned_users: Array<{
    id: number;
    username: string;
    nickname: string;
  }>;
  thread_info?: {
    reply_count: number;
    most_replies: Array<{
      id: number;
      username: string;
      nickname: string;
    }>;
    last_replied_at: number;
    updated_at: number;
  },
  og_tag?: ESMessageOGTag;
  attachments: Array<{
    bucket_name: string;
    file_key: string;
    original_file_name: string;
    content_type: string
  }>;
  parent_message_id?: number
  parent_message_uuid?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}
