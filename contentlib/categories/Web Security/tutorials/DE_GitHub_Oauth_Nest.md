# GitHub OAuth Anbindung mit NestJS
Dieses Tutorial liefert eine Anleitung, um Autorisierung über das OAuth Protokoll für Github zu
implementieren. Als Client dient ein NestJS Backend. Die Implementierung wird mithilfe der bekannten
Express Bibliothek "Passport" umgesetzt. Das OAuth Protokoll ermöglicht es einer Anwendung, 
auf Ressourcen eines Nutzers zuzugreifen, die bei einer anderen Anwendung gespeichert sind. Der
Benutzer muss hierzu nicht seine Zugangsdaten preisgeben, stattdessen autorisiert er die zugreifende
Anwendung für den Zugriff auf seine Ressourcen (weitere Informationen zum OAuth Protokoll finden Sie hier: https://de.wikipedia.org/wiki/OAuth).     
Im vorliegenden Beispiel soll ein NestJS Backend auf GitHub-Profilinformationen von Benutzern zugreifen
können, weshalb hierfür eine OAuth Anbindung an GitHub benötigt wird.

## Abhängigkeiten
Zunächst müssen die benötigten Pakete über den Paketmanager NPM installiert werden:

```shell
npm install --save @nestjs/passport passport passport-github2
npm install --save-dev @types/@types/passport-github2
```

Für jede Passport Strategie müssen immer die Pakete `@nestjs/passport` und `passport` installiert werden.
Zusätzlich muss dann das spezifische Paket, in diesem Fall `passport-github2` installiert werden.
Das Paket `passport-github` wurde seit einiger Zeit nicht mehr gepflegt, weshalb einige Features
nach einem API Upgrade seitens GitHub nicht mehr funktionieren. Aus diesem Grund wurde ein Fork für 
dieses Modul mit einigen Updates unter dem Namen `passport-github2` veröffentlicht.  
Das Paket `@types/passport-github2` beinhaltet die Typdefinitionen für TypeScript.

## Implementierung
Zuerst ist es sinnvoll, ein eigenes Modul für alle Dateien zu erstellen, die mit der Autorisierung
zusammenhängen:

```shell
nest g module auth
```
In dem Modul wird ein Service erstellt, der die Validierung des Benutzers vornehmen wird und
ein Controller, in dem die API Endpunkte definiert werden:

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
Der User Service ist dafür zuständig, einen Benutzer anhand seines Benutzernamens in der Datenbank
zu suchen oder bei Nichtauffinden anzulegen. Hierzu muss der `UserService` wie folgt implementiert
werden:

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
Im Mittelpunkt steht hier die Methode `findOrCreateOne`, die unter anderem einen GitHubbenutzernamen
erwartet und anhand dessen eine Abfrage an eine MongoDB Datenbank stellt, um den `User` als Objekt
zurückgeben zu können. Wenn für den Benutzer noch kein Eintrag in der DB existiert, wird dieser
angelegt. Hierzu wird auch das Access Token, das GitHub nach erfolgreicher Autorisierung übermitteln wird,
in der Datenbank für künftige Zugriffe gespeichert.  
Die `User` Klasse und die Datenbankschemaklasse `UserSchema`, die das Mongoose Paket für den 
Zugriff auf die MongoDB Collection benötigt, müssen vorher definiert werden und ist nicht Teil dieser
Anleitung.

### AuthService
Der `AuthService` ist dafür zuständig, die Authentifizierung eines Benutzers zu prüfen, also zum 
Beispiel die Korrektheit des Passworts zu verifizieren. Da in diesem Beispiel die Authentifizierung
zwischen dem Client und dem NestJS Backend über JSON Web Tokens (JWT) realisiert wird, enthält der 
Service keine Prüflogik. Er wird dennoch implementiert, um ein zukünftiges Austauschen des 
Authentifizierungsmechanismus zu ermöglichen:
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
Im `AuthController` wird ein login API-Endpunkt definiert, der von einer Frontendanwendung aufgerufen
werden kann:
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
Um die Autorisierung zu aktivieren, wird die Loginroute mit der Annotation `@UseGuards(AuthGuard('github2'))`
annotiert. Dies entspricht dem Namen der Passport Strategie, die für dieses Beispiel verwendet wird.
Beim Aufruf dieses Endpunkts wird der Nutzer zu GitHub weitergeleitet und muss dort die Autorisierung
erteilen. Nachdem diese erfolgt ist, wird er wieder zurückgeleitet. Hierzu wird ein redirect Endpunkt
definiert, der ein JSON Web Token erzeugt und dieses als Cookie dem Client Browser übersendet.
Der Parameter `request` enthält unter dem Schlüssel `user` das Userobjekt, das vom `AuthService`
als Ergebnis übergeben wird.

### GitHub Strategy
Zum Schluss muss nun die Passport strategy implementiert werden. Hierfür wird die Klasse 
`GithubStrategy` implementiert (Code siehe unten). Die Klasse erbt von `PassportStrategy` und beinhaltet die Konfiguration.
Nachdem der Nutzer nach Aufruf des Login API-Endpunkts die Autorisierung bei GitHub vorgenommen hat,
wird die Methode `validate` der Strategy aufgerufen. Der Rückgabewert wird das Userobjekt, das vom 
`AuthService` als Ergebnis übergeben wird. Dieses Objekt ist dann under `request.user` in der `redirect`
Methode im Controller verwendbar (siehe vorheriger Abschnitt). Die Parameter der `validate` Methode
werden automatisch bei der Weiterleitung des Nutzers von GitHub zurück zur NestJS Anwendung befüllt. 
Der Parameter `accessToken` stellt das Zugriffstoken dar, mit dem im Namen des Nutzers Daten von GitHub
abgerufen werden können. Dies muss bei jedem Aufruf der GitHub API im Authorization Header mitgesendet 
werden. Das Token behält seine Gültigkeit, bis der Nutzer den Zugriff in den Einstellungen seines GitHub
Kontos widerruft. Durch diese Designentscheidung durch GitHub ist das `refreshToken` nicht vorhanden bwz.
`undefined`. Das Access Token muss sicher verwaltet werden, weshalb dieses verschlüsselt in der 
Datenbank gespeichert wird. Es wird auch nicht an den Client als Cookie weitergereicht, um hier keinen
Angriffsvektor zu ermöglichen. Das Token wird nur von dem Nest Backend zur Kommunikation mit der GitHub API
benötigt. Der Parameter `profile` beinhaltet Profilinformationen des Nutzers.  
Die zur Konfiguration der Strategy im Konstruktor benötigten Parameter `clientID` und `clientSecret` 
erhält man bei der Registrierung der Anwendung als OAuth App bei GitHub (Nähere Informationen dazu:
https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app). Diese sensiblen
Daten werden in Umgebungsvariablen gespeichert, um sie nicht im Klartext im Coderepository abzulegen.
Der Parameter `callbackURL` entspricht der Route des `redirect` API Endpunkts, der im Controller definiert
wurde. Im Parameter `scope` kann definiert werden, worauf die Anwendung zugreifen will. Die 
Scopebezeichnungen von GitHub können hier nachgelesen werden: 
https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps.  
Der Code der Klasse `PassportStrategy`
sieht wie folgt aus:
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
Damit sind alle Teile der OAuth Anbindung fertig implementiert. Das Access Token wurde nach erfolgter
Autorisierung sicher in der Datenbank abgelegt und kann ab sofort für API Aufrufe verwendet werden.

# AppTitle
GitHub OAuth with NestJS

# AppType
Tutorial 

# AppPreviewContent
Dieses Tutorial liefert eine Anleitung, um Autorisierung über das OAuth Protokoll für Github zu
implementieren. Als Client dient ein NestJS Backend. Die Implementierung wird mithilfe der bekannten 
Express Bibliothek "Passport" umgesetzt.

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
