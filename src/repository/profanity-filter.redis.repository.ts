import { redisClient } from '../infrastructure/redis';

export const RedisProfanityFilterRepository = {
  async maskBadWordsFromMessage(message: string) {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const words = message.split(' ');
    const maskedWords: string[] = [];
    for (const word of words) {
      const isBadWord = await redisClient.sIsMember('bad-words', word);
      if (isBadWord) {
        maskedWords.push('*'.repeat(word.length));
      } else {
        maskedWords.push(word);
      }
    }

    return maskedWords.join(' ');
  },
};