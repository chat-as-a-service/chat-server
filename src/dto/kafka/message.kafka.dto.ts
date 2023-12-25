import { type MentionType } from '../../types/message';

export interface NewMessageKafkaPayload {
  uuid: string;
  message: string;
  user: {
    username: string;
    nickname: string;
  };
  application_uuid: string;
  channel_uuid: string;
  mention_type?: MentionType;
  mentioned_usernames: string[];
  attachments: Array<{
    bucket_name: string;
    file_key: string;
    original_file_name: string;
    content_type: string;
  }>;
  parent_message_uuid?: string;
  created_at: number;
  updated_at: number;
}


export interface LinkPreviewKafkaPayload {
  application_uuid: string;
  channel_uuid: string;
  message_uuid: string;
  link: string;
}