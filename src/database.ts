import { DataSource } from 'typeorm';

export const postgresqlDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DB,
  entities: ['src/entity/*.ts'],
  logging: true,
  synchronize: false,
});
