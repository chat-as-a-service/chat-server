import { z } from 'zod';

export interface ChannelType {
  uuid: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface ChannelListRes {
  uuid: string;
  name: string;
  max_members: number;
  user_count: number;
  created_at: number;
  updated_at: number;
}

export interface ChannelMember {
  username: string;
  nickname: string;
  is_online: boolean;
  is_operator: boolean;
  last_seen_at?: number;
}

export const ChannelMemberListOrder = z.enum([
  'MEMBER_NICKNAME_ALPHABETICAL',
  'OPERATOR_THEN_MEMBER_ALPHABETICAL',
]);
export const ChannelMemberListPayload = z.object({
  channel_uuid: z.string(),
  order: ChannelMemberListOrder.optional().default(
    'MEMBER_NICKNAME_ALPHABETICAL',
  ),
  limit: z.number().gt(0).lte(100).int().optional().default(10),
  token: z.number().int().optional().default(0),
});

export interface ChannelMemberListRes {
  members: ChannelMember[];
  next: number;
}