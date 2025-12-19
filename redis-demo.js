import { createClient } from 'redis';

async function demoRedis() {
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://:8mINCf66aVgm0TrKAWwYOPHHBk4sHDWH@redis-16018.c266.us-east-1-3.ec2.cloud.redislabs.com:16018',
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Set some data
    await redisClient.set('demo_key', 'Hello from Club Verse!');
    console.log('Data stored in Redis: key="demo_key", value="Hello from Club Verse!"');

    // Get the data
    const value = await redisClient.get('demo_key');
    console.log('Retrieved from Redis:', value);

    // Show all keys (if possible, but in Redis Labs, may be limited)
    // Note: In production Redis, KEYS * is not recommended, but for demo:
    const keys = await redisClient.keys('*');
    console.log('All keys in Redis:', keys);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await redisClient.disconnect();
    console.log('Disconnected from Redis');
  }
}

demoRedis();