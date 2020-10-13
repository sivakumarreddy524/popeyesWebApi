const mysql2 = require('mysql')
let orderpool = mysql2.createPool({
  connectionLimit: 10,
  host: process.env.order_host,
  user: process.env.order_user,
  password: process.env.order_password,
  database: process.env.order_database,
})

module.exports = orderpool