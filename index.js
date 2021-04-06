const Discord = require("discord.js");
const client = new Discord.Client();
const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/gametimedb", {useNewUrlParser: true, useUnifiedTopology: true});

const ScoreboardSchema = new mongoose.Schema({
    serverId: String, 
    scores: [
        {
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
            playerName: String, 
            playerScore: Number
        }
    ]
});

const CurrentGame = mongoose.model("CurrentGame", CurrentGameSchema);

const helpMessage = "the available commands are $rolldice, $rolldice2, $getrandom, $randomorder. Type $help followed by the command without the $ to get to know more.";

const helpObject = {
    "rolldice": "$rolldice returns a random number between 1 and 6 (inclusive)",
    "rolldice2": "$rolldice2 returns two random numbers between 1 and 6 (inclusive)",
    "getrandom": "$getrandom takes in 2 values. Ex: $getrandom 1 10. This returns a random number between 1 and 10 (inclusive)",
    "randomorder": "$randomorder takes in a list of values. Ex: $randomorder val1 val2 val3. This returns the passed values in a shuffled order"
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



client.on("message", message=>{
    if (message.author==client.user){
        return;
    }
    let messageServerId = message.guild.id;
    let messageContent = message.content;
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
        if (params.length<3 || params[1]>params[2]){
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

});

client.login(process.env.TOKEN);