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
export interface ESChannel {
  id: number;
  uuid: string;
  name: string;
}
