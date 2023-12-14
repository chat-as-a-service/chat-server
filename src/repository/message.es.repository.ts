import { client } from '../infrastructure/es';

export const ElasticsearchMessageRepository = {
  async searchMessages(searchString: string) {
    return await client.search({
      index: 'chat-message',
      query: {
        match: {
          message: searchString,
        },
      },
    });
  },
};
