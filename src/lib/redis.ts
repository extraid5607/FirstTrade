import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || 'https://moving-glider-208179.upstash.io';
const token = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAy0zAAIgcDEzZDI2YzlkMzlmMDM0OGVhYTljNTU3ZWY3YmU1Y2Q4Yg';

export const redis = new Redis({
  url,
  token,
});
