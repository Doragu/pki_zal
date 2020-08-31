var express = require('express');
const { google } = require('googleapis');
const OAuth2Data = require('./google_key.json')

var app = express();

const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0]

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)

var authed = false;

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

app.get('/', (req, res) => {
  var response = '<nav class="navbar navbar-light bg-light"><span class="navbar-brand mb-0 h1">Navbar</span></nav><form method="get" action="/login"><button type="submit">Zaloguj</button></form>'
  res.send(response)
})


app.get('/login', (req, res) => {
  if (!authed) {
      // Generate an OAuth URL and redirect there
      const url = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: 'https://www.googleapis.com/auth/userinfo.profile'
      });
      console.log(url)
      res.redirect(url);
  } else {
      var oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
      oauth2.userinfo.v2.me.get(function(err, result) {
          if (err) {
              console.log('BŁĄD');
              console.log(err);
          } else {
              loggedUser = result.data.name;
              console.log(loggedUser);
              // updateDB(loggedUser)
          }
          res.send('Logged in: '.concat(loggedUser,' <img src="', result.data.picture, 
                  '"height="23" width="23"><br><form method="get" action="/logout"><button type="submit">Wyloguj</button></form>'));
      });
  } 
})


app.get('/logout', (req, res) => {
  authed = false;
  res.redirect(OAuth2Data.web.javascript_origins[0])
})


app.get('/auth/google/callback', function (req, res) {
  const code = req.query.code
  if (code) {
      // Get an access token based on our OAuth code
      oAuth2Client.getToken(code, function (err, tokens) {
          if (err) {
              console.log('Error authenticating')
              console.log(err);
          } else {
              console.log('Successfully authenticated');
              oAuth2Client.setCredentials(tokens);
              authed = true;
              res.redirect('/login')
          }
      });
  }
});


const port = process.env.PORT || 5000
app.listen(port, () => console.log(`Server running at ${port}`));