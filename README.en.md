# Title: A Mock Server for Development

**Abstract:**
This document provides an overview of the mock server package, including installation, configuration, and usage instructions.

## 1、Installation
To install the mock server using npm, execute the following command:

```bash
npm i @jiazhiwei/dev-server --save-dev
```

Alternatively, for yarn users:

```bash
yarn add @jiazhiwei/dev-server -D
```

For pnpm, the command is:

```bash
pnpm add @jiazhiwei/dev-server -D
```

----

## 2、Configuration
A sample **mock.config.json** configuration is provided below:

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

----

*  `serverPort`: The port for the proxy service, default is 3000
*  `wsServerPort`: The port for WebSocket, used for the proxy server to push messages to the web, default is 3001
*  `mockDir`: The directory where mock files are stored, default is mock
*  `https`: Indicates whether it is https. Currently, only http is supported, support for https will be provided later, default is false
*  `proxy`: The configuration for the proxy, the fields will be explained below
* p`roxy.[prefix]`: prefix is the prefix of the request being proxied. For example, if the original request is <http://example.com/api/login>, the request address after using the proxy should be changed to <http://example.com/prefix/api/login>. The value is an object, the fields are explained below.

* `proxy.[prefix].target`: The address to which the request should be proxied.
* `proxy.[prefix].changeOrigin`: Whether the origin should be rewritten for the proxied request, with a default value of `true`.
* `proxy.[prefix].deletePrefix`: Whether the prefix should be removed when sending the request, with a default value of `true`.
* `proxy.[prefix].auth`: Configuration on how to handle authorization, with fields described below.
* `proxy.[prefix].auth.path`: The request path for authorization information, excluding the prefix.
* `proxy.[prefix].auth.username`: The username for obtaining authorization information. It is not recommended to include this in the configuration. If set, the mock server's web interface will automatically make a request to obtain authorization when opened.
* `proxy.[prefix].auth.password`: The password for authorization information. It is not recommended to include this in the configuration and should be used in conjunction with `username`.
* `proxy.[prefix].auth.propMap`: A field mapping for authorization information, with the key being `username` and `password`, and the value being the mapped field name.
* `proxy.[prefix].auth.authCodePath`: The path to the value of the authorization information, which must be configured within `auth`, for example, `data.token`.
* `proxy.[prefix].auth.authRequest`: An object type used to configure how to authorize requests, with fields described below.
* `proxy.[prefix].auth.authRequest.type`: The type of authorization, with a default value of `header`.
* `proxy.[prefix].auth.authRequest.key`: The key for authorization information, with a default value of `Authorization`.
* `proxy.[prefix].auth.authRequest.pattern`: The pattern for the value of authorization information, with a default value of "Bearer ${token}".



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
If the mock command is occupied, the alternative mock-server can be used.

----

## 4、Usage
For more detailed usage, please refer to the attached image:

[![readme-en.jpg](https://i.postimg.cc/NGbtz4c6/readme-en.jpg)](https://postimg.cc/hhJNJVhv)

Note: The server will intelligently match scenarios based on interface parameters and return the most fitting response. In case of multiple matches, the most recently added scenario will be selected.

### Contact Information:
For any issues or inquiries regarding the code, please submit an issue on the GitHub repository or contact the developer at to_great_again@outlook.com.