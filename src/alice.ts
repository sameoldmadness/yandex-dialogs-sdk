import express from 'express'
import Commands from './commands'
import { Sessions } from './sessions'
import { merge } from 'ramda'

import Scene from './scene'
import { ADDRCONFIG } from 'dns'

const Ctx = require('./ctx')

const {
  selectCommand,
  selectSessionId,
  isFunction,
} = require('./utils')

const DEFAULT_ANY_CALLBACK = () => 'Что-то пошло не так. Я не знаю, что на это сказать.'

export default class Alice {
  private anyCallback: (ctx: Ctx) => void
  private welcomeCallback: (ctx: Ctx) => void
  private commands: Commands
  private middlewares: any[]
  private scenes: Scene[]
  private currentScene: Scene | null
  private sessions: Sessions
  private config: {}
  private server: {}

  constructor(config = {}) {
    this.anyCallback = DEFAULT_ANY_CALLBACK
    this.welcomeCallback = null
    this.commands = new Commands(config.fuseOptions || null)
    this.middlewares = []
    this.scenes = []
    this.currentScene = null
    this.sessions = new Sessions()
    this.config = config

    this._handleEnterScene = this._handleEnterScene.bind(this)
    this._handleLeaveScene = this._handleLeaveScene.bind(this)
  }

  /* @TODO: Implement watchers (errors, messages) */
  // tslint:disable-next-line:no-empty
  public on() {

  }

  /*
   * Attach alice middleware to the application
   * @param {Function} middleware - function, that receives {context}
   * and makes some modifications with it.
   */
  public use(middleware) {
    if (!isFunction(middleware)) {
      throw new Error('Any middleware could only be a function.')
    }
    this.middlewares.push(middleware)
  }

  /*
   * Set up the command
   * @param {string | Array<string> | regex} name — Trigger for the command
   * @param {Function} callback — Handler for the command
   */
  public command(name, callback) {
    this.commands.add(name, callback)
  }

  /*
  * Стартовая команда на начало сессии
  */
  public welcome(callback) {
    this.welcomeCallback = callback
  }

  /*
   * Если среди команд не нашлось той,
   * которую запросил пользователь,
   * вызывается этот колбек
   */
  public any(callback) {
    this.anyCallback = callback
  }

  /*
   * Match the request with action handler,
   * compose and return a reply.
   * @param {Object} req — JSON request from the client
   * @param {Function} sendResponse — Express res function while listening on port.
   */
  public async handleRequestBody(req, sendResponse) {
    const requestedCommandName = selectCommand(req)

    /* clear old sessions */
    if (this.sessions.length > (this.config.sessionsLimit || 1000)) {
      this.sessions.flush()
    }

    /* initializing session */
    const sessionId = selectSessionId(req)
    const session = this.sessions.findOrCreate(sessionId)

    /* check whether current scene is not defined */
    if (!session.getData('currentScene')) {
      session.setData('currentScene', null)
    }

    /* give control to the current scene */
    if (session.getData('currentScene') !== null) {
      const matchedScene = this.scenes.find((scene) => {
        return scene.name === session.getData('currentScene')
      })

      /*
       * Checking whether that's the leave scene
       * activation trigger
       */
      if (matchedScene) {
        if (matchedScene.isLeaveCommand(requestedCommandName)) {
          matchedScene.handleRequest(req, sendResponse, session)
          session.setData('currentScene', null)
          return true
        } else {
          const sceneResponse = await matchedScene.handleRequest(
            req, sendResponse, session,
          )
          if (sceneResponse) {
            return true
          }
        }
      }
    } else {
      /*
       * Looking for scene's activational phrases
       */
      const matchedScene = this.scenes.find((scene) =>
        scene.isEnterCommand(requestedCommandName))
      if (matchedScene) {
        session.setData('currentScene', matchedScene.name)
        const sceneResponse = await matchedScene.handleRequest(
          req, sendResponse, session,
        )
        if (sceneResponse) {
          return true
        }
      }
    }

    const requestedCommands = this.commands.search(requestedCommandName)

    /*
     * Initializing context of the request
     */
    const ctxDefaultParams = {
      req,
      session,
      sendResponse: sendResponse || null,
      /*
       * if Alice is listening on express.js port, add this server instance
       * to the context
       */
      server: this.server || null,
    }

    /*
    * Если новая сессия, то запускаем стартовую команду
    */
    if (req.session.new && this.welcomeCallback) {
      const ctxInstance = new Ctx(ctxDefaultParams)
      return await this.welcomeCallback(ctxInstance)
    }
    /*
     * Команда нашлась в списке.
     * Запускаем её обработчик.
     */
    if (requestedCommands.length !== 0) {
      const requestedCommand = requestedCommands[0]
      const ctxInstance = new Ctx(merge(ctxDefaultParams, {
        command: requestedCommand,
      }))

      return await requestedCommand.callback(ctxInstance)
    }

    /*
     * Такой команды не было зарегестрировано.
     * Переходим в обработчик исключений
     */
    const ctx = new Ctx(ctxDefaultParams)
    return await this.anyCallback(ctx)
  }

  /*
   * Same as handleRequestBody, but syntax shorter
   */
  public async handleRequest(req, sendResponse) {
    return this.handleRequestBody(req, sendResponse)
  }

  /*
   * Метод создаёт сервер, который слушает указанный порт.
   * Когда на указанный URL приходит POST запрос, управление
   * передаётся в @handleRequestBody
   *
   * При получении ответа от @handleRequestBody, результат
   * отправляется обратно.
   */
  public async listen(callbackUrl = '/', port = 80, callback) {
    return new Promise((resolve) => {
      const app = express()
      app.use(express.json())
      app.post(callbackUrl, async (req, res) => {
        const handleResponseCallback = (response) => res.send(response)
        await this.handleRequestBody(req.body, handleResponseCallback)
      })
      this.server = app.listen(port, () => {
        // Resolves with callback function
        if (isFunction(callback)) {
          return callback.call(this)
        }

        // If no callback specified, resolves as a promise.
        return resolve()
        // Resolves with promise if no callback set
      })
    })
  }

  public registerScene(scene) {
    this.scenes.push(scene)
  }

  public stopListening() {
    if (this.server && this.server.close) {
      this.server.close()
    }
  }

  private _handleEnterScene(sceneName) {
    this.currentScene = sceneName
  }
  private _handleLeaveScene(sceneName) {
    this.currentScene = null
  }
}

module.exports = Alice
