import setRoutes from "./routes/routes";


require('dotenv').config()
const express = require('express')
const serverless = require('serverless-http')
const bodyParser = require('body-parser')
const pool = require('./configs/dbConfig')
var cors = require('cors')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())

setRoutes(app, pool)

app.all('*', function (req, res) {
  const response = { data: null, message: 'Route not found!!' }
  res.status(400).send(response)
})

module.exports.hello = serverless(app)






