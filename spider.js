const axios = require('axios');
const moment = require('moment')
const cheerio = require('cheerio');
const RedisServer = require('./redis_service');
const MongoClient = require('mongodb').MongoClient;
const Tag = require('./tag');
const JieBa = require("nodejieba");

async function spideringArticles(count) {
  const ids = await RedisServer.getRandomAcfunIds(count);
  console.log(`随机取出的id为：${ids}`);
  let successCount = 0;
  let errorCount = 0;
  for (let id of ids) {
    await getContentById(id)
      .then(r => successCount++)
      .catch(e => {
        errorCount++;
        if(e.errorCode !== 4040000) {
          throw e
        } 
    });
    // 阻隔1s
    await new Promise(rsv => setTimeout(rsv, 1000));
  }

  return {
    successCount,
    errorCount,
  }
};

async function getArticlesBG(num) {
  const remainingCount = await RedisServer.getRemainingIdCount();
  console.log(`===================还有${remainingCount}条待爬取========================`);
  const NUMS_PER_TIME = num || 5;
  while(remainingCount >= NUMS_PER_TIME) {
    await spideringArticles(NUMS_PER_TIME)
      .then(r => console.log(r))
      .catch(e => console.log(e));
  };
}

async function getContentById(id) {
  const url = `http://www.acfun.cn/a/ac${id}`;
  console.log(`TEST5#正在爬取: ${url}`);
  const res = await axios.get(url).catch(e => {
    if(e.response && e.response.status === 404) {
      const err = new Error('Not Found');
      err.errorCode = 4040000;
      throw err;
    } else {
      throw e;
    }
  })
  const html = res.data;
  const $ = cheerio.load(html);
  const article = await formatFromCheerios($, id)
  if(!article) {    // 如果没找到articleContent，选择器对象一直存在，因此需要另外判断
    console.log(`ac${id}不存在`);
    return
  } 
  await RedisServer.markActicleIdSuccessed(id); // 有的话加入到已有的set中
  const article_saved = await saveToMongoDB(article, id)  // 将格式化好的内容放入mongodb
  console.log(article_saved);
}

async function formatFromCheerios ($, id) {
  const articleContent = $(".article-content");
  const title = $(".art-title .caption").text();
  const originCreatedAt = moment($('.up-time').text(), 'YYYY年MM月DD日  hh:mm:ss').valueOf().toFixed(0);
  const tags = await generatorTags($, id, title);
  if(!articleContent.html())  return;// if 404, do nothing  ; if not found or deleted, do nothing ; if is video, push its id to redis ;
  const content = flattenContent(articleContent, $);
  const article = {
    acfunId: id,
    title,
    content,
    articleContent: articleContent.html(),
    createAt: Date.now.valueOf(),
    originCreatedAt,
    tags,
  };
  return article;
}

async function generatorTags($, id, title) {
  const tags = [];
  const articleTagName = $('.art-name').text();
  const articleCategory = $('.art-census > a').text();
  const mainTag = $('.art-tags > a').text();
  const bdTag = $('.bd_tag > a').text();
  const titleTag = JieBa.extract(title, 5);
  const res = await axios.get(`http://www.acfun.cn/member/collect_up_exist.aspx?contentId=${id}`);  // 直接使用网站的api
  if(!res || !titleTag) return;
  const { tagList} = res.data.data;
  for(let tag of  titleTag) {
    tags.push(new Tag('Title_Extract', tag.word, tag.weight));
  }
  for(let tag of tagList) {
    tags.push(new Tag('Article_Api', tag.tagName, 1));
  }
  articleTagName && tags.push(new Tag('TAGNAME', articleTagName, 1));
  articleCategory && tags.push(new Tag('CATEGORY', articleCategory, 1));
  mainTag && tags.push(new Tag('MAINTAG', mainTag, 1));
  bdTag && tags.push(new Tag('BDTAG', bdTag, 1));

  return tags;
}

function flattenContent(dom, $) {
  return dom.children().length > 0 
    ? Array.from(dom.children()).reduce((prev, next) => {
        return prev.concat($(next).children().length > 0 ? flattenContent($(next), $) : diffImgAndFont($(next)))
      }, []) 
    : diffImgAndFont(dom)
}

function diffImgAndFont (c){
  if(c.text()) return c.text()
  else if(c[0] && c[0].name === "img") return c.attr("src")
  return
}

async function saveToMongoDB (article, id) {
  const MONGO_URL = 'mongodb://localhost:27017';
  const connect = await MongoClient.connect(MONGO_URL);
  const db = await connect.db('acfun_v1');

  return await db.collection('articles').findOneAndUpdate({
    acfunId: id
  }, article, {
    upsert: true,
    returnNewValue: true
  })
}

module.exports = {
  spideringArticles,
  getContentById,
  getArticlesBG,
}




