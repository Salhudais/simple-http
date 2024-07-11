const net = require("net");
const fs = require('fs');
const zlib = require('zlib');

const server = net.createServer((socket) => {
  socket.on("data", (request) => {
    let lines = request.toString().split("\r\n");
    let path = lines[0].split(' ')[1];

    if(path === '/') {
      console.log('Sending 200 OK response');
      socket.write("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nHello, World!", (err) => {
        if (err) console.error('Error writing to socket:', err);
        else console.log('Response sent successfully');
      });

    } else if (path.startsWith('/echo/')){
      const word = path.split('/')[2];
      let header = '';
      for(let line of lines) {
        if(line.toLowerCase().startsWith('accept-encoding')) {
          header = line.split(':')[1].trim().split(', ');
          break;
        }
      }
      if(header.includes('gzip')) {
        zlib.gzip(word, (err, compressed) => {
          if(err) {
            console.log('Gzip compression error: ', err);
            sendUncompressedMessage(socket, word);
          } else {
            sendCompressedMessage(socket, compressed, 'gzip');
          }
        });
      } else {
        sendUncompressedMessage(socket, word);
      }

    } else if(path === '/user-agent') {
      let header = lines[2];
      if(header.startsWith('User-Agent:')) {
        const value = header.split(' ')[1];
        socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${String(value.length)}\r\n\r\n${value}`);
      }
    } else if(path.startsWith("/files/")) {
      const fileName = path.split('/')[2];
      const fileDirectory = process.argv[3];
      const filePath = `${fileDirectory}/${fileName}`;
      const requestType = lines[0].split(' ')[0];

      if(requestType === 'GET') {
        if(fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const contentLength = content.length;
  
          socket.write(`HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${contentLength}\r\n\r\n`);
          socket.write(content);
        } else {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        }
      } else if(requestType === 'POST') {
        const fileContent = lines[lines.length -1];
        fs.writeFile(filePath, fileContent, (err) => {
          if (err) {
            console.log('Error writing file:', err);
          } else {
            console.log('File has been created successfully');
            socket.write("HTTP/1.1 201 Created\r\n\r\n");
          }
        })
      }
    }
    else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    }
  });

  socket.on("close", () => {
    socket.end();
  });

});

server.listen(4221, "localhost", () => {
  console.log("Server is running on http://localhost:4221");

});

function sendUncompressedMessage(socket, word) {
  socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(word)}\r\n\r\n${word}`);
  socket.end();
}

function sendCompressedMessage(socket, compressed, encoding) {
  socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n`);
  socket.write(compressed);
  socket.end();
}