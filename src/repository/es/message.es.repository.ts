import {
  type ESMessage,
  type ESMessageOGTag,
} from '../../dto/es/message.es.dto';
import { client } from '../../infrastructure/es';
import {
  type QueryDslBoolQuery,
  type QueryDslQueryContainer,
} from '@elastic/elasticsearch/lib/api/types';
import { type LinkPreviewOgScrapedResult } from '../../types/link-preview';

export abstract class MessageEsRepository {
  static async saveMessage(msg: ESMessage): Promise<void> {
    const result = await client.index({
      index: 'messages',
      id: `${msg.application_uuid}:${msg.channel.uuid}:${msg.uuid}`,
      refresh: true,
      document: msg,
    });
  }

  static async getMessage(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
  ): Promise<ESMessage | null> {
    const res = await client.search<ESMessage>({
      index: 'messages',
      size: 1,
      query: {
        bool: {
          must: [
            {
              match: {
                application_uuid: appUuid,
              },
            },
            {
              match: {
                'channel.uuid': channelUuid,
              },
            },
            {
              match: {
                uuid: messageUuid,
              },
            },
          ],
        },
      },
    });
    return res.hits.hits?.[0]?._source ?? null;
  }

  static async deleteMessage(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
    deleterUsername: string,
  ): Promise<void> {
    await client.updateByQuery({
      index: 'messages',
      max_docs: 1,
      refresh: true,
      script: {
        source: `
        ctx._source.deleted_at = params.deleted_at;
        ctx._source.updated_at = params.deleted_at;
        ctx._source.updated_by = params.deleter_username;
        `.trim(),
        params: {
          deleted_at: Date.now(),
          deleter_username: deleterUsername,
        },
      },
      query: {
        bool: {
          filter: [
            {
              match: {
                application_uuid: appUuid,
              },
            },
            {
              match: {
                'channel.uuid': channelUuid,
              },
            },
            {
              match: {
                uuid: messageUuid,
              },
            },
          ],
        },
      },
    });
  }

  static async updateMessageOgTags(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
    link: string,
    ogTags: LinkPreviewOgScrapedResult,
  ): Promise<void> {
    const ogTag: ESMessageOGTag = {
      url: link,
      title: ogTags.title,
      description: ogTags.description,
      image: ogTags.image,
      image_width: ogTags.imageWidth,
      image_height: ogTags.imageHeight,
      image_alt: ogTags.imageAlt,
    };

    await client.updateByQuery({
      index: 'messages',
      max_docs: 1,
      refresh: true,
      wait_for_completion: true,
      script: {
        source: 'ctx._source.og_tag = params.ogTag',
        params: {
          ogTag,
        },
      },
      query: {
        bool: {
          filter: [
            {
              match: {
                application_uuid: appUuid,
              },
            },
            {
              match: {
                'channel.uuid': channelUuid,
              },
            },
            {
              match: {
                uuid: messageUuid,
              },
            },
          ],
        },
      },
    });
  }

  static async listPreviousMessages(
    appUuid: string,
    channelUuid: string,
    fetchCount: number,
    beforeThisMsgId?: number,
    beforeThisDate?: Date,
    parentMessageUuid?: string,
  ) {
    const queryConditions: QueryDslQueryContainer[] = [
      {
        match: {
          'channel.uuid': channelUuid,
        },
      },
      {
        match: {
          application_uuid: appUuid,
        },
      },
    ];
    if (beforeThisMsgId != null) {
      queryConditions.push({
        range: {
          id: {
            lt: beforeThisMsgId,
          },
        },
      });
    } else if (beforeThisDate != null) {
      queryConditions.push({
        range: {
          created_at: {
            lt: beforeThisDate.valueOf(),
          },
        },
      });
    } else {
      throw new Error(
        'Either beforeThisMsgId or beforeThisDate must be provided',
      );
    }

    const boolQuery: QueryDslBoolQuery = {
      must: queryConditions,
      must_not: [
        {
          exists: {
            field: 'deleted_at',
          },
        },
      ],
    };
    if (parentMessageUuid != null) {
      (boolQuery.must as QueryDslQueryContainer[]).push({
        match: {
          parent_message_uuid: parentMessageUuid,
        },
      });
    } else {
      (boolQuery.must_not as QueryDslQueryContainer[]).push({
        exists: {
          field: 'parent_message_uuid',
        },
      });
    }

    const res = await client.search<ESMessage>({
      index: 'messages',
      size: fetchCount,
      sort: [{ created_at: { order: 'desc' } }],
      query: {
        bool: boolQuery,
      },
    });

    return res.hits.hits.map(hit => hit._source as ESMessage);
  }
}
