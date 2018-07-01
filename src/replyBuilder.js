const {
  DEFAULT_END_SESSION,
  ALICE_PROTOCOL_VERSION
} = require('./constants')

class ReplyBuilder {
  constructor(request) {
    this.reply = {
      response: {
        buttons: [],
        end_session: DEFAULT_END_SESSION
      },
      version: ALICE_PROTOCOL_VERSION
    }

    if (request) {
      this.reply.session = request.session
    }
  }

  text(textMessage) {
    if (!textMessage) {
      throw new Error('Text message for reply could not be empty!')
    }
    this.reply.response.text = textMessage
    return this
  }

  tts(ttsMessage) {
    if (!ttsMessage) {
      throw new Error('Text-to-speech message for Alice can not be empty!')
    }
    this.reply.response.tts = ttsMessage
    return this
  }

  addButton(button) {
    if (!button) {
      throw new Error('Button block can not be empty!')
    }
    this.reply.response.buttons.push(button)
    return this
  }

  shouldEndSession(flag) {
    this.reply.response.end_session = flag
    return this
  }

  card(items, header) {
    this.reply.response.card = {
      type: 'ItemsList',
      ...header && { header: { text: header } }, 
      items
    }
    return this
  }

  get() {
    return this.reply
  }
}

module.exports = ReplyBuilder