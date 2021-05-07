// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Generated with EchoBot .NET Template version v4.11.1

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Schema;
using ImageProcessor;
using System.IO;

namespace EchoBot.Bots
{
    public class EchoBot : ActivityHandler
    {
        protected override async Task OnMessageActivityAsync(ITurnContext<IMessageActivity> turnContext, CancellationToken cancellationToken)
        {
            var replyText = $"Echo: {turnContext.Activity.Text}";
            await turnContext.SendActivityAsync(MessageFactory.Text(replyText, replyText), cancellationToken);


            if (turnContext.Activity.Text.ToLower().Contains("test"))
            {

                //HeroCard heroCard = new HeroCard("TEST", "test", "This is a test");
                //var reply = MessageFactory.Attachment(heroCard.ToAttachment());
                //await turnContext.SendActivityAsync(reply, cancellationToken);

                byte[] Bytes = File.ReadAllBytes("test.jpg");
                MemoryStream inStream = new MemoryStream(Bytes);
                ImageFactory imageFactory = new ImageFactory(preserveExifData: true);
                imageFactory.Load(inStream);

            }
        }

        protected override async Task OnMembersAddedAsync(IList<ChannelAccount> membersAdded, ITurnContext<IConversationUpdateActivity> turnContext, CancellationToken cancellationToken)
        {
            var welcomeText = "Hello and welcome!";
            foreach (var member in membersAdded)
            {
                if (member.Id != turnContext.Activity.Recipient.Id)
                {
                    await turnContext.SendActivityAsync(MessageFactory.Text(welcomeText, welcomeText), cancellationToken);
                }
            }
        }
    }
}
