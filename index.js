const RedisService = require('./redis_service');
const Spider = require('./spider');
// const ARTICLE_SUM = 3;

const OPERATOR_OPTION = process.argv[2] || process.env.NODE_ARGV_OPT;
const ARGV3 = process.argv[3] || process.env.NODE_ARGV_3;
const ARGV4 = process.argv[4] || process.env.NODE_ARGV_4;

switch(OPERATOR_OPTION) {
  case 'generate_ids': 
    RedisService.generateAcfunIdsToRedis(ARGV3, ARGV4)
      .then(r => {
        console.log('done')
        process.exit(0)
      })
      .catch(e => {
        console.log(e)
        process.exit(1)
      })
    break;
  case 'start_spider':
    Spider.spideringArticles(ARGV3)
      .then(r => {
        console.log('done')
        process.exit(0)
      })
      .catch(e => {
        console.log(e)
        process.exit(1)
      })
    break;
  case 'get_single_article':
    Spider.getContentById(ARGV3)
      .then(r => {
        console.log('done')
        process.exit(0)
      })
      .catch(e => {
        console.log(e)
        process.exit(1)
      })
    break;
  case 'gone_article':
    RedisService.getGoneArticleList()
      .then(r => {
        console.log(r)
        console.log('done');
        process.exit(0);
      })
    break;
  case 'get_roll_article':
    Spider.getArticlesBG(ARGV3)
      .then(r => {
        console.log('done')
        process.exit(0)
      })
      .catch(e => {
        console.log(e)
        process.exit(1)
      })
    break;
}


