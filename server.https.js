const https = require("https");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cors = require("cors");
const WSS = require("ws").Server;
const uuid = require("uuid/v4");
const pem = require("pem");
const Filter = require('bad-words');

const filter = new Filter();

pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
  if (err) {
    throw err;
  }

  const app = express();

  app.use(logger("dev"));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(cors());
  app.use(express.static(path.join(__dirname, "public")));

  app.use(function(req, res, next) {
    const err = new Error("Not Found");
    err.status = 404;
    next(err);
  });

  app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};
    res.status(err.status || 500);

    if (req.xhr || Object.keys(req.headers).indexOf("postman-token") > -1) {
      return res.json({ message: err.message });
    }
    
    res.json({ message: err.message });
  });

  const server = https.createServer({ key: keys.serviceKey, cert: keys.certificate }, app);

  server.listen(8080);
  console.log("Server started at https://localhost:8080");

  const wss = new WSS({ server: server });
  const wsUsers = {};
  const messages = [];

  wss.on("connection", function(socket, req) {
    const id = uuid();
    wsUsers[id] = { name: "No Name", socket: socket };
    const json = JSON.stringify({ type: "userIdUpdate", id: id });
    socket.send(json);

    messages.forEach(function(message) {
      socket.send(JSON.stringify(message));
    });

    socket.on("message", function(message) {
      try {
        const msg = JSON.parse(message);

        switch (msg.type) {
          case "nameUpdate":
            wsUsers[id].name = msg.username;
            break;

          case "msgFromUser":
            var cleanedMsg = filter.clean(msg.message);
            var json = {
              type: "msgToUser",
              from_user: msg.from_user,
              message: cleanedMsg,
              time: msg.time,
              name: wsUsers[msg.from_user] ? wsUsers[msg.from_user].name : "Unknown"
            };

            if (wsUsers[msg.to_user]) {
              wsUsers[msg.to_user].socket.send(JSON.stringify(json));
            }
            break;

          case "chatRoomMessage":
            var cleanedMsg = filter.clean(msg.message);
            var chatRoomMessage = {
              type: "chatRoomMessageBroadcast",
              id: uuid(),
              from_user: msg.from_user,
              message: cleanedMsg,
              time: msg.time,
              name: wsUsers[msg.from_user] ? wsUsers[msg.from_user].name : "Unknown"
            };

            Object.keys(wsUsers).forEach(function(v) {
              if (v !== msg.from_user) {
                wsUsers[v].socket.send(JSON.stringify(chatRoomMessage));
              }
            });

            messages.push(chatRoomMessage);
            break;

          case "photoMessage":
            const photoMessage = {
              type: "photoMessage",
              id: uuid(),
              from_user: msg.from_user,
              photo_url: msg.photo_url,
              time: msg.time,
              name: wsUsers[msg.from_user] ? wsUsers[msg.from_user].name : "Unknown"
            };

            Object.keys(wsUsers).forEach(function(v) {
              if (v !== msg.from_user) {
                wsUsers[v].socket.send(JSON.stringify(photoMessage));
              }
            });

            messages.push(photoMessage);
            break;

          case "unsendMessage":
            const messageId = msg.messageId;
            const index = messages.findIndex(function(m) {
              return m.id === messageId;
            });

            if (index !== -1) {
              const deletedMessage = messages.splice(index, 1)[0];
              const unsendMessage = {
                type: "unsendMessage",
                id: uuid(),
                messageId: deletedMessage.id,
                time: msg.time
              };

              Object.keys(wsUsers).forEach(function(v) {
                wsUsers[v].socket.send(JSON.stringify(unsendMessage));
              });
            }
            break;

          case "editMessage":
            const editedMessage = {
              type: "editMessage",
              id: uuid(),
              messageId: msg.messageId,
              editedText: msg.editedText,
              time: msg.time,
              name: wsUsers[msg.from_user] ? wsUsers[msg.from_user].name : "Unknown"
            };

            const editIndex = messages.findIndex(function(m) {
              return m.id === msg.messageId;
            });

            if (editIndex !== -1) {
              messages[editIndex].message = msg.editedText;
              messages[editIndex].time = msg.time;

              Object.keys(wsUsers).forEach(function(v) {
                wsUsers[v].socket.send(JSON.stringify(editedMessage));
              });
            }
            break;

          default:
            console.log(message);
        }
      } catch (e) {
        console.log(e.message);
      }
    });

    socket.on("close", function() {
      const log = { userId: id, name: wsUsers[id].name };
      delete wsUsers[id];
      const json = JSON.stringify({ type: "userDisconnected", id: id });

      wss.clients.forEach(function each(client) {
        client.send(json);
      });

      console.log("Closed Connection " + JSON.stringify(log));
    });
  });

  const broadcast = function() {
    try {
      const users = Object.keys(wsUsers).map(id => ({ id, name: wsUsers[id].name }));
      const json = JSON.stringify({ type: "broadcast", total: wss.clients.length, clients_arr: users });

      wss.clients.forEach(function each(client) {
        client.send(json);
      });
    } catch (e) {
      console.log(e.message);
    }
  };

  setInterval(broadcast, 4000);
});
