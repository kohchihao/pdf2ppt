require('dotenv').config()
const fs = require('fs');
const tough = require('tough-cookie');
const request = require('request-promise');
const Telegraf = require('telegraf');
const bot = new Telegraf(process.env.BOT_API);
const uuidv4 = require('uuid/v4');


bot.on('document', ctx => {
  if (
    ctx.message.document &&
    ctx.message.document.mime_type === 'application/pdf'
  ) {
    console.log(ctx.message.document);
    let document = ctx.message.document;
    bot.telegram.getFileLink(document.file_id).then(data => {
      console.log('file', data);
      var options = {
        method: 'GET',
        uri: data,
        resolveWithFullResponse: true
      };
      let uuid = uuidv4();
      if (!fs.existsSync('./temp/' + uuid)) {
        fs.mkdirSync('./temp/' + uuid);
      }
      request(options)
        .pipe(fs.createWriteStream('./temp/' + uuid + '/' + document.file_name))
        .on('finish', () => {
          console.log('finish downloading pdf..');
          download('./temp/' + uuid, document.file_name);
        })
        .on('error', error => {
          console.log('Error in creating map', error);
          //remove folder and tell user error.
        });
    });
  }
});

const download = (path, fileName) => {
  request({
    method: 'POST',
    uri: 'https://simplypdf.com/api/convert',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'multipart/form-data'
    },
    formData: {
      DynamicFile: fs.createReadStream(path + '/' + fileName),
      OutputFormat: 'PowerPoint'
    },
    resolveWithFullResponse: true
  })
  .then(r => {
    console.log('response', r.body);
    let id = JSON.parse(r.body).id;
    let cookieValue = r.headers['set-cookie'][0]
      .split('=', 2)[1]
      .slice(0, 24);
    let cookie = new tough.Cookie({
      key: 'ASP.NET_SessionId',
      value: cookieValue,
      domain: 'simplypdf.com',
      httpOnly: true
    });
    let cookiejar = request.jar();
    cookiejar.setCookie(cookie, 'https://simplypdf.com');
    let options = {
      method: 'GET',
      uri: 'https://simplypdf.com/api/status/' + id,
      headers: {
        Accept: 'application/json'
      },
      jar: cookiejar,
      resolveWithFullResponse: true
    };

    request(options)
      .then(res => {
        console.log('status', res.body);
        let status = JSON.parse(res.body).status;
        setTimeout(() => {
          if (status === 'ready') {
            console.log('ready for download...');
            let id = JSON.parse(res.body).id;
            let options = {
              method: 'GET',
              uri: 'https://simplypdf.com/api/download/' + id,
              jar: cookiejar,
              resolveWithFullResponse: true
            };

            let file_name = fileName.split('.')[0];
            request(options)
              .pipe(fs.createWriteStream(path + '/' + file_name + '.pptx'))
              .on('finish', function() {
                console.log('finish downloading pptx...');
              })
              .on('error', function(error) {
                console.log('Error in creating map', error);
              });
          }
        }, 10000);
      });
  })

  .catch(err => {
    console.log('err', err);
  });
};

bot.startPolling();
