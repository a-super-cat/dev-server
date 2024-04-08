# Title: A Mock Server for Development

[中文文档](https://github.com/a-super-cat/dev-server/blob/main/README.zh.md)

**Abstract:**
This document provides an overview of the mock server package, including installation, configuration, and usage instructions.

## 1、Installation

To install the mock server using npm, execute the following command:

```bash
npm i @easily-tools/mock-server --save-dev
```

Alternatively, for yarn users:

```bash
yarn add @easily-tools/mock-server -D
```

For pnpm, the command is:

```bash
pnpm add @easily-tools/mock-server -D
```

----

## 2、Configuration

A sample **mock.config.json** configuration is provided below:

```json
{
  "$schema": "https://raw.githubusercontent.com/a-super-cat/dev-server/main/mock-config-schema.json",
  "serverPort": 3000,		// the mock server port, not required, default is 3000,
  "wsServerPort": 3001,		// the mock server ws port for mock server push message to mock server web
  "mockDir": "mock",		// the folder name is used to store the mock file
  "proxy": {
    "/test": {				// The prefix of the target brokered by the mock service
      "target": "http://example.com/", // support http/https
    }
  }
}
```

example:  "http://localhost:3000/test/api/xxx" === "http://example.com/api/xxx"

## 3、Running the Server

To run the mock server, use the following command with npm:

```bash
npx mock
```

For yarn:

```bash
yarn mock
```

Or with pnpm:

```bash
pnpm mock
```

**Notice:**
If the mock command is occupied, the alternative "mock-server" cmd can be used.

----

## 4、Usage

### 4.1 Install & Start

[![add-start.gif](https://i.postimg.cc/vBwMcxjM/add-start.gif)](https://postimg.cc/zL74Qv8P)

### 4.2 Add a normal mockItem

**Note:**  The return value configuration is a function that takes the actual request parameters (for GET requests, they are also processed as objects passed into the function). You can flexibly configure the return values based on these parameters.

[![useCase.gif](https://i.postimg.cc/vTM0gGbc/useCase.gif)](https://postimg.cc/YGn6TK4H)

### 4.3 Add a Api with path param

**Note:**  If the API has path parameters, use a colon at the beginning when configuring the API to mark that this position is a path parameter. In the response configuration of the scenario, you can use `pathParams` to obtain the actual parameters at the time of the request. It is an array of string types, and the order of the parameters in the array is the same as the order of the path parameters defined when the API is defined

[![with-Path-Param.gif](https://i.postimg.cc/x1kdf7Tr/with-Path-Param.gif)](https://postimg.cc/sMrzKThK)

### 4.4 Automatic response

**Note:**  **If no Scene is selected**, the return value of the Scene configuration that **best matches** the requested parameters (calculated based on the fields and values of the Scene parameters and the actual requested parameters) is returned, and if there are multiple matches, the result of the most **recently** configured Scene is returned

[![auto-Response.gif](https://i.postimg.cc/MTvkVcXv/auto-Response.gif)](https://postimg.cc/gXFBP2VW)

### 4.5 Choose Scene

**Note:** If you select a scenario, when a request comes in, the return value configuration corresponding to the chosen scenario will be returned. If you click on the scenario name again, you can cancel the selection.

[![when-Selected-Scene.gif](https://i.postimg.cc/Y0bBWJwz/when-Selected-Scene.gif)](https://postimg.cc/XBGPM1qr)



### 4.6 Brief model

**Note:** You can choose the brief mode, which displays information in a condensed manner. To view the mock item with full information, click the icon on the left side of the mock item. Additionally, if you make modifications to the mock item, it will switch to the normal mode.

[![brief-Model.gif](https://i.postimg.cc/N01ksXTR/brief-Model.gif)](https://postimg.cc/v1ZVXc0m)



### 4.7 Manage scene with iteration

[![use-Iteration.gif](https://i.postimg.cc/c4X7nBkm/use-Iteration.gif)](https://postimg.cc/jLnJVPbw)

### 4.8 Setting

**Note:** If you wish to create a mockItem through a real request, you need to configure it in the settings. You can choose the password encryption method and the salt. If there is no encryption, please select 'none'. At the end of the 'Login Api', you can choose whether to use header or query methods for encrypting information. In 'Auth Conf', the fields on the left side are the ones required by the system, while the fields on the right side are those required by your login interface, which are used for field mapping

​	The auth configuration is used to define the format of authentication information. If yours differs from the default, please modify it accordingly.

[![setting.gif](https://i.postimg.cc/VNngCCF1/setting.gif)](https://postimg.cc/v185RDjS)

### 4.9 Use in project

**Note:** When using it in a project, you can configure the `env` file to send requests to the mock server in the development environment.

[![screenshots.gif](https://i.postimg.cc/qMp6FgWv/screenshots.gif)](https://postimg.cc/F1nKdF9M)

### Contact Information:

For any issues or inquiries regarding the code, please submit an issue on the GitHub repository or contact the developer at to_great_again@outlook.com.
