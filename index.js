/* Imports and Permissions */
const Discord = require("discord.js");
const client = new Discord.Client({ ws: { intents: new Discord.Intents(Discord.Intents.ALL) } });
const mongoose = require("mongoose");
const keepAlive = require("./server");
require("dotenv").config();

/* Connecting to database */
mongoose.connect(process.env.ATLAS_URL, { useNewUrlParser: true, useUnifiedTopology: true });

/* Schemas and Models */
const LeaderboardSchema = new mongoose.Schema({
    serverId: String,
    scores: [
        {
            playerId: String,
            playerName: String,
            playerScore: Number
        }
    ]
});

const Leaderboard = mongoose.model("Leaderboard", LeaderboardSchema);

const CurrentGameSchema = new mongoose.Schema({
    serverId: String,
    scores: [
        {
            playerId: String,
            playerName: String,
            playerScore: Number
        }
    ]
});

const CurrentGame = mongoose.model("CurrentGame", CurrentGameSchema);

const ServerSchema = new mongoose.Schema({
    serverId: String
});

const Server = mongoose.model("Server", ServerSchema);

/* Useful variables */

const helpMessage = "the available commands are $hello, $rolldice, $rolldice2, $getrandom, $randomorder, $newgame, $currentgamescores, $cancelgame, $endgame, $leaderboard, $addscores and $randomassign. Type $help followed by the command without the $ to get to know more.";

const helpObject = {
    "hello": "$hello just greets you back.",
    "rolldice": "$rolldice returns a random number between 1 and 6 (inclusive)",
    "rolldice2": "$rolldice2 returns two random numbers between 1 and 6 (inclusive)",
    "getrandom": "$getrandom takes in 2 values. Ex: $getrandom 1 10. This returns a random number between 1 and 10 (inclusive)",
    "randomorder": "$randomorder takes in a list of values. Ex: $randomorder val1 val2 val3. This returns the passed values in a shuffled order",
    "newgame": "$newgame takes in a list of mentions (@username) or the word 'all'. It starts a new game and sets the list of mentions as the players. Specifying 'all' would add all the online members to the list.",
    "currentgamescores": "$currentgamescores returns the scoreboard of the current game (if active)",
    "cancelgame": "$cancelgame ends the game and deletes the current game's scoreboard",
    "endgame": "$endgame ends the game and adds the scores of the current game to the overall leaderboard",
    "leaderboard": "$leaderboard displays the overall leaderboard of the server",
    "addscores": "$addscores takes in pair of values. Ex: $addscores @mention1 5 @mention2 10. This adds 5 to the score of @mention1 and adds 10 to the score of @mention2 (if there is an active game)",
    "randomassign": "$randomassign takes in pair of values. Ex: $randomassign role1 1 role2 5. This creates 6 roles and assigns to the players of the current game. Note: The number of players should match the number of roles and there should be an active game. Also, 'role' here isn't the same as Discord roles. All the players must also allow private DMs from this server. This can be enabled in the server's private settings."
};

const roles = ["Gold", "Silver", "Bronze"];

const colors = ["#d4af37", "#9fa5ac", "#cd7f32"];

/* Helper functions */

// returns a random integer from the passed range
function getRandomInt(start, end) {
    return Math.floor(Math.random() * (end - start + 1)) + start;
}

// returns a shuffled copy of the passed array
function shuffle(array) {
    let copyOfArray = array;
    copyOfArray.sort(() => Math.random() - 0.5);
    return copyOfArray;
}

// returns the ID of the user given the mention
function getId(mention) {
    let id = "";
    for (var i = 0; i < mention.length; i++) {
        if (!isNaN(mention.charAt(i))) {
            id += mention.charAt(i);
        }
    }
    return id;
}

// returns the name of the user given the ID
async function getName(id) {
    const player = await client.users.fetch(id);
    return player.username.toString();
}

// creates new scoreboard for the active game
async function newGame(messageServerId, players) {
    let scoresArray = [];
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var id = getId(player);
        var name = await getName(id);
        scoresArray.push({
            playerId: id,
            playerName: name,
            playerScore: 0
        });
    }
    const currGame = new CurrentGame({
        serverId: messageServerId,
        scores: scoresArray
    });
    await currGame.save();
}

// assigns the list of items passed to it randomly to the players of an active game
// Note: "roles" here means something else. Not the discord roles.
async function assign(guild, roles) {
    var messageServerId = guild.id;
    const currGame = await CurrentGame.findOne({ serverId: messageServerId });
    if (currGame === null || currGame === undefined) {
        return 3;
    }
    let fullRoles = [];
    try {
        for (var i = 0; i < roles.length; i += 2) {
            var ct = Number(roles[i + 1]);
            if (isNaN(ct)) {
                return 4;
            }
            while (ct--) {
                fullRoles.push(roles[i]);
            }
        }
    }
    catch {
        return 4;
    }
    const scores = currGame.scores;
    if (scores.length !== fullRoles.length) {
        return 2;
    }

    //DM the assigned item/role after shuffling
    var shuffledRoles = shuffle(fullRoles);
    for (var i = 0; i < scores.length; i++) {
        var playerId = scores[i].playerId;
        var player = await guild.members.fetch(playerId);
        try {
            await player.send("You are assigned " + shuffledRoles[i]);
        }
        catch (exception) {
            console.log(exception);
            return 5;
        }

    }
    return 1;
}

// deletes the scoreboard of the active game
async function cancelGame(messageServerId) {
    const foundGame = await CurrentGame.findOne({ serverId: messageServerId });
    if (foundGame === null) {
        return false;
    }
    await CurrentGame.deleteOne({ serverId: messageServerId });
    return true;
}

// updates the scoreboard for an active game
async function setScores(messageServerId, scoresArray) {
    const foundGame = await CurrentGame.findOne({ serverId: messageServerId });
    if (foundGame === null) {
        return 0;
    }
    const newScoresArray = foundGame.scores;
    for (var i = 0; i < newScoresArray.length; i++) {
        for (var j = 0; j < scoresArray.length; j += 2) {
            var playerId = getId(scoresArray[j]);
            var playerScore = Number(scoresArray[j + 1]);
            if (playerId == newScoresArray[i].playerId) {
                newScoresArray[i].playerScore += playerScore;
            }
        }
    }
    await CurrentGame.updateOne({ serverId: messageServerId }, { scores: newScoresArray });
    return 1;
}

// returns the scoreboard for the active game
async function getCurrentScore(messageServerId) {
    const sb = await CurrentGame.findOne({ serverId: messageServerId });
    if (sb === null) {
        return null;
    }
    const scores = sb.scores;
    var reply = "";
    scores.sort((a, b) => b.playerScore - a.playerScore);
    scores.forEach((score, i) => {
        reply += (i + 1) + ". <@" + score.playerId + "> - " + score.playerScore + "\n";
    })
    return reply;
}

// takes two scoreboards and merges them
function matchAndReturn(board1, board2) {
    var flag = false;
    var score;
    const scoresArray = [];
    const board1Scores = board1.scores;
    const board2Scores = board2.scores;
    for (var i = 0; i < board1Scores.length; i++) {
        flag = false;
        for (var j = 0; j < board2Scores.length; j++) {
            if (board1Scores[i].playerId === board2Scores[j].playerId) {
                flag = true;
                score = board1Scores[i].playerScore + board2Scores[j].playerScore;
                scoresArray.push({ playerId: board1Scores[i].playerId, playerName: board1Scores[i].playerName, playerScore: score });
                break;
            }
        }
        if (!flag) {
            scoresArray.push(board1Scores[i]);
        }
    }
    return scoresArray;
}

// creates an empty leaderboard and adjusts member list
async function createOrAdjustLeaderBoard(messageServerId, players) {
    const lb = await Leaderboard.findOne({ serverId: messageServerId });
    var scoresArray;
    if (lb === null) {
        scoresArray = [];
        for (var i = 0; i < players.length; i++) {
            var id = players[i].user.id;
            var name = players[i].user.username;
            scoresArray.push({
                playerId: id,
                playerName: name,
                playerScore: 0
            });
        }
        const sb = new Leaderboard({
            serverId: messageServerId,
            scores: scoresArray
        });
        await sb.save();
    } else {
        const existingPlayers = lb.scores;
        scoresArray = [];
        var score;
        for (var i = 0; i < players.length; i++) {
            var id = players[i].user.id;
            var name = players[i].user.username;
            score = 0;
            for (var j = 0; j < existingPlayers.length; j++) {
                if (existingPlayers[j].playerId === id) {
                    score = existingPlayers[j].playerScore;
                    break;
                }
            }
            scoresArray.push({
                playerId: id,
                playerName: name,
                playerScore: score
            });
        }
        await Leaderboard.updateOne({ serverId: messageServerId }, { scores: scoresArray })
    }
    return scoresArray;
}

// resets the leaderboard
async function resetLeaderBoard(messageServerId) {
    const lb = await Leaderboard.findOne({ serverId: messageServerId });
    if (lb === null) {
        return;
    }
    const scoresArray = lb.scores;
    for (var i = 0; i < scoresArray.length; i++) {
        scoresArray[i].playerScore = 0;
    }
    await Leaderboard.updateOne({ serverId: messageServerId }, { scores: scoresArray });
}

// fetches the leaderboard
async function getLeaderBoard(messageServerId) {
    var sb = await Leaderboard.findOne({ serverId: messageServerId });
    if (sb === null) {
        return null;
    }
    const scores = sb.scores;
    var reply = "";
    scores.sort((a, b) => b.playerScore - a.playerScore);
    scores.forEach((score, i) => {
        reply += (i + 1) + ". <@" + score.playerId + "> - " + score.playerScore + "\n";
    })
    return reply;
}

// updates the overall leaderboard with the passed scoreboard
async function createOrUpdateLeaderboard(messageServerId, foundGame) {
    const foundBoard = await Leaderboard.findOne({ serverId: messageServerId });
    if (foundBoard === null) {
        var newBoard = new Leaderboard({
            serverId: messageServerId,
            scores: foundGame.scores
        });
        await newBoard.save();
        return;
    }
    const newScores = matchAndReturn(foundBoard, foundGame);
    await Leaderboard.updateOne({ serverId: messageServerId }, { scores: newScores });
}

// saves the current game scores to the overall leaderboard and ends the game
async function saveCurrentGameScore(messageServerId) {
    const foundGame = await CurrentGame.findOne({ serverId: messageServerId });
    if (foundGame === null) {
        return false;
    }
    await createOrUpdateLeaderboard(messageServerId, foundGame);
    await CurrentGame.deleteOne({ serverId: messageServerId });
    return true;
}

// takes care of the role assignment based on the leaderboard
async function checkOrCreateAndAssignRoles(guild, scoresArray, players) {
    var rolesArray = [];
    for (var i = 0; i < 3; i++) {
        var role = await guild.roles.cache.find(role => role.name == roles[i]);
        if (role !== undefined && role !== null) {
            //roles exist
        } else {
            await guild.roles.create({
                data: {
                    name: roles[i],
                    color: colors[i]
                },
                reason: "Role for leaderboard"
            });
            console.log("Created new role " + roles[i]);
            role = await guild.roles.cache.find(role => role.name == roles[i]);
        }
        rolesArray.push(role);
    }
    scoresArray.sort((a, b) => b.playerScore - a.playerScore);
    var goldMembers = [];
    var silverMembers = [];
    var bronzeMembers = [];
    var goldScore = 0, silverScore = 0, bronzeScore = 0;
    scoresArray.forEach((player) => {
        var scr = player.playerScore;
        if (scr != 0) {
            if (goldScore == 0) {
                goldScore = scr;
            } else if (scr != goldScore && silverScore == 0) {
                silverScore = scr;
            } else if (scr != goldScore && scr != silverScore && bronzeScore == 0) {
                bronzeScore = scr;
            }

            if (goldScore != 0 && scr == goldScore) {
                goldMembers.push(player.playerId);
            } else if (silverScore != 0 && scr == silverScore) {
                silverMembers.push(player.playerId);
            } else if (bronzeScore != 0 && scr == bronzeScore) {
                bronzeMembers.push(player.playerId);
            }
        }
    });
    for (var i = 0; i < players.length; i++) {
        for (var j = 0; j < rolesArray.length; j++) {
            await players[i].roles.remove(rolesArray[j]);
        }
    }
    for (var i = 0; i < goldMembers.length; i++) {
        var id = goldMembers[i];
        var member = players.find((player) => player.user.id == id);
        if (member == undefined || member == null)
            continue;
        await member.roles.add(rolesArray[0]);
    }
    for (var i = 0; i < silverMembers.length; i++) {
        var id = silverMembers[i];
        var member = players.find((player) => player.user.id == id);
        if (member == undefined || member == null)
            continue;
        await member.roles.add(rolesArray[1]);
    }
    for (var i = 0; i < bronzeMembers.length; i++) {
        var id = bronzeMembers[i];
        var member = players.find((player) => player.user.id == id);
        if (member == undefined || member == null)
            continue;
        await member.roles.add(rolesArray[2]);
    }
}

// creates leaderboard, updates member list, assigns roles based on leaderboard
async function adjustingTasks(guild) {
    let players = [];
    var members;
    await guild.members.fetch().then(data => members = data);
    members.forEach((ele) => { if (!ele.user.bot) players.push(ele) });
    const scoresArray = await createOrAdjustLeaderBoard(guild.id, players);
    await checkOrCreateAndAssignRoles(guild, scoresArray, players);
}

// sets up the contents of the database initially
async function initiateIfNot(guild) {
    var messageServerId = guild.id;
    const foundServer = await Server.findOne({ serverId: messageServerId });
    if (foundServer === null || foundServer === undefined) {
        const newServer = new Server({
            serverId: messageServerId
        });
        await newServer.save();
        await adjustingTasks(guild);
    }
}

/* Event Listeners */

// when the bot is up and running
client.on("ready", () => {
    console.log("Logged in as " + client.user.tag);
});

// when a member is added to the server
client.on("guildMemberAdd", async (member) => {
    await adjustingTasks(member.guild);
})

// when a member is removed from the server
client.on("guildMemberRemove", async (member) => {
    await adjustingTasks(member.guild);
})

// when a message is posted in the server
client.on("message", async message => {
    if (message.author == client.user || !message.content.startsWith("$")) {
        return;
    }
    let messageContent = message.content;
    let messageServerId = message.guild.id;
    await initiateIfNot(message.guild);
    if (messageContent.startsWith("$help")) {
        let params = messageContent.split(" ");
        if (params.length === 1) {
            message.reply(helpMessage);
            return;
        }
        let helpReply = helpObject[params[1]];
        if (helpReply != undefined) {
            message.reply(helpObject[params[1]]);
        } else {
            message.reply("the specified command $" + params[1] + " doesn't exist.");
        }
    }
    else if (messageContent.startsWith("$rolldice2")) {
        message.reply(getRandomInt(1, 6) + ", " + getRandomInt(1, 6));
    }
    else if (messageContent.startsWith("$rolldice")) {
        message.reply(getRandomInt(1, 6));
    }
    else if (messageContent.startsWith("$getrandom")) {
        let params = messageContent.split(" ");
        if (params.length < 3) {
            message.reply("not a valid command.");
            return;
        }
        params[1] = Number(params[1]);
        params[2] = Number(params[2]);
        if (params[1] > params[2]) {
            message.reply("not a valid command.");
            return;
        }
        message.reply(getRandomInt(Number(params[1]), Number(params[2])));
    }
    else if (messageContent.startsWith("$randomorder")) {
        let params = messageContent.split(" ");
        if (params.length === 1) {
            message.reply("no list of names specified.");
            return;
        }
        let array = params.slice(1);
        let shuffledArray = shuffle(array);
        let reply = "";
        for (var i = 0; i < shuffledArray.length; i++) {
            reply += "\n" + (i + 1) + ". " + shuffledArray[i];
        }
        message.reply(reply);
    }
    else if (messageContent.startsWith("$newgame")) {
        let params = messageContent.split(" ");
        if (params.length === 1) {
            message.reply("specify the players.");
            return;
        }
        const flag = await saveCurrentGameScore(messageServerId);
        let players = [], toSend = [];
        if (params[1] == "all") {
            await message.channel.guild.members.fetch().then((members) => {
                members.forEach(element => {
                    if (!element.user.bot && element.user.presence.status !== "offline") {
                        players.push(element.user.id);
                        toSend.push("<@" + element.user.id + ">");
                    }
                });
            });
        }
        else {
            for (var i = 1; i < params.length; i++) {
                if (params[i] === "") continue;
                toSend.push(params[i]);
                players.push(params[i]);
            }
        }
        await newGame(messageServerId, players);
        if (flag)
            message.reply("previous game scores updated in the leaderboard. New game started with player(s) " + toSend.toString());
        else
            message.reply("new game started with player(s) " + toSend.toString());
    }
    else if (messageContent.startsWith("$endgame")) {
        const flag = await saveCurrentGameScore(messageServerId);
        if (flag) {
            message.reply("game ended. Scores have been updated in the leaderboard.")
        }
        else {
            message.reply("no active game at the moment.");
        }
        await adjustingTasks(message.guild);
    }
    else if (messageContent.startsWith("$leaderboard")) {
        var lb = await getLeaderBoard(messageServerId);
        message.reply("\n" + lb);
    }
    else if (messageContent.startsWith("$currentgamescores")) {
        const lb = await getCurrentScore(messageServerId);
        if (lb !== null)
            message.reply("\n" + lb);
        else
            message.reply("no active game at the moment.");
    }
    else if (messageContent.startsWith("$cancelgame")) {
        const flag = await cancelGame(messageServerId);
        if (flag) {
            message.reply("game cancelled. Scores deleted.");
        }
        else {
            message.reply("no active game at the moment");
        }
    }
    else if (messageContent.startsWith("$resetleaderboard")) {
        await resetLeaderBoard(messageServerId);
        message.reply("leaderboard reset.")
        await adjustingTasks(message.guild);
    }
    else if (messageContent.startsWith("$addscores")) {
        let params = messageContent.split(" ");
        if (params.length === 1) {
            message.reply("please specify the scores.");
            return;
        }
        const flag = await setScores(messageServerId, params.slice(1));
        if (flag === 1) {
            message.reply("scores added.");
        }
        else {
            message.reply("no active game at the moment");
        }
    }
    else if (messageContent.startsWith("$hello")) {
        message.reply("hello! I am GameTime bot. Type $help to know more.");
    }
    else if (messageContent.startsWith("$randomassign")) {
        let params = messageContent.split(" ");
        if (params.length === 1) {
            message.reply("specify the list.");
            return;
        }
        const flag = await assign(message.channel.guild, params.slice(1));
        if (flag === 1) {
            message.reply("assigned.");
        } else if (flag === 2) {
            message.reply("number of items in the list and number of players don't match.");
        } else if (flag === 3) {
            message.reply("no active game at the moment.");
        } else if (flag == 4) {
            message.reply("invalid list.");
        } else {
            message.reply("couldn't assign to one or more members due to their privacy settings. Kindly check if all players allow DMs from this server. Right click on the server icon and enable the option in privacy settings.");
        }
    }
});

// keeps the server running even if replit tab is closed
keepAlive();

// starts the discord bot server
client.login(process.env.TOKEN);