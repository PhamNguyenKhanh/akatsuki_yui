import net from "node:net";

export interface CapturedSmtpMessage {
  mailFrom: string;
  rcptTo: string[];
  rawData: string;
  receivedAt: string;
}

export interface MockSmtpServerHandle {
  port: number;
  messages: CapturedSmtpMessage[];
  setFailMode: (mode: "ok" | "transient-421" | "drop-after-data") => void;
  close: () => Promise<void>;
}

/**
 * Starts a minimal deterministic local SMTP server on 127.0.0.1 for E2E tests
 * so NotificationDelivery workflows run offline with zero external network emails.
 */
export async function startMockSmtpServer(port = 2525): Promise<MockSmtpServerHandle> {
  const messages: CapturedSmtpMessage[] = [];
  let mode: "ok" | "transient-421" | "drop-after-data" = "ok";

  const server = net.createServer((socket) => {
    let buffer = "";
    let inData = false;
    let mailFrom = "";
    let rcptTo: string[] = [];
    let dataLines: string[] = [];

    socket.write("220 localhost ESMTP MockSmtp\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      while (true) {
        const idx = buffer.indexOf("\r\n");
        if (idx === -1) break;
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            if (mode === "drop-after-data") {
              socket.destroy();
              return;
            }
            messages.push({
              mailFrom,
              rcptTo: [...rcptTo],
              rawData: dataLines.join("\r\n"),
              receivedAt: new Date().toISOString(),
            });
            socket.write("250 2.0.0 OK queued in mock-smtp\r\n");
          } else {
            dataLines.push(line);
          }
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (upper.startsWith("AUTH ")) {
          socket.write("235 2.7.0 Authentication successful\r\n");
        } else if (upper.startsWith("MAIL FROM:")) {
          if (mode === "transient-421") {
            socket.write("421 4.3.0 Mock transient SMTP throttle\r\n");
            continue;
          }
          mailFrom = line.slice(10).trim();
          rcptTo = [];
          dataLines = [];
          socket.write("250 2.1.0 Ok\r\n");
        } else if (upper.startsWith("RCPT TO:")) {
          rcptTo.push(line.slice(8).trim());
          socket.write("250 2.1.5 Ok\r\n");
        } else if (upper === "DATA") {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
          return;
        } else {
          socket.write("250 Ok\r\n");
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    port,
    messages,
    setFailMode(nextMode) {
      mode = nextMode;
    },
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
