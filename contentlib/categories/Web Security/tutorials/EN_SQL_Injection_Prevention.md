<!--CONFIG-START-->
# AppTitle
SQL Injection - Prevention in Angular, NodeJS und Java
# AppType
Tutorial
# AppPreviewContent

# AppAuthors
- TheRealMephisto

# AppPreviewPicture
https://secguru.dev.azcld.advisori.de/assets/defaultTutorial.png

# AppLanguage
EN

# AppTags

- Web
- SQL Injection
- Prevention
- Angular
- NodeJS
- mysql
- sequelize
- TypeScript

<!--CONFIG-END-->

# SQL Injection - Prevention in Angular and NodeJS

This article aims to provide a non-exhaustive list of steps to follow in order to prevent sql injection attacks for applications built with Angular in combination with NodeJS.

## Preventing SQL injections client-side (using Angular)

It's important to note that SQL injection attacks are primarily a server-side concern rather than a client side one. Server-side is also where the prevention mechanisms need to be implemented, as client side prevention can often be bypassed by a skilled attacker.

Nevertheless, there are still some steps that can raise the bar for the attacker. Some of them even increase the user experience of the application. After all, they increase awareness for this attack type.

Those are enough good reasons to implement some SQL injection programmatically in the frontend. So let's get started!

### Minimize the risk

Here are some steps you can use in your Angular application in order to minimize the risk of a successful SQL injection attack:

1. <strong>Input Validation</strong>
<br>
Implement input validation on the client-side to ensure that user input adheres to the expected format. Angular provides built-in form validation mechanisms, such as validators, to validate user input. Validate input before sending it to the server, which adds an extra layer of defense against potential SQL injection attacks.<br>
<br>
As an example, imagine you are building a login page using the angular forms for your application. Assume that usernames are equal to mail addresses per application design.<br>
The following code snippet shows how to use Angulars validators in order to prevent input that is not a valid email adress.

    ```typescript
    // Example form control with input validation
    import { Validators, FormControl } from '@angular/forms';

    const usernameFormControl = new FormControl('', [
      Validators.required,
      Validators.eMail
      // Add more validators as required
    ]);
    ```


2. <strong>Never construct SQL Queries client-side</strong>
<br>
Avoid constructing SQL queries dynamically on the client-side using user input. Instead, send the user input securely to the server and let the server handle the SQL query construction using parameterized queries or prepared statements.

3. <strong>Secure API Communication</strong>
<br>
Ensure that the communication between your Angular application and the server is secure. Use HTTPS for all API calls to encrypt the data transmitted between the client and the server. This helps protect sensitive information, including user input, from potential eavesdropping or tampering.
<br>
Use POST requests instead of GET requests, as the latter can be easily modified directly in the browser url.
<br>
Here's an example of making an HTTPS API call per POST request using Angular's HttpClient:
<br>
    ```typescript
    import { HttpClient } from '@angular/common/http';

    // Example HTTP post request using HttpClient
    this.http.post('https://api.example.com/data', requestData, { headers: { 'Content-Type': 'application/json' } })
      .subscribe(response => {
        // Handle the response
      }, error => {
        // Handle any errors
      });
    ```

4. <strong>Regularly Update Dependencies</strong>
<br>
Keep your Angular dependencies up to date, including HTTP client libraries and other relevant packages. Developers often release updates that address security vulnerabilities, including those related to input validation and sanitization. Stay current with these updates to ensure that you have the latest security enhancements in place.

Remember, preventing SQL injection attacks is primarily a server-side concern, and these steps should be implemented in conjunction with robust server-side measures to ensure the security of your application.

## Preventing SQL injections server-side (written with NodeJS using TypeScript)

Your application backend should be designed to receive user input via secure https communication.
<br>Nevertheless, an attacker might find a way to communicate with your API, bypassing the client-side prevention mechanisms. This could be achieved by intercepting the https communication, which allows for manipulation of the user input values.
<br>
Therefore, the really important steps for prevention of SQL injection attacks have to happen in the backend of your application.
<br>
<br>
Here is a non-exhaustive checklist for you to follow, in order to achieve a good level of SQL injection prevention:

1. Validate and sanitize user input on the server-side.
<br>
Example:

    ```typescript
    import { isEmail } from 'validator';

    const email: string = req.body.email;

    if (isEmail(email)) {
      // Valid email, proceed with the query
    } else {
      // Invalid email, handle the error
    }
    ```

2. Avoid constructing SQL queries dynamically. Instead, use parameterized queries or ORM libraries.
<br>
    - The following simplified code snippet gives an example on how to parametrize a SQL query with the <strong>`mysql`</strong> library:

        ```typescript
        import mysql from 'mysql';

        // Adjust the parameters according to your setup
        const connection = mysql.createConnection({
          host: 'localhost',
          user: 'your_user',
          password: 'your_password',
          database: 'your_database'
        });

        const username: string = req.body.username;
        const password: string = req.body.password;
        const query: string = 'SELECT * FROM users WHERE username = ? AND password = ?';
        connection.query(query, [userId, password], (error, results) => {
          if (error) {
            // Handle the error
          } else {
            // Handle the query results
          }
        });
        ```
    - Here's another code snippet, providing an example on how to parametrize a SQL query using the <strong>`sequelize`</strong> ORM library, interacting with a mysql database:

        ```typescript
        import { Sequelize, Model, DataTypes } from 'sequelize';

        // Adjust the parameters according to your setup
        const sequelize = new Sequelize('database', 'username', 'password', {
          dialect: 'mysql',
          host: 'localhost'
        });

        class User extends Model {}
        User.init(
          {
            username: DataTypes.String,
            birthday: DataTypes.Date
            // ... other fields
          },
          { sequelize, modelName: 'user' }
        );

        const userName: number = req.body.userName;
        User.findAll({
          where: {
            username: userName
          }
        }).then((users: User[]) => {
          // Handle the query results
        });
        ```

3. Limit the privileges of the database user account used by your Node.js application.

4. Regularly update libraries and packages, including database libraries and ORM frameworks.

Please refer to the documentation of the mentioned libraries for more details.