# Git Webhook实现简单的自动化部署
🐛node 爬虫简易的自动化部署

### 什么是git webhook

> Webhooks allow you to build or set up GitHub Apps which subscribe to certain events on GitHub.com. When one of those events is triggered, we'll send a HTTP POST payload to the webhook's configured URL. Webhooks can be used to update an external issue tracker, trigger CI builds, update a backup mirror, or even deploy to your production server. You're only limited by your imagination.

从文档介绍简单明了,它是一个订阅git事件的hook，通过Post请求来向你的服务器表示[事件](https://developer.github.com/webhooks/)触发，它的功能包括不限于：

1. 触发ci构建
2. 更新备份镜像
3. 部署生产服务器

### 在node中如何使用

我自己写了一个简易的爬虫。使用hook是为了让开发每次我 **本地提交代码到master分支后，代码在服务器会自动地pull下来，并完成部署，而不是每次我本地push到master后再去服务器上pull一下，然后重新配置、安装依赖性、并重启服务...** 

#### 如何使用webhook

> Creating Webhooks
  1. Setting up a Webhook
  2. Payload URL
  3. Content Type
  4. Events

官网提供的webhook文档较简单，并未提供node最佳实践，开发中需要注意以下几点：

🌟 1. 在repository中注册webhook是触发hook的前提
🌟 2. 它仿佛像一个给写ajax发请求给我们服务的前端，第一约定接口：你可以在配置的url中跟它约定好后端路由，保证是唯一为它服务的接口，第二确定参数放在payload中还是放在body中解析
🌟 3. 需要选中哪些事件。
🌟 4. 请求的POST头中会带上* X-GitHub-Event * 、* X-GitHub-Delivery *、* X-Hub-Signature * （提取操作元字段和识别请求）

最后watch到git发过来的请求：
```javascript
require 'sinatra'
require 'json'

post '/payload' do
  push = JSON.parse(request.body.read)
  puts "I got some JSON: #{push.inspect}"
end
```
服务接受响应：

```javascript
POST /payload HTTP/1.1

Host: localhost:4567
X-Github-Delivery: 72d3162e-cc78-11e3-81ab-4c9367dc0958
X-Hub-Signature: sha1=7d38cdd689735b008b3c702edd92eea23791c5f6
User-Agent: GitHub-Hookshot/044aadd
Content-Type: application/json
Content-Length: 6615
X-GitHub-Event: issues

{
  "action": "opened",
  "issue": {
    "url": "https://api.github.com/repos/octocat/Hello-World/issues/1347",
    "number": 1347,
    ...
  },
  "repository" : {
    "id": 1296269,
    "full_name": "octocat/Hello-World",
    "owner": {
      "login": "octocat",
      "id": 1,
      ...
    },
    ...
  },
  "sender": {
    "login": "octocat",
    "id": 1,
    ...
  }
}
```

### 在node中使用webhook API

我们需要做一些过滤字段和判断，这里使用在github按star数的node库[github-webhook-handler](https://github.com/rvagg/github-webhook-handler)


略微扫下源码做过滤头部，和取paylod，以eventEmit形式发放git事件

```javascript
handler.__proto__ = EventEmitter.prototype
EventEmitter.call(handler)
try {
  obj = JSON.parse(data.toString())
} catch (e) {
  return hasError(e)
}

if (!sig)
  return hasError('No X-Hub-Signature found on request')

if (!event)
  return hasError('No X-Github-Event found on request')

if (!id)
  return hasError('No X-Github-Delivery found on request')

handler.emit(event, emitData)
handler.emit('*', emitData)
```

#### 运用到自己服务需要它做两件事，每次触发钩子后，自动pull后，删除掉原有的node_module后重新install，完成之后重启服务

🐒1. node启动子进程运行命令，stdout是在 Node.js 的父进程与衍生的子进程之间会建立 stdin、stdout 和 stderr 的管道， 数据能以非阻塞的方式在管道中流通，可以用于命令执行日志输出。

```javascript
function runCommand(cmd, args) {
  return new Promise((rsv, rjt) => {
    const child = spawn( cmd, args );
    let response = '';
    child.stdout.on('data', buffer => { response += buffer.toString() }); 
    child.stdout.on('end', () => { rsv( response ) });
    child.stdout.on('error', e => { rjt(e) });
  })
};
```

🐒2. 使用钩子
 ```javascript
 handler.on('error', err => console.error('Error:', err.message));
handler.on('push', event => {
  console.log(`Received a push event for ${event.payload.repository.name} to ${event.payload.ref}`);
  runCommand('sh', [`${__dirname}/cicd.sh`])
    .then(res => logMessage(res, '-----------切出子进程进行自动pull-----------'))
    .then(res => runCommand('sh', [`${__dirname}/install.sh`]))
    .then(res => logMessage(res, '-----------线上依赖安装完成-----------'))
    .then(res => runCommand('sh', [`${__dirname}/restart.sh`]))
    .then(res => logMessage(res, '-----------线上服务部署完成----------'))
    .catch(e => console.log(e));
  ;
});

// issue钩子
handler.on('issues', event => {
  console.log('Received an issue event for %s action=%s: #%d %s',
    event.payload.repository.name,
    event.payload.action,
    event.payload.issue.number,
    event.payload.issue.title);
});
 ```

 











