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
🐒3. 编写命令

编写bash中的命令

```javascript
#! /bin/bash
git reset --hard origin/master
git clean -f
git pull


#! /bin/bash
rm -rf node_modules
cnpm i

#! /bin/bash
NODE_ARGV_OPT=get_roll_article NODE_ARGV_3=5  pm2 restart index.js
pm2 restart webhook/index.js
```

### 持续集成

> 持续集成理解
1. 版本检查：用于获取代码和其他必要的文件。
2. 源码检查：对于源代码的静态分析，检查可能存在的错误。
3. 源码编译：通过编译器和连接器编译源文件，生产可执行文件或库。
4. 测试：通过对编译出来的文件进行一定测试，并获得测试结果。
5. 部署：若测试通过则文件可以作为最终得到的产物用于交付。绑定 Github 上面的项目，只要有新的代码，就会自动抓取。然后，提供一个运行环境，执行测试，完成构建，还能部署到服务器。

> 只要代码有变更，就自动运行构建和测试，反馈运行结果。确保符合预期以后，再将新代码"集成"到主干。
持续集成的好处在于，每次代码的小幅变更，就能看到运行结果，从而不断累积小的变更，而不是在开发周期结束时，一下子合并一大块代码。

[](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015092301.png)

#### 好处
>（1）快速发现错误。每完成一点更新，就集成到主干，可以快速发现错误，定位错误也比较容易。

>（2）防止分支大幅偏离主干。如果不是经常集成，主干又在不断更新，会导致以后集成的难度变大，甚至难以集成。

#### 流程

1 提交
流程的第一步，是开发者向代码仓库提交代码。所有后面的步骤都始于本地代码的一次提交（commit）。

2 测试（第一轮）
代码仓库对commit操作配置了钩子（hook），只要提交代码或者合并进主干，就会跑自动化测试。

测试有好几种。

单元测试：针对函数或模块的测试
集成测试：针对整体产品的某个功能的测试，又称功能测试
端对端测试：从用户界面直达数据库的全链路测试
第一轮至少要跑单元测试。

3 构建
通过第一轮测试，代码就可以合并进主干，就算可以交付了。

交付后，就先进行构建（build），再进入第二轮测试。所谓构建，指的是将源码转换为可以运行的实际代码，比如安装依赖，配置各种资源（样式表、JS脚本、图片）等等。

常用的构建工具如下。

1. Jenkins
2. Travis
3. Codeship
4. Strider
Jenkins和Strider是开源软件，Travis和Codeship对于开源项目可以免费使用。它们都会将构建和测试，在一次运行中执行完成。

4 测试（第二轮）
构建完成，就要进行第二轮测试。如果第一轮已经涵盖了所有测试内容，第二轮可以省略，当然，这时构建步骤也要移到第一轮测试前面。

第二轮是全面测试，单元测试和集成测试都会跑，有条件的话，也要做端对端测试。所有测试以自动化为主，少数无法自动化的测试用例，就要人工跑。

需要强调的是，新版本的每一个更新点都必须测试到。如果测试的覆盖率不高，进入后面的部署阶段后，很可能会出现严重的问题。

5 部署
通过了第二轮测试，当前代码就是一个可以直接部署的版本（artifact）。将这个版本的所有文件打包（ tar filename.tar * ）存档，发到生产服务器。

生产服务器将打包文件，解包成本地的一个目录，再将运行路径的符号链接（symlink）指向这个目录，然后重新启动应用。这方面的部署工具有Ansible，Chef，Puppet等。

6 回滚
一旦当前版本发生问题，就要回滚到上一个版本的构建结果。最简单的做法就是修改一下符号链接，指向上一个版本的目录。


### 持续部署

持续部署（continuous deployment）是持续交付的下一步，指的是代码通过评审以后，自动部署到生产环境。
持续部署的前提是能自动化完成测试、构建、部署等步骤。它与持续交付的区别，可以参考下图。

[](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015092302.jpg)


## 参考
> [持续集成](http://www.ruanyifeng.com/blog/2015/09/continuous-integration.html)









