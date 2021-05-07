// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
    TurnContext,
    MessageFactory,
    TeamsActivityHandler,
    CardFactory,
    ActionTypes
} = require('botbuilder');

const config = require('./config.json')

const { Potterfy } = require('./potterfy')

const request = require('request');
const rp = require('request-promise');

class BotActivityHandler extends TeamsActivityHandler {
    constructor() {
        
        const potterfy = new Potterfy;

        super();
        /* Conversation Bot */
        /*  Teams bots are Microsoft Bot Framework bots.
            If a bot receives a message activity, the turn handler sees that incoming activityW
            and sends it to the onMessage activity handler.
            Learn more: https://aka.ms/teams-bot-basics.

            NOTE:   Ensure the bot endpoint that services incoming conversational bot queries is
                    registered with Bot Framework.
                    Learn more: https://aka.ms/teams-register-bot. 
        */
        // Registers an activity event handler for the message event, emitted for every incoming message activity.
        this.onDialog(async (context, next) => {
            TurnContext.removeRecipientMention(context.activity);
            console.log('event triggered')

            //Check if the activity contains a message
            if(context.activity.text){

                //This switch allows for parsing of exact commands
                switch (context.activity.text.trim()) {
                    case 'Hello':
                        await this.mentionActivityAsync(context);
                        break;
                    case 'Test':
                        // By default for unknown activity sent by user show
                        // a card with the available actions.
                        const value = { count: 0 };
                        const card = CardFactory.heroCard(
                            'Lets talk...',
                            null,
                            [{
                                type: ActionTypes.MessageBack,
                                title: 'Say Hello world',
                                value: value,
                                text: 'Hello'
                            }]);
                        await context.sendActivity({ attachments: [card] });
                        break;
                    
                    //Since we cant switch based on partial contents of the message handling of these are done in the default case
                    default:
                        var content = context.activity.text.toLowerCase();


                        if(context.activity.text.toLowerCase().includes("the boy who")){
                            await potterfy.handleMessage(context, this, 'Potter')
                        }else if(context.activity.text.toLowerCase().includes("colonel")){
                            await potterfy.handleMessage(context, this,'Colonel')
                        }else if(context.activity.text.toLowerCase().includes("sic")){
                            await potterfy.handleMessage(context, this, 'Sic')
                        }else if(context.activity.text.toLowerCase().includes('technical')){
                            await potterfy.handleMessage(context, this, 'Technical')
                        }
                        break;
                    }
            }

            await next();
        });
    }

    async mentionActivityAsync(context) {
        const TextEncoder = require('html-entities').XmlEntities;
        
        const mention = {
            mentioned: context.activity.from,
            text: `<at>${ new TextEncoder().encode(context.activity.from.name) }</at>`,
            type: 'mention'
        };

        const replyActivity = MessageFactory.text(`Hi ${ mention.text }`);
        replyActivity.entities = [mention];
        
        await context.sendActivity(replyActivity);
    }
    
}

module.exports.BotActivityHandler = BotActivityHandler;

