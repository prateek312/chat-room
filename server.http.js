var http = require('http');
// var https = require("https");
var path = require("path");
var express = require("express");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
//var helmet = require('helmet');
var logger = require("morgan");
var cors = require("cors");
var WSS = require("ws").Server;
const uuid = require("uuid/v4");
var pem = require("pem");

// pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
  /* if (err) {
    throw err;
  } */

  var app = express();
  app.use(logger("dev"));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(cors());
  app.use(express.static(path.join(__dirname, "public")));
  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    var err = new Error("Not Found");
    err.status = 404;
    next(err);
  });
  // error handler
  app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    if (req.xhr || Object.keys(req.headers).indexOf("postman-token") > -1) {
      return res.json({ message: err.message });
    }
		res.json({ message: err.message })
    //res.render("error");
  });

  /* var server = https.createServer(
    { key: keys.serviceKey, cert: keys.certificate },
    app
  ); */
	var server = http.createServer(app)
  // server.listen(8080, '127.0.0.1'); //server will provide access to localhost only ex: http://localhost:8080/
  // server.listen(8080, 'local.ip'); //server will provide access to given local IP, ex: http://local.ip:8080/ can be used in local LAN network
  server.listen(8080);
  console.log("Server started at https://localhost:8080");
  var wss = new WSS({ server: server });
  var wsUsers = {};
  wss.on("connection", function(socket, req) {
    //should be unique
    //var id = socket.upgradeReq.headers['sec-websocket-key'];
    var id = uuid();
    wsUsers[id] = { name: "No Name", socket: socket };
    var json = JSON.stringify({ type: "userIdUpdate", id: id });
    socket.send(json);

    socket.on("message", function(message) {
      //console.log('Received from client: ' + id + ' and message is : ' + message);
      try {
        var msg = JSON.parse(message);
        switch (msg.type) {
          case "nameUpdate":
            wsUsers[id].name = msg.username;
            break;
          case "msgFromUser":
            var json = {
              type: "msgToUser",
              from_user: msg.from_user,
              message: msg.message,
              time: msg.time,
              name: wsUsers[msg.from_user]
                ? wsUsers[msg.from_user].name
                : "Unknown"
            };
            if (wsUsers[msg.to_user]) {
              wsUsers[msg.to_user].socket.send(JSON.stringify(json));
            }
            break;
          case "chatRoomMessage":
            var json = {
                type: "chatRoomMessageBroadcast",
                from_user: msg.from_user,
                message: msg.message,
                time: msg.time,
                name: wsUsers[msg.from_user]
                  ? wsUsers[msg.from_user].name
                  : "Unknown"
              },
              users = Object.keys(wsUsers);
            users.forEach(function(v) {
              if (v != msg.from_user) {
                wsUsers[v].socket.send(JSON.stringify(json));
              }
            });
            break;
          default:
            console.log(message);
        }
      } catch (e) {
        console.log(e.message);
      }
    });

    socket.on("close", function() {
      var log = { userId: id, name: wsUsers[id].name };
      delete wsUsers[id];
      var json = JSON.stringify({
        type: "userDisconnected",
        id: id
      });
      wss.clients.forEach(function each(client) {
        client.send(json);
      });
      console.log("Closed Connection " + JSON.stringify(log));
    });
  });
  var broadcast = function() {
    try {
      var users = [],
        arr = Object.keys(wsUsers);
      arr.forEach(function(id) {
        users.push({ id: id, name: wsUsers[id].name });
      });
      var json = JSON.stringify({
        type: "broadcast",
        total: wss.clients.length,
        clients_arr: users
      });

      wss.clients.forEach(function each(client) {
        client.send(json);
      });
    } catch (e) {
      console.log(e.message);
    }
  };
  setInterval(broadcast, 4000);
// });
