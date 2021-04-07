const Discord = require("discord.js");
const client = new Discord.Client();
const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/gametimedb", {useNewUrlParser: true, useUnifiedTopology: true});

const ScoreboardSchema = new mongoose.Schema({
    serverId: String, 
    scores: [
        {
            playerId: String, 
            playerName: String, 
            playerScore: Number
        }
    ]
});

const ScoreBoard = mongoose.model("ScoreBoard", ScoreboardSchema);

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

const helpMessage = "the available commands are $rolldice, $rolldice2, $getrandom, $randomorder, $newgame, $currentgamescores, $cancelgame, $endgame, $leaderboard, $addscores. Type $help followed by the command without the $ to get to know more.";

const helpObject = {
    "rolldice": "$rolldice returns a random number between 1 and 6 (inclusive)",
    "rolldice2": "$rolldice2 returns two random numbers between 1 and 6 (inclusive)",
    "getrandom": "$getrandom takes in 2 values. Ex: $getrandom 1 10. This returns a random number between 1 and 10 (inclusive)",
    "randomorder": "$randomorder takes in a list of values. Ex: $randomorder val1 val2 val3. This returns the passed values in a shuffled order",
    "newgame": "$newgame takes in a list of mentions (@username) or the word 'all'. It starts a new game and sets the list of mentions as the players. Specifying 'all' would add all the online members to the list.",
    "currentgamescores": "$currentgamescores returns the scoreboard of the current game (if active)",
    "cancelgame": "$cancelgame ends the game and deletes the current game's scoreboard",
    "endgame": "$endgame ends the game and adds the scores of the current game to the overall leaderboard",
    "leaderboard": "$leaderboard displays the overall leaderboard of the server",
    "addscores": "$addscores takes in pair of values. Ex: $addscores @mention1 5 @mention2 10. This adds 5 to the score of @mention1 and adds 10 to the score of @mention2 (if there is an active game)"
};

require("dotenv").config();

client.on("ready", () => {
    console.log("Logged in as "+client.user.tag);
});

function getRandomInt(start, end){
    return Math.floor(Math.random()*(end-start+1))+start;
}

function shuffle(array) {
    let copyOfArray = array;
    copyOfArray.sort(() => Math.random() - 0.5);
    return copyOfArray;
}

function getId(mention){
    let id = "";
    for (var i=0; i<mention.length; i++){
        if (!isNaN(mention.charAt(i))){
            id+=mention.charAt(i);
        }
    }
    return id;
}

async function getName(id){
    const player = await client.users.fetch(id);
    return player.username.toString();
}

function matchAndReturn(board1, board2){
    var flag = false;
    var score;
    const scoresArray = [];
    const board1Scores = board1.scores;
    const board2Scores = board2.scores;
    for (var i=0; i<board1Scores.length; i++){
        flag = false;
        for (var j=0; j<board2Scores.length; j++){
            if (board1Scores[i].playerName===board2Scores[j].playerName){
                flag = true;
                score = board1Scores[i].playerScore+board2Scores[j].playerScore;
                scoresArray.push({playerId: board1Scores[i].playerId, playerName: board1Scores[i].playerName, playerScore: score});
                break;
            }
        }
        if (!flag){
            scoresArray.push(board1Scores[i]);
        }
    }
    return scoresArray;
}

async function setScores(messageServerId, scoresArray){
    const foundGame = await CurrentGame.findOne({serverId: messageServerId});
    if (foundGame===null){
        return 0;
    }
    const newScoresArray = foundGame.scores;
    for (var i=0; i<newScoresArray.length; i++){
        for (var j=0; j<scoresArray.length; j+=2){
            var playerId = getId(scoresArray[j]);
            var playerScore = Number(scoresArray[j+1]);
            if (playerId==newScoresArray[i].playerId){
                newScoresArray[i].playerScore+=playerScore;
            }
        }
    }
    await CurrentGame.updateOne({serverId: messageServerId},{scores: newScoresArray});
    return 1;
}

async function createOrUpdateScoreBoard(messageServerId, foundGame){
    const foundBoard = await ScoreBoard.findOne({serverId: messageServerId});
    if (foundBoard===null){
        var newBoard = new ScoreBoard({
            serverId: messageServerId,
            scores: foundGame.scores
        });
        await newBoard.save();
        return;
    }
    const newScores = matchAndReturn(foundBoard, foundGame);
    await ScoreBoard.updateOne({serverId: messageServerId}, {scores: newScores});
}

async function saveCurrentGameScore(messageServerId){
    const foundGame = await CurrentGame.findOne({serverId: messageServerId});
    if (foundGame===null){
        return false;
    }
    await createOrUpdateScoreBoard(messageServerId, foundGame);
    await CurrentGame.deleteOne({serverId: messageServerId});
    return true;
}

async function createOrAdjustLeaderBoard(messageServerId, players){
    const lb = await ScoreBoard.findOne({serverId: messageServerId});
    var scoresArray;
    if (lb===null){
        scoresArray = [];
        for (var i=0; i<players.length; i++){
            var id = players[i];
            var name = await getName(id);
            scoresArray.push({
                playerId: id, 
                playerName: name, 
                playerScore: 0
            });
        }
        const sb = new ScoreBoard({
            serverId: messageServerId, 
            scores: scoresArray
        });
        await sb.save();
    } else{
        var flag;
        const existingPlayers = lb.scores;
        scoresArray = lb.scores;
        for (var i=0; i<players.length; i++){
            var id = players[i];
            flag=false;
            for (var j=0; j<existingPlayers.length; j++){
                if (existingPlayers[j].playerId===id){
                    flag=true;
                    break;
                }
            }
            if (!flag){
                var name = await getName(id);
                scoresArray.push({
                    playerId: id, 
                    playerName: name, 
                    playerScore: 0
                });
            }
        }
        await ScoreBoard.updateOne({serverId: messageServerId}, {scores: scoresArray})
    }
    
}

async function resetLeaderBoard(messageServerId){
    const lb = await ScoreBoard.findOne({serverId: messageServerId});
    if (lb===null){
        return;
    }
    const scoresArray = lb.scores;
    for (var i=0; i<scoresArray.length; i++){
        scoresArray[i].playerScore = 0;
    }
    await ScoreBoard.updateOne({serverId: messageServerId}, {scores: scoresArray});
}

async function newGame(messageServerId, players){
    let scoresArray = [];
    for (var i=0; i<players.length; i++){
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

async function cancelGame(messageServerId){
    const foundGame = await CurrentGame.findOne({serverId: messageServerId});
    if (foundGame===null){
        return false;
    }
    await CurrentGame.deleteOne({serverId: messageServerId});
    return true; 
}

async function getLeaderBoard(messageServerId){
    var sb = await ScoreBoard.findOne({serverId: messageServerId});
    if (sb===null){
        return null;
    }
    const scores = sb.scores;
    var reply = "";
    scores.sort((a, b)=> b.playerScore-a.playerScore);
    scores.forEach((score, i)=>{
        reply+=(i+1)+". <@"+score.playerId+"> - "+score.playerScore+"\n";
    })
    return reply;
}

async function getCurrentScore(messageServerId){
    const sb = await CurrentGame.findOne({serverId: messageServerId});
    if (sb===null){
        return null;
    }
    const scores = sb.scores;
    var reply = "";
    scores.sort((a, b)=> b.playerScore-a.playerScore);
    scores.forEach((score, i)=>{
        reply+=(i+1)+". <@"+score.playerId+"> - "+score.playerScore+"\n";
    })
    return reply;
}

client.on("message", async message=>{
    if (message.author==client.user || !message.content.startsWith("$")){
        return;
    }
    let messageServerId = message.guild.id;
    let messageContent = message.content;
    let players = [];
    const members = message.channel.guild.members.cache;
    members.forEach((ele)=>{if (!ele.user.bot) players.push(ele.user.id)});
    await createOrAdjustLeaderBoard(messageServerId, players);
    if (messageContent.startsWith("$help")){
        let params = messageContent.split(" ");
        if (params.length===1){
            message.reply(helpMessage);
            return;
        }
        let helpReply = helpObject[params[1]];
        if (helpReply!=undefined){
            message.reply(helpObject[params[1]]);
        } else{
            message.reply("the specified command $"+params[1]+" doesn't exist.");
        }
    }
    else if (messageContent.startsWith("$rolldice2")){
        message.reply(getRandomInt(1, 6) + ", " + getRandomInt(1, 6));
    }
    else if (messageContent.startsWith("$rolldice")){
        message.reply(getRandomInt(1, 6));
    }
    else if (messageContent.startsWith("$getrandom")){
        let params = messageContent.split(" ");
        if (params.length<3){
            message.reply("not a valid command.");
            return;
        }
        params[1] = Number(params[1]);
        params[2] = Number(params[2]);
        if (params[1]>params[2]){
            message.reply("not a valid command.");
            return;
        }
        message.reply(getRandomInt(Number(params[1]), Number(params[2])));
    }
    else if (messageContent.startsWith("$randomorder")){
        let params = messageContent.split(" ");
        if (params.length===1){
            message.reply("no list of names specified.");
            return;
        }
        let array = params.slice(1);
        let shuffledArray = shuffle(array);
        let reply = "";
        for (var i=0; i<shuffledArray.length; i++){
            reply+= "\n"+(i+1)+". "+shuffledArray[i];
        }
        message.reply(reply);
    }
    else if (messageContent.startsWith("$newgame")){
        let params = messageContent.split(" ");
        if (params.length===1){
            message.reply("specify the players.");
            return;
        }
        const flag = await saveCurrentGameScore(messageServerId);
        let players = [], toSend = [];
        if (params[1]=="all"){
            message.channel.guild.members.cache.forEach(element => {
                if (!element.user.bot){
                    players.push(element.user.id);
                    toSend.push("<@"+element.user.id+">");
                }
            });
        }
        else
        {
            for (var i=1; i<params.length; i++){
                if (params[i]==="") continue;
                toSend.push(params[i]);
                players.push(params[i]);
            }
        }
        await newGame(messageServerId, players);
        if (flag)
            message.reply("previous game scores updated in the leaderboard. New game started with player(s) "+toSend.toString());
        else
            message.reply("new game started with player(s) "+toSend.toString());
    }
    else if (messageContent.startsWith("$endgame")){
        const flag = await saveCurrentGameScore(messageServerId);
        if (flag){
            message.reply("game ended. Scores have been updated in the leaderboard.")
        }
        else{
            message.reply("no active game at the moment.");
        }
    }
    else if (messageContent.startsWith("$leaderboard")){
        var lb = await getLeaderBoard(messageServerId);
        message.reply("\n"+lb);
    }
    else if (messageContent.startsWith("$currentgamescores")){
        const lb = await getCurrentScore(messageServerId);
        if (lb!==null)
            message.reply("\n"+lb);
        else
            message.reply("no active game at the moment.");
    }
    else if (messageContent.startsWith("$cancelgame")){
        const flag = await cancelGame(messageServerId);
        if (flag){
            message.reply("game cancelled. Scores deleted.");
        }
        else{
            message.reply("no active game at the moment");
        }
    }
    else if (messageContent.startsWith("$resetleaderboard")){
        await resetLeaderBoard(messageServerId);
        message.reply("leaderboard reset.")
    }
    else if (messageContent.startsWith("$addscores")){
        let params = messageContent.split(" ");
        if (params.length===1){
            message.reply("please specify the scores.");
            return;
        }
        const flag = await setScores(messageServerId, params.slice(1));
        if (flag===1){
            message.reply("scores added.");
        } 
        else {
            message.reply("no active game at the moment");
        }
    }
});

client.login(process.env.TOKEN);