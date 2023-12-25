export interface User {
    username: string;
    nickname: string;
}

export interface ListUsersInChannelPayload {
    channel_uuid: string;
}

export interface ESUser {
    id: number;
    username: string;
    nickname: string;
}