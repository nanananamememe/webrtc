const express = require("express");
const app = express();
const path = require('path');
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(path.join(__dirname, "public")));

app.get('/' , function(req, res){
    res.sendFile(__dirname+'/public/index.html');
});


if ("local" == process.env.NODE_ENV) {
//  const port = 443;
  const https = require('https');
  const fs = require('fs');
  const serverConfig = {
    // SSL証明書、環境に合わせてパスを変更する
    key: fs.readFileSync('privkey.pem'),
    cert: fs.readFileSync('cert.pem')
  };
  // HTTPSサーバの開始
//  var server = https.createServer(serverConfig, app);
//  server.listen(port, '0.0.0.0');

} else {
  const port = 80;
  app.listen(port);
}

// 接続リスト
let connections = [];

// WebSocket処理
const socketProc = function(ws, req) {
  ws._pingTimer = setInterval(function() {
console.log(ws.readyState);
    if (ws.readyState === 4) {
      // 接続確認
      ws.emit("message", JSON.stringify({ping: 1}));
    }
  }, 180000);

  ws.on('message', function(message) {
    const json = JSON.parse(message);
    if (json.open) {
      console.log('open: ' + ws._socket.remoteAddress + ': local=' + json.open.local + ', remote=' + json.open.remote);
      // 同一IDが存在するときは古い方を削除
      connections = connections.filter(data => !(data.local === json.open.local && data.remote === json.open.remote));
      // 接続情報を保存
      connections.push({local: json.open.local, remote: json.open.remote, ws: ws});
      connections.some(data => {
console.log(ws.readyState);
        if (data.local === json.open.remote && data.ws.readyState === 4) {
          // 両方が接続済の場合にstartを通知
          data.ws.emit('message', JSON.stringify({start: 'answer'}));
          ws.emit('message', JSON.stringify({start: 'offer'}));
          return true;
        }
      });
      return;
    }
    if (json.pong) {
      return;
    }
    if (json.ping) {
console.log(ws.readyState);
      if (ws.readyState === 4) {
        ws.emit('message', JSON.stringify({pong: 1}));
      }
      return;
    }
    // 対向の接続を検索
    connections.some(data => {
console.log(ws.readyState);
      if (data.local === json.remote && data.ws.readyState === 4) {
        // シグナリングメッセージの転送
        data.ws.emit('message', JSON.stringify(json));
        return true;
      }
    });
  });

  ws.on('close', function () {
    closeConnection(ws);
    console.log('close: ' + ws._socket.remoteAddress);
  });

  ws.on('error', function(error) {
    closeConnection(ws);
    console.error('error: ' + ws._socket.remoteAddress + ': ' + error);
  });

  function closeConnection(conn) {
    connections = connections.filter(data => {
      if (data.ws !== conn) {
        return true;
      }
      connections.some(remoteData => {
console.log(ws.readyState);
        if (remoteData.local === data.remote && remoteData.ws.readyState === 4) {
          // 対向に切断を通知
          remoteData.ws.emit('message', JSON.stringify({close: 1}));
          return true;
        }
      });
      data.ws = null;
      return false;
    });
    if (conn._pingTimer) {
      clearInterval(conn._pingTimer);
      conn._pingTimer = null;
    }
  }
};

// WebSocketの開始
//const wss = new WebSocket.Server({"server": server});
//wss.on('connection', socketProc);
io.on('connection', socketProc);

http.listen(80, function(){
    console.log('server listening.');
});
