# 一个mock服务器



## 1、安装

**npm**

```bash
npm i @jiazhiwei/dev-server -d
```

**yarn**

```bash
yarn add @jiazhiwei/dev-server -D
```

**pnpm**

```bash
pnpm add @jiazhiwei/dev-server -D
```

------

## 2、配置

**mock.config.json  示例**

```json
{
  "$schema": "https://raw.githubusercontent.com/a-super-cat/dev-server/main/mock-config-schema.json",
  "proxy": {
    "/test": {
      "target": "http://example.com/",
      "changeOrigin": true,
      "auth": {
        "path": "/api/to/login",
        "authCodePath": "data.token",
        "authRequest": {
          "key": "Authorization",
          "pattern": "Bearer ${token}"
        }
      }
    }
  }
}
```

**配置解析**

* serverPort：代理服务的端口，默认3000

* wsServerPort：webSocket的端口，用于代理服务器向web推送消息， 默认3001

* mockDir：mock文件存储的目录， 默认mock

* https： 是否是https，目前只支持http，后续会提供支持，默认false

* proxy：代理的配置，字段会在下面介绍

* proxy.<prefix>: prefix为被代理的请求的前缀，例如原始请求为http://example.com/api/login

  使用代理后请求地址要改为http://example.com/prefix/api/login 值为对象，字段以下介绍

* proxy.<prefix>.target: 要将请求代理到的地址

* proxy.<prefix>.changeOrigin：被代理的请求是否要重写origin，默认值为true

* proxy.<prefix>.deletePrefix：在发送请求的时候是否删除prefix，默认值true

* proxy.<prefix>.auth：如何进行授权的配置，字段以下介绍

* proxy.<prefix>.auth.path：授权信息的请求路径，不含prefix

* proxy.<prefix>.auth.username：获取授权信息的用户名，不推荐写入配置，如果配置了的话，会在mock-server的web端打开的时候自动进行请求，获取授权信息

* proxy.<prefix>.auth.password：授权信息的密码，不推荐写入配置，与username配合使用

* proxy.<prefix>.auth.propMap：授权信息的字段映射，对象类型，key为username和password，value为映射后的字段名

* proxy.<prefix>.auth.authCodePath：授权信息值的路径，在auth中必须配置，例如data.token

* proxy.<prefix>.auth.authRequest：对象类型，用于配置如何对请求进行授权，字段以下介绍

* proxy.<prefix>.auth.authRequest.type：授权方式，默认为header

* proxy.<prefix>.auth.authRequest.key：授权信息的key，默认值为Authorization

* proxy.<prefix>.auth.authRequest.pattern：授权信息value的pattern，默认值为"Bearer ${token}"

------

## 3、运行

**npm**

```bash
npx mock
```

**yarn**

```bash
yarn mock
```

**pnpm**

```bash
pnpm mock
```

-----

**Notice**

如果mock命令已被其他命令占用，可使用mock-server替代



## 4、使用

[![readme.jpg](https://i.postimg.cc/DzvJPRzs/readme.jpg)](https://postimg.cc/zyQGJtKX)



## 其他

如果代码有bug，可以在项目的github提交issue，也可以通过邮箱联系to_great_again@outlook.com





