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
var queryResult = []

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

client.connect();

app.set('views', __dirname + '/views')
app.set('view engine', 'pug');
app.use(express.static('public'))

var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({
  extended: true
})); 


app.get('/', (req, res) => {
  if (username != "") {
    getTableNames((queryResult) => {
      res.render('start_page', {username: username, queryResult: queryResult});
    })
  } else {
    res.render('start_page', {username: username, queryResult: queryResult});
  }
})


app.get('/login', (req, res) => {
  if (!authed) {
      // Generate an OAuth URL and redirect there
      const url = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: 'https://www.googleapis.com/auth/userinfo.profile'
      });
      res.redirect(url);
  } else {
      var oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
      oauth2.userinfo.v2.me.get(function(err, result) {
          if (err) {
              console.log(err);
          } else {
              username = result.data.name;
          }
          res.redirect('/');
      });
  } 
})


app.get('/logout', (req, res) => {
  authed = false;
  username = ""
  queryResult = []
  res.redirect(OAuth2Data.web.javascript_origins[1])
})


app.get('/view_page', (req, res) => {
  if (username != "") {
    var selectedTable = req.query.selectTable
    getTableData((queryResult, rawQueryResult) => {
      res.render('view_page', {username: username, columnNames: queryResult[0], queryData: queryResult.slice(1), rawQueryResult: rawQueryResult, selectedTable: selectedTable});
    }, selectedTable)
  } else {
    res.redirect("/")
  }
})

app.post('/view_page', (req, res) => {
  if (username != "") {
    console.log(req.body)
    updateTableData((queryResult, rawQueryResult) => {
      res.render('view_page', {username: username, columnNames: queryResult[0], queryData: queryResult.slice(1), rawQueryResult: rawQueryResult, selectedTable: req.query.selectTable});
    }, req.body)
  } else {
    res.redirect("/")
  }
})

app.get('/auth/google/callback', function (req, res) {
  const code = req.query.code
  if (code) {
      // Get an access token based on our OAuth code
      oAuth2Client.getToken(code, function (err, tokens) {
          if (err) {
              console.log(err);
          } else {
              oAuth2Client.setCredentials(tokens);
              authed = true;
              res.redirect('/login')
          }
      });
  }
});


function getTableNames(callback) {
  queryResult = []
  client.query(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`, (error, result) => {
    if (error) {
      throw error
    }
    
    for (let row of result.rows) {
      queryResult.push(JSON.stringify(row.tablename))
    }
    callback(queryResult)
  })
}

function getTableData(callback, tableName) {
  queryResult = []
  client.query(`SELECT * FROM public.`.concat(tableName), (error, result) => {
    if (error) {
      callback(queryResult, error)
    }

    columns = []
    for (let column of result.fields) {
      columns.push(column.name)  
    }
    queryResult.push(columns)

    for (let row of result.rows) {
      result_row = []
      for (let column of columns) {
        result_row.push(row[column])  
      }   
      queryResult.push(result_row)
    }

    callback(queryResult, result)
  })
}

function updateTableData(callback, params) {
  queryResult = []
  if (params.id != "") {
    data = JSON.parse(JSON.stringify(params))

    queryBuilder = {
      "Dodaj": getInsertQuery(data),
      "Modyfikuj": getUpdateQuery(data),
      "Usuń": getDeleteQuery(data)
    }

    client.query(queryBuilder[params.selectOption], (error, result) => {
      if (error) {
        callback(queryResult, error)
      }

      callback(queryResult, result)
    })
  }
}

function getInsertQuery(data) {
  columns = data["columns"].slice(2,-2).replace(/","/g, ",")
  insert_query = `INSERT INTO public.${data.selectTable.slice(1, -1)}(${columns}) VALUES (`
  
  for (let column of columns.split(",")) {
    if (isNormalInteger(data[column])) {
      insert_query = insert_query.concat(data[column]).concat(',')
    } else {
      insert_query = insert_query.concat(`'${data[column]}'`).concat(',')
    }
  } 

  insert_query = insert_query.slice(0, -1) + ');'

  return insert_query
}

function getUpdateQuery(data) {
  columns = data["columns"].slice(2,-2).replace(/","/g, ",")
  update_query = `UPDATE public.${data.selectTable.slice(1, -1)} SET `
  
  for (let column of columns.split(",")) {
    if (isNormalInteger(data[column])) {
      update_query = update_query.concat(`${column}=${data[column]}`).concat(',')
    } else {
      update_query = update_query.concat(`${column}='${data[column]}'`).concat(',')
    }
  } 
  update_query = update_query.slice(0, -1) + ` WHERE id=${data["id"]};`

  return update_query
}

function getDeleteQuery(data) {
  delete_query = `DELETE FROM public.${data.selectTable.slice(1, -1)} `
  
  delete_query = delete_query.concat(`WHERE id=${data["id"]};`)

  return delete_query
}

function isNormalInteger(str) {
  var n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

const port = process.env.PORT || 5000
app.listen(port, () => console.log(`Server running at ${port}`));