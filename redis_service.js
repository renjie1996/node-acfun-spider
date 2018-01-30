const Redis = require('ioredis');
const redis = new Redis();
const ACFUN_ID_SET_REDIS_KEY = 'acfun_id_set';
const ACFUN_ARTICLE_GOT_ID_SET = 'acfun_gone_id_set';
const Cache_MAX = 10000;

async function generateAcfunIdsToRedis (min, max) {
  // console.log(min, max)
  const _time_start = Date.now().valueOf();
  for(let i = min, len = max;i < len; i++) {
    // 为了优化性能一次添加避免重复的IO操作
    const cache = new Array(Cache_MAX);
    for(let j = 0, len = Cache_MAX; j < len; j++) {
      cache.push(i * Cache_MAX + j)
    }
    // await redis.sadd(ACFUN_ID_SET_REDIS_KEY, ...cache) // 优化在IO的性能瓶颈
    await redis.sadd(ACFUN_ID_SET_REDIS_KEY, cache) // 优化在IO的性能瓶颈
  }
  const _time_end = Date.now().valueOf();
  console.log(`生成数据插入数据库共用: ${(_time_end-_time_start)/1000}秒`);
};

// 从redis的set中取出member
// 原子性的pop操作随机取出数并保证不会重复
async function getRandomAcfunIds (count) {
  const ids = await redis.spop(ACFUN_ID_SET_REDIS_KEY, count);
  return ids;
};

// 这一次拉取的文章id放进set
async function markActicleIdSuccessed (id) {
  await redis.sadd(ACFUN_ARTICLE_GOT_ID_SET, id);
};

// 将id扔回去的方法
async function idBackInPool (id) {
  await redis.sadd(ACFUN_ID_SET_REDIS_KEY, id);
};

// 得到爬取到的id list
async function getGoneArticleList () {
  return await redis.smembers(ACFUN_ARTICLE_GOT_ID_SET);
};

async function getRemainingIdCount() {
  return await redis.scard(ACFUN_ID_SET_REDIS_KEY);
};


module.exports = {
  generateAcfunIdsToRedis,
  getRandomAcfunIds,
  markActicleIdSuccessed,
  idBackInPool,
  getGoneArticleList,
  getRemainingIdCount,
}