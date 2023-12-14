import { Kafka } from 'kafkajs';
import { MessageKafkaConsumer } from '../consumer/message.kafka.consumer';

console.log('env var KAFKA_BROKERS', process.env.KAFKA_BROKERS);
const kafka = new Kafka({
  clientId: 'wingflo-chat-server',
  brokers: process.env.KAFKA_BROKERS?.split(',') ?? ['localhost:9092'],
});

const kafkaProducer = kafka.producer();
const kafkaConsumer = kafka.consumer({ groupId: 'wingflo-chat-server' });

const kafkaInit = async (): Promise<void> => {
  await kafkaProducer.connect();
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe({
    topics: ['chat-message-link-preview', 'chat-message-save'],
    fromBeginning: true,
  });
  await kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      switch (topic) {
        case 'chat-message-link-preview':
          await MessageKafkaConsumer.consumeLinkPreviewMessages(message);
          break;
        case 'chat-message-save':
          try {
          await MessageKafkaConsumer.consumeMessage(message);
          }catch (e ){
            console.error(e);
          }
          break;
      }
    },
  });
};


export { kafkaProducer, kafkaConsumer, kafkaInit };
