<!--CONFIG-START-->
# AppTitle
GitHub OAuth with NestJS

# AppType
Tutorial

# AppPreviewContent
This tutorial provides instructions for implementing authorization via the OAuth protocol for GitHub.
A NestJS backend is used as the client. The implementation is done using the well known
express library "Passport".

# AppAuthors
- m-wagner98

# AppLanguage
DE

# AppTags
- Web
- Oauth
- NestJS
- Authorization
- Passport

<!--CONFIG-END-->

# GitHub OAuth with NestJS
This tutorial provides instructions for implementing authorization via the OAuth protocol for GitHub.
A NestJS backend is used as the client. The implementation is done using the well known
express library "Passport". The OAuth protocol allows an application,
to access resources of a user that are managed by another application. The
user does not have to disclose his credentials, instead he authorizes the accessing
application to access the resources (for further information on the OAuth protocol see https://en.wikipedia.org/wiki/OAuth).  
In this example, we want a NestJS backend to be able to access a users' GitHub profile information
which is why an OAuth connection to GitHub is required.

## Dependencies
First, the required packages must be installed via the package manager NPM:

```shell
npm install --save @nestjs/passport passport passport-github2
npm install --save-dev @types/@types/passport-github2
```

For any Passport strategy, the `@nestjs/passport` and `passport` packages must always be installed.
In addition, the specific package, in this case `passport-github2` must then be installed.
The `passport-github` package has not been maintained for some time, so some features no longer working after GitHub upgraded its API. For this reason a fork
was released with some updates under the name `passport-github2`.  
The package `@types/passport-github2` adds the type definitions for TypeScript.

## Implementation
First, it is useful to create a separate module for all files related to authorization:

```shell
nest g module auth
```
In the module, a service is created that will perform the validation of the user. Furthermore,
a controller is created that defines the API endpoints:

```shell
nest g service auth
nest g controller auth
```

### UserService
Es ist grundsätzlich sinnvoll, Benutzeroperationen in einen eigenen Service auszugliedern, weshalb
auch dieser über die Nest CLI generiert wird:
```shell
nest g module users
nest g service users
```
In principle, it is reasonable to outsource user operations to a separate service, which is why
this service is also generated via the Nest CLI:

```typescript
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {UserSchema} from "./user.schema";
import {Model} from "mongoose";
import {User} from "./user";

@Injectable()
export class UserService{

  constructor(@InjectModel(UserSchema.name) private readonly model: Model<UserSchema>) {}

  async findOrCreateOne(username: string, displayName: string, accessToken: any): Promise<User> {
    let user: User|null = await this.model.findOne({_id: username}).exec();
    if (user) {
      return user;
    } else {
      user = new User(username, accessToken, displayName);
      return new this.model(user).save();
    }
  }
}
```
The focus here is the method `findOrCreateOne`, which among other things expects a GitHub username
and queries a MongoDB database to return the `User` as an object.
If there is no entry for the user in the database, it will be created.
For this purpose, the access token that GitHub will send after successful authorization will also be
stored in the database for future accesses.  
The `User` class and the database schema class `UserSchema`, which the Mongoose package needs for the
package to access the MongoDB collection must be defined beforehand and is not part of this
tutorial.


### AuthService
The `AuthService` is responsible for checking the authentication of a user,
for example, to verify the correctness of the password. Since in this example the authentication
between the client and the NestJS backend is realized via JSON Web Tokens (JWT), the service does not contain any
verification logic. It is nevertheless implemented to allow for future replacement of the
authentication mechanism:
```typescript
import {Injectable} from "@nestjs/common";
import {UserService} from "../user/user.service";
import {User} from "../user/user";

@Injectable()
export class AuthService{

  constructor(private readonly userService: UserService) {}

  async validateUser(userName: string|undefined, displayName: string, accessToken: any): Promise<User|null> {
      return await this.userService.findOrCreateOne(userName, avatarUrl, displayName, accessToken);
  }
}
```

### AuthController
In the `AuthController` a login API endpoint is defined, which can be called by a frontend application.:
```typescript
import {Controller, Get, UseGuards, Redirect, Res, Req} from "@nestjs/common";
import {GithubAuthGuard} from "./github-auth.guard";
import {AuthGuard} from "@nestjs/passport";
import {JwtService} from "@nestjs/jwt";
import { Response } from 'express';

@Controller('auth')
export class AuthController{
  constructor(private readonly jwtService: JwtService) {}

  @Get('login')
  @UseGuards(AuthGuard('github2'))
  login() {
    return;
  }

  @Get('redirect')
  @UseGuards(AuthGuard('github2'))
  @Redirect()
  redirect(@Req() request: any, @Res({passthrough: true}) res: Response) {
    const token = this.jwtService.sign({
      userName: req.user._id,
      displayName: req.user.displayName
    });
    res.cookie('Authorization', token, {httpOnly: true})
    return {url: '/web/home', 'statusCode': 301};
  }
}
```
To enable authorization, the login route is annotated with `@UseGuards(AuthGuard('github2'))`.
This corresponds to the name of the Passport strategy used for this example.
When this endpoint is called, the user is redirected to GitHub, where he must authorize the application to access his data. After this , he is redirected back. For this purpose, a redirect endpoint
is defined, which generates a JSON web token and sets it as a cookie for the client browser.
The parameter `request` contains the user object, which is passed by `AuthService`
as the result and can be accessed through the key `user`.

### GitHub Strategy
Finally, the Passport strategy must be implemented. For this the class
`GithubStrategy` is implemented (see code below). The class inherits from `PassportStrategy` and contains the configuration.
After the login API endpoint has been called and the user has authorized the application through GitHub,
the `validate` method of the Strategy will be called. The return value will be the user object returned by the
`AuthService` passed as the result. This object can be accessed through `request.user` in the `redirect` method in the controller (see previous section). The parameters of the `validate` method
are automatically passed in when the user is redirected from GitHub back to the NestJS application.
The `accessToken` parameter represents the access token that can be used to retrieve data from GitHub on behalf of the user.
This token must be sent in the Authorization Header every time the GitHub API is accessed.
The token remains valid until the user revokes access in the settings of their GitHub
account settings. Due to this design decision by GitHub, the `refreshToken` is not available (`undefined`). The access token must be stored securely, so it is stored encrypted in the database.
It is also not passed on to the client as a cookie, in order not to enable an
attack vector. The token is only needed by the Nest backend to communicate with the GitHub API.
The `profile` parameter contains profile information of the user.  
The parameters `clientID` and `clientSecret` needed for configuring the strategy in the constructor
are obtained when registering the application as an OAuth app with GitHub (for more information:
https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app). This sensitive
data is stored in environment variables to avoid storing it in plain text in the code repository.
The `callbackURL` parameter corresponds to the route of the `redirect` API endpoint defined in the controller.
The `scope` parameter can be used to define what data the application wants to access. The different scopes from GitHub can be found here:
https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps.  
The code of the class `PassportStrategy`
looks like this:
```typescript
import {Injectable, UnauthorizedException} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {Strategy} from "passport-github2";
import {AuthService} from "./auth.service";
import {GitHubAccessToken, User} from "../user/user";
import {createCipheriv, randomBytes, scrypt} from "crypto";
import {promisify} from "util";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github2'){
  constructor(
    private readonly authService: AuthService) {
    super({
      clientID: process.env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      callbackURL: 'http://localhost:3333/api/auth/redirect',
      scope: ['read:user', 'public_repo']
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any): Promise<User> {
    const encryptedToken = await this.encryptToken(accessToken);
    const user = await this.authService.validateUser(profile.username, profile._json.name, encryptedToken);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  /**
   * Encrypt the GitHub access token to store it safely in the DB.
   * @param token User GitHub access token obtained in the OAuth process.
   */
  async encryptToken(token: string): Promise<GitHubAccessToken> {
    const iv = randomBytes(16).toString('hex').slice(0, 16);
    const password = process.env.AES_PASSWORD; // password used to generate key
    if (password) {
      const key = (await promisify(scrypt)(password, 'salt', 32)) as Buffer;
      const cipher = createCipheriv('aes-256-ctr', key, iv);
      const encryptedToken = Buffer.concat([
        cipher.update(token),
        cipher.final(),
      ]).toString("hex");
      return {
        token: encryptedToken,
        iv: iv
      };
    } else {
      console.error('Could not read AES password from environment variable AES_PASSWORD!');
      return {
        token: 'ERROR_TOKEN',
        iv: 'ERROR_IV'
      };
    }
  }
}
```
Now all parts of the OAuth connection are implemented. The Access Token has been stored securely in the
database after authorization and can now be used for API requests.
