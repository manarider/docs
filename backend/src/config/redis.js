const { createClient } = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  redisClient = createClient({ url: config.redis.url });

  redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redisClient.connect();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis client not initialized');
  return redisClient;
};

module.exports = { connectRedis, getRedis };
