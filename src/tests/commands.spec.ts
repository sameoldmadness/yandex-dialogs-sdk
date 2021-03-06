// Module test for commands class
const Commands = require('../commands')
test('adding a command', () => {
  const commands = new Commands()

  // Testing a string command
  const cb = (ctx) => 'test'

  commands.add('Привет, алиса!', cb)
  expect(commands.length).toBe(1)
  expect(commands.getByName('Привет, алиса!')).toEqual({
    name: 'Привет, алиса!',
    callback: cb,
    type: 'string',
  })
})
