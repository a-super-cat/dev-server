# 一个开发用mock服务器



## 1、安装

使用npm：

```bash
npm i @easily-tools/mock-server --save-dev
```

使用yarn：

```bash
yarn add @easily-tools/mock-server -D
```

使用pnpm：

```bash
pnpm add @easily-tools/mock-server -D
```

----

## 2、Configuration

A sample **mock.config.json** configuration is provided below:

```json
{
  "$schema": "https://raw.githubusercontent.com/a-super-cat/dev-server/main/mock-config-schema.json",
  "serverPort": 3000,		// mock 服务端口，不是必须的，默认：3000,
  "wsServerPort": 3001,		// mock 服务的ws端口，用来向管理页面推送消息
  "mockDir": "mock",		// 存储mock文件的文件夹默认mock
  "proxy": {
    "/test": {				// 代理网站后请求的前缀
      "target": "http://example.com/", // 支持http和https
    }
  }
}
```

例子：访问  "http://localhost:3000/test/api/xxx" 等于访问 "http://example.com/api/xxx"

## 3、启动服务

使用npm：

```bash
npx mock
```

使用yarn：

```bash
yarn mock
```

使用pnpm：

```bash
pnpm mock
```

**Notice:**
如果命令mock已经被别的package占用，可使用mock-server命令替代

----

## 4、使用

### 4.1 安装并启动

[![add-start.gif](https://i.postimg.cc/vBwMcxjM/add-start.gif)](https://postimg.cc/zL74Qv8P)

### 4.2 添加一个mockItem

**Note:**  返回值配置是一个函数，它接收实际的请求参数（对于GET请求，它们也会作为对象传入函数中）。你可以根据这些参数灵活配置返回值

[![useCase.gif](https://i.postimg.cc/vTM0gGbc/useCase.gif)](https://postimg.cc/YGn6TK4H)

### 4.3 添加一个带有路径参数的Api

**Note:**  如果API有路径参数，配置API时请在开头使用冒号标记该位置是一个路径参数。在场景的响应配置中，你可以使用`pathParams`来获取请求时的实际参数。它是一个字符串类型的数组，数组中参数的顺序与定义API时的路径参数顺序相同。

[![with-Path-Param.gif](https://i.postimg.cc/x1kdf7Tr/with-Path-Param.gif)](https://postimg.cc/sMrzKThK)

### 4.4 自动计算响应

**Note:**  如果没有选择场景，将返回与请求参数最匹配的场景配置的返回值（基于场景参数的字段和值以及实际请求参数计算），如果有多个匹配，将返回最近配置的场景的结果。

[![auto-Response.gif](https://i.postimg.cc/MTvkVcXv/auto-Response.gif)](https://postimg.cc/gXFBP2VW)

### 4.5 选中场景

**Note:** 如果你选择了一个场景，当有请求进来时，将返回对应选择场景的返回值配置。如果你再次点击场景名称，可以取消选择。

[![when-Selected-Scene.gif](https://i.postimg.cc/Y0bBWJwz/when-Selected-Scene.gif)](https://postimg.cc/XBGPM1qr)



### 4.6 精简模式

**Note:** 你可以选择简洁模式，它以简洁的方式显示信息。要查看完整信息的模拟项，请点击模拟项左侧的图标。此外，如果你对模拟项进行了修改，它将切换到正常模式。

[![brief-Model.gif](https://i.postimg.cc/N01ksXTR/brief-Model.gif)](https://postimg.cc/v1ZVXc0m)



### 4.7 使用迭代期管理场景

[![use-Iteration.gif](https://i.postimg.cc/c4X7nBkm/use-Iteration.gif)](https://postimg.cc/jLnJVPbw)

### 4.8 设置

**Note:** 如果你想通过真实请求创建一个模拟项，你需要在设置中进行配置。你可以选择密码加密方法和盐值。如果没有加密，请选择'none'。在'Login Api'的末尾，你可以选择使用头部或查询方法来加密信息。在'Auth Conf'中，左侧的字段是系统所需的字段，而右侧的字段是你的登录接口所需的字段，用于字段映射。

​	auth配置用于定义认证信息的格式。如果你的格式与默认的不同，请相应地进行修改。

[![setting.gif](https://i.postimg.cc/VNngCCF1/setting.gif)](https://postimg.cc/v185RDjS)

### 4.9 在项目中使用

**Note：** 你可以在env文件中配置，以在开发的时候请求mock服务

[![screenshots.gif](https://i.postimg.cc/qMp6FgWv/screenshots.gif)](https://postimg.cc/F1nKdF9M)

### 联系信息:

如果你在使用的过程中发现了什么bug，或者有什么可以优化的地方可以在我的github提交issue，也可以通过邮箱联系to_great_again@outlook.com.