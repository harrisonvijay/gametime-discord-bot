// using express to keep the bot alive
// even if replit is closed

const express = require("express");
const server = express();

// uptimerobot service will ping this route periodically
// so that replit won't shut down the console due to inactivity

server.all("/", (req, res) => {
    res.send("Bot is running.");
});

function keepAlive() {
    server.listen(3000, () => {
        console.log("Server is ready.")
    });
}

module.exports = keepAlive;