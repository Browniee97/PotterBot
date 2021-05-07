const config = require('./config.json')

const { ActionTypes } = require('botbuilder');

//Required for image manipulation
const Jimp = require('jimp');
const generator = require('@rtpa/phaser-bitmapfont-generator');
const uuid = require('uuid-js');

//Required for sending 
const request = require('request');
const rp = require('request-promise'); //Asycn version of request

//Required for face finding
const { FaceClient, FaceModels } = require("@azure/cognitiveservices-face");
const { CognitiveServicesCredentials } = require("@azure/ms-rest-azure-js");

//Required for blob upload
const { BlobServiceClient } = require('@azure/storage-blob');

//Font generator
const { height } = require('@rtpa/phaser-bitmapfont-generator/src/config');

//Setup face client
const cognitiveServiceCredentials = new CognitiveServicesCredentials(config.COGNITIVE_SERVICES_CREDS);
const client = new FaceClient(cognitiveServiceCredentials, config.COGNITIVE_SERVICES_ENDPOINT);

//Setup blob client
const blobServiceClient = BlobServiceClient.fromConnectionString(config.BLOB_CONNECTIONSTRING);
const containerClient = blobServiceClient.getContainerClient(config.BLOB_CONTAINER_NAME);


class Potterfy{
    constructor() {
        
    }

    async handleMessage(context, botActivityHandler, mode){
        //check if there is an inline image, note this only works with inline images not uploaded files
        if(context.activity.attachments){
            if(context.activity.attachments.length > 1){

                //Load the image
                let buffer = (await this.getInlinePhoto(context))
    
                //Generate a unique name for the image and upload it
                let myUUID = uuid.create()
                const blockBlobClient = containerClient.getBlockBlobClient(myUUID + '.png')
                await blockBlobClient.upload(buffer, buffer.length)
                
                //Set the URL to be the image we just uploaded and make it into a meme
                let url = config.BLOB_BASE_URL + myUUID + ".png"
                await this.makeImage(context, url, botActivityHandler, mode)
            }
        }else{
            //If we werent passed an inline image then chose a photo at random
            let url = await this.choosePhoto(context)
            await this.makeImage(context, url, botActivityHandler, mode);
        }

    }


    async makePotter(context, url, botActivityHandler){

         //Load both images, the base image is loaded from a URL and the lightning bolt is loaded locally
         console.log('Loading Image...')
         let image = await Jimp.read(url)
         let bolt = await Jimp.read('bolt.png')
 
         //Get the data (face rectangle and landmarks) from the image
         var facedata = await this.detectFace(context, url)
         var posx, posy
 
         //Scale the bolt to based on the size of the face, and calculate the position of the bolt. If the face is signinficantly tilted we accomodate for that here
         bolt.resize(0.3* facedata.faceRectangle.width, Jimp.AUTO)
         if(Math.abs(facedata.faceAttributes.headPose.yaw) > 20){
             posx = facedata.faceRectangle.left + (((facedata.faceRectangle.width - bolt.bitmap.width) /2) + ((facedata.faceRectangle.width/2) * (facedata.faceAttributes.headPose.yaw/150 )))
         }else{
             posx = facedata.faceRectangle.left + ((facedata.faceRectangle.width - bolt.bitmap.width) /2)
         }
 
         posy = facedata.faceRectangle.top-(facedata.faceRectangle.height/(10.5+(facedata.faceAttributes.headPose.pitch/90)))
 
         //Superimpose the bolt over the base image and the determined location
         image.blit(bolt, posx, posy)
 
         //To avoid Teams croping the uploaded image when displayed inline we crop the image to be a square so it will always be fully displayed inline in Teams.
         //We determine which Dimension is longer and therefore which dimension to crop, and ensure it is cropped centered on the face.
         if(image.bitmap.width > image.bitmap.height){
             let dim = image.bitmap.height
             image.crop((facedata.faceLandmarks.noseTip.x - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.x - (dim/2)), 0, dim, dim)
         }else{
             let dim = image.bitmap.width
             image.crop(0, (facedata.faceLandmarks.noseTip.y - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.y - (dim/2)) , dim, dim)
         }

         return image;
    }

    async makeSic(context, url, botActivityHandler){

        //Load both images, the base image is loaded from a URL and the thermometer is loaded locally
        console.log('Loading Image...')
        let image = await Jimp.read(url)
        let thermo = await Jimp.read('thermo.png')

        //Get the data (face rectangle and landmarks) from the image
        var facedata = await this.detectFace(context, url)
        var posx, posy

        //Scale the thermometer based on the size of the face, and calculate the position of the based on the location of the mouth
        thermo.resize(0.8 * facedata.faceRectangle.width, Jimp.AUTO)
        posx = facedata.faceLandmarks.mouthRight.x - (thermo.bitmap.width / 8)

        posy = facedata.faceLandmarks.mouthRight.y - thermo.bitmap.height;

        //Superimpose the thermomter over the base image and the determined location
        image.blit(thermo, posx, posy)

        //To avoid Teams croping the uploaded image when displayed inline we crop the image to be a square so it will always be fully displayed inline in Teams.
        //We determine which Dimension is longer and therefore which dimension to crop, and ensure it is cropped centered on the face.
        if(image.bitmap.width > image.bitmap.height){
            let dim = image.bitmap.height
            image.crop((facedata.faceLandmarks.noseTip.x - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.x - (dim/2)), 0, dim, dim)
        }else{
            let dim = image.bitmap.width
            image.crop(0, (facedata.faceLandmarks.noseTip.y - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.y - (dim/2)) , dim, dim)
        }

        return image;
   }

   async makeNonTech(context, url, botActivityHandler){

    //Load both images, the base image is loaded from a URL and the hat is loaded locally
    console.log('Loading Image...')
    let image = await Jimp.read(url)
    let hat = await Jimp.read('hat.png')

    
    //Get the data (face rectangle and landmarks) from the image
    var facedata = await this.detectFace(context, url)
    var posx, posy

    //Scale the hat to based on the size of the face, and calculate the position of the hat based on the corners of the face rectangle
    hat.resize(1.2 * facedata.faceRectangle.width, Jimp.AUTO)
    posx = facedata.faceRectangle.left - (((facedata.faceRectangle.width - hat.bitmap.width) /2) + ((facedata.faceRectangle.width/2) * (facedata.faceAttributes.headPose.yaw/150 )))

    posy = facedata.faceRectangle.top - hat.bitmap.height

    //Superimpose the hat over the base image and the determined location
    image.blit(hat, posx, posy)

    //To avoid Teams croping the uploaded image when displayed inline we crop the image to be a square so it will always be fully displayed inline in Teams.
    //We determine which Dimension is longer and therefore which dimension to crop, and ensure it is cropped centered on the face.
    if(image.bitmap.width > image.bitmap.height){
        let dim = image.bitmap.height
        image.crop((facedata.faceLandmarks.noseTip.x - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.x - (dim/2)), 0, dim, dim)
    }else{
        let dim = image.bitmap.width
        image.crop(0, (facedata.faceLandmarks.noseTip.y - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.y - (dim/2)) , dim, dim)
    }

    return image;
}

    async makeColonel(context, url, botActivityHandler){

        //Load all images, the base image is loaded from a URL and the glasses and tie are loaded locally
        console.log('Loading Image...')
        let image = await Jimp.read(url)
        let tie = await Jimp.read('tie.png')
        let glasses = await Jimp.read('glasses.png')

        //Get the data (face rectangle and landmarks) from the image
        var facedata = await this.detectFace(context, url)
        var posx, posy

        //Scale the tie based on the size of the face, and calculate the position of the bolt tie based on the middle of the bottom of the face rectangle, additionaly try to match the rotation of the head
        tie.resize(0.8* facedata.faceRectangle.width, Jimp.AUTO)
        if(Math.abs(facedata.faceAttributes.headPose.yaw) > 20){
            posx = facedata.faceRectangle.left + (((facedata.faceRectangle.width - tie.bitmap.width) /2) + ((facedata.faceRectangle.width/2) * (facedata.faceAttributes.headPose.yaw/150 )))
        }else{
            posx = facedata.faceRectangle.left + ((facedata.faceRectangle.width - tie.bitmap.width) /2)
        }

        posy = facedata.faceRectangle.top + (1.3* facedata.faceRectangle.height);
        

        //Superimpose the tie over the base image and the determined location
        image.blit(tie, posx, posy)

        //Scale the glasses to based on the size of the face, and calculate the position of the glasses based of the position of the eyes

        //TODO - Calculate the difference in the height of the two eye, use that to calculate the rotation to apply to the glasses so both lenses are over both eyes
        glasses.resize(1* facedata.faceRectangle.width, Jimp.AUTO)
        posx = facedata.faceLandmarks.eyebrowLeftOuter.x - (glasses.bitmap.width / 8);

        posy = facedata.faceLandmarks.eyebrowRightOuter.y - (glasses.bitmap.height / 4);

        //Superimpose the glasses over the image 
        image.blit(glasses, posx, posy)

        //To avoid Teams croping the uploaded image when displayed inline we crop the image to be a square so it will always be fully displayed inline in Teams.
        //We determine which Dimension is longer and therefore which dimension to crop, and ensure it is cropped centered on the face.
        if(image.bitmap.width > image.bitmap.height){
            let dim = image.bitmap.height
            image.crop((facedata.faceLandmarks.noseTip.x - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.x - (dim/2)), 0, dim, dim)
        }else{
            let dim = image.bitmap.width
            image.crop(0, (facedata.faceLandmarks.noseTip.y - (dim/2) < 0) ? 0 :(facedata.faceLandmarks.noseTip.y - (dim/2)) , dim, dim)
        }

        return image;
   }


    async makeImage(context, url, botActivityHandler, mode){

        var image

        //Apply the correct transformation depending on the mode selected
        switch(mode){
            case 'Potter':
                image = await this.makePotter(context, url, botActivityHandler)
                break
            
            case 'Colonel':
                image = await this.makeColonel(context, url, botActivityHandler)
                break

            case 'Sic':
                image = await this.makeSic(context, url, botActivityHandler)
                break

            case 'Technical':
                image = await this.makeNonTech(context, url, botActivityHandler)
                break
            
            default:
                image = await this.makePotter(context, url, botActivityHandler)
                break
        }

        //We need to dynamically generate the font depending on the size of the image.
        await this.generateFont(Math.floor(image.bitmap.width/15))
        console.log('Image Loaded\nLoading Font...')

        //Once the font is generated we can load it and print the text on the image. We get a buffer of the new image which we can then send to Teams
        let font = await Jimp.loadFont('myfont.xml')
        console.log('Font Loaded\nAdding Text...')
        let imageBuffer = await image.print(
            font,
            0,
            0,
            {
                text: context.activity.text.trim(),
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM
            },
            image.bitmap.width,
            image.bitmap.height
        ).quality(1).getBase64Async(Jimp.MIME_PNG);

        console.log('Text Added\nUploading...')

        //We reply to the orignal message, using the buffer to add an attachment to the message
        const replyActivity = { type: ActionTypes.Message };
        replyActivity.text = context.activity.text;
        replyActivity.attachments = [{
            name: 'architecture-resize.png',
            contentType: 'image/png',
            contentUrl: imageBuffer
        }]

    await context.sendActivity(replyActivity);
    console.log('Image Sent!')    
    }


    async detectFace(context, url){
        //Run the uploaded image through the Azure Face API
        var options = {
            returnFaceLandmarks: true,
            returnFaceAttributes : ['headPose']
        }
        let facedata = await client.face.detectWithUrl(url, options)
        return facedata[0]
    }

    async choosePhoto(context){
        //We get a list of all the images in the blob and then pick one randomly 
        var photos = new Array()

        for await (const blob of containerClient.listBlobsFlat()) {
            photos.push(blob.name)
        }

        let index = Math.floor(Math.random() * photos.length); 
        console.log("chose index: " + index + "\nChose photo: " + photos[index] + "\nURL: " + config.BLOB_BASE_URL + photos[index])
        return String(config.BLOB_BASE_URL + photos[index])

    }

    async generateFont(size){
        //Generate a font a save it locally 
        return await generator.TextStyle2BitmapFont(
            {
                path: './',
                fileName: 'myfont',
                textStyle: {
                    fontFamily: 'Impact',
                    fontSize: size.toString() + 'px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: size/15,
                    padding: {
                        x: 1
                    }
                }
            }
        );
    }

    async getInlinePhoto(context){
        //Even though this is an inline image Teams still uploads it somewhere and this is how we will retrieve the photo
        //When an inline image is sent to teams there are two attachments to the message, one for information about the attachment, and importantly the URL it is uploaded to
        //And then the attachment itself, this is encoded in such a way its not worth us trying to process so instead we will use the URL
        let contentUrl = context.activity.attachments[0].contentUrl
        var access_token
        
        //To access the image URL we need to authenticate, and to do that we need to generate an access token for the bot, and we can do that using the following POST request.
        //At the time of writing this the Microsoft documentation around this framework is sorely out of date and this isnt actually documented anywhere to just my word for the fact that it works
        await rp({
            method: 'POST',
            url:    'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
            body:   "grant_type=client_credentials&client_id=" + process.env.BotId + "&client_secret=" + process.env.BotPassword + "&scope=https%3A%2F%2Fapi.botframework.com%2F.default"
        }).then(function (body){
                access_token = JSON.parse(body).access_token
        })
        
        //Once we have an access token we can then retrieve the image and return the Base64 encoded image
        return await new Promise((resolve, reject) => {
            let options = {
                url: contentUrl,
                headers: {
                    "Authorization": `Bearer ${access_token}`
                },
                encoding: null,
            };
            request.get(options, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (res.statusCode !== 200) {
                    console.log(`Attachment download error. statusCode: ${res.statusCode}`, body);
                    reject(res.statusMessage);
                } else {
                    resolve(body);
                }
            });
        });
    }
}

module.exports.Potterfy = Potterfy;