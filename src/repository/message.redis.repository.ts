import { redisClient } from '../infrastructure/redis';
import { type User } from '../types/user';

const TYPING_INDICATOR_KEY_PREFIX = 'typing-indicator';
export const RedisMessageRepository = {
    async setTypingIndicator(user: User, channelUuid: string) {
        const redisKey = `${TYPING_INDICATOR_KEY_PREFIX}:${channelUuid}`;
        await redisClient.sAdd(redisKey, JSON.stringify(user));
        await redisClient.expire(redisKey, 5);
    },
    async deleteTypingIndicator(user: User, channelUuid: string) {
        const redisKey = `${TYPING_INDICATOR_KEY_PREFIX}:${channelUuid}`;
        await redisClient.sRem(redisKey, JSON.stringify(user));
    },

    async listUsersTypingInChannel(channelUuid: string): Promise<User[]> {
        const redisKey = `${TYPING_INDICATOR_KEY_PREFIX}:${channelUuid}`;
        const typingMembersString = await redisClient.sMembers(redisKey);
        return typingMembersString.map((memberString: string) => JSON.parse(memberString));
    }
}