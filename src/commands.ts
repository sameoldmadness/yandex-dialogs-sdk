import Command from './command'
import utils from './utils'
import Fuse from 'fuse.js'

// declaring possible command types
const TYPE_STRING = 'string'
const TYPE_FIGURE = 'figure'
const TYPE_REGEXP = 'regexp'
const TYPE_ARRAY = 'array'

class Commands {
  public commands: Command[]
  public fuseOptions: {}
  constructor(config = null) {
    this.commands = []
    this.fuseOptions = config || {
      tokenize: true,
      threshold: 0.1,
      distance: 10,
      keys: ['name'],
    }
  }

  public get() {
    return this.commands
  }

  get _strings() {
    return this.commands.filter((command) => command.type !== TYPE_REGEXP)
  }
  get _figures() {
    return this.commands.filter((command) => command.type === TYPE_FIGURE)
  }
  get _regexps() {
    return this.commands.filter((command) => command.type === TYPE_REGEXP)
  }

  public _searchStrings(requestedCommandName) {
    const stringCommands = this._strings
    const fuse = new Fuse(stringCommands, this.fuseOptions)
    return fuse.search(requestedCommandName)
  }

  public _searchFigures(requestedCommandName) {
    const figuresCommands = this._figures
    return figuresCommands.filter((figure) => {
      const reg = utils.getFiguresRegexp(figure.name)
      return requestedCommandName.match(reg)
    })
  }

  public _searchRegexps(requestedCommandName) {
    const regexpCommands = this._regexps
    // @TODO: include matches and captured groups
    return regexpCommands.filter((reg) => requestedCommandName.match(reg.name))
  }

  public search(requestedCommandName) {
    const matchedStrings = this._searchStrings(requestedCommandName)
    const matchedRegexps = this._searchRegexps(requestedCommandName)
    const matchedFigures = this._searchFigures(requestedCommandName)
    if (matchedStrings.length > 0) {
      return matchedStrings
    } else if (matchedRegexps.length > 0) {
      return matchedRegexps
    } else if (matchedFigures.length > 0) {
      return matchedFigures
    } else {
      return []
    }
  }

  public getByName(name) {
    if (!name) { throw new Error('Name is not specified') }
    return this.commands.find((command) =>
      command.name.toLowerCase() === name.toLowerCase(),
    )
  }

  get length() {
    return this.commands.length
  }

  public add(name, callback) {
    this.commands.push(new Command(name, callback))
  }

  public flush() {
    this.commands = []
  }
}

module.exports = Commands
module.exports.Command = Command

export default Commands
export { Command }
