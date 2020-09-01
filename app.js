var express = require('express');
const { google } = require('googleapis');
const OAuth2Data = require('./google_key.json')

var app = express();

const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[1]

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)

var authed = false;
var username = ""

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

app.set('views', __dirname + '/views')
app.set('view engine', 'pug');
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('start_page', {username: username});
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
              username = result.data.name;
          }
          res.redirect('/logged');
      });
  } 
})

app.get('/logged', (req, res) => {
  getTableNames((queryResult) => {
    res.render('logged', {username: username, queryResult: queryResult});
  })
})

function getTableNames(callback) {
  queryResult = '<ul>'

  client.query(`SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public'`, (error, result) => {
    if (error) {
      throw error
    } 

    for (let row of result.rows) {
      queryResult = queryResult.concat("li" + JSON.stringify(row))
    }

    queryResult = queryResult.concat("</ul>")
      
    callback(queryResult)
  })
}

app.get('/logout', (req, res) => {
  authed = false;
  username = ""
  res.redirect(OAuth2Data.web.javascript_origins[1])
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